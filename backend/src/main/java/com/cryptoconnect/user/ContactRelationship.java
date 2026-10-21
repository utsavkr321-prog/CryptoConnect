package com.cryptoconnect.user;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.UUID;

@Document("contacts")
public class ContactRelationship {
  @Id
  private UUID id;

  private UUID ownerId;

  private UUID contactId;

  private Instant createdAt;

  protected ContactRelationship() {}

  public ContactRelationship(UUID ownerId, UUID contactId) {
    this.id = UUID.randomUUID();
    this.ownerId = ownerId;
    this.contactId = contactId;
    this.createdAt = Instant.now();
  }

  public UUID getOwnerId() { return ownerId; }
  public UUID getContactId() { return contactId; }
  public UUID getId() { return id; }
  public Instant getCreatedAt() { return createdAt; }
}
