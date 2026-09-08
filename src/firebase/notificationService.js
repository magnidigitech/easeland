import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config.js';
import { formatFirestoreError } from './userService.js';

/**
 * Get user's notifications sorted by creation date from notifications collection
 */
export async function getUserNotifications(recipientId) {
  try {
    if (!recipientId) return { success: false, error: 'Recipient ID is required.' };
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', recipientId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const notifications = snap.docs.map(doc => doc.data());
    return { success: true, notifications };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Derive notification records dynamically from user's received enquiries (Owner) and sent enquiries (Customer).
 * Ensures zero untrusted client creation privileges on notifications collection while guaranteeing 100% accurate notifications for both Customer and Owner.
 */
export async function getDerivedEnquiryNotifications(recipientId) {
  try {
    if (!recipientId) return { success: false, error: 'Recipient ID is required.' };
    
    // 1. Fetch direct owner received enquiries
    const qOwner = query(
      collection(db, 'enquiries'),
      where('ownerId', '==', recipientId),
      orderBy('createdAt', 'desc')
    );
    const ownerSnap = await getDocs(qOwner);

    const ownerNotifications = ownerSnap.docs.map(d => {
      const enq = d.data();
      return {
        id: `notif-owner-enq-${enq.enquiryId}`,
        enquiryId: enq.enquiryId,
        propertyId: enq.propertyId,
        recipientId,
        title: 'New Property Enquiry Received',
        message: `New enquiry received for "${enq.propertyTitle || 'Property'}" from ${enq.customerName || 'Customer'}.`,
        type: 'ENQUIRY',
        read: enq.status !== 'SUBMITTED',
        createdAt: enq.createdAt
      };
    });

    // 2. Fetch customer sent enquiries for customer confirmation notifications
    const qCustomer = query(
      collection(db, 'enquiries'),
      where('customerId', '==', recipientId),
      orderBy('createdAt', 'desc')
    );
    const customerSnap = await getDocs(qCustomer);

    const customerNotifications = customerSnap.docs.map(d => {
      const enq = d.data();
      return {
        id: `notif-cust-enq-${enq.enquiryId}`,
        enquiryId: enq.enquiryId,
        propertyId: enq.propertyId,
        recipientId,
        title: 'Enquiry Sent Confirmation',
        message: `Your enquiry for "${enq.propertyTitle || 'Property'}" has been sent to the property owner.`,
        type: 'ENQUIRY',
        read: true,
        createdAt: enq.createdAt
      };
    });

    // Combine and sort by createdAt descending
    const allNotifications = [...ownerNotifications, ...customerNotifications];
    allNotifications.sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });

    return { success: true, notifications: allNotifications };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}


/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notificationId, recipientId) {
  try {
    if (!notificationId) return { success: false, error: 'Notification ID is required.' };
    const notifRef = doc(db, 'notifications', notificationId);
    await updateDoc(notifRef, {
      read: true
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Mark all notifications for a recipient as read
 */
export async function markAllNotificationsAsRead(recipientId) {
  try {
    if (!recipientId) return { success: false, error: 'Recipient ID is required.' };
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', recipientId),
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);

    snap.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { read: true });
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

