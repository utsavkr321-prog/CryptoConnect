# Release verification workflow

This is the repeatable gate for a private, synthetic-data staging candidate. It does not deploy publicly. Run on a disposable Linux runner with Java 21, Node 22, Maven Daemon 1.0.6, PostgreSQL 16 or a compatible Docker Engine and Compose plugin, `curl`, and two browser profiles. This Windows workspace has no PostgreSQL 16, Docker/Podman/nerdctl, or usable headless Chrome GPU process; see [the dated gate report](./RELEASE_GATE_2026-10-18.md).

GitHub Actions is prepared as the future CI target in [release-verification.yml](../.github/workflows/release-verification.yml). It is not a completed or passing CI run: this checkout has no Git metadata or GitHub remote, so the workflow has not been uploaded or executed. It uses an ephemeral Ubuntu 24.04 job, Java 21, Node 22, a disposable PostgreSQL 16 container, the actual staging Compose file, generated synthetic secrets, a loopback-only test proxy, two isolated Playwright contexts, and a disposable database restore. Its synthetic HTTP/WebSocket proxy does not establish HTTPS/WSS deployment readiness.

To enable the prepared workflow, initialize Git, create the intended private GitHub repository, add its actual remote, commit and push the project, then run **Release verification** from the repository's Actions tab (or let a push/pull request trigger it). Do not add credentials to the workflow. A hosted run is required before reporting any gate as passed. Do not mark blocked steps passed based on config parsing or static inspection.

## Portable Linux runner sequence

Run from the repository root. These examples use Bash and Linux Docker Compose. Use a new temporary workspace for each run; never point it at development `.env`, database, volume, or user data.

```sh
set -eu
java -version
node --version
npm --version
docker version
docker compose version
mvnd --version
```

Install locked frontend dependencies and build API mode. The reserved `.invalid` hostname below is only a build input, not a real service:

```sh
npm ci
VITE_APP_MODE=api VITE_API_URL=https://chat.staging.example.invalid npm run build
```

Provision an isolated PostgreSQL 16 container on a loopback-only host port with fresh synthetic credentials. This uses the current staging target image reference; do not treat a mutable tag as an immutable release pin. Do not use an existing PostgreSQL service. Create secret files with mode `0600`, outside the checkout, and mount the actual repository initializer at the official image's initialization path:

```text
POSTGRES_USER=postgres
POSTGRES_DB=cryptoconnect_staging
STAGING_DATABASE_USERNAME=cryptoconnect_app
STAGING_DATABASE_PASSWORD_FILE=/private-run-dir/app-password
STAGING_MIGRATOR_USERNAME=cryptoconnect_migrator
STAGING_MIGRATOR_PASSWORD_FILE=/private-run-dir/migrator-password
```

```sh
umask 077
run_dir=$(mktemp -d)
chmod 700 "$run_dir"
openssl rand -hex 32 > "$run_dir/bootstrap"
openssl rand -hex 32 > "$run_dir/app-password"
openssl rand -hex 32 > "$run_dir/migrator-password"
docker run -d --name cryptoconnect-pg16-gate \
  -p 127.0.0.1:55438:5432 \
  -e POSTGRES_DB=cryptoconnect_staging -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD_FILE=/run/secrets/bootstrap \
  -e STAGING_DATABASE_USERNAME=cryptoconnect_app \
  -e STAGING_DATABASE_PASSWORD_FILE=/run/secrets/app-password \
  -e STAGING_MIGRATOR_USERNAME=cryptoconnect_migrator \
  -e STAGING_MIGRATOR_PASSWORD_FILE=/run/secrets/migrator-password \
  --mount "type=bind,src=$run_dir/bootstrap,dst=/run/secrets/bootstrap,readonly" \
  --mount "type=bind,src=$run_dir/app-password,dst=/run/secrets/app-password,readonly" \
  --mount "type=bind,src=$run_dir/migrator-password,dst=/run/secrets/migrator-password,readonly" \
  --mount "type=bind,src=$PWD/ops/postgres-init/10-create-app-role.sh,dst=/docker-entrypoint-initdb.d/10-create-app-role.sh,readonly" \
  postgres:16-alpine
until docker exec cryptoconnect-pg16-gate pg_isready -U postgres -d cryptoconnect_staging; do sleep 2; done
docker exec cryptoconnect-pg16-gate psql --no-psqlrc -U postgres -d cryptoconnect_staging -Atc 'show server_version'
```

The image entrypoint executes the repository initializer after bootstrap initialization and before Flyway. Confirm both roles authenticate; neither is superuser or has role/database creation rights; `cryptoconnect_app` lacks `CREATE` on `public` and writes to `flyway_schema_history`; and after migrations it has required table DML and sequence usage. At the end, stop and remove only this named disposable container and its temporary directory after checking the run ID and saving sanitized reports.

Export disposable test-only connection settings in the runner shell without printing the environment:

```sh
export RUN_POSTGRES_INTEGRATION=true
export DATABASE_URL=jdbc:postgresql://127.0.0.1:55438/cryptoconnect_staging
export DATABASE_USERNAME=cryptoconnect_app
export DATABASE_PASSWORD="$(cat /private-run-dir/app-password)"
export SPRING_FLYWAY_URL="$DATABASE_URL"
export SPRING_FLYWAY_USER=cryptoconnect_migrator
export SPRING_FLYWAY_PASSWORD="$(cat /private-run-dir/migrator-password)"
export JWT_SECRET="$(openssl rand -base64 48)"
(
  cd backend
  mvnd -q test
)
```

Run the full suite, not only the PostgreSQL test class. Preserve Surefire XML and report tests, passes, failures, errors, and skips. PostgreSQL integration must not be skipped. Do not substitute PostgreSQL 18 for the configured PostgreSQL 16 target. Build the package with tests enabled before the Dockerfile consumes its JAR:

```sh
(cd backend && mvnd -q package)
```

Package the backend, validate the actual Compose model, and build before starting it. The private Compose env file must contain file paths and non-secret topology values only. Use distinct synthetic PostgreSQL bootstrap, app, migrator, and JWT secret files outside the repository.

```sh
docker compose --env-file /private-run-dir/compose.env -f docker-compose.staging.yml -p cryptoconnect-gate config --quiet
docker compose --env-file /private-run-dir/compose.env -f docker-compose.staging.yml -p cryptoconnect-gate build backend
docker network create cryptoconnect-gate-edge
docker compose --env-file /private-run-dir/compose.env -f docker-compose.staging.yml -p cryptoconnect-gate up -d
docker compose --env-file /private-run-dir/compose.env -f docker-compose.staging.yml -p cryptoconnect-gate ps
```

The external network must be isolated and disposable. Inspect the rendered model and runtime: PostgreSQL has no published port; backend has no host-published port and runs as UID 10001; secret destinations match the entrypoint; only the test proxy on the isolated edge network can reach the backend; readiness follows DB state; the named DB volume survives backend recreation; and shutdown/restart preserves acknowledged synthetic messages. The repository contains no reverse-proxy config, so this does not prove TLS, WSS, forwarded-header sanitization, or public routing.

Through the test proxy, verify readiness, two synthetic registrations/logins, contacts, conversation create/reuse, messages in both directions, duplicate client IDs, history, read receipts, revoked-token rejection, and CORS from exactly the configured origin. Run the two-profile browser checks in `docs/TESTING.md`, including backend restart and history reconciliation. Save only sanitized outcomes; do not save tokens or message payloads.

For recovery, take a custom-format dump from the disposable database, verify the archive, restore into a second new empty PostgreSQL 16 database with correct grants, start the backend against it using the runtime role, and repeat readiness, login, history, and message delivery. `pg_restore` success or row counts alone do not pass recovery.

Stop services and remove only run-specific resources after confirming their names. Never run `down -v` on a non-disposable project.

## Option B message acceptance

Current API chat uses server-readable text, not ciphertext envelopes. Send JSON with `clientMessageId` and `content` (1-4,000 nonblank characters). The Playwright workflow asserts that both participants see readable messages, that text survives restart and refresh, and that duplicate IDs remain idempotent. The runtime database must have applied Flyway V7; older rows are `LEGACY_ENCRYPTED` with unavailable content and are never displayed as plaintext. Before using real staging data, verify TLS in transit plus encrypted PostgreSQL storage and backups at rest. These operator controls are not proven by the loopback CI proxy.

## Result recording

Use `PASS`, `FAIL`, `BLOCKED`, or `NOT_RUN` for each gate. `BLOCKED` means a prerequisite prevented the check; `NOT_RUN` means it was not attempted. Record commands, runtime versions, counts, and sanitized evidence. Keep the overall verdict `NOT READY FOR STAGING` while any required gate is not `PASS`. The current snapshot is [RELEASE_GATE_2026-10-19.json](./RELEASE_GATE_2026-10-19.json). E2EE remains unimplemented; see [E2EE_ARCHITECTURE.md](./E2EE_ARCHITECTURE.md).

## Real endpoint HTTPS/WSS gate

The CI proxy is deliberately loopback-only HTTP/WS. It cannot pass the TLS, certificate, WSS, forwarded-header, public CORS, or external reachability gates. Before using the browser spec against a real staging service, the operator must:

1. Provision a staging-only HTTPS frontend origin and HTTPS API origin with valid certificates, a disposable database, and synthetic data.
2. Set backend `CORS_ORIGIN` to the exact frontend origin and build the API frontend with `VITE_APP_MODE=api` and `VITE_API_URL` set to the HTTPS API origin. Configure the proxy to route API paths and `/ws`, forward WebSocket upgrades, sanitize `Forwarded` and `X-Forwarded-*` headers, and make the backend reachable only from that proxy.
3. Run the browser test below from a machine that can reach the staging frontend/API. It creates two synthetic accounts and leaves them in the staging database; use a disposable database and remove it afterward. Set `CC_RESTART_BACKEND=false` because the test host must not restart an operator-managed service. The browser checks HTTPS page/API access, a WSS browser connection, successful exact-origin requests, bidirectional live delivery, duplicate-send behavior, read receipts, history, and token revocation. It does not by itself validate forwarded-header sanitization or block direct network access; verify those at the proxy/firewall layer.

```sh
set -eu
run_dir=$(mktemp -d)
chmod 700 "$run_dir"
mkdir "$run_dir/playwright"
(cd "$run_dir/playwright" && npm init -y >/dev/null && npm install --save-exact @playwright/test@1.64.1)
"$run_dir/playwright/node_modules/.bin/playwright" install --with-deps chromium
export PLAYWRIGHT_MODULE="$run_dir/playwright/node_modules/@playwright/test"
export ACCEPTANCE_STATE_PATH="$run_dir/acceptance-state.json"
export CC_APP_URL='https://<actual-frontend-origin>'
export CC_API_URL='https://<actual-api-origin>'
export CC_RESTART_BACKEND=false
"$run_dir/playwright/node_modules/.bin/playwright" test tests/e2e/release-acceptance.spec.cjs --workers=1 --reporter=line
```

Replace both angle-bracket values with operator-provided origins before running. Do not put account credentials or state files in the repository; the test stores generated synthetic credentials with mode `0600` under the temporary directory. If no staging endpoint is available, keep this gate `BLOCKED`.
