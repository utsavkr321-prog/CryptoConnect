package com.cryptoconnect.user;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Presence is intentionally limited to accepted friends; directory users cannot be observed. */
@RestController
@RequestMapping("/api/presence")
public class PresenceController {
  private final PresenceRegistry presence;
  private final FriendService friends;

  public PresenceController(PresenceRegistry presence, FriendService friends) { this.presence = presence; this.friends = friends; }

  @GetMapping
  public List<PresenceResponse> status(@RequestParam(name = "userId") List<UUID> userIds, Authentication authentication) {
    if (userIds.isEmpty() || userIds.size() > 50) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Provide between 1 and 50 users");
    UUID viewer = (UUID) authentication.getPrincipal();
    if (userIds.stream().anyMatch(id -> id.equals(viewer) || !friends.areFriends(viewer, id))) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Presence is limited to accepted friends");
    }
    return userIds.stream().distinct().map(id -> new PresenceResponse(id, presence.isOnline(id))).toList();
  }

  public record PresenceResponse(UUID userId, boolean online) {}
}
