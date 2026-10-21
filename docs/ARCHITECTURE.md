# CryptoConnect architecture

CryptoConnect is a React/TypeScript/Vite application with two explicit data modes:

- **API mode:** the frontend uses the Spring Boot REST API and authenticated WebSocket endpoint. MongoDB is the source of persisted data; failures are surfaced rather than hidden by mock fallback.
- **Demo mode:** local sample users, conversations, events and dashboard values are shown as illustrative data.

REST requests pass through Spring Security, JWT authentication and bounded process-local abuse limits. Controllers derive account IDs from the authenticated principal. Services enforce ownership and conversation membership. MongoDB unique and TTL indexes are ensured at startup; PostgreSQL Flyway scripts are archival and inactive.

WebSocket `/ws` authenticates with a signed JWT in the first frame, never in the URL. Each subscribe, send and acknowledgement checks membership and rate limits. REST and WebSocket sends share an idempotency key. Messages persist before broadcast; acknowledgements persist delivery and read state. MongoDB operations spanning documents are not transactional. Reconnect recovery reloads REST history.

## Message and encryption boundary

API chat uses conventional server-readable messaging. Clients send bounded text through HTTPS/WSS; the backend validates and persists that text and returns it to authorized participants. The service and database can read the content. This is **not end-to-end encryption**. Production operation requires TLS in transit and operator-provided encrypted database volumes/backups with restricted access.

Previously present PostgreSQL AES-GCM envelopes are not imported. If any are later migrated through a separately reviewed process, they remain unrecoverable because their page-memory keys were never exchanged or retained. New messages do not use the educational browser crypto utility.

The Encryption Visualizer is a separate local Web Crypto AES-256-GCM demonstration. It does not send its sample plaintext or key to API chat.

## Main modules

- `src/services/index.ts`: authenticated REST and demo adapters.
- `src/services/realtime.ts`: WebSocket authentication, reconnect, subscriptions and receipts.
- `backend/.../auth`: registration, login, session restoration and profile updates.
- `backend/.../chat`: one-to-one conversations, message history, readable message persistence, idempotency and receipts.
- `backend/.../events`: server-authored user-scoped security events.
- `backend/.../user`: user directory and caller-owned contacts.
- `backend/src/main/resources/db/migration`: retained historical PostgreSQL schema V1-V7; not executed by the current application.

The rate limiter is process-local. Development Compose is not an HTTPS/WSS deployment. API routes, WebSocket frames and test instructions are in [API documentation](./API_DOCUMENTATION.md) and [Testing](./TESTING.md).
