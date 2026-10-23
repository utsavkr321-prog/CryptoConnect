# Local development

The current backend uses MongoDB. This guide uses only an existing MongoDB instance on a loopback interface; it does not start, reset, or seed a database. Never place a connection string or password in source control or chat.

## Backend

In a PowerShell session, set `MONGODB_URI` to the existing local database URI whose database path is `cryptoconnect_local_test`. Keep the value private. For an authenticated server, enter it using a secure method in your terminal/session manager; do not include it in a command transcript. Then launch the backend from the repository root:

```powershell
./scripts/start-local-backend.ps1
```

The script accepts only `localhost` or `127.0.0.1` and the `cryptoconnect_local_test` database, refuses an occupied port 8080, does not read `.env`, and never prints the URI. It does not start a database process. On startup the app pings MongoDB and ensures required indexes.

The default API origin is `http://127.0.0.1:8080`; authenticated WebSocket uses the matching `ws://127.0.0.1:8080/ws`. Readiness is `/health/ready`; liveness is `/health/live`.

## Login timing diagnostics

The authentication controller emits privacy-safe phase durations at DEBUG level for
user lookup, password verification, security-event persistence, token creation, and
controller total time. To enable them in a local backend session, set
`LOGGING_LEVEL_COM_CRYPTOCONNECT_AUTH_AUTHCONTROLLER=DEBUG` before starting it. The
log does not include email addresses, passwords, tokens, or user/session identifiers.
Use the browser Network panel to separately inspect login request duration and
post-login dashboard requests; do not infer backend time from dashboard loading.

## Frontend

In a separate terminal, from the repository root:

```powershell
npm run dev
```

Vite serves `http://localhost:5173`. In API mode, the frontend uses `VITE_API_URL` if provided, otherwise `http://127.0.0.1:8080`; WebSocket URL is derived from the same API origin. Demo mode remains available without a backend.

## Local database startup command

From the repository root, run `.\start-db.ps1` (or `.\scripts\start-db.ps1`) to check the
configured MongoDB Atlas endpoint or an existing local MongoDB service. This checker does not
initialize, reset, or seed a database. The local backend still requires an existing loopback
MongoDB instance and `MONGODB_URI` targeting `cryptoconnect_local_test`.

The automated MongoDB integration tests run through Testcontainers with Docker; they do not use the
manual development URI or any Atlas account.
