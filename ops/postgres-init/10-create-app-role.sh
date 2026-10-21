#!/bin/sh
set -eu

: "${STAGING_DATABASE_USERNAME:?STAGING_DATABASE_USERNAME is required}"
: "${STAGING_DATABASE_PASSWORD_FILE:?STAGING_DATABASE_PASSWORD_FILE is required}"
: "${STAGING_MIGRATOR_USERNAME:?STAGING_MIGRATOR_USERNAME is required}"
: "${STAGING_MIGRATOR_PASSWORD_FILE:?STAGING_MIGRATOR_PASSWORD_FILE is required}"

validate_role_name() {
  case "$1" in
    ''|*[!a-zA-Z0-9_]*)
      printf '%s\n' 'Invalid staging database role name.' >&2
      exit 1
      ;;
  esac
}

validate_secret_file() {
  secret_value=$(cat "$1") || {
    printf '%s\n' 'Unable to read a required staging database secret file.' >&2
    exit 1
  }
  case "$secret_value" in
    ''|*[!a-fA-F0-9]*)
      printf '%s\n' 'Staging database passwords must be hexadecimal secret material.' >&2
      exit 1
      ;;
  esac
  if [ "${#secret_value}" -lt 64 ]; then
    printf '%s\n' 'Staging database passwords must contain at least 32 random bytes.' >&2
    exit 1
  fi
  unset secret_value
}

validate_role_name "$STAGING_DATABASE_USERNAME"
validate_role_name "$STAGING_MIGRATOR_USERNAME"
if [ "$STAGING_DATABASE_USERNAME" = "$STAGING_MIGRATOR_USERNAME" ] ||
   [ "$STAGING_DATABASE_USERNAME" = postgres ] ||
   [ "$STAGING_MIGRATOR_USERNAME" = postgres ]; then
  printf '%s\n' 'Application, migrator, and bootstrap role names must be distinct.' >&2
  exit 1
fi
validate_secret_file "$STAGING_DATABASE_PASSWORD_FILE"
validate_secret_file "$STAGING_MIGRATOR_PASSWORD_FILE"

psql --no-psqlrc --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_role STAGING_DATABASE_USERNAME
\getenv migrator_role STAGING_MIGRATOR_USERNAME

SELECT NOT EXISTS (
  SELECT 1 FROM pg_auth_members
  WHERE member IN (SELECT oid FROM pg_roles WHERE rolname IN (:'app_role', :'migrator_role'))
) AS roles_have_no_memberships \gset
\if :roles_have_no_memberships
\else
\echo 'Staging app or migrator role already has role memberships; refusing to proceed.'
\quit 3
\endif

SELECT format('CREATE ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', :'app_role')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', :'app_role') \gexec
SELECT format('CREATE ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', :'migrator_role')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migrator_role') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', :'migrator_role') \gexec

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE cryptoconnect_staging TO :"app_role", :"migrator_role";
REVOKE CREATE ON SCHEMA public FROM :"app_role";
GRANT USAGE ON SCHEMA public TO :"app_role";
GRANT USAGE, CREATE ON SCHEMA public TO :"migrator_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_role";
SQL

export STAGING_DATABASE_PASSWORD STAGING_MIGRATOR_PASSWORD
STAGING_DATABASE_PASSWORD=$(cat "$STAGING_DATABASE_PASSWORD_FILE")
STAGING_MIGRATOR_PASSWORD=$(cat "$STAGING_MIGRATOR_PASSWORD_FILE")
# Keep standard PostgreSQL statement and duration logs from recording the password update SQL.
PGOPTIONS='-c log_statement=none -c log_min_duration_statement=-1' \
  psql --no-psqlrc --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'PASSWORD_SQL'
\getenv app_role STAGING_DATABASE_USERNAME
\getenv app_password STAGING_DATABASE_PASSWORD
\getenv migrator_role STAGING_MIGRATOR_USERNAME
\getenv migrator_password STAGING_MIGRATOR_PASSWORD
SELECT format('ALTER ROLE %I PASSWORD %L', :'app_role', :'app_password') \gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'migrator_role', :'migrator_password') \gexec
PASSWORD_SQL

unset STAGING_DATABASE_PASSWORD STAGING_MIGRATOR_PASSWORD
