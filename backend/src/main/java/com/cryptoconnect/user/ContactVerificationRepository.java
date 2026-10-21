package com.cryptoconnect.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ContactVerificationRepository extends MongoRepository<ContactVerification, UUID> {
  Optional<ContactVerification> findByOwnerIdAndContactId(UUID ownerId, UUID contactId);
  void deleteByOwnerIdAndContactId(UUID ownerId, UUID contactId);
}
