# CryptoConnect implementation status

Architecture update: 2026-10-19. API chat now follows the selected conventional server-readable message model. New messages are plain text in PostgreSQL, delivered through authorized REST and WebSocket paths, and rendered as text in the browser. This is **not end-to-end encryption**. The service and database can read the content.

Migration V7 renames `encrypted_messages` to `messages`, renames the previous envelope fields to `legacy_ciphertext`, `legacy_iv` and `legacy_algorithm`, and adds `message_format` plus `content`. Existing rows remain intact as `LEGACY_ENCRYPTED` with null content. Their page-memory-only keys are unavailable, so the UI marks them unrecoverable; the API does not return legacy ciphertext as readable content. New rows use `TEXT` and store content in the `content` field.

Message input is limited to 4,000 characters and rejected when blank or oversized. REST and WebSocket sends share the same membership checks, transactional persistence and client-ID idempotency path. Existing delivery acknowledgements, read receipts, unread counts and pagination continue to operate over the renamed table. The React UI labels API messages server-readable, uses TLS-required production API builds, and renders user content as text.

The educational AES-GCM visualizer and Security Lab are separate from API chat. No E2EE implementation or independent security audit is claimed.

## Verification status

See [the Option B implementation gate report](./RELEASE_GATE_2026-10-19_OPTION_B.md) for exact test commands and results from this implementation. The earlier dated reports [2026-10-19](./RELEASE_GATE_2026-10-19.md) and [2026-10-18](./RELEASE_GATE_2026-10-18.md) are preserved historical evidence and describe the previous ciphertext-only schema.

The backend PostgreSQL integration test remains opt-in with `RUN_POSTGRES_INTEGRATION=true` and requires a fresh disposable database. PostgreSQL 16 compatibility, actual Compose startup, browser acceptance, application-level backup/restore, real proxy HTTPS/WSS, and encrypted storage at rest remain unverified until tested on an authorized isolated deployment environment.

## Operational storage boundary

Production must terminate REST and WebSocket traffic with TLS, encrypt PostgreSQL database volumes and backups at rest using the host or managed database platform, restrict database/backup access, and apply documented retention and deletion procedures. The application does not encrypt database files itself. See [cryptography boundary](./CRYPTOGRAPHY.md), [known limitations](./KNOWN_LIMITATIONS.md) and [staging deployment](./STAGING_DEPLOYMENT.md).