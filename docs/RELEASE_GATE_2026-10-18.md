# Final staging gate report — 2026-10-18

## Verdict

**NOT READY FOR STAGING.** Same-day PostgreSQL 18 backend and frontend build evidence passed, but PostgreSQL 16, actual Compose/container checks, complete browser acceptance, and restored-database application verification remain open. **PRODUCTION READINESS NOT VERIFIED.** No public deployment was attempted.

There is no `.git` metadata, so no Git diff or commit review is claimed. `.env` was not read. The PostgreSQL service/database on port 5432 was not targeted or modified.

Runtime versions observed in this workspace: Eclipse Temurin Java **21.0.12.1**, Maven Daemon **1.0.6** (Windows amd64), Node.js **22.13.1**, npm **10.9.2**, Vite **8.3.4**, Git Bash **5.2.37**, and installed PostgreSQL server **18.6**. No PostgreSQL 16 or container runtime was present.

## Passed evidence

- **Backend suite (same-day workspace evidence):** `mvnd.cmd -q test` from `backend`, with `RUN_POSTGRES_INTEGRATION=true`, completed against a fresh disposable PostgreSQL 18.6 database. Surefire XML files on disk are dated 2026-10-18 19:52 and aggregate to **75 tests, 75 passed, 0 failed, 0 errors, 0 skipped**; the integration class contributed **2 passed**. Coverage includes V1–V6, role separation/restrictions, schema constraints, authentication, contacts, conversations, message persistence/idempotency, unread/read receipts, token revocation, and embedded health endpoints. This is PostgreSQL 18.6 evidence, not PostgreSQL 16 compatibility. The results are reused from the immediately preceding same-day audit and were not rerun in this closure turn.
- **Frontend build (executed in this closure):** the command below passed TypeScript checking and Vite 8.3.4 with 2,511 modules transformed. The example origin is not a deployed service.
- **Initializer syntax:** Git Bash 5.2.37 `-n` passed. This is syntax validation only.
- **Previously recorded loopback evidence:** HTTP and two-client WebSocket protocol checks, exact-origin CORS, persistence/idempotency/unread/read, reconnect/history behavior, token revocation, and backend restart were recorded in the prior same-day audit. The WebSocket smoke tested A-to-B, not B-to-A, and was not a browser test.
- **Previously recorded PostgreSQL 18 restore:** custom-format restore into a separate empty disposable database succeeded; six migration records, synthetic rows, ownership, and runtime restrictions were inspected. The application was not started against the restored database, so end-to-end recovery remains open.

## Blocked and unrun gates

| Gate | Status | Evidence or blocker |
| --- | --- | --- |
| PostgreSQL 16 full backend suite | **BLOCKED** | No PostgreSQL 16 server/runtime is installed. PostgreSQL 18.6 cannot satisfy the configured `postgres:16-alpine` target. |
| Actual staging Compose model/build/start | **BLOCKED** | Docker, Compose, Podman, and nerdctl are unavailable. No container build, secret mount, runtime UID, health, network, volume, or shutdown result is claimed. |
| Initializer actual execution in this closure | **BLOCKED** | Git Bash exists and parses the script. Fresh local PostgreSQL initialization failed before the script ran: `initdb` could not create a restricted token (error 87) and could not re-execute (error 3). The WSL Bash launcher separately returns `Wsl/EnumerateDistros/Service/E_ACCESSDENIED`. The temporary cluster directory was removed. Prior disposable role evidence is historical and is not presented as a new run. |
| Two-profile browser UI acceptance | **BLOCKED** | Chrome is installed, but Playwright/Puppeteer/WebDriver are absent. A correctly quoted isolated headless CDP launch opened DevTools then terminated with `GPU process isn't usable` in this restricted environment. An earlier malformed argument launch reported “Multiple targets are not supported in headless mode”; waiting on that exited process explains the timeout. No browser UI, console, network, responsive, keyboard, or UI reconnect check passed. |
| Backup/restore application recovery | **NOT_RUN** | Prior PostgreSQL 18 SQL restore did not start the backend on the restored database or verify login/history/message delivery. No PostgreSQL 16 instance is available. |
| Real TLS/WSS/reverse proxy | **NOT_RUN** | No proxy config, real staging host, certificate, or deployment exists. |
| Independent security review/load testing | **NOT_RUN** | No independent assessment or load runner was used. |

Static Compose inspection is not Compose validation. Protocol smoke tests are not browser acceptance.

## Commands executed in this closure

```powershell
Get-Content -Raw 'C:\Users\My\.codex\attachments\ddbde0de-a38a-4f0b-bf75-01f67a1c7c94\Pasted text.txt'
Get-Command mvnd.cmd,java.exe,node.exe,npm.cmd,docker.exe,docker-compose.exe,podman.exe,nerdctl.exe,psql.exe,pg_ctl.exe,bash.exe
wsl.exe --status
& 'C:\Program Files\Git\bin\bash.exe' --version
& 'C:\Program Files\Git\bin\bash.exe' -n ops/postgres-init/10-create-app-role.sh
$env:VITE_APP_MODE='api'; $env:VITE_API_URL='https://chat.staging.example.net'; npm.cmd run build
```

Additional attempts: a fresh PostgreSQL 18 cluster under `%TEMP%` on port 55437 failed before startup; port 5432 was not contacted. Isolated Chrome CDP probes on ports 19222 and 19223 exited before a usable browser session. No project secrets were used.

Latest full backend totals were aggregated from same-day Surefire XML. The backend suite was not rerun in closure because a fresh disposable server could not be started safely in this sandbox. The actual frontend command and result were:

```powershell
$env:VITE_APP_MODE='api'; $env:VITE_API_URL='https://chat.staging.example.net'; npm.cmd run build
# PASS: tsc; Vite 8.3.4; 2,511 modules; exit code 0.
```

## Security and implementation observations

- E2EE is **not implemented**. The random AES-GCM key is memory-only and is not established with recipients; refresh, another account, or another device cannot decrypt persisted ciphertext.
- Rate limits are process-local and do not coordinate replicas.
- Registration returns a conflict for an existing email and can reveal account existence. This remains a hardening item.
- Health endpoints are unauthenticated status-only routes. Restrict them at the actual proxy.
- No proxy/TLS config exists. Compose `framework` forwarded-header support does not prove that headers are sanitized or the proxy is the only path.
- Image tags are mutable; no target-platform digest was verified or pinned.

## Next run

Use [RELEASE_VERIFICATION_WORKFLOW.md](./RELEASE_VERIFICATION_WORKFLOW.md) on an isolated Linux runner with PostgreSQL 16, Compose, and a usable two-profile browser. Record outcomes in [RELEASE_GATE_2026-10-18.json](./RELEASE_GATE_2026-10-18.json). Keep this verdict until all required runtime gates pass.
