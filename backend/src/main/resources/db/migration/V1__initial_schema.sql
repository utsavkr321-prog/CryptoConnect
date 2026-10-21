create table users (
  id uuid primary key, email varchar(320) not null unique, display_name varchar(120) not null,
  password_hash varchar(255) not null, public_key text, key_fingerprint varchar(128),
  created_at timestamptz not null, updated_at timestamptz not null
);
create table conversations (id uuid primary key, created_at timestamptz not null, updated_at timestamptz not null);
create table conversation_members (conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade, last_read_at timestamptz,
  primary key (conversation_id, user_id));
create table encrypted_messages (
  id uuid primary key, conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references users(id), client_message_id varchar(100) not null,
  ciphertext text not null, iv varchar(128) not null, algorithm varchar(80) not null,
  created_at timestamptz not null, delivered_at timestamptz, read_at timestamptz,
  unique(sender_id, client_message_id));
create index idx_messages_conversation_created on encrypted_messages(conversation_id, created_at desc);
create table security_events (id uuid primary key, user_id uuid not null references users(id) on delete cascade,
  type varchar(80) not null, severity varchar(20) not null, description varchar(500) not null, created_at timestamptz not null);
