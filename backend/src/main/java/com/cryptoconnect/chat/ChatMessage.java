package com.cryptoconnect.chat;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.UUID;

@Document("messages")
public class ChatMessage {
  @Id private UUID id;
  private UUID conversationId;
  private UUID senderId;
  private String clientMessageId;
  private String legacyCiphertext;
  private String legacyIv;
  private String legacyAlgorithm;
  private String content;
  private ChatDtos.MessageFormat format;
  private Instant createdAt;
  private Instant deliveredAt;
  private Instant readAt;

  protected ChatMessage() {}

  public ChatMessage(UUID conversationId, UUID senderId, String clientMessageId, String content) {
    this.id = UUID.randomUUID();
    this.conversationId = conversationId;
    this.senderId = senderId;
    this.clientMessageId = clientMessageId;
    this.content = content;
    this.format = ChatDtos.MessageFormat.TEXT;
    this.createdAt = Instant.now();
  }

  public UUID getId() { return id; }
  public UUID getConversationId() { return conversationId; }
  public UUID getSenderId() { return senderId; }
  public String getClientMessageId() { return clientMessageId; }
  public String getLegacyCiphertext() { return legacyCiphertext; }
  public String getLegacyIv() { return legacyIv; }
  public String getLegacyAlgorithm() { return legacyAlgorithm; }
  public String getContent() { return content; }
  public ChatDtos.MessageFormat getFormat() { return format; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getDeliveredAt() { return deliveredAt; }
  public Instant getReadAt() { return readAt; }
  public void markDeliveredAt(Instant value) { if (deliveredAt == null) deliveredAt = value; }
  public void markReadAt(Instant value) { if (readAt == null) readAt = value; }
}
