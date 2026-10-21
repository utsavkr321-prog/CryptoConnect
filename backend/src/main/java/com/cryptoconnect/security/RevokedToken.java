package com.cryptoconnect.security;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.UUID;

@Document("revoked_tokens")
public class RevokedToken {
  @Id
  private UUID jti;

  @Indexed(expireAfter = "0s")
  private Instant expiresAt;

  protected RevokedToken() {}

  public RevokedToken(UUID jti, Instant expiresAt) {
    this.jti = jti;
    this.expiresAt = expiresAt;
  }
}
