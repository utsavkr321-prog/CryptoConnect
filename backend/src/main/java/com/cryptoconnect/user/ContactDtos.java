package com.cryptoconnect.user;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.AssertTrue;
import java.time.Instant;
import java.util.UUID;

public final class ContactDtos {
  private ContactDtos() {}

  public record AddContactRequest(@NotNull UUID userId) {}
  public record VerifyContactRequest(@NotBlank String fingerprint, @AssertTrue boolean confirmed) {}
  public record ContactResponse(UUID id, String name, String email, String publicKey, String keyFingerprint,
      boolean verified, boolean keyChangedSinceVerification, Instant verifiedAt) {}
}
