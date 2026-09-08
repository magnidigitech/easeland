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
import { DealStage } from './schema.js';
import { formatFirestoreError } from './userService.js';

export async function createDeal(dealData) {
  try {
    if (!dealData.propertyId || !dealData.buyerId || !dealData.ownerId) {
      return { success: false, error: 'Property ID, Buyer ID, and Owner ID are required.' };
    }

    const dealRef = doc(collection(db, 'deals'));
    const dealId = dealRef.id;

    const payload = {
      dealId,
      propertyId: dealData.propertyId,
      propertyTitle: dealData.propertyTitle || 'Property Listing',
      ownerId: dealData.ownerId,
      buyerId: dealData.buyerId,
      enquiryId: dealData.enquiryId || null,
      assignedAdminId: dealData.assignedAdminId || null,
      stage: DealStage.NEW,
      dealAmount: dealData.dealAmount || null,
      notes: dealData.notes || '',
      lastUpdate: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(dealRef, payload);
    return { success: true, dealId };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

export async function getUserDeals(userId, isOwner = false) {
  try {
    if (!userId) return { success: false, error: 'User ID is required.' };
    const fieldName = isOwner ? 'ownerId' : 'buyerId';
    const q = query(
      collection(db, 'deals'),
      where(fieldName, '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const deals = snap.docs.map(doc => doc.data());
    return { success: true, deals };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

export async function updateDealStage(dealId, newStage, notes = '') {
  try {
    if (!dealId) return { success: false, error: 'Deal ID is required.' };
    const dealRef = doc(db, 'deals', dealId);
    await updateDoc(dealRef, {
      stage: newStage,
      notes,
      lastUpdate: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}
