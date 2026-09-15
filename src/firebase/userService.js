import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteField,
  serverTimestamp
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

/**
 * Create a new user profile document in users/{uid}.
 */
export async function createUserProfile(uid, data) {
  try {
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
    await setDoc(userRef, profile, { merge: true });
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
      if (data.phoneNumber !== undefined || data.name !== undefined) {
        updateDoc(userRef, {
          phoneNumber: deleteField(),
          name: deleteField()
        }).catch(e => console.warn('Auto-cleanup warning:', e));
      }
      return { success: true, profile: { uid: snap.id, ...data } };
    }
    return { success: false, error: 'Profile not found' };
  } catch (error) {
    console.error(`Error fetching profile for ${uid}:`, error);
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

    const cleanedUpdates = { ...updates };
    delete cleanedUpdates.phoneNumber;
    delete cleanedUpdates.name;

    await setDoc(userRef, {
      ...cleanedUpdates,
      phoneNumber: deleteField(),
      name: deleteField(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error(`Error updating profile for ${uid}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user communication preferences.
 */
export async function updateCommunicationPreferences(uid, preferences) {
  try {
    if (!uid) return { success: false, error: 'UID required' };
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      communicationPreferences: preferences,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error(`Error updating preferences for ${uid}:`, error);
    return { success: false, error: error.message };
  }
}

import { ensureAuthSession } from './authService.js';

/**
 * Fetch all registered users for Admin Governance Directory directly from Cloud Firestore.
 */
export async function getAllUsersAdmin() {
  try {
    await ensureAuthSession();
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    const users = [];

    snapshot.forEach((docSnap) => {
      try {
        const data = docSnap.data();

        // Auto cleanup legacy fields on fetch if any present
        if (data.phoneNumber !== undefined || data.name !== undefined) {
          updateDoc(doc(db, 'users', docSnap.id), {
            phoneNumber: deleteField(),
            name: deleteField()
          }).catch(() => {});
        }

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

        users.push({
          id: docSnap.id,
          uid: docSnap.id,
          name: data.displayName || data.name || data.fullName || 'User ' + docSnap.id.substring(0, 5),
          email: data.email || '',
          phone: data.phone || data.phoneNumber || '',
          role: data.adminRole ? 'ADMIN' : (data.role || 'USER'),
          status: data.accountStatus || 'ACTIVE',
          postedListingsCount: data.postedListingsCount || 0,
          createdAt: createdAtFormatted,
          suspension: data.suspension || null
        });
      } catch (errDoc) {
        console.error(`Error processing user document ${docSnap.id}:`, errDoc);
      }
    });

    return { success: true, users };
  } catch (error) {
    console.error('Error fetching all users for admin:', error);
    return { success: false, error: error.message, users: [] };
  }
}

/**
 * Temporarily suspend a user account.
 * Updates accountStatus to SUSPENDED in users/{userId} and records suspension metadata.
 */
export async function suspendUserAccount(userId, adminUid, durationDays = 7, reason = 'Policy Violation') {
  try {
    if (!userId || !adminUid) {
      throw new Error('User ID and Admin UID are required for suspension.');
    }

    const userRef = doc(db, 'users', userId);
    const now = new Date();
    const suspendedUntil = new Date(now.getTime() + (durationDays * 24 * 60 * 60 * 1000)).toISOString();

    const suspensionData = {
      accountStatus: 'SUSPENDED',
      suspension: {
        suspendedAt: now.toISOString(),
        suspendedUntil,
        durationDays,
        reason,
        suspendedBy: adminUid
      },
      updatedAt: serverTimestamp()
    };

    await updateDoc(userRef, suspensionData);

    // Audit log
    await logAdminActivity(
      'USER_SUSPENDED',
      `User ${userId} suspended for ${durationDays} days. Reason: ${reason}`,
      adminUid
    );

    return { success: true, suspendedUntil };
  } catch (error) {
    console.error(`Error suspending user ${userId}:`, error);
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
    await updateDoc(userRef, {
      accountStatus: 'ACTIVE',
      suspension: null,
      updatedAt: serverTimestamp()
    });

    // Audit log
    await logAdminActivity(
      'USER_UNSUSPENDED',
      `User ${userId} account suspension lifted.`,
      adminUid
    );

    return { success: true };
  } catch (error) {
    console.error(`Error lifting suspension for user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Permanently remove user account document from Firestore.
 */
export async function removeUserAccount(userId, adminUid, reason = 'Policy Violation') {
  try {
    if (!userId) {
      throw new Error('User ID is required to remove account.');
    }

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      accountStatus: 'REMOVED',
      removalReason: reason,
      updatedAt: serverTimestamp()
    });

    await logAdminActivity(
      'USER_REMOVED',
      `User ${userId} account permanently removed by admin. Reason: ${reason}`,
      adminUid || 'admin_uid_001'
    );

    return { success: true };
  } catch (error) {
    console.error(`Error removing user account ${userId}:`, error);
    return { success: false, error: error.message };
  }
}
