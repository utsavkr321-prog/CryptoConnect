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

export async function decryptAESCBC(
  ciphertextHex: string,
  ivHex: string,
  key: CryptoKey,
): Promise<DecryptOutput> {
  try {
    const iv = hexToBuffer(ivHex);
    const ciphertext = hexToBuffer(ciphertextHex);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv },
      key,
      ciphertext,
    );
    const decoder = new TextDecoder();
    return { plaintext: decoder.decode(decrypted), success: true };
  } catch {
    return {
      plaintext: '',
      success: false,
      error: 'AES-CBC decryption failed. Check the key, IV, and padding requirements.',
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
  return formatFingerprint(bufferToHex(hashBuffer));
}

export async function computeFingerprintFromBytes(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  return formatFingerprint(bufferToHex(hashBuffer));
}

export async function computePublicKeyFingerprint(publicKeyBase64: string): Promise<string> {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(publicKeyBase64)) {
    throw new Error('The enrolled public key is not valid base64-encoded SPKI data.');
  }
  const binary = atob(publicKeyBase64);
  if (!binary) throw new Error('The enrolled public key is empty.');
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return computeFingerprintFromBytes(bytes);
}

function formatFingerprint(hex: string): string {
  return (hex.match(/.{8}/g) ?? []).join(':').toUpperCase();
}

export function normalizeFingerprint(value: string): string {
  const fingerprint = (value ?? '').trim();
  if (!/^[0-9A-Fa-f:\s-]+$/.test(fingerprint)) return '';
  return fingerprint.replace(/[:\s-]/g, '').toUpperCase();
}

export function isValidFingerprint(value: string): boolean {
  return /^[0-9A-F]{64}$/.test(normalizeFingerprint(value));
}

export function compareFingerprints(expected: string, candidate: string): boolean {
  return isValidFingerprint(expected) && isValidFingerprint(candidate)
    && normalizeFingerprint(expected) === normalizeFingerprint(candidate);
}

// ─── Utility Functions ────────────────────────────────────────────────────────

export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBuffer(hex: string): ArrayBuffer {
  const compact = (hex ?? '').replace(/\s+/g, '');
  if (!compact) return new ArrayBuffer(0);
  if (compact.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(compact)) {
    throw new Error('Hex input must contain complete hexadecimal byte pairs.');
  }
  const bytes = compact.match(/.{2}/g)?.map((b) => Number.parseInt(b, 16)) ?? [];
  return new Uint8Array(bytes).buffer;
}

export type DecryptionAlgorithm = 'AES-256-GCM' | 'AES-256-CBC';
export type CiphertextEncoding = 'hex' | 'base64' | 'text';

export interface DecryptionInput {
  algorithm: DecryptionAlgorithm;
  ciphertext: string;
  keyHex: string;
  ivHex: string;
  encoding: CiphertextEncoding;
  tagHex?: string;
}

function decodeCiphertext(value: string, encoding: CiphertextEncoding): Uint8Array {
  if (encoding === 'text') return new TextEncoder().encode(value);
  if (encoding === 'hex') return new Uint8Array(hexToBuffer(value));
  const compact = value.replace(/\s+/g, '');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact)) {
    throw new Error('Ciphertext must be valid standard base64.');
  }
  return Uint8Array.from(atob(compact), (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

export async function decryptPayload(input: DecryptionInput): Promise<Uint8Array> {
  const keyHex = input.keyHex.replace(/\s+/g, '');
  const ivHex = input.ivHex.replace(/\s+/g, '');
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) throw new Error('Provide a valid 256-bit key (64 hex characters).');
  const ivLength = input.algorithm === 'AES-256-GCM' ? 24 : 32;
  if (ivHex.length !== ivLength || !/^[0-9a-f]+$/i.test(ivHex)) {
    throw new Error(input.algorithm === 'AES-256-GCM'
      ? 'AES-GCM requires a 96-bit IV (24 hex characters).'
      : 'AES-CBC requires a 128-bit IV (32 hex characters).');
  }
  if (!input.ciphertext.trim()) throw new Error('Paste some ciphertext before attempting decryption.');

  const keyBytes = new Uint8Array(hexToBuffer(keyHex));
  const key = await crypto.subtle.importKey('raw', keyBytes, input.algorithm === 'AES-256-GCM' ? 'AES-GCM' : 'AES-CBC', false, ['decrypt']);
  const iv = new Uint8Array(hexToBuffer(ivHex));
  const ciphertext = decodeCiphertext(input.ciphertext, input.encoding);
  let payload = ciphertext;

  if (input.algorithm === 'AES-256-GCM') {
    if (input.tagHex?.trim()) {
      const tagHex = input.tagHex.replace(/\s+/g, '');
      if (!/^[0-9a-f]{32}$/i.test(tagHex)) throw new Error('AES-GCM authentication tags must be exactly 16 bytes (32 hex characters).');
      const tag = new Uint8Array(hexToBuffer(tagHex));
      payload = new Uint8Array(ciphertext.length + tag.length);
      payload.set(ciphertext);
      payload.set(tag, ciphertext.length);
    } else if (ciphertext.length <= 16) {
      throw new Error('Provide at least 16 bytes of ciphertext plus the authentication tag, or enter a separate 16-byte tag.');
    }
  } else if (ciphertext.length === 0 || ciphertext.length % 16 !== 0) {
    throw new Error('AES-CBC ciphertext must contain complete 16-byte blocks.');
  }

  try {
    const plaintext = await crypto.subtle.decrypt(
      input.algorithm === 'AES-256-GCM' ? { name: 'AES-GCM', iv } : { name: 'AES-CBC', iv },
      key,
      toArrayBuffer(payload),
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new Error(input.algorithm === 'AES-256-GCM'
      ? 'AES-GCM authentication failed. The ciphertext, tag, IV, or key may be incorrect.'
      : 'AES-CBC decryption failed. Check the key, IV, and PKCS#7 padding; CBC does not authenticate ciphertext.');
  }
}

/**
 * Generates a random 32-byte value and returns it as a hex string.
 * Useful for generating demo nonces and session IDs.
 */
export function randomHex(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return bufferToHex(bytes.buffer);
}
