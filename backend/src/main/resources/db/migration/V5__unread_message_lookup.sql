-- Keep per-conversation unread-count and read updates efficient without indexing read rows.
create index idx_messages_unread_by_conversation
  on encrypted_messages(conversation_id, sender_id)
  where read_at is null;
