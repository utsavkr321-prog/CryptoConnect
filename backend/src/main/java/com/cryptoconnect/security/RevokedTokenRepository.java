package com.cryptoconnect.security;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

@Repository
public class RevokedTokenRepository {
  private final MongoTemplate mongo;
  public RevokedTokenRepository(MongoTemplate mongo) { this.mongo = mongo; }
  public RevokedToken save(RevokedToken token) { return mongo.save(token); }
  public boolean existsById(UUID id) { return mongo.exists(Query.query(Criteria.where("id").is(id)), RevokedToken.class); }
  public long deleteByExpiresAtBefore(Instant cutoff) {
    return mongo.remove(Query.query(Criteria.where("expiresAt").lt(cutoff)), RevokedToken.class).getDeletedCount();
  }
}
