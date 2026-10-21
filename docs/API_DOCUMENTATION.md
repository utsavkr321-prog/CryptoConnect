# API documentation

Protected requests use `Authorization: Bearer <JWT>`. The backend derives sender identity from the authenticated principal. Use HTTPS for REST and WSS for `/ws` outside local development. Never place JWTs in URLs or logs. Set `CORS_ORIGIN` to the exact frontend origin.

## Message architecture

API chat uses conventional server-readable messaging, not end-to-end encryption. New message content is sent over TLS, validated by the backend, persisted as text, and returned only to authorized conversation members. Production deployments must verify HTTPS/WSS, encrypted database volumes and backups, and restricted database access. The service/database can read message content.

V7 renames the original `encrypted_messages` table to `messages`. Existing rows remain `LEGACY_ENCRYPTED` with their original envelope stored in legacy columns; because their page-memory keys were never exchanged or saved, the backend cannot recover their text. History returns `format: LEGACY_ENCRYPTED` and `content: null` and does not expose the legacy ciphertext. New rows have `format: TEXT` and a readable `content` value.

## Operational health probes

`GET /health/live` is an unauthenticated liveness probe and returns `200 {"status":"UP"}` when the process is responsive. `GET /health/ready` checks a database connection and returns `200 {"status":"UP"}` or a sanitized `503 {"status":"DOWN"}`. Do not expose diagnostic endpoints through a public proxy.

## REST endpoints

| Method | Path | Behavior |
|---|---|---|
| POST | `/api/auth/register` | Validates and hashes credentials; does not accept key material. |
| POST | `/api/auth/login` | Returns a JWT and account identity. |
| GET | `/api/auth/me` | Restores the authenticated session. |
| POST | `/api/auth/logout` | Revokes the presented JWT ID in MongoDB and returns 204. |
| PATCH | `/api/auth/me` | Changes only the authenticated user's display name. |
| GET | `/api/dashboard/stats` | Returns conversation, sent, stored and unread message counts for the caller. |
| GET | `/api/dashboard/activity?days=7` | Returns daily message counts for 1-30 days. |
| GET | `/api/security-events` | Returns up to 100 recent events for the caller. |
| POST | `/api/security-events` | Accepts allowlisted educational demo event types; server assigns safe descriptions. |
| GET | `/api/users?query=` | Searches registered users; excludes the caller. |
| GET/POST | `/api/contacts` | Lists or creates a caller-owned contact relationship. |
| DELETE | `/api/contacts/{contactId}` | Removes only the caller's relationship. |
| POST | `/api/conversations` | Opens or creates a one-to-one conversation for `recipientId`. |
| GET | `/api/conversations` | Lists the caller's one-to-one conversations and unread counts. |
| GET | `/api/conversations/{id}/messages` | Returns up to 50 authorized messages; `?before=<ISO-8601 instant>` pages backward. |
| POST | `/api/conversations/{id}/messages` | Persists a readable message; idempotent per sender, conversation and client ID. |
| POST | `/api/conversations/{id}/read` | Marks up to 50 loaded incoming message IDs as read. |

Send JSON `{ "clientMessageId": "<client-generated-id>", "content": "Hello" }`. The ID is bounded to 100 characters. Content must be nonblank and no longer than 4,000 characters. Missing, blank, or oversized content receives 400. The server assigns `format: TEXT`; callers cannot submit legacy ciphertext as new content. Message bodies are not written to logs or security events. React renders content as text, not HTML.

Responses contain `id`, `conversationId`, `senderId`, `clientMessageId`, `format`, `content`, `createdAt`, `deliveredAt`, and `readAt`. For legacy messages, `format` is `LEGACY_ENCRYPTED` and `content` is null; envelope columns are not returned. Persistence means server acceptance. `deliveredAt` is recorded only after a connected recipient acknowledges receipt.

## WebSocket protocol

Connect to `/ws` from the configured origin, then authenticate with `{ "type": "authenticate", "token": "<JWT>" }`; the server replies `{ "type": "ready" }`. Never put tokens in URLs. Subscribe with `{ "type": "subscribe", "conversationId": "<uuid>" }`. Send with `{ "type": "send", "conversationId": "<uuid>", "message": { "clientMessageId": "<id>", "content": "Hello" } }`. The backend applies the same validation, authorization, idempotency and persistence service as REST, commits before broadcasting a `message` event, and never trusts a frame's sender ID. Repeated IDs return the already saved message. Error frames are sanitized.

Clients send `{ "type": "heartbeat" }` every 30 seconds while connected. The server reports `{ "type": "presence", "userId": "<uuid>", "online": true|false }` only to an authenticated accepted friend. `GET /api/presence?userId=<uuid>` has the same accepted-friend check and returns only `userId` and `online`; it never returns a token, session identifier, IP address, or last-seen timestamp. Presence is process-local and expires stale WebSocket sessions after `PRESENCE_STALE_SECONDS` (90 seconds by default).

A recipient acknowledges delivery with `{ "type": "ack", "messageId": "<uuid>" }`. Opening a conversation posts the loaded IDs to `/api/conversations/{id}/read`; subscribed senders receive `read_receipt` events. On reconnect, clients authenticate, resubscribe and reload history through REST, which restores readable message content after refresh, login or backend restart. Legacy rows remain visibly unavailable.

## Other security controls

Login, registration, search, contact/security-event writes and WebSocket operations have configurable process-local rate limits. Multi-instance deployments need a trusted gateway or shared limiter. REST responses include restrictive security headers. JWT revocation is persisted in MongoDB. No device-key registration, identity verification or E2EE protocol is implemented.
