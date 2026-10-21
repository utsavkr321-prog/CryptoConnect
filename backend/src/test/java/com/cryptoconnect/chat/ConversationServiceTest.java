package com.cryptoconnect.chat;

import com.cryptoconnect.user.UserRepository;
import com.cryptoconnect.user.FriendService;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConversationServiceTest {
  @Mock ConversationRepository conversations;
  @Mock UserRepository users;
  @Mock ConversationCreator creator;
  @Mock FriendService friends;
  @InjectMocks ConversationService service;

  private final UUID alice = UUID.fromString("01800000-0000-0000-0000-000000000001");
  private final UUID bob = UUID.fromString("81800000-0000-0000-0000-000000000001");

  @Test void createsNewConversationWithCanonicalParticipantOrder() {
    UUID low = alice.toString().compareTo(bob.toString()) < 0 ? alice : bob;
    UUID high = low.equals(alice) ? bob : alice;
    Conversation created = Conversation.create(low, high);
    when(users.existsById(bob)).thenReturn(true);
    when(conversations.findByParticipantLowIdAndParticipantHighId(low, high)).thenReturn(Optional.empty());
    when(friends.areFriends(alice, bob)).thenReturn(true);
    when(creator.create(low, high)).thenReturn(created);

    ConversationService.OpenResult result = service.openOrCreate(alice, bob);

    assertTrue(result.created());
    assertSame(created, result.conversation());
    verify(creator).create(low, high);
  }

  @Test void reverseParticipantOrderFindsTheSameExistingConversation() {
    UUID low = alice.toString().compareTo(bob.toString()) < 0 ? alice : bob;
    UUID high = low.equals(alice) ? bob : alice;
    Conversation existing = Conversation.create(low, high);
    when(users.existsById(alice)).thenReturn(true);
    when(conversations.findByParticipantLowIdAndParticipantHighId(low, high)).thenReturn(Optional.of(existing));

    ConversationService.OpenResult result = service.openOrCreate(bob, alice);

    assertFalse(result.created());
    assertSame(existing, result.conversation());
    verifyNoInteractions(creator);
  }

  @Test void uniquenessConflictReturnsConversationCreatedByConcurrentRequest() {
    UUID low = alice.toString().compareTo(bob.toString()) < 0 ? alice : bob;
    UUID high = low.equals(alice) ? bob : alice;
    Conversation concurrentlyCreated = Conversation.create(low, high);
    when(users.existsById(bob)).thenReturn(true);
    when(conversations.findByParticipantLowIdAndParticipantHighId(low, high))
        .thenReturn(Optional.empty(), Optional.of(concurrentlyCreated));
    when(friends.areFriends(alice, bob)).thenReturn(true);
    when(creator.create(low, high)).thenThrow(new DuplicateKeyException("unique pair"));

    ConversationService.OpenResult result = service.openOrCreate(alice, bob);

    assertFalse(result.created());
    assertSame(concurrentlyCreated, result.conversation());
  }

  @Test void selfConversationIsRejectedBeforeLookupOrCreation() {
    assertThrows(ResponseStatusException.class, () -> service.openOrCreate(alice, alice));
    verifyNoInteractions(conversations, users, creator);
  }

  @Test void unregisteredRecipientIsRejected() {
    when(users.existsById(bob)).thenReturn(false);
    assertThrows(ResponseStatusException.class, () -> service.openOrCreate(alice, bob));
    verifyNoInteractions(conversations, creator);
  }

  @Test void pendingFriendRequestBlocksNewConversationCreation() {
    UUID low = alice.toString().compareTo(bob.toString()) < 0 ? alice : bob;
    UUID high = low.equals(alice) ? bob : alice;
    when(users.existsById(bob)).thenReturn(true);
    when(conversations.findByParticipantLowIdAndParticipantHighId(low, high)).thenReturn(Optional.empty());
    when(friends.areFriends(alice, bob)).thenReturn(false); // pending or rejected

    assertThrows(ResponseStatusException.class, () -> service.openOrCreate(alice, bob));
    verifyNoInteractions(creator);
  }

  @Test void existingGrandfatheredConversationIsReturnedWithoutFriendshipCheck() {
    // Existing conversations are grandfathered: if the conversation already exists in the
    // database, it can be reopened regardless of the current friend-request state. Only
    // the *creation* of a new conversation requires an accepted request.
    UUID low = alice.toString().compareTo(bob.toString()) < 0 ? alice : bob;
    UUID high = low.equals(alice) ? bob : alice;
    Conversation existing = Conversation.create(low, high);
    when(users.existsById(bob)).thenReturn(true);
    when(conversations.findByParticipantLowIdAndParticipantHighId(low, high)).thenReturn(Optional.of(existing));

    ConversationService.OpenResult result = service.openOrCreate(alice, bob);

    assertFalse(result.created());
    assertSame(existing, result.conversation());
    verifyNoInteractions(creator);
    // areFriends must NOT be consulted for existing conversations
    verifyNoInteractions(friends);
  }
}
