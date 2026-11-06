import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTotpSecret,
  formatSecretKeySpaced,
  generateTotpUri,
  getTotpQrCodeUrl,
  base32ToBytes,
  generateTotpCode,
  verifyTotpCode
} from './totp.js';

describe('EaseLand TOTP Authenticator Engine Suite', () => {
  it('generates a valid 16-character Base32 secret', () => {
    const secret = generateTotpSecret(16);
    assert.strictEqual(typeof secret, 'string');
    assert.strictEqual(secret.length, 16);
    assert.match(secret, /^[A-Z2-7]+$/);
  });

  it('formats secret keys in readable 4-character chunks', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const formatted = formatSecretKeySpaced(secret);
    assert.strictEqual(formatted, 'JBSW Y3DP EHPK 3PXP');
  });

  it('generates standard otpauth:// URI for Google and Microsoft Authenticator', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const uri = generateTotpUri(secret, 'owner@easeland.com', 'EaseLand');
    assert.ok(uri.startsWith('otpauth://totp/EaseLand:owner%40easeland.com'));
    assert.ok(uri.includes('secret=JBSWY3DPEHPK3PXP'));
    assert.ok(uri.includes('issuer=EaseLand'));
    assert.ok(uri.includes('algorithm=SHA1'));
    assert.ok(uri.includes('digits=6'));
    assert.ok(uri.includes('period=30'));
  });

  it('generates QR code URL from otpauth URI', () => {
    const uri = 'otpauth://totp/EaseLand:test@easeland.com?secret=ABCD&issuer=EaseLand';
    const qrUrl = getTotpQrCodeUrl(uri, 200);
    assert.ok(qrUrl.startsWith('https://api.qrserver.com/v1/create-qr-code/'));
    assert.ok(qrUrl.includes('200x200'));
  });

  it('converts Base32 to bytes accurately', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const bytes = base32ToBytes(secret);
    assert.ok(bytes instanceof Uint8Array);
    assert.strictEqual(bytes.length, 10);
  });

  it('generates and verifies 6-digit TOTP codes with tolerance', async () => {
    const secret = generateTotpSecret(16);
    const code = await generateTotpCode(secret);

    assert.strictEqual(typeof code, 'string');
    assert.strictEqual(code.length, 6);
    assert.match(code, /^\d{6}$/);

    // Verify valid code matches
    const isValid = await verifyTotpCode(secret, code);
    assert.strictEqual(isValid, true);

    // Incorrect code should fail
    const isInvalid = await verifyTotpCode(secret, '000000');
    // In rare edge case where generated code happened to be 000000, test different
    if (code !== '000000') {
      assert.strictEqual(isInvalid, false);
    }

    // Invalid length should fail
    const isShort = await verifyTotpCode(secret, '123');
    assert.strictEqual(isShort, false);
  });

  it('verifies codes across 30-second time drift window', async () => {
    const secret = generateTotpSecret(16);
    const pastTime = Date.now() - 30000; // 30 seconds ago
    const pastCode = await generateTotpCode(secret, pastTime);

    // Should verify successfully with windowTolerance = 1
    const isPastValid = await verifyTotpCode(secret, pastCode, 1);
    assert.strictEqual(isPastValid, true);

    // Much older code (5 minutes ago) should fail
    const farPastTime = Date.now() - 300000;
    const farPastCode = await generateTotpCode(secret, farPastTime);
    const isFarPastValid = await verifyTotpCode(secret, farPastCode, 1);
    assert.strictEqual(isFarPastValid, false);
  });
});

