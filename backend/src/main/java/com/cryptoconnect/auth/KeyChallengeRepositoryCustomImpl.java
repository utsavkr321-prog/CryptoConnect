package com.cryptoconnect.auth;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

public class KeyChallengeRepositoryCustomImpl implements KeyChallengeRepositoryCustom {
  private final MongoTemplate mongo;

  public KeyChallengeRepositoryCustomImpl(MongoTemplate mongo) {
    this.mongo = mongo;
  }

  @Override
  public Optional<KeyChallenge> consumeByIdAndUserId(UUID id, UUID userId) {
    Query query = Query.query(Criteria.where("id").is(id).and("userId").is(userId));
    return Optional.ofNullable(mongo.findAndRemove(query, KeyChallenge.class));
  }
}
