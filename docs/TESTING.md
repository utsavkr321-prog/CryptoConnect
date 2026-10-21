# Testing

## Unit and web tests

From `backend/`, run `mvn test`. The suite uses mocks and Spring MVC test slices and does not require a MongoDB service. Keep command output private if the test framework emits generated development-only credentials.

The frontend type check and production bundle are verified with `npm.cmd run build` on Windows PowerShell.

## MongoDB live integration

Live persistence tests are not currently configured. Before adding them, require a dedicated disposable local MongoDB instance and a test database URI restricted to loopback. Tests must never accept an Atlas or arbitrary remote URI by default. Verify index creation, duplicate-key behavior, serialization, TTL behavior, persistence across restart, and authenticated API/WebSocket flows. Do not run Flyway: PostgreSQL migration files are archival only.

A passing unit/web suite and frontend build do not prove live database persistence, Atlas configuration, browser acceptance, backup restoration, TLS/WSS proxy behavior, encryption at rest, or production readiness.
