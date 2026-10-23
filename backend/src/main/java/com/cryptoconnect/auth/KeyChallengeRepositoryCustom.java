package com.cryptoconnect.auth;

import java.util.Optional;
import java.util.UUID;

public interface KeyChallengeRepositoryCustom {
  Optional<KeyChallenge> consumeByIdAndUserId(UUID id, UUID userId);
}
