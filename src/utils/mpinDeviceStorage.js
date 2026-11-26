// Utility for Managing MPIN Trusted Device State in LocalStorage and Validation Rules

const TRUSTED_DEVICE_KEY = 'easeland_trusted_mpin_user';
const TRUSTED_ACCOUNTS_KEY = 'easeland_trusted_mpin_accounts';

function normalizeAccountIdentity(user) {
  if (!user) return null;
  const uid = String(user.uid || user.id || '').trim();
  const email = String(user.email || '').trim();
  if (!uid && !email) return null;
  return {
    uid,
    email,
    displayName: user.displayName || user.name || 'EaseLand Member',
    avatar: user.avatar || user.photoURL || '',
    savedAt: user.savedAt || new Date().toISOString()
  };
}

function isSameAccount(a, b) {
  if (!a || !b) return false;
  const aUid = String(a.uid || a.id || '').trim();
  const bUid = String(b.uid || b.id || '').trim();
  const aEmail = String(a.email || '').trim().toLowerCase();
  const bEmail = String(b.email || '').trim().toLowerCase();
  if (aUid && bUid && aUid === bUid) return true;
  if (aEmail && bEmail && aEmail === bEmail) return true;
  return false;
}

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

  const isValid = is4Digits && notRepetitive && notSequential && notPattern;

  return {
    valid: isValid,
    error,
    checks: {
      valid: isValid,
      is4Digits,
      notRepetitive,
      notSequential,
      notPattern
    }
  };
}

/**
 * Retrieve all remembered MPIN-enabled accounts saved on this device/browser
 */
export function getTrustedMpinAccounts() {
  if (typeof window === 'undefined') return [];
  try {
    const rawList = localStorage.getItem(TRUSTED_ACCOUNTS_KEY);
    let list = rawList ? JSON.parse(rawList) : [];
    if (!Array.isArray(list)) list = [];
    const normalized = list.map(normalizeAccountIdentity).filter(Boolean);

    // Migrate legacy single-user key if accounts list is empty
    if (normalized.length === 0) {
      const legacy = getTrustedMpinUser();
      if (legacy) {
        const migrated = normalizeAccountIdentity(legacy);
        if (migrated) {
          localStorage.setItem(TRUSTED_ACCOUNTS_KEY, JSON.stringify([migrated]));
          return [migrated];
        }
      }
    }
    return normalized;
  } catch (e) {
    return [];
  }
}

/**
 * Retrieve currently active trusted user for immediate MPIN prompt
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
 * Check if a specific user account is registered for quick MPIN unlock on this device
 */
export function isAccountTrustedOnDevice(user) {
  if (!user) return false;
  const active = getTrustedMpinUser();
  if (active && isSameAccount(active, user)) return true;
  return getTrustedMpinAccounts().some((acct) => isSameAccount(acct, user));
}

/**
 * Save trusted user information on device for fast MPIN unlock
 * Also preserves multiple remembered MPIN accounts on the device.
 */
export function saveTrustedMpinUser(user) {
  if (typeof window === 'undefined' || !user) return;
  try {
    const payload = normalizeAccountIdentity({
      ...user,
      savedAt: new Date().toISOString()
    });
    if (!payload) return;
    localStorage.setItem(TRUSTED_DEVICE_KEY, JSON.stringify(payload));

    const existing = getTrustedMpinAccounts().filter((acct) => !isSameAccount(acct, payload));
    const nextList = [payload, ...existing].slice(0, 6);
    localStorage.setItem(TRUSTED_ACCOUNTS_KEY, JSON.stringify(nextList));
  } catch (e) {
    console.warn('Failed to save trusted MPIN device:', e);
  }
}

/**
 * Clear only the active lock-screen pointer (when clicking Switch Account)
 * while keeping saved MPIN accounts available to switch back cleanly (still requiring MPIN).
 */
export function clearActiveTrustedMpinUser() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TRUSTED_DEVICE_KEY);
  } catch (e) {
    // Ignore
  }
}

/**
 * Remove trusted user from this device (for a specific user if passed, or all if omitted)
 */
export function clearTrustedMpinUser(targetUser = null) {
  if (typeof window === 'undefined') return;
  try {
    if (targetUser && (targetUser.uid || targetUser.id || targetUser.email)) {
      const active = getTrustedMpinUser();
      if (active && isSameAccount(active, targetUser)) {
        localStorage.removeItem(TRUSTED_DEVICE_KEY);
      }
      const remaining = getTrustedMpinAccounts().filter((acct) => !isSameAccount(acct, targetUser));
      localStorage.setItem(TRUSTED_ACCOUNTS_KEY, JSON.stringify(remaining));
      return;
    }
    localStorage.removeItem(TRUSTED_DEVICE_KEY);
    localStorage.removeItem(TRUSTED_ACCOUNTS_KEY);
  } catch (e) {
    // Ignore
  }
}
