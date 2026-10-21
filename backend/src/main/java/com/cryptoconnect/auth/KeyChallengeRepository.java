package com.cryptoconnect.auth;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface KeyChallengeRepository extends MongoRepository<KeyChallenge, UUID> {
  Optional<KeyChallenge> findByIdAndUserId(UUID id, UUID userId);
}
