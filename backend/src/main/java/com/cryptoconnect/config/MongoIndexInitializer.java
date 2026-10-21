package com.cryptoconnect.config;

import java.util.concurrent.TimeUnit;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

/** Creates only required indexes; it never drops collections or modifies existing documents. */
@Component
public class MongoIndexInitializer implements ApplicationRunner {
  private final MongoTemplate mongo;
  public MongoIndexInitializer(MongoTemplate mongo) { this.mongo = mongo; }

  static String sanitizeDiagnostic(Throwable error) {
    if (error == null) return "unknown error";
    String message = error.getMessage() != null ? error.getMessage() : error.getClass().getSimpleName();
    if (message.contains("bad auth") || message.contains("authentication failed") || message.contains("MongoSecurityException")) {
      return "Authentication failed (verify database credentials in MONGODB_URI and ensure password does not contain outer '<>' brackets)";
    }
    if (message.contains("Timed out") || message.contains("ServerSelectionTimeoutException") || message.contains("MongoTimeoutException")) {
      return "Connection timed out (verify host address, port, network connectivity, and Atlas IP allowlist)";
    }
    if (message.contains("Connection refused") || message.contains("MongoSocketOpenException")) {
      return "Connection refused (ensure MongoDB service is running and accessible on the specified host/port)";
    }
    String sanitized = message.replaceAll("mongodb(\\+srv)?://[^@\\s]+@", "mongodb$1://[REDACTED]@");
    sanitized = sanitized.replaceAll("(?i)(password|secret|token)=\\S+", "$1=[REDACTED]");
    return sanitized;
  }

  @Override
  public void run(ApplicationArguments args) {
    try {
      mongo.getDb().runCommand(new org.bson.Document("ping", 1));
      mongo.indexOps("users").ensureIndex(new Index().on("email", Sort.Direction.ASC).unique().named("uk_users_email"));
      mongo.indexOps("users").ensureIndex(new Index().on("createdAt", Sort.Direction.DESC).named("idx_users_created"));
      mongo.indexOps("friend_requests").ensureIndex(new Index().on("participantLowId", Sort.Direction.ASC).on("participantHighId", Sort.Direction.ASC).unique().named("uk_friend_request_pair"));
      mongo.indexOps("friend_requests").ensureIndex(new Index().on("requestedById", Sort.Direction.ASC).on("updatedAt", Sort.Direction.DESC).named("idx_friend_requests_sender"));
      mongo.indexOps("contacts").ensureIndex(new Index().on("ownerId", Sort.Direction.ASC).on("contactId", Sort.Direction.ASC).unique().named("uk_contacts_owner_contact"));
      mongo.indexOps("contact_verifications").ensureIndex(new Index().on("ownerId", Sort.Direction.ASC).on("contactId", Sort.Direction.ASC).unique().named("uk_contact_verifications_owner_contact"));
      mongo.indexOps("conversations").ensureIndex(new Index().on("participantLowId", Sort.Direction.ASC).on("participantHighId", Sort.Direction.ASC).unique().named("uk_conversation_participant_pair"));
      mongo.indexOps("conversation_members").ensureIndex(new Index().on("userId", Sort.Direction.ASC).on("conversationId", Sort.Direction.ASC).unique().named("uk_member_user_conversation"));
      mongo.indexOps("messages").ensureIndex(new Index().on("conversationId", Sort.Direction.ASC).on("senderId", Sort.Direction.ASC).on("clientMessageId", Sort.Direction.ASC).unique().named("uk_message_idempotency"));
      mongo.indexOps("messages").ensureIndex(new Index().on("conversationId", Sort.Direction.ASC).on("createdAt", Sort.Direction.DESC).on("id", Sort.Direction.DESC).named("idx_messages_conversation_created"));
      mongo.indexOps("messages").ensureIndex(new Index().on("conversationId", Sort.Direction.ASC).on("senderId", Sort.Direction.ASC).on("readAt", Sort.Direction.ASC).named("idx_messages_unread"));
      mongo.indexOps("security_events").ensureIndex(new Index().on("userId", Sort.Direction.ASC).on("createdAt", Sort.Direction.DESC).named("idx_security_events_user_created"));
      mongo.indexOps("revoked_tokens").ensureIndex(new Index().on("expiresAt", Sort.Direction.ASC).expire(0, TimeUnit.SECONDS).named("ttl_revoked_tokens_expires"));
    } catch (RuntimeException failure) {
      String diagnostic = sanitizeDiagnostic(failure);
      throw new IllegalStateException("MongoDB connectivity or required index initialization failed: " + diagnostic +
          ". Verify the configured database and its permissions; connection details are omitted to protect secrets.", failure);
    }
  }
}
