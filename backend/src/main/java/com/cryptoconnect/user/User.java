package com.cryptoconnect.user;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.UUID;

@Document("users")
public class User {
  @Id private UUID id;
  private String email;
  private String displayName;
  private String passwordHash;
  private String publicKey;
  private String keyFingerprint;
  private Instant createdAt;
  private Instant updatedAt;
  protected User() {}
  public User(String email, String displayName, String passwordHash) { this.id=UUID.randomUUID(); this.email=email; this.displayName=displayName; this.passwordHash=passwordHash; this.createdAt=Instant.now(); this.updatedAt=this.createdAt; }
  public UUID getId(){return id;} public String getEmail(){return email;} public String getDisplayName(){return displayName;} public String getPasswordHash(){return passwordHash;} public String getPublicKey(){return publicKey;} public String getKeyFingerprint(){return keyFingerprint;} public Instant getCreatedAt(){return createdAt;}
  public void updateDisplayName(String value){displayName=value; updatedAt=Instant.now();}
  public void setPublicKey(String value){publicKey=value; updatedAt=Instant.now();} public void setKeyFingerprint(String value){keyFingerprint=value; updatedAt=Instant.now();}
}
