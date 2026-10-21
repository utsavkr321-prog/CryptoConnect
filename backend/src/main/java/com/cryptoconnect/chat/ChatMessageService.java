package com.cryptoconnect.chat;

import com.cryptoconnect.events.SecurityEventService;
import com.cryptoconnect.user.FriendService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ChatMessageService {
  private final MemberRepository members;
  private final MessageRepository messages;
  private final ConversationRepository conversations;
  private final ApplicationEventPublisher events;
  private final SecurityEventService securityEvents;
  private final FriendService friends;

  public ChatMessageService(MemberRepository members, MessageRepository messages,
      ConversationRepository conversations, ApplicationEventPublisher events, SecurityEventService securityEvents,
      FriendService friends) {
    this.members = members;
    this.messages = messages;
    this.conversations = conversations;
    this.events = events;
    this.securityEvents = securityEvents;
    this.friends = friends;
  }

  public SendResult send(UUID conversationId, UUID senderId, ChatDtos.SendMessageRequest request) {
    Conversation conversation = conversations.findByIdForMessageSend(conversationId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
    assertOneToOneMember(conversationId, senderId);
    // Conversations created before friend requests existed remain readable and are never
    // migrated or deleted.  They cannot receive further messages until both users are friends.
    UUID recipientId = conversation.getParticipantLowId().equals(senderId)
        ? conversation.getParticipantHighId() : conversation.getParticipantLowId();
    if (!friends.areFriends(senderId, recipientId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN,
          "Accept a friend request before sending messages");
    }
    var existing = messages.findByConversationIdAndSenderIdAndClientMessageId(
        conversationId, senderId, request.clientMessageId());
    if (existing.isPresent()) {
      conversation.touch();
      conversations.save(conversation);
      return new SendResult(response(existing.get()), false);
    }

    ChatMessage saved;
    try {
      saved = messages.saveAndFlush(new ChatMessage(conversationId, senderId,
          request.clientMessageId(), request.content()));
    } catch (org.springframework.dao.DuplicateKeyException duplicateRequest) {
      return messages.findByConversationIdAndSenderIdAndClientMessageId(conversationId, senderId, request.clientMessageId())
          .map(existingMessage -> new SendResult(response(existingMessage), false))
          .orElseThrow(() -> duplicateRequest);
    }
    conversation.touch();
    conversations.save(conversation);
    ChatDtos.MessageResponse result = response(saved);
    securityEvents.record(senderId, "message_sent");
    events.publishEvent(new ChatMessageSavedEvent(result));
    return new SendResult(result, true);
  }

  public DeliveryResult acknowledgeDelivery(UUID messageId, UUID recipientId) {
    ChatMessage message = messages.findByIdForDeliveryAck(messageId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found"));
    assertOneToOneMember(message.getConversationId(), recipientId);
    if (!conversations.findById(message.getConversationId()).map(c -> c.includesParticipant(message.getSenderId())).orElse(false)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found");
    }
    if (message.getSenderId().equals(recipientId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only a recipient can acknowledge delivery");
    }
    boolean newlyDelivered = message.getDeliveredAt() == null;
    if (newlyDelivered) {
      message.markDeliveredAt(Instant.now());
      messages.save(message);
    }
    return new DeliveryResult(response(message), newlyDelivered);
  }

  public ReadResult markRead(UUID conversationId, UUID readerId, List<UUID> requestedMessageIds) {
    Conversation conversation = conversations.findByIdForMessageSend(conversationId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
    assertOneToOneMember(conversationId, readerId);
    List<UUID> messageIds = requestedMessageIds == null || requestedMessageIds.isEmpty()
        ? List.of() : messages.findUnreadMessageIds(conversationId, readerId, requestedMessageIds.stream().distinct().toList());
    Instant readAt = Instant.now();
    if (!messageIds.isEmpty()) messages.markMessagesRead(messageIds, readAt);
    if (!messageIds.isEmpty()) members.findById(new ConversationMember.Key(conversationId, readerId))
        .ifPresent(member -> { member.markReadAt(readAt); members.save(member); });
    if (!messageIds.isEmpty()) events.publishEvent(new ChatReadReceiptSavedEvent(conversationId, readerId, messageIds, readAt));
    return new ReadResult(messageIds.size(), readAt);
  }

  public void assertOneToOneMember(UUID conversationId, UUID userId) {
    Conversation conversation = conversations.findById(conversationId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
    if (!conversation.isOneToOne() || !conversation.includesParticipant(userId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found");
    }
  }

  private static ChatDtos.MessageResponse response(ChatMessage message) {
    return new ChatDtos.MessageResponse(message.getId(), message.getConversationId(),
        message.getSenderId(), message.getClientMessageId(), message.getFormat(), message.getContent(),
        message.getCreatedAt(), message.getDeliveredAt(), message.getReadAt());
  }

  public record SendResult(ChatDtos.MessageResponse message, boolean created) {}
  public record DeliveryResult(ChatDtos.MessageResponse message, boolean newlyDelivered) {}
  public record ReadResult(int messagesMarkedRead, Instant readAt) {}
}
