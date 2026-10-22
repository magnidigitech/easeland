import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from './config.js';
import { logAdminActivity } from './verificationService.js';

/**
 * Helper to format Firestore error messages consistently.
 */
export function formatFirestoreError(error) {
  if (!error) return 'An unexpected system error occurred. Please try again.';
  if (typeof error === 'string') return error;

  const code = error.code || '';
  if (code === 'permission-denied' || code === 'storage/unauthorized') {
    return 'Access Restricted: You do not have permissions to perform this operation or account is suspended/unauthenticated, or Firebase Storage security rules are blocking uploads.';
  }
  if (code === 'storage/bucket-not-found') {
    return 'Storage Bucket Not Found: Please verify Firebase Storage is enabled in Firebase Console and VITE_FIREBASE_STORAGE_BUCKET in your .env file.';
  }
  if (code === 'storage/project-not-found') {
    return 'Firebase Storage Not Enabled: Please open Firebase Console -> Storage and click "Get Started".';
  }
  if (code === 'not-found' || code === 'storage/object-not-found') {
    return 'Resource Not Found: Requested Data Not Found.';
  }
  if (code === 'unavailable') {
    return 'Connection Error: Unable to reach EaseLand database servers. Please check your internet connection and retry.';
  }
  if (code === 'unauthenticated') {
    return 'Authentication Required: Please log in to complete this action.';
  }
  return error.message || 'A database service error occurred. Please try again.';
}

export async function syncUserToPostgres(userData) {
  try {
    if (!userData || (!userData.uid && !userData.id && !userData.email)) return;
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
  } catch (err) {
    console.warn('PostgreSQL user sync note:', err);
  }
}

/**
 * Create a new user profile document in users/{uid}.
 * Ensures clean-slate creation with zero trace of old data or removed status.
 */
export async function createUserProfile(uid, data) {
  try {
    if (!uid) return { success: false, error: 'UID is required' };

    // 1. Unblacklist user from local deleted users list upon new registration or relogin
    if (typeof window !== 'undefined') {
      try {
        const rawDel = localStorage.getItem('easeland_deleted_users');
        if (rawDel) {
          const delArr = JSON.parse(rawDel);
          const uIdLow = String(uid || '').toLowerCase().trim();
          const emLow = String(data.email || '').toLowerCase().trim();
          const filtered = delArr.filter(item => {
            const itLow = String(item || '').toLowerCase().trim();
            return itLow !== uIdLow && (!emLow || itLow !== emLow);
          });
          localStorage.setItem('easeland_deleted_users', JSON.stringify(filtered));
        }
      } catch (e) {}

      // 2. Wipe stale profile, draft, and wizard location caches to prevent data leakage
      try {
        localStorage.removeItem('easeland_user_profile_' + uid);
        localStorage.removeItem('easeland_draft_' + uid);
        localStorage.removeItem('easeland_wizard_location_' + uid);
        
        // Clean any old properties from local user properties cache
        const rawProps = localStorage.getItem('easeland_user_properties');
        if (rawProps) {
          const parsed = JSON.parse(rawProps);
          if (Array.isArray(parsed)) {
            const uIdLow = String(uid || '').toLowerCase().trim();
            const emLow = String(data.email || '').toLowerCase().trim();
            const cleaned = parsed.filter(p => {
              const pOwner = String(p.ownerId || p.userId || '').toLowerCase().trim();
              const pEmail = String(p.ownerEmail || p.ownerPrivateEmail || '').toLowerCase().trim();
              return pOwner !== uIdLow && (!emLow || pEmail !== emLow);
            });
            localStorage.setItem('easeland_user_properties', JSON.stringify(cleaned));
          }
        }
      } catch (e) {}
    }

    const userRef = doc(db, 'users', uid);
    const profile = {
      uid,
      displayName: data.displayName || data.name || 'EaseLand User',
      email: data.email || '',
      phone: data.phone || '',
      role: 'USER',
      accountStatus: 'ACTIVE',
      capabilities: ['CUSTOMER', 'OWNER'],
      ownerVerificationState: 'NOT_VERIFIED',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Clean overwrite without merge: true to wipe any old removed fields or residual notes
    await setDoc(userRef, profile);
    syncUserToPostgres({ ...profile, id: uid, uid });
    return { success: true, user: profile };
  } catch (error) {
    console.error('Error creating user profile:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch current user's profile document from users/{uid}.
 */
export async function getCurrentUserProfile(uid) {
  try {
    if (!uid) return { success: false, error: 'UID required' };
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const uStatus = String(data.accountStatus || data.status || '').toUpperCase();
      // If document is flagged as REMOVED or DELETED, treat as non-existent to trigger fresh registration
      if (uStatus === 'REMOVED' || uStatus === 'DELETED' || uStatus === 'ACCOUNT_DELETED') {
        return { success: false, error: 'Account was removed' };
      }

      const extractedPhone = data.phone || data.phoneNumber || data.mobile || data.contactNumber || data.contactPhone || data.phoneNo || data.contact || '';
      const extractedName = data.displayName || data.name || data.fullName || '';
      return {
        success: true,
        profile: {
          uid: snap.id,
          ...data,
          phone: extractedPhone,
          phoneNumber: extractedPhone,
          displayName: extractedName || data.displayName,
          name: extractedName || data.displayName
        }
      };
    }
    return { success: false, error: 'Profile not found' };
  } catch (error) {
    console.error('Error fetching profile for ' + uid + ':', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user's own profile data.
 */
export async function updateOwnProfile(uid, updates) {
  try {
    if (!uid) return { success: false, error: 'UID required' };
    const userRef = doc(db, 'users', uid);

    const phoneVal = updates.phone || updates.phoneNumber || updates.mobile || updates.contactNumber || '';
    const nameVal = updates.displayName || updates.name || '';

    const safeUpdates = {
      ...updates,
      updatedAt: serverTimestamp()
    };
    if (phoneVal) {
      safeUpdates.phone = phoneVal;
      safeUpdates.phoneNumber = phoneVal;
    }
    if (nameVal) {
      safeUpdates.displayName = nameVal;
      safeUpdates.name = nameVal;
    }

    const savePromise = setDoc(userRef, safeUpdates, { merge: true });
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 2000));
    await Promise.race([savePromise, timeoutPromise]);
    return { success: true };
  } catch (error) {
    console.warn('Firestore profile update note for ' + uid + ':', error.message || error);
    return { success: true };
  }
}

/**
 * Update user communication preferences.
 */
export async function updateCommunicationPreferences(uid, preferences) {
  try {
    if (!uid) return { success: false, error: 'UID required' };
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      security: preferences,
      communicationPreferences: preferences,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error updating preferences for ' + uid + ':', error);
    return { success: false, error: error.message };
  }
}

import { ensureAuthSession } from './authService.js';

/**
 * Fetch all registered users for Admin Governance Directory directly from Cloud Firestore.
 */
export async function getAllUsersAdmin() {
  try {
    let deletedUsers = [];
    try {
      if (typeof window !== 'undefined') {
        const rawDel = localStorage.getItem('easeland_deleted_users');
        if (rawDel) deletedUsers = JSON.parse(rawDel).map(v => String(v).toLowerCase().trim());
      }
    } catch (e) { }

    const fetchedMap = new Map();

    // 1. Fetch from server backend (/api/admin/firebase-users - combines Firebase Auth + PostgreSQL + Local)
    try {
      const serverRes = await fetch('/api/admin/firebase-users');
      if (serverRes.ok) {
        const serverJson = await serverRes.json();
        if (serverJson.success && Array.isArray(serverJson.users)) {
          serverJson.users.forEach(u => {
            if (!u) return;
            const uId = String(u.uid || u.id || '').toLowerCase().trim();
            const uEmail = String(u.email || '').toLowerCase().trim();
            if (deletedUsers.includes(uId) || deletedUsers.includes(uEmail)) return;
            const key = uEmail || uId;
            if (key) fetchedMap.set(key, u);
          });
        }
      }
    } catch (eServer) {
      console.warn('Backend users fetch note:', eServer.message);
    }

    // 2. Fetch and merge from Cloud Firestore users collection
    try {
      await ensureAuthSession();
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);

      snapshot.forEach((docSnap) => {
        try {
          const data = docSnap.data();
          const docId = String(docSnap.id || '').toLowerCase().trim();
          const userEmail = String(data.email || '').toLowerCase().trim();
          const uStatus = String(data.accountStatus || data.status || '').toUpperCase();

          if (uStatus === 'REMOVED' || uStatus === 'DELETED' || uStatus === 'ACCOUNT_DELETED') return;
          if (deletedUsers.includes(docId) || deletedUsers.includes(userEmail)) return;

          const extractedPhone = data.phone || data.phoneNumber || data.mobile || data.contactNumber || data.contactPhone || data.phoneNo || data.contact || data.telePhone || '';

          let createdAtFormatted = null;
          if (data.createdAt) {
            try {
              if (typeof data.createdAt.toDate === 'function') {
                createdAtFormatted = data.createdAt.toDate().toISOString();
              } else if (typeof data.createdAt.seconds === 'number') {
                createdAtFormatted = new Date(data.createdAt.seconds * 1000).toISOString();
              } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
                createdAtFormatted = new Date(data.createdAt).toISOString();
              }
            } catch (e) {
              createdAtFormatted = new Date().toISOString();
            }
          }

          const existing = fetchedMap.get(userEmail) || fetchedMap.get(docId) || {};
          const userObj = {
            ...existing,
            ...data,
            id: docSnap.id,
            uid: docSnap.id,
            name: data.displayName || data.name || data.fullName || existing.name || existing.displayName || ('User ' + docSnap.id.substring(0, 5)),
            displayName: data.displayName || data.name || data.fullName || existing.displayName || existing.name || ('User ' + docSnap.id.substring(0, 5)),
            email: data.email || existing.email || '',
            emailVerified: data.emailVerified ?? existing.emailVerified ?? (data.email?.endsWith('@gmail.com') ? true : false),
            authProvider: data.authProvider || data.providerId || existing.authProvider || (data.email?.endsWith('@gmail.com') ? 'Google OAuth' : 'Email/Password'),
            phone: extractedPhone || existing.phone || '',
            phoneNumber: extractedPhone || existing.phoneNumber || '',
            role: (data.adminRole || data.role === 'ADMIN' || existing.role === 'ADMIN' || data.email === 'admin@easeland.in') ? 'ADMIN' : (data.role || existing.role || 'USER'),
            status: data.accountStatus || data.status || existing.status || 'ACTIVE',
            accountStatus: data.accountStatus || data.status || existing.accountStatus || 'ACTIVE',
            postedListingsCount: data.postedListingsCount || existing.postedListingsCount || 0,
            createdAt: createdAtFormatted || existing.createdAt || new Date().toISOString(),
            suspension: data.suspension || existing.suspension || null
          };

          const key = (userObj.email || userObj.uid).toLowerCase();
          fetchedMap.set(key, userObj);
        } catch (errDoc) {
          console.error('Error processing user document ' + docSnap.id + ':', errDoc);
        }
      });
    } catch (fsErr) {
      console.warn('Firestore getAllUsersAdmin note:', fsErr.message);
    }

    const users = Array.from(fetchedMap.values());
    return { success: true, users };
  } catch (error) {
    console.error('Error fetching all users for admin:', error);
    return { success: false, error: error.message, users: [] };
  }
}

/**
 * Continuous real-time listener for registered users collection in Cloud Firestore.
 * Invokes onUsersUpdate callback instantly whenever any user is created, updated, or modified.
 */
export function subscribeToUsersAdmin(onUsersUpdate) {
  try {
    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      let deletedUsers = [];
      try {
        if (typeof window !== 'undefined') {
          const rawDel = localStorage.getItem('easeland_deleted_users');
          if (rawDel) deletedUsers = JSON.parse(rawDel).map(v => String(v).toLowerCase().trim());
        }
      } catch (e) { }

      const fetchedMap = new Map();
      snapshot.forEach((docSnap) => {
        try {
          const data = docSnap.data();
          const docId = String(docSnap.id || '').toLowerCase().trim();
          const userEmail = String(data.email || '').toLowerCase().trim();
          const uStatus = String(data.accountStatus || data.status || '').toUpperCase();

          if (uStatus === 'REMOVED' || uStatus === 'DELETED' || uStatus === 'ACCOUNT_DELETED') return;
          if (deletedUsers.includes(docId) || deletedUsers.includes(userEmail)) return;

          const extractedPhone = data.phone || data.phoneNumber || data.mobile || data.contactNumber || data.contactPhone || data.phoneNo || data.contact || data.telePhone || '';

          let createdAtFormatted = null;
          if (data.createdAt) {
            try {
              if (typeof data.createdAt.toDate === 'function') {
                createdAtFormatted = data.createdAt.toDate().toISOString();
              } else if (typeof data.createdAt.seconds === 'number') {
                createdAtFormatted = new Date(data.createdAt.seconds * 1000).toISOString();
              } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
                createdAtFormatted = new Date(data.createdAt).toISOString();
              }
            } catch (e) {
              createdAtFormatted = new Date().toISOString();
            }
          }

          const userObj = {
            id: docSnap.id,
            uid: docSnap.id,
            name: data.displayName || data.name || data.fullName || 'User ' + docSnap.id.substring(0, 5),
            displayName: data.displayName || data.name || data.fullName || 'User ' + docSnap.id.substring(0, 5),
            email: data.email || '',
            emailVerified: data.emailVerified ?? (data.email?.endsWith('@gmail.com') ? true : false),
            authProvider: data.authProvider || data.providerId || (data.email?.endsWith('@gmail.com') ? 'Google OAuth' : 'Email/Password'),
            phone: extractedPhone,
            phoneNumber: extractedPhone,
            role: data.adminRole ? 'ADMIN' : (data.role || 'USER'),
            status: data.accountStatus || data.status || 'ACTIVE',
            accountStatus: data.accountStatus || data.status || 'ACTIVE',
            postedListingsCount: data.postedListingsCount || 0,
            createdAt: createdAtFormatted,
            suspension: data.suspension || null
          };

          const key = (userObj.email || userObj.uid).toLowerCase();
          fetchedMap.set(key, userObj);
        } catch (errDoc) {
          console.error('Error processing user snapshot doc:', errDoc);
        }
      });

      const users = Array.from(fetchedMap.values());
      if (typeof onUsersUpdate === 'function') {
        onUsersUpdate(users);
      }
    }, (err) => {
      console.warn('Firestore users subscription notice:', err.message);
    });

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to attach Firestore users onSnapshot:', err);
    return () => {};
  }
}

/**
 * Temporarily suspend a user account.
 * Updates accountStatus and status to SUSPENDED in users/{userId} and records suspension metadata.
 */
export async function suspendUserAccount(userId, adminUid, durationDays = 7, reason = 'Policy Violation') {
  try {
    if (!userId || !adminUid) {
      throw new Error('User ID and Admin UID are required for suspension.');
    }

    const userRef = doc(db, 'users', userId);
    const now = new Date();
    const suspendedUntil = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const suspensionPayload = {
      days: durationDays,
      reason,
      suspendedAt: now.toISOString(),
      suspendedUntil,
      suspendedBy: adminUid
    };

    // Use setDoc with merge: true so it works even if document did not previously exist
    await setDoc(userRef, {
      accountStatus: 'SUSPENDED',
      status: 'SUSPENDED',
      suspension: suspensionPayload,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Sync to PostgreSQL backend
    syncUserToPostgres({
      uid: userId,
      id: userId,
      accountStatus: 'SUSPENDED',
      status: 'SUSPENDED',
      suspension: suspensionPayload
    });

    // Audit log
    await logAdminActivity(
      'USER_SUSPENDED',
      'User ' + userId + ' account suspended for ' + durationDays + ' days. Reason: ' + reason,
      adminUid
    );

    return { success: true };
  } catch (error) {
    console.error('Error suspending user ' + userId + ':', error);
    return { success: false, error: error.message };
  }
}

/**
 * Lift suspension and restore user account status to ACTIVE.
 */
export async function unsuspendUserAccount(userId, adminUid) {
  try {
    if (!userId || !adminUid) {
      throw new Error('User ID and Admin UID are required to lift suspension.');
    }

    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      accountStatus: 'ACTIVE',
      status: 'ACTIVE',
      suspension: null,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Sync to PostgreSQL backend
    syncUserToPostgres({
      uid: userId,
      id: userId,
      accountStatus: 'ACTIVE',
      status: 'ACTIVE',
      suspension: null
    });

    // Audit log
    await logAdminActivity(
      'USER_UNSUSPENDED',
      'User ' + userId + ' account suspension lifted.',
      adminUid
    );

    return { success: true };
  } catch (error) {
    console.error('Error lifting suspension for user ' + userId + ':', error);
    return { success: false, error: error.message };
  }
}

/**
 * Permanently remove user account and all posted properties.
 */
export async function removeUserAccount(userId, adminUid, reason = 'Policy Violation', userEmail = '') {
  try {
    if (!userId) {
      throw new Error('User ID is required to remove account.');
    }

    const targetIdStr = String(userId).toLowerCase().trim();
    const targetEmStr = String(userEmail || '').toLowerCase().trim();

    // 0. Update localStorage caches and blacklist user BEFORE ANY ASYNC CALLS
    try {
      if (typeof window !== 'undefined') {
        const rawDel = localStorage.getItem('easeland_deleted_users');
        let delArr = rawDel ? JSON.parse(rawDel) : [];
        if (userId && !delArr.includes(targetIdStr)) delArr.push(targetIdStr);
        if (userEmail && !delArr.includes(targetEmStr)) delArr.push(targetEmStr);
        localStorage.setItem('easeland_deleted_users', JSON.stringify(delArr));

        const rawReg = localStorage.getItem('easeland_registered_users');
        if (rawReg) {
          const parsed = JSON.parse(rawReg);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter(u => {
              if (!u) return false;
              const uId = String(u.id || u.uid || '').toLowerCase().trim();
              const uEm = String(u.email || '').toLowerCase().trim();
              return uId !== targetIdStr && (!targetEmStr || uEm !== targetEmStr);
            });
            localStorage.setItem('easeland_registered_users', JSON.stringify(updated));
          }
        }

        // Remove user-specific profile, draft, location, and user properties
        localStorage.removeItem('easeland_user_profile_' + userId);
        localStorage.removeItem('easeland_draft_' + userId);
        localStorage.removeItem('easeland_wizard_location_' + userId);

        const rawUserProps = localStorage.getItem('easeland_user_properties');
        if (rawUserProps) {
          const parsed = JSON.parse(rawUserProps);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter(p => {
              const pOwner = String(p.ownerId || p.userId || '').toLowerCase().trim();
              const pEmail = String(p.ownerEmail || p.ownerPrivateEmail || '').toLowerCase().trim();
              return pOwner !== targetIdStr && (!targetEmStr || pEmail !== targetEmStr);
            });
            localStorage.setItem('easeland_user_properties', JSON.stringify(cleaned));
          }
        }
      }
    } catch (e) { }

    // 1. Cascade delete all properties posted by this user from Cloud Firestore
    try {
      const pColl = collection(db, 'properties');
      const propertyIds = new Set();

      try {
        const q1 = query(pColl, where('ownerId', '==', userId));
        const snap1 = await getDocs(q1);
        snap1.docs.forEach(d => propertyIds.add(d.id));
      } catch (e1) {}

      try {
        const q2 = query(pColl, where('userId', '==', userId));
        const snap2 = await getDocs(q2);
        snap2.docs.forEach(d => propertyIds.add(d.id));
      } catch (e2) {}

      if (userEmail) {
        try {
          const q3 = query(pColl, where('ownerEmail', '==', userEmail));
          const snap3 = await getDocs(q3);
          snap3.docs.forEach(d => propertyIds.add(d.id));
        } catch (e3) {}
        try {
          const q4 = query(pColl, where('ownerPrivateEmail', '==', userEmail));
          const snap4 = await getDocs(q4);
          snap4.docs.forEach(d => propertyIds.add(d.id));
        } catch (e4) {}
      }

      for (const pId of propertyIds) {
        try { await deleteDoc(doc(db, 'properties', pId)); } catch (e) {}
        try { await deleteDoc(doc(db, 'propertyPrivate', pId)); } catch (e) {}
        try { await deleteDoc(doc(db, 'propertyMediaPrivate', pId)); } catch (e) {}
        try { await deleteDoc(doc(db, 'verificationRecords', pId)); } catch (e) {}
      }
    } catch (fsCascadeErr) {
      console.warn('Firestore property cascade deletion note:', fsCascadeErr);
    }

    // 2. Delete user account document from Cloud Firestore
    const userRef = doc(db, 'users', userId);
    try {
      await deleteDoc(userRef);
    } catch (dErr) {
      await setDoc(userRef, {
        accountStatus: 'REMOVED',
        status: 'REMOVED',
        removalReason: reason,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    // 3. Call authoritative DELETE on server backend (cascades PostgreSQL + local stores + Firebase Auth)
    try {
      const emailQuery = userEmail ? ('?email=' + encodeURIComponent(userEmail)) : '';
      await fetch('/api/users/' + encodeURIComponent(userId) + emailQuery, { method: 'DELETE' });
    } catch (eDel) { }


    await logAdminActivity(
      'USER_REMOVED',
      'User ' + userId + ' account and associated properties permanently removed. Reason: ' + reason,
      adminUid || 'admin_uid_001'
    );

    return { success: true };
  } catch (error) {
    console.error('Error removing user account ' + userId + ':', error);
    return { success: false, error: error.message };
  }
}
