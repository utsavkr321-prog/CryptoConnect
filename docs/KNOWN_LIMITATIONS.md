# Known limitations

- API chat is server-readable, not end-to-end encrypted. The backend and MongoDB can access new message text.
- HTTPS/WSS is required in deployed environments. Database volume and backup encryption at rest are operator/platform responsibilities and have not been verified for a live deployment.
- Pre-V7 AES-GCM messages remain as `LEGACY_ENCRYPTED`. Their page-memory keys were not exchanged or persisted, so their content cannot be recovered; the API marks them unavailable and omits the legacy ciphertext.
- There is no recipient key establishment, trusted device identity, identity verification, ratchet state, forward secrecy, or E2EE recovery. Legacy public-key/fingerprint fields are metadata only.
- The rate limiter is process-local and does not coordinate across application replicas.
- Live MongoDB persistence, Atlas connectivity, data migration, Docker/Compose deployment, real HTTPS/WSS proxy behavior, browser acceptance, and application-level restore remain unverified. No existing PostgreSQL data has been moved.
- No independent security audit or production-readiness review is claimed.
