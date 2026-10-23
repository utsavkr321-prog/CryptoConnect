package com.cryptoconnect.user;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/contacts")
public class ContactController {
  private final ContactRepository contacts;
  private final UserRepository users;
  private final ContactVerificationRepository verifications;

  public ContactController(ContactRepository contacts, UserRepository users, ContactVerificationRepository verifications) {
    this.contacts = contacts;
    this.users = users;
    this.verifications = verifications;
  }

  @GetMapping
  public List<ContactDtos.ContactResponse> list(Authentication authentication) {
    UUID ownerId = (UUID) authentication.getPrincipal();
    return contacts.findAllByOwnerIdOrderByCreatedAtDesc(ownerId).stream()
        .map(ContactRelationship::getContactId)
        .map(id -> users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact user not found")))
        .map(contact -> response(contact, verifications.findByOwnerIdAndContactId(ownerId, contact.getId()).orElse(null)))
        .toList();
  }

  @GetMapping("/{contactId}")
  public ContactDtos.ContactResponse get(@PathVariable UUID contactId, Authentication authentication) {
    UUID ownerId = (UUID) authentication.getPrincipal();
    if (!contacts.existsByOwnerIdAndContactId(ownerId, contactId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found");
    }
    User contact = users.findById(contactId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact user not found"));
    return response(contact, verifications.findByOwnerIdAndContactId(ownerId, contactId).orElse(null));
  }

  @PostMapping
  public ResponseEntity<ContactDtos.ContactResponse> add(@Valid @RequestBody ContactDtos.AddContactRequest request, Authentication authentication) {
    UUID ownerId = (UUID) authentication.getPrincipal();
    UUID contactId = request.userId();
    if (ownerId.equals(contactId)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot add yourself as a contact");
    User contact = users.findById(contactId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    if (contacts.existsByOwnerIdAndContactId(ownerId, contactId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "This user is already a contact");
    try { contacts.save(new ContactRelationship(ownerId, contactId)); }
    catch (org.springframework.dao.DuplicateKeyException duplicate) { throw new ResponseStatusException(HttpStatus.CONFLICT, "This user is already a contact"); }
    return ResponseEntity.status(HttpStatus.CREATED).body(response(contact, null));
  }

  @DeleteMapping("/{contactId}")
  @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.NO_CONTENT)
  public void remove(@PathVariable UUID contactId, Authentication authentication) {
    UUID ownerId = (UUID) authentication.getPrincipal();
    if (contacts.deleteByOwnerIdAndContactId(ownerId, contactId) == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found");
    }
    verifications.deleteByOwnerIdAndContactId(ownerId, contactId);
  }

  /**
   * Records an owner's out-of-band comparison of the contact's currently enrolled key fingerprint.
   * Enrollment itself proves the contact possesses its private key; this action records the owner's
   * separate identity check and validates the submitted comparison against the current public key.
   */
  @PostMapping("/{contactId}/verify")
  public ContactDtos.ContactResponse verify(
      @PathVariable UUID contactId,
      @Valid @RequestBody ContactDtos.VerifyContactRequest request,
      Authentication authentication) {
    UUID ownerId = (UUID) authentication.getPrincipal();
    if (ownerId.equals(contactId)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot verify your own identity key as a contact");
    }
    if (!contacts.existsByOwnerIdAndContactId(ownerId, contactId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found");
    }
    User contact = users.findById(contactId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact user not found"));
    String fingerprint = ContactVerificationStatus.forContact(contact, null).fingerprint();
    if (fingerprint == null) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "This contact has not enrolled a valid identity key");
    }
    String submittedFingerprint = normalizeFingerprint(request.fingerprint());
    if (!submittedFingerprint.equals(fingerprint)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "The compared fingerprint does not match the contact's current identity key");
    }
    ContactVerification verification = verifications.findByOwnerIdAndContactId(ownerId, contactId)
        .map(existing -> { existing.updateFingerprint(fingerprint); return existing; })
        .orElseGet(() -> new ContactVerification(ownerId, contactId, fingerprint));
    verifications.save(verification);
    User currentContact = users.findById(contactId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact user not found"));
    return response(currentContact, verification);
  }

  private static ContactDtos.ContactResponse response(User user, ContactVerification verification) {
    ContactVerificationStatus.State status = ContactVerificationStatus.forContact(user, verification);
    return new ContactDtos.ContactResponse(user.getId(), user.getDisplayName(), user.getEmail(), user.getPublicKey(),
        status.fingerprint(), status.verified(), status.keyChangedSinceVerification(),
        status.verified() ? verification.getVerifiedAt() : null);
  }

  private static String normalizeFingerprint(String value) {
    if (value == null || !value.matches("(?i)[0-9a-f: \\t\\r\\n-]+")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fingerprint must contain only hexadecimal digits and supported separators");
    }
    String normalized = value.replaceAll("[:\\s-]", "").toUpperCase(java.util.Locale.ROOT);
    if (!normalized.matches("[0-9A-F]{64}")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fingerprint must be a complete SHA-256 value");
    }
    return normalized;
  }
}
