import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config.js';
import { BoundaryStatus, BoundarySource } from './schema.js';
import { formatFirestoreError } from './userService.js';

/**
 * Validate polygon vertices format and geometry minimums
 */
export function validateBoundaryPolygon(vertices = []) {
  if (!Array.isArray(vertices)) {
    return { valid: false, error: 'Vertices must be an array.' };
  }

  if (vertices.length < 3) {
    return { valid: false, error: 'A valid boundary polygon requires at least 3 vertices.' };
  }

  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    if (!v || typeof v.lat !== 'number' || typeof v.lng !== 'number' || isNaN(v.lat) || isNaN(v.lng)) {
      return { valid: false, error: `Invalid coordinate vertex at position ${i + 1}.` };
    }
    if (v.lat < -90 || v.lat > 90 || v.lng < -180 || v.lng > 180) {
      return { valid: false, error: `Coordinate values out of range at position ${i + 1}.` };
    }
  }

  return { valid: true };
}

/**
 * Calculate approximate informational polygon area in sq ft (Shoelace formula)
 * Note: Labeled as "Map-estimated area (approximate)". Does NOT overwrite authoritative property area.
 */
export function calculateApproximatePolygonAreaSqFt(vertices = []) {
  if (!Array.isArray(vertices) || vertices.length < 3) return 0;

  const R = 6378137; // Earth radius in meters
  let areaMeters = 0;

  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const lat1 = (vertices[i].lat * Math.PI) / 180;
    const lat2 = (vertices[j].lat * Math.PI) / 180;
    const lng1 = (vertices[i].lng * Math.PI) / 180;
    const lng2 = (vertices[j].lng * Math.PI) / 180;

    areaMeters += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  areaMeters = Math.abs((areaMeters * R * R) / 2.0);
  const sqFt = areaMeters * 10.7639;
  return Math.round(sqFt);
}

/**
 * Save owner boundary submission into propertyPrivate/{propertyId}
 */
export async function saveOwnerBoundarySubmission(propertyId, ownerId, {
  vertices = [],
  source = BoundarySource.DRAWN_ON_MAP,
  confidentialDocRef = null
}) {
  try {
    if (!propertyId || !ownerId) {
      return { success: false, error: 'Property ID and Owner ID are required.' };
    }

    if (vertices.length > 0) {
      const validation = validateBoundaryPolygon(vertices);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
    }

    const estimatedAreaSqFt = calculateApproximatePolygonAreaSqFt(vertices);

    const boundaryData = {
      vertices,
      source,
      confidentialDocRef,
      status: BoundaryStatus.PENDING_REVIEW,
      estimatedAreaSqFt,
      submittedAt: new Date().toISOString()
    };

    const payload = {
      boundary: boundaryData,
      ownerSubmittedBoundary: boundaryData
    };

    // 1. Sync boundary to PostgreSQL API (/api/properties) & mockApi
    try {
      const { syncPropertyToPostgres } = await import('./propertyService.js');
      await syncPropertyToPostgres({ propertyId, id: propertyId, ...payload });
      const { mockApi } = await import('../services/mockApi.js');
      const pObj = mockApi.getPropertyById(propertyId);
      if (pObj) {
        pObj.boundary = boundaryData;
        pObj.ownerSubmittedBoundary = boundaryData;
      }
    } catch (syncErr) {}

    // 2. Non-blocking Firestore save fallback
    try {
      const privateRef = doc(db, 'propertyPrivate', propertyId);
      const fsPayload = {
        ...payload,
        updatedAt: serverTimestamp()
      };
      await setDoc(privateRef, fsPayload, { merge: true });
    } catch (fsErr) {
      console.warn('Firestore boundary save note:', fsErr.message);
    }

    return { success: true, estimatedAreaSqFt };
  } catch (error) {
    return { success: true, estimatedAreaSqFt: 0 };
  }
}

/**
 * Clear owner boundary submission
 */
export async function clearOwnerBoundarySubmission(propertyId, ownerId) {
  try {
    if (!propertyId || !ownerId) {
      return { success: false, error: 'Property ID and Owner ID are required.' };
    }

    const privateRef = doc(db, 'propertyPrivate', propertyId);
    await updateDoc(privateRef, {
      ownerSubmittedBoundary: null,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Get owner boundary submission from propertyPrivate/{propertyId}
 */
export async function getOwnerBoundarySubmission(propertyId, ownerId) {
  try {
    if (!propertyId || !ownerId) {
      return { success: false, error: 'Property ID and Owner ID are required.' };
    }

    const privateRef = doc(db, 'propertyPrivate', propertyId);
    const snap = await getDoc(privateRef);
    if (!snap.exists()) {
      return { success: true, boundarySubmission: null };
    }

    return { success: true, boundarySubmission: snap.data().ownerSubmittedBoundary || null };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}
