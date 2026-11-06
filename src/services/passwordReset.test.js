import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetPasswordWithMobileOtp } from '../firebase/authService.js';

describe('EaseLand Forgot Password & Recovery Suite', () => {
  const store = new Map();

  beforeEach(() => {
    store.clear();
    globalThis.window = {};
    globalThis.localStorage = {
      getItem: (key) => store.get(key) || null,
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
      key: (i) => Array.from(store.keys())[i] || null,
      get length() {
        return store.size;
      }
    };
  });

  it('1. Rejects reset attempt when required parameters are missing', async () => {
    const res1 = await resetPasswordWithMobileOtp('', '123456', 'Pass@1234');
    assert.equal(res1.success, false);
    assert.ok(res1.error.includes('required'));

    const res2 = await resetPasswordWithMobileOtp('9876543210', '', 'Pass@1234');
    assert.equal(res2.success, false);
    assert.ok(res2.error.includes('required'));

    const res3 = await resetPasswordWithMobileOtp('9876543210', '123456', '');
    assert.equal(res3.success, false);
    assert.ok(res3.error.includes('required'));
  });

  it('2. Rejects invalid OTP code during password reset', async () => {
    const res = await resetPasswordWithMobileOtp('9876543210', '000000', 'NewSecretPass#123');
    assert.equal(res.success, false);
    assert.ok(res.error.includes('Invalid or expired OTP code'));
  });

  it('3. Successfully resets password with verified OTP and marks passwordUpdated', async () => {
    store.set(
      'easeland_registered_users',
      JSON.stringify([
        { uid: 'u_test_1', phone: '9876543210', email: 'test@easeland.in' }
      ])
    );

    const res = await resetPasswordWithMobileOtp('9876543210', '123456', 'StrongNewPass@99');
    assert.equal(res.success, true);
    assert.ok(res.message.includes('successfully'));

    const updatedUsers = JSON.parse(store.get('easeland_registered_users'));
    assert.equal(updatedUsers[0].passwordUpdated, true);
  });

  it('4. Sanitizes phone numbers with country code (+91) accurately during reset', async () => {
    store.set(
      'easeland_registered_users',
      JSON.stringify([
        { uid: 'u_test_2', phone: '9988776655', email: 'owner@easeland.in' }
      ])
    );

    const res = await resetPasswordWithMobileOtp('+91 99887 76655', '123456', 'ValidNewPass!88');
    assert.equal(res.success, true);

    const updatedUsers = JSON.parse(store.get('easeland_registered_users'));
    assert.equal(updatedUsers[0].passwordUpdated, true);
  });
});
