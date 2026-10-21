package com.cryptoconnect.user;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.UUID;

/**
 * Records that {@code ownerId} has confirmed, via out-of-band fingerprint comparison, that
 * {@code contactId}'s enrolled public key (identified by {@code contactKeyFingerprint}) belongs to
 * that contact. If the contact later re-enrolls a different key the fingerprint changes, and the
 * verification record is treated as stale by the contact-list endpoint.
 */
@Document("contact_verifications")
public class ContactVerification {
  @Id private UUID id;
  private UUID ownerId;
  private UUID contactId;
  /** Fingerprint of the contact's public key at the time verification was recorded. */
  private String contactKeyFingerprint;
  private Instant verifiedAt;

  protected ContactVerification() {}

  public ContactVerification(UUID ownerId, UUID contactId, String contactKeyFingerprint) {
    this.id = UUID.randomUUID();
    this.ownerId = ownerId;
    this.contactId = contactId;
    this.contactKeyFingerprint = contactKeyFingerprint;
    this.verifiedAt = Instant.now();
  }

  public UUID getId() { return id; }
  public UUID getOwnerId() { return ownerId; }
  public UUID getContactId() { return contactId; }
  public String getContactKeyFingerprint() { return contactKeyFingerprint; }
  public Instant getVerifiedAt() { return verifiedAt; }

  public void updateFingerprint(String fingerprint) {
    this.contactKeyFingerprint = fingerprint;
    this.verifiedAt = Instant.now();
  }
}
