# MongoDB data model

MongoDB is the active persistence layer. The application maps Java documents to these collections and ensures indexes at startup without dropping collections or rewriting existing documents.

| Collection | Purpose | Important indexes |
| --- | --- | --- |
| `users` | Accounts, normalized email, BCrypt hash and profile data | Unique `email` |
| `contacts` | Caller-owned contact relationships | Unique `(ownerId, contactId)` |
| `conversations` | Authoritative canonical participant pair and activity timestamp | Unique `(participantLowId, participantHighId)` |
| `conversation_members` | Read-marker and membership query projection | Unique `(userId, conversationId)` |
| `messages` | Readable message text, idempotency key and delivery/read timestamps | Unique `(conversationId, senderId, clientMessageId)` plus history/unread indexes |
| `security_events` | Server-authored user security events | `(userId, createdAt)` |
| `revoked_tokens` | Revoked JWT IDs | TTL on `expiresAt` |

Authorization derives conversation membership from participant IDs in the conversation document. Member records are projections and can be rebuilt only through an explicitly reviewed maintenance operation. MongoDB multi-document transactions are not used; message idempotency is protected by a unique index, and the conversation document remains authoritative if a projection write fails.

The SQL files in `backend/src/main/resources/db/migration` are retained as historical PostgreSQL artifacts. Flyway is not on the runtime classpath, these scripts do not run, and no PostgreSQL-to-MongoDB data migration is implemented. Existing PostgreSQL data is not copied or modified.

Live MongoDB integration tests require a separately configured disposable local test instance. Standard unit/web tests do not contact MongoDB. Atlas connectivity and existing-data migration are not verified.
