# CryptoConnect Features and Security Guide

This guide describes the current source-code behavior. It distinguishes the local demo from API
mode; a UI label or a cryptography demo is not evidence that API chat is end-to-end encrypted.

## Status labels

- **Implemented and verified**: implemented in the current code and covered by relevant automated
  tests.
- **Implemented but not fully tested**: the behavior exists, but available tests do not exercise all
  important paths or require external integration to verify.
- **Partially implemented**: some pieces work, but the user-facing or security workflow is
  incomplete.
- **Demo/mock only**: sample or local demonstration behavior, not a registered server account or
  production message protocol.
- **Not implemented**: no working implementation is present.

## A. Authentication and account management

**Status: Implemented but not fully tested in this workspace; demo sign-in is demo/mock only.**

In API mode, choose **Create Account**, enter a display name, email, and a password of at least 12
characters, or sign in with an existing account. The backend trims the display name, trims and
lowercases email addresses during registration, checks email uniqueness, and stores a BCrypt
password hash in MongoDB. Login trims the email and performs a case-insensitive lookup. Passwords
are not returned by the API.

Successful login or registration returns a signed JWT. The browser keeps it in memory and in
`sessionStorage` for the current tab; API requests send it as a Bearer token. The backend is
stateless with a configured 60-minute token lifetime and a revocation list used by logout. Logging
out clears the browser token and requests server-side revocation. If that request cannot reach the
server, the local session still ends, but the token may remain usable until expiry.

The backend stores the account's email, display name, password hash, public identity key and key
fingerprint. Private identity keys and display preferences remain in the browser. Demo sign-in does
not authenticate against the backend or create a server account.

## B. Find Friends and contacts

**Status: Implemented but not fully tested in this workspace. The backend has directory and
friend/contact integration tests; contact visibility is tested by the Mongo integration suite.**

In API mode, **Find Friends** searches the authenticated `GET /api/users` endpoint with the `query`,
`page`, and `size` parameters. It accepts a minimum of two characters and limits queries to 120
characters. Display names match case-insensitively by substring. If the query contains `@`, email
matching is case-insensitive and exact; partial email-address searches are not allowed. MongoDB
regex text is escaped, so punctuation in a name or email is treated literally. The endpoint excludes
the authenticated user and returns only an ID, display name, and registration time—not an email,
password hash, token, or key.

The frontend sends the stored Bearer token and maps the backend's `{ users, page, hasMore }`
response. A failed request stays an error and is not converted into an empty result. **Demo mode**
instead searches only the local sample-user list; it cannot find server registrations. The provided
`start-frontend.ps1` launcher selects API mode by default. A plain `npm run dev` does not set
`VITE_APP_MODE`, so it uses demo mode unless the caller sets `VITE_APP_MODE=api`.

Selecting **Add** sends a friend request. Incoming requests can be accepted or rejected; only the
recipient can decide. Duplicate requests for an existing pair are rejected, and a rejected or
cancelled request cannot be re-sent under the current policy. Accepted friendship permits opening a
conversation and sending messages; it does not prove who the other person is.

The backend stores contact relationships separately from friend requests. Accepting a request now
creates the relationship in both directions, so both accounts can see each other in Contacts.
Accepted requests already stored before this behavior are not automatically backfilled. The
separate authenticated `POST /api/contacts` endpoint exists for direct relationship creation, but
the UI does not expose it as a repair action for old records. Removing a contact removes that
saved-contact relationship and its verification; it does not revoke the accepted friendship or
remove the ability to message. Contact visibility does not set the verification state.

## C. Fingerprint verification

**Status: Implemented but not fully tested in this workspace. Tests cover persistence, mismatch,
authorization, current-key matching, and key rotation. Verification is per verifier and per current
key; the comparison itself depends on the user using a trustworthy out-of-band channel.**

A public key is shareable cryptographic data. The corresponding private key is secret and is used to
prove possession of the key. A fingerprint is a compact digest of the exact public-key bytes: CryptoConnect
uses SHA-256 over the enrolled P-256 public key in base64-encoded SPKI/DER form. It displays the
32-byte digest as uppercase hexadecimal, grouped in four-byte chunks with colons. Comparing the
fingerprint is easier than comparing the full public-key encoding, but a fingerprint is not a
signature or proof of a real-world name.

In the Contacts verification dialog, CryptoConnect recomputes the fingerprint from the contact's
current public-key bytes and checks it against the backend's computed value. Independently obtain
the contact's fingerprint through a trusted, separately authenticated channel—for example, compare
it in person or during a call to a number you already trust. Paste that value, check that the exact
fingerprint matches, and affirm that the out-of-band comparison was performed before selecting
**Record verification**.

That explicit action sends the fingerprint and confirmation to
`POST /api/contacts/{contactId}/verify` using the current user's authenticated session. The backend
requires that the target is a saved contact, rejects self-verification, recomputes SHA-256 from the
current valid P-256 SPKI bytes, normalizes the submitted separators/case, and rejects a mismatch.
The backend does not treat an accepted friend request, a login, key enrollment, or merely viewing a
fingerprint as verification.

Successful verification is stored in MongoDB's `contact_verifications` collection, scoped to the
authenticated verifier and contact, with the exact contact-key fingerprint and a timestamp. It is
one-way: each person must verify the other person's key independently. When the current key is
removed, malformed, or different, the old record no longer matches and the UI reports the contact
as unverified/key changed. The old record is retained as stale evidence rather than silently applied
to the new key. A mismatch leaves the contact unverified.

The Contacts page retrieves persisted status. Conversation responses also return the verification
status for the authenticated viewer, bound to the current public-key bytes; the other participant's
verification state is not exposed. A verified indicator only means that this account recorded a
matching fingerprint comparison. It cannot prove that the independent channel was trustworthy,
prevent coercion, or establish a legal/real-world identity.

## D. Messaging

**Status: Implemented but not fully tested in this workspace. Backend API tests cover conversation
membership and message contracts. Genuine end-to-end encryption is not implemented.**

After a friend request is accepted, open a one-to-one conversation and send a message. The frontend
sends the text through an authenticated REST endpoint or the authenticated WebSocket transport. The
backend checks conversation membership and friendship, enforces message limits, and stores new
messages as `TEXT` in MongoDB's `messages` collection. Authorized participants can retrieve history;
the service and authorized database operators can read the stored text. The UI renders message text
as text and includes delivery/read status and unread counts.

REST uses JWT Bearer authentication. WebSocket clients send a JWT in an initial authentication
frame; the server checks expiry/revocation and only permits subscriptions and actions for authorized
conversation members. Deployments must use HTTPS/WSS. Transport encryption does not make the stored
message end-to-end encrypted.

Older `LEGACY_ENCRYPTED` rows are preserved by the migration but their original page-memory keys
were not retained or exchanged. They are displayed as unavailable; the API does not return legacy
ciphertext as readable content. The current message feature is not a cryptographic protocol and
must not be described as end-to-end encrypted.

## E. Cryptography Lab

**Status: Browser-side educational operations are implemented and tested. The lab is separate from
chat and is not a production messaging protocol.**

- **Encryption Visualizer:** generates a fresh, ephemeral, non-extractable 256-bit AES-GCM key in
  the browser, uses a random 96-bit IV, and demonstrates encryption/decryption and a tamper test.
  AES-GCM output consists of ciphertext plus a 16-byte authentication tag. The visualization and
  generated values are local and are not sent to the chat API.
- **Security Lab:** runs actual Web Crypto AES-GCM round-trip, modified-ciphertext rejection,
  wrong-key rejection, SHA-256 sample-input formatting, and a 100-random-IV uniqueness demo. These
  are local demonstrations, not a full cryptographic security audit. The fingerprint test hashes a
  sample string; it does not verify an identity key.
- **Secure Decryption:** runs locally in the browser. It accepts ciphertext as hex, standard
  base64, or UTF-8 text and can display plaintext as UTF-8, hex, or base64. The key is entered as 32
  bytes of hex. AES-GCM requires a 12-byte IV and an authentication tag (16 bytes), either appended
  to the ciphertext or entered separately. Authentication failure rejects decryption and does not
  return partial plaintext.
- **AES-CBC:** the decryption workspace also supports AES-256-CBC with a 16-byte IV and complete
  16-byte ciphertext blocks. Web Crypto applies PKCS#7 padding. CBC does not authenticate
  ciphertext; valid padding does not establish integrity or authenticity. Do not use CBC alone for
  new security protocols.
- **Key and Fingerprint Tools:** can compute/compare fingerprints for supplied public-key bytes.
  The generic SHA-256 data fingerprint tool hashes the UTF-8 input; it is not an identity
  verification workflow.

Plaintext and keys entered into these lab controls are processed in the current browser page. They
are not sent to the backend by these operations, but they remain exposed to the local browser
environment and should not be treated as protected production secrets.

## F. Identity-key setup and settings

**Status: Implemented but not fully tested in this workspace. Backend tests cover challenge use and
key validation. Recovery and user-facing key rotation are partially implemented.**

In API mode, open **Settings → Identity Key → Set Up Identity Key**. The browser generates an
ECDSA P-256 key pair with a non-extractable private key and stores the `CryptoKeyPair` in IndexedDB
for that account. The backend issues a random, one-use challenge that expires after ten minutes.
The browser signs the challenge and sends the base64 SPKI public key and signature. The private key
is not sent. The backend validates the public key curve and signature, computes the SHA-256
fingerprint from the submitted SPKI bytes, and stores the public key and fingerprint on the account.
Enrollment proves that the browser can use the private key; it does not verify identity.

The key is not backed up or recoverable by CryptoConnect. Clearing browser data, losing the browser
profile, or changing devices can remove access to the private key while the public key remains on
the server. The server has an authenticated key-removal endpoint, which makes existing contact
verification stale; the Settings UI does not currently provide a remove/rotate workflow. Re-enrolling
is refused while a key already exists, so key recovery/rotation requires a deliberate supported
operational flow.

Display name updates are persisted in API mode; email/account identifiers are protected from profile
editing. Theme/display/notification settings are browser-local preferences stored in `localStorage`.
The auto-lock setting logs out the current client session after inactivity; it does not lock the
device or erase the IndexedDB identity key.

## G. Dashboard and security status

**Status: Implemented but not fully tested in this workspace; demo dashboard values are mock/demo
only.**

In API mode, conversation/message counts and seven-day message activity are queried from MongoDB.
Security events are stored per account; the feed includes server-recorded account/login/message
events and allowlisted browser-demo events. Demo mode uses fixed sample metrics, conversations, and
events. Demo data is not account activity.

The API dashboard states that chat text is server-readable and is not end-to-end encrypted. A
fingerprint badge in Contacts/Chat reflects the current key-verification record; it does not prove
real-world identity. Message delivery/read markers show backend processing/receipt state, not
encryption. The local AES-GCM tests demonstrate specific browser operations only. Demo indicators
such as “simulated key exchange” and “concept demo forward secrecy” are not implemented protections.

## H. Backend and deployment architecture

**Status: Implemented but not fully tested in this workspace; the repository provides disposable
MongoDB integration tests. A running deployment's configuration and database contents are
environment-specific and are not verified by this guide.**

The frontend is React with Vite. API mode calls a Spring Boot backend, which uses stateless JWT
authentication and MongoDB persistence. Protected API routes require authentication; the registered
user directory is not public. The configured MongoDB database defaults to `cryptoconnect`; runtime
configuration supplies `MONGODB_URI`, database name, JWT secret, port, and allowed frontend origin.
The local Compose file binds the backend port to loopback. Staging Compose requires protected
runtime configuration and a specific HTTPS CORS origin. Production must terminate TLS, use HTTPS
and WSS, protect database credentials, encrypt database storage/backups, and restrict operator
access. The application does not encrypt MongoDB files itself.

Authentication, directory, contacts, friend requests, chat, dashboard, security-event, presence,
and key-enrollment features require API mode and the backend. The visualizer, local decryption,
security-test panel, and browser settings are local features. Demo mode is a mock prototype rather
than an offline copy of registered API data.

## Feature status summary

| Feature | Status | Important boundary |
|---|---|---|
| API registration, login, JWT session, logout | Implemented but not fully tested | JWT is a bearer credential; protect the browser and use TLS |
| Demo login and demo users | Demo/mock only | No server account or live directory |
| Authenticated name/email directory search | Implemented but not fully tested | Exact full-email matching; no email returned |
| Friend request send/accept/reject | Implemented but not fully tested | Acceptance creates visible contacts; friendship is not identity verification |
| Saved-contact visibility | Implemented but not fully tested | Acceptance creates a relationship for both users; never auto-verifies |
| Public-key enrollment/fingerprint | Implemented but not fully tested | Possession proof only; no recovery UI |
| Out-of-band contact verification | Implemented but not fully tested | Human trust in the independent channel is outside the system |
| API chat and persisted history | Implemented but not fully tested | Server-readable plaintext; not E2EE |
| AES-GCM visualizer/decryption | Implemented and tested | Local educational operation, not chat encryption |
| AES-CBC decryption | Implemented and verified | No built-in integrity/authentication |
| Demo dashboard and sample activity | Demo/mock only | Numbers/events are illustrative |
| API dashboard and persisted security events | Implemented but not fully tested | Events do not independently prove a security property |
| Genuine end-to-end encrypted messaging | Not implemented | No secure user-to-user message-key exchange/protocol |
| Identity-key backup/recovery and UI rotation | Not implemented | Losing browser key storage can strand the enrolled identity |

## Remaining security limitations

Use a trusted out-of-band fingerprint channel and compare the entire fingerprint. A compromised
browser, malicious extension, compromised account, dishonest server, or compromised trusted
channel can still undermine confidence. JWT authentication and TLS protect access and transport;
they do not hide message text from the service. AES-CBC is unauthenticated, the demo keys are
ephemeral, browser storage may be cleared, and no genuine end-to-end messaging or identity-key
recovery protocol is present.
