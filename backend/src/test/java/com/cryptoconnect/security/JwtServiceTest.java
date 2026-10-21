package com.cryptoconnect.security;

import java.util.UUID;
import java.time.Instant;
import java.util.Date;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {
  @Test void rejectsMissingWeakAndExampleSecrets() {
    assertThrows(IllegalStateException.class, () -> new JwtService(null, 60));
    assertThrows(IllegalStateException.class, () -> new JwtService("too-short", 60));
    assertThrows(IllegalStateException.class, () -> new JwtService(
        "replace-with-a-random-secret-at-least-32-bytes-long", 60));
  }

  @Test void createdTokenCarriesAuthenticatedUserAndExpires() {
    JwtService service = new JwtService("zK8mpR3vW2sQ9nJ5bL7xC4dF6hT1yA0u", 60);
    UUID userId = UUID.randomUUID();
    String token = service.create(userId, "user@example.test");
    assertEquals(userId, service.userId(token));
    assertNotNull(service.tokenId(token));
    assertTrue(service.expiresAt(token).isAfter(java.time.Instant.now()));
  }

  @Test void rejectsNonPositiveExpiration() {
    assertThrows(IllegalStateException.class, () -> new JwtService(
        "zK8mpR3vW2sQ9nJ5bL7xC4dF6hT1yA0u", 0));
  }

  @Test void rejectsExpiredToken() {
    String secret = "zK8mpR3vW2sQ9nJ5bL7xC4dF6hT1yA0u";
    JwtService service = new JwtService(secret, 60);
    Instant now = Instant.now();
    String expired = Jwts.builder().subject(UUID.randomUUID().toString())
        .issuedAt(Date.from(now.minusSeconds(120))).expiration(Date.from(now.minusSeconds(60)))
        .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();
    assertThrows(io.jsonwebtoken.ExpiredJwtException.class, () -> service.userId(expired));
  }
}
