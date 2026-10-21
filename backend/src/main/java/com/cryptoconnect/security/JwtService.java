package com.cryptoconnect.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {
  private final SecretKey key; private final long expirationMinutes;
  public JwtService(@Value("${app.jwt-secret}") String secret, @Value("${app.jwt-expiration-minutes}") long expirationMinutes) {
    String normalized = secret == null ? "" : secret.toLowerCase(java.util.Locale.ROOT);
    if(secret == null || secret.length() < 32 || normalized.contains("change-this") || normalized.contains("development") || normalized.contains("replace-with") || normalized.contains("placeholder") || normalized.contains("example") || normalized.matches("^(.)\\1+$") || expirationMinutes < 1) throw new IllegalStateException("JWT_SECRET must be explicitly configured with a strong non-placeholder value of at least 32 characters and JWT expiration must be positive");
    key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)); this.expirationMinutes=expirationMinutes;
  }
  public String create(UUID userId, String email) { Instant now=Instant.now(); return Jwts.builder().id(UUID.randomUUID().toString()).subject(userId.toString()).claim("email", email).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(expirationMinutes*60))).signWith(key).compact(); }
  public UUID userId(String token) { return UUID.fromString(Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload().getSubject()); }
  public Instant expiresAt(String token) { return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload().getExpiration().toInstant(); }
  public UUID tokenId(String token) { return UUID.fromString(Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload().getId()); }
}
