package com.cryptoconnect.web;

import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Operational probes intentionally expose status only, never database details. */
@RestController
public class HealthController {
  private final MongoTemplate mongo;

  public HealthController(MongoTemplate mongo) {
    this.mongo = mongo;
  }

  @GetMapping("/health/live")
  ResponseEntity<HealthResponse> live() {
    return ResponseEntity.ok(new HealthResponse("UP"));
  }

  @GetMapping("/health/ready")
  ResponseEntity<HealthResponse> ready() {
    try {
      mongo.getDb().runCommand(new Document("ping", 1));
      return ResponseEntity.ok(new HealthResponse("UP"));
    } catch (RuntimeException ignored) {
      // Do not expose connection details or internal exception messages.
    }
    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(new HealthResponse("DOWN"));
  }

  record HealthResponse(String status) {}
}
