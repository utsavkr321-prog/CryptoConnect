# Release verification workflow

The [release-verification.yml](../.github/workflows/release-verification.yml) workflow verifies
backend behavior, the frontend build, the staging Compose model, browser acceptance, and a
MongoDB backup/restore cycle. It does not deploy.

## Database isolation

The backend integration suite uses Testcontainers to start its own `mongo:7.0` container and
overrides the application connection properties with that container's disposable replica-set URI
and a CI-only database name. It never reads an Atlas secret or accepts a caller-provided database
URI. The test checks actual MongoDB persistence, case-insensitive lookup, required unique-index
creation, and duplicate-email rejection.

Compose/browser/restore acceptance uses a second run-specific `mongo:7.0` container on a private
Docker network. It has no published port or persistent volume. The Compose file starts only the
backend, configured to connect to this disposable MongoDB by its private network alias. CI creates
synthetic users/messages and restores a `mongodump` archive into a separate database name before
checking application-level recovery. The workflow rejects local environment files and does not
configure or connect to MongoDB Atlas.

## Quality gates

The workflow runs:

1. `npm ci`, API build configuration rejection checks, and the frontend production build.
2. `mvn clean package`, with Surefire results checked for failures, errors, skips, and execution of
   both MongoDB integration tests.
3. `docker compose config --quiet`, a backend image build, readiness, non-root execution, secret
   mount, port exposure, and private-network checks.
4. The two-profile Playwright browser acceptance suite through a loopback-only proxy.
5. A real MongoDB archive, restore to a different database, backend restart against that restored
   data, and API verification of restored logins/history plus a newly persisted message.

Cleanup is scoped to this workflow run's Docker containers, network, Compose project, and temporary
directory. The MongoDB container is not published to the host and is removed after the job. No
quality gate is disabled or replaced with a mock-only pass.

The loopback proxy is synthetic HTTP and does not verify public TLS/WSS, Atlas network policy,
production secret rotation, or managed-backup retention. A successful CI run is not a production
deployment authorization.
