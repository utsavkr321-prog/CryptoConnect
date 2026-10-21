create table revoked_tokens (
  jti uuid primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index idx_revoked_tokens_expires_at on revoked_tokens(expires_at);
