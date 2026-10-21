package com.cryptoconnect.chat;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.UUID;

@Document("conversations")
public class Conversation {
  @Id private UUID id;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID participantLowId;
  private UUID participantHighId;

  protected Conversation() {}

  public static Conversation create(UUID firstParticipant, UUID secondParticipant) {
    var conversation = new Conversation();
    conversation.id = UUID.randomUUID();
    if (firstParticipant.toString().compareTo(secondParticipant.toString()) < 0) {
      conversation.participantLowId = firstParticipant;
      conversation.participantHighId = secondParticipant;
    } else {
      conversation.participantLowId = secondParticipant;
      conversation.participantHighId = firstParticipant;
    }
    conversation.createdAt = Instant.now();
    conversation.updatedAt = conversation.createdAt;
    return conversation;
  }

  public UUID getId() { return id; }
  public Instant getUpdatedAt() { return updatedAt; }
  public Instant getCreatedAt() { return createdAt; }
  public UUID getParticipantLowId() { return participantLowId; }
  public UUID getParticipantHighId() { return participantHighId; }
  public java.util.List<UUID> getParticipantIds() { return java.util.List.of(participantLowId, participantHighId); }
  public boolean isOneToOne() { return participantLowId != null && participantHighId != null; }
  public boolean includesParticipant(UUID userId) { return userId != null && (userId.equals(participantLowId) || userId.equals(participantHighId)); }
  public void touch() { updatedAt = Instant.now(); }
}
