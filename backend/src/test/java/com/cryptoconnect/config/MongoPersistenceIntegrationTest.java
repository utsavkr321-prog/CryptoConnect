package com.cryptoconnect.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.cryptoconnect.auth.KeyChallenge;
import com.cryptoconnect.auth.KeyChallengeRepository;
import com.cryptoconnect.auth.KeyEnrollmentService;
import com.cryptoconnect.user.User;
import com.cryptoconnect.user.UserRepository;
import com.cryptoconnect.user.ContactRepository;
import com.cryptoconnect.user.ContactRelationship;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class MongoPersistenceIntegrationTest {
  @Container
  private static final MongoDBContainer MONGO =
      new MongoDBContainer(DockerImageName.parse("mongo:7.0"));

  @Autowired private MongoTemplate mongo;
  @Autowired private UserRepository users;
  @Autowired private ContactRepository contacts;
  @Autowired private KeyChallengeRepository challenges;
  @Autowired private TestRestTemplate http;

  @DynamicPropertySource
  static void configureMongo(DynamicPropertyRegistry registry) {
    registry.add("MONGODB_URI", MONGO::getReplicaSetUrl);
    registry.add("MONGODB_DATABASE", () -> "cryptoconnect_integration_test");
    registry.add("app.jwt-secret", () -> "ci-only-jwt-secret-not-for-any-deployment-123");
  }

  @Test
  void persistsAndFindsUsersUsingTheConfiguredMongoDatabase() {
    String email = "mongo-" + UUID.randomUUID() + "@example.test";
    User saved = users.save(new User(email, "Mongo Integration", "encoded-password"));

    User found = users.findByEmailIgnoreCase(email.toUpperCase()).orElseThrow();
    assertEquals(saved.getId(), found.getId());
    assertEquals("Mongo Integration", found.getDisplayName());
    assertNotNull(found.getCreatedAt());
    assertEquals("cryptoconnect_integration_test", mongo.getDb().getName());
  }

  @Test
  void findsLegacyMixedCaseEmailsWhenCanonicalLookupMisses() {
    String email = "legacy-" + UUID.randomUUID() + "@example.test";
    User saved = users.save(new User(email.toUpperCase(Locale.ROOT), "Legacy Account", "encoded-password"));

    User found = users.findByEmailIgnoreCase(email).orElseThrow();

    assertEquals(saved.getId(), found.getId());
  }

  @Test
  void enforcesTheApplicationEmailUniquenessIndex() {
    String email = "unique-" + UUID.randomUUID() + "@example.test";
    users.save(new User(email, "First", "encoded-password"));

    assertThrows(DuplicateKeyException.class,
        () -> users.save(new User(email, "Duplicate", "encoded-password")));
    assertTrue(mongo.indexOps("users").getIndexInfo().stream()
        .anyMatch(index -> "uk_users_email".equals(index.getName())));
  }

  @Test
  void separatelyRegisteredUsersCanFindEachOtherByDisplayName() {
    String suffix = UUID.randomUUID().toString();
    String alphaName = "Directory Alpha " + suffix;
    String betaName = "Directory Beta " + suffix;
    String password = "valid-test-password-123";
    JsonNode alpha = registerAndLogin(alphaName, "alpha-" + suffix + "@example.test", password);
    JsonNode beta = registerAndLogin(betaName, "beta-" + suffix + "@example.test", password);

    ResponseEntity<JsonNode> alphaFindsBeta = search(alpha.path("token").asText(), "DIRECTORY BETA");
    ResponseEntity<JsonNode> betaFindsAlpha = search(beta.path("token").asText(), "DIRECTORY AL");

    assertEquals(HttpStatus.OK, alphaFindsBeta.getStatusCode());
    assertEquals(beta.path("user").path("id").asText(),
        alphaFindsBeta.getBody().path("users").get(0).path("id").asText());
    assertEquals(HttpStatus.OK, betaFindsAlpha.getStatusCode());
    assertEquals(alpha.path("user").path("id").asText(),
        betaFindsAlpha.getBody().path("users").get(0).path("id").asText());
    assertEquals(1, alphaFindsBeta.getBody().path("users").size());
    assertEquals(1, betaFindsAlpha.getBody().path("users").size());
    assertFalse(alphaFindsBeta.getBody().path("users").get(0).has("email"));
    assertFalse(alphaFindsBeta.getBody().path("users").get(0).has("passwordHash"));
    assertFalse(alphaFindsBeta.getBody().path("users").get(0).has("publicKey"));
  }

  @Test
  void safelySearchesDisplayNamesContainingRegexCharacters() {
    String suffix = UUID.randomUUID().toString();
    String name = "Target [+] User " + suffix;
    JsonNode owner = registerAndLogin("Regex Search Owner " + suffix, "regex-owner-" + suffix + "@example.test", "valid-test-password-123");
    JsonNode target = registerAndLogin(name, "regex-target-" + suffix + "@example.test", "valid-test-password-123");

    ResponseEntity<JsonNode> result = search(owner.path("token").asText(), "[+]");

    assertEquals(HttpStatus.OK, result.getStatusCode());
    assertEquals(1, result.getBody().path("users").size());
    assertEquals(target.path("user").path("id").asText(), result.getBody().path("users").get(0).path("id").asText());
  }

  @Test
  void findsNormalizedEmailExactlyWithoutExposingEmailAndExcludesPrefixes() {
    String suffix = UUID.randomUUID().toString();
    String email = "email-search+" + suffix + "@example.test";
    String ownerEmail = "owner-" + suffix + "@example.test";
    JsonNode owner = registerAndLogin("Email Search Owner " + suffix, ownerEmail, "valid-test-password-123");
    JsonNode target = registerAndLogin("Email Search Target " + suffix, email, "valid-test-password-123");

    ResponseEntity<JsonNode> exact = search(owner.path("token").asText(), "  " + email.toUpperCase() + "  ");
    ResponseEntity<JsonNode> partialAddress = search(owner.path("token").asText(), email.substring(0, email.indexOf('@')) + "@example");
    ResponseEntity<JsonNode> ownAccount = search(owner.path("token").asText(), ownerEmail);
    ResponseEntity<JsonNode> unregistered = search(owner.path("token").asText(), "unregistered+" + suffix + "@example.test");

    assertEquals(HttpStatus.OK, exact.getStatusCode());
    assertEquals(1, exact.getBody().path("users").size());
    assertEquals(target.path("user").path("id").asText(), exact.getBody().path("users").get(0).path("id").asText());
    assertEquals(email.toLowerCase(java.util.Locale.ROOT),
        users.findById(UUID.fromString(target.path("user").path("id").asText())).orElseThrow().getEmail());
    assertFalse(exact.getBody().path("users").get(0).has("email"));
    assertEquals(HttpStatus.OK, partialAddress.getStatusCode());
    assertEquals(0, partialAddress.getBody().path("users").size());
    assertEquals(HttpStatus.OK, ownAccount.getStatusCode());
    assertEquals(0, ownAccount.getBody().path("users").size());
    assertEquals(HttpStatus.OK, unregistered.getStatusCode());
    assertEquals(0, unregistered.getBody().path("users").size());
  }

  @Test
  void verificationRejectsMismatchesUnauthenticatedUsersAndUnrelatedContacts() throws Exception {
    String suffix = UUID.randomUUID().toString();
    JsonNode owner = registerAndLogin("Verifier " + suffix, "verify-owner-" + suffix + "@example.test", "valid-test-password-123");
    JsonNode stranger = registerAndLogin("Stranger " + suffix, "verify-stranger-" + suffix + "@example.test", "valid-test-password-123");
    User target = users.save(new User("verify-target-" + suffix + "@example.test", "Verification Target", "encoded-password"));
    String publicKey = generatePublicKey();
    String fingerprint = KeyEnrollmentService.fingerprintForPublicKeyBytes(java.util.Base64.getDecoder().decode(publicKey));
    target.setPublicKey(publicKey);
    target.setKeyFingerprint("not-the-computed-fingerprint");
    users.save(target);

    UUID ownerId = UUID.fromString(owner.path("user").path("id").asText());
    contacts.save(new ContactRelationship(ownerId, target.getId()));
    HttpHeaders ownerHeaders = new HttpHeaders();
    ownerHeaders.setBearerAuth(owner.path("token").asText());
    HttpHeaders strangerHeaders = new HttpHeaders();
    strangerHeaders.setBearerAuth(stranger.path("token").asText());
    Map<String, Object> matching = Map.of("fingerprint", fingerprint, "confirmed", true);
    Map<String, Object> mismatching = Map.of("fingerprint", "0".repeat(64), "confirmed", true);

    ResponseEntity<JsonNode> mismatch = http.exchange(
        "/api/contacts/" + target.getId() + "/verify", HttpMethod.POST,
        new HttpEntity<>(mismatching, ownerHeaders), JsonNode.class);
    ResponseEntity<JsonNode> unauthenticated = http.exchange(
        "/api/contacts/" + target.getId() + "/verify", HttpMethod.POST,
        new HttpEntity<>(matching, new HttpHeaders()), JsonNode.class);
    ResponseEntity<JsonNode> unrelated = http.exchange(
        "/api/contacts/" + target.getId() + "/verify", HttpMethod.POST,
        new HttpEntity<>(matching, strangerHeaders), JsonNode.class);

    assertEquals(HttpStatus.CONFLICT, mismatch.getStatusCode());
    assertEquals(HttpStatus.UNAUTHORIZED, unauthenticated.getStatusCode());
    assertEquals(HttpStatus.NOT_FOUND, unrelated.getStatusCode());
  }

  @Test
  void verificationPersistsForExactKeyAndBecomesStaleAfterRotation() throws Exception {
    String suffix = UUID.randomUUID().toString();
    JsonNode owner = registerAndLogin("Verifier " + suffix, "verifier-" + suffix + "@example.test", "valid-test-password-123");
    User target = users.save(new User("verify-target-" + suffix + "@example.test", "Verified Target", "encoded-password"));
    String publicKey = generatePublicKey();
    String fingerprint = KeyEnrollmentService.fingerprintForPublicKeyBytes(java.util.Base64.getDecoder().decode(publicKey));
    target.setPublicKey(publicKey);
    target.setKeyFingerprint(fingerprint);
    users.save(target);
    UUID ownerId = UUID.fromString(owner.path("user").path("id").asText());
    contacts.save(new ContactRelationship(ownerId, target.getId()));

    HttpHeaders headers = new HttpHeaders();
    headers.setBearerAuth(owner.path("token").asText());
    ResponseEntity<JsonNode> verified = http.exchange(
        "/api/contacts/" + target.getId() + "/verify",
        HttpMethod.POST,
        new HttpEntity<>(Map.of("fingerprint", fingerprint, "confirmed", true), headers),
        JsonNode.class);
    assertEquals(HttpStatus.OK, verified.getStatusCode());
    assertTrue(verified.getBody().path("verified").asBoolean());

    ResponseEntity<JsonNode> afterReload = http.exchange(
        "/api/contacts/" + target.getId(), HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class);
    assertTrue(afterReload.getBody().path("verified").asBoolean());

    String rotatedPublicKey = generatePublicKey();
    target.setPublicKey(rotatedPublicKey);
    target.setKeyFingerprint(KeyEnrollmentService.fingerprintForPublicKeyBytes(
        java.util.Base64.getDecoder().decode(rotatedPublicKey)));
    users.save(target);
    ResponseEntity<JsonNode> afterRotation = http.exchange(
        "/api/contacts/" + target.getId(), HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class);
    assertFalse(afterRotation.getBody().path("verified").asBoolean());
    assertTrue(afterRotation.getBody().path("keyChangedSinceVerification").asBoolean());
  }

  @Test
  void duplicateFriendRequestsReturnConflict() {
    String suffix = UUID.randomUUID().toString();
    JsonNode sender = registerAndLogin("Sender " + suffix, "sender-" + suffix + "@example.test", "valid-test-password-123");
    JsonNode recipient = registerAndLogin("Recipient " + suffix, "recipient-" + suffix + "@example.test", "valid-test-password-123");
    HttpHeaders headers = new HttpHeaders();
    headers.setBearerAuth(sender.path("token").asText());
    HttpEntity<Map<String, String>> request = new HttpEntity<>(
        Map.of("recipientId", recipient.path("user").path("id").asText()), headers);

    ResponseEntity<JsonNode> first = http.postForEntity("/api/friend-requests", request, JsonNode.class);
    ResponseEntity<JsonNode> duplicate = http.postForEntity("/api/friend-requests", request, JsonNode.class);

    assertEquals(HttpStatus.CREATED, first.getStatusCode());
    assertEquals(HttpStatus.CONFLICT, duplicate.getStatusCode());
  }

  @Test
  void acceptedFriendRequestsCreateVisibleContactsForBothUsersWithoutVerifyingIdentity() {
    String suffix = UUID.randomUUID().toString();
    JsonNode sender = registerAndLogin("Contact Sender " + suffix, "contact-sender-" + suffix + "@example.test", "valid-test-password-123");
    JsonNode recipient = registerAndLogin("Contact Recipient " + suffix, "contact-recipient-" + suffix + "@example.test", "valid-test-password-123");
    HttpHeaders senderHeaders = new HttpHeaders();
    senderHeaders.setBearerAuth(sender.path("token").asText());
    HttpHeaders recipientHeaders = new HttpHeaders();
    recipientHeaders.setBearerAuth(recipient.path("token").asText());

    ResponseEntity<JsonNode> sent = http.postForEntity("/api/friend-requests",
        new HttpEntity<>(Map.of("recipientId", recipient.path("user").path("id").asText()), senderHeaders),
        JsonNode.class);
    assertEquals(HttpStatus.CREATED, sent.getStatusCode());
    ResponseEntity<JsonNode> accepted = http.exchange(
        "/api/friend-requests/" + sent.getBody().path("id").asText() + "/accept",
        HttpMethod.POST, new HttpEntity<>(recipientHeaders), JsonNode.class);
    ResponseEntity<JsonNode> senderContacts = http.exchange(
        "/api/contacts", HttpMethod.GET, new HttpEntity<>(senderHeaders), JsonNode.class);
    ResponseEntity<JsonNode> recipientContacts = http.exchange(
        "/api/contacts", HttpMethod.GET, new HttpEntity<>(recipientHeaders), JsonNode.class);

    assertEquals(HttpStatus.OK, accepted.getStatusCode());
    assertEquals(sender.path("user").path("id").asText(),
        recipientContacts.getBody().get(0).path("id").asText());
    assertEquals(recipient.path("user").path("id").asText(),
        senderContacts.getBody().get(0).path("id").asText());
    assertFalse(senderContacts.getBody().get(0).path("verified").asBoolean());
    assertFalse(recipientContacts.getBody().get(0).path("verified").asBoolean());
  }

  @Test
  void challengeConsumptionAndIdentityKeyEnrollmentAreAtomic() {
    UUID userId = UUID.randomUUID();
    UUID challengeId = UUID.randomUUID();
    challenges.save(new KeyChallenge(challengeId, userId, "single-use-value", java.time.Instant.now()));

    assertFalse(challenges.consumeByIdAndUserId(challengeId, UUID.randomUUID()).isPresent());
    assertTrue(challenges.consumeByIdAndUserId(challengeId, userId).isPresent());
    assertFalse(challenges.consumeByIdAndUserId(challengeId, userId).isPresent());

    User user = users.save(new User("atomic-" + UUID.randomUUID() + "@example.test", "Atomic User", "hash"));
    assertTrue(users.enrollIdentityKeyIfAbsent(user.getId(), "first-public-key", "first-fingerprint"));
    assertFalse(users.enrollIdentityKeyIfAbsent(user.getId(), "second-public-key", "second-fingerprint"));

    User stored = users.findById(user.getId()).orElseThrow();
    assertEquals("first-public-key", stored.getPublicKey());
    assertEquals("first-fingerprint", stored.getKeyFingerprint());
  }

  private JsonNode registerAndLogin(String name, String email, String password) {
    ResponseEntity<JsonNode> registration = http.postForEntity("/api/auth/register",
        Map.of("name", name, "email", email, "password", password), JsonNode.class);
    assertEquals(HttpStatus.CREATED, registration.getStatusCode());

    ResponseEntity<JsonNode> login = http.postForEntity("/api/auth/login",
        Map.of("email", email, "password", password), JsonNode.class);
    assertEquals(HttpStatus.OK, login.getStatusCode());
    return login.getBody();
  }

  private static String generatePublicKey() throws Exception {
    java.security.KeyPairGenerator generator = java.security.KeyPairGenerator.getInstance("EC");
    generator.initialize(new java.security.spec.ECGenParameterSpec("secp256r1"));
    return java.util.Base64.getEncoder().encodeToString(generator.generateKeyPair().getPublic().getEncoded());
  }

  private ResponseEntity<JsonNode> search(String token, String query) {
    HttpHeaders headers = new HttpHeaders();
    headers.setBearerAuth(token);
    HttpEntity<Void> request = new HttpEntity<>(headers);
    return http.exchange(
        "/api/users?query=" + java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8),
        HttpMethod.GET, request, JsonNode.class);
  }
}
