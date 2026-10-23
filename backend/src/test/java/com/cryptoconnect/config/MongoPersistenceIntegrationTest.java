package com.cryptoconnect.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.cryptoconnect.auth.KeyChallenge;
import com.cryptoconnect.auth.KeyChallengeRepository;
import com.cryptoconnect.user.User;
import com.cryptoconnect.user.UserRepository;
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

    ResponseEntity<JsonNode> alphaFindsBeta = search(beta.path("token").asText(), betaName);
    ResponseEntity<JsonNode> betaFindsAlpha = search(alpha.path("token").asText(), alphaName);

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

  private ResponseEntity<JsonNode> search(String token, String query) {
    HttpHeaders headers = new HttpHeaders();
    headers.setBearerAuth(token);
    HttpEntity<Void> request = new HttpEntity<>(headers);
    return http.exchange(
        "/api/users?query=" + java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8),
        HttpMethod.GET, request, JsonNode.class);
  }
}
