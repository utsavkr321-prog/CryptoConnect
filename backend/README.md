# CryptoConnect backend

Spring Boot 3.5 backend targeting Java 21, MongoDB, Spring Security, JWT, and an authenticated WebSocket protocol.

## Configuration

Set `MONGODB_URI` and `JWT_SECRET` through protected process/runtime configuration. Set `MONGODB_DATABASE` when the database name should differ from `cryptoconnect`. Connection strings are never included in application-generated configuration errors. At startup the application pings MongoDB and ensures required indexes; it never drops collections or imports PostgreSQL data.

For local development, configure `MONGODB_URI` in the current PowerShell process to an existing loopback MongoDB test database named `cryptoconnect_local_test`, then run `scripts/start-local-backend.ps1` from the repository root. That script rejects non-loopback hosts, does not load `.env`, and does not print the URI. It does not start a database service.

For other environments, launch the packaged application with the protected runtime configuration already injected:

```powershell
java -jar target/cryptoconnect-backend-0.1.0.jar
```

## Data model notes

MongoDB documents replace the former JPA entities. Unique indexes enforce normalized email, contact pairs, canonical conversation pairs, and message idempotency. Conversation participant IDs are authoritative for authorization; member and read-marker documents are query projections. Revoked token documents use a TTL index. Cross-document operations are not transactional; the application uses idempotency keys and treats the conversation document as authoritative.

The files under `src/main/resources/db/migration` are retained as historical PostgreSQL artifacts and are not executed. No automatic PostgreSQL-to-MongoDB data migration is provided. Existing SQL data must not be assumed present in MongoDB.

## Verification

`mvn test` runs unit and web-slice tests without contacting MongoDB. Live MongoDB integration, database data review, Atlas connectivity, browser acceptance, production deployment, backups, and TLS/WSS verification remain separate gates. Health endpoints are `/health/live` and `/health/ready`; readiness pings the configured database and exposes status only.
