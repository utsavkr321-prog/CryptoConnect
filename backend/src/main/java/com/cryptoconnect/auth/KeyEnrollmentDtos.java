package com.cryptoconnect.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public final class KeyEnrollmentDtos {
  private KeyEnrollmentDtos() {}

  /** Returned by the challenge endpoint: the client must sign {@code challenge} with its private key. */
  public record ChallengeResponse(UUID challengeId, String challenge) {}

  /** Submitted by the client to complete key enrollment. */
  public record EnrollRequest(
      @NotBlank UUID challengeId,
      /** Must be exactly {@code "EC/P-256"}. */
      @NotBlank @Size(max = 20) String algorithm,
      /** SubjectPublicKeyInfo bytes (SPKI), base64-standard-encoded. */
      @NotBlank @Size(max = 4096) String publicKey,
      /** Raw P1363 ECDSA signature over the challenge bytes produced by Web Crypto {@code sign()}. */
      @NotBlank @Size(max = 256) String signature) {}

  /** Returned after successful enrollment. */
  public record KeyInfo(String keyFingerprint) {}
}
