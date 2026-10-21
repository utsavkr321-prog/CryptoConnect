package com.cryptoconnect.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ChatDtos {
  private ChatDtos() {}

  public record CreateConversationRequest(@NotNull UUID recipientId) {}

  public record SendMessageRequest(
      @NotBlank @Size(max = 100) String clientMessageId,
      @NotBlank @Size(max = 4000) String content) {}

  public record MarkReadRequest(@NotEmpty @Size(max = 50) List<@NotNull UUID> messageIds) {}

  public record MessageResponse(UUID id, UUID conversationId, UUID senderId, String clientMessageId,
      MessageFormat format, String content, Instant createdAt, Instant deliveredAt, Instant readAt) {}

  public enum MessageFormat { TEXT, LEGACY_ENCRYPTED }

  public record ParticipantResponse(UUID id, String name, String keyFingerprint) {}

  public record ConversationResponse(UUID id, Instant updatedAt, List<ParticipantResponse> participants,
      long unreadCount, Instant lastMessageAt, boolean hasMessages) {}

  public record ReadResponse(int messagesMarkedRead, Instant readAt) {}
}
