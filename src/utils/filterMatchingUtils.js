import { getCategoryBadgeLabel } from './categoryUtils.js';
import { extractCoordinates, resolvePlaceCoordinates, calculateDistanceKm } from '../services/locationProvider.js';
import { convertAreaToSqFt } from '../firebase/propertyService.js';
import { parseNaturalLanguageQuery, REAL_ESTATE_STOPWORDS, getSemanticSynonyms } from '../firebase/searchParser.js';

/**
 * Helper to check if a property is deleted (by Admin or Owner)
 */
export function isPropertyDeleted(p) {
  if (!p) return true;
  if (p.isDeleted === true || p.deletedByAdmin === true || p.deletionType === 'ADMIN_DELETED') return true;
  const st = String(p.status || p.listingStatus || p.listing_status || '').toUpperCase();
  const lst = String(p.listingStatus || p.listing_status || '').toUpperCase();
  const plst = String(p.listing_status || '').toUpperCase();
  if (st === 'DELETED' || st === 'DELETED_BY_ADMIN' || lst === 'DELETED' || lst === 'DELETED_BY_ADMIN' || plst === 'DELETED' || plst === 'DELETED_BY_ADMIN') return true;

  if (typeof window !== 'undefined') {
    try {
      const pId1 = String(p.id || '').toLowerCase().trim();
      const pId2 = String(p.propertyId || '').toLowerCase().trim();
      const pId3 = String(p.referenceId || '').toLowerCase().trim();
      const num1 = pId1.replace(/^(el-prop-|prop-)/i, '');
      const num2 = pId2.replace(/^(el-prop-|prop-)/i, '');
      const num3 = pId3.replace(/^(el-prop-|prop-)/i, '');
      const normTitle = String(p.title || '').toLowerCase().trim();

      const rawDel = localStorage.getItem('easeland_deleted_properties');
      if (rawDel) {
        const delArr = JSON.parse(rawDel);
        const isMatch = delArr.some(d => {
          const dStr = String(d || '').toLowerCase().trim();
          const dNum = dStr.replace(/^(el-prop-|prop-)/i, '');
          return (
            (dStr && (dStr === pId1 || dStr === pId2 || dStr === pId3)) ||
            (dNum && ((num1 && dNum === num1) || (num2 && dNum === num2) || (num3 && dNum === num3))) ||
            (normTitle && dStr === normTitle)
          );
        });
        if (isMatch) return true;
      }

      const rawAdminDel = localStorage.getItem('easeland_admin_deleted_properties');
      if (rawAdminDel) {
        const adminDelArr = JSON.parse(rawAdminDel);
        const isMatchAdmin = adminDelArr.some(item => {
          if (!item) return false;
          const iId1 = String(item.id || '').toLowerCase().trim();
          const iId2 = String(item.propertyId || '').toLowerCase().trim();
          const iId3 = String(item.referenceId || '').toLowerCase().trim();
          const iNum1 = iId1.replace(/^(el-prop-|prop-)/i, '');
          const iNum2 = iId2.replace(/^(el-prop-|prop-)/i, '');
          const iNum3 = iId3.replace(/^(el-prop-|prop-)/i, '');
          const iTitle = String(item.title || '').toLowerCase().trim();
          return (
            (iId1 && (iId1 === pId1 || iId1 === pId2 || iId1 === pId3)) ||
            (iId2 && (iId2 === pId1 || iId2 === pId2 || iId2 === pId3)) ||
            (iId3 && (iId3 === pId1 || iId3 === pId2 || iId3 === pId3)) ||
            (iNum1 && ((num1 && iNum1 === num1) || (num2 && iNum1 === num2) || (num3 && iNum1 === num3))) ||
            (iNum2 && ((num1 && iNum2 === num1) || (num2 && iNum2 === num2) || (num3 && iNum2 === num3))) ||
            (iNum3 && ((num1 && iNum3 === num1) || (num2 && iNum3 === num2) || (num3 && iNum3 === num3))) ||
            (iTitle && normTitle && iTitle === normTitle)
          );
        });
        if (isMatchAdmin) return true;
      }
    } catch (e) {}
  }

  return false;
}

/**
 * Dynamic check for property public visibility (Admin approved, LIVE, not blocked/draft/deleted/under audit)
 */
export function isPropertyPubliclyVisible(p) {
  if (!p) return false;
  if (isPropertyDeleted(p)) return false;

  // Strict check on published flag
  if (p.isPublished === false || p.is_published === false) return false;

  const st = String(p.status || p.listingStatus || p.listing_status || '').toUpperCase();
  const lst = String(p.listingStatus || p.listing_status || '').toUpperCase();
  const plst = String(p.listing_status || '').toUpperCase();
  const vst = String(p.verificationStatus || '').toUpperCase();

  const isApproved = p.adminApprovalStatus === 'APPROVED' ||
                     p.approvalStatus === 'APPROVED' ||
                     p.isApproved === true ||
                     vst === 'PLATFORM VERIFIED' ||
                     vst === 'VERIFIED' ||
                     vst === 'APPROVED' ||
                     p.isPlatformVerified === true;

  const isLive = st === 'LIVE' ||
                 st === 'APPROVED_LIVE' ||
                 st === 'APPROVED' ||
                 st === 'PLATFORM VERIFIED' ||
                 st === 'VERIFIED' ||
                 lst === 'LIVE' ||
                 lst === 'APPROVED_LIVE' ||
                 lst === 'APPROVED' ||
                 lst === 'PLATFORM VERIFIED' ||
                 lst === 'VERIFIED' ||
                 plst === 'LIVE' ||
                 plst === 'APPROVED_LIVE' ||
                 plst === 'APPROVED' ||
                 plst === 'PLATFORM VERIFIED' ||
                 plst === 'VERIFIED';

  const isBlocked = st === 'REJECTED' ||
                    st === 'DRAFT' ||
                    st === 'DELETED' ||
                    st === 'DELETED_BY_ADMIN' ||
                    st === 'CHANGES_REQUIRED' ||
                    st === 'CHANGES_REQUESTED' ||
                    st === 'PENDING_VERIFICATION' ||
                    st === 'UNDER_REVIEW' ||
                    st === 'PENDING_AUDIT' ||
                    st === 'UNDER_AUDIT' ||
                    st === 'PENDING' ||
                    st === 'SUBMITTED' ||
                    st === 'IN_AUDIT' ||
                    lst === 'REJECTED' ||
                    lst === 'DRAFT' ||
                    lst === 'DELETED' ||
                    lst === 'DELETED_BY_ADMIN' ||
                    lst === 'CHANGES_REQUIRED' ||
                    lst === 'CHANGES_REQUESTED' ||
                    lst === 'PENDING_VERIFICATION' ||
                    lst === 'UNDER_REVIEW' ||
                    lst === 'PENDING_AUDIT' ||
                    lst === 'UNDER_AUDIT' ||
                    lst === 'PENDING' ||
                    lst === 'SUBMITTED' ||
                    lst === 'IN_AUDIT' ||
                    plst === 'REJECTED' ||
                    plst === 'DRAFT' ||
                    plst === 'DELETED' ||
                    plst === 'DELETED_BY_ADMIN' ||
                    plst === 'PENDING_VERIFICATION' ||
                    plst === 'UNDER_REVIEW' ||
                    p.isDeleted === true ||
                    p.deletedByAdmin === true ||
                    p.isBlocked === true;

  if (isBlocked) return false;
  return isLive || isApproved;
}

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

// Canonical Amenity Matching Dictionary & Semantic Rules
export const AMENITY_MATCH_RULES = [
  {
    keys: ['gated_community', 'gatedcommunity', 'gated'],
    ids: ['GATED_COMMUNITY'],
    labels: ['gated community', 'gated community layout', 'gated layout', 'gated township'],
    mapKeys: ['gatedCommunity', 'GATED_COMMUNITY', 'gated_community']
  },
  {
    keys: ['24/7 security', 'security_24x7', 'security24x7', '24x7 security', 'security', 'cctv'],
    ids: ['SECURITY_24X7', 'CCTV_SURVEILLANCE'],
    labels: ['24/7 security', '24/7 security guards', 'security guards', 'cctv camera surveillance', 'security', 'cctv'],
    mapKeys: ['security', 'security24x7', 'SECURITY_24X7', 'cctv', 'cctvSurveillance']
  },
  {
    keys: ['water supply', 'water_supply', 'water_supply_24x7', 'watersupply', 'water'],
    ids: ['WATER_SUPPLY_24X7'],
    labels: ['water supply', '24/7 municipal & borewell water', 'borewell water', 'municipal water', 'drinking water', 'water'],
    mapKeys: ['waterSupply', 'waterSupply24x7', 'WATER_SUPPLY_24X7', 'water']
  },
  {
    keys: ['electricity connection', 'electricity', 'electricity_connection', 'power', 'eb connection'],
    ids: ['POWER_BACKUP'],
    labels: ['electricity connection', 'electricity', 'power backup', '100% generator power backup', 'power'],
    mapKeys: ['electricity', 'electricityConnection', 'powerBackup', 'POWER_BACKUP']
  },
  {
    keys: ['power backup', 'power_backup', 'powerbackup', 'generator'],
    ids: ['POWER_BACKUP'],
    labels: ['power backup', '100% generator power backup', 'generator power backup', 'generator', 'ups'],
    mapKeys: ['powerBackup', 'POWER_BACKUP']
  },
  {
    keys: ['clubhouse', 'club_house', 'club house'],
    ids: ['CLUBHOUSE'],
    labels: ['clubhouse', 'residents clubhouse & event hall', 'club house', 'community hall'],
    mapKeys: ['clubhouse', 'clubHouse', 'CLUBHOUSE']
  },
  {
    keys: ['swimming pool', 'swimming_pool', 'swimmingpool', 'pool'],
    ids: ['SWIMMING_POOL'],
    labels: ['swimming pool', 'pool'],
    mapKeys: ['swimmingPool', 'SWIMMING_POOL']
  },
  {
    keys: ['gym', 'gymnasium', 'fitness'],
    ids: ['GYMNASIUM'],
    labels: ['gym', 'gymnasium', 'equipped fitness gym', 'fitness gym', 'health club'],
    mapKeys: ['gym', 'gymnasium', 'GYMNASIUM']
  },
  {
    keys: ['park', 'children_play_area', 'children play area', 'play area', 'garden'],
    ids: ['CHILDREN_PLAY_AREA'],
    labels: ['park', 'children’s play area & park', 'childrens play area & park', 'children play area', 'play area', 'kids park', 'garden'],
    mapKeys: ['park', 'childrenPlayArea', 'CHILDREN_PLAY_AREA', 'garden']
  },
  {
    keys: ['car parking', 'covered_parking', 'parking', 'car_parking'],
    ids: ['COVERED_PARKING'],
    labels: ['car parking', 'reserved covered car parking', 'covered parking', 'parking'],
    mapKeys: ['carParking', 'coveredParking', 'COVERED_PARKING', 'parking']
  },
  {
    keys: ['lift', 'elevator', 'lift_elevator'],
    ids: ['LIFT_ELEVATOR'],
    labels: ['lift', 'high-speed elevators / lifts', 'elevator', 'elevators', 'lifts'],
    mapKeys: ['lift', 'elevator', 'liftElevator', 'LIFT_ELEVATOR']
  },
  {
    keys: ['boundary wall', 'boundary_wall', 'compound wall'],
    ids: ['BOUNDARY_WALL'],
    labels: ['compound / boundary wall built', 'boundary wall', 'compound wall'],
    mapKeys: ['boundaryWall', 'BOUNDARY_WALL']
  },
  {
    keys: ['corner plot', 'corner_plot'],
    ids: ['CORNER_PLOT'],
    labels: ['corner plot (dual approach road)', 'corner plot'],
    mapKeys: ['cornerPlot', 'CORNER_PLOT']
  },
  {
    keys: ['wide approach road', 'wide_approach_road', 'wide road'],
    ids: ['WIDE_APPROACH_ROAD'],
    labels: ['wide blacktop approach road', 'wide road', 'approach road'],
    mapKeys: ['wideApproachRoad', 'WIDE_APPROACH_ROAD']
  },
  {
    keys: ['high speed internet', 'high_speed_internet', 'internet', 'wifi'],
    ids: ['HIGH_SPEED_INTERNET'],
    labels: ['fiber broadband internet ready', 'internet', 'wifi'],
    mapKeys: ['internet', 'highSpeedInternet', 'HIGH_SPEED_INTERNET']
  },
  {
    keys: ['central ac', 'central_ac', 'ac'],
    ids: ['CENTRAL_AC'],
    labels: ['central air conditioning', 'central ac', 'ac'],
    mapKeys: ['centralAc', 'CENTRAL_AC']
  },
  {
    keys: ['fire safety system', 'fire_safety_system', 'fire safety'],
    ids: ['FIRE_SAFETY_SYSTEM'],
    labels: ['fire hydrant & safety system', 'fire safety system', 'fire safety'],
    mapKeys: ['fireSafety', 'FIRE_SAFETY_SYSTEM']
  }
];

export function propertyHasAmenity(p, reqAmenity) {
  if (!p || !reqAmenity) return false;
  const cleanReq = String(reqAmenity).toLowerCase().trim();
  const alphaReq = cleanReq.replace(/[^a-z0-9]/g, '');
  if (!alphaReq) return true;

  // 1. Prioritize exact alphanumeric match on ids, keys, or labels
  let rule = AMENITY_MATCH_RULES.find(r =>
    r.ids.some(id => id.toLowerCase().replace(/[^a-z0-9]/g, '') === alphaReq) ||
    r.keys.some(k => k.replace(/[^a-z0-9]/g, '') === alphaReq) ||
    r.labels.some(l => l.replace(/[^a-z0-9]/g, '') === alphaReq)
  );

  // 2. Secondary fallback for compound queries
  if (!rule) {
    rule = AMENITY_MATCH_RULES.find(r =>
      r.keys.some(k => {
        const kAlpha = k.replace(/[^a-z0-9]/g, '');
        return kAlpha.length >= 4 && (alphaReq.includes(kAlpha) || kAlpha.includes(alphaReq));
      }) ||
      r.labels.some(l => {
        const lAlpha = l.replace(/[^a-z0-9]/g, '');
        return lAlpha.length >= 4 && (alphaReq.includes(lAlpha) || lAlpha.includes(alphaReq));
      })
    );
  }

  const rawList = [];
  if (Array.isArray(p.amenities)) {
    p.amenities.forEach(a => {
      if (typeof a === 'string') rawList.push(a);
      else if (a && typeof a === 'object') {
        if (a.id) rawList.push(a.id);
        if (a.label) rawList.push(a.label);
        if (a.name) rawList.push(a.name);
      }
    });
  } else if (typeof p.amenities === 'string') {
    p.amenities.split(/[,;|]+/).forEach(s => rawList.push(s.trim()));
  }

  const specAmenities = p.specifications?.amenities || p.specs?.amenities;
  if (Array.isArray(specAmenities)) {
    specAmenities.forEach(a => rawList.push(typeof a === 'string' ? a : (a?.id || a?.label || a?.name)));
  }

  if (Array.isArray(p.features)) {
    p.features.forEach(f => rawList.push(typeof f === 'string' ? f : (f?.id || f?.label || f?.name)));
  } else if (typeof p.features === 'string') {
    p.features.split(/[,;|]+/).forEach(s => rawList.push(s.trim()));
  }

  const propStrings = rawList.filter(Boolean).map(s => String(s).toLowerCase().trim());
  const propAlphas = propStrings.map(s => s.replace(/[^a-z0-9]/g, ''));

  if (rule) {
    if (rule.ids.some(id => propStrings.includes(id.toLowerCase()) || propAlphas.includes(id.toLowerCase().replace(/[^a-z0-9]/g, '')))) {
      return true;
    }
    if (rule.labels.concat(rule.keys).some(item => {
      const itemAlpha = item.replace(/[^a-z0-9]/g, '');
      return propAlphas.some(pa => pa === itemAlpha || pa.includes(itemAlpha) || itemAlpha.includes(pa));
    })) {
      return true;
    }
    if (p.amenitiesMap && typeof p.amenitiesMap === 'object') {
      if (rule.mapKeys.some(mk => p.amenitiesMap[mk] === true || p.amenitiesMap[mk] === 1 || p.amenitiesMap[mk] === 'true')) {
        return true;
      }
    }
  }

  if (propAlphas.some(pa => pa === alphaReq || pa.includes(alphaReq) || alphaReq.includes(pa))) {
    return true;
  }
  if (propStrings.some(ps => ps.includes(cleanReq) || cleanReq.includes(ps))) {
    return true;
  }

  // Text fallback in title, description, category, tagline
  const descBlob = [p.title, p.description, p.category, p.tagline].filter(Boolean).join(' ').toLowerCase();
  if (descBlob.includes(cleanReq)) {
    return true;
  }
  if (rule) {
    const validPhrases = rule.labels.concat(rule.keys).filter(k => k.length >= 4 && k !== 'pool' && k !== 'power' && k !== 'water');
    if (validPhrases.some(phrase => descBlob.includes(phrase.toLowerCase()))) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes furnishing status values across enum keys, hyphens, spaces, and casing
 * e.g., 'Semi-Furnished', 'SEMI_FURNISHED', 'Semi Furnished', 'semi' -> 'SEMI_FURNISHED'
 *       'Fully Furnished', 'FULLY_FURNISHED', 'Furnished' -> 'FULLY_FURNISHED'
 *       'Unfurnished', 'UNFURNISHED' -> 'UNFURNISHED'
 */
export function normalizeFurnishing(val) {
  if (!val || typeof val !== 'string') return '';
  const clean = val.toUpperCase().replace(/[^A-Z]/g, '');
  if (clean.includes('SEMI')) return 'SEMI_FURNISHED';
  if (clean.includes('UNFURNISH')) return 'UNFURNISHED';
  if (clean.includes('FULLY') || clean === 'FURNISHED' || clean === 'FURNISHING') return 'FULLY_FURNISHED';
  return clean;
}

/**
 * Normalizes facing directions across hyphens, spaces, and casing
 * e.g., 'North-East', 'NORTH_EAST', 'North East' -> 'NORTHEAST'
 */
export function normalizeFacing(val) {
  if (!val || typeof val !== 'string') return '';
  return val.toUpperCase().replace(/[^A-Z]/g, '');
}

/**
 * Pure search filter evaluator across property record
 */
export function matchesSearchFilters(p, searchState = {}) {
  if (!p) return false;

  // Resolve natural language criteria if query contains intent not yet parsed into searchState
  let effectiveState = searchState;
  if (searchState.query && typeof searchState.query === 'string' && searchState.query.trim().toLowerCase() !== 'near me') {
    const rawQ = searchState.query.trim();
    const parsed = parseNaturalLanguageQuery(rawQ);
    effectiveState = {
      ...parsed,
      ...searchState,
      maxPrice: (searchState.maxPrice != null && searchState.maxPrice !== '') ? searchState.maxPrice : parsed.maxPrice,
      minPrice: (searchState.minPrice != null && searchState.minPrice !== '') ? searchState.minPrice : parsed.minPrice,
      propertyType: (searchState.propertyType && searchState.propertyType !== 'ALL') ? searchState.propertyType : parsed.propertyType,
      purpose: (searchState.purpose && searchState.purpose !== 'ALL') ? searchState.purpose : parsed.purpose,
      bedrooms: (searchState.bedrooms && searchState.bedrooms !== 'ANY') ? searchState.bedrooms : parsed.bedrooms,
      cleanKeywords: searchState.cleanKeywords !== undefined ? searchState.cleanKeywords : parsed.cleanKeywords,
      isLocationSpecific: searchState.isLocationSpecific !== undefined ? searchState.isLocationSpecific : parsed.isLocationSpecific,
      referencePlace: searchState.referencePlace || parsed.referencePlace
    };
  }

  // 1. Purpose filter (SALE vs RENT vs LEASE)
  if (effectiveState.purpose && effectiveState.purpose !== 'ALL' && effectiveState.purpose !== 'ANY') {
    const pPurpose = String(p.purpose || 'SALE').toUpperCase();
    const targetPurpose = String(effectiveState.purpose).toUpperCase();
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
  if (effectiveState.propertyType && effectiveState.propertyType !== 'ALL' && effectiveState.propertyType !== 'ANY') {
    const pType = String(p.propertyType || p.type || '').toUpperCase();
    const pCat = String(p.category || p.title || '').toUpperCase();
    const targetType = String(effectiveState.propertyType).toUpperCase();
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
  if (effectiveState.category && effectiveState.category !== 'All' && effectiveState.category !== 'ALL') {
    const targetCat = String(effectiveState.category).toLowerCase().trim();
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
  if (effectiveState.state && effectiveState.state.trim()) {
    const stateVal = effectiveState.state.trim().toLowerCase();
    const blob = extractLocationBlob(p);
    if (!blob.includes(stateVal)) return false;
  }

  // 4b. Location Search (District)
  if (effectiveState.district && effectiveState.district.trim()) {
    const distVal = effectiveState.district.trim().toLowerCase();
    const blob = extractLocationBlob(p);
    if (!blob.includes(distVal)) return false;
  }

  // Determine Reference Center Coordinates for Spatial & Radius Distance Matching
  let refLat = (effectiveState.referenceLat != null && !isNaN(effectiveState.referenceLat))
    ? Number(effectiveState.referenceLat)
    : ((effectiveState.searchLat != null && !isNaN(effectiveState.searchLat)) ? Number(effectiveState.searchLat) : null);
  let refLng = (effectiveState.referenceLng != null && !isNaN(effectiveState.referenceLng))
    ? Number(effectiveState.referenceLng)
    : ((effectiveState.searchLng != null && !isNaN(effectiveState.searchLng)) ? Number(effectiveState.searchLng) : null);

  if (refLat == null || isNaN(refLat) || refLng == null || isNaN(refLng)) {
    const textTarget = effectiveState.referencePlace || effectiveState.locality;
    if (textTarget && typeof textTarget === 'string' && textTarget.trim()) {
      const resolved = resolvePlaceCoordinates(textTarget.trim());
      if (resolved) {
        refLat = resolved.lat;
        refLng = resolved.lng;
      }
    }
  }

  if ((refLat == null || isNaN(refLat) || refLng == null || isNaN(refLng)) && effectiveState.userLat != null && effectiveState.userLng != null) {
    refLat = Number(effectiveState.userLat);
    refLng = Number(effectiveState.userLng);
  }

  const hasRefCoords = refLat != null && !isNaN(refLat) && refLng != null && !isNaN(refLng) && (refLat !== 0 || refLng !== 0);
  const isSpatialSearch = Boolean(hasRefCoords);
  const hasExplicitRadius = effectiveState.radiusKm != null &&
    effectiveState.radiusKm !== '' &&
    effectiveState.radiusKm !== 'any' &&
    effectiveState.radiusKm !== 'all' &&
    !isNaN(Number(effectiveState.radiusKm)) &&
    Number(effectiveState.radiusKm) > 0;
  const radiusNum = hasExplicitRadius ? Number(effectiveState.radiusKm) : null;

  // Extract property coordinates (boundary polygon centroid, centroid object, location, or place text)
  const pCoords = extractCoordinates(p);
  const hasPropCoords = !isNaN(pCoords.lat) && !isNaN(pCoords.lng) && (pCoords.lat !== 0 || pCoords.lng !== 0);

  // Compute exact spherical Haversine distance in km if both reference center and property coordinates exist
  let calculatedDistKm = null;
  if (hasRefCoords && hasPropCoords) {
    calculatedDistKm = calculateDistanceKm(refLat, refLng, pCoords.lat, pCoords.lng);
    p.distKm = Math.round(calculatedDistKm * 10) / 10;
  }

  // 4c. Radius Distance Parameter Enforcement
  if (hasExplicitRadius) {
    if (hasRefCoords && hasPropCoords && calculatedDistKm != null) {
      // Strictly enforce radius distance: property must be within the specified radius in km (inclusive)
      if (calculatedDistKm > radiusNum && Math.round(calculatedDistKm * 10) / 10 > radiusNum) {
        return false;
      }
    } else if (effectiveState.referencePlace && effectiveState.referencePlace.trim()) {
      // Fallback if property coordinates cannot be resolved: match against reference place text
      const placeTokens = effectiveState.referencePlace.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const blob = extractLocationBlob(p);
      const matches = placeTokens.some(tok => blob.includes(tok));
      if (!matches) return false;
    } else {
      // Explicit radius requested but no search origin or reference place available to evaluate radius
      return false;
    }

    // Preserve active administrative location filters (City & Locality) together with radius
    if (effectiveState.city && effectiveState.city.trim()) {
      const cityTokens = effectiveState.city.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const blob = extractLocationBlob(p);
      const matches = cityTokens.some(tok => blob.includes(tok));
      if (!matches) return false;
    }

    if (effectiveState.locality && effectiveState.locality.trim()) {
      const locClean = effectiveState.locality.trim().toLowerCase();
      const locTokens = locClean.split(/[\s,]+/).filter(tok => tok.length > 1);
      const blob = extractLocationBlob(p);
      const directMatch = blob.includes(locClean);
      const tokenMatch = locTokens.length > 0 && locTokens.every(tok => blob.includes(tok));
      if (!directMatch && !tokenMatch) return false;
    }
  } else {
    // When "Any Distance" is chosen, perform standard City, Locality, and Reference Place text matching
    if (effectiveState.city && effectiveState.city.trim()) {
      const cityTokens = effectiveState.city.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const blob = extractLocationBlob(p);
      const matches = cityTokens.some(tok => blob.includes(tok));
      if (!matches) return false;
    }

    if (effectiveState.locality && effectiveState.locality.trim()) {
      const locClean = effectiveState.locality.trim().toLowerCase();
      const locTokens = locClean.split(/[\s,]+/).filter(tok => tok.length > 1);
      const blob = extractLocationBlob(p);
      const directMatch = blob.includes(locClean);
      const tokenMatch = locTokens.length > 0 && locTokens.every(tok => blob.includes(tok));
      if (!directMatch && !tokenMatch) return false;
    }

    if (effectiveState.referencePlace && effectiveState.referencePlace.trim()) {
      // If reference coordinates are present, distance has already been measured for any distance.
      // Only do textual substring filtering if coordinates could not be resolved!
      if (!hasRefCoords) {
        const placeTokens = effectiveState.referencePlace.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const blob = extractLocationBlob(p);
        const matches = placeTokens.some(tok => blob.includes(tok));
        if (!matches) return false;
      }
    }
  }

  // 5. Search Query keyword token check (with smart stopword omission)
  // Skip requiring place / venue words on property descriptions when exact search coordinates are active
  if (effectiveState.query && effectiveState.query.trim() && !isSpatialSearch) {
    const q = effectiveState.query.trim().toLowerCase();
    if (q !== 'near me') {
      let tokensToCheck = [];
      if (effectiveState.cleanKeywords !== undefined) {
        tokensToCheck = effectiveState.cleanKeywords ? effectiveState.cleanKeywords.toLowerCase().split(/\s+/).filter(Boolean) : [];
      } else {
        tokensToCheck = q
          .split(/[\s,/\-]+/)
          .map(t => t.trim())
          .filter(t => t.length > 1 && !REAL_ESTATE_STOPWORDS.has(t) && !/^\d+$/.test(t));
      }

      if (tokensToCheck.length > 0) {
        const title = String(p.title || '').toLowerCase();
        const desc = String(p.description || '').toLowerCase();
        const blob = extractLocationBlob(p);
        const cat = String(p.category || p.propertyType || '').toLowerCase();
        const refId = String(p.referenceId || p.propertyId || p.id || '').toLowerCase();

        const fullBlob = [title, desc, blob, cat, refId].join(' ');
        const matches = tokensToCheck.every(token => {
          const syns = getSemanticSynonyms(token);
          return syns.some(syn => fullBlob.includes(syn));
        });
        if (!matches) return false;
      }
    }
  }

  // 6. Price range
  if (effectiveState.minPrice != null && effectiveState.minPrice !== '' && Number(effectiveState.minPrice) >= 0) {
    const price = Number(p.price) || 0;
    if (price > 0 && price < Number(effectiveState.minPrice)) return false;
  }
  if (effectiveState.maxPrice != null && effectiveState.maxPrice !== '' && Number(effectiveState.maxPrice) >= 0) {
    const price = Number(p.price) || 0;
    if (price > 0 && price > Number(effectiveState.maxPrice)) return false;
  }

  // 7. Area range (Multi-unit conversion to standard Sq Ft)
  const currentUnit = effectiveState.areaUnit || 'sq ft';
  const rawMinArea = (effectiveState.minArea != null && effectiveState.minArea !== '')
    ? Number(effectiveState.minArea)
    : ((effectiveState.minAreaSqFt != null && effectiveState.minAreaSqFt !== '') ? Number(effectiveState.minAreaSqFt) : null);
  const rawMaxArea = (effectiveState.maxArea != null && effectiveState.maxArea !== '')
    ? Number(effectiveState.maxArea)
    : ((effectiveState.maxAreaSqFt != null && effectiveState.maxAreaSqFt !== '') ? Number(effectiveState.maxAreaSqFt) : null);

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
  if (effectiveState.bedrooms && effectiveState.bedrooms !== 'ANY' && effectiveState.bedrooms !== 'ALL') {
    const targetBhk = Number(effectiveState.bedrooms);
    if (!isNaN(targetBhk) && targetBhk > 0) {
      const pBhk = Number(p.bedrooms || p.bhk || p.specifications?.bedrooms || 0);
      if (pBhk < targetBhk) return false;
    }
  }

  // 9. Facing Direction
  if (effectiveState.facing && effectiveState.facing !== 'ANY' && effectiveState.facing !== 'ALL') {
    const targetFacing = normalizeFacing(effectiveState.facing);
    if (targetFacing) {
      const rawFacing = p.facing || p.specs?.facing || p.specifications?.facing || '';
      const propFacing = normalizeFacing(rawFacing);
      if (!propFacing || propFacing !== targetFacing) return false;
    }
  }

  // 10. Furnishing Status
  if (effectiveState.furnishing && effectiveState.furnishing !== 'ANY' && effectiveState.furnishing !== 'ALL') {
    const targetFurnishing = normalizeFurnishing(effectiveState.furnishing);
    if (targetFurnishing) {
      const rawPropFurnishing = p.specs?.furnishing ||
                                p.specs?.furnishingStatus ||
                                p.specifications?.furnishing ||
                                p.specifications?.furnishingStatus ||
                                p.furnishing ||
                                p.furnishingStatus ||
                                '';
      const propFurnishing = normalizeFurnishing(rawPropFurnishing);

      if (!propFurnishing || propFurnishing !== targetFurnishing) {
        return false;
      }
    }
  }

  // 11. Amenities
  if (Array.isArray(effectiveState.amenities) && effectiveState.amenities.length > 0) {
    const hasAll = effectiveState.amenities.every(req => propertyHasAmenity(p, req));
    if (!hasAll) return false;
  }

  return true;
}

