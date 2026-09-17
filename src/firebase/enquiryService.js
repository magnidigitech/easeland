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

import { getPublicPropertyById } from './propertyService.js';
import { mockApi } from '../services/mockApi.js';

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
 * Authoritatively verifies property listing status and derives ownerId from property record or fallback payload.
 */
export async function createEnquiry(enquiryData) {
  try {
    const customerId = enquiryData.customerId || enquiryData.buyerId || enquiryData.customerUserId;
    if (!enquiryData.propertyId || !customerId) {
      return { success: false, error: 'Property ID and Customer ID are required.' };
    }

    let authoritativeOwnerId = enquiryData.ownerId;
    let propTitle = enquiryData.propertyTitle || 'Property Listing';
    let propRefId = enquiryData.propertyReferenceId || '';
    let ownerName = enquiryData.ownerName || 'Property Owner';
    let ownerEmail = enquiryData.ownerEmail || '';

    // 1. Authoritative Property Lookup via getPublicPropertyById (handles Firestore doc, query, and mockApi fallback)
    try {
      const propRes = await getPublicPropertyById(enquiryData.propertyId);
      if (propRes && propRes.success && propRes.property) {
        const propData = propRes.property;
        if (propData.ownerId) authoritativeOwnerId = propData.ownerId;
        if (propData.ownerPublicName || propData.ownerName) ownerName = propData.ownerPublicName || propData.ownerName;
        if (propData.ownerPrivateEmail || propData.ownerEmail) ownerEmail = propData.ownerPrivateEmail || propData.ownerEmail;
        if (propData.title) propTitle = propData.title;
        if (propData.referenceId) propRefId = propData.referenceId;
      }
    } catch (e) {
      console.warn('createEnquiry property lookup note:', e);
    }

    const enqRef = doc(collection(db, 'enquiries'));
    const enquiryId = enqRef.id || ('enq-' + Date.now());
    const timestampIso = new Date().toISOString();

    const payload = {
      id: enquiryId,
      enquiryId,
      propertyId: enquiryData.propertyId,
      propertyTitle: propTitle,
      propertyReferenceId: propRefId,
      ownerId: authoritativeOwnerId || enquiryData.ownerId || 'owner-default',
      ownerName: ownerName,
      ownerEmail: ownerEmail,
      customerId,
      buyerId: customerId,
      customerName: enquiryData.customerName || enquiryData.buyerName || 'Interested Customer',
      buyerName: enquiryData.customerName || enquiryData.buyerName || 'Interested Customer',
      customerEmail: enquiryData.customerEmail || enquiryData.buyerEmail || '',
      buyerEmail: enquiryData.customerEmail || enquiryData.buyerEmail || '',
      customerPhone: enquiryData.customerPhone || enquiryData.buyerPhone || '',
      buyerPhone: enquiryData.customerPhone || enquiryData.buyerPhone || '',
      message: enquiryData.message || 'I am interested in this property. Please contact me.',
      preferredVisitDate: enquiryData.preferredVisitDate || null,
      status: EnquiryStatus.SUBMITTED || 'SUBMITTED',
      createdAt: timestampIso,
      updatedAt: timestampIso
    };

    // 2. Save to PostgreSQL Backend Server API (/api/enquiries)
    try {
      await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (pgErr) {
      console.warn('PostgreSQL API enquiry note:', pgErr);
    }

    // 3. Save to Firestore non-blockingly
    try {
      await setDoc(enqRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Firestore setDoc enquiry note:', err);
    }

    // 4. Save to Local Storage & mockApi so local/mock mode is 100% in sync
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('easeland_enquiries');
        let list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) list = [];
        list.unshift(payload);
        localStorage.setItem('easeland_enquiries', JSON.stringify(list));
        window.dispatchEvent(new CustomEvent('easeland-enquiry-created', { detail: payload }));
      }
    } catch (e) {}

    try {
      if (typeof mockApi !== 'undefined' && typeof mockApi.createEnquiry === 'function') {
        mockApi.createEnquiry(payload);
      }
    } catch (e) {}

    return { success: true, enquiryId, enquiry: payload };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Get enquiries submitted by customer
 */
export async function getCustomerEnquiries(customerId, userEmail = '') {
  try {
    if (!customerId && !userEmail) return { success: false, error: 'Customer ID is required.' };
    let enquiries = [];

    // 1. Fetch from PostgreSQL Server API (/api/enquiries)
    try {
      const queryParams = new URLSearchParams();
      if (customerId) queryParams.set('customerId', customerId);
      if (userEmail) queryParams.set('customerEmail', userEmail);
      const res = await fetch(`/api/enquiries?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.enquiries)) {
          enquiries.push(...data.enquiries);
        }
      }
    } catch (e) {}

    // 2. Read from Local Storage / mockApi
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('easeland_enquiries');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const localEnqs = list.filter(e => {
              if (!e) return false;
              const cId = String(e.customerId || e.buyerId || '').toLowerCase().trim();
              const cEmail = String(e.customerEmail || e.buyerEmail || '').toLowerCase().trim();
              const reqId = String(customerId || '').toLowerCase().trim();
              const reqEmail = String(userEmail || '').toLowerCase().trim();
              return (reqId && cId === reqId) || (reqEmail && cEmail === reqEmail);
            });
            enquiries.push(...localEnqs);
          }
        }
      }
    } catch (e) {}

    // 3. Query Firestore (WITHOUT requiring missing composite indexes)
    if (customerId) {
      try {
        const q1 = query(collection(db, 'enquiries'), where('customerId', '==', customerId));
        const snap1 = await getDocs(q1);
        snap1.docs.forEach(doc => enquiries.push({ id: doc.id, ...doc.data() }));
      } catch (e) {}

      try {
        const q2 = query(collection(db, 'enquiries'), where('buyerId', '==', customerId));
        const snap2 = await getDocs(q2);
        snap2.docs.forEach(doc => enquiries.push({ id: doc.id, ...doc.data() }));
      } catch (e) {}
    }

    if (userEmail) {
      try {
        const q3 = query(collection(db, 'enquiries'), where('customerEmail', '==', userEmail));
        const snap3 = await getDocs(q3);
        snap3.docs.forEach(doc => enquiries.push({ id: doc.id, ...doc.data() }));
      } catch (e) {}
    }

    // Deduplicate by ID & merge message threads smartly
    const map = new Map();
    enquiries.forEach(e => {
      const id = String(e.enquiryId || e.id || '');
      if (id) {
        const existing = map.get(id);
        if (!existing) {
          map.set(id, e);
        } else {
          const existingMsgs = Array.isArray(existing.messages) ? existing.messages : [];
          const newMsgs = Array.isArray(e.messages) ? e.messages : [];
          const mergedMsgsMap = new Map();
          [...existingMsgs, ...newMsgs].forEach(m => {
            if (!m) return;
            const mKey = String(m.id || (m.senderId + '_' + m.text + '_' + m.createdAt));
            if (!mergedMsgsMap.has(mKey)) mergedMsgsMap.set(mKey, m);
          });
          map.set(id, {
            ...existing,
            ...e,
            messages: Array.from(mergedMsgsMap.values()),
            updatedAt: e.updatedAt || existing.updatedAt
          });
        }
      }
    });

    const result = Array.from(map.values()).sort((a, b) => {
      const tA = new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt || 0)).getTime();
      const tB = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt || 0)).getTime();
      return tB - tA;
    });

    return { success: true, enquiries: result };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Get enquiries received by property owner
 */
export async function getOwnerEnquiries(ownerId, userEmail = '') {
  try {
    if (!ownerId && !userEmail) return { success: false, error: 'Owner ID is required.' };
    let enquiries = [];

    // 1. Fetch from PostgreSQL Server API (/api/enquiries)
    try {
      const queryParams = new URLSearchParams();
      if (ownerId) queryParams.set('ownerId', ownerId);
      if (userEmail) queryParams.set('ownerEmail', userEmail);
      const res = await fetch(`/api/enquiries?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.enquiries)) {
          enquiries.push(...data.enquiries);
        }
      }
    } catch (e) {}

    // 2. Read from Local Storage / mockApi
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('easeland_enquiries');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const localEnqs = list.filter(e => {
              if (!e) return false;
              const oId = String(e.ownerId || '').toLowerCase().trim();
              const oEmail = String(e.ownerEmail || '').toLowerCase().trim();
              const reqId = String(ownerId || '').toLowerCase().trim();
              const reqEmail = String(userEmail || '').toLowerCase().trim();
              return (reqId && oId === reqId) || (reqEmail && oEmail === reqEmail);
            });
            enquiries.push(...localEnqs);
          }
        }
      }
    } catch (e) {}

    // 3. Query Firestore by ownerId
    if (ownerId) {
      try {
        const q1 = query(collection(db, 'enquiries'), where('ownerId', '==', ownerId));
        const snap1 = await getDocs(q1);
        snap1.docs.forEach(doc => enquiries.push({ id: doc.id, ...doc.data() }));
      } catch (e) {}
    }

    if (userEmail) {
      try {
        const q2 = query(collection(db, 'enquiries'), where('ownerEmail', '==', userEmail));
        const snap2 = await getDocs(q2);
        snap2.docs.forEach(doc => enquiries.push({ id: doc.id, ...doc.data() }));
      } catch (e) {}
    }

    // Deduplicate by ID & merge message threads smartly
    const map = new Map();
    enquiries.forEach(e => {
      const id = String(e.enquiryId || e.id || '');
      if (id) {
        const existing = map.get(id);
        if (!existing) {
          map.set(id, e);
        } else {
          const existingMsgs = Array.isArray(existing.messages) ? existing.messages : [];
          const newMsgs = Array.isArray(e.messages) ? e.messages : [];
          const mergedMsgsMap = new Map();
          [...existingMsgs, ...newMsgs].forEach(m => {
            if (!m) return;
            const mKey = String(m.id || (m.senderId + '_' + m.text + '_' + m.createdAt));
            if (!mergedMsgsMap.has(mKey)) mergedMsgsMap.set(mKey, m);
          });
          map.set(id, {
            ...existing,
            ...e,
            messages: Array.from(mergedMsgsMap.values()),
            updatedAt: e.updatedAt || existing.updatedAt
          });
        }
      }
    });

    const result = Array.from(map.values()).sort((a, b) => {
      const tA = new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt || 0)).getTime();
      const tB = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt || 0)).getTime();
      return tB - tA;
    });

    return { success: true, enquiries: result };
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

    // 1. Update PostgreSQL Backend API (/api/enquiries/:id)
    try {
      await fetch(`/api/enquiries/${enquiryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) {}

    // 2. Update LocalStorage
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('easeland_enquiries');
        if (raw) {
          let list = JSON.parse(raw);
          if (Array.isArray(list)) {
            list = list.map(e => {
              if (e && (e.enquiryId === enquiryId || e.id === enquiryId)) {
                return { ...e, status: newStatus, updatedAt: new Date().toISOString() };
              }
              return e;
            });
            localStorage.setItem('easeland_enquiries', JSON.stringify(list));
            window.dispatchEvent(new CustomEvent('easeland-enquiry-updated', { detail: { enquiryId, status: newStatus } }));
          }
        }
      }
    } catch (e) {}

    // 3. Update Firestore
    try {
      const enqRef = doc(db, 'enquiries', enquiryId);
      await updateDoc(enqRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (e) {}

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

/**
 * Send interactive in-app message on an enquiry thread
 */
export async function sendEnquiryMessage(enquiryId, messagePayload) {
  try {
    if (!enquiryId || !messagePayload?.text) {
      return { success: false, error: 'Enquiry ID and message text are required.' };
    }

    const newMsg = {
      id: messagePayload.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderId: messagePayload.senderId || '',
      senderName: messagePayload.senderName || 'User',
      senderRole: messagePayload.senderRole || 'USER',
      text: String(messagePayload.text).trim(),
      createdAt: messagePayload.createdAt || new Date().toISOString()
    };

    // 1. Post to PostgreSQL Backend Server API (/api/enquiries/:id/messages)
    try {
      await fetch(`/api/enquiries/${enquiryId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg)
      });
    } catch (e) {}

    // 2. Update LocalStorage
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('easeland_enquiries');
        if (raw) {
          let list = JSON.parse(raw);
          if (Array.isArray(list)) {
            list = list.map(e => {
              if (e && (e.enquiryId === enquiryId || e.id === enquiryId)) {
                const existingMsgs = Array.isArray(e.messages) ? e.messages : [];
                return {
                  ...e,
                  messages: [...existingMsgs, newMsg],
                  updatedAt: new Date().toISOString()
                };
              }
              return e;
            });
            localStorage.setItem('easeland_enquiries', JSON.stringify(list));
            window.dispatchEvent(new CustomEvent('easeland-enquiry-message-added', { detail: { enquiryId, newMsg } }));
          }
        }
      }
    } catch (e) {}

    // 3. Update Firestore (non-blocking)
    try {
      const enqRef = doc(db, 'enquiries', enquiryId);
      const snap = await getDoc(enqRef);
      if (snap.exists()) {
        const data = snap.data();
        const existingMsgs = Array.isArray(data.messages) ? data.messages : [];
        await updateDoc(enqRef, {
          messages: [...existingMsgs, newMsg],
          updatedAt: serverTimestamp()
        });
      }
    } catch (e) {}

    return { success: true, message: newMsg };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

