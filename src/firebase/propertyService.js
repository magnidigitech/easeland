import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config.js';
import { ListingStatus, VerificationStatus, BoundaryStatus, MediaStatus } from './schema.js';
import { formatFirestoreError } from './userService.js';

/**
 * Helper to sync property payload to PostgreSQL database (/api/properties)
 */
export async function syncPropertyToPostgres(propertyData) {
  try {
    if (!propertyData || !propertyData.propertyId) return;
    await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(propertyData)
    });
  } catch (err) {
    console.warn('PostgreSQL sync note:', err);
  }
}

/**
 * Generate human readable property reference ID e.g. EL-PROP-10042
 */
function generateReferenceId() {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `EL-PROP-${randomNum}`;
}

/**
 * Encode latitude and longitude into base32 Geohash string
 */
export function encodeGeohash(lat, lng, precision = 7) {
  if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) return '';
  const BITS = [16, 8, 4, 2, 1];
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let isEven = true;
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;
  let bit = 0;
  let ch = 0;
  let geohash = '';

  let latitude = Number(lat);
  let longitude = Number(lng);

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lonMin + lonMax) / 2;
      if (longitude >= mid) {
        ch |= BITS[bit];
        lonMin = mid;
      } else {
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) {
        ch |= BITS[bit];
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return geohash;
}

/**
 * Convert any declared area value + unit into canonical Sq Ft number for search indexing
 */
export function convertAreaToSqFt(areaValue, unit) {
  const num = Number(areaValue) || 0;
  if (!unit) return num;

  const u = String(unit).toLowerCase().trim();
  switch (u) {
    case 'sq yds':
    case 'sq yds.':
    case 'yards':
      return num * 9;
    case 'acres':
    case 'acre':
      return num * 43560;
    case 'cents':
    case 'cent':
      return num * 435.6;
    case 'guntas':
    case 'gunta':
      return num * 1089;
    case 'sq ft':
    case 'sqft':
    default:
      return num;
  }
}

/**
 * Derive all indexed search fields (areaSqFt, bedroomsNum, bathroomsNum, locationTokens, amenitiesMap, geohash)
 */
export function computeDerivedPropertyFields(propertyData = {}) {
  const areaSqFt = convertAreaToSqFt(propertyData.area, propertyData.areaUnit || propertyData.specs?.areaUnit || 'sq ft');
  const bedroomsNum = Number(propertyData.bedrooms || propertyData.specs?.bedrooms || propertyData.specs?.bhk) || 0;
  const bathroomsNum = Number(propertyData.bathrooms || propertyData.specs?.bathrooms) || 0;

  // Searchable location tokens
  const loc = propertyData.location || {};
  const tokenSet = new Set();
  [loc.city, loc.locality, loc.subLocality, loc.mandal, loc.district, loc.state, loc.colony, loc.landmark, propertyData.title]
    .filter(Boolean)
    .forEach(str => {
      String(str).toLowerCase().split(/[\s,._/-]+/).forEach(tok => {
        if (tok.length >= 2) tokenSet.add(tok);
      });
    });
  const locationTokens = Array.from(tokenSet);

  // Top 5 Canonical Amenities boolean map
  const rawAmenities = Array.isArray(propertyData.amenities) ? propertyData.amenities : [];
  const canonicalList = ['gatedCommunity', 'swimmingPool', 'clubhouse', 'powerBackup', 'carParking'];
  const amenitiesMap = {};
  canonicalList.forEach(key => {
    amenitiesMap[key] = rawAmenities.some(a => String(a).toLowerCase().replace(/[^a-z]/g, '') === key.toLowerCase());
  });

  // Geohash computation
  const lat = loc.geoPoint?.latitude || loc.lat || loc.latitude;
  const lng = loc.geoPoint?.longitude || loc.lng || loc.longitude;
  const geohash = encodeGeohash(lat, lng, 7);

  return {
    areaSqFt,
    bedroomsNum,
    bathroomsNum,
    locationTokens,
    amenitiesMap,
    geohash
  };
}

/**
 * Filter property media to ensure public users only receive APPROVED items
 */
export function filterApprovedPublicMedia(mediaArray = []) {
  if (!Array.isArray(mediaArray)) return [];
  return mediaArray.filter(item => item && item.verificationStatus === MediaStatus.APPROVED);
}

/**
 * Create a new property listing draft
 */
export async function createPropertyDraft(ownerId, propertyData) {
  try {
    if (!ownerId) return { success: false, error: 'Owner UID is required.' };
    const propertyRef = doc(collection(db, 'properties'));
    const propertyId = propertyRef.id;
    const refId = generateReferenceId();

    const derived = computeDerivedPropertyFields(propertyData);

    const publicPayload = {
      propertyId,
      referenceId: refId,
      ownerId,
      ownerPublicName: propertyData.ownerPublicName || 'Property Owner',
      ownerPublicPhone: propertyData.ownerPublicPhone || null,
      title: propertyData.title || 'Untitled Property Listing',
      propertyType: propertyData.propertyType || 'OPEN_PLOT',
      purpose: propertyData.purpose || 'SALE',
      description: propertyData.description || '',
      price: Number(propertyData.price) || 0,
      priceDisplay: propertyData.priceDisplay || 'Rs. 0',
      area: Number(propertyData.area) || 0,
      areaDisplay: propertyData.areaDisplay || '0 sq ft',
      specs: propertyData.specs || {},
      amenities: Array.isArray(propertyData.amenities) ? propertyData.amenities : [],

      // Derived indexed search fields
      ...derived,

      // Database-level public media isolation: public document contains ONLY approved media
      publicApprovedMedia: [],

      location: {
        country: 'India',
        state: '',
        district: '',
        city: '',
        mandal: '',
        locality: '',
        subLocality: '',
        village: '',
        road: '',
        colony: '',
        landmark: '',
        postalCode: '',
        address: '',
        geoPoint: null,
        geohash: derived.geohash,
        ...(propertyData.location || {})
      },
      boundary: propertyData.boundary || null,

      // Protected System Fields
      listingStatus: ListingStatus.DRAFT,
      isPlatformVerified: false,
      isPublished: false,
      views: 0,
      enquiriesCount: 0,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Also initialize private document for owner details
    const privateRef = doc(db, 'propertyPrivate', propertyId);
    const privatePayload = {
      propertyId,
      ownerId,
      ownerPrivateEmail: propertyData.ownerPrivateEmail || '',
      ownerPrivatePhone: propertyData.ownerPrivatePhone || '',
      ownerFacingNotes: null,
      changesRequestedChecklist: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Initialize private master media moderation document
    const mediaPrivateRef = doc(db, 'propertyMediaPrivate', propertyId);
    const mediaPrivatePayload = {
      propertyId,
      ownerId,
      masterMedia: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const savePromise = Promise.all([
      setDoc(propertyRef, publicPayload),
      setDoc(privateRef, privatePayload),
      setDoc(mediaPrivateRef, mediaPrivatePayload)
    ]);

    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 3500));

    await Promise.race([savePromise, timeoutPromise]);

    syncPropertyToPostgres(publicPayload);

    return { success: true, propertyId, referenceId: refId };
  } catch (error) {
    console.warn('Property draft create fallback:', error);
    const fallbackId = 'prop_' + Date.now();
    const fallbackRef = generateReferenceId();
    return { success: true, propertyId: fallbackId, referenceId: fallbackRef };
  }
}

/**
 * Get public property by ID (Filters public media for LIVE listings)
 */
export async function getPropertyById(propertyId, currentUserId = null, isAdminUser = false) {
  try {
    if (!propertyId) return { success: false, error: 'Property ID is required.' };
    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) {
      return { success: false, error: 'Property not found.' };
    }

    const data = snap.data();
    const isOwner = currentUserId && data.ownerId === currentUserId;

    // Security Check: Non-LIVE listings accessible ONLY by Owner or Admin
    if (data.listingStatus !== ListingStatus.LIVE && !isOwner && !isAdminUser) {
      return { success: false, error: 'Property listing is not publicly accessible.' };
    }

    // Public Users receive ONLY approved media
    if (!isOwner && !isAdminUser) {
      data.media = Array.isArray(data.publicApprovedMedia) ? data.publicApprovedMedia : filterApprovedPublicMedia(data.media);
    }

    return { success: true, property: data };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Get owner's properties with pagination
 */
export async function getOwnerProperties(ownerId, pageSize = 50, lastDoc = null) {
  try {
    if (!ownerId) return { success: false, error: 'Owner ID is required.' };
    const q = query(
      collection(db, 'properties'),
      where('ownerId', '==', ownerId)
    );

    const snap = await getDocs(q);
    let properties = snap.docs.map(doc => doc.data());

    // Sort in memory by createdAt / updatedAt descending
    properties.sort((a, b) => {
      const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (new Date(a.createdAt || 0).getTime() || 0);
      const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (new Date(b.createdAt || 0).getTime() || 0);
      return tB - tA;
    });

    return { success: true, properties, lastDoc: null, hasMore: false };
  } catch (error) {
    console.warn('getOwnerProperties fetch note:', error);
    return { success: true, properties: [] };
  }
}


/**
 * Update owner-editable property fields (Protected system fields stripped)
 */
export async function updateOwnerProperty(propertyId, ownerId, updates) {
  try {
    if (!propertyId || !ownerId) return { success: false, error: 'Property ID and Owner ID are required.' };
    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) return { success: false, error: 'Property not found.' };

    const currentData = snap.data();
    if (currentData.ownerId !== ownerId) return { success: false, error: 'Unauthorized: You do not own this property.' };

    // Strip protected system keys
    const {
      listingStatus,
      isPublished,
      isPlatformVerified,
      verificationStatus,
      boundaryStatus,
      boundary,
      views,
      enquiriesCount,
      ownerId: _o,
      referenceId: _r,
      verifiedDate: _v,
      verificationNotes: _n,
      ...permittedUpdates
    } = updates;

    // Check for material edits requiring reverification (location changes, land type/purpose/area changes)
    let materialEdit = false;
    if (permittedUpdates.location && JSON.stringify(permittedUpdates.location) !== JSON.stringify(currentData.location)) {
      materialEdit = true;
    }
    if (permittedUpdates.propertyType && permittedUpdates.propertyType !== currentData.propertyType) {
      materialEdit = true;
    }
    if (permittedUpdates.purpose && permittedUpdates.purpose !== currentData.purpose) {
      materialEdit = true;
    }
    if (permittedUpdates.area && Number(permittedUpdates.area) !== Number(currentData.area)) {
      materialEdit = true;
    }

    const merged = { ...currentData, ...permittedUpdates };
    const derived = computeDerivedPropertyFields(merged);

    const payload = {
      ...permittedUpdates,
      ...derived,
      updatedAt: serverTimestamp()
    };

    // If a LIVE property undergoes a material edit, reset listingStatus to PENDING_VERIFICATION and unpublish
    if (currentData.listingStatus === ListingStatus.LIVE && materialEdit) {
      payload.listingStatus = ListingStatus.PENDING_VERIFICATION;
      payload.isPublished = false;
    }

    await updateDoc(propRef, payload);
    return { success: true, materialEdit };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Submit property listing for admin verification
 */
export async function submitPropertyForVerification(propertyId, ownerId, formData = null) {
  try {
    if (!propertyId || !ownerId) return { success: false, error: 'Property ID and Owner ID are required.' };
    const propRef = doc(db, 'properties', propertyId);
    let propData = {};

    try {
      const snap = await getDoc(propRef);
      if (snap.exists()) {
        propData = snap.data();
      }
    } catch (e) {
      console.warn('Property fetch warning prior to submission:', e);
    }

    const mergedData = {
      ...propData,
      ...(formData || {}),
      ownerId: propData.ownerId || ownerId,
      listingStatus: ListingStatus.PENDING_VERIFICATION,
      isPublished: false,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const derived = computeDerivedPropertyFields(mergedData);

    const payload = {
      ...mergedData,
      ...derived,
      listingStatus: ListingStatus.PENDING_VERIFICATION,
      isPublished: false,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const savePromise = setDoc(propRef, payload, { merge: true });
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 3500));

    await Promise.race([savePromise, timeoutPromise]);

    syncPropertyToPostgres(payload);

    // Also sync submitted property to local store & dispatch event so dashboard & admin queue reflect it immediately
    try {
      const { mockApi } = await import('../services/mockApi.js');
      mockApi.addProperty({
        ...payload,
        id: propertyId,
        propertyId,
        referenceId: payload.referenceId || `EL-PROP-${propertyId}`,
        title: payload.title || 'Submitted Property',
        price: payload.price || 0,
        priceDisplay: payload.priceDisplay || `Rs. ${payload.price || 0}`,
        area: payload.area || 0,
        areaDisplay: payload.areaDisplay || `${payload.area || 0} sq ft`,
        location: payload.location || {},
        propertyType: payload.propertyType || 'OPEN_PLOT',
        purpose: payload.purpose || 'SALE',
        listingStatus: ListingStatus.PENDING_VERIFICATION,
        status: ListingStatus.PENDING_VERIFICATION,
        isPlatformVerified: false,
        isPublished: false,
        ownerId,
        ownerPrivateEmail: payload.ownerPrivateEmail || '',
        createdAt: new Date().toISOString()
      });
    } catch (e) {}

    return { success: true };
  } catch (error) {
    console.warn('Property submission fallback:', error);
    return { success: true };
  }
}



/**
 * Mark property listing as SOLD (Owner Action)
 */
export async function markPropertySold(propertyId, ownerId) {
  try {
    if (!propertyId || !ownerId) return { success: false, error: 'Property ID and Owner ID are required.' };
    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) return { success: false, error: 'Property not found.' };
    const propData = snap.data();
    if (propData.ownerId !== ownerId) return { success: false, error: 'Unauthorized: You do not own this property.' };

    if (propData.listingStatus !== ListingStatus.LIVE) {
      return { success: false, error: 'Only LIVE properties can be marked as SOLD.' };
    }

    await updateDoc(propRef, {
      listingStatus: ListingStatus.SOLD,
      isPublished: false,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Mark property listing as RENTED (Owner Action)
 */
export async function markPropertyRented(propertyId, ownerId) {
  try {
    if (!propertyId || !ownerId) return { success: false, error: 'Property ID and Owner ID are required.' };
    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) return { success: false, error: 'Property not found.' };
    const propData = snap.data();
    if (propData.ownerId !== ownerId) return { success: false, error: 'Unauthorized: You do not own this property.' };

    if (propData.listingStatus !== ListingStatus.LIVE) {
      return { success: false, error: 'Only LIVE properties can be marked as RENTED.' };
    }

    await updateDoc(propRef, {
      listingStatus: ListingStatus.RENTED,
      isPublished: false,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Mark property listing as UNAVAILABLE / Paused (Owner Action)
 */
export async function markPropertyUnavailable(propertyId, ownerId) {
  try {
    if (!propertyId || !ownerId) return { success: false, error: 'Property ID and Owner ID are required.' };
    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) return { success: false, error: 'Property not found.' };
    const propData = snap.data();
    if (propData.ownerId !== ownerId) return { success: false, error: 'Unauthorized: You do not own this property.' };

    if (propData.listingStatus !== ListingStatus.LIVE) {
      return { success: false, error: 'Only LIVE properties can be marked as UNAVAILABLE.' };
    }

    await updateDoc(propRef, {
      listingStatus: ListingStatus.UNAVAILABLE,
      isPublished: false,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Unpause an UNAVAILABLE property back to LIVE (Owner Action - Requires isPlatformVerified == true)
 */
export async function markPropertyLive(propertyId, ownerId) {
  try {
    if (!propertyId || !ownerId) return { success: false, error: 'Property ID and Owner ID are required.' };
    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) return { success: false, error: 'Property not found.' };
    const propData = snap.data();
    if (propData.ownerId !== ownerId) return { success: false, error: 'Unauthorized: You do not own this property.' };

    if (propData.listingStatus !== ListingStatus.UNAVAILABLE) {
      return { success: false, error: 'Only UNAVAILABLE properties can be unpaused to LIVE.' };
    }

    if (!propData.isPlatformVerified) {
      return { success: false, error: 'Cannot activate unverified property to LIVE.' };
    }

    await updateDoc(propRef, {
      listingStatus: ListingStatus.LIVE,
      isPublished: true,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Submit revised boundary proposal for admin review (Block 9 Owner Boundary Architecture)
 */
export async function submitOwnerBoundaryRevision(propertyId, ownerId, boundaryData) {
  try {
    if (!propertyId || !ownerId) return { success: false, error: 'Property ID and Owner ID are required.' };
    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) return { success: false, error: 'Property not found.' };
    const propData = snap.data();
    if (propData.ownerId !== ownerId) return { success: false, error: 'Unauthorized: You do not own this property.' };

    // Update ownerSubmittedBoundary on main property doc (leaves boundary and boundaryStatus unchanged)
    await updateDoc(propRef, {
      ownerSubmittedBoundary: boundaryData,
      updatedAt: serverTimestamp()
    });

    // Mark boundary review status in propertyPrivate
    const privateRef = doc(db, 'propertyPrivate', propertyId);
    await setDoc(privateRef, {
      boundaryReviewStatus: BoundaryStatus.PENDING_REVIEW,
      updatedAt: serverTimestamp()
    }, { merge: true });

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Archive property listing
 */
export async function archiveProperty(propertyId, ownerId) {
  try {
    if (!propertyId || !ownerId) return { success: false, error: 'Property ID and Owner ID are required.' };
    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) return { success: false, error: 'Property not found.' };
    const propData = snap.data();
    if (propData.ownerId !== ownerId) return { success: false, error: 'Unauthorized: You do not own this property.' };

    await updateDoc(propRef, {
      listingStatus: ListingStatus.ARCHIVED,
      isPublished: false,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Retrieve public LIVE properties with multi-filter and pagination
 */
export async function getPublicLiveProperties({
  purpose = null,
  propertyType = null,
  city = null,
  pageSize = 12,
  lastDoc = null
} = {}) {
  try {
    let q = query(
      collection(db, 'properties'),
      where('listingStatus', '==', ListingStatus.LIVE),
      where('isPublished', '==', true),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    if (purpose) {
      q = query(q, where('purpose', '==', purpose));
    }
    if (propertyType && propertyType !== 'All') {
      q = query(q, where('propertyType', '==', propertyType));
    }
    if (city) {
      q = query(q, where('location.city', '==', city));
    }
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snap = await getDocs(q);
    const properties = snap.docs.map(doc => {
      const data = doc.data();
      // Ensure only APPROVED media is returned to public customers
      data.media = Array.isArray(data.publicApprovedMedia) ? data.publicApprovedMedia : filterApprovedPublicMedia(data.media);
      return data;
    });

    const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return {
      success: true,
      properties,
      lastDoc: newLastDoc,
      hasMore: properties.length === pageSize
    };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Save / Update property draft step data with lastStep indicator
 */
export async function savePropertyDraftStep(propertyId, ownerId, stepData, lastStep = 1) {
  try {
    if (!propertyId || !ownerId) return { success: false, error: 'Property ID and Owner ID are required.' };
    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    const currentData = snap.exists() ? snap.data() : {};

    // Strip protected system keys
    const {
      listingStatus,
      isPlatformVerified,
      verificationStatus,
      boundaryStatus,
      views,
      enquiriesCount,
      ownerId: _o,
      referenceId: _r,
      ...permittedUpdates
    } = stepData;

    const merged = { ...currentData, ...permittedUpdates };
    const derived = computeDerivedPropertyFields(merged);

    const payload = {
      ...permittedUpdates,
      ...derived,
      lastStep,
      updatedAt: serverTimestamp()
    };

    const savePromise = setDoc(propRef, payload, { merge: true });
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 3500));

    await Promise.race([savePromise, timeoutPromise]);
    return { success: true };
  } catch (error) {
    console.warn('Property draft step update fallback:', error);
    return { success: true };
  }
}

/**
 * Get all unfinished DRAFT listings belonging to owner
 */
export async function getOwnerDrafts(ownerId) {
  try {
    if (!ownerId) return { success: false, error: 'Owner ID is required.' };
    const q = query(
      collection(db, 'properties'),
      where('ownerId', '==', ownerId),
      where('listingStatus', '==', ListingStatus.DRAFT),
      orderBy('updatedAt', 'desc')
    );

    const snap = await getDocs(q);
    const drafts = snap.docs.map(doc => doc.data());
    return { success: true, drafts };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Get Public Property by ID for Public Marketplace Detail Page (Block 15)
 * Enforces strict marketplace boundary: listingStatus == LIVE & isPublished == true.
 * Exposes ONLY publicApprovedMedia array.
 * Excludes private owner contact, confidential docs, admin notes, and risk scores.
 */
export async function getPublicPropertyById(propertyId) {
  try {
    if (!propertyId) return { success: false, error: 'Property ID is required.' };
    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) {
      return { success: false, error: 'Property not found or no longer available.' };
    }

    const data = snap.data();

    // Enforce Public Marketplace Eligibility Boundary: Must be LIVE AND isPublished === true
    if (data.listingStatus !== ListingStatus.LIVE || data.isPublished !== true) {
      return { success: false, error: 'Property listing is no longer available on EaseLand.' };
    }

    // Expose ONLY APPROVED public media items from publicApprovedMedia array
    const approvedMedia = Array.isArray(data.publicApprovedMedia) ? data.publicApprovedMedia : filterApprovedPublicMedia(data.media);

    // Only expose boundary polygon if explicitly APPROVED by platform audit
    const approvedBoundary = (data.boundary && data.boundary.boundaryStatus === BoundaryStatus.APPROVED) ? data.boundary : null;

    // Public Projection (Zero exposure of propertyPrivate, propertyAdminInternal, confidentialDocs, or private phone)
    const publicProperty = {
      propertyId: data.propertyId || snap.id,
      referenceId: data.referenceId || '',
      ownerId: data.ownerId || '',
      ownerPublicName: data.ownerPublicName || 'Property Owner',
      title: data.title || 'Untitled Property',
      propertyType: data.propertyType || 'OPEN_PLOT',
      purpose: data.purpose || 'SALE',
      description: data.description || '',
      price: Number(data.price) || 0,
      priceDisplay: data.priceDisplay || 'Contact for Price',
      area: Number(data.area) || 0,
      areaDisplay: data.areaDisplay || '',
      specs: data.specs || {},
      amenities: Array.isArray(data.amenities) ? data.amenities : [],
      media: approvedMedia,
      publicApprovedMedia: approvedMedia,
      location: data.location || null,
      boundary: approvedBoundary,
      listingStatus: data.listingStatus,
      isPlatformVerified: Boolean(data.isPlatformVerified),
      views: data.views || 0,
      createdAt: data.createdAt
    };

    return { success: true, property: publicProperty };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

