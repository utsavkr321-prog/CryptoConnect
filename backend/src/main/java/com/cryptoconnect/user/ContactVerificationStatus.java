package com.cryptoconnect.user;

import com.cryptoconnect.auth.KeyEnrollmentService;
import java.util.Base64;

public final class ContactVerificationStatus {
  private ContactVerificationStatus() {}

  public static State forContact(User contact, ContactVerification verification) {
    String fingerprint = currentFingerprint(contact);
    boolean verified = fingerprint != null && verification != null
        && fingerprint.equals(verification.getContactKeyFingerprint());
    return new State(fingerprint, verified, verification != null && !verified);
  }

  private static String currentFingerprint(User user) {
    if (user.getPublicKey() == null || user.getPublicKey().isBlank()) return null;
    try {
      return KeyEnrollmentService.fingerprintForPublicKeyBytes(
          Base64.getDecoder().decode(user.getPublicKey()));
    } catch (IllegalArgumentException malformedKey) {
      return null;
    }
  }

  public record State(String fingerprint, boolean verified, boolean keyChangedSinceVerification) {}
}
