package com.cryptoconnect.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

@Repository public class FriendRequestRepository {
  private final MongoTemplate mongo; public FriendRequestRepository(MongoTemplate mongo) { this.mongo = mongo; }
  public FriendRequest save(FriendRequest request) { return mongo.save(request); }
  public Optional<FriendRequest> findPairById(UUID id) { return Optional.ofNullable(mongo.findById(id, FriendRequest.class)); }
  public Optional<FriendRequest> findPair(UUID low, UUID high) { return Optional.ofNullable(mongo.findOne(Query.query(Criteria.where("participantLowId").is(low).and("participantHighId").is(high)), FriendRequest.class)); }
  public List<FriendRequest> incoming(UUID userId) { return mongo.find(Query.query(new Criteria().andOperator(new Criteria().orOperator(Criteria.where("participantLowId").is(userId), Criteria.where("participantHighId").is(userId)), Criteria.where("requestedById").ne(userId))).with(Sort.by(Sort.Direction.DESC, "updatedAt")), FriendRequest.class); }
  public List<FriendRequest> outgoing(UUID userId) { return mongo.find(Query.query(Criteria.where("requestedById").is(userId)).with(Sort.by(Sort.Direction.DESC, "updatedAt")), FriendRequest.class); }
}
