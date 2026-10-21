# Controlled staging deployment

This guide describes preparation of an isolated staging environment. It does not deploy
CryptoConnect, authorize production data, or replace the operator's Atlas backup and access
controls. The application uses MongoDB Atlas; staging must use its own protected staging URI and a
dedicated staging database.

## Runtime configuration

`docker-compose.staging.yml` starts only the backend. Supply these non-secret values through a
private Compose environment file:

| Variable | Purpose |
| --- | --- |
| `STAGING_BACKEND_IMAGE` | Unique backend image reference |
| `STAGING_CORS_ORIGIN` | Exact HTTPS frontend origin, without a path or trailing slash |
| `STAGING_PROXY_NETWORK` | Private external network shared only with the trusted TLS proxy |
| `STAGING_MONGODB_DATABASE` | Dedicated staging database name; defaults to `cryptoconnect_staging` |
| `STAGING_JWT_SECRET_FILE` | Path to a protected random JWT secret file |

Provide `STAGING_MONGODB_URI` through protected runtime configuration, not a checked-in file,
workflow variable, command-line argument, or build argument. It must address the dedicated staging
Atlas database; do not use production credentials or a production database name. The backend reads
`MONGODB_URI` and `MONGODB_DATABASE` and reads `JWT_SECRET` from its mounted secret. Never log or
publish a connection string.

Use distinct staging-only credentials and a dedicated Atlas database user with only the permissions
the application needs. Restrict Atlas network access to the staging backend egress path. Keep TLS
enabled for database connections. The backend ensures required MongoDB indexes at startup; it does
not drop collections, import SQL data, or run Flyway.

The backend runs as UID `10001`, exposes no host port, and joins only the configured proxy network.
The proxy must remove client-supplied `Forwarded` and `X-Forwarded-*` headers, set trusted values
itself, and terminate HTTPS/WSS. Restrict health endpoints and Docker/Atlas administrator access.
The application currently uses process-local rate limits and presence state, so this topology must
remain a single backend instance unless those facilities are changed.

## Build and Compose validation

From the repository root, run the full backend lifecycle and frontend production build:

```sh
(cd backend && mvn -B -ntp clean package)
npm ci
VITE_APP_MODE=api VITE_API_URL=https://chat.staging.example.net npm run build
```

Keep all required Compose variables in a protected file outside the repository. Validate and build
the staging model before starting it:

```sh
docker compose --env-file /private/path/compose.env -f docker-compose.staging.yml -p cryptoconnect-staging config --quiet
docker compose --env-file /private/path/compose.env -f docker-compose.staging.yml -p cryptoconnect-staging build backend
```

Do not put secret values into Compose YAML, source control, terminal history, tickets, or build
arguments. A local Compose secret file is a read-only mount, not an encrypted remote secret manager.
Restrict its parent directory and container-runtime administrator access. Do not use a local `.env`
or any production Atlas connection string for CI or acceptance testing.

## Backup and recovery

Maintain Atlas-managed backups and retention according to the staging operator's policy. For a
manual staging recovery exercise, use an explicitly separate empty staging restore database and a
protected archive path. Keep the staging and restore credentials private. Never substitute
production credentials or production data in this exercise.

The release workflow independently validates the application-level recovery path with a disposable
MongoDB instance: it creates synthetic browser accounts and messages, runs `mongodump`, restores
into a different database namespace, starts the backend against that restored namespace, then
verifies readiness, both logins, existing conversation history, and a newly persisted message. This
CI test does not contact Atlas and does not prove Atlas backup retention, cloud-region recovery,
TLS/WSS routing, or production readiness.

## Deployment boundary

No deployment is performed by the CI workflow. Before any staging rollout, an operator must review
the image, staging-only Atlas URI and database, permissions, secret handling, proxy policy, backup
restore evidence, and rollback procedure. A passing release gate is not authorization to deploy to
production.
