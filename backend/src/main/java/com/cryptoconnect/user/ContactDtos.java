package com.cryptoconnect.user;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

public final class ContactDtos {
  private ContactDtos() {}

  public record AddContactRequest(@NotNull UUID userId) {}
  public record ContactResponse(UUID id, String name, String email, String keyFingerprint,
      boolean verified, Instant verifiedAt) {}
}
