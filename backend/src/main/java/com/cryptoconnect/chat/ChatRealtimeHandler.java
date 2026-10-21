package com.cryptoconnect.chat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.cryptoconnect.security.JwtService;
import com.cryptoconnect.security.AbuseProtection;
import com.cryptoconnect.security.TokenRevocationService;
import com.cryptoconnect.user.FriendService;
import com.cryptoconnect.user.PresenceChangedEvent;
import com.cryptoconnect.user.PresenceRegistry;
import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import jakarta.validation.Validator;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.context.event.EventListener;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class ChatRealtimeHandler extends TextWebSocketHandler {
  private static final String USER_ID = "authenticatedUserId";
  private static final String EXPIRES_AT = "tokenExpiresAt";
  private static final String TOKEN_ID = "tokenId";
  private static final String SUBSCRIPTIONS = "conversationSubscriptions";
  private static final String PRESENCE_SESSION_ID = "presenceSessionId";
  private final ObjectMapper mapper;
  private final JwtService jwt;
  private final ChatMessageService messages;
  private final Validator validator;
  private final AbuseProtection abuseProtection;
  private final TokenRevocationService revocations;
  private final PresenceRegistry presence;
  private final FriendService friends;
  private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

  public ChatRealtimeHandler(ObjectMapper mapper, JwtService jwt, ChatMessageService messages, Validator validator,
      AbuseProtection abuseProtection, TokenRevocationService revocations, PresenceRegistry presence, FriendService friends) {
    this.mapper = mapper;
    this.jwt = jwt;
    this.messages = messages;
    this.validator = validator;
    this.abuseProtection = abuseProtection;
    this.revocations = revocations;
    this.presence = presence;
    this.friends = friends;
  }

  @Override
  public void afterConnectionEstablished(WebSocketSession session) {
    sessions.add(session);
    session.getAttributes().put(SUBSCRIPTIONS, ConcurrentHashMap.<UUID>newKeySet());
    java.util.concurrent.CompletableFuture.delayedExecutor(10, java.util.concurrent.TimeUnit.SECONDS).execute(() -> {
      if (userIdOrNull(session) == null && session.isOpen()) {
        sessions.remove(session);
        try { session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Authentication required")); }
        catch (IOException ignored) { }
      }
    });
  }

  @Override
  protected void handleTextMessage(WebSocketSession session, TextMessage text) throws IOException {
    try {
      JsonNode frame = mapper.readTree(text.getPayload());
      if (frame == null || !frame.isObject()) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "WebSocket frame must be a JSON object");
      }
      if (userIdOrNull(session) == null) {
        if (!abuseProtection.allow("websocket-auth", remoteIdentity(session), 10,
            java.time.Duration.ofMinutes(1))) {
          sessions.remove(session);
          session.close(CloseStatus.POLICY_VIOLATION.withReason("Too many authentication attempts"));
          return;
        }
        authenticate(session, frame);
        return;
      }
      if (!sessionValid(session)) return;
      String type = frame.path("type").asText();
      int limit = switch (type) { case "send" -> 60; case "subscribe", "unsubscribe" -> 60; case "ack", "heartbeat" -> 120; default -> 120; };
      if (!abuseProtection.allow("websocket-" + type, userId(session).toString(), limit,
          java.time.Duration.ofMinutes(1))) {
        error(session, "Too many requests");
        return;
      }
      switch (type) {
        case "subscribe" -> subscribe(session, frame);
        case "unsubscribe" -> unsubscribe(session, frame);
        case "send" -> sendMessage(session, frame);
        case "ack" -> acknowledge(session, frame);
        case "heartbeat" -> presence.heartbeat(presenceSessionId(session));
        default -> error(session, "Unsupported message type");
      }
    } catch (JsonProcessingException e) {
      error(session, "Malformed WebSocket request");
    } catch (ResponseStatusException e) {
      error(session, e.getReason() == null ? "Request rejected" : e.getReason());
    } catch (Exception e) {
      error(session, "Request could not be processed");
    }
  }

  private void authenticate(WebSocketSession session, JsonNode frame) throws IOException {
    if (!"authenticate".equals(frame.path("type").asText()) || !frame.path("token").isTextual()) {
      session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Authentication required"));
      return;
    }
    try {
      String token = frame.path("token").asText();
      UUID userId = jwt.userId(token);
      UUID tokenId = jwt.tokenId(token);
      if (revocations.isRevoked(tokenId)) throw new IllegalArgumentException("Token revoked");
      java.time.Instant expiresAt = jwt.expiresAt(token);
      if (!expiresAt.isAfter(java.time.Instant.now())) {
        sessions.remove(session);
        session.close(CloseStatus.POLICY_VIOLATION.withReason("Authentication expired"));
        return;
      }
      synchronized (session) {
        session.getAttributes().put(USER_ID, userId);
        session.getAttributes().put(TOKEN_ID, tokenId);
        session.getAttributes().put(EXPIRES_AT, expiresAt);
        String presenceSessionId = UUID.randomUUID().toString();
        session.getAttributes().put(PRESENCE_SESSION_ID, presenceSessionId);
        presence.connect(userId, presenceSessionId);
      }
      long expiresInMillis = Math.max(0, java.time.Duration.between(java.time.Instant.now(), expiresAt).toMillis());
      java.util.concurrent.CompletableFuture.delayedExecutor(expiresInMillis, java.util.concurrent.TimeUnit.MILLISECONDS)
          .execute(() -> { if (session.isOpen()) sessionValid(session); });
      sendFrame(session, mapper.createObjectNode().put("type", "ready"));
    } catch (RuntimeException invalidToken) {
      session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Authentication failed"));
    }
  }

  private void subscribe(WebSocketSession session, JsonNode frame) throws IOException {
    UUID conversationId = uuid(frame.path("conversationId").asText(null));
    UUID userId = userId(session);
    messages.assertOneToOneMember(conversationId, userId);
    subscriptions(session).add(conversationId);
    sendFrame(session, mapper.createObjectNode().put("type", "subscribed").put("conversationId", conversationId.toString()));
  }

  private void unsubscribe(WebSocketSession session, JsonNode frame) throws IOException {
    UUID conversationId = uuid(frame.path("conversationId").asText(null));
    messages.assertOneToOneMember(conversationId, userId(session));
    subscriptions(session).remove(conversationId);
    sendFrame(session, mapper.createObjectNode().put("type", "unsubscribed").put("conversationId", conversationId.toString()));
  }

  private void sendMessage(WebSocketSession session, JsonNode frame) throws IOException {
    UUID conversationId = uuid(frame.path("conversationId").asText(null));
    if (!subscriptions(session).contains(conversationId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Subscribe to the conversation before sending");
    }
    ChatDtos.SendMessageRequest request = mapper.treeToValue(frame.path("message"), ChatDtos.SendMessageRequest.class);
    if (!validator.validate(request).isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid message content");
    ChatMessageService.SendResult result = messages.send(conversationId, userId(session), request);
    sendFrame(session, mapper.valueToTree(new OutboundMessage("accepted", result.message())));
  }

  private void acknowledge(WebSocketSession session, JsonNode frame) throws IOException {
    UUID messageId = uuid(frame.path("messageId").asText(null));
    ChatMessageService.DeliveryResult result = messages.acknowledgeDelivery(messageId, userId(session));
    if (!result.newlyDelivered()) return;
    ChatDtos.MessageResponse receipt = result.message();
    for (WebSocketSession recipient : sessions) {
      if (recipient.isOpen() && userIdOrNull(recipient) != null
          && sessionValid(recipient)
          && userIdOrNull(recipient).equals(receipt.senderId())
          && subscriptions(recipient).contains(receipt.conversationId())) {
        try { sendFrame(recipient, mapper.valueToTree(new OutboundMessage("receipt", receipt))); }
        catch (IOException staleConnection) { discardSession(recipient); }
      }
    }
  }

  @EventListener
  public void onMessageSaved(ChatMessageSavedEvent event) {
    ChatDtos.MessageResponse message = event.message();
    for (WebSocketSession recipient : sessions) {
      if (recipient.isOpen() && userIdOrNull(recipient) != null
          && sessionValid(recipient)
          && subscriptions(recipient).contains(message.conversationId())) {
        try { sendFrame(recipient, mapper.valueToTree(new OutboundMessage("message", message))); }
        catch (IOException staleConnection) { discardSession(recipient); }
      }
    }
  }

  @EventListener
  public void onReadReceiptSaved(ChatReadReceiptSavedEvent event) {
    if (event.messageIds().isEmpty()) return;
    var frame = mapper.createObjectNode().put("type", "read_receipt")
        .put("conversationId", event.conversationId().toString())
        .put("readerId", event.readerId().toString())
        .put("readAt", event.readAt().toString());
    var messageIds = frame.putArray("messageIds");
    event.messageIds().forEach(id -> messageIds.add(id.toString()));
    for (WebSocketSession recipient : sessions) {
      UUID recipientId = userIdOrNull(recipient);
      if (recipient.isOpen() && recipientId != null && !recipientId.equals(event.readerId())
          && sessionValid(recipient) && subscriptions(recipient).contains(event.conversationId())) {
        try { sendFrame(recipient, frame); }
        catch (IOException staleConnection) { discardSession(recipient); }
      }
    }
  }

  @EventListener
  public void onPresenceChanged(PresenceChangedEvent event) {
    var frame = mapper.createObjectNode().put("type", "presence").put("userId", event.userId().toString()).put("online", event.online());
    for (WebSocketSession recipient : sessions) {
      UUID viewer = userIdOrNull(recipient);
      if (recipient.isOpen() && viewer != null && sessionValid(recipient) && friends.areFriends(viewer, event.userId())) {
        try { sendFrame(recipient, frame); }
        catch (IOException staleConnection) { discardSession(recipient); }
      }
    }
  }

  @Override
  public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
    sessions.remove(session);
    presence.disconnect(presenceSessionIdOrNull(session));
  }

  @Override
  public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
    sessions.remove(session);
    presence.disconnect(presenceSessionIdOrNull(session));
    if (session.isOpen()) session.close(CloseStatus.SERVER_ERROR);
  }

  private void error(WebSocketSession session, String message) throws IOException {
    sendFrame(session, mapper.createObjectNode().put("type", "error").put("error", message));
  }

  private static UUID uuid(String value) {
    try { return UUID.fromString(value); }
    catch (RuntimeException invalid) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid identifier"); }
  }

  private static String remoteIdentity(WebSocketSession session) {
    var address = session.getRemoteAddress();
    return address == null || address.getAddress() == null ? "unknown" : address.getAddress().getHostAddress();
  }

  private static UUID userId(WebSocketSession session) {
    UUID id = userIdOrNull(session);
    if (id == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
    return id;
  }

  private static UUID userIdOrNull(WebSocketSession session) {
    synchronized (session) { return session.getAttributes().get(USER_ID) instanceof UUID id ? id : null; }
  }

  private static String presenceSessionId(WebSocketSession session) {
    String id = presenceSessionIdOrNull(session);
    if (id == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
    return id;
  }

  private static String presenceSessionIdOrNull(WebSocketSession session) {
    synchronized (session) { return session.getAttributes().get(PRESENCE_SESSION_ID) instanceof String id ? id : null; }
  }

  private boolean sessionValid(WebSocketSession session) {
    Object expiry;
    Object tokenId;
    synchronized (session) { expiry = session.getAttributes().get(EXPIRES_AT); tokenId = session.getAttributes().get(TOKEN_ID); }
    if (expiry instanceof java.time.Instant instant && instant.isAfter(java.time.Instant.now())
        && tokenId instanceof UUID id && !revocations.isRevoked(id)) return true;
    sessions.remove(session);
    presence.disconnect(presenceSessionIdOrNull(session));
    try { if (session.isOpen()) session.close(CloseStatus.POLICY_VIOLATION.withReason("Authentication expired")); }
    catch (IOException ignored) { }
    return false;
  }

  private void discardSession(WebSocketSession session) {
    sessions.remove(session);
    presence.disconnect(presenceSessionIdOrNull(session));
    try { if (session.isOpen()) session.close(CloseStatus.SERVER_ERROR); }
    catch (IOException ignored) { }
  }

  @SuppressWarnings("unchecked")
  private static Set<UUID> subscriptions(WebSocketSession session) {
    synchronized (session) { return (Set<UUID>) session.getAttributes().get(SUBSCRIPTIONS); }
  }

  private static void sendFrame(WebSocketSession session, JsonNode payload) throws IOException {
    synchronized (session) {
      if (session.isOpen()) session.sendMessage(new TextMessage(payload.toString()));
    }
  }

  private record OutboundMessage(String type, ChatDtos.MessageResponse message) {}
}
