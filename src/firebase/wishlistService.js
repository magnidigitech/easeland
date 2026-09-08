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

/**
 * Add property to user's saved wishlist subcollection
 */
export async function addWishlistProperty(uid, propertyId) {
  try {
    if (!uid || !propertyId) return { success: false, error: 'UID and Property ID are required.' };
    const wishRef = doc(db, 'users', uid, 'wishlist', propertyId);
    await setDoc(wishRef, {
      propertyId,
      savedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Remove property from user's saved wishlist subcollection
 */
export async function removeWishlistProperty(uid, propertyId) {
  try {
    if (!uid || !propertyId) return { success: false, error: 'UID and Property ID are required.' };
    const wishRef = doc(db, 'users', uid, 'wishlist', propertyId);
    await deleteDoc(wishRef);
    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Check if a property is saved in user's wishlist
 */
export async function isPropertyWishlisted(uid, propertyId) {
  try {
    if (!uid || !propertyId) return false;
    const wishRef = doc(db, 'users', uid, 'wishlist', propertyId);
    const snap = await getDoc(wishRef);
    return snap.exists();
  } catch (error) {
    return false;
  }
}

/**
 * Get all property IDs saved in user's wishlist subcollection
 */
export async function getUserWishlist(uid) {
  try {
    if (!uid) return { success: false, error: 'UID is required.' };
    const wishColRef = collection(db, 'users', uid, 'wishlist');
    const snap = await getDocs(wishColRef);
    const propertyIds = snap.docs.map(doc => doc.id);
    return { success: true, propertyIds };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Get full public representations for all saved wishlist properties.
 * Respects public marketplace visibility (LIVE && isPublished).
 * Provides safe non-sensitive fallback for unavailable/archived properties without leaking private details.
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
      return {
        propertyId,
        isAvailable: false,
        title: 'This property is no longer publicly available',
        priceDisplay: 'N/A',
        location: null,
        media: []
      };
    });

    const properties = await Promise.all(propertyPromises);
    return { success: true, properties };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

