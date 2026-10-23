package com.cryptoconnect.auth;

import com.cryptoconnect.user.User;
import com.cryptoconnect.user.UserRepository;
import java.security.KeyFactory;
import java.security.AlgorithmParameters;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.interfaces.ECPublicKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class KeyEnrollmentService {

  /** Challenges expire after this duration; the TTL MongoDB index uses the same value. */
  static final Duration CHALLENGE_TTL = Duration.ofMinutes(10);

  private static final String SUPPORTED_ALGORITHM = "EC/P-256";

  private final KeyChallengeRepository challengeRepo;
  private final UserRepository users;

  public KeyEnrollmentService(KeyChallengeRepository challengeRepo, UserRepository users) {
    this.challengeRepo = challengeRepo;
    this.users = users;
  }

  /** Generate a fresh 32-byte random challenge and persist it for later verification. */
  public KeyEnrollmentDtos.ChallengeResponse generateChallenge(UUID userId) {
    byte[] bytes = new byte[32];
    new SecureRandom().nextBytes(bytes);
    String value = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    UUID id = UUID.randomUUID();
    challengeRepo.save(new KeyChallenge(id, userId, value, Instant.now()));
    return new KeyEnrollmentDtos.ChallengeResponse(id, value);
  }

  /**
   * Verify the ECDSA signature over the challenge bytes and, if valid, persist the public key and
   * its SHA-256 fingerprint on the user's account. The challenge document is deleted on first use
   * regardless of verification outcome to prevent replay attacks.
   */
  public KeyEnrollmentDtos.KeyInfo enrollKey(UUID userId, KeyEnrollmentDtos.EnrollRequest req) {
    // Load and immediately delete the single-use challenge
    KeyChallenge challenge =
        challengeRepo
            .consumeByIdAndUserId(req.challengeId(), userId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Challenge not found or already used"));

    // Reject expired challenges
    if (Instant.now().isAfter(challenge.getCreatedAt().plus(CHALLENGE_TTL))) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Challenge has expired; request a new one");
    }

    // Only P-256 is accepted
    if (!SUPPORTED_ALGORITHM.equals(req.algorithm())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Unsupported algorithm; only EC/P-256 is accepted");
    }

    // Decode inputs
    byte[] spkiBytes;
    byte[] signatureBytes;
    byte[] challengeBytes;
    try {
      spkiBytes = Base64.getDecoder().decode(req.publicKey());
      signatureBytes = Base64.getDecoder().decode(req.signature());
      challengeBytes = Base64.getUrlDecoder().decode(challenge.getChallenge());
    } catch (IllegalArgumentException e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid base64 in request body");
    }

    // Parse the EC public key from SPKI DER bytes
    PublicKey publicKey;
    try {
      KeyFactory kf = KeyFactory.getInstance("EC");
      publicKey = kf.generatePublic(new X509EncodedKeySpec(spkiBytes));
    } catch (Exception e) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Invalid EC public key: " + e.getMessage());
    }
    if (!(publicKey instanceof ECPublicKey ecPublicKey) || !isP256(ecPublicKey.getParams())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Public key must use the P-256 curve");
    }

    // Verify the P1363-formatted ECDSA signature (Web Crypto API output format)
    try {
      Signature sig = Signature.getInstance("SHA256withECDSAinP1363Format");
      sig.initVerify(publicKey);
      sig.update(challengeBytes);
      if (!sig.verify(signatureBytes)) {
        throw new ResponseStatusException(
            HttpStatus.UNAUTHORIZED, "Signature verification failed; private-key possession not proven");
      }
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Signature processing error: " + e.getMessage());
    }

    // Derive fingerprint: SHA-256 of SPKI bytes, colon-separated hex groups of 4 bytes
    String fingerprint = computeFingerprint(spkiBytes);

    // Persist key and fingerprint on the user document
    User user =
        users
            .findById(userId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    if (!users.enrollIdentityKeyIfAbsent(userId, req.publicKey(), fingerprint)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "An identity key is already enrolled; remove it before enrolling a replacement");
    }

    return new KeyEnrollmentDtos.KeyInfo(fingerprint);
  }

  /** Remove the enrolled key from the user account. Resets any contact verifications via fingerprint mismatch. */
  public void removeKey(UUID userId) {
    User user =
        users
            .findById(userId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    user.setPublicKey(null);
    user.setKeyFingerprint(null);
    users.save(user);
  }

  /**
   * Compute a human-readable SHA-256 fingerprint of the SPKI bytes.
   * Format: uppercase hex bytes grouped in fours, colon-separated (e.g. "AABBCCDD:EEFF0011:...").
   */
  public static String computeFingerprint(byte[] spkiBytes) {
    try {
      byte[] hash = MessageDigest.getInstance("SHA-256").digest(spkiBytes);
      StringBuilder sb = new StringBuilder(hash.length * 2 + hash.length / 4);
      for (int i = 0; i < hash.length; i++) {
        if (i > 0 && i % 4 == 0) sb.append(':');
        sb.append(String.format("%02X", hash[i]));
      }
      return sb.toString();
    } catch (NoSuchAlgorithmException e) {
      throw new RuntimeException("SHA-256 unavailable", e);
    }
  }

  public static String fingerprintForPublicKeyBytes(byte[] spkiBytes) {
    try {
      PublicKey key = KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(spkiBytes));
      if (!(key instanceof ECPublicKey ecPublicKey) || !isP256(ecPublicKey.getParams())) {
        throw new IllegalArgumentException("Identity key must be a valid EC/P-256 SPKI public key");
      }
      return computeFingerprint(spkiBytes);
    } catch (IllegalArgumentException invalidKey) {
      throw invalidKey;
    } catch (Exception invalidKey) {
      throw new IllegalArgumentException("Identity key is not valid SPKI public-key data", invalidKey);
    }
  }

  private static boolean isP256(ECParameterSpec candidate) {
    try {
      AlgorithmParameters parameters = AlgorithmParameters.getInstance("EC");
      parameters.init(new ECGenParameterSpec("secp256r1"));
      ECParameterSpec p256 = parameters.getParameterSpec(ECParameterSpec.class);
      return candidate.getCurve().equals(p256.getCurve())
          && candidate.getGenerator().equals(p256.getGenerator())
          && candidate.getOrder().equals(p256.getOrder())
          && candidate.getCofactor() == p256.getCofactor();
    } catch (Exception unavailable) {
      throw new IllegalStateException("P-256 support is unavailable", unavailable);
    }
  }
}
