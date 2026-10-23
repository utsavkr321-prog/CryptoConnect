# CryptoConnect

CryptoConnect is a React/Vite frontend with a Spring Boot and MongoDB backend. Demo mode preserves the original local prototype. API mode provides JWT authentication, user search, contacts, dashboard/security-event data, persisted one-to-one conversations, bounded message history, unread counts, delivery/read receipts, and authenticated WebSocket transport.

## Message security model

API chat uses conventional server-readable messaging. New message text is stored by the backend and can be read by the service and authorized database operators. It is not end-to-end encrypted. Production deployments require HTTPS/WSS, encrypted database volumes and backups, and restricted storage access. Migration V7 preserves pre-existing AES-GCM envelopes as unavailable `LEGACY_ENCRYPTED` messages because their page-memory keys were never retained or exchanged.

The encryption visualizer remains an educational Web Crypto demo and is not used by API chat. Do not describe the application as end-to-end encrypted or production-ready.

## Current verification status

MongoDB is the application's active database. Backend tests include disposable MongoDB persistence/index integration coverage through Testcontainers; the release workflow also runs browser acceptance and an isolated MongoDB backup/restore check. CI never uses Atlas credentials or production data. Historical SQL migration files remain archival only and are not run by the application.

## Three simple startup commands

CryptoConnect can be started with three simple commands, one per PowerShell terminal:

1. **Terminal 1 — Database Check / Service:**
   ```powershell
   .\start-db.ps1
   ```
   Checks MongoDB Atlas connectivity or local MongoDB service. (MongoDB Atlas is a cloud database and requires no local process).

2. **Terminal 2 — Backend (Spring Boot + Java 21):**
   ```powershell
   .\start-backend.ps1
   ```
   Safely loads runtime configuration from `.env`, validates connection parameters, and starts Spring Boot at `http://127.0.0.1:8080`.

3. **Terminal 3 — Frontend (React + Vite):**
   ```powershell
   .\start-frontend.ps1
   ```
   Verifies backend readiness at `/health/ready` and launches the Vite dev server at `http://localhost:5173`.

To stop any component safely, switch to its terminal and press `Ctrl+C`.

## Local test database workflow

To run the backend tests, use `mvn test` from `backend/`; the MongoDB integration tests require Docker and start their own disposable MongoDB Testcontainer. To run the backend manually, configure `MONGODB_URI` targeting `cryptoconnect_local_test` and run `scripts/start-local-backend.ps1`. It refuses non-loopback hosts and preserves safety guards.

See the [features and security guide](./docs/FEATURES_AND_SECURITY_GUIDE.md), [staging deployment preparation](./docs/STAGING_DEPLOYMENT.md), [cryptography](./docs/CRYPTOGRAPHY.md), [architecture](./docs/ARCHITECTURE.md), [API documentation](./docs/API_DOCUMENTATION.md), [implementation status](./docs/IMPLEMENTATION_STATUS.md), [testing](./docs/TESTING.md), and [known limitations](./docs/KNOWN_LIMITATIONS.md).

The backend exposes `/health/live` for process liveness and `/health/ready` for database-backed readiness. Both probes return status only and are intended for local/container orchestration; production deployments must still terminate TLS and restrict diagnostic access at the proxy.

## Backend configuration

`MONGODB_URI` and `JWT_SECRET` are required at backend startup. `MONGODB_DATABASE` defaults to `cryptoconnect` (or `cryptoconnect_local_test` for isolated manual development). Staging/production must use protected runtime secret storage. MongoDB creates required indexes at startup but does not drop collections or import historical SQL data.
