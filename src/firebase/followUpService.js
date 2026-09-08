import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config.js';
import { FollowUpStatus } from './schema.js';
import { formatFirestoreError } from './userService.js';

export async function scheduleFollowUp(followUpData) {
  try {
    if (!followUpData.propertyId || !followUpData.customerId || !followUpData.ownerId) {
      return { success: false, error: 'Property ID, Customer ID, and Owner ID are required.' };
    }

    const fupRef = doc(collection(db, 'followUps'));
    const followUpId = fupRef.id;

    const payload = {
      followUpId,
      dealId: followUpData.dealId || null,
      propertyId: followUpData.propertyId,
      customerId: followUpData.customerId,
      ownerId: followUpData.ownerId,
      assignedAdminId: followUpData.assignedAdminId || null,
      scheduledDateTime: followUpData.scheduledDateTime || new Date().toISOString(),
      type: followUpData.type || 'SITE_VISIT',
      status: FollowUpStatus.SCHEDULED,
      outcomeNotes: followUpData.outcomeNotes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(fupRef, payload);
    return { success: true, followUpId };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

export async function getUserFollowUps(userId, isOwner = false) {
  try {
    if (!userId) return { success: false, error: 'User ID is required.' };
    const fieldName = isOwner ? 'ownerId' : 'customerId';
    const q = query(
      collection(db, 'followUps'),
      where(fieldName, '==', userId),
      orderBy('scheduledDateTime', 'asc')
    );
    const snap = await getDocs(q);
    const followUps = snap.docs.map(doc => doc.data());
    return { success: true, followUps };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

export async function updateFollowUpStatus(followUpId, status, outcomeNotes = '') {
  try {
    if (!followUpId) return { success: false, error: 'Follow-Up ID is required.' };
    const fupRef = doc(db, 'followUps', followUpId);
    await updateDoc(fupRef, {
      status,
      outcomeNotes,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}
