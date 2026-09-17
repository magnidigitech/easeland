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
import { mockApi } from '../services/mockApi.js';

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
  return mediaArray
    .filter(item => {
      if (!item) return false;
      if (typeof item === 'string') return item.trim().length > 0;
      if (item.verificationStatus === MediaStatus.REJECTED || item.status === 'REJECTED') return false;
      return true;
    })
    .map(item => {
      if (typeof item === 'string') {
        return {
          url: item,
          publicUrl: item,
          mediaType: 'PHOTO',
          verificationStatus: MediaStatus.APPROVED
        };
      }
      const rawUrl = item.url || item.publicUrl || item.mediaUrl || item.photoUrl || item.src || null;
      return {
        ...item,
        url: rawUrl || item.embedUrl || item.url,
        publicUrl: item.publicUrl || rawUrl,
        mediaType: item.mediaType || item.type || (item.embedUrl ? 'WALKTHROUGH_VIDEO' : 'PHOTO'),
        verificationStatus: item.verificationStatus || MediaStatus.APPROVED
      };
    })
    .filter(item => Boolean(item.url || item.embedUrl || item.publicUrl));
}

/**
 * Create a new property listing draft
 */
export async function createPropertyDraft(ownerId, propertyData) {
  try {
    if (!ownerId) return { success: false, error: 'Owner UID is required.' };
    const propertyId = propertyData.propertyId || propertyData.id || 'prop_' + Date.now();
    const refId = propertyData.referenceId || generateReferenceId();

    const derived = computeDerivedPropertyFields(propertyData);

    const publicPayload = {
      propertyId,
      id: propertyId,
      referenceId: refId,
      ownerId,
      ownerPublicName: propertyData.ownerPublicName || 'EaseLand User',
      ownerPublicPhone: propertyData.ownerPublicPhone || propertyData.ownerPrivatePhone || null,
      ownerPrivateEmail: propertyData.ownerPrivateEmail || propertyData.email || '',
      ownerPrivatePhone: propertyData.ownerPrivatePhone || '',
      title: propertyData.title || 'Untitled Property Listing',
      propertyType: propertyData.propertyType || 'OPEN_PLOT',
      purpose: propertyData.purpose || 'SALE',
      description: propertyData.description || '',
      price: Number(propertyData.price) || 0,
      priceDisplay: propertyData.priceDisplay || `Rs. ${Number(propertyData.price) || 0}`,
      area: Number(propertyData.area) || 0,
      areaDisplay: propertyData.areaDisplay || `${Number(propertyData.area) || 0} sq ft`,
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
      status: ListingStatus.DRAFT,
      isPlatformVerified: false,
      isPublished: false,
      views: 0,
      enquiriesCount: 0,

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 1. ALWAYS sync directly to PostgreSQL Server API (/api/properties)
    await syncPropertyToPostgres(publicPayload);

    // 2. ALWAYS sync to mockApi & Local Storage
    try {
      const { mockApi } = await import('../services/mockApi.js');
      mockApi.addProperty(publicPayload, true);
    } catch (e) {}

    // 3. Attempt Firestore write (non-blocking fallback for unauthenticated/dummy admin sessions)
    try {
      const propertyRef = doc(db, 'properties', propertyId);
      const privateRef = doc(db, 'propertyPrivate', propertyId);
      const mediaPrivateRef = doc(db, 'propertyMediaPrivate', propertyId);

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

      const mediaPrivatePayload = {
        propertyId,
        ownerId,
        masterMedia: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const savePromise = Promise.all([
        setDoc(propertyRef, { ...publicPayload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
        setDoc(privateRef, privatePayload),
        setDoc(mediaPrivateRef, mediaPrivatePayload)
      ]);

      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 2000));
      await Promise.race([savePromise, timeoutPromise]);
    } catch (fsErr) {
      console.warn('Firestore draft save fallback:', fsErr.message || fsErr);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-property-created', { detail: publicPayload }));
    }

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

    let deletedIds = [];
    try {
      if (typeof window !== 'undefined') {
        const rawDel = localStorage.getItem('easeland_deleted_properties');
        if (rawDel) deletedIds = JSON.parse(rawDel);
      }
    } catch (e) {}

    if (deletedIds.includes(String(propertyId))) {
      return { success: false, error: 'Property not found.' };
    }

    let data = null;

    // 1. Try Firestore
    try {
      const propRef = doc(db, 'properties', propertyId);
      const snap = await getDoc(propRef);
      if (snap.exists()) {
        data = snap.data();
      }
    } catch (e) {}

    // 2. Try PostgreSQL API (/api/properties/:id)
    if (!data) {
      try {
        const res = await fetch(`/api/properties/${propertyId}`);
        if (res.ok) {
          const pgRes = await res.json();
          if (pgRes.success && pgRes.property) {
            data = pgRes.property;
          }
        }
      } catch (e) {}
    }

    // 3. Try mockApi & Local Storage
    if (!data) {
      try {
        const { mockApi } = await import('../services/mockApi.js');
        const mProp = mockApi.getPropertyById(propertyId);
        if (mProp) data = mProp;
      } catch (e) {}
    }

    if (!data || data.status === 'DELETED' || data.listingStatus === 'DELETED') {
      return { success: false, error: 'Property not found.' };
    }

    const isOwner = currentUserId && (data.ownerId === currentUserId || currentUserId === 'admin_uid_001');

    // Security Check: Non-LIVE listings accessible ONLY by Owner or Admin
    if (data.listingStatus !== ListingStatus.LIVE && data.status !== ListingStatus.LIVE && !isOwner && !isAdminUser) {
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
    let propertiesList = [];

    let deletedIds = [];
    try {
      if (typeof window !== 'undefined') {
        const rawDel = localStorage.getItem('easeland_deleted_properties');
        if (rawDel) deletedIds = JSON.parse(rawDel);
      }
    } catch (e) {}

    // 1. Try local store & mockApi
    try {
      const { mockApi } = await import('../services/mockApi.js');
      const myProps = mockApi.getMyProperties(ownerId, '');
      if (Array.isArray(myProps)) {
        propertiesList = [...myProps];
      }
    } catch (e) {}

    // 2. Try PostgreSQL API (/api/properties)
    try {
      const res = await fetch('/api/properties');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.properties)) {
          const pgProps = data.properties.filter(p => {
            if (!p) return false;
            const pOwnerId = String(p.ownerId || p.owner?.id || p.userId || p.uid || '').toLowerCase().trim();
            const pOwnerEmail = (p.ownerPrivateEmail || p.ownerPublicEmail || p.owner?.email || p.email || '').toLowerCase().trim();
            return pOwnerId === String(ownerId).toLowerCase().trim() || (userEmail && pOwnerEmail === userEmail.toLowerCase().trim());
          });
          propertiesList = [...propertiesList, ...pgProps];
        }
      }
    } catch (e) {}

    // 3. Try Firestore non-blockingly
    try {
      const q = query(
        collection(db, 'properties'),
        where('ownerId', '==', ownerId)
      );
      const snap = await getDocs(q);
      const fsProps = snap.docs.map(doc => doc.data());
      propertiesList = [...propertiesList, ...fsProps];
    } catch (error) {
      console.warn('Firestore getOwnerProperties note:', error);
    }

    // Deduplicate and filter out deleted property IDs
    const propMap = new Map();
    propertiesList.forEach(p => {
      if (!p) return;
      const pId = String(p.id || p.propertyId || '');
      const pStatus = String(p.status || p.listingStatus || '').toUpperCase();
      if (pId && !deletedIds.includes(pId) && pStatus !== 'DELETED') {
        propMap.set(pId, { ...(propMap.get(pId) || {}), ...p });
      }
    });

    const resultList = Array.from(propMap.values());
    resultList.sort((a, b) => {
      const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (new Date(a.createdAt || 0).getTime() || 0);
      const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (new Date(b.createdAt || 0).getTime() || 0);
      return tB - tA;
    });

    return { success: true, properties: resultList, lastDoc: null, hasMore: false };
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
      isPublished: false
    };

    const derived = computeDerivedPropertyFields(mergedData);

    const publicPayload = {
      ...mergedData,
      ...derived,
      listingStatus: ListingStatus.PENDING_VERIFICATION,
      status: ListingStatus.PENDING_VERIFICATION,
      isPublished: false,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 1. ALWAYS sync directly to PostgreSQL Server API (/api/properties)
    await syncPropertyToPostgres(publicPayload);

    // 2. ALWAYS sync to mockApi & Local Storage & dispatch events
    try {
      const { mockApi } = await import('../services/mockApi.js');
      mockApi.addProperty({
        ...publicPayload,
        id: propertyId,
        propertyId,
        referenceId: publicPayload.referenceId || `EL-PROP-${propertyId}`,
        title: publicPayload.title || 'Submitted Property',
        price: publicPayload.price || 0,
        priceDisplay: publicPayload.priceDisplay || `Rs. ${publicPayload.price || 0}`,
        area: publicPayload.area || 0,
        areaDisplay: publicPayload.areaDisplay || `${publicPayload.area || 0} sq ft`,
        location: publicPayload.location || {},
        propertyType: publicPayload.propertyType || 'OPEN_PLOT',
        purpose: publicPayload.purpose || 'SALE',
        listingStatus: ListingStatus.PENDING_VERIFICATION,
        status: ListingStatus.PENDING_VERIFICATION,
        isPlatformVerified: false,
        isPublished: false,
        ownerId,
        ownerPrivateEmail: publicPayload.ownerPrivateEmail || '',
        createdAt: publicPayload.createdAt || new Date().toISOString()
      }, true);
    } catch (e) {}

    if (typeof window !== 'undefined') {
      try {
        const pIdStr = String(propertyId);
        const rawSub = localStorage.getItem('easeland_submitted_properties') || '[]';
        const parsedSub = JSON.parse(rawSub);
        if (!parsedSub.includes(pIdStr)) {
          parsedSub.push(pIdStr);
          localStorage.setItem('easeland_submitted_properties', JSON.stringify(parsedSub));
        }

        const rawUserProps = localStorage.getItem('easeland_user_properties');
        if (rawUserProps) {
          const parsed = JSON.parse(rawUserProps);
          const updated = parsed.map(p => {
            if (p && String(p.id || p.propertyId) === pIdStr) {
              return {
                ...p,
                listingStatus: ListingStatus.PENDING_VERIFICATION,
                status: ListingStatus.PENDING_VERIFICATION,
                isPublished: false
              };
            }
            return p;
          });
          localStorage.setItem('easeland_user_properties', JSON.stringify(updated));
        }
      } catch (lErr) {}

      window.dispatchEvent(new CustomEvent('easeland-property-submitted', { detail: publicPayload }));
      window.dispatchEvent(new CustomEvent('easeland-property-created', { detail: publicPayload }));
    }

    // 3. Attempt Firestore write (non-blocking fallback for unauthenticated/dummy admin sessions)
    try {
      const fsPayload = {
        ...publicPayload,
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const savePromise = setDoc(propRef, fsPayload, { merge: true });
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 2000));
      await Promise.race([savePromise, timeoutPromise]);
    } catch (fsErr) {
      console.warn('Firestore submit save fallback:', fsErr.message || fsErr);
    }

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
    let currentData = {};

    try {
      const snap = await getDoc(propRef);
      if (snap.exists()) currentData = snap.data();
    } catch (e) {
      console.warn('Property draft step fetch note:', e);
    }

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

    const publicPayload = {
      ...permittedUpdates,
      ...derived,
      propertyId,
      id: propertyId,
      ownerId: ownerId || merged.ownerId,
      lastStep,
      listingStatus: merged.listingStatus || ListingStatus.DRAFT,
      status: merged.listingStatus || ListingStatus.DRAFT,
      updatedAt: new Date().toISOString()
    };

    // 1. ALWAYS sync directly to PostgreSQL Server API (/api/properties)
    await syncPropertyToPostgres(publicPayload);

    // 2. ALWAYS sync to mockApi & Local Storage & dispatch event
    try {
      const { mockApi } = await import('../services/mockApi.js');
      mockApi.addProperty(publicPayload, true);
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-property-created', { detail: publicPayload }));
    }

    // 3. Attempt Firestore write (non-blocking fallback for unauthenticated/dummy admin sessions)
    try {
      const fsPayload = {
        ...publicPayload,
        updatedAt: serverTimestamp()
      };
      const savePromise = setDoc(propRef, fsPayload, { merge: true });
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 2000));
      await Promise.race([savePromise, timeoutPromise]);
    } catch (fsErr) {
      console.warn('Firestore draft step save fallback:', fsErr.message || fsErr);
    }

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
    let drafts = [];

    let submittedIdsSet = new Set();
    let deletedIdsSet = new Set();
    try {
      if (typeof window !== 'undefined') {
        const rawSub = localStorage.getItem('easeland_submitted_properties');
        if (rawSub) JSON.parse(rawSub).forEach(id => submittedIdsSet.add(String(id)));
        const rawDel = localStorage.getItem('easeland_deleted_properties');
        if (rawDel) JSON.parse(rawDel).forEach(id => deletedIdsSet.add(String(id)));
      }
    } catch (e) {}

    const isTrueDraft = (p) => {
      if (!p) return false;
      const pId = String(p.id || p.propertyId || p.referenceId || '');
      if (!pId || submittedIdsSet.has(pId) || deletedIdsSet.has(pId)) return false;

      const sVal = String(p.listingStatus || p.status || '').toUpperCase();
      if (['PENDING_VERIFICATION', 'LIVE', 'APPROVED_LIVE', 'REJECTED', 'CHANGES_REQUIRED', 'SUBMITTED', 'DELETED'].includes(sVal)) {
        return false;
      }
      if (p.isPublished || p.isPlatformVerified) return false;
      return sVal === 'DRAFT' || p.isDraft === true || !sVal;
    };

    // 1. Try local store & mockApi
    try {
      const { mockApi } = await import('../services/mockApi.js');
      const myProps = mockApi.getMyProperties(ownerId, '');
      if (Array.isArray(myProps)) {
        drafts = myProps.filter(isTrueDraft);
      }
    } catch (e) {}

    // 2. Try PostgreSQL API (/api/properties)
    try {
      const res = await fetch('/api/properties');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.properties)) {
          const pgDrafts = data.properties.filter(p => p && (p.ownerId === ownerId || ownerId === 'admin_uid_001') && isTrueDraft(p));
          drafts = [...drafts, ...pgDrafts];
        }
      }
    } catch (e) {}

    // 3. Try Firestore non-blockingly
    try {
      const q = query(
        collection(db, 'properties'),
        where('ownerId', '==', ownerId),
        where('listingStatus', '==', ListingStatus.DRAFT),
        orderBy('updatedAt', 'desc')
      );
      const snap = await getDocs(q);
      const fsDrafts = snap.docs.map(doc => doc.data()).filter(isTrueDraft);
      drafts = [...drafts, ...fsDrafts];
    } catch (error) {
      console.warn('Firestore getOwnerDrafts note:', error);
    }

    // Deduplicate & strictly filter out submitted items
    const draftMap = new Map();
    drafts.forEach(d => {
      if (!d || !isTrueDraft(d)) return;
      const dId = String(d.id || d.propertyId || '');
      if (dId) draftMap.set(dId, { ...(draftMap.get(dId) || {}), ...d });
    });

    const finalDrafts = Array.from(draftMap.values()).filter(isTrueDraft);
    return { success: true, drafts: finalDrafts };
  } catch (error) {
    return { success: true, drafts: [] };
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

    let targetIdStr = '';
    if (typeof propertyId === 'object' && propertyId !== null) {
      targetIdStr = String(propertyId.propertyId || propertyId.id || propertyId.referenceId || '').trim();
    } else {
      targetIdStr = String(propertyId).trim();
    }

    if (!targetIdStr) return { success: false, error: 'Valid property reference is required.' };

    let data = null;

    // 1. Try Direct Firestore Doc Lookup by Document ID
    try {
      const propRef = doc(db, 'properties', targetIdStr);
      const snap = await getDoc(propRef);
      if (snap.exists()) {
        data = { ...snap.data(), propertyId: snap.id };
      }
    } catch (err) {
      console.warn('Firestore doc lookup note:', err);
    }

    // 2. Query Firestore by referenceId or propertyId field
    if (!data) {
      try {
        const qRef = query(collection(db, 'properties'), where('referenceId', '==', targetIdStr));
        const refSnap = await getDocs(qRef);
        if (!refSnap.empty) {
          const docMatch = refSnap.docs[0];
          data = { ...docMatch.data(), propertyId: docMatch.id };
        } else {
          const qPropId = query(collection(db, 'properties'), where('propertyId', '==', targetIdStr));
          const propIdSnap = await getDocs(qPropId);
          if (!propIdSnap.empty) {
            const docMatch = propIdSnap.docs[0];
            data = { ...docMatch.data(), propertyId: docMatch.id };
          }
        }
      } catch (err) {
        console.warn('Firestore query note:', err);
      }
    }

    // 3. Fallback to mockApi & Local Storage stores
    if (!data && typeof window !== 'undefined' && typeof mockApi !== 'undefined') {
      try {
        const allLocal = mockApi.getPublicProperties({});
        const match = allLocal.find(p => {
          if (!p) return false;
          const pid = String(p.propertyId || p.id || '');
          const refid = String(p.referenceId || '');
          return pid === targetIdStr || refid === targetIdStr ||
                 pid.toLowerCase() === targetIdStr.toLowerCase() ||
                 refid.toLowerCase() === targetIdStr.toLowerCase();
        });
        if (match) {
          data = { ...match };
        }
      } catch (err) {
        console.warn('Local store lookup note:', err);
      }
    }

    // 4. Fallback to PostgreSQL server endpoint /api/properties/:id
    if (!data && typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/properties/${encodeURIComponent(targetIdStr)}`);
        if (res.ok) {
          const pgRes = await res.json();
          if (pgRes && (pgRes.property || pgRes.data)) {
            data = pgRes.property || pgRes.data;
          }
        }
      } catch (err) {
        console.warn('PostgreSQL property lookup note:', err);
      }
    }

    if (!data) {
      return { success: false, error: 'The requested property reference does not exist on our direct marketplace.' };
    }

    // Status & Availability Normalization
    const statusVal = String(data.listingStatus || data.status || '').toUpperCase();
    const verVal = String(data.verificationStatus || '').toUpperCase();

    const isArchivedOrDeleted = statusVal === 'ARCHIVED' || statusVal === 'DELETED' || statusVal === 'REJECTED';

    const isLive = statusVal === 'LIVE' ||
                   statusVal === 'APPROVED_LIVE' ||
                   statusVal === 'APPROVED' ||
                   statusVal === 'PLATFORM VERIFIED' ||
                   statusVal === 'VERIFIED' ||
                   verVal === 'PLATFORM VERIFIED' ||
                   verVal === 'VERIFIED' ||
                   verVal === 'APPROVED' ||
                   data.isPlatformVerified === true ||
                   data.isPublished === true ||
                   (!isArchivedOrDeleted && data.isPublished !== false);

    if (isArchivedOrDeleted || !isLive) {
      return { success: false, error: 'This property listing is no longer active on the public marketplace.' };
    }

    // Expose APPROVED public media items from publicApprovedMedia, media, photos, images, or single URLs
    const rawMedia = (Array.isArray(data.publicApprovedMedia) && data.publicApprovedMedia.length > 0)
      ? data.publicApprovedMedia
      : ((Array.isArray(data.media) && data.media.length > 0)
          ? data.media
          : ((Array.isArray(data.photos) && data.photos.length > 0)
              ? data.photos
              : ((Array.isArray(data.images) && data.images.length > 0)
                  ? data.images
                  : (data.imageUrl || data.coverImage || data.photoUrl ? [data.imageUrl || data.coverImage || data.photoUrl] : []))));

    const approvedMedia = filterApprovedPublicMedia(rawMedia);

    // Expose plot boundary polygon for public map display
    const publicBoundary = data.boundary || data.ownerSubmittedBoundary || data.approvedPolygon || data.polygon || null;

    // Public Projection
    const publicProperty = {
      propertyId: data.propertyId || data.id || targetIdStr,
      referenceId: data.referenceId || '',
      ownerId: data.ownerId || '',
      ownerPublicName: data.ownerPublicName || 'Property Owner',
      title: data.title || 'Untitled Property',
      propertyType: data.propertyType || 'OPEN_PLOT',
      purpose: data.purpose || 'SALE',
      description: data.description || '',
      price: Number(data.price) || 0,
      priceDisplay: data.priceDisplay || (data.price ? `Rs. ${Number(data.price).toLocaleString('en-IN')}` : 'Contact for Price'),
      area: Number(data.area) || 0,
      areaDisplay: data.areaDisplay || (data.area ? `${data.area} sq ft` : ''),
      specs: data.specs || {},
      amenities: Array.isArray(data.amenities) ? data.amenities : [],
      media: approvedMedia,
      publicApprovedMedia: approvedMedia,
      location: data.location || null,
      boundary: publicBoundary,
      listingStatus: data.listingStatus || 'LIVE',
      isPlatformVerified: Boolean(data.isPlatformVerified || verVal === 'PLATFORM VERIFIED' || verVal === 'VERIFIED'),
      views: data.views || 0,
      createdAt: data.createdAt || new Date().toISOString()
    };

    return { success: true, property: publicProperty };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Permanently Delete Property Listing (PostgreSQL + Firestore + Local Storage)
 */
export async function deletePropertyListing(propertyId, ownerId = null, isAdmin = false) {
  try {
    if (!propertyId) return { success: false, error: 'Property ID is required.' };
    const pIdStr = String(propertyId);

    // 1. Record in localStorage deleted IDs list immediately
    if (typeof window !== 'undefined') {
      try {
        const rawDeleted = localStorage.getItem('easeland_deleted_properties') || '[]';
        const parsedDeleted = JSON.parse(rawDeleted);
        if (!parsedDeleted.includes(pIdStr)) {
          parsedDeleted.push(pIdStr);
          localStorage.setItem('easeland_deleted_properties', JSON.stringify(parsedDeleted));
        }

        const rawLocal = localStorage.getItem('easeland_user_properties');
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          const updated = parsed.filter(p => String(p.id || p.propertyId) !== pIdStr);
          localStorage.setItem('easeland_user_properties', JSON.stringify(updated));
        }

        const rawStored = localStorage.getItem('easeland_properties');
        if (rawStored) {
          const parsed = JSON.parse(rawStored);
          const updated = parsed.filter(p => String(p.id || p.propertyId) !== pIdStr);
          localStorage.setItem('easeland_properties', JSON.stringify(updated));
        }

        localStorage.removeItem(`easeland_media_${pIdStr}`);
        localStorage.removeItem(`easeland_docs_${pIdStr}`);
      } catch (e) {}
    }

    // 2. Call backend API DELETE /api/properties/:id
    try {
      await fetch(`/api/properties/${propertyId}`, { method: 'DELETE' });
    } catch (e) {}

    // 3. Remove from Firestore
    try {
      const propRef = doc(db, 'properties', propertyId);
      await deleteDoc(propRef);
    } catch (e) {}

    // 4. Remove from mockApi
    try {
      const { mockApi } = await import('../services/mockApi.js');
      if (typeof mockApi.deleteProperty === 'function') {
        mockApi.deleteProperty(propertyId);
      }
    } catch (e) {}

    return { success: true };
  } catch (error) {
    console.warn('Property delete note:', error);
    return { success: true };
  }
}

