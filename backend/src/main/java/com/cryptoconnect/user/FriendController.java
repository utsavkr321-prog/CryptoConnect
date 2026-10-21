package com.cryptoconnect.user;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController @RequestMapping("/api/friend-requests") public class FriendController {
  private final FriendService friends; private final FriendRequestRepository requests; private final UserRepository users;
  public FriendController(FriendService friends, FriendRequestRepository requests, UserRepository users) { this.friends = friends; this.requests = requests; this.users = users; }
  @PostMapping public ResponseEntity<Response> send(@RequestBody SendRequest body, Authentication auth) { return ResponseEntity.status(HttpStatus.CREATED).body(response(friends.send(id(auth), body.recipientId()), id(auth))); }
  @GetMapping("/incoming") public List<Response> incoming(Authentication auth) { UUID me=id(auth); return requests.incoming(me).stream().map(r -> response(r, me)).toList(); }
  @GetMapping("/outgoing") public List<Response> outgoing(Authentication auth) { UUID me=id(auth); return requests.outgoing(me).stream().map(r -> response(r, me)).toList(); }
  @PostMapping("/{requestId}/accept") public Response accept(@PathVariable UUID requestId, Authentication auth) { UUID me=id(auth); return response(friends.decide(me, requestId, true), me); }
  @PostMapping("/{requestId}/reject") public Response reject(@PathVariable UUID requestId, Authentication auth) { UUID me=id(auth); return response(friends.decide(me, requestId, false), me); }
  private Response response(FriendRequest r, UUID viewer) { UUID other = r.getParticipantLowId().equals(viewer) ? r.getParticipantHighId() : r.getParticipantLowId(); User u = users.findById(other).orElseThrow(); return new Response(r.getId(), other, u.getDisplayName(), r.getStatus().name(), r.getRequestedById().equals(viewer), r.getUpdatedAt()); }
  private static UUID id(Authentication auth) { return (UUID) auth.getPrincipal(); }
  public record SendRequest(@NotNull UUID recipientId) {}
  public record Response(UUID id, UUID userId, String name, String status, boolean outgoing, Instant updatedAt) {}
}
