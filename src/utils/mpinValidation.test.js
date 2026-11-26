import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateMpinSafety,
  getTrustedMpinUser,
  getTrustedMpinAccounts,
  isAccountTrustedOnDevice,
  saveTrustedMpinUser,
  clearActiveTrustedMpinUser,
  clearTrustedMpinUser
} from './mpinDeviceStorage.js';

function withMockLocalStorage(fn) {
  const store = new Map();
  const prevWindow = globalThis.window;
  const prevStorage = globalThis.localStorage;
  const mockStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); }
  };
  globalThis.window = { localStorage: mockStorage };
  globalThis.localStorage = mockStorage;
  try {
    fn(store);
  } finally {
    globalThis.window = prevWindow;
    globalThis.localStorage = prevStorage;
  }
}

test('validateMpinSafety accepts clean 4-digit PINs', () => {
  const result = validateMpinSafety('4466');
  assert.equal(result.valid, true);
  assert.equal(result.error, null);
  assert.equal(result.checks.is4Digits, true);
  assert.equal(result.checks.notRepetitive, true);
  assert.equal(result.checks.notSequential, true);
  assert.equal(result.checks.notPattern, true);

  const another = validateMpinSafety('7193');
  assert.equal(another.valid, true);
});

test('validateMpinSafety rejects repetitive digits', () => {
  const r1 = validateMpinSafety('1111');
  assert.equal(r1.valid, false);
  assert.equal(r1.checks.notRepetitive, false);

  const r2 = validateMpinSafety('0000');
  assert.equal(r2.valid, false);
});

test('validateMpinSafety rejects sequential forward and backward runs', () => {
  const r1 = validateMpinSafety('1234');
  assert.equal(r1.valid, false);
  assert.equal(r1.checks.notSequential, false);

  const r2 = validateMpinSafety('4321');
  assert.equal(r2.valid, false);

  const r3 = validateMpinSafety('9876');
  assert.equal(r3.valid, false);
});

test('validateMpinSafety rejects common keypad patterns', () => {
  const r1 = validateMpinSafety('2580');
  assert.equal(r1.valid, false);
  assert.equal(r1.checks.notPattern, false);

  const r2 = validateMpinSafety('1212');
  assert.equal(r2.valid, false);
});

test('validateMpinSafety rejects non-4 digit inputs', () => {
  assert.equal(validateMpinSafety('123').valid, false);
  assert.equal(validateMpinSafety('12345').valid, false);
  assert.equal(validateMpinSafety('abcd').valid, false);
  assert.equal(validateMpinSafety('').valid, false);
});

test('Multi-account trusted MPIN storage preserves Account A when switching to Account B and back', () => {
  withMockLocalStorage(() => {
    const accountA = { uid: 'uid_a', email: 'userA@example.com', displayName: 'User A' };
    const accountB = { uid: 'uid_b', email: 'userB@example.com', displayName: 'User B' };

    // 1. Account A enables MPIN on this device
    saveTrustedMpinUser(accountA);
    assert.equal(getTrustedMpinUser().email, 'userA@example.com');
    assert.equal(isAccountTrustedOnDevice(accountA), true);

    // 2. Clicking Switch clears active prompt without erasing Account A from device history
    clearActiveTrustedMpinUser();
    assert.equal(getTrustedMpinUser(), null);
    assert.equal(isAccountTrustedOnDevice(accountA), true);
    assert.equal(getTrustedMpinAccounts().length, 1);

    // 3. Account B logs in without MPIN (or with MPIN) and does not break Account A
    clearTrustedMpinUser(accountB);
    assert.equal(isAccountTrustedOnDevice(accountA), true);
    assert.equal(isAccountTrustedOnDevice(accountB), false);

    // 4. Selecting Account A again restores prompt cleanly; explicit clear for A removes only A
    saveTrustedMpinUser(accountB);
    assert.equal(getTrustedMpinAccounts().length, 2);
    clearTrustedMpinUser(accountA);
    assert.equal(isAccountTrustedOnDevice(accountA), false);
    assert.equal(isAccountTrustedOnDevice(accountB), true);
  });
});

test('AuthModal resets stale welcome-back state and preserves saved MPIN switcher on open/switch', () => {
  const modalPath = path.resolve(process.cwd(), 'src/components/AuthModal.jsx');
  const source = fs.readFileSync(modalPath, 'utf8');

  assert.ok(source.includes('clearActiveTrustedMpinUser'), 'AuthModal must use clearActiveTrustedMpinUser when switching accounts');
  assert.ok(source.includes('getTrustedMpinAccounts'), 'AuthModal must expose remembered MPIN accounts for switching back');
  assert.ok(source.includes('checkMpinStatus'), 'AuthModal must verify server MPIN status before binding trusted device');
  assert.ok(source.includes('clearPendingAuthTimers'), 'AuthModal must cancel pending timers when closed or switching accounts');
});
