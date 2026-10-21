# Release gate update — 2026-10-19

## Verdict

**NOT READY FOR STAGING.** The current backend unit/web suite ran with 73 passed and 2 PostgreSQL integration methods skipped; the API-mode frontend build passed. PostgreSQL 16, container deployment, browser acceptance, and application-level restore verification remain unclosed. **PRODUCTION READINESS NOT VERIFIED.** No public service was deployed. The prior [2026-10-18 report](./RELEASE_GATE_2026-10-18.md) is preserved as historical evidence.

No `.git` metadata is present. `.env` was not opened. The running PostgreSQL 18 Windows service and its development database on port 5432 were not contacted, reset, migrated, or modified.

## Commands and current results

| Check | Command | Result |
| --- | --- | --- |
| Backend suite, DB integration gate unset | From `backend`: `Remove-Item Env:RUN_POSTGRES_INTEGRATION -ErrorAction SilentlyContinue; mvnd.cmd -q test` | Exit 0. Surefire XML dated 2026-10-19: **75 total, 73 passed, 0 failed, 0 errors, 2 skipped**. Both skips are `PostgresMessagingIntegrationTest` methods because `RUN_POSTGRES_INTEGRATION` was absent. This is not a PostgreSQL integration pass. |
| API-mode production build | From project root: `$env:VITE_APP_MODE='api'; $env:VITE_API_URL='https://chat.staging.example.net'; npm.cmd run build` | Exit 0. TypeScript passed; Vite 8.3.4 transformed 2,511 modules. The example URL is not a deployed endpoint. |
| Build rejects placeholder origin | `VITE_APP_MODE=api`, `VITE_API_URL=https://chat.example.invalid`, `npm.cmd run build` | Expected nonzero exit; verified the configured guard message rejected the `.invalid` origin. |
| Build rejects missing API URL | `VITE_APP_MODE=api`, unset `VITE_API_URL`, `npm.cmd run build` | Expected nonzero exit; verified the configured guard message requires the API URL. |
| Credential-pattern scan | Scanned root/backend `.log`, Surefire `.xml`, and built `dist/assets` for bearer-token, JWT-shaped, private-key, URL-userinfo, and token-query patterns | **48 files, 0 potential pattern hits.** Match values were not printed. `.env` was excluded and not read. |

Runtime versions: Temurin Java 21.0.12.1, Maven Daemon 1.0.6 / Maven 3.9.16, Node 22.13.1, npm 10.9.2, Vite 8.3.4, Windows 11 amd64. `package.json` defines `dev`, `build`, and `preview`; it has no lint or frontend test script.

### Maven startup and network attempts

- Sandboxed `mvnd.cmd -q test` first timed out waiting for the daemon connection; no tests ran in that attempt.
- A subsequent Maven model resolution attempt was blocked from Maven Central (`Permission denied: getsockopt`) while resolving the declared Spring Boot parent 3.5.6.
- Maven Daemon 1.0.6 native Windows mode does not support `mvnd.noDaemon`; those fallback attempts did not run the suite.
- Retrying the normal `mvnd.cmd -q test` with approved network access completed successfully. No dependency version was changed.

Exact fallback forms tried were `mvnd.cmd -Dmvnd.noDaemon=true -q test` and `mvnd.cmd -D "mvnd.noDaemon=true" -q test`; the former encountered the sandboxed repository failure / argument parsing issue on retry, and the latter reported that no-daemon is unsupported in native mode. The successful run used the ordinary `mvnd.cmd -q test` command.

The result above is the unfiltered Maven test run. Surefire confirms both PostgreSQL methods were skipped because the environment variable was absent; they were not disabled in source and no database connection was attempted.

## Carried-forward evidence, not rerun today

- The 2026-10-18 report records **75/75 tests** including both PostgreSQL tests on disposable PostgreSQL 18.6. This does not establish PostgreSQL 16 compatibility.
- Prior loopback HTTP and WebSocket protocol smoke included A-to-B delivery, idempotency, receipts, reconnect/history reconciliation, revocation, and restart persistence. It did not test B-to-A in the latest recorded run and was not browser UI acceptance.
- A PostgreSQL 18 custom-format backup was restored into a separate database and SQL-level migration/permission/data checks passed. The application was not started against that restored DB.
- The isolated Chrome probe previously reached DevTools then crashed with `GPU process isn't usable`; no two-profile UI tests passed. No Playwright/Puppeteer/WebDriver runner is installed.

## Acceptance gates

| Gate | Status | Current evidence |
| --- | --- | --- |
| Backend non-DB suite | **PASS** | Today’s full Maven invocation completed: 73 passed, 0 failed/errors. |
| PostgreSQL integration today | **BLOCKED** | Both integration methods skipped because no disposable DB was provided. The 75/75 PG18.6 result is historical evidence dated 10/18. |
| PostgreSQL 16 compatibility | **BLOCKED** | No PG16 server or compatible container runtime. |
| Role separation / migration privileges today | **NOT RUN** | No database was available for initializer execution or role grants; prior PG18 evidence remains dated 10/18. |
| Frontend production build and API-origin guards | **PASS** | Build passed; placeholder and missing-origin guards rejected both inputs. |
| Compose build/start, secret permissions, network, health, shutdown | **BLOCKED** | Docker/Compose, Podman, and nerdctl unavailable. Secret access as UID 10001 and proxy-only reachability remain runtime checks. |
| Two-profile browser acceptance | **BLOCKED** | Chrome GPU process fails in this environment; browser automation packages absent. |
| Bidirectional live API/WebSocket acceptance | **NOT RUN** | Prior protocol smoke was A-to-B only; no live backend/database started today. |
| End-to-end backup restoration | **NOT RUN** | Prior SQL restore did not start the application against the restored DB. |
| Real HTTPS/WSS/proxy verification | **NOT RUN** | No real proxy config or staging endpoint. |
| E2EE | **NOT IMPLEMENTED** | Existing memory-only AES-GCM key has no recipient exchange or durable device/session key management. |

No application source, migration, or security-control changes were made. There is no Git metadata for a diff. Remaining environment and operational steps are documented in [the verification workflow](./RELEASE_VERIFICATION_WORKFLOW.md).

## Hosted CI preparation (not executed)

The repository now contains `.github/workflows/release-verification.yml` targeting `ubuntu-24.04`, Java 21, Node 22, and disposable PostgreSQL 16. It is configured to run the PostgreSQL-enabled Maven package suite, API-mode frontend build guards, staging Compose validation/build/start checks, a two-profile Playwright run through a loopback-only test proxy, backend restart/reconnect checks, and a disposable `pg_dump`/restore followed by application login/history/message checks. The UI acceptance is in `tests/e2e/release-acceptance.spec.cjs`; the restored-database check is in `scripts/verify-restored-database.mjs`.

**No hosted result is claimed.** The workflow has not run; this checkout still has no Git metadata, remote, or connected GitHub account. Its local HTTP/WebSocket proxy does not verify real HTTPS/WSS. PostgreSQL 16, Compose runtime, browser acceptance, and application restore remain blocked until an authorized GitHub repository runs the workflow. A real staging endpoint and operator-managed TLS proxy are still required for transport verification. E2EE remains unimplemented.

## Security review evidence

- The current 73 passing tests include controller tests for generic invalid-login errors, duplicate registration conflict, logout revocation, and authenticated profile updates; chat service tests cover non-member send denial and idempotent duplicate message IDs. The two PostgreSQL integration methods, which include database-backed authorization/migration assertions, were skipped today.
- Source inspection found BCrypt strength 12, stateless JWT checks with PostgreSQL-backed revocation, conversation membership checks in REST and WebSocket paths, exact-origin CORS configuration, and restrictive CSP/frame/referrer/permissions headers. The current CORS/security unit tests passed as part of the 73.
- WebSocket authentication sends the access token in an application authentication frame over the socket, not in its URL. The browser stores the token in `sessionStorage`; this remains exposed to same-origin script execution/XSS.
- API rate limits remain process-local. Registration conflict responses reveal whether an email is registered. Neither behavior was changed in this verification run.
- The sanitized scan found no bearer/JWT-shaped values, private key markers, URL credentials, or token query values in the selected logs, reports, or bundles. It cannot prove the absence of all possible secrets; `.env` was not inspected.
