package com.cryptoconnect.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.cryptoconnect.security.JwtService;
import com.cryptoconnect.security.AbuseProtection;
import com.cryptoconnect.security.TokenRevocationService;
import com.cryptoconnect.user.FriendService;
import com.cryptoconnect.user.PresenceRegistry;
import java.time.Instant;
import java.util.HashMap;
import java.util.Set;
import java.util.UUID;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.CloseStatus;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ChatRealtimeHandlerTest {
  private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
  private final JwtService jwt = mock(JwtService.class);
  private final ChatMessageService messages = mock(ChatMessageService.class);
  private final Validator validator = mock(Validator.class);
  private final PresenceRegistry presence = mock(PresenceRegistry.class);
  private final FriendService friends = mock(FriendService.class);
  private ChatRealtimeHandler handler;

  @BeforeEach void setUp() {
    handler = new ChatRealtimeHandler(mapper, jwt, messages, validator, new AbuseProtection(), mock(TokenRevocationService.class), presence, friends);
  }

  @Test void rejectsConversationSubscriptionForNonMember() throws Exception {
    UUID user = UUID.randomUUID();
    UUID conversation = UUID.randomUUID();
    WebSocketSession session = session();
    when(jwt.userId("valid-token")).thenReturn(user);
    when(jwt.tokenId("valid-token")).thenReturn(UUID.randomUUID());
    when(jwt.expiresAt("valid-token")).thenReturn(Instant.now().plusSeconds(3600));
    doThrow(new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Not a conversation member"))
        .when(messages).assertOneToOneMember(conversation, user);
    handler.afterConnectionEstablished(session);
    handler.handleTextMessage(session, new TextMessage("{\"type\":\"authenticate\",\"token\":\"valid-token\"}"));
    handler.handleTextMessage(session, new TextMessage("{\"type\":\"subscribe\",\"conversationId\":\"" + conversation + "\"}"));
    verify(messages).assertOneToOneMember(conversation, user);
    verify(messages, never()).send(any(), any(), any());
  }

  @Test void invalidJwtAndExpiredJwtCannotReachConversationActions() throws Exception {
    WebSocketSession invalid = session();
    when(jwt.userId("invalid-token")).thenThrow(new IllegalArgumentException("bad token"));
    handler.afterConnectionEstablished(invalid);
    handler.handleTextMessage(invalid, new TextMessage("{\"type\":\"authenticate\",\"token\":\"invalid-token\"}"));
    verify(invalid).close(CloseStatus.NOT_ACCEPTABLE.withReason("Authentication failed"));

    UUID user = UUID.randomUUID();
    WebSocketSession expired = session();
    when(jwt.userId("expired-token")).thenReturn(user);
    when(jwt.tokenId("expired-token")).thenReturn(UUID.randomUUID());
    when(jwt.expiresAt("expired-token")).thenReturn(Instant.now().minusSeconds(1));
    handler.afterConnectionEstablished(expired);
    handler.handleTextMessage(expired, new TextMessage("{\"type\":\"authenticate\",\"token\":\"expired-token\"}"));
    verify(expired, times(1)).close(CloseStatus.POLICY_VIOLATION.withReason("Authentication expired"));
    verify(messages, never()).assertOneToOneMember(any(), any());
  }

  @Test void unauthenticatedApplicationActionIsRejected() throws Exception {
    WebSocketSession session = session();
    handler.afterConnectionEstablished(session);
    handler.handleTextMessage(session, new TextMessage("{\"type\":\"subscribe\",\"conversationId\":\"" + UUID.randomUUID() + "\"}"));
    verify(session).close(CloseStatus.NOT_ACCEPTABLE.withReason("Authentication required"));
    verifyNoInteractions(messages);
  }

  @Test void senderIdComesFromAuthenticatedSessionAndMessageIsPersistedBySharedService() throws Exception {
    UUID user = UUID.randomUUID();
    UUID conversation = UUID.randomUUID();
    WebSocketSession session = session();
    when(jwt.userId("valid-token")).thenReturn(user);
    when(jwt.tokenId("valid-token")).thenReturn(UUID.randomUUID());
    when(jwt.expiresAt("valid-token")).thenReturn(Instant.now().plusSeconds(3600));
    when(validator.validate(any(ChatDtos.SendMessageRequest.class))).thenReturn(Set.of());
    var request = new ChatDtos.SendMessageRequest("client-1", "readable over WebSocket");
    var saved = new ChatDtos.MessageResponse(UUID.randomUUID(), conversation, user, "client-1", ChatDtos.MessageFormat.TEXT, request.content(), Instant.now(), null, null);
    when(messages.send(conversation, user, request)).thenReturn(new ChatMessageService.SendResult(saved, true));
    handler.afterConnectionEstablished(session);
    handler.handleTextMessage(session, new TextMessage("{\"type\":\"authenticate\",\"token\":\"valid-token\"}"));
    handler.handleTextMessage(session, new TextMessage("{\"type\":\"subscribe\",\"conversationId\":\"" + conversation + "\"}"));
    handler.handleTextMessage(session, new TextMessage("{\"type\":\"send\",\"conversationId\":\"" + conversation + "\",\"senderId\":\"" + UUID.randomUUID() + "\",\"message\":{\"clientMessageId\":\"client-1\",\"content\":\"readable over WebSocket\"}}"));
    verify(messages).send(conversation, user, request);
    verify(session, atLeastOnce()).sendMessage(argThat(frame -> frame instanceof TextMessage text
        && text.getPayload().contains("\"content\":\"readable over WebSocket\"")));
  }

  @Test void recipientAcknowledgementIsBoundToAuthenticatedRecipient() throws Exception {
    UUID sender = UUID.randomUUID();
    UUID recipient = UUID.randomUUID();
    UUID conversation = UUID.randomUUID();
    UUID messageId = UUID.randomUUID();
    WebSocketSession session = session();
    when(jwt.userId("recipient-token")).thenReturn(recipient);
    when(jwt.tokenId("recipient-token")).thenReturn(UUID.randomUUID());
    when(jwt.expiresAt("recipient-token")).thenReturn(Instant.now().plusSeconds(3600));
    when(messages.acknowledgeDelivery(messageId, recipient)).thenReturn(new ChatMessageService.DeliveryResult(new ChatDtos.MessageResponse(
        messageId, conversation, sender, "client-1", ChatDtos.MessageFormat.TEXT, "readable", Instant.now(), Instant.now(), null), true));
    handler.afterConnectionEstablished(session);
    handler.handleTextMessage(session, new TextMessage("{\"type\":\"authenticate\",\"token\":\"recipient-token\"}"));
    handler.handleTextMessage(session, new TextMessage("{\"type\":\"ack\",\"messageId\":\"" + messageId + "\",\"userId\":\"" + sender + "\"}"));
    verify(messages).acknowledgeDelivery(messageId, recipient);
  }

  @Test void unsubscribeAlsoChecksConversationMembership() throws Exception {
    UUID user = UUID.randomUUID();
    UUID conversation = UUID.randomUUID();
    WebSocketSession session = session();
    when(jwt.userId("valid-token")).thenReturn(user);
    when(jwt.tokenId("valid-token")).thenReturn(UUID.randomUUID());
    when(jwt.expiresAt("valid-token")).thenReturn(Instant.now().plusSeconds(3600));
    doThrow(new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Not a conversation member"))
        .when(messages).assertOneToOneMember(conversation, user);
    handler.afterConnectionEstablished(session);
    handler.handleTextMessage(session, new TextMessage("{\"type\":\"authenticate\",\"token\":\"valid-token\"}"));
    handler.handleTextMessage(session, new TextMessage("{\"type\":\"unsubscribe\",\"conversationId\":\"" + conversation + "\"}"));
    verify(messages).assertOneToOneMember(conversation, user);
  }

  @Test void broadcastsReadableMessageOnlyToSubscribedUsersAndReconnectCanResubscribe() throws Exception {
    UUID sender = UUID.randomUUID();
    UUID recipient = UUID.randomUUID();
    UUID conversation = UUID.randomUUID();
    WebSocketSession senderSession = authenticatedSession("sender-token", sender, conversation);
    WebSocketSession recipientSession = authenticatedSession("recipient-token", recipient, conversation);
    handler.onMessageSaved(new ChatMessageSavedEvent(new ChatDtos.MessageResponse(UUID.randomUUID(), conversation,
        sender, "client-1", ChatDtos.MessageFormat.TEXT, "first readable message", Instant.now(), null, null)));
    verify(recipientSession).sendMessage(argThat(frame -> frame instanceof TextMessage text
        && text.getPayload().contains("\"content\":\"first readable message\"")
        && text.getPayload().contains("\"format\":\"TEXT\"")));
    verify(senderSession, atLeastOnce()).sendMessage(argThat(frame -> frame.getPayload().toString().contains("\"type\":\"message\"")));
    verify(recipientSession).sendMessage(argThat(frame -> frame.getPayload().toString().contains("\"type\":\"message\"")));

    handler.afterConnectionClosed(recipientSession, CloseStatus.NORMAL);
    WebSocketSession reconnected = authenticatedSession("recipient-token", recipient, conversation);
    handler.onMessageSaved(new ChatMessageSavedEvent(new ChatDtos.MessageResponse(UUID.randomUUID(), conversation,
        sender, "client-2", ChatDtos.MessageFormat.TEXT, "second readable message", Instant.now(), null, null)));
    verify(reconnected).sendMessage(argThat(frame -> frame.getPayload().toString().contains("\"clientMessageId\":\"client-2\"")));
    verify(recipientSession, never()).sendMessage(argThat(frame -> frame.getPayload().toString().contains("\"clientMessageId\":\"client-2\"")));
  }

  @Test void legacyMessageBroadcastContainsNoRecoverableContentOrEnvelopeFields() throws Exception {
    UUID sender = UUID.randomUUID();
    UUID recipient = UUID.randomUUID();
    UUID conversation = UUID.randomUUID();
    WebSocketSession recipientSession = authenticatedSession("recipient-token", recipient, conversation);

    handler.onMessageSaved(new ChatMessageSavedEvent(new ChatDtos.MessageResponse(UUID.randomUUID(), conversation,
        sender, "legacy-client", ChatDtos.MessageFormat.LEGACY_ENCRYPTED, null, Instant.now(), null, null)));

    verify(recipientSession).sendMessage(argThat(frame -> frame instanceof TextMessage text
        && text.getPayload().contains("\"format\":\"LEGACY_ENCRYPTED\"")
        && text.getPayload().contains("\"content\":null")
        && !text.getPayload().contains("ciphertext")
        && !text.getPayload().contains("legacy_ciphertext")));
  }

  @Test void failedBroadcastClosesAndRemovesStaleSocket() throws Exception {
    UUID sender = UUID.randomUUID();
    UUID recipient = UUID.randomUUID();
    UUID conversation = UUID.randomUUID();
    WebSocketSession staleRecipient = authenticatedSession("recipient-token", recipient, conversation);
    doThrow(new java.io.IOException("socket is gone")).when(staleRecipient).sendMessage(any(TextMessage.class));

    handler.onMessageSaved(new ChatMessageSavedEvent(new ChatDtos.MessageResponse(UUID.randomUUID(), conversation,
        sender, "client-1", ChatDtos.MessageFormat.TEXT, "readable message", Instant.now(), null, null)));

    verify(staleRecipient).close(CloseStatus.SERVER_ERROR);
    handler.onMessageSaved(new ChatMessageSavedEvent(new ChatDtos.MessageResponse(UUID.randomUUID(), conversation,
        sender, "client-2", ChatDtos.MessageFormat.TEXT, "another readable message", Instant.now(), null, null)));
    verify(staleRecipient, times(1)).sendMessage(argThat(frame ->
        frame instanceof TextMessage textMessage
            && textMessage.getPayload().contains("\"type\":\"message\"")));
  }

  @Test void readReceiptIsSentOnlyToTheOtherSubscribedConversationParticipant() throws Exception {
    UUID sender = UUID.randomUUID();
    UUID reader = UUID.randomUUID();
    UUID conversation = UUID.randomUUID();
    UUID messageId = UUID.randomUUID();
    WebSocketSession senderSession = authenticatedSession("sender-token", sender, conversation);
    WebSocketSession readerSession = authenticatedSession("reader-token", reader, conversation);

    handler.onReadReceiptSaved(new ChatReadReceiptSavedEvent(conversation, reader, java.util.List.of(messageId), Instant.now()));

    verify(senderSession).sendMessage(argThat(frame -> frame instanceof TextMessage text
        && text.getPayload().contains("\"type\":\"read_receipt\"")
        && text.getPayload().contains(messageId.toString())));
    verify(readerSession, never()).sendMessage(argThat(frame -> frame instanceof TextMessage text
        && text.getPayload().contains("\"type\":\"read_receipt\"")));
  }

  @Test void presenceUpdatesAreDeliveredOnlyToAcceptedFriends() throws Exception {
    UUID subject = UUID.randomUUID();
    UUID acceptedFriend = UUID.randomUUID();
    UUID strangerId = UUID.randomUUID();
    WebSocketSession acceptedSession = authenticatedSession("accepted-token", acceptedFriend, UUID.randomUUID());
    WebSocketSession strangerSession = authenticatedSession("stranger-token", strangerId, UUID.randomUUID());
    when(friends.areFriends(acceptedFriend, subject)).thenReturn(true);
    when(friends.areFriends(strangerId, subject)).thenReturn(false);

    handler.onPresenceChanged(new com.cryptoconnect.user.PresenceChangedEvent(subject, true));

    verify(acceptedSession).sendMessage(argThat(frame -> frame instanceof TextMessage text
        && text.getPayload().contains("\"type\":\"presence\"") && text.getPayload().contains(subject.toString())));
    verify(strangerSession, never()).sendMessage(argThat(frame -> frame instanceof TextMessage text
        && text.getPayload().contains("\"type\":\"presence\"")));
  }

  private WebSocketSession authenticatedSession(String token, UUID user, UUID conversation) throws Exception {
    WebSocketSession session = session();
    when(jwt.userId(token)).thenReturn(user);
    when(jwt.tokenId(token)).thenReturn(UUID.randomUUID());
    when(jwt.expiresAt(token)).thenReturn(Instant.now().plusSeconds(3600));
    handler.afterConnectionEstablished(session);
    handler.handleTextMessage(session, new TextMessage("{\"type\":\"authenticate\",\"token\":\"" + token + "\"}"));
    handler.handleTextMessage(session, new TextMessage("{\"type\":\"subscribe\",\"conversationId\":\"" + conversation + "\"}"));
    return session;
  }

  private static WebSocketSession session() {
    WebSocketSession session = mock(WebSocketSession.class);
    when(session.getAttributes()).thenReturn(new HashMap<>());
    when(session.isOpen()).thenReturn(true);
    return session;
  }
}
