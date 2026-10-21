package com.cryptoconnect.events;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

@Repository
public class SecurityEventRepository {
  private final MongoTemplate mongo;
  public SecurityEventRepository(MongoTemplate mongo) { this.mongo = mongo; }
  public SecurityEventRecord save(SecurityEventRecord event) { return mongo.save(event); }
  public List<SecurityEventRecord> findTop100ByUserIdOrderByCreatedAtDesc(UUID userId) {
    return mongo.find(Query.query(Criteria.where("userId").is(userId)).with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(100), SecurityEventRecord.class);
  }
}
