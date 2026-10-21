package com.cryptoconnect.auth;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.UUID;

/** Short-lived, single-use challenge document for key-enrollment proof-of-possession. */
@Document("key_challenges")
public class KeyChallenge {
  @Id private UUID id;
  private UUID userId;
  private String challenge; // base64url random bytes
  private Instant createdAt;

  protected KeyChallenge() {}

  public KeyChallenge(UUID id, UUID userId, String challenge, Instant createdAt) {
    this.id = id;
    this.userId = userId;
    this.challenge = challenge;
    this.createdAt = createdAt;
  }

  public UUID getId() { return id; }
  public UUID getUserId() { return userId; }
  public String getChallenge() { return challenge; }
  public Instant getCreatedAt() { return createdAt; }
}
