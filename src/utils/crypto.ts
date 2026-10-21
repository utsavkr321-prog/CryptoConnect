/**
 * CryptoConnect — Web Crypto Utility Functions
 *
 * IMPORTANT SECURITY NOTES:
 * - These utilities demonstrate AES-GCM encryption in the browser using the
 *   Web Crypto API (SubtleCrypto). They are for educational/demo purposes.
 * - Keys are generated ephemerally in memory and are NEVER stored in
 *   localStorage, sessionStorage, cookies, URLs, or console logs.
 * - This does NOT implement a complete end-to-end messaging protocol.
 * - Secure key exchange between parties is NOT implemented.
 * - Do not use this code as-is for production security systems.
 *
 * What IS real here:
 * - AES-GCM 256-bit key generation via crypto.subtle.generateKey
 * - Random 96-bit IV generation via crypto.getRandomValues
 * - Actual encryption and decryption via crypto.subtle.encrypt/decrypt
 * - Authentication tag verification (AES-GCM provides this automatically)
 * - SHA-256 fingerprint computation via crypto.subtle.digest
 */

// ─── Key Generation ───────────────────────────────────────────────────────────

/**
 * Generates a random 256-bit AES-GCM key.
 * The key object never leaves this module as a raw byte sequence.
 */
export async function generateAESKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ─── Encryption ───────────────────────────────────────────────────────────────

export interface EncryptOutput {
  ciphertextHex: string;   // Encrypted data (without auth tag for display)
  ivHex: string;           // 96-bit IV in hex
  authTagHex: string;      // Last 16 bytes of AES-GCM output = auth tag
  fullOutputHex: string;   // ciphertext + auth tag for this local demonstration
  algorithm: string;
  keyLengthBits: number;
}

/**
 * Encrypts plaintext using AES-GCM with the provided key.
 * Generates a fresh random IV for each encryption call.
 */
export async function encryptAESGCM(
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptOutput> {
  // Generate a fresh 96-bit (12-byte) IV — never reuse an IV with the same key
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // AES-GCM output = ciphertext || auth_tag (auth tag is the last 16 bytes)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );

  const fullOutput = new Uint8Array(encrypted);
  const ciphertext = fullOutput.slice(0, -16);   // everything except last 16 bytes
  const authTag = fullOutput.slice(-16);          // last 16 bytes = GCM auth tag

  return {
    ciphertextHex: bufferToHex(ciphertext.buffer),
    ivHex: bufferToHex(iv.buffer),
    authTagHex: bufferToHex(authTag.buffer),
    fullOutputHex: bufferToHex(encrypted),
    algorithm: 'AES-GCM',
    keyLengthBits: 256,
  };
}

// ─── Decryption ───────────────────────────────────────────────────────────────

export interface DecryptOutput {
  plaintext: string;
  success: boolean;
  error?: string;
}

/**
 * Decrypts AES-GCM ciphertext.
 * If the auth tag doesn't match (tampered data or wrong key), it throws and
 * we return success: false — the browser will NOT expose any partial plaintext.
 */
export async function decryptAESGCM(
  fullOutputHex: string,
  ivHex: string,
  key: CryptoKey,
): Promise<DecryptOutput> {
  try {
    const iv = hexToBuffer(ivHex);
    const fullOutput = hexToBuffer(fullOutputHex);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      fullOutput,
    );

    const decoder = new TextDecoder();
    return { plaintext: decoder.decode(decrypted), success: true };
  } catch {
    // AES-GCM authentication failed — tampered data or wrong key
    return {
      plaintext: '',
      success: false,
      error: 'AES-GCM authentication failed. Ciphertext integrity check rejected — data may be tampered or the key is incorrect.',
    };
  }
}

/**
 * Tampers with ciphertext by flipping a single bit at position 8.
 * Used to demonstrate that AES-GCM will reject tampered data.
 */
export function tamperCiphertext(fullOutputHex: string): string {
  const bytes = hexToBuffer(fullOutputHex);
  const arr = new Uint8Array(bytes);
  // Flip a byte somewhere in the middle of the ciphertext
  const flipPos = Math.min(8, Math.floor(arr.length / 2));
  arr[flipPos] = arr[flipPos] ^ 0xff;
  return bufferToHex(arr.buffer);
}

// ─── SHA-256 Fingerprint ──────────────────────────────────────────────────────

/**
 * Computes a SHA-256 fingerprint of an arbitrary string.
 * Formatted as colon-separated hex pairs (like a certificate fingerprint).
 *
 * NOTE: A fingerprint alone does NOT authenticate identity.
 * It proves the data hasn't changed, but you must independently
 * verify that the data belongs to the claimed person.
 */
export async function computeFingerprint(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = bufferToHex(hashBuffer);
  // Format as XX:XX:XX... pairs
  return (hashHex.match(/.{2}/g) ?? []).join(':').toUpperCase();
}

// ─── Utility Functions ────────────────────────────────────────────────────────

export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = hex.match(/.{2}/g)?.map((b) => parseInt(b, 16)) ?? [];
  return new Uint8Array(bytes).buffer;
}

/**
 * Generates a random 32-byte value and returns it as a hex string.
 * Useful for generating demo nonces and session IDs.
 */
export function randomHex(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return bufferToHex(bytes.buffer);
}
