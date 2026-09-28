import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config.js';
import { getPublicPropertyById } from './propertyService.js';
import { formatFirestoreError } from './userService.js';

const triggerWishlistEvent = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('easeland-wishlist-updated'));
  }
};

/**
 * Add property to user's saved wishlist subcollection and local store
 */
export async function addWishlistProperty(uid, propertyId) {
  try {
    if (!propertyId) return { success: false, error: 'Property ID is required.' };

    if (uid) {
      const wishRef = doc(db, 'users', uid, 'wishlist', String(propertyId));
      await setDoc(wishRef, {
        propertyId: String(propertyId),
        savedAt: serverTimestamp()
      });
    }

    try {
      const stored = JSON.parse(localStorage.getItem('easeland_saved_wishlist_ids') || '[]');
      if (!stored.includes(String(propertyId))) {
        stored.push(String(propertyId));
        localStorage.setItem('easeland_saved_wishlist_ids', JSON.stringify(stored));
      }
    } catch (e) {}

    triggerWishlistEvent();
    return { success: true };
  } catch (error) {
    // Even if Firestore fails, maintain local state
    try {
      const stored = JSON.parse(localStorage.getItem('easeland_saved_wishlist_ids') || '[]');
      if (!stored.includes(String(propertyId))) {
        stored.push(String(propertyId));
        localStorage.setItem('easeland_saved_wishlist_ids', JSON.stringify(stored));
      }
    } catch (e) {}
    triggerWishlistEvent();
    return { success: true };
  }
}

/**
 * Remove property from user's saved wishlist subcollection and local store
 */
export async function removeWishlistProperty(uid, propertyId) {
  try {
    if (!propertyId) return { success: false, error: 'Property ID is required.' };

    if (uid) {
      const wishRef = doc(db, 'users', uid, 'wishlist', String(propertyId));
      await deleteDoc(wishRef);
    }

    try {
      const stored = JSON.parse(localStorage.getItem('easeland_saved_wishlist_ids') || '[]');
      const updated = stored.filter(id => id !== String(propertyId));
      localStorage.setItem('easeland_saved_wishlist_ids', JSON.stringify(updated));
    } catch (e) {}

    triggerWishlistEvent();
    return { success: true };
  } catch (error) {
    try {
      const stored = JSON.parse(localStorage.getItem('easeland_saved_wishlist_ids') || '[]');
      const updated = stored.filter(id => id !== String(propertyId));
      localStorage.setItem('easeland_saved_wishlist_ids', JSON.stringify(updated));
    } catch (e) {}
    triggerWishlistEvent();
    return { success: true };
  }
}

/**
 * Check if a property is saved in user's wishlist
 */
export async function isPropertyWishlisted(uid, propertyId) {
  try {
    if (!propertyId) return false;

    try {
      const stored = JSON.parse(localStorage.getItem('easeland_saved_wishlist_ids') || '[]');
      if (stored.includes(String(propertyId))) return true;
    } catch (e) {}

    if (uid) {
      const wishRef = doc(db, 'users', uid, 'wishlist', String(propertyId));
      const snap = await getDoc(wishRef);
      return snap.exists();
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Get all property IDs saved in user's wishlist subcollection
 */
export async function getUserWishlist(uid) {
  try {
    let propertyIds = [];
    if (uid) {
      const wishColRef = collection(db, 'users', uid, 'wishlist');
      const snap = await getDocs(wishColRef);
      propertyIds = snap.docs.map(doc => doc.id);
    }

    try {
      const localIds = JSON.parse(localStorage.getItem('easeland_saved_wishlist_ids') || '[]');
      const combined = new Set([...propertyIds, ...localIds]);
      propertyIds = Array.from(combined);
    } catch (e) {}

    return { success: true, propertyIds };
  } catch (error) {
    try {
      const localIds = JSON.parse(localStorage.getItem('easeland_saved_wishlist_ids') || '[]');
      return { success: true, propertyIds: localIds };
    } catch (e) {
      return { success: false, error: formatFirestoreError(error) };
    }
  }
}

/**
 * Get full public representations for all saved wishlist properties.
 * Respects public marketplace visibility (LIVE && isPublished).
 */
export async function getUserWishlistProperties(uid) {
  try {
    const listRes = await getUserWishlist(uid);
    if (!listRes.success) return listRes;

    const propertyIds = listRes.propertyIds || [];
    if (propertyIds.length === 0) return { success: true, properties: [] };

    const propertyPromises = propertyIds.map(async (propertyId) => {
      const pubRes = await getPublicPropertyById(propertyId);
      if (pubRes.success && pubRes.property) {
        return {
          ...pubRes.property,
          isAvailable: true
        };
      }
      return null;
    });

    const results = await Promise.all(propertyPromises);
    const properties = results.filter(Boolean);
    return { success: true, properties };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

