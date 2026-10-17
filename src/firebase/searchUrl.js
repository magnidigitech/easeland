/**
 * EaseLand Search URL Query Parameter Serialization & Parsing (Block 16)
 * Handles shareable search links, browser back/forward history navigation, and URL state restoration.
 */

import { Purpose, PropertyType } from './schema.js';
import { parseNaturalLanguageQuery } from './searchParser.js';

/**
 * Convert search state object to URL query parameters string
 */
export function searchStateToUrlParams(searchState = {}) {
  const params = new URLSearchParams();

  if (searchState.query && searchState.query.trim()) {
    params.set('q', searchState.query.trim());
  }

  if (searchState.purpose && searchState.purpose !== 'ALL') {
    params.set('purpose', searchState.purpose);
  }

  if (searchState.propertyType && searchState.propertyType !== 'ALL') {
    params.set('type', searchState.propertyType);
  }

  if (searchState.category && searchState.category !== 'All') {
    params.set('category', searchState.category);
  }

  if (searchState.state && searchState.state.trim()) {
    params.set('state', searchState.state.trim());
  }

  if (searchState.district && searchState.district.trim()) {
    params.set('district', searchState.district.trim());
  }

  if (searchState.city && searchState.city.trim()) {
    params.set('city', searchState.city.trim());
  }

  if (searchState.locality && searchState.locality.trim()) {
    params.set('locality', searchState.locality.trim());
  }

  if (searchState.minPrice !== null && searchState.minPrice !== undefined && searchState.minPrice !== '' && Number(searchState.minPrice) >= 0) {
    params.set('minPrice', String(Math.max(0, Number(searchState.minPrice))));
  }

  if (searchState.maxPrice !== null && searchState.maxPrice !== undefined && searchState.maxPrice !== '' && Number(searchState.maxPrice) >= 0) {
    params.set('maxPrice', String(Math.max(0, Number(searchState.maxPrice))));
  }

  const minAreaToSave = searchState.minArea ?? searchState.minAreaSqFt;
  if (minAreaToSave !== null && minAreaToSave !== undefined && minAreaToSave !== '' && Number(minAreaToSave) >= 0) {
    params.set('minArea', String(Math.max(0, Number(minAreaToSave))));
  }

  const maxAreaToSave = searchState.maxArea ?? searchState.maxAreaSqFt;
  if (maxAreaToSave !== null && maxAreaToSave !== undefined && maxAreaToSave !== '' && Number(maxAreaToSave) >= 0) {
    params.set('maxArea', String(Math.max(0, Number(maxAreaToSave))));
  }

  if (searchState.areaUnit && searchState.areaUnit !== 'sq ft') {
    params.set('areaUnit', searchState.areaUnit);
  }

  if (searchState.bedrooms && searchState.bedrooms !== 'ANY') {
    params.set('bhk', String(searchState.bedrooms));
  }

  if (searchState.bathrooms && searchState.bathrooms !== 'ANY') {
    params.set('baths', String(searchState.bathrooms));
  }

  if (searchState.facing && searchState.facing !== 'ALL') {
    params.set('facing', searchState.facing);
  }

  if (searchState.furnishing && searchState.furnishing !== 'ALL') {
    params.set('furnishing', searchState.furnishing);
  }

  if (Array.isArray(searchState.amenities) && searchState.amenities.length > 0) {
    params.set('amenities', searchState.amenities.join(','));
  }

  if (searchState.radiusKm != null && !isNaN(Number(searchState.radiusKm)) && Number(searchState.radiusKm) > 0 && (searchState.referencePlace || searchState.referenceLat != null || searchState.searchLat != null)) {
    params.set('radius', String(searchState.radiusKm));
  }

  if (searchState.referencePlace && searchState.referencePlace.trim()) {
    params.set('near', searchState.referencePlace.trim());
  }

  if (searchState.sortBy && searchState.sortBy !== 'newest') {
    params.set('sort', searchState.sortBy);
  }

  if (searchState.searchLat != null && searchState.searchLng != null) {
    params.set('lat', String(searchState.searchLat));
    params.set('lng', String(searchState.searchLng));
  } else if (searchState.referenceLat != null && searchState.referenceLng != null) {
    params.set('lat', String(searchState.referenceLat));
    params.set('lng', String(searchState.referenceLng));
  }

  const queryStr = params.toString();
  return queryStr ? `/properties?${queryStr}` : '/properties';
}

/**
 * Parse URL query search string into normalized search state object
 */
export function urlParamsToSearchState(searchString = '') {
  const params = new URLSearchParams(searchString || window.location.search);

  const q = params.get('q') || '';
  const purposeParam = params.get('purpose');
  const typeParam = params.get('type') || params.get('propertyType');
  const stateParam = params.get('state') || '';
  const districtParam = params.get('district') || '';
  const cityParam = params.get('city') || '';
  const localityParam = params.get('locality') || '';

  const minPriceParam = params.get('minPrice');
  const maxPriceParam = params.get('maxPrice');
  const minAreaParam = params.get('minArea');
  const maxAreaParam = params.get('maxArea');
  const bhkParam = params.get('bhk') || params.get('bedrooms');
  const bathsParam = params.get('baths') || params.get('bathrooms');
  const facingParam = params.get('facing');
  const furnishingParam = params.get('furnishing');
  const amenitiesParam = params.get('amenities');
  const radiusParam = params.get('radius') || params.get('radiusKm');
  const nearParam = params.get('near') || params.get('referencePlace');
  const areaUnitParam = params.get('areaUnit') || 'sq ft';
  const sortParam = params.get('sort');

  const parsedNL = (q && q.trim()) ? parseNaturalLanguageQuery(q) : {};

  // Validate Purpose Enum
  const validPurpose = Object.values(Purpose).includes(purposeParam)
    ? purposeParam
    : (parsedNL.purpose && parsedNL.purpose !== 'ALL' ? parsedNL.purpose : 'ALL');

  // Validate PropertyType Enum
  const validPropertyType = Object.values(PropertyType).includes(typeParam)
    ? typeParam
    : (parsedNL.propertyType && parsedNL.propertyType !== 'ALL' ? parsedNL.propertyType : 'ALL');

  const catParam = params.get('category');
  let resolvedCategory = 'All';
  if (catParam && catParam !== 'All') {
    const cleanCat = catParam.trim().toLowerCase();
    if (cleanCat.includes('amaravathi') || cleanCat.includes('lps')) resolvedCategory = 'Amaravathi LPS layout plots';
    else if (cleanCat.includes('agricultural') || cleanCat.includes('farm')) resolvedCategory = 'Agricultural Lands';
    else if (cleanCat.includes('commercial') || cleanCat.includes('commeric')) resolvedCategory = 'Commerical Property';
    else if (cleanCat.includes('apartment') || cleanCat.includes('flat')) resolvedCategory = 'Apartments/Flat';
    else if (cleanCat.includes('house') || cleanCat.includes('villa') || cleanCat.includes('independent')) resolvedCategory = 'Independent House/Villa';
    else if (cleanCat.includes('city') && cleanCat.includes('plot')) resolvedCategory = 'Open Plot (City)';
    else if (cleanCat.includes('venture') || cleanCat.includes('plot')) resolvedCategory = 'Open Plot Ventures';
    else if (cleanCat.includes('other')) resolvedCategory = 'Others';
    else resolvedCategory = catParam.trim();
  }

  const resolvedMinPrice = (minPriceParam && !isNaN(Number(minPriceParam)) && Number(minPriceParam) >= 0)
    ? Math.max(0, Number(minPriceParam))
    : (parsedNL.minPrice !== undefined && parsedNL.minPrice !== '' ? parsedNL.minPrice : '');

  const resolvedMaxPrice = (maxPriceParam && !isNaN(Number(maxPriceParam)) && Number(maxPriceParam) >= 0)
    ? Math.max(0, Number(maxPriceParam))
    : (parsedNL.maxPrice !== undefined && parsedNL.maxPrice !== '' ? parsedNL.maxPrice : '');

  const resolvedBedrooms = (bhkParam && bhkParam !== 'ANY')
    ? bhkParam
    : (parsedNL.bedrooms && parsedNL.bedrooms !== 'ANY' ? parsedNL.bedrooms : 'ANY');

  return {
    query: q,
    cleanKeywords: parsedNL.cleanKeywords,
    isLocationSpecific: parsedNL.isLocationSpecific,
    purpose: validPurpose,
    propertyType: validPropertyType,
    category: resolvedCategory,
    state: stateParam,
    district: districtParam,
    city: cityParam,
    locality: localityParam,
    minPrice: resolvedMinPrice,
    maxPrice: resolvedMaxPrice,
    minArea: (minAreaParam && !isNaN(Number(minAreaParam)) && Number(minAreaParam) >= 0) ? Math.max(0, Number(minAreaParam)) : '',
    maxArea: (maxAreaParam && !isNaN(Number(maxAreaParam)) && Number(maxAreaParam) >= 0) ? Math.max(0, Number(maxAreaParam)) : '',
    minAreaSqFt: (minAreaParam && !isNaN(Number(minAreaParam)) && Number(minAreaParam) >= 0) ? Math.max(0, Number(minAreaParam)) : '',
    maxAreaSqFt: (maxAreaParam && !isNaN(Number(maxAreaParam)) && Number(maxAreaParam) >= 0) ? Math.max(0, Number(maxAreaParam)) : '',
    areaUnit: areaUnitParam,
    bedrooms: resolvedBedrooms,
    bathrooms: bathsParam || 'ANY',
    facing: facingParam || 'ALL',
    furnishing: furnishingParam || 'ALL',
    amenities: amenitiesParam ? amenitiesParam.split(',').filter(Boolean) : [],
    radiusKm: (radiusParam && !isNaN(Number(radiusParam)) && Number(radiusParam) > 0)
      ? Number(radiusParam)
      : (parsedNL.radiusKm && !isNaN(Number(parsedNL.radiusKm)) && Number(parsedNL.radiusKm) > 0 ? Number(parsedNL.radiusKm) : null),
    referencePlace: nearParam || parsedNL.referencePlace || '',
    referenceLat: (params.get('lat') && !isNaN(Number(params.get('lat')))) ? Number(params.get('lat')) : null,
    referenceLng: (params.get('lng') && !isNaN(Number(params.get('lng')))) ? Number(params.get('lng')) : null,
    searchLat: (params.get('lat') && !isNaN(Number(params.get('lat')))) ? Number(params.get('lat')) : null,
    searchLng: (params.get('lng') && !isNaN(Number(params.get('lng')))) ? Number(params.get('lng')) : null,
    sortBy: sortParam || 'newest'
  };
}

/**
 * Returns a clean, initialized search filter state object with default values
 * and optional overrides, guaranteeing no stale or cross-pollinated filters.
 */
export function createDefaultFilterState(overrides = {}) {
  const defaults = {
    query: '',
    purpose: 'ALL',
    propertyType: 'ALL',
    category: 'All',
    state: '',
    district: '',
    city: '',
    locality: '',
    minPrice: '',
    maxPrice: '',
    minArea: '',
    maxArea: '',
    minAreaSqFt: '',
    maxAreaSqFt: '',
    areaUnit: 'sq ft',
    bedrooms: 'ANY',
    bathrooms: 'ANY',
    facing: 'ALL',
    furnishing: 'ALL',
    amenities: [],
    radiusKm: null,
    referencePlace: '',
    referenceLat: null,
    referenceLng: null,
    searchLat: null,
    searchLng: null,
    searchPlaceName: '',
    sortBy: 'newest',
    cleared: false
  };

  if (!overrides || typeof overrides !== 'object') {
    return defaults;
  }

  return {
    ...defaults,
    ...overrides
  };
}
