package com.cryptoconnect.config;

import com.mongodb.ConnectionString;
import org.bson.UuidRepresentation;
import org.springframework.boot.autoconfigure.mongo.MongoClientSettingsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
public class MongoConfiguration {

  /** Safely normalizes accidental angle-brackets around passwords (e.g., from Atlas connection templates). */
  public static String normalizeMongoUri(String uri) {
    if (uri == null) return null;
    return uri.replaceFirst("(?<=mongodb(?:\\+srv)?://[^:]+:)<([^>]+)>(?=@)", "$1");
  }

  @Bean
  MongoClientSettingsBuilderCustomizer validateMongoConfiguration(Environment environment) {
    String uri = environment.getProperty("MONGODB_URI");
    if (uri == null || uri.isBlank()) {
      throw new IllegalStateException("MONGODB_URI is required. Configure it in protected runtime settings; no database connection was attempted.");
    }
    String normalizedUri = normalizeMongoUri(uri);
    try {
      String scheme = normalizedUri.substring(0, Math.min(normalizedUri.length(), normalizedUri.indexOf(':') < 0 ? normalizedUri.length() : normalizedUri.indexOf(':')));
      if (!scheme.equals("mongodb") && !scheme.equals("mongodb+srv")) throw new IllegalArgumentException();
      new ConnectionString(normalizedUri);
    } catch (RuntimeException invalid) {
      throw new IllegalStateException("MONGODB_URI is invalid. Check the protected runtime configuration; the URI value is not logged.");
    }
    String database = environment.getProperty("MONGODB_DATABASE", "cryptoconnect");
    if (database.isBlank() || !database.matches("[A-Za-z0-9_-]{1,63}")) {
      throw new IllegalStateException("MONGODB_DATABASE must be a valid database name.");
    }
    return builder -> {
      builder.uuidRepresentation(UuidRepresentation.STANDARD);
      if (!normalizedUri.equals(uri)) {
        builder.applyConnectionString(new ConnectionString(normalizedUri));
      }
    };
  }
}

