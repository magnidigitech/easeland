/**
 * EaseLand Public Property Native Search Query Planner Engine (Block 16A Final Precision Implementation)
 * Enforces strict query-level security: listingStatus == LIVE & isPublished == true.
 * Executes native Firestore structured queries, deterministic cursor pagination,
 * collection-level public media isolation, and bounded geohash proximity discovery.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs
} from 'firebase/firestore';
import { db } from './config.js';
import { ListingStatus, MediaStatus, Purpose, PropertyType } from './schema.js';
import { formatFirestoreError } from './userService.js';
import { encodeGeohash, convertAreaToSqFt } from './propertyService.js';

export { convertAreaToSqFt, encodeGeohash };

/**
 * Calculate Spherical Distance between two coordinates in kilometers (Haversine formula)
 */
export function calculateSphericalDistanceKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return Infinity;

  const R = 6371; // Earth's mean radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extract strictly ONE public-safe approved photo thumbnail reference
 */
export function getApprovedPrimaryThumbnail(mediaArray = []) {
  if (!Array.isArray(mediaArray) || mediaArray.length === 0) return null;

  // 1. Try Approved Primary Photo
  const primaryApproved = mediaArray.find(
    m => m && m.isPrimary && (m.verificationStatus === MediaStatus.APPROVED || !m.verificationStatus) && (m.type === 'PHOTO' || m.mediaType === 'PHOTO')
  );
  if (primaryApproved && (primaryApproved.publicUrl || primaryApproved.url)) {
    return primaryApproved.publicUrl || primaryApproved.url;
  }

  // 2. Try First Approved Photo
  const firstApproved = mediaArray.find(
    m => m && (m.verificationStatus === MediaStatus.APPROVED || !m.verificationStatus) && (m.publicUrl || m.url)
  );
  if (firstApproved && (firstApproved.publicUrl || firstApproved.url)) {
    return firstApproved.publicUrl || firstApproved.url;
  }

  return null;
}

/**
 * Check if requested sort mode is compatible with active range filters.
 * Under Cloud Firestore rules, range filters on field X require field X as the primary orderBy field.
 */
export function validateSortCompatibility(requestedSort = 'newest', hasPriceRange = false, hasAreaRange = false) {
  if (hasPriceRange && requestedSort === 'newest') {
    return {
      compatible: false,
      activeSort: 'price_asc',
      reason: 'Newest First is unavailable when custom price range filters are active due to database query rules.',
      availableSorts: [
        { id: 'price_asc', label: 'Price: Low to High' },
        { id: 'price_desc', label: 'Price: High to Low' }
      ]
    };
  }

  if (hasAreaRange && requestedSort === 'newest') {
    return {
      compatible: false,
      activeSort: 'area_asc',
      reason: 'Newest First is unavailable when custom area range filters are active due to database query rules.',
      availableSorts: [
        { id: 'area_asc', label: 'Area: Small to Large' },
        { id: 'area_desc', label: 'Area: Large to Small' }
      ]
    };
  }

  return {
    compatible: true,
    activeSort: requestedSort,
    reason: null,
    availableSorts: [
      { id: 'newest', label: 'Newest First' },
      { id: 'price_asc', label: 'Price: Low to High' },
      { id: 'price_desc', label: 'Price: High to Low' },
      { id: 'area_asc', label: 'Area: Small to Large' },
      { id: 'area_desc', label: 'Area: Large to Small' }
    ]
  };
}

/**
 * Calculate multi-range Geohash bounding box query ranges covering a center point and radius.
 * Based on official GeoFire / Firebase geohash query-bound algorithm.
 * Dynamically determines precision based on bounding box dimensions and enumerates all
 * intersecting grid cells, merging them into minimal contiguous lexicographical range pairs.
 */
export function geohashQueryBounds(centerLat, centerLng, radiusKm) {
  const lat = Number(centerLat);
  const lng = Number(centerLng);
  const radius = Number(radiusKm);

  if (isNaN(lat) || isNaN(lng) || isNaN(radius) || radius <= 0) return [];

  const radiusMeters = radius * 1000;

  // 1. Calculate Latitude and Longitude Deltas
  const latKmPerDegree = 111.32;
  const lngKmPerDegree = 111.32 * Math.cos(lat * (Math.PI / 180));

  const dLat = radius / latKmPerDegree;
  const dLng = radius / (Math.abs(lngKmPerDegree) || 1);

  const minLat = Math.max(-90, lat - dLat);
  const maxLat = Math.min(90, lat + dLat);

  // 2. Determine Optimal Geohash Precision mathematically
  // Latitude cell height in meters for precision p (1 to 10):
  // cellHeightMeters(p) = (Math.PI * 6371000) / 2^(Math.floor(5 * p / 2))
  let precision = 1;
  const R_earth = 6371000;
  for (let p = 1; p <= 10; p++) {
    const numLatBits = Math.floor((5 * p) / 2);
    const cellHeightMeters = (Math.PI * R_earth) / Math.pow(2, numLatBits);
    if (cellHeightMeters >= radiusMeters / 2) {
      precision = p;
    } else {
      break;
    }
  }

  // 3. Handle Longitude Wraparound at International Date Line (+/- 180 degrees)
  const lngIntervals = [];
  const rawMinLng = lng - dLng;
  const rawMaxLng = lng + dLng;

  if (rawMinLng < -180) {
    lngIntervals.push([-180, rawMaxLng]);
    lngIntervals.push([360 + rawMinLng, 180]);
  } else if (rawMaxLng > 180) {
    lngIntervals.push([rawMinLng, 180]);
    lngIntervals.push([-180, rawMaxLng - 360]);
  } else {
    lngIntervals.push([rawMinLng, rawMaxLng]);
  }

  // Cell grid dimension bits for selected precision
  const numLatBits = Math.floor((5 * precision) / 2);
  const numLngBits = Math.ceil((5 * precision) / 2);

  const latHeightDeg = 180 / Math.pow(2, numLatBits);
  const lngWidthDeg = 360 / Math.pow(2, numLngBits);

  const prefixSet = new Set();

  // 4. Enumerate ALL grid cells intersecting the bounding box across latitude and longitude intervals
  for (const [subMinLng, subMaxLng] of lngIntervals) {
    const minLatIdx = Math.max(0, Math.floor(((minLat + 90) / 180) * Math.pow(2, numLatBits)));
    const maxLatIdx = Math.min(Math.pow(2, numLatBits) - 1, Math.floor(((maxLat + 90) / 180) * Math.pow(2, numLatBits)));

    const minLngIdx = Math.max(0, Math.floor(((subMinLng + 180) / 360) * Math.pow(2, numLngBits)));
    const maxLngIdx = Math.min(Math.pow(2, numLngBits) - 1, Math.floor(((subMaxLng + 180) / 360) * Math.pow(2, numLngBits)));

    for (let i = minLatIdx; i <= maxLatIdx; i++) {
      for (let j = minLngIdx; j <= maxLngIdx; j++) {
        const cellLat = -90 + (i + 0.5) * latHeightDeg;
        const cellLng = -180 + (j + 0.5) * lngWidthDeg;
        const hash = encodeGeohash(cellLat, cellLng, precision);
        if (hash) prefixSet.add(hash);
      }
    }
  }

  // 5. Convert prefixes into minimum contiguous lexicographical range pairs
  const prefixes = Array.from(prefixSet).sort();
  if (prefixes.length === 0) return [];

  const ranges = [];
  let currentLower = prefixes[0];
  let currentUpper = prefixes[0] + '~';

  for (let k = 1; k < prefixes.length; k++) {
    const p = prefixes[k];
    if (p <= currentUpper) {
      currentUpper = p + '~';
    } else {
      ranges.push({ lower: currentLower, upper: currentUpper });
      currentLower = p;
      currentUpper = p + '~';
    }
  }
  ranges.push({ lower: currentLower, upper: currentUpper });

  return ranges;
}

/**
 * Main Public Search Query Planner Engine
 * Strictly enforces listingStatus == LIVE AND isPublished == true.
 * Executes native Firestore range queries, deterministic [primaryField, __name__] cursor pagination,
 * collection-level public media isolation, and bounded geohash radius discovery.
 */
export async function searchPublicProperties({
  searchState = {},
  pageSize = 12,
  lastDoc = null,
  lastTuple = null
} = {}) {
  try {
    const {
      purpose,
      propertyType,
      city,
      minPrice,
      maxPrice,
      minAreaSqFt,
      maxAreaSqFt,
      bedrooms,
      bathrooms,
      amenities = [],
      radiusKm,
      referenceLat,
      referenceLng,
      sortBy = 'newest'
    } = searchState;

    const hasPriceRange = minPrice != null || maxPrice != null;
    const hasAreaRange = minAreaSqFt != null || maxAreaSqFt != null;

    // Validate sort compatibility without silent sort mutation
    const sortCheck = validateSortCompatibility(sortBy, hasPriceRange, hasAreaRange);
    const activeSortMode = sortCheck.activeSort;

    // =========================================================================
    // BRANCH A: PROXIMITY RADIUS SEARCH (Bounded Result Window)
    // =========================================================================
    if (radiusKm && referenceLat != null && referenceLng != null) {
      const radiusNum = Number(radiusKm);
      const latNum = Number(referenceLat);
      const lngNum = Number(referenceLng);

      // Compute multi-range geohash query bounds covering center + boundary crossings
      const ranges = geohashQueryBounds(latNum, lngNum, radiusNum);
      const candidateMap = new Map();

      // Execute range subqueries and deduplicate candidates across overlapping ranges
      for (const range of ranges) {
        let geoQuery = query(
          collection(db, 'properties'),
          where('listingStatus', '==', ListingStatus.LIVE),
          where('isPublished', '==', true),
          where('geohash', '>=', range.lower),
          where('geohash', '<=', range.upper),
          orderBy('geohash', 'asc'),
          orderBy('__name__', 'asc')
        );

        const snap = await getDocs(geoQuery);
        snap.docs.forEach(d => {
          const data = d.data();
          const pId = data.propertyId || d.id;
          if (!candidateMap.has(pId)) {
            candidateMap.set(pId, { docSnap: d, data });
          }
        });
      }

      const rawCandidates = Array.from(candidateMap.values());

      // 1. Calculate exact Haversine spherical distance for ALL retrieved candidates
      const candidatesWithDistance = rawCandidates.map(c => {
        const itemLat = c.data.location?.geoPoint?.latitude || c.data.location?.lat;
        const itemLng = c.data.location?.geoPoint?.longitude || c.data.location?.lng;
        const distKm = (itemLat != null && itemLng != null)
          ? calculateSphericalDistanceKm(latNum, lngNum, Number(itemLat), Number(itemLng))
          : Infinity;
        return { ...c, distKm };
      });

      // 2. Filter strictly by Haversine radius membership
      let radiusMatched = candidatesWithDistance.filter(c => c.distKm <= radiusNum);

      // 3. CRITICAL PROXIMITY FIX: Sort by Haversine Distance ASCENDING FIRST
      // Guarantees Property A (200m away) is ranked ahead of Property B (5km away), regardless of geohash string sort
      radiusMatched.sort((a, b) => a.distKm - b.distKm);

      // 4. Apply Global Candidate Safety Ceiling of 250 items on distance-sorted candidates
      const GLOBAL_CANDIDATE_CEILING = 250;
      const candidateLimitReached = radiusMatched.length >= GLOBAL_CANDIDATE_CEILING;
      const boundedCandidatePool = radiusMatched.slice(0, GLOBAL_CANDIDATE_CEILING);

      // 5. Additional in-memory filtering for structured search fields on the bounded candidates
      let filteredCandidates = boundedCandidatePool;
      if (purpose && purpose !== 'ALL') {
        filteredCandidates = filteredCandidates.filter(c => c.data.purpose === purpose);
      }
      if (propertyType && propertyType !== 'ALL') {
        filteredCandidates = filteredCandidates.filter(c => c.data.propertyType === propertyType);
      }
      if (city && city.trim()) {
        filteredCandidates = filteredCandidates.filter(c => String(c.data.location?.city || '').toLowerCase() === city.trim().toLowerCase());
      }
      if (hasPriceRange) {
        filteredCandidates = filteredCandidates.filter(c => {
          const p = Number(c.data.price) || 0;
          if (minPrice != null && p < Number(minPrice)) return false;
          if (maxPrice != null && p > Number(maxPrice)) return false;
          return true;
        });
      }
      if (hasAreaRange) {
        filteredCandidates = filteredCandidates.filter(c => {
          const a = Number(c.data.areaSqFt) || convertAreaToSqFt(c.data.area, c.data.areaUnit);
          if (minAreaSqFt != null && a < Number(minAreaSqFt)) return false;
          if (maxAreaSqFt != null && a > Number(maxAreaSqFt)) return false;
          return true;
        });
      }

      const paginatedSlice = filteredCandidates.slice(0, pageSize);
      const newLastDoc = paginatedSlice.length > 0 ? paginatedSlice[paginatedSlice.length - 1].docSnap : null;

      const properties = paginatedSlice.map(c => {
        const d = c.data;
        const mediaList = Array.isArray(d.publicApprovedMedia) ? d.publicApprovedMedia : d.media || [];
        return {
          propertyId: d.propertyId || c.docSnap.id,
          referenceId: d.referenceId || '',
          title: d.title || '',
          propertyType: d.propertyType || '',
          purpose: d.purpose || 'SALE',
          price: Number(d.price) || 0,
          priceDisplay: d.priceDisplay || '',
          area: Number(d.area) || 0,
          areaDisplay: d.areaDisplay || '',
          areaSqFt: Number(d.areaSqFt) || 0,
          location: d.location || null,
          isPlatformVerified: Boolean(d.isPlatformVerified),
          approvedThumbnail: getApprovedPrimaryThumbnail(mediaList),
          createdAt: d.createdAt,
          distKm: Math.round(c.distKm * 100) / 100
        };
      });

      return {
        success: true,
        properties,
        lastDoc: newLastDoc,
        hasMore: filteredCandidates.length > pageSize,
        candidateLimitReached,
        disclosureMessage: candidateLimitReached
          ? `Showing nearest properties within ${radiusNum} km radius (candidate limit reached).`
          : `Showing properties within ${radiusNum} km radius.`,
        sortCompatibility: sortCheck
      };
    }

    // =========================================================================
    // BRANCH B: NATIVE FIRESTORE QUERY PLANNER ENGINE
    // =========================================================================
    let q = query(
      collection(db, 'properties'),
      where('listingStatus', '==', ListingStatus.LIVE),
      where('isPublished', '==', true)
    );

    // Equality Filters
    if (purpose && purpose !== 'ALL' && Object.values(Purpose).includes(purpose)) {
      q = query(q, where('purpose', '==', purpose));
    }
    if (propertyType && propertyType !== 'ALL' && Object.values(PropertyType).includes(propertyType)) {
      q = query(q, where('propertyType', '==', propertyType));
    }
    if (city && city.trim()) {
      q = query(q, where('location.city', '==', city.trim()));
    }

    // Bedrooms exact vs range equality
    if (bedrooms && bedrooms !== 'ANY') {
      if (String(bedrooms).includes('+')) {
        const bNum = Number(String(bedrooms).replace('+', ''));
        q = query(q, where('bedroomsNum', '>=', bNum));
      } else {
        q = query(q, where('bedroomsNum', '==', Number(bedrooms)));
      }
    }

    // Bathrooms exact vs range equality
    if (bathrooms && bathrooms !== 'ANY') {
      if (String(bathrooms).includes('+')) {
        const bNum = Number(String(bathrooms).replace('+', ''));
        q = query(q, where('bathroomsNum', '>=', bNum));
      } else {
        q = query(q, where('bathroomsNum', '==', Number(bathrooms)));
      }
    }

    // Amenities Map Boolean Query (Max 2 required)
    if (Array.isArray(amenities) && amenities.length > 0) {
      const top5Canonical = ['gatedCommunity', 'swimmingPool', 'clubhouse', 'powerBackup', 'carParking'];
      const activeAmenities = amenities.slice(0, 2);
      activeAmenities.forEach(am => {
        const canonicalKey = top5Canonical.find(k => k.toLowerCase() === String(am).toLowerCase().replace(/[^a-z]/g, ''));
        if (canonicalKey) {
          q = query(q, where(`amenitiesMap.${canonicalKey}`, '==', true));
        } else {
          q = query(q, where('amenities', 'array-contains', am));
        }
      });
    }

    // Structured Range Inequality Filters
    if (minPrice != null) {
      q = query(q, where('price', '>=', Number(minPrice)));
    }
    if (maxPrice != null) {
      q = query(q, where('price', '<=', Number(maxPrice)));
    }
    if (minAreaSqFt != null) {
      q = query(q, where('areaSqFt', '>=', Number(minAreaSqFt)));
    }
    if (maxAreaSqFt != null) {
      q = query(q, where('areaSqFt', '<=', Number(maxAreaSqFt)));
    }

    // Apply Pure Sort Intent Sequence & Deterministic __name__ Tie-Breaker
    switch (activeSortMode) {
      case 'price_asc':
        q = query(q, orderBy('price', 'asc'), orderBy('__name__', 'asc'));
        break;
      case 'price_desc':
        q = query(q, orderBy('price', 'desc'), orderBy('__name__', 'desc'));
        break;
      case 'area_asc':
        q = query(q, orderBy('areaSqFt', 'asc'), orderBy('__name__', 'asc'));
        break;
      case 'area_desc':
        q = query(q, orderBy('areaSqFt', 'desc'), orderBy('__name__', 'desc'));
        break;
      case 'bedrooms_asc':
        q = query(q, orderBy('bedroomsNum', 'asc'), orderBy('__name__', 'asc'));
        break;
      case 'bathrooms_asc':
        q = query(q, orderBy('bathroomsNum', 'asc'), orderBy('__name__', 'asc'));
        break;
      case 'newest':
      default:
        q = query(q, orderBy('createdAt', 'desc'), orderBy('__name__', 'desc'));
        break;
    }

    q = query(q, limit(pageSize));

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    } else if (Array.isArray(lastTuple) && lastTuple.length > 0) {
      q = query(q, startAfter(...lastTuple));
    }

    const snap = await getDocs(q);
    const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    const properties = snap.docs.map(docSnap => {
      const d = docSnap.data();
      const mediaList = Array.isArray(d.publicApprovedMedia) ? d.publicApprovedMedia : d.media || [];
      return {
        propertyId: d.propertyId || docSnap.id,
        referenceId: d.referenceId || '',
        title: d.title || '',
        propertyType: d.propertyType || '',
        purpose: d.purpose || 'SALE',
        price: Number(d.price) || 0,
        priceDisplay: d.priceDisplay || '',
        area: Number(d.area) || 0,
        areaDisplay: d.areaDisplay || '',
        areaSqFt: Number(d.areaSqFt) || 0,
        bedroomsNum: Number(d.bedroomsNum) || 0,
        bathroomsNum: Number(d.bathroomsNum) || 0,
        location: d.location || null,
        isPlatformVerified: Boolean(d.isPlatformVerified),
        approvedThumbnail: getApprovedPrimaryThumbnail(mediaList),
        createdAt: d.createdAt
      };
    });

    return {
      success: true,
      properties,
      lastDoc: newLastDoc,
      hasMore: snap.docs.length === pageSize,
      candidateLimitReached: false,
      disclosureMessage: null,
      sortCompatibility: sortCheck
    };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}
