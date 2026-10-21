package com.cryptoconnect.user;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("friend_requests")
public class FriendRequest {
  public enum Status { PENDING, ACCEPTED, REJECTED, CANCELLED }
  @Id private UUID id;
  private UUID participantLowId;
  private UUID participantHighId;
  private UUID requestedById;
  private Status status;
  private Instant createdAt;
  private Instant updatedAt;
  protected FriendRequest() {}
  public FriendRequest(UUID requester, UUID recipient) {
    id = UUID.randomUUID(); requestedById = requester; status = Status.PENDING; createdAt = Instant.now(); updatedAt = createdAt;
    if (requester.toString().compareTo(recipient.toString()) < 0) { participantLowId = requester; participantHighId = recipient; }
    else { participantLowId = recipient; participantHighId = requester; }
  }
  public UUID getId() { return id; } public UUID getParticipantLowId() { return participantLowId; } public UUID getParticipantHighId() { return participantHighId; }
  public UUID getRequestedById() { return requestedById; } public Status getStatus() { return status; } public Instant getCreatedAt() { return createdAt; } public Instant getUpdatedAt() { return updatedAt; }
  public boolean involves(UUID id) { return participantLowId.equals(id) || participantHighId.equals(id); }
  public UUID recipientId() { return requestedById.equals(participantLowId) ? participantHighId : participantLowId; }
  public void accept() { status = Status.ACCEPTED; updatedAt = Instant.now(); }
  public void reject() { status = Status.REJECTED; updatedAt = Instant.now(); }
  public void cancel() { status = Status.CANCELLED; updatedAt = Instant.now(); }
}
