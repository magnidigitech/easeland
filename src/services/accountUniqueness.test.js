import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { checkAccountExists } from '../firebase/userService.js';

describe('EaseLand Account Uniqueness Constraint Suite (One Email One Account, One Phone One Account)', () => {
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

  it('1. Returns exists: false when neither email nor phone is registered', async () => {
    const res = await checkAccountExists({
      email: 'fresh.buyer@easeland.in',
      phone: '9876543210'
    });
    assert.equal(res.exists, false);
    assert.equal(res.emailExists, false);
    assert.equal(res.phoneExists, false);
    assert.equal(res.error, null);
  });

  it('2. Detects existing email from registered users cache (case-insensitive)', async () => {
    store.set(
      'easeland_registered_users',
      JSON.stringify([
        { uid: 'u1', email: 'owner@easeland.in', phone: '9988776655', accountStatus: 'ACTIVE' }
      ])
    );

    const res = await checkAccountExists({
      email: 'OWNER@EASELAND.IN'
    });
    assert.equal(res.exists, true);
    assert.equal(res.emailExists, true);
    assert.equal(res.phoneExists, false);
    assert.ok(res.error && res.error.includes('already exists with this email'));
  });

  it('3. Detects existing phone number in various formats (+91, with spaces, 10 digits)', async () => {
    store.set(
      'easeland_registered_users',
      JSON.stringify([
        { uid: 'u2', email: 'user2@easeland.in', phone: '+91 9123456780', accountStatus: 'ACTIVE' }
      ])
    );

    // Formats: 10-digit raw, with country code, or dashes
    const res1 = await checkAccountExists({ phone: '9123456780' });
    assert.equal(res1.exists, true);
    assert.equal(res1.phoneExists, true);
    assert.ok(res1.error && res1.error.includes('already exists with this mobile number'));

    const res2 = await checkAccountExists({ phone: '+91-91234-56780' });
    assert.equal(res2.exists, true);
    assert.equal(res2.phoneExists, true);
  });

  it('4. Returns combined error when both email and mobile number already exist', async () => {
    store.set(
      'easeland_registered_users',
      JSON.stringify([
        { uid: 'u3', email: 'dual@easeland.in', phone: '9000000001', accountStatus: 'ACTIVE' }
      ])
    );

    const res = await checkAccountExists({
      email: 'dual@easeland.in',
      phone: '9000000001'
    });
    assert.equal(res.exists, true);
    assert.equal(res.emailExists, true);
    assert.equal(res.phoneExists, true);
    assert.ok(res.error && res.error.includes('email address and mobile number'));
  });

  it('5. Allows own account update when excludeUid matches current user', async () => {
    store.set(
      'easeland_registered_users',
      JSON.stringify([
        { uid: 'my_uid', email: 'me@easeland.in', phone: '9888877777', accountStatus: 'ACTIVE' },
        { uid: 'other_uid', email: 'other@easeland.in', phone: '9111122222', accountStatus: 'ACTIVE' }
      ])
    );

    // Updating my own profile with my own email/phone
    const selfRes = await checkAccountExists({
      email: 'me@easeland.in',
      phone: '9888877777',
      excludeUid: 'my_uid'
    });
    assert.equal(selfRes.exists, false);
    assert.equal(selfRes.emailExists, false);
    assert.equal(selfRes.phoneExists, false);

    // Attempting to change to someone else's email/phone
    const conflictRes = await checkAccountExists({
      email: 'other@easeland.in',
      phone: '9888877777',
      excludeUid: 'my_uid'
    });
    assert.equal(conflictRes.exists, true);
    assert.equal(conflictRes.emailExists, true);
  });

  it('6. Ignores deleted users from easeland_deleted_users list', async () => {
    store.set(
      'easeland_registered_users',
      JSON.stringify([
        { uid: 'del_user', email: 'deleted@easeland.in', phone: '9444433333', accountStatus: 'REMOVED' }
      ])
    );
    store.set('easeland_deleted_users', JSON.stringify(['del_user', 'deleted@easeland.in']));

    const res = await checkAccountExists({
      email: 'deleted@easeland.in',
      phone: '9444433333'
    });
    assert.equal(res.exists, false);
    assert.equal(res.emailExists, false);
    assert.equal(res.phoneExists, false);
  });
});
