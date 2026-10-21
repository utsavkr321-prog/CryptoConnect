# Development roadmap

1. Keep the frontend build green and add unit tests for Web Crypto helpers.
2. Add a Spring Boot service with PostgreSQL, migrations, validation, structured errors, and environment-based configuration.
3. Implement registration, email verification, Argon2id/bcrypt password hashing, secure session cookies, throttling, logout, and authorization tests.
4. Add users, contact requests, conversations, memberships, encrypted-message envelopes, key metadata, and security-event tables.
5. Replace mock adapters with typed REST services and add loading/error/expiry handling.
6. Add a reviewed asynchronous key-establishment protocol/library. Until then, keep chat labeled prototype/demo and do not claim E2EE.
7. Add authenticated WebSocket delivery, reconnect behavior, pagination, read states, and a two-browser test.
8. Add backend integration tests, dependency scanning, Docker Compose, CI, and update all status/limitations documents from actual results.
