import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bufferToHex,
  compareFingerprints,
  computeFingerprintFromBytes,
  computePublicKeyFingerprint,
  decryptPayload,
  encryptAESGCM,
  generateAESKey,
  hexToBuffer,
  isValidFingerprint,
  normalizeFingerprint,
} from '../src/utils/crypto.ts';

function bytesToHex(bytes) {
  return bufferToHex(bytes);
}

async function importKey(raw, algorithm) {
  return crypto.subtle.importKey('raw', raw, algorithm, false, ['encrypt', 'decrypt']);
}

test('fingerprints hash SPKI bytes using the enrolled 4-byte group format', async () => {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const expectedHash = new Uint8Array(await crypto.subtle.digest('SHA-256', spki));
  const expected = bufferToHex(expectedHash).toUpperCase().match(/.{8}/g).join(':');

  assert.equal(await computePublicKeyFingerprint(btoa(String.fromCharCode(...spki))), expected);
  assert.equal(await computeFingerprintFromBytes(spki), expected);
});

test('fingerprint normalization is case and separator tolerant but rejects malformed input', () => {
  const fingerprint = '01234567:89abcdef:01234567:89abcdef:01234567:89abcdef:01234567:89abcdef';
  assert.equal(isValidFingerprint(fingerprint), true);
  assert.equal(normalizeFingerprint(fingerprint), fingerprint.replaceAll(':', '').toUpperCase());
  assert.equal(compareFingerprints(fingerprint, fingerprint.replaceAll(':', '-').toUpperCase()), true);
  assert.equal(compareFingerprints(fingerprint, `${fingerprint}zz`), false);
  assert.equal(compareFingerprints(fingerprint, 'f'.repeat(64)), false);
});

test('byte conversion respects typed-array views and rejects malformed hexadecimal input', () => {
  const view = new Uint8Array([0xaa, 0x01, 0x02, 0xbb]).subarray(1, 3);
  assert.equal(bufferToHex(view), '0102');
  assert.equal(bytesToHex(new Uint8Array(hexToBuffer('01 02'))), '0102');
  assert.throws(() => hexToBuffer('0g'), /hexadecimal/);
  assert.throws(() => hexToBuffer('abc'), /complete hexadecimal/);
});

test('AES-256-GCM decrypts authenticated ciphertext with the combined CryptoConnect format', async () => {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key = await importKey(rawKey, 'AES-GCM');
  const encrypted = await encryptAESGCM('authenticated test payload', key);
  const decrypted = await decryptPayload({
    algorithm: 'AES-256-GCM',
    ciphertext: encrypted.fullOutputHex,
    keyHex: bytesToHex(rawKey),
    ivHex: encrypted.ivHex,
    encoding: 'hex',
  });
  assert.equal(new TextDecoder().decode(decrypted), 'authenticated test payload');

  const combinedBytes = new Uint8Array(Buffer.from(encrypted.fullOutputHex, 'hex'));
  const base64Decrypted = await decryptPayload({
    algorithm: 'AES-256-GCM',
    ciphertext: Buffer.from(combinedBytes).toString('base64'),
    keyHex: bytesToHex(rawKey),
    ivHex: encrypted.ivHex,
    encoding: 'base64',
  });
  assert.equal(new TextDecoder().decode(base64Decrypted), 'authenticated test payload');
});

test('AES-256-GCM accepts a separate 16-byte tag and rejects tampering without plaintext', async () => {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key = await importKey(rawKey, 'AES-GCM');
  const encrypted = await encryptAESGCM('tag-separated payload', key);
  const correct = await decryptPayload({
    algorithm: 'AES-256-GCM',
    ciphertext: encrypted.ciphertextHex,
    tagHex: encrypted.authTagHex,
    keyHex: bytesToHex(rawKey),
    ivHex: encrypted.ivHex,
    encoding: 'hex',
  });
  assert.equal(new TextDecoder().decode(correct), 'tag-separated payload');

  const badTag = `${encrypted.authTagHex.slice(0, -2)}00`;
  await assert.rejects(decryptPayload({
    algorithm: 'AES-256-GCM',
    ciphertext: encrypted.ciphertextHex,
    tagHex: badTag,
    keyHex: bytesToHex(rawKey),
    ivHex: encrypted.ivHex,
    encoding: 'hex',
  }), /authentication failed/);
});

test('AES-GCM rejects a wrong key and malformed decryption parameters', async () => {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key = await importKey(rawKey, 'AES-GCM');
  const encrypted = await encryptAESGCM('wrong key payload', key);
  const wrongKey = crypto.getRandomValues(new Uint8Array(32));
  await assert.rejects(decryptPayload({
    algorithm: 'AES-256-GCM',
    ciphertext: encrypted.fullOutputHex,
    keyHex: bytesToHex(wrongKey),
    ivHex: encrypted.ivHex,
    encoding: 'hex',
  }), /authentication failed/);
  await assert.rejects(decryptPayload({
    algorithm: 'AES-256-GCM',
    ciphertext: 'not hex',
    keyHex: bytesToHex(rawKey),
    ivHex: encrypted.ivHex,
    encoding: 'hex',
  }), /hexadecimal/);
  await assert.rejects(decryptPayload({
    algorithm: 'AES-256-GCM',
    ciphertext: encrypted.fullOutputHex,
    keyHex: 'z'.repeat(64),
    ivHex: encrypted.ivHex,
    encoding: 'hex',
  }), /256-bit key/);
});

test('AES-256-CBC supports PKCS#7 round trips and rejects invalid blocks', async () => {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await importKey(rawKey, 'AES-CBC');
  const plaintext = new TextEncoder().encode('CBC round trip');
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, plaintext));
  const decrypted = await decryptPayload({
    algorithm: 'AES-256-CBC',
    ciphertext: bytesToHex(ciphertext),
    keyHex: bytesToHex(rawKey),
    ivHex: bytesToHex(iv),
    encoding: 'hex',
  });
  assert.equal(new TextDecoder().decode(decrypted), 'CBC round trip');
  await assert.rejects(decryptPayload({
    algorithm: 'AES-256-CBC',
    ciphertext: '01',
    keyHex: bytesToHex(rawKey),
    ivHex: bytesToHex(iv),
    encoding: 'hex',
  }), /complete 16-byte blocks/);
});
