package com.cryptoconnect.chat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

@Repository
class ConversationRepository {
  private final MongoTemplate mongo;
  ConversationRepository(MongoTemplate mongo) { this.mongo = mongo; }
  Optional<Conversation> findById(UUID id) { return Optional.ofNullable(mongo.findById(id, Conversation.class)); }
  List<Conversation> findAllById(Iterable<UUID> ids) {
    List<UUID> values = new ArrayList<>(); ids.forEach(values::add);
    return values.isEmpty() ? List.of() : mongo.find(Query.query(Criteria.where("id").in(values)), Conversation.class);
  }
  Conversation save(Conversation value) { return mongo.save(value); }
  Conversation saveAndFlush(Conversation value) { return save(value); }
  Optional<Conversation> findByIdForMessageSend(UUID id) { return findById(id); }
  Optional<Conversation> findByParticipantLowIdAndParticipantHighId(UUID low, UUID high) {
    return Optional.ofNullable(mongo.findOne(Query.query(Criteria.where("participantLowId").is(low).and("participantHighId").is(high)), Conversation.class));
  }
  List<Conversation> findByParticipantLowIdOrParticipantHighId(UUID low, UUID high) {
    return mongo.find(Query.query(new Criteria().orOperator(Criteria.where("participantLowId").is(low), Criteria.where("participantHighId").is(high))), Conversation.class);
  }
  long countOneToOneByUserId(UUID userId) {
    return mongo.count(Query.query(new Criteria().orOperator(Criteria.where("participantLowId").is(userId), Criteria.where("participantHighId").is(userId))), Conversation.class);
  }
}

@Repository
class MemberRepository {
  private final MongoTemplate mongo;
  MemberRepository(MongoTemplate mongo) { this.mongo = mongo; }
  ConversationMember save(ConversationMember value) { return mongo.save(value); }
  Optional<ConversationMember> findById(ConversationMember.Key key) { return Optional.ofNullable(mongo.findById(ConversationMember.key(key.conversationId(), key.userId()), ConversationMember.class)); }
  List<ConversationMember> findByIdUserId(UUID userId) { return mongo.find(Query.query(Criteria.where("userId").is(userId)), ConversationMember.class); }
  List<ConversationMember> findByIdConversationId(UUID id) { return mongo.find(Query.query(Criteria.where("conversationId").is(id)), ConversationMember.class); }
  List<ConversationMember> findByIdConversationIdIn(List<UUID> ids) {
    return ids.isEmpty() ? List.of() : mongo.find(Query.query(Criteria.where("conversationId").in(ids)), ConversationMember.class);
  }
  long countByIdUserId(UUID userId) { return mongo.count(Query.query(Criteria.where("userId").is(userId)), ConversationMember.class); }
  boolean existsByIdConversationIdAndIdUserId(UUID conversationId, UUID userId) {
    return mongo.exists(Query.query(Criteria.where("conversationId").is(conversationId).and("userId").is(userId)), ConversationMember.class);
  }
  List<UnreadCountProjection> findUnreadCountsByUserId(UUID userId) {
    List<UUID> ids = findByIdUserId(userId).stream().map(ConversationMember::conversationId).toList();
    if (ids.isEmpty()) return List.of();
    List<ChatMessage> unread = mongo.find(Query.query(Criteria.where("conversationId").in(ids).and("senderId").ne(userId).and("readAt").is(null)), ChatMessage.class);
    Map<UUID, Long> counts = unread.stream().collect(Collectors.groupingBy(ChatMessage::getConversationId, Collectors.counting()));
    return counts.entrySet().stream().map(e -> (UnreadCountProjection) new UnreadCount(e.getKey(), e.getValue())).toList();
  }
}

interface UnreadCountProjection { UUID getConversationId(); long getUnreadCount(); }
interface LatestMessageSummaryProjection { UUID getConversationId(); Instant getCreatedAt(); }
record UnreadCount(UUID conversationId, long unreadCount) implements UnreadCountProjection {
  public UUID getConversationId() { return conversationId; }
  public long getUnreadCount() { return unreadCount; }
}

@Repository
class MessageRepository {
  private final MongoTemplate mongo;
  MessageRepository(MongoTemplate mongo) { this.mongo = mongo; }
  Optional<ChatMessage> findById(UUID id) { return Optional.ofNullable(mongo.findById(id, ChatMessage.class)); }
  Optional<ChatMessage> findByIdForDeliveryAck(UUID id) { return findById(id); }
  ChatMessage save(ChatMessage message) { return mongo.save(message); }
  ChatMessage saveAndFlush(ChatMessage message) { return save(message); }
  Optional<ChatMessage> findByConversationIdAndSenderIdAndClientMessageId(UUID conversationId, UUID senderId, String clientMessageId) {
    Query query = Query.query(Criteria.where("conversationId").is(conversationId).and("senderId").is(senderId).and("clientMessageId").is(clientMessageId));
    return Optional.ofNullable(mongo.findOne(query, ChatMessage.class));
  }
  List<ChatMessage> findTop50ByConversationIdOrderByCreatedAtDesc(UUID conversationId) {
    return mongo.find(Query.query(Criteria.where("conversationId").is(conversationId)).with(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))).limit(50), ChatMessage.class);
  }
  List<ChatMessage> findTop50ByConversationIdAndCreatedAtBeforeOrderByCreatedAtDesc(UUID conversationId, Instant before) {
    return mongo.find(Query.query(Criteria.where("conversationId").is(conversationId).and("createdAt").lt(before)).with(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))).limit(50), ChatMessage.class);
  }
  List<LatestMessageSummaryProjection> findLatestMessageSummaries(List<UUID> ids) {
    if (ids.isEmpty()) return List.of();
    List<ChatMessage> rows = mongo.find(Query.query(Criteria.where("conversationId").in(ids)).with(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))), ChatMessage.class);
    Set<UUID> found = new java.util.HashSet<>();
    List<LatestMessageSummaryProjection> latest = new ArrayList<>();
    for (ChatMessage row : rows) if (found.add(row.getConversationId())) latest.add(new Latest(row.getConversationId(), row.getCreatedAt()));
    return latest;
  }
  long countSentInOneToOneConversations(UUID userId) { return countForUser(userId, Criteria.where("senderId").is(userId)); }
  long countStoredInOneToOneConversations(UUID userId) { return countForUser(userId, null); }
  long countUnreadInOneToOneConversations(UUID userId) { return countForUser(userId, Criteria.where("senderId").ne(userId).and("readAt").is(null)); }
  private long countForUser(UUID userId, Criteria messageCriteria) {
    List<UUID> ids = conversationIdsFor(userId);
    if (ids.isEmpty()) return 0;
    Criteria criteria = Criteria.where("conversationId").in(ids);
    if (messageCriteria != null) criteria = new Criteria().andOperator(criteria, messageCriteria);
    return mongo.count(Query.query(criteria), ChatMessage.class);
  }
  List<DailyMessageActivityProjection> findDailyActivity(UUID userId, Instant from, Instant until) {
    List<UUID> ids = conversationIdsFor(userId);
    if (ids.isEmpty()) return List.of();
    List<ChatMessage> rows = mongo.find(Query.query(Criteria.where("conversationId").in(ids).and("createdAt").gte(from).lt(until)), ChatMessage.class);
    Map<LocalDate, long[]> counts = new HashMap<>();
    for (ChatMessage message : rows) {
      LocalDate day = message.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
      long[] totalSent = counts.computeIfAbsent(day, ignored -> new long[2]);
      totalSent[0]++;
      if (message.getSenderId().equals(userId)) totalSent[1]++;
    }
    return counts.entrySet().stream().sorted(Map.Entry.comparingByKey())
        .map(e -> (DailyMessageActivityProjection) new Daily(e.getKey().toString(), e.getValue()[0], e.getValue()[1])).toList();
  }
  private List<UUID> conversationIdsFor(UUID userId) {
    return mongo.find(Query.query(new Criteria().orOperator(Criteria.where("participantLowId").is(userId), Criteria.where("participantHighId").is(userId))), Conversation.class)
        .stream().filter(Conversation::isOneToOne).map(Conversation::getId).toList();
  }
  List<UUID> findUnreadMessageIds(UUID conversationId, UUID userId, List<UUID> ids) {
    if (ids.isEmpty()) return List.of();
    return mongo.find(Query.query(Criteria.where("id").in(ids).and("conversationId").is(conversationId).and("senderId").ne(userId).and("readAt").is(null)), ChatMessage.class)
        .stream().map(ChatMessage::getId).toList();
  }
  int markMessagesRead(List<UUID> ids, Instant readAt) {
    if (ids.isEmpty()) return 0;
    return (int) mongo.updateMulti(Query.query(Criteria.where("id").in(ids).and("readAt").is(null)), new Update().set("readAt", readAt), ChatMessage.class).getModifiedCount();
  }
  long countUnreadByConversationAndUser(UUID conversationId, UUID userId) {
    return mongo.count(Query.query(Criteria.where("conversationId").is(conversationId).and("senderId").ne(userId).and("readAt").is(null)), ChatMessage.class);
  }

  private record Latest(UUID conversationId, Instant createdAt) implements LatestMessageSummaryProjection {
    public UUID getConversationId() { return conversationId; }
    public Instant getCreatedAt() { return createdAt; }
  }
  private record Daily(String day, long total, long sent) implements DailyMessageActivityProjection {
    public String getDay() { return day; }
    public long getTotal() { return total; }
    public long getSent() { return sent; }
  }
}
