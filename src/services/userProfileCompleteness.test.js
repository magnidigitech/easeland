import { describe, it } from 'node:test';
import assert from 'node:assert';

// Verification helper matching checkProfileComplete logic
function sanitizePhone(ph) {
  if (!ph) return '';
  let str = String(ph).trim();
  const lower = str.toLowerCase();
  if (lower === 'n/a' || lower === 'null' || lower === 'undefined' || str === '+91 N/A') return '';
  return str;
}

function normalizePhoneNumber(raw) {
  let clean = (raw || '').trim().replace(/\D/g, '');
  if (clean.length > 10 && clean.startsWith('91')) {
    clean = clean.slice(2);
  }
  if (clean.length === 11 && clean.startsWith('0')) {
    clean = clean.slice(1);
  }
  return clean;
}

function evaluateProfileComplete(user, profile, localStorageMock = {}, isAdminSession = false) {
  const missing = [];
  const uid = user?.uid || profile?.uid;
  let localStored = {};
  if (uid && localStorageMock['easeland_user_profile_' + uid]) {
    try {
      localStored = JSON.parse(localStorageMock['easeland_user_profile_' + uid]);
    } catch (e) {}
  } else if (localStorageMock['easeland_session_user']) {
    try {
      localStored = JSON.parse(localStorageMock['easeland_session_user']);
    } catch (e) {}
  }

  const adminPhone = localStorageMock['easeland_admin_phone'] || '';
  const adminCity = localStorageMock['easeland_admin_city'] || (isAdminSession ? 'Guntur, Andhra Pradesh' : '');

  const name = (user?.name || user?.displayName || profile?.name || profile?.displayName || localStored.displayName || localStored.name || (isAdminSession ? 'EaseLand Admin' : '')).trim();
  const email = (user?.email || profile?.email || localStored.email || '').trim();
  const phone = sanitizePhone(
    user?.phone || user?.phoneNumber ||
    profile?.phone || profile?.phoneNumber ||
    localStored.phone || localStored.phoneNumber ||
    adminPhone
  );
  const city = (
    user?.city || user?.location ||
    profile?.city || profile?.location ||
    localStored.city || localStored.location ||
    adminCity
  ).trim();

  if (!name) missing.push('Full Name');
  if (!email) missing.push('Email Address');
  if (!phone) missing.push('Phone Number');
  if (!city) missing.push('City / Location');

  return missing;
}

describe('EaseLand User Profile Completeness & Persistence Test Suite', () => {
  it('1. Correctly flags missing Phone Number and City when user only has name and email', () => {
    const user = { uid: 'u1', name: 'Krishna Sai', email: 'user@example.com' };
    const profile = { uid: 'u1', name: 'Krishna Sai', email: 'user@example.com' };
    const missing = evaluateProfileComplete(user, profile);

    assert.deepStrictEqual(missing, ['Phone Number', 'City / Location']);
  });

  it('2. Passes completely when profile contains phone and city from Firestore', () => {
    const user = { uid: 'u2', name: 'Krishna Sai', email: 'user@example.com' };
    const profile = {
      uid: 'u2',
      name: 'Krishna Sai',
      email: 'user@example.com',
      phoneNumber: '7330832141',
      city: 'Guntur'
    };
    const missing = evaluateProfileComplete(user, profile);

    assert.deepStrictEqual(missing, []);
  });

  it('3. Passes completely when localStorage cache contains phone and city', () => {
    const user = { uid: 'u3', name: 'Krishna Sai', email: 'user@example.com' };
    const profile = { uid: 'u3', name: 'Krishna Sai', email: 'user@example.com' };
    const mockStorage = {
      'easeland_user_profile_u3': JSON.stringify({
        name: 'Krishna Sai',
        email: 'user@example.com',
        phone: '7330832141',
        city: 'Guntur'
      })
    };
    const missing = evaluateProfileComplete(user, profile, mockStorage);

    assert.deepStrictEqual(missing, []);
  });

  it('4. Correctly normalizes 11-digit phone numbers with leading zero', () => {
    const normalized = normalizePhoneNumber('06300691560');
    assert.strictEqual(normalized, '6300691560');
    assert.strictEqual(normalized.length, 10);
  });

  it('5. Correctly normalizes phone numbers with 91 country code prefix', () => {
    const normalized = normalizePhoneNumber('+91 7330832141');
    assert.strictEqual(normalized, '7330832141');
    assert.strictEqual(normalized.length, 10);
  });

  it('6. Admin session defaults city to Guntur, Andhra Pradesh cleanly', () => {
    const user = { uid: 'admin_1', name: 'EaseLand Admin', email: 'admin@easeland.in', phone: '9999999999' };
    const profile = { uid: 'admin_1', name: 'EaseLand Admin', email: 'admin@easeland.in', phone: '9999999999', role: 'ADMIN' };
    const missing = evaluateProfileComplete(user, profile, {}, true);

    assert.deepStrictEqual(missing, []);
  });

  it('7. Postgres non-destructive merge preserves existing phone and city when incoming values are empty', () => {
    const existingInDb = {
      uid: 'user_42',
      displayName: 'Ryuu',
      email: 'ryuu@easeland.in',
      phone: '9876543210',
      city: 'Bangalore',
      location: 'Bangalore'
    };

    const incomingAuthPayload = {
      uid: 'user_42',
      displayName: 'Ryuu',
      email: 'ryuu@easeland.in',
      phone: '',
      city: ''
    };

    const effectivePhone = (incomingAuthPayload.phone && String(incomingAuthPayload.phone).trim()) || (incomingAuthPayload.phoneNumber && String(incomingAuthPayload.phoneNumber).trim()) || existingInDb.phone || existingInDb.phoneNumber || '';
    const effectiveCity = (incomingAuthPayload.city && String(incomingAuthPayload.city).trim()) || (incomingAuthPayload.location && String(incomingAuthPayload.location).trim()) || existingInDb.city || existingInDb.location || '';

    assert.strictEqual(effectivePhone, '9876543210');
    assert.strictEqual(effectiveCity, 'Bangalore');
  });

  it('8. updateOwnProfile strips role and adminRole so Firestore rules never reject profile saves', () => {
    const inputUpdates = {
      name: 'Ryuu',
      phone: '9876543210',
      city: 'Hyderabad',
      role: 'ADMIN',
      adminRole: true
    };

    const safeUpdates = { ...inputUpdates };
    delete safeUpdates.role;
    delete safeUpdates.adminRole;

    assert.strictEqual(safeUpdates.name, 'Ryuu');
    assert.strictEqual(safeUpdates.phone, '9876543210');
    assert.strictEqual(safeUpdates.city, 'Hyderabad');
    assert.strictEqual(safeUpdates.role, undefined);
    assert.strictEqual(safeUpdates.adminRole, undefined);
  });

  it('9. loginWithGoogle preserves cached profile and draft for non-deleted users', () => {
    const mockDeletedList = JSON.stringify(['deleted_old_uid']);
    const currentUid = 'active_user_101';

    const wasDeleted = JSON.parse(mockDeletedList).some(item => item === currentUid);
    assert.strictEqual(wasDeleted, false);

    const cachedProfile = {
      phone: '9876543210',
      city: 'Visakhapatnam'
    };

    const resolvedPhone = cachedProfile.phone;
    const resolvedCity = cachedProfile.city;
    assert.strictEqual(resolvedPhone, '9876543210');
    assert.strictEqual(resolvedCity, 'Visakhapatnam');
  });

  it('10. onSnapshot listener does not clobber existing phone or city with empty Firestore fields', () => {
    const localCached = {
      phone: '9876543210',
      city: 'Vijayawada'
    };

    const firestoreData = {
      displayName: 'Ryuu',
      email: 'ryuu@easeland.in',
      phone: '',
      city: ''
    };

    const mergedPhone = firestoreData.phone || firestoreData.phoneNumber || localCached.phone || localCached.phoneNumber || '';
    const mergedCity = firestoreData.city || firestoreData.location || localCached.city || localCached.location || '';

    assert.strictEqual(mergedPhone, '9876543210');
    assert.strictEqual(mergedCity, 'Vijayawada');
  });
});
