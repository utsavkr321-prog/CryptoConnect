package com.cryptoconnect.user;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Process-local WebSocket presence. A user is online while it owns at least one fresh authenticated session. */
@Component
public class PresenceRegistry {
  private final ApplicationEventPublisher events;
  private final Duration staleAfter;
  private final Map<String, Session> sessions = new ConcurrentHashMap<>();
  private final Map<UUID, Set<String>> userSessions = new ConcurrentHashMap<>();

  public PresenceRegistry(ApplicationEventPublisher events, @Value("${app.presence.stale-seconds:90}") long staleSeconds) {
    this.events = events;
    this.staleAfter = Duration.ofSeconds(Math.max(30, staleSeconds));
  }

  public void connect(UUID userId, String sessionId) {
    boolean wasOnline = isOnline(userId);
    sessions.put(sessionId, new Session(userId, Instant.now()));
    userSessions.computeIfAbsent(userId, ignored -> ConcurrentHashMap.newKeySet()).add(sessionId);
    if (!wasOnline) events.publishEvent(new PresenceChangedEvent(userId, true));
  }

  public void heartbeat(String sessionId) {
    sessions.computeIfPresent(sessionId, (ignored, current) -> new Session(current.userId(), Instant.now()));
  }

  public void disconnect(String sessionId) {
    if (sessionId == null) return;
    Session removed = sessions.remove(sessionId);
    if (removed == null) return;
    Set<String> ids = userSessions.get(removed.userId());
    if (ids != null) {
      ids.remove(sessionId);
      if (ids.isEmpty()) userSessions.remove(removed.userId(), ids);
    }
    if (!isOnline(removed.userId())) events.publishEvent(new PresenceChangedEvent(removed.userId(), false));
  }

  public boolean isOnline(UUID userId) { return userSessions.containsKey(userId); }

  public Map<UUID, Boolean> status(Collection<UUID> userIds) {
    return userIds.stream().distinct().collect(java.util.stream.Collectors.toMap(id -> id, this::isOnline));
  }

  @Scheduled(fixedDelay = 30_000)
  void expireStaleSessions() { expireStaleSessions(Instant.now()); }

  void expireStaleSessions(Instant now) {
    sessions.forEach((id, session) -> { if (session.lastSeen().plus(staleAfter).isBefore(now)) disconnect(id); });
  }

  private record Session(UUID userId, Instant lastSeen) {}
}
