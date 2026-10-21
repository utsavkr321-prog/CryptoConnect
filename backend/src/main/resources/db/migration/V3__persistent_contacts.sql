create table user_contacts (
  id uuid primary key,
  owner_id uuid not null references users(id) on delete cascade,
  contact_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null,
  constraint uk_user_contacts_owner_contact unique (owner_id, contact_id),
  constraint ck_user_contacts_not_self check (owner_id <> contact_id)
);

create index idx_user_contacts_owner_created on user_contacts(owner_id, created_at desc);
