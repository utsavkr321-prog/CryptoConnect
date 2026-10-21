package com.cryptoconnect.user;

import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service public class FriendService {
  private final FriendRequestRepository requests; private final UserRepository users;
  public FriendService(FriendRequestRepository requests, UserRepository users) { this.requests = requests; this.users = users; }
  public FriendRequest send(UUID sender, UUID recipient) {
    if (sender.equals(recipient) || !users.existsById(recipient)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Recipient is invalid");
    var pair = pair(sender, recipient); var existing = requests.findPair(pair[0], pair[1]);
    if (existing.isPresent()) {
      FriendRequest request = existing.get();
      if (request.getStatus() == FriendRequest.Status.PENDING || request.getStatus() == FriendRequest.Status.ACCEPTED) throw new ResponseStatusException(HttpStatus.CONFLICT, "A friend request already exists");
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Create a new request only after the existing request is cleared by an explicit product policy");
    }
    try { return requests.save(new FriendRequest(sender, recipient)); } catch (DuplicateKeyException duplicate) { throw new ResponseStatusException(HttpStatus.CONFLICT, "A friend request already exists"); }
  }
  public FriendRequest decide(UUID actor, UUID id, boolean accept) {
    FriendRequest request = requests.findPairById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Friend request not found"));
    if (!request.recipientId().equals(actor)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the recipient may decide this request");
    if (request.getStatus() != FriendRequest.Status.PENDING) throw new ResponseStatusException(HttpStatus.CONFLICT, "Friend request is no longer pending");
    if (accept) request.accept(); else request.reject(); return requests.save(request);
  }
  public boolean areFriends(UUID first, UUID second) { var pair = pair(first, second); return requests.findPair(pair[0], pair[1]).map(r -> r.getStatus() == FriendRequest.Status.ACCEPTED).orElse(false); }
  private static UUID[] pair(UUID first, UUID second) { return first.toString().compareTo(second.toString()) < 0 ? new UUID[] { first, second } : new UUID[] { second, first }; }
}
