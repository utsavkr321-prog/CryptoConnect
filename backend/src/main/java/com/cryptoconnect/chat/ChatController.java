package com.cryptoconnect.chat;

import com.cryptoconnect.user.User;
import com.cryptoconnect.user.UserRepository;
import com.cryptoconnect.user.ContactVerification;
import com.cryptoconnect.user.ContactVerificationRepository;
import com.cryptoconnect.user.ContactVerificationStatus;
import jakarta.validation.Valid;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/conversations")
public class ChatController {
  private final ConversationRepository conversations;
  private final MemberRepository members;
  private final MessageRepository messages;
  private final UserRepository users;
  private final ContactVerificationRepository verifications;
  private final ConversationService conversationService;
  private final ChatMessageService chatMessages;

  public ChatController(ConversationRepository conversations, MemberRepository members,
      MessageRepository messages, UserRepository users, ContactVerificationRepository verifications,
      ConversationService conversationService,
      ChatMessageService chatMessages) {
    this.conversations = conversations;
    this.members = members;
    this.messages = messages;
    this.users = users;
    this.verifications = verifications;
    this.conversationService = conversationService;
    this.chatMessages = chatMessages;
  }

  @PostMapping
  public ResponseEntity<ChatDtos.ConversationResponse> create(
      @Valid @RequestBody ChatDtos.CreateConversationRequest request, Authentication authentication) {
    UUID userId = (UUID) authentication.getPrincipal();
    ConversationService.OpenResult result = conversationService.openOrCreate(userId, request.recipientId());
    return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK)
        .body(response(result.conversation(), userId));
  }

  @GetMapping
  public List<ChatDtos.ConversationResponse> list(Authentication authentication) {
    UUID userId = (UUID) authentication.getPrincipal();
    List<Conversation> ownConversations = conversations.findByParticipantLowIdOrParticipantHighId(userId, userId).stream()
        .filter(Conversation::isOneToOne)
        .sorted(Comparator.comparing(Conversation::getUpdatedAt).reversed()).toList();
    if (ownConversations.isEmpty()) return List.of();

    List<UUID> ownIds = ownConversations.stream().map(Conversation::getId).toList();
    var usersById = users.findAllById(ownConversations.stream().flatMap(c -> c.getParticipantIds().stream()).distinct().toList())
        .stream().collect(java.util.stream.Collectors.toMap(User::getId, user -> user));
    var lastMessageAt = messages.findLatestMessageSummaries(ownIds).stream()
        .collect(java.util.stream.Collectors.toMap(LatestMessageSummaryProjection::getConversationId, LatestMessageSummaryProjection::getCreatedAt));
    return ownConversations.stream().map(conversation -> new ChatDtos.ConversationResponse(
        conversation.getId(), conversation.getUpdatedAt(),
        conversation.getParticipantIds().stream().map(usersById::get).filter(java.util.Objects::nonNull)
            .map(user -> participantResponse(user, userId)).toList(),
        messages.countUnreadByConversationAndUser(conversation.getId(), userId), lastMessageAt.get(conversation.getId()),
        lastMessageAt.containsKey(conversation.getId()))).toList();
  }

  @GetMapping("/{id}/messages")
  public List<ChatDtos.MessageResponse> history(@PathVariable UUID id, @RequestParam(required = false) java.time.Instant before, Authentication authentication) {
    chatMessages.assertOneToOneMember(id, (UUID) authentication.getPrincipal());
    List<ChatMessage> page = before == null ? messages.findTop50ByConversationIdOrderByCreatedAtDesc(id)
        : messages.findTop50ByConversationIdAndCreatedAtBeforeOrderByCreatedAtDesc(id, before);
    return page.stream().map(this::response).toList();
  }

  @PostMapping("/{id}/messages")
  public ResponseEntity<ChatDtos.MessageResponse> send(@PathVariable UUID id,
      @Valid @RequestBody ChatDtos.SendMessageRequest request, Authentication authentication) {
    ChatMessageService.SendResult result = chatMessages.send(id, (UUID) authentication.getPrincipal(), request);
    return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.message());
  }

  @PostMapping("/{id}/read")
  public ChatDtos.ReadResponse markRead(@PathVariable UUID id, @Valid @RequestBody ChatDtos.MarkReadRequest request, Authentication authentication) {
    ChatMessageService.ReadResult result = chatMessages.markRead(id, (UUID) authentication.getPrincipal(), request.messageIds());
    return new ChatDtos.ReadResponse(result.messagesMarkedRead(), result.readAt());
  }

  private ChatDtos.ConversationResponse response(Conversation conversation, UUID userId) {
    List<ChatDtos.ParticipantResponse> participants = conversation.getParticipantIds().stream()
        .map(users::findById).flatMap(java.util.Optional::stream)
        .map(user -> participantResponse(user, userId)).toList();
    long unreadCount = messages.countUnreadByConversationAndUser(conversation.getId(), userId);
    java.time.Instant lastMessageAt = messages.findLatestMessageSummaries(List.of(conversation.getId())).stream()
        .map(LatestMessageSummaryProjection::getCreatedAt).findFirst().orElse(null);
    return new ChatDtos.ConversationResponse(conversation.getId(), conversation.getUpdatedAt(), participants,
        unreadCount, lastMessageAt, lastMessageAt != null);
  }

  private ChatDtos.MessageResponse response(ChatMessage message) {
    return new ChatDtos.MessageResponse(message.getId(), message.getConversationId(), message.getSenderId(),
        message.getClientMessageId(), message.getFormat(), message.getContent(), message.getCreatedAt(),
        message.getDeliveredAt(), message.getReadAt());
  }

  private ChatDtos.ParticipantResponse participantResponse(User contact, UUID ownerId) {
    ContactVerification verification = contact.getId().equals(ownerId) ? null
        : verifications.findByOwnerIdAndContactId(ownerId, contact.getId()).orElse(null);
    ContactVerificationStatus.State status = ContactVerificationStatus.forContact(contact, verification);
    return new ChatDtos.ParticipantResponse(contact.getId(), contact.getDisplayName(),
        status.fingerprint(), status.verified(), status.keyChangedSinceVerification());
  }
}
