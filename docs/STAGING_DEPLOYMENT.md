# Controlled staging deployment

This guide prepares a private staging environment. It does not deploy CryptoConnect, open a public port, or authorize real user data.

> **Current-stack notice (2026-10-21):** The active backend uses MongoDB, not PostgreSQL. Older
> PostgreSQL configuration, Compose, migration, and restore instructions retained below are
> historical and must not be run against this source tree. Follow only the dated
> [current stack deployment checklist](#current-stack-deployment-checklist-2026-10-21) for this
> MongoDB build. No cloud provider is configured or authorized by this document.

## Verified versus not verified

The dated [current-stack checklist](#current-stack-deployment-checklist-2026-10-21) is the applicable
deployment procedure. Earlier release-gate reports and PostgreSQL validation below are historical
records for a previous architecture; they are not evidence for current MongoDB staging readiness.

**Verified locally on 2026-10-18:** The final master audit reran 75 backend tests with 75 passed, 0 failed, 0 errors, and 0 skipped against a fresh disposable PostgreSQL 18.6 database. Migration/runtime role restrictions and V1â€“V6 were exercised. A custom-format backup restored into a separate empty PostgreSQL 18.6 database; migration history, synthetic records, ownership and runtime restrictions were checked. The frontend production build passed in API mode with a syntactically valid HTTPS example origin. Loopback real-HTTP API and real WebSocket protocol smoke checks, exact-origin CORS, token revocation, reconnect/history synchronization, and backend restart recovery passed. These are not browser UI or reverse-proxy tests. The reserved example origin is not a real deployment endpoint.

**Not verified:** PostgreSQL 16 compatibility, Docker Compose semantic validation, image build, container startup, actual file-secret mounts, reverse proxy TLS/WSS, production secret rotation, deployment, external monitoring, and public exposure. Docker/Compose, Podman and nerdctl are unavailable. Chrome is installed, but the isolated CDP probe exits on a GPU-process fatal and no browser automation framework is installed, so browser UI acceptance remains blocked. The initializer shell syntax passed in Git Bash; an actual fresh-cluster run was blocked by Windows `initdb` restricted-token errors. The staging configuration is prepared for review, not deployed or production-ready.

## Runtime configuration

### Backend

Required application properties:

| Variable | Staging value |
| --- | --- |
| `DATABASE_URL` | `jdbc:postgresql://postgres:5432/cryptoconnect_staging` inside the Compose network. For a separately hosted DB, use its private TLS-capable endpoint and JDBC parameters supplied by its operator. |
| `DATABASE_USERNAME` | Fixed staging runtime role `cryptoconnect_app`. It has no schema DDL privilege. |
| `DATABASE_PASSWORD` | Read from the mounted staging secret file by the Compose entrypoint. It must be the password for `DATABASE_USERNAME`. |
| `SPRING_FLYWAY_USER` / `SPRING_FLYWAY_PASSWORD` | Fixed migration role `cryptoconnect_migrator`; its password is read from a separate secret file. Spring Boot uses Flywayâ€™s dedicated datasource when Flyway URL/user/password are configured. |
| `JWT_SECRET` | A distinct random secret of at least 32 characters, read from its mounted staging secret file. Never reuse development or production keys. |
| `CORS_ORIGIN` | Exactly the browser frontend origin, e.g. `https://chat.staging.example.net`; include scheme and port if non-default, no path or trailing slash. |

Optional settings supported by the application include `JWT_EXPIRATION_MINUTES` (default `60`), `PORT` (default `8080`), `RATE_LIMIT_AUTHENTICATION_PER_MINUTE` (`20`), `RATE_LIMIT_REGISTRATION_PER_HOUR` (`10`), `RATE_LIMIT_SEARCH_PER_MINUTE` (`60`) and `RATE_LIMIT_WRITES_PER_MINUTE` (`30`). Rate limits are per process, so use a shared gateway/WAF limiter before running multiple backend replicas.

The staging Compose file also sets `SERVER_SHUTDOWN=graceful`, `SPRING_LIFECYCLE_TIMEOUT_PER_SHUTDOWN_PHASE=30s`, and `SERVER_FORWARD_HEADERS_STRATEGY=framework`. Only a trusted reverse proxy may reach the backend network. The proxy must remove client-supplied `Forwarded` and `X-Forwarded-*` headers and set trusted values itself.

### PostgreSQL and database role

`docker-compose.staging.yml` uses a separate `cryptoconnect_staging_pgdata` volume, PostgreSQL 16, no host-published database port, and a private internal database network. It creates the database with a bootstrap administrator and runs `ops/postgres-init/10-create-app-role.sh` only when the volume is initialized for the first time. The initializer creates separate `cryptoconnect_migrator` and `cryptoconnect_app` logins; neither is a superuser, database creator, role creator, replication role, or RLS bypass role. It rejects pre-existing memberships, synchronizes each role password from its secret file on repeat execution, and applies grants idempotently. Password values are passed to `psql` through its environment and quoted as SQL literals; the password-update session disables standard statement and duration logging.

Flyway uses the migration login, which has `USAGE, CREATE` on the staging `public` schema. The application login has `USAGE` only. An `afterMigrate.sql` callback grants it DML on application tables and sequence use, while restricting `flyway_schema_history` to read-only access. Default privileges cover tables and sequences created by future migrations. The integration suite must verify this split against the actual configured roles before staging. Do not point staging at development or production data.

The PostgreSQL bootstrap password is used only by the database container. The backend receives neither the bootstrap role nor its password. Local Compose secret files are read-only mounts, not an encrypted remote secret manager; protect their host filesystem permissions and restrict Docker administrator access.

## Secrets and non-secret Compose settings

Generate four distinct 32-byte random values and store them in separate files outside the repository: PostgreSQL bootstrap password, application runtime password, Flyway migration password, and JWT signing secret. Use a cryptographic random generator. For example, on Linux:

```sh
secret_dir="$HOME/.config/cryptoconnect-staging"
install -d -m 700 "$secret_dir"
umask 077
openssl rand -hex 32 > "$secret_dir/postgres-bootstrap-password"
openssl rand -hex 32 > "$secret_dir/database-password"
openssl rand -hex 32 > "$secret_dir/migrator-password"
openssl rand -hex 32 > "$secret_dir/jwt-secret"
# Compose file-backed secrets are read-only bind mounts. The parent stays private;
# readable file modes let the backend's non-root UID (10001) read its two secrets.
chmod 0444 "$secret_dir"/postgres-bootstrap-password "$secret_dir"/database-password "$secret_dir"/migrator-password "$secret_dir"/jwt-secret
```

On Windows PowerShell, generate files without displaying their contents:

```powershell
$secretDirectory = Join-Path $env:LOCALAPPDATA 'CryptoConnect\staging-secrets'
New-Item -ItemType Directory -Force -Path $secretDirectory | Out-Null
function New-StagingSecretFile([string]$Path) {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $hex = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
  [IO.File]::WriteAllText($Path, $hex, [Text.Encoding]::ASCII)
  [Array]::Clear($bytes, 0, $bytes.Length)
}
New-StagingSecretFile (Join-Path $secretDirectory 'postgres-bootstrap-password')
New-StagingSecretFile (Join-Path $secretDirectory 'database-password')
New-StagingSecretFile (Join-Path $secretDirectory 'migrator-password')
New-StagingSecretFile (Join-Path $secretDirectory 'jwt-secret')
```

Protect the directory so only the staging operator and container runtime administrators can read it. Do not paste secret values into Compose YAML, the paths file below, source control, tickets, shell history, or diagnostic output.

Create a **non-secret** Compose environment file outside the repository. Substitute paths, the exact frontend origin, a unique versioned backend image tag, and the name of the private network shared with the reverse proxy. Configure the registry to reject tag overwrites or supply a verified digest through the deployment process; Compose itself does not make tags immutable:

```dotenv
STAGING_POSTGRES_BOOTSTRAP_PASSWORD_FILE=/absolute/private/path/postgres-bootstrap-password
STAGING_DATABASE_PASSWORD_FILE=/absolute/private/path/database-password
STAGING_MIGRATOR_PASSWORD_FILE=/absolute/private/path/migrator-password
STAGING_JWT_SECRET_FILE=/absolute/private/path/jwt-secret
STAGING_CORS_ORIGIN=https://chat.staging.example.net
STAGING_PROXY_NETWORK=cryptoconnect-staging-edge
STAGING_BACKEND_IMAGE=cryptoconnect-backend:staging-20261018-build01
STAGING_DATABASE_VOLUME=cryptoconnect_staging_pgdata
```

On Windows, use forward slashes in absolute file paths for Compose (for example, `C:/private/staging-secrets/jwt-secret`). Keep this paths file outside the repository too; it contains deployment topology even though it contains no secret values.

## Frontend API and WebSocket URLs

Vite embeds `VITE_APP_MODE` and `VITE_API_URL` into the static build at build time. Set `VITE_APP_MODE=api`. Set `VITE_API_URL` to the public HTTPS API origin (or the shared frontend/API origin if the proxy routes both). For example, `https://api.staging.example.net`.

For API-mode builds, `vite.config.ts` fails the build if the API origin is missing, malformed, non-HTTPS, localhost, or under `.invalid`. This guards against shipping a production API bundle pointing to the development fallback or the reserved `.invalid` placeholder; it does not prove that the chosen hostname resolves or that the API is reachable.

`src/services/realtime.ts` replaces `https:` with `wss:` and appends `/ws`; `http:` becomes `ws:` for development. The browser therefore connects to `wss://api.staging.example.net/ws` in HTTPS staging. Configure the proxy for WebSocket Upgrade/Connection forwarding on `/ws`, and preserve the long-lived upgraded connection. The same origin configured in `CORS_ORIGIN` is checked for both HTTP CORS and WebSocket handshakes.

Build the static files with the actual staging API origin; this is not a runtime setting:

```powershell
$env:VITE_APP_MODE = 'api'
$env:VITE_API_URL = 'https://api.staging.example.net'
npm.cmd ci
npm.cmd run build
Remove-Item Env:VITE_APP_MODE, Env:VITE_API_URL
```

Serve `dist/` only over HTTPS. Do not put database or JWT secrets in any `VITE_*` variable; Vite variables are public browser bundle content. A different frontend/API origin requires the backend `CORS_ORIGIN` to exactly match the frontend origin.

## Prepare and start staging

1. Provision an isolated staging host and an HTTPS reverse proxy. Ensure only the proxy can join the private edge network; publish only the proxyâ€™s HTTPS listener. The staging frontend origin must resolve to this proxy/static host.
2. Generate the four secret files above and create the non-secret paths file. Use test accounts and synthetic data only.
3. Build and test the backend on a disposable PostgreSQL database (the repository integration test uses Flyway). The backend Dockerfile expects `backend/target/cryptoconnect-backend-0.1.0.jar`:

   ```powershell
   cd backend
   mvnd.cmd -q package
   cd ..
   ```

   `package` runs the configured backend test lifecycle. For the PostgreSQL integration test, provision a fresh disposable database with separate `cryptoconnect_app` and `cryptoconnect_migrator` logins. Set `RUN_POSTGRES_INTEGRATION=true`, `DATABASE_URL`, `DATABASE_USERNAME=cryptoconnect_app`, `DATABASE_PASSWORD`, `SPRING_FLYWAY_URL` (same disposable database URL), `SPRING_FLYWAY_USER=cryptoconnect_migrator`, `SPRING_FLYWAY_PASSWORD`, and a random test-only `JWT_SECRET` before the command. Do not point it at the development or staging database. Dependency resolution may require approved Maven Central network access.

4. Create the private edge network and validate Compose configuration without starting services:

   ```sh
   docker network create cryptoconnect-staging-edge
   docker compose --env-file /absolute/private/path/compose.env -f docker-compose.staging.yml -p cryptoconnect-staging config --quiet
   ```

   Ensure `STAGING_PROXY_NETWORK` names that network and configure the reverse proxy to join it. Compose has no `ports:` entries for backend or PostgreSQL; backend `8080` is exposed only to services on its Compose networks, and PostgreSQL is only on the internal database network.

5. Start the isolated database and backend:

   ```sh
   docker compose --env-file /absolute/private/path/compose.env -f docker-compose.staging.yml -p cryptoconnect-staging up --build -d
   docker compose --env-file /absolute/private/path/compose.env -f docker-compose.staging.yml -p cryptoconnect-staging ps
   ```

   Wait for PostgreSQL and backend to report healthy before attaching the proxy route. Flyway applies pending migrations automatically before readiness succeeds. Never publish PostgreSQLâ€™s port. Do not expose backend health paths through the public proxy.

6. Configure TLS at the reverse proxy: redirect HTTP to HTTPS, use a valid certificate and modern TLS configuration, route ordinary API traffic to `backend:8080`, and route `/ws` with WebSocket upgrade support. Restrict external access to `/health/live` and `/health/ready`; monitor them on the private network. Set/overwrite trusted forwarded headers at the proxy. Do not trust forwarded headers from arbitrary clients.

7. Smoke-test synthetic registration/login, authenticated `/api/auth/me`, CORS from the configured browser origin, and a two-account WSS exchange. In a private monitor, `GET /health/live` should return `200 {"status":"UP"}` while the process runs; `GET /health/ready` should return `200 {"status":"UP"}` only when the database accepts a valid connection and `503 {"status":"DOWN"}` otherwise. Health responses suppress database details.

## Migrations, shutdown and rollback

Flyway runs automatically during each backend startup; Hibernate uses `ddl-auto: validate` and does not create/repair schema. Take and verify a database backup before upgrading. Deploy one backend instance during a migration rollout; confirm readiness before shifting traffic. If migration fails, keep the database intact, preserve sanitized logs and inspect Flyway history/schema before retry. Do not delete rows or volumes to make a migration pass.

Migrations are forward-only in this project. A failed transactional PostgreSQL migration should leave its changes unapplied, but there is no general down-migration mechanism. If the new application fails after a successful migration, roll back only to a previously built image known to be compatible with the migrated schema. Otherwise restore a verified backup into a **new isolated volume/database**, validate it, then point the deployment at it. Do not restore over the active database or reuse the development volume. Prefer a tested forward fix when a migration is already committed/applied.

The Compose backend is configured for Spring graceful shutdown and a 40-second container stop grace period. Drain proxy traffic, then stop without deleting the persistent volume:

```sh
docker compose --env-file /absolute/private/path/compose.env -f docker-compose.staging.yml -p cryptoconnect-staging stop
```

To roll back the app artifact, set `STAGING_BACKEND_IMAGE` in the private paths file to the previous immutable image tag, then run `docker compose ... up -d --no-deps backend` with the same Compose arguments. Rebuild/restore the matching static frontend artifact too. This does not roll back database migrations.

## Backup and restore drill

Use a protected backup destination with sufficient free space. Staging should contain synthetic data only. For a PostgreSQL custom-format dump:

```sh
umask 077
backup_file=/secure/staging-backups/cryptoconnect-staging-$(date -u +%Y%m%dT%H%M%SZ).dump
docker compose --env-file /absolute/private/path/compose.env -f docker-compose.staging.yml -p cryptoconnect-staging exec -T postgres pg_dump -U cryptoconnect_migrator -d cryptoconnect_staging -Fc > "$backup_file"
```

Verify the archive using the container's PostgreSQL tools and copy it to an independently protected backup location:

```sh
cat "$backup_file" | docker compose --env-file /absolute/private/path/compose.env -f docker-compose.staging.yml -p cryptoconnect-staging exec -T postgres pg_restore --list -
```

A restore drill must target a **new database**, never the active or development database:

```sh
docker compose --env-file /absolute/private/path/compose.env -f docker-compose.staging.yml -p cryptoconnect-staging exec -T postgres psql -U postgres -d postgres -c 'CREATE DATABASE cryptoconnect_restore_verify;'
docker compose --env-file /absolute/private/path/compose.env -f docker-compose.staging.yml -p cryptoconnect-staging exec -T postgres psql -U postgres -d cryptoconnect_restore_verify -c 'REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT CONNECT ON DATABASE cryptoconnect_restore_verify TO cryptoconnect_app, cryptoconnect_migrator; GRANT USAGE ON SCHEMA public TO cryptoconnect_app; GRANT USAGE, CREATE ON SCHEMA public TO cryptoconnect_migrator; ALTER DEFAULT PRIVILEGES FOR ROLE cryptoconnect_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cryptoconnect_app; ALTER DEFAULT PRIVILEGES FOR ROLE cryptoconnect_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO cryptoconnect_app;'
cat "$backup_file" | docker compose --env-file /absolute/private/path/compose.env -f docker-compose.staging.yml -p cryptoconnect-staging exec -T postgres pg_restore -U cryptoconnect_migrator --no-owner --no-privileges -d cryptoconnect_restore_verify -
docker compose --env-file /absolute/private/path/compose.env -f docker-compose.staging.yml -p cryptoconnect-staging exec -T postgres psql -U postgres -d cryptoconnect_restore_verify -c 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE flyway_schema_history FROM cryptoconnect_app;'
```

Verify restored migration history and application-level synthetic records before considering recovery complete. A local custom-format `pg_dump`/`pg_restore` exercise was performed on PostgreSQL 18.6 using two separate disposable databases: restore into a new empty database succeeded; six Flyway migrations, three synthetic users, one encrypted message, migrator ownership, and the runtime role's lack of schema `CREATE` and Flyway-history `INSERT` were verified. The cluster and temporary files were removed. This validates PostgreSQL tooling and role checks on 18.6 only; the Compose backup/restore commands and PostgreSQL 16 image remain untested because no compatible container runtime or PostgreSQL 16 installation is available. `docker compose down` preserves the named volume. Do not use `down -v` as routine shutdown; deleting a staging volume is destructive and must be an explicit, separately reviewed cleanup action after backup/retention requirements are satisfied.

## Safeguards and known limitations

- No public deployment or real credentials/data were used in preparation. The development database is a separate project/volume and must never be named in staging settings.
- HTTPS/WSS, HSTS policy, proxy header sanitization, public route restrictions, proxy authentication/access controls, DNS and certificates remain operator tasks and require live verification.
- Compose accepts a backend image reference string; it does not enforce immutability for tags. The example backend image uses a versioned tag, but registry policy must prevent overwrites or deployment must use a verified digest. The Compose PostgreSQL target `postgres:16-alpine` and Dockerfile base `eclipse-temurin:21-jre` are mutable tags. Docker Hub official-image metadata inspected on 2026-10-18 listed PostgreSQL alias `16.15-alpine3.24`, multi-platform index `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea`, and Linux/amd64 manifest `sha256:1a66d744c1b459e13b05a8fca341da84cb63383e99ce262210efee5a319d4551` ([PostgreSQL image metadata](https://hub.docker.com/layers/library/postgres/16-alpine/images/sha256-1a66d744c1b459e13b05a8fca341da84cb63383e99ce262210efee5a319d4551)). Temurin alias `21.0.10_7-jre` listed index `sha256:8cef5fc7bebe421363ab543a2f4db5caf7d119d8db67d56b0f56c485d2de4d55` ([Temurin image metadata](https://hub.docker.com/layers/library/eclipse-temurin/21-jre/images/sha256-a859c53890e73417507a5fe51e1d7605fd9fc077450239fd1f4ae2856ef7f017)). These are time-sensitive registry observations, not a container pull/build or provenance verification. No digest is pinned because the target architecture is unspecified and no compatible runtime is available. Before rollout, resolve publisher, version, platform-specific digest and provenance for the actual target architecture, then pin that immutable digest in the deployment process. Recheck for security updates on a scheduled basis, review release notes and vulnerability data, update the pin, rebuild, and rerun the staging gates before promotion.
- `/health/live` and `/health/ready` are unauthenticated status-only endpoints. Keep them private at the proxy; readiness reveals service/database up/down state.
- JWT logout revocation is stored in PostgreSQL, so database availability is needed for revocation checks. REST checks reject revoked tokens; an already-open WebSocket is revalidated on its next operation or delivery check. Changing `JWT_SECRET` invalidates all outstanding tokens; coordinate secret rotation and reauthentication. Rotate the database application password in PostgreSQL and its secret file together; the init script runs only on an empty volume. Rotate the bootstrap password separately and keep it restricted to DB administration.
- Application rate limits are in process memory. A multi-replica staging setup needs a shared edge limit and must not rely on backend counters as a global limit.
- Application exception responses and health responses do not return internal exception text. The application has no custom request/body logger. Review proxy/container logging and redact authorization headers, cookies, secret paths and user message payloads before enabling or sharing logs.
- API chat is server-readable and is not E2EE. New messages are stored as text; production must use HTTPS/WSS and verify encrypted database storage. See the current V7 storage requirements below.

See [TESTING.md](./TESTING.md), [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md), and [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for verification status.

## Server-readable messaging storage requirement

Since V7, API chat stores new message bodies as readable text in PostgreSQL. This application does not encrypt database files. Before using staging with real data, verify host or managed-service encryption for the PostgreSQL data volume and backups, restrict administrative/database access, and document backup retention and deletion. Continue to require HTTPS/WSS at the proxy. These protections are operator responsibilities and are not proven by the local Compose configuration. Legacy V1-V6 message envelopes are retained as unrecoverable `LEGACY_ENCRYPTED` records; they are not converted to plaintext.

## Current stack deployment checklist (2026-10-21)

This dated section supersedes the historical PostgreSQL deployment examples above for the current
source tree. The active backend uses MongoDB; the old PostgreSQL Compose and restore instructions
are not applicable to this build. This checklist prepares a private staging release only. It does
not authorize public deployment.

### Required before staging

- [ ] Use a dedicated **non-production MongoDB Atlas cluster/database** for staging. Use synthetic
  accounts and content only; never point a test at production data.
- [ ] Create a MongoDB database user scoped to the staging database with only the privileges
  required by the application. Configure Atlas network access using the actual Render egress
  addresses or a private network connection supported by the selected Render plan. Do not use a
  permanent `0.0.0.0/0` allowlist.
- [ ] Store the complete MongoDB connection URI and a newly generated, stable, high-entropy
  `JWT_SECRET` in Render's protected environment configuration. Never put them in build variables,
  frontend variables, source files, images, logs, or this document. Set `MONGODB_DATABASE` to the
  separate staging database.
- [ ] Use one backend instance. Presence tracking is process-local; multiple instances can produce
  incorrect online/offline state. Do not enable autoscaling or multiple instances.
- [ ] Complete the isolated integration plan below and verify Atlas backups plus a restore into a
  separate empty staging verification database before any release decision.

### Render backend

- [ ] Create a private/staging Render service from the repository using the backend Dockerfile and
  `backend` as the Docker build context. The Dockerfile builds its JAR in a Maven build stage; a
  local `target` directory is not required. A Docker build was **not run locally** because Docker
  is unavailable here.
- [ ] Configure these Render backend environment variables. Set secrets only in protected
  **runtime** environment settings, never in source, image build arguments, or frontend settings:

  | Name | Requirement |
  |---|---|
  | `MONGODB_URI` | Required secret; connection string for the dedicated non-production Atlas deployment |
  | `MONGODB_DATABASE` | Set explicitly to the dedicated staging database name |
  | `JWT_SECRET` | Required secret; stable, randomly generated signing secret, at least 32 bytes |
  | `CORS_ORIGIN` | Set explicitly to the exact HTTPS Firebase origin (origin only; no path or trailing slash) |
  | `PORT` | Render supplies this at runtime; Spring reads it. Do not hardcode a competing port |
  | `JWT_EXPIRATION_MINUTES` | Optional; application default is 60 |
  | `PRESENCE_STALE_SECONDS` | Optional; application default is 90, minimum 30 |
  | `RATE_LIMIT_AUTHENTICATION_PER_MINUTE` | Optional; default 20 |
  | `RATE_LIMIT_REGISTRATION_PER_HOUR` | Optional; default 10 |
  | `RATE_LIMIT_SEARCH_PER_MINUTE` | Optional; default 60 |
  | `RATE_LIMIT_WRITES_PER_MINUTE` | Optional; default 30 |

- [ ] Confirm the service starts successfully with the generated secret and can reach the staging
  Atlas database. `/health/ready` returns status only but also indicates database reachability;
  restrict health routes from public access where provider routing allows. Do not print the URI or
  secrets while diagnosing.
- [ ] Verify WebSocket upgrade support and HTTPS-to-WSS operation through the actual Render service
  URL. Test JWT authentication and authorization on that route; do not infer success from HTTP
  health checks.
- [ ] Verify exact-origin CORS using the deployed Firebase origin. Do not use `*`, localhost, or
  a preview URL as the production allowlist.
- [ ] Pin/review the base-image versions and service plan/topology before release; confirm graceful
  restart behavior and retain logs with authorization headers, tokens, secret values, and message
  bodies redacted.

### Firebase Hosting frontend

- [ ] Build the frontend in API mode with build-time variables
  `VITE_APP_MODE=api` and `VITE_API_URL=https://<verified-render-service-origin>`. The API URL is
  public configuration, not a secret, and the production build rejects non-HTTPS/localhost and
  malformed origins.
- [ ] The only frontend environment names used for this deployment are `VITE_APP_MODE` and
  `VITE_API_URL`; inject these at build time in the local build shell or approved CI build
  environment. Firebase Hosting serves the resulting static bundle and does not provide these
  Vite values as runtime configuration. Never put `MONGODB_URI` or `JWT_SECRET` in frontend
  build/hosting variables.
- [ ] From a PowerShell prompt at the repository root, after replacing the placeholder with the
  verified HTTPS Render origin, build API mode:

  ```powershell
  $env:VITE_APP_MODE = 'api'
  $env:VITE_API_URL = 'https://<verified-render-service-origin>'
  npm.cmd run build
  ```

  These commands have not been run with a real provider origin in this workspace.
- [ ] Configure Firebase Hosting to serve the Vite `dist` directory and rewrite SPA routes to
  `/index.html`. No Firebase Hosting configuration/project is present in this workspace yet;
  add it only after the Firebase project and target are confirmed by the owner.
- [ ] Set the Firebase custom domain and HTTPS, then configure Render `CORS_ORIGIN` to exactly
  that origin. Verify login, refresh on nested routes, REST API, and WSS from the actual hosted
  frontend.
- [ ] Inspect the generated bundle and hosting configuration for accidental credentials, localhost
  API URLs, source maps containing sensitive values, or preview-only endpoints.

### Isolated end-to-end verification

Use only the dedicated staging Atlas database and synthetic accounts `smoke-a`, `smoke-b`, and
`smoke-c`; do not run destructive tests against other data.

1. Confirm startup index creation and `/health/ready`, then create the three test accounts.
2. Verify authenticated directory responses omit email and key material and exclude the caller.
3. Verify friend request creation, duplicate/self-request rejection, recipient-only accept/reject,
   and that unrelated users cannot decide another user's request.
4. Verify only accepted friends can create new conversations. A stranger cannot obtain participant
   details or conversation history by listing or guessing IDs.
5. Verify non-members cannot read history, mark messages read, or send messages via REST.
6. Authenticate two WebSocket clients; verify only an authenticated member can subscribe and send.
   Attempt a stranger subscription/send and confirm it is rejected before persistence or broadcast.
7. Verify the authenticated sender is taken from the session, not a client-supplied sender ID.
8. Test two sessions for one account: first connect becomes online, one disconnect leaves it online,
   last disconnect marks offline, reconnect restores online, and stale heartbeat cleanup marks
   offline. Confirm presence queries/events are visible only to accepted friends.
9. Enroll P-256 identity keys, verify the private key remains in browser IndexedDB, verify contact
   fingerprints only for an existing contact, and verify key rotation makes the old verification
   stale. Do not describe this as end-to-end encryption or proof of real-world identity.
10. Capture sanitized test outcomes only. Record exact requests/statuses, counts, and provider
    configuration checks; never store access tokens, passwords, MongoDB URIs, or message contents.

The local Java/Maven and frontend suites are not substitutes for these staging checks. Use a
separate Atlas staging database and newly created synthetic accounts only. Record each expected
authorization rejection as well as each successful flow; do not use production or pre-existing
user accounts.

### Recovery, rollback, and release gate

- [ ] Enable Atlas automated backups with approved retention and access restrictions.
- [ ] After Atlas backup/restore pricing, retention, and access impact are reviewed and approved,
  restore a staging-only backup into a separate isolated verification cluster or database using
  the Atlas-supported restore workflow. Do not restore over the source and do not select a
  production snapshot. Point only a private verification service at the restored target; check
  readiness and, using synthetic staging accounts, verify login, conversation/history retrieval,
  and authorization. Record sanitized results and remove/retain resources only under the owner's
  explicit cleanup decision. No backup or restore command is run by this checklist.
- [ ] Record the current deployed image/build identifier, configuration variable names (not values),
  and the rollback target. Verify rollback does not change or delete Atlas data.
- [ ] Confirm all local tests pass, isolated integration checks pass, exact CORS/TLS/WSS and SPA
  routing are verified, and single-instance presence is retained before asking for authorization
  to deploy publicly.

**Workspace status at checklist creation:** no Render or Firebase project was configured, no
Firebase Hosting config was present, and Docker, Firebase CLI, and Render CLI were unavailable.
No live integration, provider verification, backup restore, DNS change, push, or deployment was
performed. Treat all provider checklist items as pending until independently verified.

**Local Docker build command (not run in this workspace):** from the repository root in
PowerShell, build with `backend` as the context:

```powershell
docker build --pull --file backend\Dockerfile --tag cryptoconnect-backend:staging-check backend
```

If the build succeeds on the owner's machine, record the exit code and sanitized image ID/platform.
That local image build does not deploy the service or verify Atlas, Render, Firebase, TLS, or
WebSocket behavior.
