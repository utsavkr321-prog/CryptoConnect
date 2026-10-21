package com.cryptoconnect.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cryptoconnect.user.User;
import com.cryptoconnect.user.UserRepository;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import java.security.spec.ECGenParameterSpec;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class KeyEnrollmentServiceTest {
  private final KeyChallengeRepository challenges = org.mockito.Mockito.mock(KeyChallengeRepository.class);
  private final UserRepository users = org.mockito.Mockito.mock(UserRepository.class);
  private final KeyEnrollmentService service = new KeyEnrollmentService(challenges, users);

  @Test void acceptsAValidP256ProofAndStoresItsFingerprint() throws Exception {
    UUID userId = UUID.randomUUID();
    UUID challengeId = UUID.randomUUID();
    byte[] challengeBytes = "proof-bound-to-this-account".getBytes(java.nio.charset.StandardCharsets.UTF_8);
    KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
    generator.initialize(new ECGenParameterSpec("secp256r1"));
    KeyPair keyPair = generator.generateKeyPair();
    Signature signer = Signature.getInstance("SHA256withECDSAinP1363Format");
    signer.initSign(keyPair.getPrivate());
    signer.update(challengeBytes);
    String publicKey = Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
    String signature = Base64.getEncoder().encodeToString(signer.sign());
    when(challenges.findByIdAndUserId(challengeId, userId)).thenReturn(Optional.of(new KeyChallenge(
        challengeId, userId, Base64.getUrlEncoder().withoutPadding().encodeToString(challengeBytes), Instant.now())));
    User user = new User("user@example.test", "User", "hash");
    when(users.findById(userId)).thenReturn(Optional.of(user));

    KeyEnrollmentDtos.KeyInfo result = service.enrollKey(userId,
        new KeyEnrollmentDtos.EnrollRequest(challengeId, "EC/P-256", publicKey, signature));

    assertEquals(KeyEnrollmentService.computeFingerprint(keyPair.getPublic().getEncoded()), result.keyFingerprint());
    assertEquals(result.keyFingerprint(), user.getKeyFingerprint());
    verify(challenges).delete(org.mockito.ArgumentMatchers.any(KeyChallenge.class));
    verify(users).save(user);
  }

  @Test void consumesExpiredChallengesWithoutAttemptingEnrollment() {
    UUID userId = UUID.randomUUID();
    UUID challengeId = UUID.randomUUID();
    when(challenges.findByIdAndUserId(challengeId, userId)).thenReturn(Optional.of(new KeyChallenge(
        challengeId, userId, "AQ", Instant.now().minus(KeyEnrollmentService.CHALLENGE_TTL).minusSeconds(1))));

    assertThrows(ResponseStatusException.class, () -> service.enrollKey(userId,
        new KeyEnrollmentDtos.EnrollRequest(challengeId, "EC/P-256", "AQ", "AQ")));
    verify(challenges).delete(org.mockito.ArgumentMatchers.any(KeyChallenge.class));
  }

  @Test void rejectsReplayAndChallengesOwnedByAnotherUser() {
    UUID owner = UUID.randomUUID();
    UUID attacker = UUID.randomUUID();
    UUID challengeId = UUID.randomUUID();
    when(challenges.findByIdAndUserId(challengeId, owner)).thenReturn(Optional.empty());
    when(challenges.findByIdAndUserId(challengeId, attacker)).thenReturn(Optional.empty());
    KeyEnrollmentDtos.EnrollRequest request = new KeyEnrollmentDtos.EnrollRequest(challengeId, "EC/P-256", "AQ", "AQ");

    assertThrows(ResponseStatusException.class, () -> service.enrollKey(owner, request));
    assertThrows(ResponseStatusException.class, () -> service.enrollKey(attacker, request));
  }

  @Test void rejectsAnEcKeyFromAnotherCurveEvenWhenTheRequestClaimsP256() throws Exception {
    UUID userId = UUID.randomUUID();
    UUID challengeId = UUID.randomUUID();
    byte[] challengeBytes = "different-curve".getBytes(java.nio.charset.StandardCharsets.UTF_8);
    KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
    generator.initialize(new ECGenParameterSpec("secp384r1"));
    KeyPair keyPair = generator.generateKeyPair();
    Signature signer = Signature.getInstance("SHA256withECDSAinP1363Format");
    signer.initSign(keyPair.getPrivate());
    signer.update(challengeBytes);
    when(challenges.findByIdAndUserId(challengeId, userId)).thenReturn(Optional.of(new KeyChallenge(
        challengeId, userId, Base64.getUrlEncoder().withoutPadding().encodeToString(challengeBytes), Instant.now())));

    assertThrows(ResponseStatusException.class, () -> service.enrollKey(userId,
        new KeyEnrollmentDtos.EnrollRequest(challengeId, "EC/P-256",
            Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded()),
            Base64.getEncoder().encodeToString(signer.sign()))));
  }
}
