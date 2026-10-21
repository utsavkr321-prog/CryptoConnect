package com.cryptoconnect.events;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SecurityEventService {
  private record EventKind(String severity, String title, String description) {}

  private static final Map<String, EventKind> EVENT_KINDS = Map.ofEntries(
      Map.entry("account_created", new EventKind("success", "Account created", "A new account was created.")),
      Map.entry("login_success", new EventKind("success", "Sign-in successful", "Sign-in completed successfully.")),
      Map.entry("login_failure", new EventKind("warning", "Sign-in failed", "A sign-in attempt failed.")),
      Map.entry("message_sent", new EventKind("info", "Message sent", "Ciphertext was stored for a conversation.")),
      Map.entry("encryption_success", new EventKind("success", "Encryption completed", "The browser AES-GCM demonstration completed successfully.")),
      Map.entry("decryption_failure", new EventKind("warning", "Decryption failed", "The browser could not authenticate or decrypt the demonstration payload.")),
      Map.entry("tamper_detected", new EventKind("warning", "Tampering detected", "The AES-GCM demonstration rejected a modified ciphertext.")),
      Map.entry("key_generated", new EventKind("info", "Demo key generated", "A temporary browser-only key was generated for the demonstration.")));
  private static final Set<String> CLIENT_EVENT_TYPES = Set.of(
      "encryption_success", "decryption_failure", "tamper_detected", "key_generated");

  private final SecurityEventRepository repository;

  public SecurityEventService(SecurityEventRepository repository) {
    this.repository = repository;
  }

  public SecurityEventDtos.EventResponse record(UUID userId, String type) {
    EventKind kind = EVENT_KINDS.get(type);
    if (kind == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported security event type");
    }
    var event = repository.save(new SecurityEventRecord(
        userId, type, kind.severity(), kind.description(), Instant.now()));
    return response(event, kind);
  }

  public SecurityEventDtos.EventResponse recordClientEvent(UUID userId, String type) {
    if (!CLIENT_EVENT_TYPES.contains(type)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported client security event type");
    }
    return record(userId, type);
  }

  public List<SecurityEventDtos.EventResponse> listForUser(UUID userId) {
    return repository.findTop100ByUserIdOrderByCreatedAtDesc(userId).stream()
        .map(event -> response(event, EVENT_KINDS.getOrDefault(event.getType(),
            new EventKind(event.getSeverity(), "Security event", event.getDescription()))))
        .toList();
  }

  private static SecurityEventDtos.EventResponse response(SecurityEventRecord event, EventKind kind) {
    return new SecurityEventDtos.EventResponse(event.getId(), event.getType(), event.getSeverity(),
        kind.title(), event.getDescription(), event.getCreatedAt(), false);
  }
}
