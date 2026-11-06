/**
 * EaseLand TOTP (Time-based One-Time Password) Engine
 * Implements RFC 6238 / RFC 4226 standards.
 * Compatible with Google Authenticator, Microsoft Authenticator, Authy, Apple Passwords, etc.
 * Uses native Web Crypto API and Node crypto for zero external dependencies.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate cryptographically secure random Base32 secret string (default 16 chars / 80-bit, or 32 chars)
 */
export function generateTotpSecret(length = 16) {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += BASE32_ALPHABET[bytes[i] % 32];
  }
  return secret;
}

/**
 * Format Base32 secret into readable 4-character chunks (e.g. ABCD EFGH IJKL MNOP)
 */
export function formatSecretKeySpaced(secret) {
  if (!secret) return '';
  return secret.replace(/\s+/g, '').toUpperCase().match(/.{1,4}/g)?.join(' ') || secret;
}

/**
 * Generate standard otpauth:// URI for QR Code scanning
 */
export function generateTotpUri(secret, accountName = 'user@easeland.com', issuer = 'EaseLand') {
  const cleanSecret = (secret || '').replace(/\s+/g, '').toUpperCase();
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${cleanSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate QR Code Image URL (using standard secure QR image provider)
 */
export function getTotpQrCodeUrl(otpauthUri, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(otpauthUri)}`;
}

/**
 * Decode Base32 string into Uint8Array bytes
 */
export function base32ToBytes(base32) {
  const clean = (base32 || '').replace(/\s+/g, '').toUpperCase();
  const bytes = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue; // Skip invalid chars or padding

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Software implementation of HMAC-SHA1 for broad compatibility across Node and Browser
 */
async function hmacSha1(keyBytes, messageBytes) {
  // 1. Try Web Crypto SubtleCrypto if available
  const subtle = (typeof crypto !== 'undefined' && crypto.subtle)
    ? crypto.subtle
    : (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle)
      ? globalThis.crypto.subtle
      : null;

  if (subtle) {
    try {
      const cryptoKey = await subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: { name: 'SHA-1' } },
        false,
        ['sign']
      );
      const signature = await subtle.sign('HMAC', cryptoKey, messageBytes);
      return new Uint8Array(signature);
    } catch (e) {
      // Fallback below
    }
  }

  // 2. Node crypto fallback if available
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const moduleName = 'node:' + 'crypto';
      const nodeCrypto = await import(/* @vite-ignore */ moduleName);
      const hmac = nodeCrypto.createHmac('sha1', Buffer.from(keyBytes));
      hmac.update(Buffer.from(messageBytes));
      return new Uint8Array(hmac.digest());
    } catch (e) {
      // Fallback below
    }
  }

  throw new Error('HMAC-SHA1 cryptographic provider unavailable');
}

/**
 * Generate 6-digit TOTP code for a given timestamp (default now)
 */
export async function generateTotpCode(secret, timestampMs = Date.now()) {
  const cleanSecret = (secret || '').replace(/\s+/g, '').toUpperCase();
  const keyBytes = base32ToBytes(cleanSecret);
  const timeStep = 30; // 30-second interval
  const counter = Math.floor(timestampMs / 1000 / timeStep);

  // Convert counter to 8-byte big-endian buffer
  const messageBytes = new Uint8Array(8);
  let tempCounter = counter;
  for (let i = 7; i >= 0; i--) {
    messageBytes[i] = tempCounter & 0xff;
    tempCounter = Math.floor(tempCounter / 256);
  }

  const hmacResult = await hmacSha1(keyBytes, messageBytes);

  // RFC 4226 Dynamic Truncation
  const offset = hmacResult[hmacResult.length - 1] & 0x0f;
  const binary =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verify user submitted 6-digit code against secret
 * Allows +/- windowTolerance intervals (default 1 = +/- 30 seconds drift tolerance)
 */
export async function verifyTotpCode(secret, userCode, windowTolerance = 1) {
  if (!secret || !userCode) return false;
  const cleanCode = String(userCode).replace(/\D/g, '').trim();
  if (cleanCode.length !== 6) return false;

  const now = Date.now();
  const stepMs = 30 * 1000;

  for (let window = -windowTolerance; window <= windowTolerance; window++) {
    const targetTime = now + (window * stepMs);
    const expectedCode = await generateTotpCode(secret, targetTime);
    if (expectedCode === cleanCode) {
      return true;
    }
  }

  return false;
}
