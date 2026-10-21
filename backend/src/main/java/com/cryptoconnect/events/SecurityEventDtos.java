package com.cryptoconnect.events;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class SecurityEventDtos {
  private SecurityEventDtos() {}

  public record CreateRequest(@NotBlank @Size(max = 80) String type) {}

  public record EventResponse(
      UUID id,
      String type,
      String severity,
      String title,
      String description,
      Instant timestamp,
      boolean isSimulated) {}
}
