package com.cryptoconnect.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cryptoconnect.user.User;
import com.cryptoconnect.user.UserRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Testcontainers
class MongoPersistenceIntegrationTest {
  @Container
  private static final MongoDBContainer MONGO =
      new MongoDBContainer(DockerImageName.parse("mongo:7.0"));

  @Autowired private MongoTemplate mongo;
  @Autowired private UserRepository users;

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
}
