import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMpinSafety } from './mpinDeviceStorage.js';

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
