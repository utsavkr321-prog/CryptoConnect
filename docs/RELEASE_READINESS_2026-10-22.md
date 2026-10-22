# Release readiness — 2026-10-22

## Status

**NOT RELEASE-READY.** The browser failure's frontend root cause is identified and
fixed locally, but the updated browser test and release pipeline have not run on this
worktree. The latest Actions run is still red, and backup/restore did not run.

The local branch remains `main` at
`c228ed96f3f415b8c67597180a1cfc42be19bf92` (`Fix friend messaging browser
acceptance`). The fix and test updates are uncommitted and are not included in any
Actions run. The latest run lookup found no newer run than #8. No deployment, commit,
or push was performed.

## Architecture and configuration

The active application persistence is MongoDB. Staging Compose runs the backend on
the private external proxy network, reads its JWT secret from a mounted secret file,
and does not publish the backend port. CI uses an isolated disposable MongoDB
container; this workflow does not require or configure MongoDB Atlas credentials.

Relevant runtime variable names:

- Application: `MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET`, `CORS_ORIGIN`
- Staging Compose: `STAGING_BACKEND_IMAGE`, `STAGING_MONGODB_URI`,
  `STAGING_MONGODB_DATABASE`, `STAGING_CORS_ORIGIN`, `STAGING_PROXY_NETWORK`,
  `STAGING_JWT_SECRET_FILE`

Values must be supplied through protected runtime configuration; this report contains
no values. The staging procedure and backup/restore boundaries are documented in
[STAGING_DEPLOYMENT.md](./STAGING_DEPLOYMENT.md).
Only `.env.example` matched the tracked sensitive-configuration filename check; its
values are placeholders. `.env` is ignored and was not read during this review.

## Latest GitHub Actions evidence

Run [#8](https://github.com/utsavkr321-prog/CryptoConnect/actions/runs/39748453678)
tested the exact commit above. The workflow job is **MongoDB, Compose, API and browser
gates**.

| Gate | Result | Evidence |
|---|---|---|
| Frontend API-mode build guard and build | PASS | Workflow step succeeded |
| Backend suite and MongoDB Testcontainers | PASS | 124 tests; 124 passed, 0 failed, 0 errors, 0 skipped; 2 MongoDB integration tests executed |
| Staging Compose build and startup | PASS | Docker image build succeeded; backend healthy after 7 seconds |
| Runtime/network assertions | PASS | Backend and MongoDB private-edge network assertions passed |
| Two-profile browser acceptance | FAIL | `release-acceptance.spec.cjs:205`; Playwright `toBeVisible()` timed out after 5 seconds for the Bob conversation button |
| MongoDB backup/restore against restored database | NOT RUN | Workflow skipped this step after browser acceptance failed |

The failure is a mobile UI initialization issue. `ChatPage` loaded conversations and
selected the first one as active at every viewport width. The mobile layout hides the
conversation list while a conversation is active, so returning to `/chat` at a compact
viewport displayed the conversation rather than the list item the acceptance test
expected. The UI code and failing locator agree with this cause. The run retained no
artifacts; it did not record the authenticated conversations response or rendered DOM.

The local fix keeps desktop auto-selection and explicit contact navigation, but leaves
the conversation list selected on mobile. The authenticated `GET /api/conversations`
assertion for Bob runs after the user opens the conversation and before responsive UI
checks, separating API data verification from rendering. The existing acceptance
flow still checks desktop rendering, compact list visibility, mobile conversation
selection and back navigation, composer visibility, both profiles' conversations,
duplicate-contact protection, and messaging. The code path preserves selection when
resizing an already-open conversation; on a new mobile chat mount it starts at the
list. These test assertions and resizing behavior were source-reviewed but not
executed against a browser here. Neither local change is in the SHA tested by run #8.
The local Docker daemon is unavailable.

## Local validation

| Check | Result |
|---|---|
| `npm.cmd run build` | PASS — rerun on the current edits; TypeScript and Vite production build succeeded |
| `node --check tests/e2e/release-acceptance.spec.cjs` | PASS — rerun on the current test |
| `node --check scripts/verify-restored-database.mjs` | PASS — rerun |
| `git diff --check` | PASS — rerun |
| `docker compose -f docker-compose.staging.yml config --quiet` with synthetic, non-secret values | PASS — rerun; this validates configuration only, not a live stack |
| `npm.cmd audit --omit=dev --audit-level=high` | PASS — rerun; 0 production frontend dependency vulnerabilities reported |
| Frontend unit tests and lint | NOT RUN — `package.json` defines no test or lint scripts |
| Focused and full backend Maven suites | BLOCKED — `mvn` is not recognized and there is no Maven wrapper; the latest Actions run passed 124/124 backend tests (including two MongoDB integration tests) on base SHA `c228ed96f3f415b8c67597180a1cfc42be19bf92`, whose backend is unchanged |
| Staging image build, backend readiness, MongoDB connectivity, and private-network isolation | BLOCKED locally — Docker CLI is present but its daemon is unavailable; these passed in Actions run #8 on the base SHA |
| Complete two-profile Playwright acceptance, including updated authenticated API assertion and mobile regression | BLOCKED locally — no live Compose backend/MongoDB because the Docker daemon is unavailable; NOT RUN on the updated source |
| Database backup/restore | NOT RUN on the updated source — skipped in Actions run #8 after browser failure; blocked locally by unavailable Docker daemon |
| Backend dependency vulnerability audit | NOT RUN — Maven is unavailable; npm audit covers production frontend dependencies only |
| Full security/configuration audit | NOT RUN — relevant source was spot-checked for JWT validation and placeholder rejection, authenticated routes, exact-origin CORS, MongoDB URI validation, generic error responses, and a non-root backend image; this is not exhaustive |
| Branch protection / required checks | NOT RUN — repository settings access was not established |

The repository triggers release verification on pull requests and pushes to `main`
and `master`; workflow permissions are limited to `contents: read`. Its single
required verification job runs the frontend, backend, Compose/network, browser, and
backup/restore gates in order. Branch-protection or ruleset configuration was not
verified. The latest run is red, and the local changes are not release-ready.

## Remaining release blockers

1. Commit/push the reviewed local changes only after explicit authorization, so CI can
   run the updated authenticated API and two-profile browser regressions.
2. Obtain a green release workflow run on that exact resulting commit, including
   MongoDB integration tests, private-network checks, browser acceptance, and
   backup/restore.
3. Run the focused/full backend suites and dependency audit in an environment with
   Maven installed, and verify required-check branch protection with repository-owner
   access.
4. Confirm the staging operator's rollback procedure is available before any rollout.

Passing gates in this report do not authorize a deployment. No deployment was
attempted.
