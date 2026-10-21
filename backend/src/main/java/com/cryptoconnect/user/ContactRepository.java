package com.cryptoconnect.user;

import java.util.List;
import java.util.UUID;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

@Repository
public class ContactRepository {
  private final MongoTemplate mongo;
  public ContactRepository(MongoTemplate mongo) { this.mongo = mongo; }
  public ContactRelationship save(ContactRelationship contact) { return mongo.save(contact); }
  public List<ContactRelationship> findAllByOwnerIdOrderByCreatedAtDesc(UUID ownerId) {
    Query query = Query.query(Criteria.where("ownerId").is(ownerId)).with(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));
    return mongo.find(query, ContactRelationship.class);
  }
  public boolean existsByOwnerIdAndContactId(UUID ownerId, UUID contactId) {
    return mongo.exists(Query.query(Criteria.where("ownerId").is(ownerId).and("contactId").is(contactId)), ContactRelationship.class);
  }
  public long deleteByOwnerIdAndContactId(UUID ownerId, UUID contactId) {
    return mongo.remove(Query.query(Criteria.where("ownerId").is(ownerId).and("contactId").is(contactId)), ContactRelationship.class).getDeletedCount();
  }
}
