package com.cryptoconnect.events;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.UUID;

@Document("security_events")
public class SecurityEventRecord {
  @Id
  private UUID id;

  private UUID userId;

  private String type;

  private String severity;

  private String description;

  private Instant createdAt;

  protected SecurityEventRecord() {}

  SecurityEventRecord(UUID userId, String type, String severity, String description, Instant createdAt) {
    this.id = UUID.randomUUID();
    this.userId = userId;
    this.type = type;
    this.severity = severity;
    this.description = description;
    this.createdAt = createdAt;
  }

  public UUID getId() { return id; }
  public UUID getUserId() { return userId; }
  public String getType() { return type; }
  public String getSeverity() { return severity; }
  public String getDescription() { return description; }
  public Instant getCreatedAt() { return createdAt; }
}
