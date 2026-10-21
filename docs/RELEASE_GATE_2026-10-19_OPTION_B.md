# CryptoConnect post-V7 release gate — 2026-10-19

## Verdict

**NOT READY FOR STAGING.** This re-audit passed the frontend production build and JavaScript syntax checks. The backend suite could not be re-run because Maven dependency resolution was denied by the current network sandbox. Responsive browser assertions have been added to the CI Playwright flow but are not yet executed. PostgreSQL 16, browser, Compose, current application restore, real HTTPS/WSS, storage encryption, and hosted CI gates remain outstanding.

Option B is conventional server-readable messaging, not end-to-end encryption. New messages are stored as `TEXT`; V1–V6 encrypted envelopes are preserved as `LEGACY_ENCRYPTED` and exposed as unavailable content because their page-memory keys were not persisted. Production exposure requires verified HTTPS/WSS, encrypted database volumes and backups, and restricted storage access.

## Current re-audit — 2026-10-19

This section records checks attempted against the current workspace. Results from the earlier 2026-10-19 run below are retained as previous reported evidence; they were not treated as freshly executed in this re-audit.

| Gate | Status | Current evidence |
|---|---|---|
| Frontend production build | PASS | `npm.cmd run build`; TypeScript passed and Vite 8.3.4 transformed 2,511 modules. |
| API-mode frontend build | PASS | `$env:VITE_APP_MODE='api'; $env:VITE_API_URL='https://api.ci.example.test'; npm.cmd run build`; TypeScript and Vite passed. The reserved `.test` origin was build-only; no endpoint was contacted. The final `dist/` output was rebuilt in default mode afterward. |
| E2E and restore-script syntax | PASS | `node --check tests/e2e/release-acceptance.spec.cjs`; `node --check scripts/verify-restored-database.mjs`. |
| Responsive browser acceptance | BLOCKED | The Playwright viewport, route, keyboard, phone chat, composer, long-URL, and WebSocket-stability assertions are now in the existing E2E flow. They were not run: Playwright is not installed locally, Chrome headless exited with `GPU process isn't usable`, and hosted CI is unavailable. No viewport is reported as visually accepted. |
| Backend unit/web suite | BLOCKED | `RUN_POSTGRES_INTEGRATION=false; mvnd -B -ntp test` could not resolve the Spring Boot 3.5.6 parent POM: Maven Central access returned `Permission denied: getsockopt`. Existing Surefire reports were not counted as this run. |
| PostgreSQL 16 migrations and integration | BLOCKED | No local `psql`, PostgreSQL server tools, Docker, or compatible isolated PostgreSQL 16 runner is available. No database was contacted. Earlier PostgreSQL 18.6 integration results are supplemental prior evidence only. |
| Two-profile API acceptance and restart/reconnect | BLOCKED | The prior synthetic-account Playwright run is retained as earlier evidence, not rerun here. Current Playwright, backend, isolated DB, and Compose prerequisites are unavailable; restart/reconnect remains unverified. |
| Compose build/runtime and recovery | BLOCKED | Docker/Compose are unavailable. Compose/workflow source was inspected; no YAML validator or hosted workflow run was available. |
| Backup/restore | BLOCKED | The prior PostgreSQL 18.6 application restore result is supplemental prior evidence, not rerun here. PostgreSQL 16 and Compose restore remain unverified. |
| HTTPS/WSS, proxy, storage encryption at rest | BLOCKED | No staging endpoint, TLS proxy/certificate, or database/backup storage evidence was provided for verification. |
| Hosted CI | NOT RUN | Git is installed, but this workspace has no `.git` metadata; `gh` and an authorized hosted runner are unavailable. |

Tool versions checked: Node.js 22.13.1, npm 10.9.2, Java 21.0.12.1, and Maven Daemon 1.0.6. PostgreSQL command-line/server tools, Docker/Compose, local Playwright, ChromeDriver, EdgeDriver, and GitHub CLI were unavailable. Chrome exists, but its headless process failed before rendering. No test runner is configured in `package.json`.

The responsive Playwright checks cover all required viewports: 320×568, 360×800, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900, and 1920×1080. They are source-level coverage only until the existing hosted workflow executes them.

## Static backend security review

Source inspection (not runtime verification) found stateless protected REST routes, BCrypt password hashing, JWT expiry/revocation checks, exact configured CORS and WebSocket origin allowlists, WebSocket token expiry/revocation checks, conversation membership checks in message send/acknowledgement/read paths, client-message idempotency lookup, and server-side nonblank/4,000-character message validation. These checks do not replace the blocked backend suite, PostgreSQL 16 integration, or a security audit. API messaging remains server-readable and is not E2EE.

## Migration and implementation audit

Static inspection confirms V1 defines `encrypted_messages` with UUID primary key, conversation and sender foreign keys, the `(conversation_id, sender_id, client_message_id)` unique constraint added by V2, timestamps, and the V1 conversation/time index. V5 adds the partial unread index. V7 renames the table and envelope columns, adds the text fields, keeps old rows at the `LEGACY_ENCRYPTED` default, allows legacy fields to be null for new rows, and constrains the two formats to mutually exclusive content/envelope shapes. PostgreSQL rename operations preserve dependent foreign keys and indexes. The repository queries target the renamed `messages` table and current columns. Legacy API responses do not include ciphertext.

Execution below is supplemental to the required PostgreSQL 16 gate. A disposable PostgreSQL 18.6 instance was initialized in temporary storage and bound only to `127.0.0.1:55439`. Fresh V1–V7 migrations and all three PostgreSQL integration tests passed there. The V6-to-V7 regression inserted a synthetic envelope before V7 and verified it after upgrade. No connection was made to the separately running PostgreSQL service or port 5432.

The integration regression case creates a uniquely named disposable schema with Flyway V1–V6, inserts a synthetic legacy envelope with valid relationships and delivery/read metadata, then applies V7 and asserts preservation, legacy/unavailable representation, migration history, indexes, foreign keys, and the format constraint. It uses the configured Flyway migrator credentials and removes only its run-scoped schema. It passed on PostgreSQL 18.6; PostgreSQL 16 execution is still required.

## Earlier reported checks (not re-run during the current re-audit)

| Gate | Status | Evidence |
|---|---|---|
| Frontend API-mode production build | PASS | `VITE_APP_MODE=api`, `VITE_API_URL=https://api.ci.example.test`, `npm.cmd run build`; TypeScript passed, Vite 8.3.4 transformed 2,511 modules. |
| Browser and restore script syntax | PASS | `node --check tests/e2e/release-acceptance.spec.cjs`; `node --check scripts/verify-restored-database.mjs`. Syntax only. |
| Backend default suite | PASS | From `backend`: `$env:RUN_POSTGRES_INTEGRATION='false'; mvnd -B -ntp test`; 79 total, 76 passed, 0 failed, 0 errors, 3 PostgreSQL integration tests skipped. This includes the new legacy WebSocket serialization regression test. |
| Backend test-source compilation | PASS | From `backend`: `mvnd -B -ntp -DskipTests test-compile`; Java 21 compiled 42 main and 17 test source files. No tests were run and no database was contacted. |
| PostgreSQL 18.6 integration suite (supplemental) | PASS | All 3 `PostgresMessagingIntegrationTest` cases passed against a separately initialized, disposable PostgreSQL 18.6 instance on `127.0.0.1:55439`, including fresh migrations, runtime/migrator role checks, bidirectional REST messaging, and the populated V6-to-V7 upgrade. This does not satisfy the PostgreSQL 16 gate. |
| Two-profile Playwright acceptance (supplemental) | PASS WITH BACKEND RESTART SKIPPED | The existing acceptance flow passed against the local app and disposable PostgreSQL 18.6 database. It covered two-profile live bidirectional messaging, read receipts, idempotency, history after reload, logout, and revoked-token rejection. `CC_RESTART_BACKEND=false` because Docker is unavailable. |
| Application backup/restore (supplemental) | PASS | Backed up the disposable PostgreSQL 18.6 database, restored to a different empty database, started a second app instance against the restored copy, and verified readiness, both account logins, existing history, and a new persisted message. Compose-managed recovery and PostgreSQL 16 remain unverified. |
| Focused WebSocket regression suite | PASS | The current full backend run includes the WebSocket regression tests, including the new legacy-unavailable serialization assertion; no failures or errors. |
| API URL guards | PASS | API-mode build rejected a missing `VITE_API_URL` and `https://bad.invalid` with the expected guard errors. |
| Bundle marker scan | PASS (previous verification) | No JWT/database secret markers found in the built bundle. |
| Migration from V1 through V7 | PASS (PostgreSQL 18.6 supplemental); PostgreSQL 16 BLOCKED | Fresh V1–V7 migration and integration passed on the disposable PostgreSQL 18.6 instance. PostgreSQL 16 verification remains outstanding. |
| Populated V6-to-V7 upgrade | PASS (PostgreSQL 18.6 supplemental); PostgreSQL 16 BLOCKED | The permanent regression test passed on PostgreSQL 18.6, preserving the pre-existing envelope and metadata. PostgreSQL 16 execution remains outstanding. |
| PostgreSQL integration, runtime role and token revocation checks | PASS (PostgreSQL 18.6 supplemental); PostgreSQL 16 BLOCKED | All 3 integration tests passed, including runtime role separation and revocation checks. PostgreSQL 16 verification remains outstanding. |
| Two-profile messaging acceptance | PASS WITH BACKEND RESTART SKIPPED | Browser acceptance passed for bidirectional messages, receipts, idempotency, reload/history, logout, and revoked-token rejection. Docker-backed restart and reconnect acceptance was skipped because Docker is unavailable. |
| Compose build, startup, health, secrets, networks, persistence, shutdown | BLOCKED | Docker/Compose executables are unavailable. The Compose and workflow definitions were inspected only. |
| Application-level backup and restore | PASS (PostgreSQL 18.6 supplemental); PostgreSQL 16/Compose BLOCKED | A dump was restored into a different empty database; a fresh app instance logged in both synthetic users, retrieved prior history, and persisted/retrieved a new message. PostgreSQL 16 and Compose recovery remain outstanding. |
| HTTPS/WSS and encrypted storage at rest | BLOCKED | No staging endpoint, TLS proxy, or operator-managed storage available to verify. The CI browser proxy uses loopback HTTP and is not evidence of TLS. |
| Hosted CI workflow | NOT RUN | No Git metadata, configured remote, `gh`, or authorized hosted runner is available. Workflow inspection shows a PostgreSQL 16 job, Compose build/runtime checks, Playwright acceptance, restore exercise, and run-scoped cleanup, but provides no execution result. |

## Remaining actions

1. Run `.github/workflows/release-verification.yml` on an authorized GitHub runner and retain the actual result.
2. Run the new populated V6-to-V7 migration regression case on the authorized PostgreSQL 16 runner. Existing API integration coverage separately verifies that legacy rows are represented as unavailable and do not expose ciphertext as message content.
3. Resolve the remaining PostgreSQL 16 and Compose runtime gates in the authorized CI runner, including backend restart/reconnect and the existing Compose restore exercise.
4. Before controlled staging, configure and verify the real HTTPS/WSS proxy and encrypted database volume/backup storage.

`.env` was never read. The development database on port 5432 was not contacted, changed, or migrated. No public deployment occurred. Local browser and restore checks used synthetic accounts and a disposable PostgreSQL 18.6 instance; the temporary database, backup, credentials, browser state, and Playwright runtime were removed afterward. Earlier historical release reports remain unchanged.
