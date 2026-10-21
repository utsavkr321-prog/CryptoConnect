package com.cryptoconnect.chat;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/** A small membership/read marker document. Conversation participant IDs remain authoritative. */
@Document("conversation_members")
public class ConversationMember {
  @Id private String id;
  private UUID conversationId;
  private UUID userId;
  private Instant lastReadAt;
  protected ConversationMember() {}
  public ConversationMember(UUID conversationId, UUID userId) {
    this.conversationId = conversationId;
    this.userId = userId;
    this.id = key(conversationId, userId);
  }
  public UUID conversationId() { return conversationId; }
  public UUID userId() { return userId; }
  public void markReadAt(Instant value) { lastReadAt = value; }
  public Instant lastReadAt() { return lastReadAt; }
  static String key(UUID conversationId, UUID userId) { return conversationId + ":" + userId; }
  public record Key(UUID conversationId, UUID userId) implements java.io.Serializable {}
}
