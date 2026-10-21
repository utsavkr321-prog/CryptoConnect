package com.cryptoconnect.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class MongoConfigurationTest {
  private final MongoConfiguration configuration = new MongoConfiguration();

  @Test void requiresMongoUriWithoutExposingConnectionDetails() {
    IllegalStateException error = assertThrows(IllegalStateException.class,
        () -> configuration.validateMongoConfiguration(new MockEnvironment()));
    assertTrue(error.getMessage().contains("MONGODB_URI is required"));
  }

  @Test void rejectsInvalidUriWithoutEchoingIt() {
    String supplied = "mongodb://sensitive-value@/bad";
    IllegalStateException error = assertThrows(IllegalStateException.class,
        () -> configuration.validateMongoConfiguration(new MockEnvironment().withProperty("MONGODB_URI", supplied)));
    assertTrue(!error.getMessage().contains("sensitive-value"));
  }

  @Test void acceptsWellFormedLocalMongoUri() {
    MockEnvironment environment = new MockEnvironment()
        .withProperty("MONGODB_URI", "mongodb://127.0.0.1:27017/cryptoconnect_test")
        .withProperty("MONGODB_DATABASE", "cryptoconnect_test");
    assertDoesNotThrow(() -> configuration.validateMongoConfiguration(environment));
  }

  @Test void rejectsUnsafeDatabaseName() {
    MockEnvironment environment = new MockEnvironment()
        .withProperty("MONGODB_URI", "mongodb://127.0.0.1:27017/cryptoconnect_test")
        .withProperty("MONGODB_DATABASE", "bad/name");
    assertThrows(IllegalStateException.class, () -> configuration.validateMongoConfiguration(environment));
  }

  @Test void normalizesAccidentalAngleBracketsInPassword() {
    MockEnvironment environment = new MockEnvironment()
        .withProperty("MONGODB_URI", "mongodb+srv://dbuser:<secret123>@cluster0.abc.mongodb.net/cryptoconnect")
        .withProperty("MONGODB_DATABASE", "cryptoconnect");
    assertDoesNotThrow(() -> configuration.validateMongoConfiguration(environment));
    assertTrue(MongoConfiguration.normalizeMongoUri("mongodb+srv://user:<mypass>@host/db")
        .equals("mongodb+srv://user:mypass@host/db"));
  }
}

