// Utility for Managing MPIN Trusted Device State in LocalStorage and Validation Rules

const TRUSTED_DEVICE_KEY = 'easeland_trusted_mpin_user';

/**
 * Validate MPIN safety constraints against predictable and weak PINs
 * Returns { valid: boolean, error: string | null, checks: object }
 */
export function validateMpinSafety(pin) {
  const s = String(pin || '');
  const is4Digits = /^\d{4}$/.test(s);

  // Check individual safety rules
  const notRepetitive = !(/^(\d)\1{3}$/.test(s));
  const sequences = ['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321', '3210'];
  const notSequential = !sequences.includes(s);
  const commonPatterns = ['2580', '0852', '1470', '3690', '1212', '1313', '1414', '6969'];
  const notPattern = !commonPatterns.includes(s);

  let error = null;
  if (!is4Digits) {
    error = 'MPIN must be exactly 4 numeric digits.';
  } else if (!notRepetitive) {
    error = 'Avoid repetitive digits like ' + s + '.';
  } else if (!notSequential) {
    error = 'Avoid sequential numbers like ' + s + '.';
  } else if (!notPattern) {
    error = 'This PIN is too common. Please choose a more random PIN.';
  }

  return {
    valid: is4Digits && notRepetitive && notSequential && notPattern,
    error,
    checks: {
      is4Digits,
      notRepetitive,
      notSequential,
      notPattern
    }
  };
}

/**
 * Retrieve saved trusted user for MPIN quick unlock
 */
export function getTrustedMpinUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TRUSTED_DEVICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.uid || parsed.email)) {
      return parsed;
    }
  } catch (e) {
    // Corrupted entry
  }
  return null;
}

/**
 * Save trusted user information on device for fast MPIN unlock
 */
export function saveTrustedMpinUser(user) {
  if (typeof window === 'undefined' || !user) return;
  try {
    const payload = {
      uid: user.uid || user.id || '',
      email: user.email || '',
      displayName: user.displayName || user.name || 'EaseLand Member',
      avatar: user.avatar || user.photoURL || '',
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(TRUSTED_DEVICE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to save trusted MPIN device:', e);
  }
}

/**
 * Remove trusted user from this device (e.g. on Switch Account or MPIN remove)
 */
export function clearTrustedMpinUser() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TRUSTED_DEVICE_KEY);
  } catch (e) {
    // Ignore
  }
}
