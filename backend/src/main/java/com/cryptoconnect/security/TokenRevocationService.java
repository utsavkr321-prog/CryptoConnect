package com.cryptoconnect.security;

import java.time.Instant;
import java.util.UUID;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class TokenRevocationService {
  private final RevokedTokenRepository tokens;

  public TokenRevocationService(RevokedTokenRepository tokens) {
    this.tokens = tokens;
  }

  public void revoke(UUID jti, Instant expiresAt) {
    if (jti == null || expiresAt == null || !expiresAt.isAfter(Instant.now())) return;
    tokens.deleteByExpiresAtBefore(Instant.now());
    if (!tokens.existsById(jti)) tokens.save(new RevokedToken(jti, expiresAt));
  }

  public boolean isRevoked(UUID jti) {
    return jti != null && tokens.existsById(jti);
  }

  @Scheduled(fixedDelayString = "${app.token-revocation-cleanup-ms:3600000}")
  public void purgeExpired() {
    tokens.deleteByExpiresAtBefore(Instant.now());
  }
}
