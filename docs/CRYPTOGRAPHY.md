# Cryptography boundary and messaging architecture

## Selected model

API chat uses **conventional server-readable messaging**, not end-to-end encryption. New messages are bounded UTF-8 text sent through HTTPS/WSS, validated and persisted as text by the backend, and returned only to authorized conversation members. The backend and configured MongoDB database can access the content.

`src/utils/crypto.ts` and the Encryption Visualizer remain an isolated educational AES-GCM demonstration. They do not encrypt API chat, establish identity, exchange keys, or provide a production chat protocol.

## Legacy message handling

In the former PostgreSQL implementation, API chat generated AES-GCM keys in a browser-memory map and stored ciphertext, IV and algorithm in PostgreSQL. Those keys were never sent to the backend, recipient, or durable browser storage. Existing ciphertext therefore cannot be decrypted after refresh and was never decryptable by the recipient. The MongoDB application does not automatically import those rows.

V7 preserves those records and envelope bytes in `legacy_ciphertext`, `legacy_iv` and `legacy_algorithm`, marks them `LEGACY_ENCRYPTED`, and leaves `content` null. The API returns only the format marker and null content, not the legacy envelope. The UI explains that the old message is unavailable. No key is guessed or fabricated.

## Operational protections and limits

- Require HTTPS for REST and WSS for chat in deployed environments. The API-mode production build rejects non-HTTPS API origins.
- Verify encryption at rest, access restrictions, and retention for the MongoDB host or managed service. These controls are deployment responsibilities; the application does not provide database-file encryption itself.
- Use a least-privilege runtime MongoDB identity. Required indexes are ensured by the application at startup; review database permissions for the chosen deployment.
- Do not log message bodies, credentials or tokens. The current application logs security event types, not message content.
- Server-readable messaging is not E2EE and does not protect content from service/database operators or a compromised application server.

A future E2EE project would require a separate architecture, reviewed protocol, authenticated device identities, key verification, durable protocol state, recovery policy and threat model. Do not extend the educational AES utility into a bespoke chat protocol.
