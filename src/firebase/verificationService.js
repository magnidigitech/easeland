import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config.js';
import { ListingStatus, VerificationStatus, MediaStatus } from './schema.js';
import { formatFirestoreError } from './userService.js';

/**
 * Log Administrative Action to activityLogs collection
 */
export async function logAdminActivity(actionType, details, adminUid, adminName = 'EaseLand Auditor') {
  try {
    const logRef = doc(collection(db, 'activityLogs'));
    await setDoc(logRef, {
      logId: logRef.id,
      actionType,
      details,
      adminUid,
      adminName,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.warn('Activity logging note:', err.message);
  }
}

/**
 * Get verification queue for EaseLand Admin Auditors
 */
export async function getVerificationQueue({
  statusFilter = 'ALL_PENDING', // 'ALL_PENDING', 'PENDING_VERIFICATION', 'UNDER_REVIEW', 'CHANGES_REQUIRED', 'LIVE', 'REJECTED'
  propertyType = null,
  pageSize = 50,
  lastDoc = null
} = {}) {
  try {
    let targetStatuses = [ListingStatus.PENDING_VERIFICATION, ListingStatus.UNDER_REVIEW];
    if (statusFilter && statusFilter !== 'ALL_PENDING' && ListingStatus[statusFilter]) {
      targetStatuses = [ListingStatus[statusFilter]];
    }

    let q = query(
      collection(db, 'properties'),
      where('listingStatus', 'in', targetStatuses)
    );

    if (propertyType && propertyType !== 'All') {
      q = query(q, where('propertyType', '==', propertyType));
    }

    const snap = await getDocs(q);
    let properties = snap.docs.map(doc => doc.data());

    // Sort in memory by createdAt ascending
    properties.sort((a, b) => {
      const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (new Date(a.createdAt || 0).getTime() || 0);
      const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (new Date(b.createdAt || 0).getTime() || 0);
      return tA - tB;
    });

    return {
      success: true,
      properties,
      lastDoc: null,
      hasMore: false
    };
  } catch (error) {
    console.warn('getVerificationQueue fetch note:', error);
    return { success: true, properties: [] };
  }
}


/**
 * Fetch complete verification workspace evidence payload for a property (Admin ONLY)
 */
export async function getVerificationWorkspaceData(propertyId) {
  try {
    if (!propertyId) return { success: false, error: 'Property ID is required.' };

    // 1. Fetch main property doc
    const propRef = doc(db, 'properties', propertyId);
    const propSnap = await getDoc(propRef);
    if (!propSnap.exists()) {
      return { success: false, error: 'Property record not found.' };
    }
    const propertyData = propSnap.data();

    // 2. Fetch owner private data
    let privateData = null;
    try {
      const privateSnap = await getDoc(doc(db, 'propertyPrivate', propertyId));
      if (privateSnap.exists()) {
        privateData = privateSnap.data();
      }
    } catch (e) {
      console.warn('Private doc fetch note:', e.message);
    }

    // 3. Fetch confidential documents
    let documents = [];
    try {
      const docsQuery = query(
        collection(db, 'propertyDocuments'),
        where('propertyId', '==', propertyId)
      );
      const docsSnap = await getDocs(docsQuery);
      documents = docsSnap.docs.map(d => d.data());
    } catch (e) {
      console.warn('Document list fetch note:', e.message);
    }

    // 4. Fetch verification history
    let verificationRecords = [];
    try {
      const verQuery = query(
        collection(db, 'verificationRecords'),
        where('propertyId', '==', propertyId),
        orderBy('timestamp', 'desc')
      );
      const verSnap = await getDocs(verQuery);
      verificationRecords = verSnap.docs.map(d => d.data());
    } catch (e) {
      console.warn('Verification records fetch note:', e.message);
    }

    return {
      success: true,
      workspace: {
        property: propertyData,
        privateData,
        documents,
        verificationRecords
      }
    };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Admin Action: Start Property Review (Transitions PENDING_VERIFICATION -> UNDER_REVIEW)
 */
export async function startPropertyReview(propertyId, adminUid, adminName = 'EaseLand Auditor') {
  try {
    if (!propertyId || !adminUid) return { success: false, error: 'Property ID and Admin UID are required.' };
    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) return { success: false, error: 'Property not found.' };

    const currentStatus = snap.data().listingStatus;
    if (currentStatus === ListingStatus.PENDING_VERIFICATION) {
      await updateDoc(propRef, {
        listingStatus: ListingStatus.UNDER_REVIEW,
        assignedAuditorId: adminUid,
        updatedAt: serverTimestamp()
      });

      const verRef = doc(collection(db, 'verificationRecords'));
      await setDoc(verRef, {
        verificationId: verRef.id,
        propertyId,
        adminId: adminUid,
        adminName,
        action: 'REVIEW_STARTED',
        previousStatus: currentStatus,
        newStatus: ListingStatus.UNDER_REVIEW,
        auditorNotes: 'Audit review started by Admin.',
        timestamp: serverTimestamp()
      });

      await logAdminActivity('PROPERTY_REVIEW_STARTED', `Review started for property ${propertyId}`, adminUid, adminName);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Admin Action: Approve Property Verification & Transition to LIVE
 */
export async function approvePropertyVerification(propertyId, adminUid, adminName = 'EaseLand Auditor', notes = '') {
  try {
    if (!propertyId || !adminUid) return { success: false, error: 'Property ID and Admin UID are required.' };
    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) return { success: false, error: 'Property not found.' };

    const propData = snap.data();
    const prevStatus = propData.listingStatus;

    // Concurrency / Lifecycle Check: Can only approve from PENDING_VERIFICATION or UNDER_REVIEW
    if (![ListingStatus.PENDING_VERIFICATION, ListingStatus.UNDER_REVIEW].includes(prevStatus)) {
      return { success: false, error: `Invalid transition: Cannot approve property from status '${prevStatus}'.` };
    }

    // 1. Update public property to LIVE & Verified (Preserves media array without automatic blanket override)
    await updateDoc(propRef, {
      listingStatus: ListingStatus.LIVE,
      isPlatformVerified: true,
      isPublished: true,
      verifiedDate: serverTimestamp(),
      verificationNotes: notes || 'Verified & Approved by EaseLand Senior Admin Auditor.',
      updatedAt: serverTimestamp()
    });

    // 2. Append immutable verification record
    const verRef = doc(collection(db, 'verificationRecords'));
    await setDoc(verRef, {
      verificationId: verRef.id,
      propertyId,
      ownerId: propData.ownerId,
      adminId: adminUid,
      adminName,
      action: 'APPROVED',
      previousStatus: prevStatus,
      newStatus: ListingStatus.LIVE,
      auditorNotes: notes || 'Property verified and approved for live discovery.',
      timestamp: serverTimestamp()
    });

    // 3. Log to activityLogs
    await logAdminActivity('PROPERTY_APPROVED', `Property ${propertyId} (${propData.title}) approved for LIVE marketplace by ${adminName}`, adminUid, adminName);

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Admin Action: Update individual media item verification status
 */
export async function updateMediaItemVerificationStatus(propertyId, adminUid, mediaId, newStatus) {
  try {
    if (!propertyId || !adminUid || !mediaId || !newStatus) {
      return { success: false, error: 'Property ID, Admin UID, Media ID, and Status are required.' };
    }
    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) return { success: false, error: 'Property not found.' };

    const mediaPrivateRef = doc(db, 'propertyMediaPrivate', propertyId);
    let masterMedia = [];
    try {
      const pSnap = await getDoc(mediaPrivateRef);
      if (pSnap.exists()) {
        masterMedia = Array.isArray(pSnap.data().masterMedia) ? pSnap.data().masterMedia : [];
      } else {
        masterMedia = Array.isArray(propData.media) ? propData.media : [];
      }
    } catch (e) {
      masterMedia = Array.isArray(propData.media) ? propData.media : [];
    }

    const updatedMasterMedia = masterMedia.map(item => {
      if (item.mediaId === mediaId) {
        return { ...item, verificationStatus: newStatus };
      }
      return item;
    });

    const publicApprovedMedia = updatedMasterMedia.filter(
      item => item && item.verificationStatus === MediaStatus.APPROVED
    );

    // Update private master media moderation document
    await setDoc(mediaPrivateRef, {
      propertyId,
      ownerId: propData.ownerId,
      masterMedia: updatedMasterMedia,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Update public properties document with publicApprovedMedia array ONLY
    await updateDoc(propRef, {
      publicApprovedMedia,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Admin Action: Request Changes from Property Owner
 */
export async function requestVerificationChanges(propertyId, adminUid, adminName = 'EaseLand Auditor', notes = '', checklist = []) {
  try {
    if (!propertyId || !adminUid) return { success: false, error: 'Property ID and Admin UID are required.' };
    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) return { success: false, error: 'Property not found.' };

    const propData = snap.data();
    const prevStatus = propData.listingStatus;

    if (![ListingStatus.PENDING_VERIFICATION, ListingStatus.UNDER_REVIEW].includes(prevStatus)) {
      return { success: false, error: `Invalid transition: Cannot request changes from status '${prevStatus}'.` };
    }

    // 1. Update public listing status to CHANGES_REQUIRED
    await updateDoc(propRef, {
      listingStatus: ListingStatus.CHANGES_REQUIRED,
      updatedAt: serverTimestamp()
    });

    // 2. Update owner-visible private feedback document
    const privateRef = doc(db, 'propertyPrivate', propertyId);
    await setDoc(privateRef, {
      propertyId,
      ownerId: propData.ownerId,
      ownerFacingNotes: notes,
      changesRequestedChecklist: checklist,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 3. Append verification record
    const verRef = doc(collection(db, 'verificationRecords'));
    await setDoc(verRef, {
      verificationId: verRef.id,
      propertyId,
      ownerId: propData.ownerId,
      adminId: adminUid,
      adminName,
      action: 'CHANGES_REQUESTED',
      previousStatus: prevStatus,
      newStatus: ListingStatus.CHANGES_REQUIRED,
      auditorNotes: notes,
      timestamp: serverTimestamp()
    });

    // 4. Log activity
    await logAdminActivity('PROPERTY_CHANGES_REQUESTED', `Changes requested for property ${propertyId} by ${adminName}`, adminUid, adminName);

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Admin Action: Reject Property Listing
 */
export async function rejectPropertyVerification(propertyId, adminUid, adminName = 'EaseLand Auditor', notes = '') {
  try {
    if (!propertyId || !adminUid) return { success: false, error: 'Property ID and Admin UID are required.' };
    if (!notes || notes.trim().length < 5) {
      return { success: false, error: 'Detailed rejection explanation is required before rejecting a listing.' };
    }

    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) return { success: false, error: 'Property not found.' };

    const propData = snap.data();
    const prevStatus = propData.listingStatus;

    if (![ListingStatus.PENDING_VERIFICATION, ListingStatus.UNDER_REVIEW, ListingStatus.CHANGES_REQUIRED].includes(prevStatus)) {
      return { success: false, error: `Invalid transition: Cannot reject property from status '${prevStatus}'.` };
    }

    await updateDoc(propRef, {
      listingStatus: ListingStatus.REJECTED,
      isPlatformVerified: false,
      verificationNotes: notes,
      updatedAt: serverTimestamp()
    });

    const verRef = doc(collection(db, 'verificationRecords'));
    await setDoc(verRef, {
      verificationId: verRef.id,
      propertyId,
      ownerId: propData.ownerId,
      adminId: adminUid,
      adminName,
      action: 'REJECTED',
      previousStatus: prevStatus,
      newStatus: ListingStatus.REJECTED,
      auditorNotes: notes,
      timestamp: serverTimestamp()
    });

    await logAdminActivity('PROPERTY_REJECTED', `Property ${propertyId} rejected by ${adminName}`, adminUid, adminName);

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}
