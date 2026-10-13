import { getCategoryBadgeLabel } from './categoryUtils.js';
import { extractCoordinates, resolvePlaceCoordinates, calculateDistanceKm } from '../services/locationProvider.js';
import { convertAreaToSqFt } from '../firebase/propertyService.js';

/**
 * Helper: Extract comprehensive location searchable blob
 */
export const extractLocationBlob = (item) => {
  if (!item) return '';
  const loc = item.location;
  const parts = [];
  if (typeof loc === 'string') {
    parts.push(loc);
  } else if (loc && typeof loc === 'object') {
    parts.push(
      loc.city, loc.locality, loc.subLocality, loc.mandal, loc.district,
      loc.state, loc.village, loc.colony, loc.road, loc.landmark,
      loc.address, loc.formattedAddress, loc.postalCode
    );
  }
  parts.push(
    item.city, item.locality, item.address, item.locationString,
    item.district, item.state, item.title, item.description
  );
  return parts.filter(Boolean).join(' ').toLowerCase();
};

/**
 * Pure search filter evaluator across property record
 */
export function matchesSearchFilters(p, searchState = {}) {
  if (!p) return false;

  // 1. Purpose filter (SALE vs RENT vs LEASE)
  if (searchState.purpose && searchState.purpose !== 'ALL' && searchState.purpose !== 'ANY') {
    const pPurpose = String(p.purpose || 'SALE').toUpperCase();
    const targetPurpose = String(searchState.purpose).toUpperCase();
    if (targetPurpose === 'RENT') {
      const isRental = pPurpose.includes('RENT') || String(p.priceDisplay || '').toLowerCase().includes('month') || String(p.category || '').toLowerCase().includes('rental');
      if (!isRental) return false;
    } else if (targetPurpose === 'LEASE') {
      const isLease = pPurpose.includes('LEASE') || String(p.category || '').toLowerCase().includes('lease');
      if (!isLease) return false;
    } else if (targetPurpose === 'SALE') {
      const isSale = pPurpose.includes('SALE') || pPurpose.includes('SELL') || (!pPurpose.includes('RENT') && !pPurpose.includes('LEASE'));
      if (!isSale) return false;
    }
  }

  // 2. Property Type filter
  if (searchState.propertyType && searchState.propertyType !== 'ALL' && searchState.propertyType !== 'ANY') {
    const pType = String(p.propertyType || p.type || '').toUpperCase();
    const pCat = String(p.category || p.title || '').toUpperCase();
    const targetType = String(searchState.propertyType).toUpperCase();
    const isCommercialProp = pType.includes('COMMERCIAL') || pCat.includes('COMMERCIAL') || pCat.includes('COMMERIC') || pCat.includes('OFFICE') || pCat.includes('SHOP');

    if (targetType === 'OPEN_PLOT' || targetType === 'PLOT') {
      if (isCommercialProp) return false;
      const isPlot = pType.includes('PLOT') || (pCat.includes('PLOT') && !pCat.includes('COMMERCIAL'));
      const isAgri = pType.includes('LAND') && (pCat.includes('AGRI') || pCat.includes('FARM'));
      if (!isPlot || isAgri) return false;
    } else if (targetType === 'HOUSE' || targetType === 'VILLA') {
      if (isCommercialProp) return false;
      const isHouse = pType.includes('HOUSE') || pType.includes('VILLA') || pCat.includes('HOUSE') || pCat.includes('VILLA') || pCat.includes('HOME');
      if (!isHouse) return false;
    } else if (targetType === 'APARTMENT' || targetType === 'FLAT') {
      if (isCommercialProp) return false;
      const isApt = pType.includes('APARTMENT') || pType.includes('FLAT') || pCat.includes('APARTMENT') || pCat.includes('FLAT');
      if (!isApt) return false;
    } else if (targetType === 'COMMERCIAL') {
      if (!isCommercialProp) return false;
    } else if (targetType === 'LAND' || targetType === 'AGRICULTURAL_LAND') {
      const isLand = pType.includes('LAND') || pCat.includes('LAND') || pType.includes('AGRICULTURAL') || pCat.includes('AGRI') || pCat.includes('FARM');
      if (!isLand) return false;
    } else if (targetType === 'OTHER') {
      if (!pType.includes('OTHER') && !pCat.includes('OTHER') && !pCat.includes('WAREHOUSE')) return false;
    }
  }

  // 3. Category string fallback check
  if (searchState.category && searchState.category !== 'All' && searchState.category !== 'ALL') {
    const targetCat = String(searchState.category).toLowerCase().trim();
    const pBadge = String(getCategoryBadgeLabel(p)).toLowerCase();

    let isCategoryMatch = false;

    if (pBadge === targetCat) {
      isCategoryMatch = true;
    } else {
      const pType = String(p.propertyType || p.type || '').toUpperCase();
      const pCat = String(p.category || '').toUpperCase();
      const pTitle = String(p.title || '').toUpperCase();
      const isCommercialProp = pType.includes('COMMERCIAL') || pCat.includes('COMMERCIAL') || pCat.includes('COMMERIC') || pCat.includes('OFFICE') || pCat.includes('SHOP');

      if (targetCat.includes('amaravathi') || targetCat.includes('lps')) {
        isCategoryMatch = (pCat.includes('AMARAVATHI') || pTitle.includes('AMARAVATHI') || pCat.includes('LPS') || pTitle.includes('LPS'));
      } else if (targetCat.includes('agricultural') || targetCat.includes('farm')) {
        isCategoryMatch = (pType.includes('LAND') || pCat.includes('AGRI') || pCat.includes('FARM') || pTitle.includes('AGRI') || pTitle.includes('FARM'));
      } else if (targetCat.includes('commercial') || targetCat.includes('commeric')) {
        isCategoryMatch = isCommercialProp;
      } else if (targetCat.includes('apartment') || targetCat.includes('flat')) {
        isCategoryMatch = !isCommercialProp && (pType.includes('APARTMENT') || pType.includes('FLAT') || pCat.includes('APARTMENT') || pCat.includes('FLAT') || pTitle.includes('APARTMENT') || pTitle.includes('FLAT'));
      } else if (targetCat.includes('house') || targetCat.includes('villa') || targetCat.includes('independent')) {
        isCategoryMatch = !isCommercialProp && (pType.includes('HOUSE') || pType.includes('VILLA') || pCat.includes('HOUSE') || pCat.includes('VILLA') || pTitle.includes('HOUSE') || pTitle.includes('VILLA'));
      } else if (targetCat.includes('city') && targetCat.includes('plot')) {
        const isPlot = (pType.includes('PLOT') || pCat.includes('PLOT'));
        const isCityOrColony = (pCat.includes('CITY') || pTitle.includes('CITY') || pCat.includes('COLONY') || pTitle.includes('COLONY') || pCat.includes('MUNICIPAL'));
        const isAmaravathi = (pCat.includes('AMARAVATHI') || pTitle.includes('AMARAVATHI') || pCat.includes('LPS') || pTitle.includes('LPS'));
        isCategoryMatch = !isCommercialProp && isPlot && isCityOrColony && !isAmaravathi;
      } else if (targetCat.includes('venture')) {
        const isPlot = (pType.includes('PLOT') || pCat.includes('PLOT') || pCat.includes('VENTURE') || pTitle.includes('VENTURE') || pCat.includes('LAYOUT'));
        const isAmaravathi = (pCat.includes('AMARAVATHI') || pTitle.includes('AMARAVATHI') || pCat.includes('LPS') || pTitle.includes('LPS'));
        const isCityPlot = (pBadge === 'open plot (city)' || (pCat.includes('CITY') && !pCat.includes('VENTURE')));
        isCategoryMatch = !isCommercialProp && isPlot && !isAmaravathi && !isCityPlot;
      } else if (targetCat.includes('other')) {
        isCategoryMatch = (pType.includes('OTHER') || pCat.includes('OTHER') || pTitle.includes('OTHER') || pCat.includes('WAREHOUSE'));
      }
    }

    if (!isCategoryMatch) {
      return false;
    }
  }

  // 4a. Location Search (State)
  if (searchState.state && searchState.state.trim()) {
    const stateVal = searchState.state.trim().toLowerCase();
    const blob = extractLocationBlob(p);
    if (!blob.includes(stateVal)) return false;
  }

  // 4b. Location Search (District)
  if (searchState.district && searchState.district.trim()) {
    const distVal = searchState.district.trim().toLowerCase();
    const blob = extractLocationBlob(p);
    if (!blob.includes(distVal)) return false;
  }

  // 4c. Location Search (City)
  if (searchState.city && searchState.city.trim()) {
    const cityTokens = searchState.city.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const blob = extractLocationBlob(p);
    const matches = cityTokens.some(tok => blob.includes(tok));
    if (!matches) return false;
  }

  // 4d. Location Search (Locality)
  if (searchState.locality && searchState.locality.trim()) {
    const locClean = searchState.locality.trim().toLowerCase();
    const locTokens = locClean.split(/[\s,]+/).filter(tok => tok.length > 1);
    const blob = extractLocationBlob(p);
    const directMatch = blob.includes(locClean);
    const tokenMatch = locTokens.length > 0 && locTokens.every(tok => blob.includes(tok));
    if (!directMatch && !tokenMatch) return false;
  }

  // 4e. Nearby Radius Search (Radius & Reference Place)
  if (searchState.radiusKm && Number(searchState.radiusKm) > 0) {
    const radiusNum = Number(searchState.radiusKm);
    let refLat = searchState.referenceLat != null ? Number(searchState.referenceLat) : null;
    let refLng = searchState.referenceLng != null ? Number(searchState.referenceLng) : null;

    if ((refLat == null || isNaN(refLat) || refLng == null || isNaN(refLng)) && searchState.referencePlace && searchState.referencePlace.trim()) {
      const resolved = resolvePlaceCoordinates(searchState.referencePlace.trim());
      if (resolved) {
        refLat = resolved.lat;
        refLng = resolved.lng;
      }
    }

    if ((refLat == null || isNaN(refLat)) && searchState.userLat != null && searchState.userLng != null) {
      refLat = Number(searchState.userLat);
      refLng = Number(searchState.userLng);
    }

    if (refLat != null && !isNaN(refLat) && refLng != null && !isNaN(refLng)) {
      const pCoords = extractCoordinates(p);
      if (!isNaN(pCoords.lat) && !isNaN(pCoords.lng)) {
        const distKm = calculateDistanceKm(refLat, refLng, pCoords.lat, pCoords.lng);
        if (distKm > radiusNum) return false;
      }
    } else if (searchState.referencePlace && searchState.referencePlace.trim()) {
      const placeTokens = searchState.referencePlace.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const blob = extractLocationBlob(p);
      const matches = placeTokens.some(tok => blob.includes(tok));
      if (!matches) return false;
    }
  } else if (searchState.referencePlace && searchState.referencePlace.trim()) {
    const placeTokens = searchState.referencePlace.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const blob = extractLocationBlob(p);
    const matches = placeTokens.some(tok => blob.includes(tok));
    if (!matches) return false;
  }

  // 5. Search Query keyword token check
  if (searchState.query && searchState.query.trim()) {
    const q = searchState.query.trim().toLowerCase();
    if (q !== 'near me') {
      const title = String(p.title || '').toLowerCase();
      const desc = String(p.description || '').toLowerCase();
      const blob = extractLocationBlob(p);
      const cat = String(p.category || p.propertyType || '').toLowerCase();
      const refId = String(p.referenceId || p.propertyId || p.id || '').toLowerCase();

      const fullBlob = [title, desc, blob, cat, refId].join(' ');
      const tokens = q.split(/\s+/).filter(Boolean);
      const matches = tokens.every(token => fullBlob.includes(token));
      if (!matches) return false;
    }
  }

  // 6. Price range
  if (searchState.minPrice != null && searchState.minPrice !== '' && Number(searchState.minPrice) >= 0) {
    const price = Number(p.price) || 0;
    if (price > 0 && price < Number(searchState.minPrice)) return false;
  }
  if (searchState.maxPrice != null && searchState.maxPrice !== '' && Number(searchState.maxPrice) >= 0) {
    const price = Number(p.price) || 0;
    if (price > 0 && price > Number(searchState.maxPrice)) return false;
  }

  // 7. Area range (Multi-unit conversion to standard Sq Ft)
  const currentUnit = searchState.areaUnit || 'sq ft';
  const rawMinArea = (searchState.minArea != null && searchState.minArea !== '')
    ? Number(searchState.minArea)
    : ((searchState.minAreaSqFt != null && searchState.minAreaSqFt !== '') ? Number(searchState.minAreaSqFt) : null);
  const rawMaxArea = (searchState.maxArea != null && searchState.maxArea !== '')
    ? Number(searchState.maxArea)
    : ((searchState.maxAreaSqFt != null && searchState.maxAreaSqFt !== '') ? Number(searchState.maxAreaSqFt) : null);

  if (rawMinArea != null || rawMaxArea != null) {
    const propUnit = p.areaUnit || p.specs?.areaUnit || 'sq ft';
    const propRawArea = Number(p.area) || Number(p.areaSqFt) || 0;
    const propAreaSqFt = Number(p.areaSqFt) || convertAreaToSqFt(propRawArea, propUnit);

    const filterMinSqFt = rawMinArea != null ? convertAreaToSqFt(rawMinArea, currentUnit) : null;
    const filterMaxSqFt = rawMaxArea != null ? convertAreaToSqFt(rawMaxArea, currentUnit) : null;

    if (filterMinSqFt != null && propAreaSqFt > 0 && propAreaSqFt < filterMinSqFt) return false;
    if (filterMaxSqFt != null && propAreaSqFt > 0 && propAreaSqFt > filterMaxSqFt) return false;
  }

  // 8. Bedrooms / BHK
  if (searchState.bedrooms && searchState.bedrooms !== 'ANY' && searchState.bedrooms !== 'ALL') {
    const targetBhk = Number(searchState.bedrooms);
    if (!isNaN(targetBhk) && targetBhk > 0) {
      const pBhk = Number(p.bedrooms || p.bhk || p.specifications?.bedrooms || 0);
      if (pBhk < targetBhk) return false;
    }
  }

  // 9. Facing Direction
  if (searchState.facing && searchState.facing !== 'ANY' && searchState.facing !== 'ALL') {
    const targetFacing = String(searchState.facing).toUpperCase();
    const pFacing = String(p.facing || p.specifications?.facing || '').toUpperCase();
    if (pFacing && !pFacing.includes(targetFacing)) return false;
  }

  // 10. Furnishing Status
  if (searchState.furnishing && searchState.furnishing !== 'ANY' && searchState.furnishing !== 'ALL') {
    const targetFurnishing = String(searchState.furnishing).toUpperCase();
    const pFurnishing = String(p.furnishing || p.furnishingStatus || p.specifications?.furnishing || '').toUpperCase();
    if (pFurnishing && !pFurnishing.includes(targetFurnishing)) return false;
  }

  // 11. Amenities
  if (Array.isArray(searchState.amenities) && searchState.amenities.length > 0) {
    const pAmenities = (p.amenities || []).map(a => String(a).toLowerCase());
    const hasAll = searchState.amenities.every(req =>
      pAmenities.some(pa => pa.includes(String(req).toLowerCase()))
    );
    if (!hasAll) return false;
  }

  return true;
}
