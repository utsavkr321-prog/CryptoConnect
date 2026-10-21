# End-to-end encryption status

CryptoConnect does **not** implement end-to-end encryption. The selected API chat architecture is conventional server-readable messaging: the service validates, stores and returns message text to authorized conversation members. The service and database can access that text. Use HTTPS/WSS for transport; these controls do not make content end-to-end encrypted.

The browser Security Lab and Encryption Visualizer are educational demonstrations only. They are not used by API chat and do not establish a recipient identity or key exchange.

## Legacy records

Before V7, API chat stored AES-GCM ciphertext encrypted with a random key held only in the sending page's memory. The key was not exchanged with the recipient or persisted. V7 preserves those rows as `LEGACY_ENCRYPTED`; the content cannot be recovered without the missing original key. The application labels them unavailable and does not expose their legacy envelope as plaintext.

## If E2EE is considered later

Treat E2EE as a separate product architecture. Select an established protocol/library with supported browser clients, authenticated device identity, key verification, multi-device lifecycle, durable state, recovery policy and a documented threat model. Do not invent a key exchange or adapt the educational AES utility into a chat protocol. Review protocol support, release provenance, advisories and license before adoption, and require independent cryptographic review before making an E2EE claim.

The current release has no E2EE gate passed and must not be represented as end-to-end encrypted.