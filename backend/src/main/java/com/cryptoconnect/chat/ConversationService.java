package com.cryptoconnect.chat;

import com.cryptoconnect.user.UserRepository;
import com.cryptoconnect.user.FriendService;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ConversationService {
  private final ConversationRepository conversations;
  private final UserRepository users;
  private final ConversationCreator creator;
  private final FriendService friends;

  public ConversationService(ConversationRepository conversations, UserRepository users, ConversationCreator creator, FriendService friends) {
    this.conversations = conversations;
    this.users = users;
    this.creator = creator;
    this.friends = friends;
  }

  public OpenResult openOrCreate(UUID requesterId, UUID recipientId) {
    if (requesterId.equals(recipientId)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Recipient is invalid");
    }
    if (!users.existsById(recipientId)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Recipient is invalid");
    }

    ParticipantPair pair = ParticipantPair.of(requesterId, recipientId);
    var existing = conversations.findByParticipantLowIdAndParticipantHighId(pair.low(), pair.high());
    if (existing.isPresent()) return new OpenResult(existing.get(), false);
    if (!friends.areFriends(requesterId, recipientId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accept a friend request before starting a conversation");

    try {
      return new OpenResult(creator.create(pair.low(), pair.high()), true);
    } catch (DuplicateKeyException uniquenessConflict) {
      // The unique participant-pair index resolves concurrent opens without a relational transaction.
      return conversations.findByParticipantLowIdAndParticipantHighId(pair.low(), pair.high())
          .map(conversation -> new OpenResult(conversation, false))
          .orElseThrow(() -> uniquenessConflict);
    }
  }

  public record OpenResult(Conversation conversation, boolean created) {}

  private record ParticipantPair(UUID low, UUID high) {
    static ParticipantPair of(UUID first, UUID second) {
      return first.toString().compareTo(second.toString()) < 0
          ? new ParticipantPair(first, second)
          : new ParticipantPair(second, first);
    }
  }
}
