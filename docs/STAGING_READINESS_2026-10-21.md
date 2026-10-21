# Staging readiness - 2026-10-21

## Outcome

The backend regression suite and frontend production build now pass. The MongoDB-based deployment
configuration and startup safeguards were corrected without contacting a database or deployment
environment. Live Atlas, browser, TLS/WSS, backup, and proxy checks remain unavailable, so this is
not authorization to deploy automatically.

## Confirmed fixes

1. **Contact verification:** contact responses now expose the enrolled fingerprint and current
   verification state. Verification is authenticated, owner/contact scoped, requires the contact's
   enrolled key, records no caller-supplied fingerprint, and becomes stale automatically after key
   rotation. The UI refreshes the contact on success.
2. **Identity-key enrollment:** decoded public keys are strictly checked to be secp256r1/P-256. The
   positive regression test now explicitly generates a P-256 pair rather than relying on a provider
   default; the P-384 rejection test remains.
3. **Events filtering:** event-type options are derived from returned data, eliminating API options
   the backend cannot produce. Clear filters resets search, severity, and type together.
4. **Deployment/configuration:** active Compose definitions no longer configure PostgreSQL or SQL
   credentials; they use MongoDB URI/database configuration. The backend startup script now fails
   closed without a stable JWT secret. The Atlas helper now fails rather than declaring readiness
   after an unsuccessful network check.
5. **Identity-key setup UI:** Settings now provides an API-mode identity-key setup action. It
   generates a non-extractable browser-held P-256 key, persists it only in browser IndexedDB, signs
   the backend's one-time challenge, and sends only the SPKI public key plus signature. The
   resulting backend-derived fingerprint is shown in Settings. Contacts still require the *contact*
   to enroll their own key before an out-of-band comparison can be recorded.
6. **Friend authorization phase:** authenticated /api/users is now a safe paginated directory (ID,
   display name, registration time only; newest first; caller excluded). MongoDB-backed friend
   requests support send, incoming/outgoing lists, accept, and reject. A unique canonical pair index
   prevents duplicate requests. New conversations require accepted friendship; REST and WebSocket
   sends both use ChatMessageService and require accepted friendship before persistence/broadcast.
   Existing conversations remain readable but cannot receive new messages until friendship is
   accepted.
7. **Presence implementation:** real online/offline presence implemented with process-local session
   registry. Sessions are registered only after JWT authentication; no client-supplied user ID is
   accepted. Each connection receives an internal random registry ID never sent to clients. Multiple
   simultaneous sessions keep a user online until the final session closes. GET /api/presence and
   WebSocket presence events are restricted to accepted friends only.
8. **Environment documentation:** .env.example now documents CORS_ORIGIN (required for production
   -- must be the exact HTTPS frontend origin) and PRESENCE_STALE_SECONDS (optional, default 90).

## Trust model

Key enrollment proves possession of the corresponding private key. Contact verification records a
user's out-of-band comparison of that displayed fingerprint; it does not establish real-world
identity and it does not make server-readable chat end-to-end encrypted.

## Phase 4 - Actual local test results

### Backend test suite

Command: `& "C:\Program Files\apache-maven-3.10.0\bin\mvn.cmd" -f backend\pom.xml test`

| Test class | Tests | Failures | Errors | Skipped |
|---|---|---|---|---|
| AuthControllerTest | 8 | 0 | 0 | 0 |
| AuthRouteSecurityTest | 2 | 0 | 0 | 0 |
| CorsSecurityTest | 4 | 0 | 0 | 0 |
| KeyEnrollmentServiceTest | 4 | 0 | 0 | 0 |
| ChatContractTest | 10 | 0 | 0 | 0 |
| ChatMessageRateLimitTest | 4 | 0 | 0 | 0 |
| ChatMessageServiceTest | 7 | 0 | 0 | 0 |
| ChatRealtimeHandlerTest | 11 | 0 | 0 | 0 |
| ConversationServiceTest | 7 | 0 | 0 | 0 |
| DashboardControllerTest | 3 | 0 | 0 | 0 |
| DashboardServiceTest | 2 | 0 | 0 | 0 |
| MongoConfigurationTest | 5 | 0 | 0 | 0 |
| SecurityEventControllerTest | 2 | 0 | 0 | 0 |
| SecurityEventServiceTest | 4 | 0 | 0 | 0 |
| AbuseProtectionTest | 1 | 0 | 0 | 0 |
| JwtServiceTest | 4 | 0 | 0 | 0 |
| ContactControllerTest | 9 | 0 | 0 | 0 |
| FriendServiceTest | 14 | 0 | 0 | 0 |
| PresenceControllerTest | 2 | 0 | 0 | 0 |
| PresenceRegistryTest | 3 | 0 | 0 | 0 |
| UserControllerTest | 8 | 0 | 0 | 0 |
| HealthControllerTest | 4 | 0 | 0 | 0 |
| **Total** | **118** | **0** | **0** | **0** |

**Exit code: 0. BUILD SUCCESS.**

### Frontend build

Command: `npm.cmd run build`

- TypeScript compilation: 0 errors
- Vite bundle: built in 1.78 s
- **Exit code: 0.**

## Phase 3 - Regression and authorization verification (static analysis)

| Check | Result | Notes |
|---|---|---|
| Friend-request duplicate handling | PASS | FriendService.send checks existing pair before save; DuplicateKeyException also caught. |
| Self-request handling | PASS | FriendService.send rejects sender.equals(recipient). |
| Accept/reject authorization | PASS | FriendService.decide checks recipientId.equals(actor); sender and third-party are forbidden. |
| Non-pending decide | PASS | decide rejects if status is not PENDING. |
| Public directory privacy | PASS | UserController exposes only id, name, registeredAt; email/key fields excluded; caller filtered out. |
| Directory pagination | PASS | Page, size, and query validated; max size 50 enforced. |
| New conversation authorization | PASS | ConversationService/ConversationCreator requires accepted friendship to open new conversations. |
| REST message authorization | PASS | ChatMessageService.send calls assertOneToOneMember then areFriends; rejected sends are not persisted or broadcast. |
| WebSocket message authorization | PASS | ChatRealtimeHandler.sendMessage requires prior authenticated subscribe; delegates to ChatMessageService.send; sender identity from session, not client frame. |
| Authenticated sender identity | PASS | userId(session) reads from session attributes set during JWT authentication; client-supplied senderId fields are ignored. |
| Existing conversation history | PASS | ChatMessageService.assertOneToOneMember confirms membership before read; REST messages list uses same guard. |
| New-send policy | PASS | areFriends check in ChatMessageService.send gates new sends without deleting historical messages. |
| Identity-key enrollment | PASS | KeyEnrollmentService validates secp256r1 curve, verifies challenge signature, derives fingerprint server-side. |
| Fingerprint verification | PASS | ContactController records caller's verification of contact's enrolled fingerprint; no caller-supplied fingerprint accepted. |
| Rejected sends not persisted | PASS | Authorization failures throw before messages.saveAndFlush; event publisher not called. |
| Rejected sends not broadcast | PASS | ChatMessageSavedEvent only published after successful persistence; onMessageSaved only fires on event. |

## Phase 2 - Presence implementation details

### Architecture

- **Process-local session registry** (PresenceRegistry): appropriate for the single-instance
  Render/Compose deployment topology documented in docker-compose.staging.yml.
- Session registered only after successful JWT validation in ChatRealtimeHandler.authenticate.
- Each WebSocket session receives an internal random UUID registry ID (presenceSessionId);
  this ID is stored only in the WebSocketSession attributes and is never sent to any client.
- Multiple concurrent sessions per user are tracked in userSessions (ConcurrentHashMap of Set<String>).
- A user is marked online when the first session connects and offline only when the last session disconnects.
- heartbeat frames from the client extend the session's lastSeen timestamp.
- A scheduled task runs every 30 seconds and disconnects sessions with no heartbeat for
  >= PRESENCE_STALE_SECONDS seconds (default: 90, minimum enforced: 30).
- Token expiry and revocation are checked in sessionValid; expired/revoked sessions trigger
  presence.disconnect before closure.
- Duplicate disconnect calls (stale then explicit) are safe -- sessions.remove returns null
  on the second call and is a no-op.

### Privacy controls

- GET /api/presence requires authentication and validates every requested userId is an
  accepted friend of the caller; any non-friend in the list results in a 403.
- WebSocket presence events are broadcast only to sessions whose authenticated user is an
  accepted friend of the subject (friends.areFriends(viewer, event.userId())).
- No connection tokens, internal session IDs, IP addresses, or last-seen timestamps are exposed.
- Directory users (non-friends) cannot observe any user's availability.

### Multi-instance constraint

Presence is deliberately process-local. The active staging Compose definition
(docker-compose.staging.yml) deploys **one backend service** with no shared state store.
**Do not scale backend replicas** or enable load-balancing across instances without first
implementing a shared presence store (e.g. a Redis HSET per user, or a MongoDB-backed heartbeat
collection). This constraint is documented here; no Redis or other external service has been
introduced without authorization.

### Presence test coverage

| Test | Class | Result |
|---|---|---|
| Connect marks user online; disconnect marks offline | PresenceRegistryTest | PASS |
| First-session online event; no duplicate event on second connect | PresenceRegistryTest | PASS |
| One disconnect with active second session -- user stays online | PresenceRegistryTest | PASS |
| Final disconnect marks offline | PresenceRegistryTest | PASS |
| Stale session expiry; duplicate disconnect is safe | PresenceRegistryTest | PASS |
| Reconnect -- new session registers; old entry absent | PresenceRegistryTest | PASS |
| Non-friend cannot query presence | PresenceControllerTest | PASS |
| Accepted friend can query presence | PresenceControllerTest | PASS |
| Presence event delivered only to accepted-friend WebSocket sessions | ChatRealtimeHandlerTest | PASS |
| Stranger WebSocket session does not receive presence event | ChatRealtimeHandlerTest | PASS |

## Phase 5 - Safe live integration plan (NOT TESTED -- no environment provided)

NOTE: None of the following have been executed. This is a test plan for execution against an
isolated, non-production environment using synthetic accounts only.

### Prerequisites

- A dedicated non-production MongoDB Atlas cluster or database (e.g. cryptoconnect_smoke).
- Two synthetic accounts (e.g. smoke-a@example.test, smoke-b@example.test).
- A running backend instance pointed at the isolated cluster.
- No production accounts or data used for any destructive test.

### Test plan

| Scenario | How to verify | Expected |
|---|---|---|
| Atlas connectivity | GET /health/ready | 200 UP |
| Index creation on startup | db.friendRequests.getIndexes() in Atlas | Unique index on participantLow+participantHigh present |
| Register smoke-a and smoke-b | POST /api/auth/register | 201; tokens returned |
| Login with bad password | POST /api/auth/login | 401 |
| Directory lists other users | GET /api/users?query=smoke | 200; only id/name/registeredAt |
| smoke-a sends friend request to smoke-b | POST /api/friend-requests | 201 PENDING |
| Duplicate request is rejected | Same POST again | 409 |
| smoke-b accepts | POST /api/friend-requests/{id}/accept | 200 ACCEPTED |
| smoke-b cannot accept again | Same POST | 409 |
| Sender cannot reject own outgoing request | POST /api/friend-requests/{id}/reject as smoke-a | 403 |
| smoke-a opens conversation with smoke-b | POST /api/conversations | 201 |
| Non-friend cannot open conversation | smoke-c (no accepted request) | 403 |
| smoke-a sends REST message | POST /api/conversations/{id}/messages | 201 |
| Non-friend cannot send REST message | smoke-c token, same conversation | 403/404 |
| WebSocket authenticate with valid token | WS authenticate frame | type:ready received |
| WebSocket authenticate with invalid token | WS bad token | Close 1003 |
| WebSocket subscribe and receive message | WS send from smoke-a; smoke-b WS receives | type:message on smoke-b |
| Non-friend WebSocket send is rejected | smoke-c WS after subscribe attempt | type:error or close |
| smoke-b queries presence of online smoke-a | GET /api/presence?userId={smoke-a} as smoke-b | online:true |
| Non-friend cannot query presence | smoke-c queries smoke-a | 403 |
| Multi-session: smoke-a opens two tabs | Two WS connections as smoke-a | Both show online |
| Close one tab; smoke-a still online | Disconnect one WS; query from smoke-b | Still online:true |
| Close second tab; smoke-a goes offline | Disconnect second WS; query from smoke-b | online:false |
| Reconnect presence event via WebSocket | smoke-a reconnects; smoke-b WS receives presence event | online:true event received |
| Identity-key enrollment (smoke-a) | POST /api/auth/me/key with valid P-256 challenge-response | 200 with fingerprint |
| Contact verify (smoke-b verifies smoke-a key) | POST /api/contacts/{smoke-a}/verify | 200 with verified fingerprint |

## Phase 6 - Deployment readiness (NOT DEPLOYED)

WARNING: None of the following have been verified against a live provider. Configuration is reviewed
locally; no external settings were changed.

### Required environment variable names

| Variable | Required | Notes |
|---|---|---|
| JWT_SECRET | Required | Minimum 32 bytes of random entropy; stable across restarts; never logged or printed |
| MONGODB_URI | Required | Atlas connection string; stored as Docker secret in staging Compose |
| MONGODB_DATABASE | Optional | Defaults to cryptoconnect; use a dedicated staging database |
| CORS_ORIGIN | Required for production | Exact HTTPS origin of deployed frontend; no trailing slash; no wildcards |
| PRESENCE_STALE_SECONDS | Optional | Default 90; minimum enforced at 30 |
| PORT | Optional | Default 8080 |
| JWT_EXPIRATION_MINUTES | Optional | Default 60 |
| RATE_LIMIT_* | Optional | See application.yml for defaults |

### Configuration audit

| Item | Status | Notes |
|---|---|---|
| No hardcoded secrets in source | PASS | JWT secret, MongoDB URI, CORS origin all from environment |
| JWT secret required at startup | PASS | start-backend.ps1 fails closed without it; application.yml uses $JWT_SECRET with no default |
| CORS allowlist | PASS (config) | Single origin from $CORS_ORIGIN; applied to REST and WebSocket handlers |
| No localhost origin in production | MANUAL ACTION REQUIRED | Default localhost:5173 applies only when CORS_ORIGIN is unset; must be set in staging/prod |
| WebSocket WSS endpoint | MANUAL ACTION REQUIRED | realtime.ts auto-upgrades https to wss; TLS termination must be at the reverse proxy |
| MongoDB connection | MANUAL ACTION REQUIRED | URI and credentials must be set from secrets; never in source or image |
| Health endpoint safety | PASS | /health/live and /health/ready return only status strings; no internal details exposed |
| Nested-route SPA refresh | MANUAL ACTION REQUIRED | Hosting provider (Firebase/Render) must rewrite /* to index.html |
| No localhost production URLs | PASS (config) | VITE_API_URL is set at build time; production build uses the value from the environment |
| Database backup and restore | MANUAL ACTION REQUIRED | Atlas automated backups should be enabled; operator must run and verify an isolated restore |

### Single-instance constraint

docker-compose.staging.yml defines one backend replica. Presence is process-local and
correct in this topology. Before scaling beyond one instance, a shared presence store is required.

## Staging checklist (updated)

| Gate | Status | Evidence / blocker |
|---|---|---|
| Frontend production build | PASS | npm.cmd run build, exit 0, built in 1.78 s |
| Full backend unit/web suite | PASS | 118 tests, 0 failures, 0 errors, 0 skipped; exit 0 |
| Focused key-enrollment regression | PASS | Included in the 118-test total |
| Presence lifecycle tests | PASS | PresenceRegistryTest (3), PresenceControllerTest (2), ChatRealtimeHandlerTest (11) all green |
| Friend-request lifecycle tests | PASS | FriendServiceTest (14) all green |
| WebSocket authentication tests | PASS | ChatRealtimeHandlerTest all green |
| Message authorization (rejected before persist/broadcast) | PASS | Verified in ChatMessageServiceTest and ChatRealtimeHandlerTest |
| Identity-key P-256 enrollment | PASS | KeyEnrollmentServiceTest green |
| .env.example completeness | PASS | Now documents all required and optional variables |
| MongoDB Atlas readiness and indexes | NOT TESTED | No running backend or authorized Atlas target was supplied |
| Live identity enrollment/verification | NOT TESTED | Requires isolated synthetic accounts and non-production MongoDB target |
| Browser two-account flows, reconnect, multi-tab presence | NOT TESTED | Requires two synthetic accounts and running isolated API/frontend |
| Render/Firebase CORS, HTTPS/WSS, API URL, health routing, rewrites | NOT TESTED | No provider environment or endpoint was supplied; no external settings changed |
| Backup/restore | MANUAL ACTION REQUIRED | Staging operator must document and exercise an encrypted backup plus isolated restore |
| Git diff baseline | BLOCKED | This workspace has no .git metadata; branch, baseline diff, git diff --check cannot be run |

## Prioritized blockers

| Priority | Item |
|---|---|
| P0 | Multi-instance decision: confirm staging is a single backend instance before enabling; document approval before scaling |
| P0 | Isolated integration: execute Phase 5 test plan against a non-production MongoDB target with synthetic accounts |
| P1 | Transport/configuration: verify exact production CORS_ORIGIN, frontend API URL, HTTPS-to-WSS upgrade, health endpoint proxy exposure, and nested-route rewrites |
| P1 | Recovery: enable Atlas automated backups; run an operator-approved restore test against isolated data |
| P2 | Source baseline: restore/obtain repository metadata before release review so the final diff and whitespace check can be audited |

## Files changed during this sprint

- .env.example -- added CORS_ORIGIN and PRESENCE_STALE_SECONDS documentation
- docs/STAGING_READINESS_2026-10-21.md -- updated with Phase 4-7 results

Files implemented in previous sessions (not changed this sprint):
- backend/.../user/PresenceRegistry.java
- backend/.../user/PresenceController.java
- backend/.../user/PresenceChangedEvent.java
- backend/.../chat/ChatRealtimeHandler.java
- backend/test/.../user/PresenceRegistryTest.java
- backend/test/.../user/PresenceControllerTest.java
- backend/test/.../chat/ChatRealtimeHandlerTest.java (presence audience test)

## Recommendation

**NOT READY FOR STAGING.** Local build and test gates pass (118 backend tests, frontend build), but
the required live MongoDB, browser/API, transport-security, recovery, and deployment-topology
verification gates are not yet satisfied. Execute the Phase 5 test plan against an isolated
non-production environment and resolve the P0/P1 blockers before proceeding.

## Release continuation - 2026-10-21

This section records the follow-up privacy fix and the fresh local validation. It supersedes
earlier test totals where they differ.

### Source and backup status

| Check | Status | Evidence |
|---|---|---|
| Workspace | PASS | `C:\Users\My\Desktop\All desk\Website\cryptoconnect` exists |
| Existing Git metadata | BLOCKED | No `.git` directory is present; Git was not initialized and no metadata was overwritten |
| `.gitignore` review | PASS | Excludes `.env` and environment variants (while allowing `.env.example`), credentials/key material, `node_modules`, build output, logs, and local data/database dumps |
| Existing `.env` handling | PASS | `.env` exists, is covered by `.gitignore`, and its contents were not read or printed |
| Backup completion / recursion | PASS | `cryptoconnect-backup-2026-10-21` exists, contains backend and README, and has no nested copy of itself |
| Backup inventory | PASS | Before these follow-up edits, 393 comparable files matched the source inventory (excluding generated `node_modules`, `target`, and Git metadata); zero missing/extra files; key source/config/report files matched SHA-256 |
| Backup freshness | MANUAL ACTION REQUIRED | The verified backup predates the changes below; it was not overwritten or refreshed |

### Confirmed issue and resolution

| Priority | Finding | Resolution |
|---|---|---|
| P1 | Both `GET /api/conversations` and `POST /api/conversations` serialized participant email and raw public-key fields even though current conversation UI only needs name and the verification fingerprint | `ParticipantResponse` now contains only ID, display name, and key fingerprint. No participant email or raw public key is serialized by these endpoints. The API still returns a user's own enrolled public key through authenticated account DTOs; contact verification continues to use the owner-scoped contact endpoint and server-derived fingerprint. |

Regression tests cover unauthenticated conversation listing/creation, empty results for a non-participant's list scope, authenticated list scoping, safe participant serialization from both conversation endpoints, and absence of password hashes, private-key fields, and tokens. Existing key enrollment and contact verification tests remain in the full suite.

### Fresh local validation

| Gate | Status | Result |
|---|---|---|
| Backend full suite | PASS | `& "C:\Program Files\apache-maven-3.10.0\bin\mvn.cmd" -f backend\pom.xml test` — exit 0; 122 tests, 0 failures, 0 errors, 0 skipped; `BUILD SUCCESS` |
| Frontend production build | PASS | `npm.cmd run build` — exit 0; TypeScript succeeded and Vite completed production bundle |
| Conversation participant privacy regressions | PASS | Included in `ChatContractTest`; unauthenticated access rejected; non-participant list returned no details; no email/publicKey/passwordHash/privateKey/token in participant responses |
| Contact verification regression | PASS | Existing contact verification suite passed; authorized contact responses retain the current enrolled fingerprint and verification status |
| Sensitive user serialization | PASS | Auth profile regression confirms password hash, private-key field, and token are absent; directory and contact DTO regressions remain green |
| Live Atlas/database/API/WebSocket/browser checks | NOT TESTED | No authorized non-production database/runtime was supplied |
| Hosting/CORS/HTTPS/WSS/SPA rewrite and provider health checks | NOT TESTED | No provider configuration or deployed endpoint was supplied |
| Deployment | NOT DEPLOYED | No provider settings changed and no public endpoint was created |

### Current blockers and owner actions

1. **BLOCKED - isolated integration:** provide an authorized non-production MongoDB target and run
   the synthetic-account Phase 5 plan, including friend authorization, conversation access,
   identity enrollment/verification, WebSocket authorization, and presence lifecycle.
2. **MANUAL ACTION REQUIRED - deployment config:** set a stable secret and protected MongoDB URI,
   exact HTTPS `CORS_ORIGIN`, and production frontend API URL in provider secrets; verify HTTPS/WSS,
   health routing, and SPA rewrites before any public rollout.
3. **MANUAL ACTION REQUIRED - topology:** confirm a single backend instance while presence remains
   process-local; do not scale to multiple instances.
4. **MANUAL ACTION REQUIRED - recovery:** enable provider/database backups and verify an isolated
   restore. The local source backup is a pre-fix snapshot and is not a database backup.
5. **BLOCKED - source diff:** obtain/restore repository metadata safely before relying on branch
   history or a Git diff for release review. No `git init`, commit, or push was performed.

**Current outcome: NOT READY — CRITICAL BLOCKERS REMAIN.** Local tests pass and the confirmed
participant data overexposure is fixed, but the live authorization/integration and deployment
configuration gates remain unverified. Do not deploy publicly until these gates are resolved.

## Security and staging continuation - 2026-10-21

### Security review and authorization verification

A fresh read-only security review examined authentication/logout, friend-request authorization,
conversation membership/access, REST message history/send/receipts, WebSocket authentication,
subscription/message/broadcast handling, and friend-restricted presence. **No confirmed critical or
high-severity code vulnerability was reported.** The review is source/test inspection, not a live
integration test or independent proof of provider behavior.

| Area | Local evidence | Result |
|---|---|---|
| Friend request ownership and state transitions | `FriendServiceTest` and `FriendController`/`FriendService` review | PASS (source + regression suite) |
| Conversation creation and history membership | `ConversationServiceTest`, `ChatMessageServiceTest`, `ChatContractTest` and controller/service review | PASS (source + regression suite) |
| REST send/read authorization before persistence | `ChatMessageServiceTest` and `ChatContractTest` | PASS (source + regression suite) |
| WebSocket authentication, subscription, sender identity, message authorization and recipient routing | `ChatRealtimeHandlerTest` and handler review | PASS (source + regression suite) |
| Online/offline, multi-session, stale session cleanup, friend-only presence | `PresenceRegistryTest`, `PresenceControllerTest`, `ChatRealtimeHandlerTest` and registry/controller review | PASS (source + regression suite) |
| Deployed MongoDB behavior, real two-account WebSocket flow, browser origin/token revocation, proxy/TLS, multi-instance behavior | No authorized target available | NOT TESTED |

These local PASS results do not replace integration testing against an isolated non-production
MongoDB database. Presence remains process-local; staging must stay at one backend instance.

### Build/deployment preparation

The backend Dockerfile previously copied a pre-existing `backend/target` JAR. Since generated
`target` output is ignored and is not present in a clean source checkout, that Docker build path
was not reproducible from a clean Render checkout. It now builds the JAR in a Maven/JDK build stage
and copies only the artifact to the non-root JRE runtime stage. `backend/.dockerignore` prevents
generated output, logs, and local secret/key files from entering the Docker build context.

| Gate | Status | Evidence |
|---|---|---|
| Backend full suite on current source | PASS | `& "C:\Program Files\apache-maven-3.10.0\bin\mvn.cmd" -f backend\pom.xml test` — exit 0; 122 tests, 0 failures, 0 errors, 0 skipped; `BUILD SUCCESS` |
| Frontend production build on current source | PASS | `npm.cmd run build` — exit 0; TypeScript passed and Vite built successfully |
| Clean Docker image build | NOT TESTED | Docker is unavailable in this workspace; the multi-stage Dockerfile must be built in CI or a staging runner |
| Render/Firebase/Atlas provider setup | NOT TESTED | No provider projects, credentials, or endpoints were supplied; no external changes made |
| Firebase SPA rewrite | BLOCKED | No `firebase.json` or `.firebaserc` exists; owner must confirm Firebase project/domain before adding/activating Hosting config |
| Staging procedure | PASS (documentation only) | Current MongoDB/Render/Firebase and synthetic-account checklist added to `docs/STAGING_DEPLOYMENT.md`; no live steps executed |

### Exact changes in this continuation

- `backend/Dockerfile` — build the backend JAR inside a Maven/JDK stage for clean Docker builds.
- `backend/.dockerignore` — exclude generated output, logs, and local credentials/key material.
- `docs/STAGING_DEPLOYMENT.md` — add a current MongoDB Atlas, Render, Firebase Hosting, synthetic
  integration, and recovery checklist; it explicitly supersedes historical PostgreSQL instructions
  for the active MongoDB source tree.
- `docs/STAGING_READINESS_2026-10-21.md` — record the security review outcome, current test results,
  verified authorization/presence review areas, Docker/provider blockers, and owner actions.

### Remaining release blockers and next action

1. **BLOCKED — owner action:** provide/approve an isolated non-production Atlas database, Render
   staging service, and Firebase staging project/domain. Keep credentials in provider secret
   storage; do not paste them into chat or source.
2. **NOT TESTED — staging runner action:** build the Docker image from a clean checkout, deploy only
   to the private staging target, run the synthetic-account flow in the checklist, and capture
   sanitized status evidence.
3. **MANUAL ACTION REQUIRED:** configure Atlas database-scoped access, network restrictions,
   backups, and isolated restore; configure stable `JWT_SECRET`, exact Firebase HTTPS origin in
   `CORS_ORIGIN`, and HTTPS API URL in the frontend build.
4. **MANUAL ACTION REQUIRED:** verify Render HTTPS/WSS upgrades, exact-origin CORS, Firebase nested
   route rewrites, health route exposure, log redaction, restart behavior, and single-instance
   presence using live endpoints.
5. **BLOCKED — source baseline:** no `.git` metadata exists. Obtain the intended repository baseline
   without overwriting user data before relying on a Git diff or deploying. No Git initialization,
   commit, push, DNS change, provider mutation, or public deployment was performed.

**Current outcome remains NOT READY — CRITICAL RELEASE GATES UNVERIFIED.** The source review and
local regression suite found no confirmed critical/high code issue in the reviewed authorization
and presence paths, but production privacy/authorization behavior, provider configuration,
integration, recovery, and the clean container build have not been verified. Do not deploy
publicly. The required next action is owner approval/provisioning of isolated staging resources,
followed by the documented tests and a fresh release decision.

## Deployment preparation follow-up - 2026-10-21

### Verified in this preparation pass

| Check | Status | Evidence |
|---|---|---|
| Current deployment/readiness documents reviewed | PASS | Reviewed current-stack notice, MongoDB staging checklist, synthetic tests, restore guidance, and release blockers |
| Docker availability | BLOCKED | `Get-Command docker` returned `NOT_FOUND`; Docker version/build was not run |
| Dockerfile static review | PASS (inspection only) | Multi-stage Maven/JDK build compiles `backend` source and copies the expected versioned JAR into a non-root JRE image; `backend/.dockerignore` excludes target, logs, `.env` variants and key files. This is not a Docker build or image validation |
| Render/Firebase/Atlas configuration | NOT TESTED | No provider project/configuration or endpoint is available; no provider access attempted |
| Local backend/frontend result | PASS (prior verified run, unchanged application source) | Backend suite: 122 tests, 0 failures/errors/skips, exit 0; frontend `npm.cmd run build`, exit 0. No application code changed in this documentation-only follow-up |
| Live integration, backup restoration, public exposure | NOT TESTED | No staging database or provider resources used; nothing deployed |

### Exact environment-variable names

Names below were checked against `backend/src/main/resources/application.yml`, `vite.config.ts`,
and frontend `import.meta.env` references. No values are recorded here.

- **Render protected runtime configuration:** `MONGODB_URI` (secret, required),
  `MONGODB_DATABASE` (set explicitly for staging), `JWT_SECRET` (secret, required),
  `CORS_ORIGIN` (set explicitly to exact Firebase HTTPS origin).
- **Render platform value:** `PORT` is supplied by Render and honored by Spring.
- **Optional backend settings:** `JWT_EXPIRATION_MINUTES`, `PRESENCE_STALE_SECONDS`,
  `RATE_LIMIT_AUTHENTICATION_PER_MINUTE`, `RATE_LIMIT_REGISTRATION_PER_HOUR`,
  `RATE_LIMIT_SEARCH_PER_MINUTE`, `RATE_LIMIT_WRITES_PER_MINUTE`.
- **Firebase/frontend build-time configuration:** `VITE_APP_MODE=api` and
  `VITE_API_URL=https://<verified-render-service-origin>`. These are frontend build inputs, not
  Render secrets; never supply MongoDB/JWT secrets to the frontend build or Hosting.

### Commands prepared, not executed

Run locally from the repository root after Docker Desktop/Engine is installed and running:

```powershell
docker build --pull --file backend\Dockerfile --tag cryptoconnect-backend:staging-check backend
```

This command was **not executed** because Docker is unavailable in the current workspace. It only
builds a local image; it does not contact a database, deploy, or validate provider behavior.

After an owner-approved staging origin exists, the frontend build command is:

```powershell
$env:VITE_APP_MODE = 'api'
$env:VITE_API_URL = 'https://<verified-render-service-origin>'
npm.cmd run build
```

It was not run with a provider origin in this preparation pass. Do not replace the placeholder
with a local, preview, or unverified public URL for a release candidate.

### Preparation versus approval/provider actions

**Prepared locally:** reviewed the Docker build context and ignore rules; recorded the local
image-build command; enumerated exact runtime/build environment names; documented the synthetic
friend/conversation/REST/WebSocket/presence/CORS/TLS and separate-target recovery checks in
`docs/STAGING_DEPLOYMENT.md`.

**Requires owner approval and provider access:** create/select paid or billable Atlas/Render/Firebase
resources; set protected provider variables; configure Atlas network/database users and backup
retention; set Firebase domains/HTTPS and SPA rewrite; run staging services and synthetic account
tests; restore a staging backup into a separate target; make DNS changes; push code; or deploy.
None of these actions occurred.

### Next owner action

Install/start Docker locally and run the exact local image-build command above, then report its
exit code and sanitized result. Separately, approve and provision isolated staging resources before
any Atlas/Render/Firebase integration or backup-restore test. Maintain the existing backup and do
not point any test at production. Current release outcome remains **NOT READY — STAGING NOT
VERIFIED**.
