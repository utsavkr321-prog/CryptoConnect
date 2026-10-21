package com.cryptoconnect.events;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/security-events")
public class SecurityEventController {
  private final SecurityEventService events;

  public SecurityEventController(SecurityEventService events) {
    this.events = events;
  }

  @GetMapping
  public List<SecurityEventDtos.EventResponse> list(Authentication authentication) {
    return events.listForUser((UUID) authentication.getPrincipal());
  }

  @PostMapping
  public ResponseEntity<SecurityEventDtos.EventResponse> create(
      @Valid @RequestBody SecurityEventDtos.CreateRequest request,
      Authentication authentication) {
    UUID userId = (UUID) authentication.getPrincipal();
    var event = events.recordClientEvent(userId, request.type());
    return ResponseEntity.status(HttpStatus.CREATED).body(event);
  }
}
