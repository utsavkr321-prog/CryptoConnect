package com.cryptoconnect.chat;

import com.cryptoconnect.security.SecurityConfig;
import com.cryptoconnect.security.JwtService;
import com.cryptoconnect.user.User;
import com.cryptoconnect.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.TestPropertySource;

import java.util.UUID;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

@WebMvcTest(ChatController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "app.cors-origin=http://localhost:5173")
class ChatContractTest {
  @MockitoBean com.cryptoconnect.security.TokenRevocationService revocations;
  @Autowired MockMvc mvc;
  @MockitoBean ConversationRepository conversations;
  @MockitoBean ConversationService conversationService;
  @MockitoBean MemberRepository members;
  @MockitoBean MessageRepository messages;
  @MockitoBean UserRepository users;
  @MockitoBean ChatMessageService chatMessages;
  @MockitoBean JwtService jwt;

  private final UUID user = UUID.randomUUID();
  private final UUID conversation = UUID.randomUUID();

  @Test void conversationCreationRequiresAuthentication() throws Exception {
    mvc.perform(post("/api/conversations").contentType(MediaType.APPLICATION_JSON)
        .content("{\"recipientId\":\"" + UUID.randomUUID() + "\"}"))
      .andExpect(status().isUnauthorized());
    verifyNoInteractions(conversationService);
  }

  @Test void conversationListRequiresAuthentication() throws Exception {
    mvc.perform(get("/api/conversations").accept(MediaType.APPLICATION_JSON))
      .andExpect(status().isUnauthorized());
    verifyNoInteractions(conversations, users, messages);
  }

  @Test void nonParticipantCannotListAnotherUsersConversationDetails() throws Exception {
    UUID stranger = UUID.randomUUID();
    when(conversations.findByParticipantLowIdOrParticipantHighId(stranger, stranger)).thenReturn(List.of());

    mvc.perform(get("/api/conversations")
        .with(authentication(new UsernamePasswordAuthenticationToken(stranger, null, AuthorityUtils.NO_AUTHORITIES)))
        .accept(MediaType.APPLICATION_JSON))
      .andExpect(status().isOk())
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().json("[]"));

    verify(conversations).findByParticipantLowIdOrParticipantHighId(stranger, stranger);
    verifyNoInteractions(users, messages);
  }

  @Test void conversationListUsesAuthenticatedParticipantScopeAndReturnsOnlySafeParticipantFields() throws Exception {
    User owner = new User("owner@example.test", "Owner", "password-hash");
    User contact = new User("contact@example.test", "Contact", "password-hash");
    owner.setPublicKey("owner-public-key");
    owner.setKeyFingerprint("OWNER-FINGERPRINT");
    contact.setPublicKey("contact-public-key");
    contact.setKeyFingerprint("CONTACT-FINGERPRINT");
    Conversation ownConversation = Conversation.create(owner.getId(), contact.getId());
    when(conversations.findByParticipantLowIdOrParticipantHighId(owner.getId(), owner.getId())).thenReturn(List.of(ownConversation));
    when(users.findAllById(any())).thenReturn(List.of(owner, contact));

    mvc.perform(get("/api/conversations")
        .with(authentication(new UsernamePasswordAuthenticationToken(owner.getId(), null, AuthorityUtils.NO_AUTHORITIES)))
        .accept(MediaType.APPLICATION_JSON))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[0].participants[0].id").exists())
      .andExpect(jsonPath("$[0].participants[0].name").exists())
      .andExpect(jsonPath("$[0].participants[0].keyFingerprint").exists())
      .andExpect(jsonPath("$[0].participants[0].email").doesNotExist())
      .andExpect(jsonPath("$[0].participants[0].publicKey").doesNotExist())
      .andExpect(jsonPath("$[0].participants[0].passwordHash").doesNotExist())
      .andExpect(jsonPath("$[0].participants[0].privateKey").doesNotExist())
      .andExpect(jsonPath("$[0].participants[0].token").doesNotExist());

    verify(conversations).findByParticipantLowIdOrParticipantHighId(owner.getId(), owner.getId());
  }

  @Test void conversationCreationResponseOmitsEmailAndRawKeys() throws Exception {
    User owner = new User("owner@example.test", "Owner", "password-hash");
    User contact = new User("contact@example.test", "Contact", "password-hash");
    owner.setPublicKey("owner-public-key");
    owner.setKeyFingerprint("OWNER-FINGERPRINT");
    contact.setPublicKey("contact-public-key");
    contact.setKeyFingerprint("CONTACT-FINGERPRINT");
    Conversation existing = Conversation.create(owner.getId(), contact.getId());
    when(conversationService.openOrCreate(owner.getId(), contact.getId())).thenReturn(new ConversationService.OpenResult(existing, false));
    when(users.findById(owner.getId())).thenReturn(java.util.Optional.of(owner));
    when(users.findById(contact.getId())).thenReturn(java.util.Optional.of(contact));

    mvc.perform(post("/api/conversations")
        .with(authentication(new UsernamePasswordAuthenticationToken(owner.getId(), null, AuthorityUtils.NO_AUTHORITIES)))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"recipientId\":\"" + contact.getId() + "\"}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.participants[0].name").exists())
      .andExpect(jsonPath("$.participants[0].keyFingerprint").exists())
      .andExpect(jsonPath("$.participants[0].email").doesNotExist())
      .andExpect(jsonPath("$.participants[0].publicKey").doesNotExist())
      .andExpect(jsonPath("$.participants[0].passwordHash").doesNotExist())
      .andExpect(jsonPath("$.participants[0].privateKey").doesNotExist())
      .andExpect(jsonPath("$.participants[0].token").doesNotExist());
  }

  @Test void creationUsesAuthenticatedPrincipalAsRequester() throws Exception {
    UUID recipient = UUID.randomUUID();
    Conversation existing = Conversation.create(user, recipient);
    when(conversationService.openOrCreate(user, recipient)).thenReturn(new ConversationService.OpenResult(existing, false));
    when(members.findByIdConversationId(existing.getId())).thenReturn(java.util.List.of(
        new ConversationMember(existing.getId(), user), new ConversationMember(existing.getId(), recipient)));
    when(users.findAllById(any())).thenReturn(java.util.List.of());

    mvc.perform(post("/api/conversations").with(authentication(new UsernamePasswordAuthenticationToken(user, null, AuthorityUtils.NO_AUTHORITIES)))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"recipientId\":\"" + recipient + "\"}"))
      .andExpect(status().isOk());

    verify(conversationService).openOrCreate(user, recipient);
  }

  @Test void newlyCreatedConversationReturnsCreatedStatus() throws Exception {
    UUID recipient = UUID.randomUUID();
    Conversation created = Conversation.create(user, recipient);
    when(conversationService.openOrCreate(user, recipient)).thenReturn(new ConversationService.OpenResult(created, true));
    when(members.findByIdConversationId(created.getId())).thenReturn(java.util.List.of(
        new ConversationMember(created.getId(), user), new ConversationMember(created.getId(), recipient)));
    when(users.findAllById(any())).thenReturn(java.util.List.of());

    mvc.perform(post("/api/conversations").with(authentication(new UsernamePasswordAuthenticationToken(user, null, AuthorityUtils.NO_AUTHORITIES)))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"recipientId\":\"" + recipient + "\"}"))
      .andExpect(status().isCreated());
  }

  @Test void nonMemberCannotPostMessage() throws Exception {
    var request = new ChatDtos.SendMessageRequest("client-1", "hello recipient");
    when(chatMessages.send(conversation, user, request)).thenThrow(new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Not a conversation member"));
    mvc.perform(post("/api/conversations/{id}/messages", conversation)
        .with(authentication(new UsernamePasswordAuthenticationToken(user, null, AuthorityUtils.NO_AUTHORITIES)))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"clientMessageId\":\"client-1\",\"content\":\"hello recipient\"}"))
      .andExpect(status().isForbidden());
    verify(chatMessages).send(conversation, user, request);
  }

  @Test void missingOrBlankMessageContentIsRejectedBeforePersistence() throws Exception {
    when(members.existsByIdConversationIdAndIdUserId(conversation, user)).thenReturn(true);
    mvc.perform(post("/api/conversations/{id}/messages", conversation)
        .with(authentication(new UsernamePasswordAuthenticationToken(user, null, AuthorityUtils.NO_AUTHORITIES)))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"clientMessageId\":\"client-1\",\"content\":\"   \"}"))
      .andExpect(status().isBadRequest());
    verifyNoInteractions(messages);
  }

  @Test void oversizedMessageContentIsRejectedBeforePersistence() throws Exception {
    String oversized = "x".repeat(4001);
    String json = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(
        java.util.Map.of("clientMessageId", "client-1", "content", oversized));
    var result = mvc.perform(post("/api/conversations/{id}/messages", conversation)
        .with(authentication(new UsernamePasswordAuthenticationToken(user, null, AuthorityUtils.NO_AUTHORITIES)))
        .contentType(MediaType.APPLICATION_JSON).content(json))
      .andExpect(status().isBadRequest()).andReturn();
    org.junit.jupiter.api.Assertions.assertFalse(result.getResponse().getContentAsString().contains(oversized));
    verifyNoInteractions(messages);
  }

  @Test void legacyCiphertextEnvelopeCannotBeSubmittedAsANewMessage() throws Exception {
    mvc.perform(post("/api/conversations/{id}/messages", conversation)
        .with(authentication(new UsernamePasswordAuthenticationToken(user, null, AuthorityUtils.NO_AUTHORITIES)))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"clientMessageId\":\"old-client\",\"ciphertext\":\"00112233445566778899aabbccddeeff\",\"iv\":\"00112233445566778899aabb\",\"algorithm\":\"AES-GCM\"}"))
      .andExpect(status().isBadRequest());
    verifyNoInteractions(messages);
  }

  @Test void duplicateLookupIsScopedByConversationAndSender() throws Exception {
    var request = new ChatDtos.SendMessageRequest("client-1", "hello recipient");
    var saved = new ChatDtos.MessageResponse(UUID.randomUUID(), conversation, user, "client-1", ChatDtos.MessageFormat.TEXT, request.content(), java.time.Instant.now(), null, null);
    when(chatMessages.send(conversation, user, request)).thenReturn(new ChatMessageService.SendResult(saved, true));
    mvc.perform(post("/api/conversations/{id}/messages", conversation)
        .with(authentication(new UsernamePasswordAuthenticationToken(user, null, AuthorityUtils.NO_AUTHORITIES)))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"clientMessageId\":\"client-1\",\"content\":\"hello recipient\"}"))
      .andExpect(status().isCreated())
      .andExpect(jsonPath("$.content").value("hello recipient"))
      .andExpect(jsonPath("$.format").value("TEXT"));
    verify(chatMessages).send(conversation, user, request);
  }

  @Test void persistenceDoesNotCreateDeliveryReceipt() {
    var message = new ChatMessage(conversation, user, "client-1", "hello recipient");
    org.junit.jupiter.api.Assertions.assertNull(message.getDeliveredAt());
  }

  @Test void markingMessagesReadRequiresAuthenticationAndUsesTheAuthenticatedPrincipal() throws Exception {
    mvc.perform(post("/api/conversations/{id}/read", conversation).contentType(MediaType.APPLICATION_JSON).content("{\"messageIds\":[\"" + UUID.randomUUID() + "\"]}"))
        .andExpect(status().isUnauthorized());
    verifyNoInteractions(chatMessages);

    UUID messageId = UUID.randomUUID();
    when(chatMessages.markRead(conversation, user, List.of(messageId))).thenReturn(new ChatMessageService.ReadResult(1, java.time.Instant.now()));
    mvc.perform(post("/api/conversations/{id}/read", conversation)
        .with(authentication(new UsernamePasswordAuthenticationToken(user, null, AuthorityUtils.NO_AUTHORITIES)))
        .contentType(MediaType.APPLICATION_JSON).content("{\"messageIds\":[\"" + messageId + "\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.messagesMarkedRead").value(1));
    verify(chatMessages).markRead(conversation, user, List.of(messageId));
  }
}
