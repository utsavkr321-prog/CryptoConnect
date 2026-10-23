package com.cryptoconnect.auth;

import com.cryptoconnect.events.SecurityEventService;
import com.cryptoconnect.security.JwtService;
import com.cryptoconnect.user.*;
import jakarta.validation.Valid;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/auth")
public class AuthController {
  private static final Logger log = LoggerFactory.getLogger(AuthController.class);
  private final UserRepository users; private final PasswordEncoder encoder; private final JwtService jwt; private final SecurityEventService securityEvents; private final com.cryptoconnect.security.TokenRevocationService revocations;
  public AuthController(UserRepository users,PasswordEncoder encoder,JwtService jwt,SecurityEventService securityEvents,com.cryptoconnect.security.TokenRevocationService revocations){this.users=users;this.encoder=encoder;this.jwt=jwt;this.securityEvents=securityEvents;this.revocations=revocations;}
  @PostMapping("/register") public ResponseEntity<AuthDtos.AuthResponse> register(@Valid @RequestBody AuthDtos.RegisterRequest r){ String email=r.email().trim().toLowerCase(Locale.ROOT); if(users.existsByEmailIgnoreCase(email)) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.CONFLICT,"An account with this email already exists"); var u=new User(email,r.name().trim(),encoder.encode(r.password())); try { users.save(u); } catch (org.springframework.dao.DuplicateKeyException duplicate) { throw new org.springframework.web.server.ResponseStatusException(HttpStatus.CONFLICT,"An account with this email already exists"); } securityEvents.record(u.getId(),"account_created"); return ResponseEntity.status(HttpStatus.CREATED).body(new AuthDtos.AuthResponse(jwt.create(u.getId(),u.getEmail()),toResponse(u))); }
  @PostMapping("/login")
  public ResponseEntity<AuthDtos.AuthResponse> login(@Valid @RequestBody AuthDtos.LoginRequest request) {
    long requestStarted = System.nanoTime();
    long lookupNanos = 0;
    long passwordVerificationNanos = 0;
    long securityEventNanos = 0;
    long tokenCreationNanos = 0;
    try {
      long phaseStarted = System.nanoTime();
      var user = users.findByEmailIgnoreCase(request.email().trim()).orElse(null);
      lookupNanos = System.nanoTime() - phaseStarted;

      phaseStarted = System.nanoTime();
      boolean passwordMatches = user != null && encoder.matches(request.password(), user.getPasswordHash());
      passwordVerificationNanos = System.nanoTime() - phaseStarted;

      if (!passwordMatches) {
        if (user != null) {
          phaseStarted = System.nanoTime();
          securityEvents.record(user.getId(), "login_failure");
          securityEventNanos = System.nanoTime() - phaseStarted;
        }
        throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
      }

      phaseStarted = System.nanoTime();
      securityEvents.record(user.getId(), "login_success");
      securityEventNanos = System.nanoTime() - phaseStarted;

      phaseStarted = System.nanoTime();
      var response = new AuthDtos.AuthResponse(jwt.create(user.getId(), user.getEmail()), toResponse(user));
      tokenCreationNanos = System.nanoTime() - phaseStarted;
      return ResponseEntity.ok(response);
    } finally {
      log.debug(
          "Authentication timing in ms: userLookup={}, passwordVerification={}, securityEventWrite={}, tokenCreation={}, controllerTotal={}",
          TimeUnit.NANOSECONDS.toMillis(lookupNanos),
          TimeUnit.NANOSECONDS.toMillis(passwordVerificationNanos),
          TimeUnit.NANOSECONDS.toMillis(securityEventNanos),
          TimeUnit.NANOSECONDS.toMillis(tokenCreationNanos),
          TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - requestStarted));
    }
  }
  @GetMapping("/me") public AuthDtos.UserResponse me(org.springframework.security.core.Authentication authentication){ return users.findById((java.util.UUID) authentication.getPrincipal()).map(this::toResponse).orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid session")); }
  @PatchMapping("/me") public AuthDtos.UserResponse updateMe(@jakarta.validation.Valid @RequestBody AuthDtos.UpdateProfileRequest request, org.springframework.security.core.Authentication authentication){ String displayName=request.name().trim(); if(displayName.length()<2||displayName.length()>120) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST,"Display name must be between 2 and 120 characters"); var user=users.findById((java.util.UUID) authentication.getPrincipal()).orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid session")); user.updateDisplayName(displayName); return toResponse(users.save(user)); }
  @PostMapping("/logout") public ResponseEntity<Void> logout(@RequestHeader("Authorization") String authorization){ String token=authorization.substring(7); revocations.revoke(jwt.tokenId(token),jwt.expiresAt(token)); return ResponseEntity.noContent().build(); }
  private AuthDtos.UserResponse toResponse(User u){return new AuthDtos.UserResponse(u.getId(),u.getEmail(),u.getDisplayName(),u.getPublicKey(),u.getKeyFingerprint());}
}
