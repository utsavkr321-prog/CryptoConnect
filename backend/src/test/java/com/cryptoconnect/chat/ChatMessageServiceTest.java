package com.cryptoconnect.chat;

import com.cryptoconnect.events.SecurityEventService;
import com.cryptoconnect.user.FriendService;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import org.mockito.InOrder;

class ChatMessageServiceTest {
  private final MemberRepository members = mock(MemberRepository.class);
  private final MessageRepository messages = mock(MessageRepository.class);
  private final ConversationRepository conversations = mock(ConversationRepository.class);
  private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
  private final SecurityEventService securityEvents = mock(SecurityEventService.class);
  private final FriendService friends = mock(FriendService.class);
  private final ChatMessageService service = new ChatMessageService(members, messages, conversations, events, securityEvents, friends);
  private final UUID conversationId = UUID.randomUUID();
  private final UUID senderId = UUID.randomUUID();
  private final ChatDtos.SendMessageRequest request = new ChatDtos.SendMessageRequest(
      "client-1", "A readable message");

  @Test void nonMemberCannotSendAndNoMessageIsWritten() {
    UUID outsider = UUID.randomUUID();
    when(conversations.findByIdForMessageSend(conversationId))
        .thenReturn(Optional.of(Conversation.create(senderId, UUID.randomUUID())));
    when(conversations.findById(conversationId))
        .thenReturn(Optional.of(Conversation.create(senderId, UUID.randomUUID())));
    ResponseStatusException error = assertThrows(ResponseStatusException.class,
        () -> service.send(conversationId, outsider, request));
    assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    verifyNoInteractions(messages, events);
  }

  @Test void duplicateIdReturnsPreviouslyStoredEnvelopeWithoutPublishingAgain() {
    ChatMessage existing = new ChatMessage(conversationId, senderId, request.clientMessageId(), request.content());
    when(conversations.findByIdForMessageSend(conversationId)).thenReturn(Optional.of(Conversation.create(senderId, UUID.randomUUID())));
    when(conversations.findById(conversationId)).thenReturn(Optional.of(Conversation.create(senderId, UUID.randomUUID())));
    when(messages.findByConversationIdAndSenderIdAndClientMessageId(conversationId, senderId, "client-1"))
        .thenReturn(Optional.of(existing));
    when(friends.areFriends(eq(senderId), any())).thenReturn(true);

    ChatMessageService.SendResult result = service.send(conversationId, senderId, request);
    assertFalse(result.created());
    assertEquals(existing.getId(), result.message().id());
    assertEquals("A readable message", result.message().content());
    assertEquals(ChatDtos.MessageFormat.TEXT, result.message().format());
    verify(messages, never()).saveAndFlush(any());
    verifyNoInteractions(events);
  }

  @Test void newMessageIsPersistedBeforeTheBroadcastEventIsPublished() {
    when(conversations.findByIdForMessageSend(conversationId)).thenReturn(Optional.of(Conversation.create(senderId, UUID.randomUUID())));
    when(messages.findByConversationIdAndSenderIdAndClientMessageId(conversationId, senderId, "client-1"))
        .thenReturn(Optional.empty());
    when(messages.saveAndFlush(any(ChatMessage.class))).thenAnswer(invocation -> invocation.getArgument(0));
    when(conversations.findById(conversationId)).thenReturn(Optional.of(Conversation.create(senderId, UUID.randomUUID())));
    when(friends.areFriends(eq(senderId), any())).thenReturn(true);

    ChatMessageService.SendResult result = service.send(conversationId, senderId, request);
    assertTrue(result.created());
    assertEquals("A readable message", result.message().content());
    assertEquals(ChatDtos.MessageFormat.TEXT, result.message().format());
    InOrder order = inOrder(messages, events);
    order.verify(messages).saveAndFlush(any(ChatMessage.class));
    verify(securityEvents).record(senderId, "message_sent");
    order.verify(events).publishEvent(any(ChatMessageSavedEvent.class));
  }

  @Test void grandfatheredNonFriendConversationRemainsReadableButRejectsNewMessages() {
    UUID recipientId = UUID.randomUUID();
    Conversation existing = Conversation.create(senderId, recipientId);
    when(conversations.findByIdForMessageSend(conversationId)).thenReturn(Optional.of(existing));
    when(conversations.findById(conversationId)).thenReturn(Optional.of(existing));
    when(friends.areFriends(senderId, recipientId)).thenReturn(false);

    ResponseStatusException error = assertThrows(ResponseStatusException.class,
        () -> service.send(conversationId, senderId, request));

    assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    verifyNoInteractions(messages, events, securityEvents);
  }

  @Test void onlyConversationRecipientCanSetDeliveryReceipt() {
    UUID recipientId = UUID.randomUUID();
    UUID messageId = UUID.randomUUID();
    ChatMessage message = new ChatMessage(conversationId, senderId, "client-1", request.content());
    when(messages.findByIdForDeliveryAck(messageId)).thenReturn(Optional.of(message));
    when(conversations.findById(conversationId)).thenReturn(Optional.of(Conversation.create(senderId, recipientId)));

    ResponseStatusException error = assertThrows(ResponseStatusException.class,
        () -> service.acknowledgeDelivery(messageId, senderId));
    assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    assertNull(message.getDeliveredAt());
    verify(messages, never()).save(any());

    ChatMessageService.DeliveryResult result = service.acknowledgeDelivery(messageId, recipientId);
    assertTrue(result.newlyDelivered());
    assertNotNull(result.message().deliveredAt());
    assertTrue(result.message().deliveredAt().isAfter(Instant.EPOCH));
    verify(messages).save(message);
    ChatMessageService.DeliveryResult duplicate = service.acknowledgeDelivery(messageId, recipientId);
    assertFalse(duplicate.newlyDelivered());
    assertEquals(result.message().deliveredAt(), duplicate.message().deliveredAt());
    verify(messages, times(1)).save(message);
  }

  @Test void markingReadOnlyChangesUnreadMessagesForAnAuthorizedConversationMember() {
    UUID recipientId = UUID.randomUUID();
    UUID firstMessage = UUID.randomUUID();
    UUID secondMessage = UUID.randomUUID();
    when(conversations.findByIdForMessageSend(conversationId))
        .thenReturn(Optional.of(Conversation.create(senderId, recipientId)));
    when(conversations.findById(conversationId)).thenReturn(Optional.of(Conversation.create(senderId, recipientId)));
    when(members.existsByIdConversationIdAndIdUserId(conversationId, recipientId)).thenReturn(true);
    when(messages.findUnreadMessageIds(conversationId, recipientId, java.util.List.of(firstMessage))).thenReturn(java.util.List.of(firstMessage));
    when(messages.markMessagesRead(anyList(), any())).thenReturn(2);

    ChatMessageService.ReadResult result = service.markRead(conversationId, recipientId, java.util.List.of(firstMessage));

    assertEquals(1, result.messagesMarkedRead());
    assertNotNull(result.readAt());
    verify(messages).markMessagesRead(java.util.List.of(firstMessage), result.readAt());
    verify(events).publishEvent((Object) argThat((Object event) -> event instanceof ChatReadReceiptSavedEvent receipt
        && receipt.messageIds().equals(java.util.List.of(firstMessage))));
    verify(messages, never()).markMessagesRead(java.util.List.of(secondMessage), result.readAt());
  }

  @Test void nonMemberCannotMarkConversationMessagesRead() {
    when(conversations.findByIdForMessageSend(conversationId))
        .thenReturn(Optional.of(Conversation.create(senderId, UUID.randomUUID())));
    when(members.existsByIdConversationIdAndIdUserId(conversationId, senderId)).thenReturn(false);

    assertThrows(ResponseStatusException.class, () -> service.markRead(conversationId, senderId, java.util.List.of(UUID.randomUUID())));
    verify(messages, never()).findUnreadMessageIds(any(), any(), anyList());
  }
}
