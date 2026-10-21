package com.cryptoconnect.chat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ChatReadReceiptSavedEvent(UUID conversationId, UUID readerId, List<UUID> messageIds, Instant readAt) {
  public ChatReadReceiptSavedEvent {
    messageIds = List.copyOf(messageIds);
  }
}
