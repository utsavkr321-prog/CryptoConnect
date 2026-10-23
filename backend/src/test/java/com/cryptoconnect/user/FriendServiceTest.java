package com.cryptoconnect.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FriendServiceTest {

  @Mock FriendRequestRepository requests;
  @Mock UserRepository users;
  @Mock ContactRepository contacts;
  @InjectMocks FriendService service;

  private final UUID alice = UUID.fromString("01800000-0000-0000-0000-000000000001");
  private final UUID bob   = UUID.fromString("81800000-0000-0000-0000-000000000001");

  // ─── send ─────────────────────────────────────────────────────────────────

  @Test void sendPersistsNewRequest() {
    when(users.existsById(bob)).thenReturn(true);
    when(requests.findPair(any(), any())).thenReturn(Optional.empty());
    FriendRequest saved = new FriendRequest(alice, bob);
    when(requests.save(any())).thenReturn(saved);

    FriendRequest result = service.send(alice, bob);

    assertNotNull(result);
    verify(requests).save(any(FriendRequest.class));
  }

  @Test void selfRequestIsRejected() {
    assertThrows(ResponseStatusException.class, () -> service.send(alice, alice));
    verifyNoInteractions(requests);
  }

  @Test void requestToUnknownUserIsRejected() {
    when(users.existsById(bob)).thenReturn(false);
    assertThrows(ResponseStatusException.class, () -> service.send(alice, bob));
    verify(requests, never()).save(any());
  }

  @Test void duplicatePendingRequestIsRejected() {
    when(users.existsById(bob)).thenReturn(true);
    FriendRequest existing = new FriendRequest(alice, bob); // status = PENDING
    UUID[] pair = canonicalPair(alice, bob);
    when(requests.findPair(pair[0], pair[1])).thenReturn(Optional.of(existing));

    assertThrows(ResponseStatusException.class, () -> service.send(alice, bob));
    verify(requests, never()).save(any());
  }

  @Test void duplicateAcceptedRequestIsRejected() {
    when(users.existsById(bob)).thenReturn(true);
    FriendRequest existing = new FriendRequest(alice, bob);
    existing.accept();
    UUID[] pair = canonicalPair(alice, bob);
    when(requests.findPair(pair[0], pair[1])).thenReturn(Optional.of(existing));

    assertThrows(ResponseStatusException.class, () -> service.send(alice, bob));
    verify(requests, never()).save(any());
  }

  // ─── decide ───────────────────────────────────────────────────────────────

  @Test void recipientCanAcceptPendingRequest() {
    FriendRequest pending = new FriendRequest(alice, bob); // alice sent to bob
    when(requests.findPairById(pending.getId())).thenReturn(Optional.of(pending));
    when(requests.save(any())).thenAnswer(inv -> inv.getArgument(0));

    FriendRequest result = service.decide(bob, pending.getId(), true);

    assertEquals(FriendRequest.Status.ACCEPTED, result.getStatus());
    verify(contacts).save(argThat(contact ->
        contact.getOwnerId().equals(alice) && contact.getContactId().equals(bob)));
    verify(contacts).save(argThat(contact ->
        contact.getOwnerId().equals(bob) && contact.getContactId().equals(alice)));
  }

  @Test void recipientCanRejectPendingRequest() {
    FriendRequest pending = new FriendRequest(alice, bob);
    when(requests.findPairById(pending.getId())).thenReturn(Optional.of(pending));
    when(requests.save(any())).thenAnswer(inv -> inv.getArgument(0));

    FriendRequest result = service.decide(bob, pending.getId(), false);

    assertEquals(FriendRequest.Status.REJECTED, result.getStatus());
    verifyNoInteractions(contacts);
  }

  @Test void senderCannotAcceptOwnRequest() {
    FriendRequest pending = new FriendRequest(alice, bob);
    when(requests.findPairById(pending.getId())).thenReturn(Optional.of(pending));

    // alice is the sender, not the recipient — must be forbidden
    assertThrows(ResponseStatusException.class, () -> service.decide(alice, pending.getId(), true));
    verify(requests, never()).save(any());
  }

  @Test void thirdPartyCannotDecideRequest() {
    UUID charlie = UUID.randomUUID();
    FriendRequest pending = new FriendRequest(alice, bob);
    when(requests.findPairById(pending.getId())).thenReturn(Optional.of(pending));

    assertThrows(ResponseStatusException.class, () -> service.decide(charlie, pending.getId(), true));
    verify(requests, never()).save(any());
  }

  @Test void acceptingAlreadyAcceptedRequestIsRejected() {
    FriendRequest accepted = new FriendRequest(alice, bob);
    accepted.accept();
    when(requests.findPairById(accepted.getId())).thenReturn(Optional.of(accepted));

    assertThrows(ResponseStatusException.class, () -> service.decide(bob, accepted.getId(), true));
    verify(requests, never()).save(any());
  }

  @Test void decidingNonExistentRequestIsNotFound() {
    UUID missingId = UUID.randomUUID();
    when(requests.findPairById(missingId)).thenReturn(Optional.empty());
    assertThrows(ResponseStatusException.class, () -> service.decide(bob, missingId, true));
  }

  // ─── areFriends ───────────────────────────────────────────────────────────

  @Test void areFriendsReturnsTrueForAcceptedRequest() {
    FriendRequest accepted = new FriendRequest(alice, bob);
    accepted.accept();
    UUID[] pair = canonicalPair(alice, bob);
    when(requests.findPair(pair[0], pair[1])).thenReturn(Optional.of(accepted));

    assertTrue(service.areFriends(alice, bob));
    assertTrue(service.areFriends(bob, alice)); // symmetric
  }

  @Test void areFriendsReturnsFalseForPendingRequest() {
    FriendRequest pending = new FriendRequest(alice, bob);
    UUID[] pair = canonicalPair(alice, bob);
    when(requests.findPair(pair[0], pair[1])).thenReturn(Optional.of(pending));

    assertFalse(service.areFriends(alice, bob));
  }

  @Test void areFriendsReturnsFalseWhenNoRequestExists() {
    when(requests.findPair(any(), any())).thenReturn(Optional.empty());
    assertFalse(service.areFriends(alice, bob));
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private static UUID[] canonicalPair(UUID first, UUID second) {
    return first.toString().compareTo(second.toString()) < 0
        ? new UUID[]{first, second}
        : new UUID[]{second, first};
  }
}
