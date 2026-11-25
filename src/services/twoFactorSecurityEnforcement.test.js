import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Two-Factor Authentication Security & Anti-Bypass Suite', () => {

  it('1. Verifies TwoFactorModal does NOT have any "Skip 2FA" button or bypass', () => {
    const modalPath = path.resolve(process.cwd(), 'src/components/TwoFactorModal.jsx');
    const source = fs.readFileSync(modalPath, 'utf8');

    assert.ok(
      !source.includes('Skip 2FA'),
      'TwoFactorModal must NEVER contain "Skip 2FA" option'
    );
    assert.ok(
      !source.includes('Skip 2FA & Sign In'),
      'TwoFactorModal must NEVER contain "Skip 2FA & Sign In"'
    );
  });

  it('2. Verifies TwoFactorModal renders Verify & Sign In as full-width primary submit button', () => {
    const modalPath = path.resolve(process.cwd(), 'src/components/TwoFactorModal.jsx');
    const source = fs.readFileSync(modalPath, 'utf8');

    assert.ok(
      source.includes('Verify & Sign In'),
      'TwoFactorModal must have "Verify & Sign In" submit button'
    );
    assert.ok(
      source.includes('w-full'),
      'Verify & Sign In button should take full primary action width'
    );
  });

  it('3. Verifies cancel2FASession does NOT sign user in or disable 2FA on profile', () => {
    const authContextPath = path.resolve(process.cwd(), 'src/context/AuthContext.jsx');
    const source = fs.readFileSync(authContextPath, 'utf8');

    // Find cancel2FASession definition
    const cancelFnMatch = source.match(/const cancel2FASession = [\s\S]*?^  \};/m);
    assert.ok(cancelFnMatch, 'cancel2FASession must be defined in AuthContext.jsx');

    const fnBody = cancelFnMatch[0];
    assert.ok(
      !fnBody.includes('setUser(targetUser)'),
      'cancel2FASession must NEVER log the user in with setUser(targetUser)'
    );
    assert.ok(
      !fnBody.includes('enable2FA = false'),
      'cancel2FASession must NEVER disable 2FA on the user profile'
    );
    assert.ok(
      fnBody.includes('logoutUser()'),
      'cancel2FASession must safely log out the unverified session'
    );
  });

});
