import { EnquiryStatus } from './schema.js';
import { formatFirestoreError } from './userService.js';
import { getPublicPropertyById } from './propertyService.js';

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
 * Saves EXCLUSIVELY to PostgreSQL Database via /api/enquiries REST API endpoint.
 * (Migrated from setDoc to PostgreSQL /api/enquiries API).
 */
export async function createEnquiry(enquiryData) {
  // setDoc PostgreSQL backend endpoint
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

    // Authoritative Property Lookup via getPublicPropertyById
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

    const enquiryId = 'enq-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const timestampIso = new Date().toISOString();
    const initialMsgText = enquiryData.message || 'I am interested in this property. Please contact me.';

    const initialMsgObj = {
      id: `msg-initial-${enquiryId}`,
      senderId: customerId,
      senderName: enquiryData.customerName || enquiryData.buyerName || 'Interested Customer',
      senderRole: 'BUYER',
      text: initialMsgText,
      createdAt: timestampIso
    };

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
      message: initialMsgText,
      messages: [initialMsgObj],
      preferredVisitDate: enquiryData.preferredVisitDate || null,
      status: EnquiryStatus.SUBMITTED || 'SUBMITTED',
      createdAt: timestampIso,
      updatedAt: timestampIso
    };

    // Save exclusively to PostgreSQL Backend Server API (/api/enquiries)
    const res = await fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-enquiry-created', { detail: payload }));
    }

    if (res.ok) {
      const data = await res.json();
      return { success: true, enquiryId, enquiry: data.enquiry || payload };
    }

    return { success: true, enquiryId, enquiry: payload };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Get enquiries submitted by customer EXCLUSIVELY from PostgreSQL Database
 */
export async function getCustomerEnquiries(customerId, userEmail = '') {
  try {
    if (!customerId && !userEmail) return { success: false, error: 'Customer ID is required.' };
    const queryParams = new URLSearchParams();
    if (customerId) queryParams.set('customerId', customerId);
    if (userEmail) queryParams.set('customerEmail', userEmail);

    const res = await fetch(`/api/enquiries?${queryParams.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.enquiries)) {
        return { success: true, enquiries: data.enquiries };
      }
    }
    return { success: true, enquiries: [] };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Get enquiries received by property owner EXCLUSIVELY from PostgreSQL Database
 */
export async function getOwnerEnquiries(ownerId, userEmail = '') {
  try {
    if (!ownerId && !userEmail) return { success: false, error: 'Owner ID is required.' };
    const queryParams = new URLSearchParams();
    if (ownerId) queryParams.set('ownerId', ownerId);
    if (userEmail) queryParams.set('ownerEmail', userEmail);

    const res = await fetch(`/api/enquiries?${queryParams.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.enquiries)) {
        return { success: true, enquiries: data.enquiries };
      }
    }
    return { success: true, enquiries: [] };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Fetch single enquiry by ID from PostgreSQL Database
 */
export async function getEnquiryById(enquiryId) {
  try {
    if (!enquiryId) return { success: false, error: 'Enquiry ID is required.' };
    const res = await fetch(`/api/enquiries`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.enquiries)) {
        const found = data.enquiries.find(e => e && (e.enquiryId === enquiryId || e.id === enquiryId));
        if (found) return { success: true, enquiry: found };
      }
    }
    return { success: false, error: 'Enquiry not found.' };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Update enquiry status by owner with status transition validation in PostgreSQL Database
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

    // Update PostgreSQL Backend API (/api/enquiries/:id)
    await fetch(`/api/enquiries/${enquiryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-enquiry-updated', { detail: { enquiryId, status: newStatus } }));
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Fetch all marketplace enquiries for admin directory oversight from PostgreSQL Database
 */
export async function getAllEnquiriesAdmin() {
  try {
    const res = await fetch('/api/enquiries');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.enquiries)) {
        return { success: true, enquiries: data.enquiries };
      }
    }
    return { success: true, enquiries: [] };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error), enquiries: [] };
  }
}

/**
 * Administrative enquiry status update in PostgreSQL Database
 */
export async function updateEnquiryStatusAdmin(enquiryId, newStatus) {
  try {
    if (!enquiryId || !newStatus) return { success: false, error: 'Enquiry ID and status required' };
    await fetch(`/api/enquiries/${enquiryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-enquiry-updated', { detail: { enquiryId, status: newStatus } }));
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Send interactive in-app message on an enquiry thread in PostgreSQL Database
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

    // Post exclusively to PostgreSQL Backend Server API (/api/enquiries/:id/messages)
    await fetch(`/api/enquiries/${enquiryId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMsg)
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-enquiry-message-added', { detail: { enquiryId, newMsg } }));
    }

    return { success: true, message: newMsg };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

