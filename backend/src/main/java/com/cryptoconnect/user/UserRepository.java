package com.cryptoconnect.user;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {
  private final MongoTemplate mongo;

  public UserRepository(MongoTemplate mongo) { this.mongo = mongo; }

  public Optional<User> findById(UUID id) { return Optional.ofNullable(mongo.findById(id, User.class)); }
  public boolean existsById(UUID id) { return findById(id).isPresent(); }
  public List<User> findAllById(Iterable<UUID> ids) {
    List<UUID> values = new java.util.ArrayList<>(); ids.forEach(values::add);
    return values.isEmpty() ? List.of() : mongo.find(Query.query(Criteria.where("id").in(values)), User.class);
  }
  public User save(User user) { return mongo.save(user); }
  public Optional<User> findByEmailIgnoreCase(String email) {
    String normalizedEmail = email.toLowerCase(Locale.ROOT);
    User canonicalMatch = mongo.findOne(Query.query(Criteria.where("email").is(normalizedEmail)), User.class);
    if (canonicalMatch != null) return Optional.of(canonicalMatch);
    return Optional.ofNullable(mongo.findOne(Query.query(Criteria.where("email").regex(exactIgnoreCase(email))), User.class));
  }
  public boolean existsByEmailIgnoreCase(String email) { return findByEmailIgnoreCase(email).isPresent(); }
  public boolean enrollIdentityKeyIfAbsent(UUID userId, String publicKey, String fingerprint) {
    Criteria noPublicKey = new Criteria().orOperator(
        Criteria.where("publicKey").exists(false), Criteria.where("publicKey").is(null));
    Criteria noFingerprint = new Criteria().orOperator(
        Criteria.where("keyFingerprint").exists(false), Criteria.where("keyFingerprint").is(null));
    Query query = Query.query(Criteria.where("id").is(userId).andOperator(noPublicKey, noFingerprint));
    Update update =
        new Update()
            .set("publicKey", publicKey)
            .set("keyFingerprint", fingerprint)
            .set("updatedAt", java.time.Instant.now());
    return mongo.updateFirst(query, update, User.class).getModifiedCount() == 1;
  }
  public List<User> findDirectory(String query, int page, int size, UUID excludedUserId) {
    Query request = new Query();
    String value = query == null ? "" : query.trim();
    if (!value.isEmpty()) {
      Criteria displayNameMatch = Criteria.where("displayName").regex(containsIgnoreCase(value));
      if (value.contains("@")) {
        Criteria emailMatch = Criteria.where("email").regex(exactIgnoreCase(value.toLowerCase(java.util.Locale.ROOT)));
        request.addCriteria(new Criteria().orOperator(displayNameMatch, emailMatch));
      } else {
        request.addCriteria(displayNameMatch);
      }
    }
    request.addCriteria(Criteria.where("id").ne(excludedUserId));
    request.with(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt", "id"));
    request.skip((long) page * size).limit(size + 1);
    return mongo.find(request, User.class);
  }

  private static Pattern exactIgnoreCase(String value) { return Pattern.compile("^" + Pattern.quote(value) + "$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE); }
  private static Pattern containsIgnoreCase(String value) { return Pattern.compile(Pattern.quote(value), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE); }
}
