package com.cryptoconnect.auth;

import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Two-step key-enrollment endpoint:
 * <ol>
 *   <li>{@code POST /api/auth/me/key/challenge} — generate a random challenge</li>
 *   <li>{@code POST /api/auth/me/key} — submit signed challenge + public key</li>
 * </ol>
 * The private key is never transmitted; only the public key and an ECDSA P-256 signature over the
 * challenge bytes are sent. The backend verifies the signature before storing the public key.
 */
@RestController
@RequestMapping("/api/auth/me/key")
public class KeyEnrollmentController {

  private final KeyEnrollmentService enrollment;

  public KeyEnrollmentController(KeyEnrollmentService enrollment) {
    this.enrollment = enrollment;
  }

  /** Step 1 — obtain a fresh challenge to sign. */
  @PostMapping("/challenge")
  public ResponseEntity<KeyEnrollmentDtos.ChallengeResponse> challenge(Authentication authentication) {
    UUID userId = (UUID) authentication.getPrincipal();
    return ResponseEntity.status(HttpStatus.CREATED).body(enrollment.generateChallenge(userId));
  }

  /**
   * Step 2 — submit the ECDSA P-256 signature over the challenge bytes together with the raw
   * SubjectPublicKeyInfo (SPKI) public key. Proof of private-key possession is verified before the
   * key is stored.
   */
  @PostMapping
  public KeyEnrollmentDtos.KeyInfo enroll(
      @Valid @RequestBody KeyEnrollmentDtos.EnrollRequest request,
      Authentication authentication) {
    UUID userId = (UUID) authentication.getPrincipal();
    return enrollment.enrollKey(userId, request);
  }

  /** Remove the enrolled key. Existing contact verifications become stale automatically. */
  @DeleteMapping
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void remove(Authentication authentication) {
    enrollment.removeKey((UUID) authentication.getPrincipal());
  }
}
