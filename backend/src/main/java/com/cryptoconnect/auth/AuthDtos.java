package com.cryptoconnect.auth;
import jakarta.validation.constraints.*; import java.util.UUID;
public final class AuthDtos {
  public record RegisterRequest(@Email @NotBlank String email,@NotBlank @Size(min=2,max=120) String name,@NotBlank @Size(min=12,max=200) String password) {}
  public record UpdateProfileRequest(@NotBlank @Size(min=2,max=120) String name) {}
  public record LoginRequest(@Email @NotBlank String email,@NotBlank String password) {}
  public record UserResponse(UUID id,String email,String name,String publicKey,String keyFingerprint) {}
  public record AuthResponse(String token, UserResponse user) {}
}
