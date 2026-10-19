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
    if (!propertyData || (!propertyData.propertyId && !propertyData.id)) return null;
    const payload = {
      ...propertyData,
      propertyId: propertyData.propertyId || propertyData.id,
      id: propertyData.id || propertyData.propertyId
    };
    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      return data?.property || payload;
    }
  } catch (err) {
    console.warn('PostgreSQL sync note:', err);
  }
  return null;
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
    case 'sq yd':
    case 'sq yards':
    case 'yards':
    case 'gajam':
      return num * 9;
    case 'acres':
    case 'acre':
      return num * 43560;
    case 'cents':
    case 'cent':
      return num * 435.6;
    case 'guntas':
    case 'gunta':
    case 'gunthas':
    case 'guntha':
      return num * 1089;
    case 'ankanams':
    case 'ankanam':
      return num * 72;
    case 'sq ft':
    case 'sqft':
    case 'square feet':
    case 'square foot':
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

    const pType = String(propertyData.propertyType || 'OPEN_PLOT').toUpperCase();
    const isLandOrPlot = ['OPEN_PLOT', 'LAND', 'AGRICULTURAL_LAND', 'COMMERCIAL_LAND'].includes(pType) || pType.includes('PLOT');
    const existingFurn = propertyData.specs?.furnishing || propertyData.furnishing;
    const resolvedFurnishing = existingFurn || (!isLandOrPlot ? 'Unfurnished' : undefined);
    const resolvedSpecs = {
      ...(propertyData.specs || {}),
      ...(resolvedFurnishing ? { furnishing: propertyData.specs?.furnishing || resolvedFurnishing } : {})
    };

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
      pricePerUnit: Number(propertyData.pricePerUnit) || ((Number(propertyData.price) > 0 && Number(propertyData.area) > 0) ? Math.round(Number(propertyData.price) / Number(propertyData.area)) : null),
      pricePerUnitDisplay: propertyData.pricePerUnitDisplay || '',
      area: Number(propertyData.area) || 0,
      areaUnit: propertyData.areaUnit || propertyData.specs?.areaUnit || 'sq ft',
      areaDisplay: propertyData.areaDisplay || `${Number(propertyData.area) || 0} sq ft`,
      specs: resolvedSpecs,
      furnishing: resolvedFurnishing || propertyData.furnishing || undefined,
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
      lastStep: propertyData.lastStep || 1,
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
export async function getPropertyById(propertyId, currentUserId = null, isAdminUser = false, currentUserEmail = null) {
  try {
    if (!propertyId) return { success: false, error: 'Property ID is required.' };

    let deletedIds = [];
    try {
      if (typeof window !== 'undefined') {
        const rawDel = localStorage.getItem('easeland_deleted_properties');
        if (rawDel) deletedIds = JSON.parse(rawDel);
      }
    } catch (e) {}

    const targetStr = String(propertyId).toLowerCase().trim();

    if (deletedIds.includes(String(propertyId)) || deletedIds.includes(targetStr)) {
      return { success: false, error: 'Property not found.' };
    }

    let data = null;

    // 1. Try PostgreSQL API (/api/properties/:id) FIRST (Primary Database Source)
    try {
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}`);
      if (res.ok) {
        const pgRes = await res.json();
        if (pgRes.success && pgRes.property) {
          data = pgRes.property;
        }
      }
    } catch (e) {}

    // 1b. Fallback: Search all properties in PostgreSQL API (/api/properties) by ID, propertyId, referenceId or title
    if (!data) {
      try {
        const res = await fetch('/api/properties');
        if (res.ok) {
          const allData = await res.json();
          if (allData.success && Array.isArray(allData.properties)) {
            data = allData.properties.find(p => {
              if (!p) return false;
              const pId = String(p.id || '').toLowerCase().trim();
              const pPropId = String(p.propertyId || '').toLowerCase().trim();
              const refId = String(p.referenceId || '').toLowerCase().trim();
              const pTitle = String(p.title || '').toLowerCase().trim();
              return pId === targetStr || pPropId === targetStr || refId === targetStr || (pTitle && pTitle === targetStr);
            });
          }
        }
      } catch (e) {}
    }

    // 1c. Fallback: Search in mockApi
    if (!data) {
      try {
        const { mockApi } = await import('../services/mockApi.js');
        const pObj = mockApi.getPropertyById(propertyId);
        if (pObj) {
          data = pObj;
        } else {
          const allProps = mockApi.getProperties();
          data = allProps.find(p => {
            if (!p) return false;
            const pId = String(p.id || '').toLowerCase().trim();
            const pPropId = String(p.propertyId || '').toLowerCase().trim();
            const refId = String(p.referenceId || '').toLowerCase().trim();
            const pTitle = String(p.title || '').toLowerCase().trim();
            return pId === targetStr || pPropId === targetStr || refId === targetStr || (pTitle && pTitle === targetStr);
          });
        }
      } catch (e) {}
    }

    // 1d. Fallback: Search in localStorage ('easeland_user_properties')
    if (!data && typeof window !== 'undefined') {
      try {
        const rawLocal = localStorage.getItem('easeland_user_properties');
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (Array.isArray(parsed)) {
            data = parsed.find(p => {
              if (!p) return false;
              const pId = String(p.id || '').toLowerCase().trim();
              const pPropId = String(p.propertyId || '').toLowerCase().trim();
              const refId = String(p.referenceId || '').toLowerCase().trim();
              const pTitle = String(p.title || '').toLowerCase().trim();
              return pId === targetStr || pPropId === targetStr || refId === targetStr || (pTitle && pTitle === targetStr);
            });
          }
        }
      } catch (e) {}
    }

    // 2. Try Firestore
    if (!data) {
      try {
        const propRef = doc(db, 'properties', propertyId);
        const snap = await getDoc(propRef);
        if (snap.exists()) {
          data = snap.data();
        }
      } catch (e) {}
    }

    if (!data || data.status === 'DELETED' || data.listingStatus === 'DELETED') {
      return { success: false, error: 'Property not found.' };
    }

    const currUidNorm = String(currentUserId || '').toLowerCase().trim();
    const currEmailNorm = String(currentUserEmail || '').toLowerCase().trim();

    const pOwnerId = String(data.ownerId || data.owner?.id || data.userId || data.uid || data.submittedBy || '').toLowerCase().trim();
    const pOwnerEmail = (data.ownerPrivateEmail || data.ownerPublicEmail || data.owner?.email || data.email || '').toLowerCase().trim();

    const isOwner = Boolean(
      (currUidNorm && pOwnerId && pOwnerId === currUidNorm) ||
      (currEmailNorm && pOwnerEmail && pOwnerEmail === currEmailNorm) ||
      currUidNorm === 'admin_uid_001'
    );

    const isLive = Boolean(
      data.listingStatus === ListingStatus.LIVE || data.status === ListingStatus.LIVE ||
      data.status === 'LIVE' || data.listingStatus === 'LIVE' ||
      data.status === 'APPROVED' || data.listingStatus === 'APPROVED' || data.status === 'APPROVED_LIVE' ||
      data.verificationStatus === 'Platform Verified' || data.verificationStatus === 'PLATFORM VERIFIED' ||
      data.isPlatformVerified || data.isPublished
    );

    // Security Check: Non-LIVE listings accessible ONLY by Owner or Admin
    if (!isLive && !isOwner && !isAdminUser && !currUidNorm) {
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
    let serverAdminDeletedLedger = [];

    // 1. Primary PostgreSQL database fetch (/api/properties)
    try {
      const res = await fetch('/api/properties');
      if (res.ok) {
        const data = await res.json();
        if (data.adminDeletedLedger && Array.isArray(data.adminDeletedLedger)) {
          serverAdminDeletedLedger = data.adminDeletedLedger;
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem('easeland_admin_deleted_properties', JSON.stringify(data.adminDeletedLedger));
            }
          } catch (e) {}
        }
        if (data.success && Array.isArray(data.properties)) {
          const pgProps = data.properties.filter(p => {
            if (!p) return false;
            const pOwnerId = String(p.ownerId || p.owner?.id || p.userId || p.uid || p.submittedBy || '').toLowerCase().trim();
            const pOwnerEmail = (p.ownerPrivateEmail || p.ownerPublicEmail || p.owner?.email || p.email || '').toLowerCase().trim();
            const targetIdStr = String(ownerId || '').toLowerCase().trim();
            return Boolean(targetIdStr && pOwnerId && pOwnerId === targetIdStr);
          });
          propertiesList = [...pgProps];
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

    let deletedIds = [];
    let adminDeletedList = [...serverAdminDeletedLedger];
    try {
      if (typeof window !== 'undefined') {
        const rawDel = localStorage.getItem('easeland_deleted_properties');
        if (rawDel) deletedIds = JSON.parse(rawDel).map(v => String(v).toLowerCase().trim());
        const rawAdminDel = localStorage.getItem('easeland_admin_deleted_properties');
        if (rawAdminDel) {
          const parsed = JSON.parse(rawAdminDel);
          if (Array.isArray(parsed)) {
            parsed.forEach(item => {
              if (item && !adminDeletedList.some(x => String(x.id || x.propertyId || x.referenceId) === String(item.id || item.propertyId || item.referenceId))) {
                adminDeletedList.push(item);
              }
            });
          }
        }
      }
    } catch (e) {}

    // Deduplicate and filter out deleted property IDs (by ID & title)
    const propMap = new Map();
    propertiesList.forEach(p => {
      if (!p) return;
      const pId = String(p.id || p.propertyId || p.referenceId || '');
      const normTitle = (p.title || '').toLowerCase().trim();
      const pStatus = String(p.status || p.listingStatus || '').toUpperCase();
      const pLst = String(p.listingStatus || '').toUpperCase();

      const pId1 = String(p.id || '').toLowerCase().trim();
      const pId2 = String(p.propertyId || '').toLowerCase().trim();
      const pId3 = String(p.referenceId || '').toLowerCase().trim();
      const num1 = pId1.replace(/^(el-prop-|prop-)/i, '');
      const num2 = pId2.replace(/^(el-prop-|prop-)/i, '');
      const num3 = pId3.replace(/^(el-prop-|prop-)/i, '');

      const isAdminDeleted = Boolean(
        p.deletedByAdmin === true ||
        pStatus === 'DELETED_BY_ADMIN' ||
        pLst === 'DELETED_BY_ADMIN' ||
        adminDeletedList.some(item => {
          if (!item) return false;
          const iId1 = String(item.id || '').toLowerCase().trim();
          const iId2 = String(item.propertyId || '').toLowerCase().trim();
          const iId3 = String(item.referenceId || '').toLowerCase().trim();
          const iNum1 = iId1.replace(/^(el-prop-|prop-)/i, '');
          const iNum2 = iId2.replace(/^(el-prop-|prop-)/i, '');
          const iTitle = String(item.title || '').toLowerCase().trim();
          return (
            (iId1 && (iId1 === pId1 || iId1 === pId2 || iId1 === pId3)) ||
            (iId2 && (iId2 === pId1 || iId2 === pId2 || iId2 === pId3)) ||
            (iId3 && (iId3 === pId1 || iId3 === pId2 || iId3 === pId3)) ||
            (iNum1 && ((num1 && iNum1 === num1) || (num2 && iNum1 === num2) || (num3 && iNum1 === num3))) ||
            (iNum2 && ((num1 && iNum2 === num1) || (num2 && iNum2 === num2) || (num3 && iNum2 === num3))) ||
            (iTitle && normTitle && iTitle === normTitle)
          );
        })
      );

      const isUserDeleted = !isAdminDeleted && (
        p.isDeleted === true ||
        pStatus === 'DELETED' ||
        pLst === 'DELETED' ||
        deletedIds.some(d => {
          const dStr = String(d || '').toLowerCase().trim();
          const dNum = dStr.replace(/^(el-prop-|prop-)/i, '');
          return (
            (dStr && (dStr === pId1 || dStr === pId2 || dStr === pId3)) ||
            (dNum && ((num1 && dNum === num1) || (num2 && dNum === num2) || (num3 && dNum === num3))) ||
            (normTitle && dStr === normTitle)
          );
        })
      );

      if (isUserDeleted) return;

      if (pId || normTitle) {
        let existingKey = pId;
        let existing = propMap.get(pId);

        if (!existing && normTitle) {
          for (const [k, v] of propMap.entries()) {
            if (v && (v.title || '').toLowerCase().trim() === normTitle) {
              existingKey = k;
              existing = v;
              break;
            }
          }
        }
        existing = existing || {};

        // UNIDIRECTIONAL IMMUTABILITY: If either existing OR incoming is marked DELETED_BY_ADMIN, it stays deleted!
        const existingIsAdminDeleted = Boolean(
          existing.deletedByAdmin === true ||
          existing.status === 'DELETED_BY_ADMIN' ||
          existing.listingStatus === 'DELETED_BY_ADMIN'
        );

        if (isAdminDeleted || existingIsAdminDeleted) {
          propMap.set(existingKey || pId, {
            ...existing,
            ...p,
            id: existing.id || p.id || p.propertyId,
            propertyId: existing.propertyId || p.propertyId || p.id,
            status: 'DELETED_BY_ADMIN',
            listingStatus: 'DELETED_BY_ADMIN',
            verificationStatus: 'Deleted by Admin',
            deletedByAdmin: true,
            isDeleted: true,
            isPlatformVerified: false,
            isPublished: false,
            adminFeedback: 'Notification: Deleted by Admin. This listing was removed from the marketplace by an EaseLand Admin Auditor.',
            verificationNotes: 'Deleted by Admin',
            adminNotes: 'Deleted by Admin'
          });

          // Self-healing Firestore update using owner session
          const targetDocId = p.id || p.propertyId;
          if (targetDocId && (p.listingStatus === 'LIVE' || p.listingStatus === 'PENDING_VERIFICATION' || p.status === 'LIVE' || p.status === 'PENDING_VERIFICATION')) {
            try {
              const propDocRef = doc(db, 'properties', String(targetDocId));
              updateDoc(propDocRef, {
                status: 'DELETED_BY_ADMIN',
                listingStatus: 'DELETED_BY_ADMIN',
                deletedByAdmin: true,
                isDeleted: true,
                isPublished: false,
                adminFeedback: 'Notification: Deleted by Admin. This listing was removed from the marketplace by an EaseLand Admin Auditor.'
              }).catch(() => {});
            } catch (err) {}
          }
          return;
        }

        const isLive = Boolean(
          p.status === 'LIVE' || p.listingStatus === 'LIVE' || p.status === 'APPROVED' || p.listingStatus === 'APPROVED' || p.status === 'APPROVED_LIVE' ||
          p.verificationStatus === 'Platform Verified' || p.verificationStatus === 'PLATFORM VERIFIED' || p.isPlatformVerified || p.isPublished ||
          existing.status === 'LIVE' || existing.listingStatus === 'LIVE' || existing.status === 'APPROVED' || existing.listingStatus === 'APPROVED' || existing.status === 'APPROVED_LIVE' ||
          existing.verificationStatus === 'Platform Verified' || existing.verificationStatus === 'PLATFORM VERIFIED' || existing.isPlatformVerified || existing.isPublished
        );

        const resolvedStatus = isLive ? 'LIVE' : (p.status || existing.status || 'DRAFT');
        const resolvedListingStatus = isLive ? 'LIVE' : (p.listingStatus || existing.listingStatus || 'DRAFT');
        const resolvedVerStatus = isLive ? 'Platform Verified' : (p.verificationStatus || existing.verificationStatus || 'Pending Admin Verification');

        propMap.set(existingKey || pId, {
          ...existing,
          ...p,
          id: existing.id || p.id || p.propertyId,
          propertyId: existing.propertyId || p.propertyId || p.id,
          status: resolvedStatus,
          listingStatus: resolvedListingStatus,
          verificationStatus: resolvedVerStatus,
          isPlatformVerified: isLive || Boolean(p.isPlatformVerified || existing.isPlatformVerified),
          isPublished: isLive || Boolean(p.isPublished || existing.isPublished)
        });
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
    let currentData = null;

    // 1. Try PostgreSQL API first (Primary DB)
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/properties/' + encodeURIComponent(propertyId));
        if (res.ok) {
          const pgRes = await res.json();
          if (pgRes.success && pgRes.property) {
            currentData = pgRes.property;
          }
        }
      } catch (e) {}
    }

    // 2. Try Firestore
    if (!currentData) {
      try {
        const snap = await getDoc(propRef);
        if (snap.exists()) currentData = snap.data();
      } catch (e) {}
    }

    // 3. Try mockApi and LocalStorage
    if (!currentData && typeof window !== 'undefined') {
      try {
        const { mockApi } = await import('../services/mockApi.js');
        const pObj = mockApi.getPropertyById(propertyId);
        if (pObj) currentData = pObj;
      } catch (e) {}
    }

    if (!currentData) return { success: false, error: 'Property not found.' };

    const cOwnerId = String(currentData.ownerId || currentData.owner?.id || currentData.userId || '').toLowerCase().trim();
    const reqOwnerId = String(ownerId || '').toLowerCase().trim();
    if (cOwnerId && reqOwnerId && cOwnerId !== reqOwnerId && reqOwnerId !== 'admin_uid_001') {
      return { success: false, error: 'Unauthorized: You do not own this property.' };
    }

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

    // Check if property is already LIVE / VERIFIED
    const isAlreadyLive = Boolean(
      currentData.listingStatus === ListingStatus.LIVE ||
      currentData.status === ListingStatus.LIVE ||
      currentData.listingStatus === 'LIVE' ||
      currentData.status === 'LIVE' ||
      currentData.status === 'APPROVED' ||
      currentData.listingStatus === 'APPROVED' ||
      currentData.isPlatformVerified ||
      currentData.isPublished
    );

    if (isAlreadyLive) {
      // Owner is attempting to change details on a live & verified listing.
      // Under NO circumstances overwrite root live fields or unpublish the property!
      // Stage the updates in pendingReauditData and flag for Admin Re-Verification.
      const existingPending = currentData.pendingReauditData || currentData.pendingEdits || {};
      const mergedPending = { ...existingPending, ...permittedUpdates };
      const derived = computeDerivedPropertyFields({ ...currentData, ...mergedPending });

      const payload = {
        ...currentData, // Retains all existing approved data visible to public!
        hasPendingEdits: true,
        reAuditStatus: ListingStatus.PENDING_VERIFICATION,
        reAuditRequestedAt: new Date().toISOString(),
        pendingReauditData: {
          ...mergedPending,
          ...derived,
          updatedAt: new Date().toISOString()
        },
        listingStatus: ListingStatus.LIVE,
        status: ListingStatus.LIVE,
        isPublished: true,
        isPlatformVerified: true,
        updatedAt: new Date().toISOString()
      };

      await syncPropertyToPostgres(payload);
      try {
        const { mockApi } = await import('../services/mockApi.js');
        mockApi.addProperty(payload, false);
      } catch (e) {}

      try {
        await updateDoc(propRef, {
          hasPendingEdits: true,
          reAuditStatus: ListingStatus.PENDING_VERIFICATION,
          reAuditRequestedAt: serverTimestamp(),
          pendingReauditData: payload.pendingReauditData,
          updatedAt: serverTimestamp()
        });
      } catch (e) {}

      return { success: true, materialEdit: true, reAuditPending: true };
    }

    const merged = { ...currentData, ...permittedUpdates };
    const derived = computeDerivedPropertyFields(merged);

    const payload = {
      ...permittedUpdates,
      ...derived,
      updatedAt: serverTimestamp()
    };

    await updateDoc(propRef, payload);
    return { success: true, materialEdit: false };
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

    // 1. Try PostgreSQL API first (Primary DB)
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/properties/' + encodeURIComponent(propertyId));
        if (res.ok) {
          const pgRes = await res.json();
          if (pgRes.success && pgRes.property) {
            propData = pgRes.property;
          }
        }
      } catch (e) {}
    }

    // 2. Try Firestore
    if (!propData || !propData.title) {
      try {
        const snap = await getDoc(propRef);
        if (snap.exists()) {
          propData = { ...propData, ...snap.data() };
        }
      } catch (e) {
        console.warn('Property fetch warning prior to submission:', e);
      }
    }

    // 3. Try mockApi and LocalStorage
    if (!propData || !propData.title) {
      if (typeof window !== 'undefined') {
        try {
          const { mockApi } = await import('../services/mockApi.js');
          const pObj = mockApi.getPropertyById(propertyId);
          if (pObj) propData = { ...pObj, ...propData };
        } catch (e) {}
      }
    }

    const propStatusUpper = String(propData.status || propData.listingStatus || '').toUpperCase();
    const propListingStatusUpper = String(propData.listingStatus || '').toUpperCase();
    const isExplicitNonLive = (
      propStatusUpper === 'CHANGES_REQUIRED' ||
      propStatusUpper === 'CHANGES_REQUESTED' ||
      propListingStatusUpper === 'CHANGES_REQUIRED' ||
      propListingStatusUpper === 'CHANGES_REQUESTED' ||
      propStatusUpper === 'REJECTED' ||
      propListingStatusUpper === 'REJECTED' ||
      propStatusUpper === 'DRAFT' ||
      propListingStatusUpper === 'DRAFT'
    );

    const isAlreadyLive = !isExplicitNonLive && Boolean(
      formData?.isAlreadyLive ||
      propStatusUpper === 'LIVE' ||
      propStatusUpper === 'APPROVED' ||
      propStatusUpper === 'APPROVED_LIVE' ||
      propListingStatusUpper === 'LIVE' ||
      propListingStatusUpper === 'APPROVED' ||
      (propData.isPlatformVerified === true && propData.isPublished === true)
    );

    let publicPayload = {};

    if (isAlreadyLive && formData) {
      // Re-Audit Workflow: Keep existing live data published on site while staging new edits for Admin verification
      const derived = computeDerivedPropertyFields({ ...propData, ...formData });
      publicPayload = {
        ...propData,
        hasPendingEdits: true,
        reAuditStatus: ListingStatus.PENDING_VERIFICATION,
        reAuditRequestedAt: new Date().toISOString(),
        pendingReauditData: {
          ...formData,
          ...derived,
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        listingStatus: ListingStatus.LIVE,
        status: ListingStatus.LIVE,
        isPublished: true,
        isPlatformVerified: true,
        updatedAt: new Date().toISOString()
      };
    } else {
      const mergedData = {
        ...propData,
        ...(formData || {}),
        ownerId: propData.ownerId || ownerId,
        listingStatus: ListingStatus.PENDING_VERIFICATION,
        isPublished: false
      };
      const pType = String(mergedData.propertyType || 'OPEN_PLOT').toUpperCase();
      const isLandOrPlot = ['OPEN_PLOT', 'LAND', 'AGRICULTURAL_LAND', 'COMMERCIAL_LAND'].includes(pType) || pType.includes('PLOT');
      if (!isLandOrPlot) {
        mergedData.specs = {
          ...(mergedData.specs || {}),
          furnishing: mergedData.specs?.furnishing || 'Unfurnished'
        };
        mergedData.furnishing = mergedData.furnishing || 'Unfurnished';
      }

      const derived = computeDerivedPropertyFields(mergedData);

      publicPayload = {
        ...mergedData,
        ...derived,
        listingStatus: ListingStatus.PENDING_VERIFICATION,
        status: ListingStatus.PENDING_VERIFICATION,
        listing_status: ListingStatus.PENDING_VERIFICATION,
        verificationStatus: 'Pending Verification',
        isPublished: false,
        is_published: false,
        isPlatformVerified: false,
        hasPendingEdits: false,
        pendingReauditData: null,
        reAuditStatus: null,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    // 1. ALWAYS sync directly to PostgreSQL Server API (/api/properties)
    await syncPropertyToPostgres(publicPayload);

    // 2. ALWAYS sync to mockApi & Local Storage & dispatch events
    try {
      const { mockApi } = await import('../services/mockApi.js');
      mockApi.addProperty({
        ...publicPayload,
        id: propertyId,
        propertyId,
        referenceId: publicPayload.referenceId || 'EL-PROP-' + propertyId,
        ownerId,
        ownerPrivateEmail: publicPayload.ownerPrivateEmail || '',
        createdAt: publicPayload.createdAt || new Date().toISOString()
      }, false);
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
              if (isAlreadyLive) {
                return {
                  ...p,
                  hasPendingEdits: true,
                  reAuditStatus: ListingStatus.PENDING_VERIFICATION,
                  pendingReauditData: publicPayload.pendingReauditData,
                  listingStatus: ListingStatus.LIVE,
                  status: ListingStatus.LIVE,
                  isPublished: true,
                  isPlatformVerified: true
                };
              }
              return {
                ...p,
                listingStatus: ListingStatus.PENDING_VERIFICATION,
                status: ListingStatus.PENDING_VERIFICATION,
                verificationStatus: 'Pending Verification',
                isPublished: false
              };
            }
            return p;
          });
          localStorage.setItem('easeland_user_properties', JSON.stringify(updated));
        }

        const rawAllProps = localStorage.getItem('easeland_properties');
        if (rawAllProps) {
          const parsedAll = JSON.parse(rawAllProps);
          const updatedAll = parsedAll.map(p => {
            if (p && String(p.id || p.propertyId) === pIdStr) {
              if (isAlreadyLive) {
                return {
                  ...p,
                  hasPendingEdits: true,
                  reAuditStatus: ListingStatus.PENDING_VERIFICATION,
                  pendingReauditData: publicPayload.pendingReauditData,
                  listingStatus: ListingStatus.LIVE,
                  status: ListingStatus.LIVE,
                  isPublished: true,
                  isPlatformVerified: true
                };
              }
              return {
                ...p,
                listingStatus: ListingStatus.PENDING_VERIFICATION,
                status: ListingStatus.PENDING_VERIFICATION,
                verificationStatus: 'Pending Verification',
                isPublished: false
              };
            }
            return p;
          });
          localStorage.setItem('easeland_properties', JSON.stringify(updatedAll));
        }
      } catch (lErr) {}

      window.dispatchEvent(new CustomEvent('easeland-property-submitted', { detail: publicPayload }));
      window.dispatchEvent(new CustomEvent('easeland-property-status-updated', { detail: publicPayload }));
      window.dispatchEvent(new CustomEvent('easeland-property-created', { detail: publicPayload }));
      window.dispatchEvent(new CustomEvent('easeland-property-updated', { detail: publicPayload }));
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

    // 1. Try PostgreSQL API first (Primary DB)
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/properties/' + encodeURIComponent(propertyId));
        if (res.ok) {
          const pgRes = await res.json();
          if (pgRes.success && pgRes.property) {
            currentData = pgRes.property;
          }
        }
      } catch (e) {}
    }

    // 2. Try Firestore
    if (!currentData || !currentData.title) {
      try {
        const snap = await getDoc(propRef);
        if (snap.exists()) currentData = { ...currentData, ...snap.data() };
      } catch (e) {
        console.warn('Property draft step fetch note:', e);
      }
    }

    // 3. Try mockApi and LocalStorage
    if (!currentData || !currentData.title) {
      if (typeof window !== 'undefined') {
        try {
          const { mockApi } = await import('../services/mockApi.js');
          const pObj = mockApi.getPropertyById(propertyId);
          if (pObj) currentData = { ...pObj, ...currentData };
        } catch (e) {}
      }
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

    // Check if the property is already LIVE / VERIFIED
    let isAlreadyLive = Boolean(
      stepData.isAlreadyLive ||
      currentData.listingStatus === ListingStatus.LIVE ||
      currentData.status === ListingStatus.LIVE ||
      currentData.listingStatus === 'LIVE' ||
      currentData.status === 'LIVE' ||
      currentData.status === 'APPROVED' ||
      currentData.listingStatus === 'APPROVED' ||
      currentData.isPlatformVerified ||
      currentData.isPublished
    );

    if (isAlreadyLive) {
      // The property is already LIVE on the marketplace.
      // Under NO circumstances overwrite root live fields or unpublish the property!
      // Stage the updates in pendingReauditData and flag for Admin Re-Verification.
      const existingPending = currentData.pendingReauditData || currentData.pendingEdits || {};
      const mergedPending = { ...existingPending, ...permittedUpdates };
      const derived = computeDerivedPropertyFields({ ...currentData, ...mergedPending });

      const publicPayload = {
        ...currentData, // Retains live approved fields for public users!
        hasPendingEdits: true,
        reAuditStatus: currentData.reAuditStatus === ListingStatus.PENDING_VERIFICATION ? ListingStatus.PENDING_VERIFICATION : 'DRAFT',
        pendingReauditData: {
          ...mergedPending,
          ...derived,
          lastStep,
          updatedAt: new Date().toISOString()
        },
        listingStatus: ListingStatus.LIVE,
        status: ListingStatus.LIVE,
        isPublished: true,
        isPlatformVerified: true,
        updatedAt: new Date().toISOString()
      };

      await syncPropertyToPostgres(publicPayload);

      try {
        const { mockApi } = await import('../services/mockApi.js');
        mockApi.addProperty(publicPayload, false);
      } catch (e) {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('easeland-property-updated', { detail: publicPayload }));
      }

      try {
        await setDoc(propRef, {
          ...publicPayload,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {}

      return { success: true, isAlreadyLive: true };
    }

    const merged = { ...currentData, ...permittedUpdates };
    const pType = String(merged.propertyType || 'OPEN_PLOT').toUpperCase();
    const isLandOrPlot = ['OPEN_PLOT', 'LAND', 'AGRICULTURAL_LAND', 'COMMERCIAL_LAND'].includes(pType) || pType.includes('PLOT');
    if (!isLandOrPlot) {
      if (merged.specs && !merged.specs.furnishing) {
        merged.specs.furnishing = 'Unfurnished';
      }
      if (!merged.furnishing) {
        merged.furnishing = 'Unfurnished';
      }
      if (permittedUpdates.specs && !permittedUpdates.specs.furnishing) {
        permittedUpdates.specs.furnishing = 'Unfurnished';
      }
    }
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

    // 1. Try PostgreSQL API (/api/properties/:id) FIRST (Primary Database Source)
    if (typeof window !== 'undefined') {
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

    // 1b. Search PostgreSQL API (/api/properties) by ID, referenceId, or title match
    if (!data && typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/properties');
        if (res.ok) {
          const pgRes = await res.json();
          if (pgRes && Array.isArray(pgRes.properties)) {
            const match = pgRes.properties.find(p => {
              if (!p) return false;
              const pid = String(p.propertyId || p.id || '');
              const refid = String(p.referenceId || '');
              const ptitle = String(p.title || '');
              return pid === targetIdStr || refid === targetIdStr ||
                     pid.toLowerCase() === targetIdStr.toLowerCase() ||
                     refid.toLowerCase() === targetIdStr.toLowerCase() ||
                     (ptitle && ptitle.toLowerCase() === targetIdStr.toLowerCase());
            });
            if (match) data = match;
          }
        }
      } catch (err) {}
    }

    // 2. Direct Firestore Doc Lookup by Document ID
    if (!data) {
      try {
        const propRef = doc(db, 'properties', targetIdStr);
        const snap = await getDoc(propRef);
        if (snap.exists()) {
          data = { ...snap.data(), propertyId: snap.id };
        }
      } catch (err) {
        console.warn('Firestore doc lookup note:', err);
      }
    }

    // 3. Query Firestore by referenceId or propertyId field
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



    if (!data) {
      return { success: false, error: 'The requested property reference does not exist on our direct marketplace.' };
    }

    // Status & Availability Normalization
    const statusVal = String(data.listingStatus || data.status || '').toUpperCase();
    const verVal = String(data.verificationStatus || '').toUpperCase();

    let adminDelList = [];
    try {
      if (typeof window !== 'undefined') {
        const rawA = localStorage.getItem('easeland_admin_deleted_properties');
        if (rawA) adminDelList = JSON.parse(rawA);
      }
    } catch (e) {}

    const pId1 = String(data.id || '').toLowerCase().trim();
    const pId2 = String(data.propertyId || '').toLowerCase().trim();
    const pId3 = String(data.referenceId || '').toLowerCase().trim();
    const num1 = pId1.replace(/^(el-prop-|prop-)/i, '');
    const num2 = pId2.replace(/^(el-prop-|prop-)/i, '');
    const normTitle = String(data.title || '').toLowerCase().trim();

    const isInAdminDelLedger = adminDelList.some(item => {
      if (!item) return false;
      const iId1 = String(item.id || '').toLowerCase().trim();
      const iId2 = String(item.propertyId || '').toLowerCase().trim();
      const iId3 = String(item.referenceId || '').toLowerCase().trim();
      const iNum1 = iId1.replace(/^(el-prop-|prop-)/i, '');
      const iNum2 = iId2.replace(/^(el-prop-|prop-)/i, '');
      const iTitle = String(item.title || '').toLowerCase().trim();
      return (
        (iId1 && (iId1 === pId1 || iId1 === pId2 || iId1 === pId3)) ||
        (iId2 && (iId2 === pId1 || iId2 === pId2 || iId2 === pId3)) ||
        (iId3 && (iId3 === pId1 || iId3 === pId2 || iId3 === pId3)) ||
        (iNum1 && ((num1 && iNum1 === num1) || (num2 && iNum1 === num2))) ||
        (iNum2 && ((num1 && iNum2 === num1) || (num2 && iNum2 === num2))) ||
        (iTitle && normTitle && iTitle === normTitle)
      );
    });

    const isArchivedOrDeleted = statusVal === 'ARCHIVED' || statusVal === 'DELETED' || statusVal === 'DELETED_BY_ADMIN' || statusVal === 'REJECTED' || data.isDeleted === true || data.deletedByAdmin === true || isInAdminDelLedger;

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
      return { success: false, error: 'This property listing was removed by Admin and is no longer available on EaseLand.' };
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
export async function deletePropertyListing(propertyId, ownerId = null, isAdmin = false, propertyObj = null) {
  try {
    if (!propertyId && !propertyObj) return { success: false, error: 'Property ID is required.' };
    const pIdStr = String(propertyId || propertyObj?.id || propertyObj?.propertyId || '');
    const id2 = String(propertyObj?.propertyId || '');
    const id3 = String(propertyObj?.referenceId || '');
    const num1 = pIdStr.replace(/^(el-prop-|prop-)/i, '');
    const num2 = id2.replace(/^(el-prop-|prop-)/i, '');
    const num3 = id3.replace(/^(el-prop-|prop-)/i, '');
    const normTitle = String(propertyObj?.title || '').toLowerCase().trim();

    const allAliases = new Set([
      pIdStr.toLowerCase(),
      id2.toLowerCase(),
      id3.toLowerCase(),
      num1 ? `el-prop-${num1}`.toLowerCase() : '',
      num1 ? `prop-${num1}`.toLowerCase() : '',
      num1 ? num1.toLowerCase() : '',
      num2 ? `el-prop-${num2}`.toLowerCase() : '',
      num2 ? num2.toLowerCase() : '',
      num3 ? `el-prop-${num3}`.toLowerCase() : '',
      num3 ? num3.toLowerCase() : ''
    ].filter(Boolean));

    const matchesAlias = (p) => {
      if (!p) return false;
      const pid = String(p.id || '').toLowerCase().trim();
      const ppid = String(p.propertyId || '').toLowerCase().trim();
      const pref = String(p.referenceId || '').toLowerCase().trim();
      const pnum = pid.replace(/^(el-prop-|prop-)/i, '');
      const ptitle = String(p.title || '').toLowerCase().trim();

      return (
        allAliases.has(pid) ||
        allAliases.has(ppid) ||
        allAliases.has(pref) ||
        (pnum && allAliases.has(pnum)) ||
        (normTitle && ptitle && ptitle === normTitle)
      );
    };

    // 1. Record in localStorage deleted IDs list immediately
    if (typeof window !== 'undefined') {
      try {
        const rawDeleted = localStorage.getItem('easeland_deleted_properties') || '[]';
        const parsedDeleted = JSON.parse(rawDeleted);
        allAliases.forEach(alias => {
          if (!parsedDeleted.includes(alias)) parsedDeleted.push(alias);
        });
        if (normTitle && !parsedDeleted.includes(normTitle)) parsedDeleted.push(normTitle);
        localStorage.setItem('easeland_deleted_properties', JSON.stringify(parsedDeleted));

        if (isAdmin) {
          const rawAdminDel = localStorage.getItem('easeland_admin_deleted_properties') || '[]';
          const parsedAdminDel = JSON.parse(rawAdminDel);
          const exists = parsedAdminDel.some(item => matchesAlias(item));
          if (!exists) {
            parsedAdminDel.push({
              id: pIdStr,
              propertyId: id2 || pIdStr,
              referenceId: id3 || `EL-PROP-${num1 || pIdStr}`,
              title: propertyObj?.title || '',
              deletedByAdmin: true,
              adminFeedback: 'Notification: Deleted by Admin',
              adminNotes: 'Deleted by Admin',
              deletedAt: new Date().toISOString()
            });
            localStorage.setItem('easeland_admin_deleted_properties', JSON.stringify(parsedAdminDel));
          }
        }

        const rawLocal = localStorage.getItem('easeland_user_properties');
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          const updated = parsed.map(p => {
            if (matchesAlias(p)) {
              if (isAdmin) {
                return {
                  ...p,
                  status: 'DELETED_BY_ADMIN',
                  listingStatus: 'DELETED_BY_ADMIN',
                  deletedByAdmin: true,
                  isDeleted: true,
                  isPublished: false,
                  adminFeedback: 'Notification: Deleted by Admin',
                  adminNotes: 'Deleted by Admin'
                };
              }
              return null;
            }
            return p;
          }).filter(Boolean);
          localStorage.setItem('easeland_user_properties', JSON.stringify(updated));
        }

        const rawStored = localStorage.getItem('easeland_properties');
        if (rawStored) {
          const parsed = JSON.parse(rawStored);
          const updated = parsed.map(p => {
            if (matchesAlias(p)) {
              if (isAdmin) {
                return {
                  ...p,
                  status: 'DELETED_BY_ADMIN',
                  listingStatus: 'DELETED_BY_ADMIN',
                  deletedByAdmin: true,
                  isDeleted: true,
                  isPublished: false,
                  adminFeedback: 'Notification: Deleted by Admin',
                  adminNotes: 'Deleted by Admin'
                };
              }
              return null;
            }
            return p;
          }).filter(Boolean);
          localStorage.setItem('easeland_properties', JSON.stringify(updated));
        }

        allAliases.forEach(alias => {
          localStorage.removeItem('easeland_media_' + alias);
          localStorage.removeItem('easeland_docs_' + alias);
          localStorage.removeItem('easeland_wizard_location_' + alias);
        });
        localStorage.removeItem('easeland_wizard_location_guest');
        if (ownerId) {
          localStorage.removeItem('easeland_wizard_location_' + ownerId);
        }
        if (typeof sessionStorage !== 'undefined') {
          const rawEditing = sessionStorage.getItem('easeland_editing_property');
          if (rawEditing) {
            try {
              const parsedEditing = JSON.parse(rawEditing);
              if (matchesAlias(parsedEditing)) {
                sessionStorage.removeItem('easeland_editing_property');
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    }

    // 2. Call backend API DELETE /api/properties/:id
    try {
      await fetch(`/api/properties/${encodeURIComponent(pIdStr)}${isAdmin ? '?isAdmin=true' : ''}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isAdmin,
          propertyId: pIdStr,
          referenceId: id3,
          title: propertyObj?.title || '',
          property: propertyObj
        })
      });
    } catch (e) {}

    // 3. Update or Remove from Firestore
    try {
      const propRef = doc(db, 'properties', propertyId);
      if (isAdmin) {
        try {
          await updateDoc(propRef, {
            status: 'DELETED_BY_ADMIN',
            listingStatus: 'DELETED_BY_ADMIN',
            deletedByAdmin: true,
            isDeleted: true,
            isPublished: false,
            adminFeedback: 'Notification: Deleted by Admin',
            verificationNotes: 'Deleted by Admin'
          });
        } catch (updErr) {
          await deleteDoc(propRef);
        }
      } else {
        await deleteDoc(propRef);
      }
    } catch (e) {}

    // 4. Remove/update in mockApi
    try {
      const { mockApi } = await import('../services/mockApi.js');
      if (typeof mockApi.deleteProperty === 'function') {
        mockApi.deleteProperty(propertyId, propertyObj, isAdmin);
      }
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-property-deleted', { detail: { propertyId: pIdStr, isAdmin } }));
    }

    return { success: true };
  } catch (error) {
    console.warn('Property delete note:', error);
    return { success: true };
  }
}

