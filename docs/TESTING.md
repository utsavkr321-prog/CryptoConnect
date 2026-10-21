# Testing

## Backend tests

From `backend/`, run `mvn test`. The suite includes unit/web tests and
`MongoPersistenceIntegrationTest`, which starts an isolated `mongo:7.0` Testcontainer, verifies
document persistence and case-insensitive lookup, and checks the required unique email index and
duplicate-key behavior. Docker must be available. The test supplies its own container URI and test
database and cannot connect to MongoDB Atlas or another external URI. CI requires both MongoDB
integration tests to execute and fails on any skipped test.

The frontend type check and production bundle are verified with `npm.cmd run build` on Windows
PowerShell.

## Release workflow database and browser checks

The release workflow uses a separate disposable MongoDB container for the actual staging Compose
model, two-profile browser acceptance, and an application-level backup/restore check. The MongoDB
container is private to the run's Docker network, is not published to the host, and is discarded
afterward. Restore verification runs the application against a distinct restored database and
checks both logins, existing conversation history, and a new persisted message. No Atlas secret is
configured in CI.

A passing test suite and frontend build do not prove Atlas connectivity, managed-backup retention,
TLS/WSS proxy behavior, encryption at rest, or production readiness.
