import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config.js';
import { EnquiryStatus, ListingStatus } from './schema.js';
import { formatFirestoreError } from './userService.js';

/**
 * Valid EnquiryStatus transition matrix
 */
export const ALLOWED_STATUS_TRANSITIONS = {
  [EnquiryStatus.SUBMITTED]: [EnquiryStatus.CONTACTED, EnquiryStatus.IN_PROGRESS, EnquiryStatus.CLOSED],
  [EnquiryStatus.CONTACTED]: [EnquiryStatus.IN_PROGRESS, EnquiryStatus.COMPLETED, EnquiryStatus.CLOSED],
  [EnquiryStatus.IN_PROGRESS]: [EnquiryStatus.COMPLETED, EnquiryStatus.CLOSED],
  [EnquiryStatus.COMPLETED]: [],
  [EnquiryStatus.CLOSED]: []
};

/**
 * Submit direct customer enquiry for a property.
 * Authoritatively verifies property listing status (LIVE && isPublished) and derives ownerId from property record.
 */
export async function createEnquiry(enquiryData) {
  try {
    const customerId = enquiryData.customerId || enquiryData.buyerId || enquiryData.customerUserId;
    if (!enquiryData.propertyId || !customerId) {
      return { success: false, error: 'Property ID and Customer ID are required.' };
    }

    // 1. Authoritative Property Fetch & Validation
    const propRef = doc(db, 'properties', enquiryData.propertyId);
    const propSnap = await getDoc(propRef);

    if (!propSnap.exists()) {
      return { success: false, error: 'Target property does not exist or has been removed.' };
    }

    const propData = propSnap.data();

    // 2. Enforce Public Marketplace Visibility
    if (propData.listingStatus !== ListingStatus.LIVE || propData.isPublished !== true) {
      return { success: false, error: 'Enquiries can only be submitted for live and published properties.' };
    }

    // 3. Authoritative Owner Derivation
    const authoritativeOwnerId = propData.ownerId;
    if (!authoritativeOwnerId) {
      return { success: false, error: 'Property owner record is invalid.' };
    }

    const enqRef = doc(collection(db, 'enquiries'));
    const enquiryId = enqRef.id;

    const payload = {
      enquiryId,
      propertyId: enquiryData.propertyId,
      propertyTitle: propData.title || enquiryData.propertyTitle || 'Property Listing',
      propertyReferenceId: propData.referenceId || enquiryData.propertyReferenceId || '',
      ownerId: authoritativeOwnerId,
      ownerName: propData.ownerPublicName || enquiryData.ownerName || 'Property Owner',
      customerId,
      buyerId: customerId, // dual-field compatibility
      customerName: enquiryData.customerName || enquiryData.buyerName || 'Interested Customer',
      buyerName: enquiryData.customerName || enquiryData.buyerName || 'Interested Customer',
      customerEmail: enquiryData.customerEmail || enquiryData.buyerEmail || '',
      buyerEmail: enquiryData.customerEmail || enquiryData.buyerEmail || '',
      customerPhone: enquiryData.customerPhone || enquiryData.buyerPhone || '',
      buyerPhone: enquiryData.customerPhone || enquiryData.buyerPhone || '',
      message: enquiryData.message || 'I am interested in this property. Please contact me.',
      preferredVisitDate: enquiryData.preferredVisitDate || null,
      status: EnquiryStatus.SUBMITTED,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(enqRef, payload);
    return { success: true, enquiryId, enquiry: payload };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Get enquiries submitted by customer
 */
export async function getCustomerEnquiries(customerId) {
  try {
    if (!customerId) return { success: false, error: 'Customer ID is required.' };
    
    // Query by customerId or buyerId
    const q1 = query(
      collection(db, 'enquiries'),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc')
    );
    const snap1 = await getDocs(q1);
    let enquiries = snap1.docs.map(doc => doc.data());

    if (enquiries.length === 0) {
      const q2 = query(
        collection(db, 'enquiries'),
        where('buyerId', '==', customerId),
        orderBy('createdAt', 'desc')
      );
      const snap2 = await getDocs(q2);
      enquiries = snap2.docs.map(doc => doc.data());
    }

    return { success: true, enquiries };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Get enquiries received by property owner
 */
export async function getOwnerEnquiries(ownerId) {
  try {
    if (!ownerId) return { success: false, error: 'Owner ID is required.' };
    const q = query(
      collection(db, 'enquiries'),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const enquiries = snap.docs.map(doc => doc.data());
    return { success: true, enquiries };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Fetch single enquiry by ID
 */
export async function getEnquiryById(enquiryId) {
  try {
    if (!enquiryId) return { success: false, error: 'Enquiry ID is required.' };
    const enqRef = doc(db, 'enquiries', enquiryId);
    const snap = await getDoc(enqRef);
    if (!snap.exists()) return { success: false, error: 'Enquiry not found.' };
    return { success: true, enquiry: snap.data() };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Update enquiry status by owner with status transition validation
 */
export async function updateEnquiryStatus(enquiryId, ownerId, newStatus, currentStatus = null) {
  try {
    if (!enquiryId || !ownerId || !newStatus) {
      return { success: false, error: 'Enquiry ID, Owner ID, and new status are required.' };
    }

    if (!Object.values(EnquiryStatus).includes(newStatus)) {
      return { success: false, error: `Invalid EnquiryStatus value: ${newStatus}` };
    }

    // Validate transition if currentStatus is provided
    if (currentStatus && ALLOWED_STATUS_TRANSITIONS[currentStatus]) {
      const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus];
      if (!allowed.includes(newStatus)) {
        return { success: false, error: `Unauthorized enquiry status transition from ${currentStatus} to ${newStatus}.` };
      }
    }

    const enqRef = doc(db, 'enquiries', enquiryId);
    await updateDoc(enqRef, {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Fetch all marketplace enquiries for admin directory oversight.
 */
export async function getAllEnquiriesAdmin() {
  try {
    const enqRef = collection(db, 'enquiries');
    const snapshot = await getDocs(enqRef);
    const enquiries = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      enquiries.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null
      });
    });
    return { success: true, enquiries };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error), enquiries: [] };
  }
}

/**
 * Administrative enquiry status update
 */
export async function updateEnquiryStatusAdmin(enquiryId, newStatus) {
  try {
    if (!enquiryId || !newStatus) return { success: false, error: 'Enquiry ID and status required' };
    const enqRef = doc(db, 'enquiries', enquiryId);
    await updateDoc(enqRef, {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

