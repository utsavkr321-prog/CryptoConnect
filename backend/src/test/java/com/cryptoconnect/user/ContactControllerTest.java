package com.cryptoconnect.user;

import com.cryptoconnect.auth.KeyEnrollmentService;
import com.cryptoconnect.security.JwtService;
import com.cryptoconnect.security.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;

@WebMvcTest(ContactController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "app.cors-origin=http://localhost:5173")
class ContactControllerTest {
  @MockitoBean com.cryptoconnect.security.TokenRevocationService revocations;
  @Autowired MockMvc mvc;
  @MockitoBean ContactRepository contacts;
  @MockitoBean UserRepository users;
  @MockitoBean ContactVerificationRepository verifications;
  @MockitoBean JwtService jwt;

  private final UUID owner = UUID.randomUUID();
  private final UUID other = UUID.randomUUID();
  private static final String PUBLIC_KEY = generatePublicKey();
  private static final String ROTATED_PUBLIC_KEY = generatePublicKey();
  private static final String FINGERPRINT = fingerprint(PUBLIC_KEY);

  private org.springframework.test.web.servlet.request.RequestPostProcessor ownerAuth() {
    return authentication(new UsernamePasswordAuthenticationToken(owner, null, AuthorityUtils.NO_AUTHORITIES));
  }

  @Test void contactsRequireAuthentication() throws Exception {
    mvc.perform(get("/api/contacts")).andExpect(status().isUnauthorized());
  }

  @Test void rejectsSelfContactBeforePersistence() throws Exception {
    mvc.perform(post("/api/contacts").with(ownerAuth()).contentType(MediaType.APPLICATION_JSON)
        .content("{\"userId\":\"" + owner + "\"}"))
      .andExpect(status().isBadRequest());
    verifyNoInteractions(contacts);
  }

  @Test void rejectsUnknownUser() throws Exception {
    when(users.findById(other)).thenReturn(Optional.empty());
    mvc.perform(post("/api/contacts").with(ownerAuth()).contentType(MediaType.APPLICATION_JSON)
        .content("{\"userId\":\"" + other + "\"}"))
      .andExpect(status().isNotFound());
    verify(contacts, never()).save(any());
  }

  @Test void duplicateContactReturnsConflict() throws Exception {
    when(users.findById(other)).thenReturn(Optional.of(new User("other@example.test", "Other", "hash")));
    when(contacts.existsByOwnerIdAndContactId(owner, other)).thenReturn(true);
    mvc.perform(post("/api/contacts").with(ownerAuth()).contentType(MediaType.APPLICATION_JSON)
        .content("{\"userId\":\"" + other + "\"}"))
      .andExpect(status().isConflict());
    verify(contacts, never()).save(any());
  }

  @Test void addingContactPersistsUnderPrincipalAndReturnsMinimalDetails() throws Exception {
    User target = new User("other@example.test", "Other User", "secret-hash");
    when(users.findById(target.getId())).thenReturn(Optional.of(target));
    when(contacts.existsByOwnerIdAndContactId(owner, target.getId())).thenReturn(false);
    mvc.perform(post("/api/contacts").with(ownerAuth()).contentType(MediaType.APPLICATION_JSON)
        .content("{\"userId\":\"" + target.getId() + "\"}"))
      .andExpect(status().isCreated())
      .andExpect(jsonPath("$.id").value(target.getId().toString()))
      .andExpect(jsonPath("$.name").value("Other User"))
      .andExpect(jsonPath("$.verified").value(false))
      .andExpect(jsonPath("$.passwordHash").doesNotExist());
    verify(contacts).save(argThat(relationship -> relationship.getOwnerId().equals(owner)
        && relationship.getContactId().equals(target.getId())));
  }

  @Test void listUsesAuthenticatedOwnerAndReturnsMinimalTargetDetails() throws Exception {
    User target = new User("target@example.test", "Target User", "secret-hash");
    target.setPublicKey(PUBLIC_KEY);
    target.setKeyFingerprint(FINGERPRINT);
    when(contacts.findAllByOwnerIdOrderByCreatedAtDesc(owner)).thenReturn(List.of(new ContactRelationship(owner, target.getId())));
    when(users.findById(target.getId())).thenReturn(Optional.of(target));
    mvc.perform(get("/api/contacts").with(ownerAuth()))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[0].id").value(target.getId().toString()))
      .andExpect(jsonPath("$[0].name").value("Target User"))
      .andExpect(jsonPath("$[0].email").value("target@example.test"))
      .andExpect(jsonPath("$[0].publicKey").value(PUBLIC_KEY))
      .andExpect(jsonPath("$[0].verified").value(false))
      .andExpect(jsonPath("$[0].passwordHash").doesNotExist());
    verify(contacts).findAllByOwnerIdOrderByCreatedAtDesc(owner);
    verify(contacts, never()).findAllByOwnerIdOrderByCreatedAtDesc(other);
  }

  @Test void verificationIsScopedToAnExistingContactAndUsesTheCurrentEnrolledFingerprint() throws Exception {
    User target = new User("target@example.test", "Target User", "secret-hash");
    String fingerprint = FINGERPRINT;
    target.setPublicKey(PUBLIC_KEY);
    target.setKeyFingerprint(fingerprint);
    when(contacts.existsByOwnerIdAndContactId(owner, target.getId())).thenReturn(true);
    when(users.findById(target.getId())).thenReturn(Optional.of(target));
    when(verifications.findByOwnerIdAndContactId(owner, target.getId())).thenReturn(Optional.empty());
    when(verifications.save(any(ContactVerification.class))).thenAnswer(invocation -> invocation.getArgument(0));

    mvc.perform(post("/api/contacts/{id}/verify", target.getId()).with(ownerAuth())
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"fingerprint\":\"" + fingerprint.toLowerCase() + "\",\"confirmed\":true}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.keyFingerprint").value(fingerprint))
      .andExpect(jsonPath("$.verified").value(true));
    verify(verifications).save(argThat(record -> record.getOwnerId().equals(owner)
        && record.getContactId().equals(target.getId()) && record.getContactKeyFingerprint().equals(fingerprint)));
  }

  @Test void verificationRejectsMismatchedFingerprintWithoutSaving() throws Exception {
    User target = new User("target@example.test", "Target User", "secret-hash");
    target.setPublicKey(PUBLIC_KEY);
    target.setKeyFingerprint(FINGERPRINT);
    when(contacts.existsByOwnerIdAndContactId(owner, target.getId())).thenReturn(true);
    when(users.findById(target.getId())).thenReturn(Optional.of(target));

    mvc.perform(post("/api/contacts/{id}/verify", target.getId()).with(ownerAuth())
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"fingerprint\":\"12345678:12345678:12345678:12345678:12345678:12345678:12345678:12345678\",\"confirmed\":true}"))
      .andExpect(status().isConflict());
    verify(verifications, never()).save(any());
  }

  @Test void keyRotationMakesPreviouslyRecordedVerificationStale() throws Exception {
    User target = new User("target@example.test", "Target User", "secret-hash");
    target.setPublicKey(ROTATED_PUBLIC_KEY);
    ContactVerification oldVerification = new ContactVerification(owner, target.getId(), FINGERPRINT);
    when(contacts.existsByOwnerIdAndContactId(owner, target.getId())).thenReturn(true);
    when(users.findById(target.getId())).thenReturn(Optional.of(target));
    when(verifications.findByOwnerIdAndContactId(owner, target.getId())).thenReturn(Optional.of(oldVerification));

    mvc.perform(get("/api/contacts/{id}", target.getId()).with(ownerAuth()))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.verified").value(false))
      .andExpect(jsonPath("$.keyChangedSinceVerification").value(true))
      .andExpect(jsonPath("$.keyFingerprint").value(fingerprint(ROTATED_PUBLIC_KEY)));
  }

  @Test void malformedOrUnconfirmedFingerprintIsRejected() throws Exception {
    User target = new User("target@example.test", "Target User", "secret-hash");
    mvc.perform(post("/api/contacts/{id}/verify", target.getId()).with(ownerAuth())
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"fingerprint\":\"not-a-fingerprint\",\"confirmed\":true}"))
      .andExpect(status().isBadRequest());
    mvc.perform(post("/api/contacts/{id}/verify", target.getId()).with(ownerAuth())
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"fingerprint\":\"ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234\",\"confirmed\":false}"))
      .andExpect(status().isBadRequest());
    verifyNoInteractions(contacts, users, verifications);
  }

  @Test void verificationRequiresAuthentication() throws Exception {
    mvc.perform(post("/api/contacts/{id}/verify", other)
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"fingerprint\":\"ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234\",\"confirmed\":true}"))
      .andExpect(status().isUnauthorized());
    verifyNoInteractions(contacts, users, verifications);
  }

  @Test void cannotVerifyAnotherUsersContactOrSelf() throws Exception {
    mvc.perform(post("/api/contacts/{id}/verify", other).with(ownerAuth())
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"fingerprint\":\"ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234\",\"confirmed\":true}"))
      .andExpect(status().isNotFound());
    mvc.perform(post("/api/contacts/{id}/verify", owner).with(ownerAuth())
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"fingerprint\":\"ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234:ABCD1234\",\"confirmed\":true}"))
      .andExpect(status().isBadRequest());
    verify(verifications, never()).save(any());
  }

  @Test void verificationRejectsContactsWithoutAnEnrolledKey() throws Exception {
    when(contacts.existsByOwnerIdAndContactId(owner, other)).thenReturn(true);
    when(users.findById(other)).thenReturn(Optional.of(new User("other@example.test", "Other", "hash")));
    mvc.perform(post("/api/contacts/{id}/verify", other).with(ownerAuth())
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"fingerprint\":\"" + FINGERPRINT + "\",\"confirmed\":true}"))
      .andExpect(status().isConflict());
    verify(verifications, never()).save(any());
  }

  @Test void removalIsScopedToAuthenticatedOwner() throws Exception {
    when(contacts.deleteByOwnerIdAndContactId(owner, other)).thenReturn(0L);
    mvc.perform(delete("/api/contacts/{id}", other).with(ownerAuth())).andExpect(status().isNotFound());
    verify(contacts).deleteByOwnerIdAndContactId(owner, other);
    verify(contacts, never()).deleteByOwnerIdAndContactId(other, owner);
  }

  private static String generatePublicKey() {
    try {
      java.security.KeyPairGenerator generator = java.security.KeyPairGenerator.getInstance("EC");
      generator.initialize(new java.security.spec.ECGenParameterSpec("secp256r1"));
      return java.util.Base64.getEncoder().encodeToString(generator.generateKeyPair().getPublic().getEncoded());
    } catch (java.security.GeneralSecurityException error) {
      throw new ExceptionInInitializerError(error);
    }
  }

  private static String fingerprint(String publicKey) {
    return KeyEnrollmentService.fingerprintForPublicKeyBytes(java.util.Base64.getDecoder().decode(publicKey));
  }
}
