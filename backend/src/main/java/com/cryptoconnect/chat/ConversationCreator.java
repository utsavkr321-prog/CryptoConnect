package com.cryptoconnect.chat;

import java.util.UUID;
import org.springframework.stereotype.Service;

/** The conversation document is authoritative for its embedded participant references. */
@Service
public class ConversationCreator {
  private final ConversationRepository conversations;
  private final MemberRepository members;

  public ConversationCreator(ConversationRepository conversations, MemberRepository members) {
    this.conversations = conversations;
    this.members = members;
  }

  public Conversation create(UUID firstParticipant, UUID secondParticipant) {
    Conversation conversation = conversations.save(Conversation.create(firstParticipant, secondParticipant));
    // Memberships are a query/read-marker projection. Authorization uses participant IDs on the conversation.
    members.save(new ConversationMember(conversation.getId(), firstParticipant));
    members.save(new ConversationMember(conversation.getId(), secondParticipant));
    return conversation;
  }
}
