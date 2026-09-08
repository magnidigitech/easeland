/**
 * EaseLand Search URL Query Parameter Serialization & Parsing (Block 16)
 * Handles shareable search links, browser back/forward history navigation, and URL state restoration.
 */

import { Purpose, PropertyType } from './schema.js';

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

  if (searchState.minPrice !== null && searchState.minPrice !== undefined && searchState.minPrice !== '') {
    params.set('minPrice', String(searchState.minPrice));
  }

  if (searchState.maxPrice !== null && searchState.maxPrice !== undefined && searchState.maxPrice !== '') {
    params.set('maxPrice', String(searchState.maxPrice));
  }

  if (searchState.minAreaSqFt !== null && searchState.minAreaSqFt !== undefined && searchState.minAreaSqFt !== '') {
    params.set('minArea', String(searchState.minAreaSqFt));
  }

  if (searchState.maxAreaSqFt !== null && searchState.maxAreaSqFt !== undefined && searchState.maxAreaSqFt !== '') {
    params.set('maxArea', String(searchState.maxAreaSqFt));
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

  if (searchState.radiusKm) {
    params.set('radius', String(searchState.radiusKm));
  }

  if (searchState.referencePlace && searchState.referencePlace.trim()) {
    params.set('near', searchState.referencePlace.trim());
  }

  if (searchState.sortBy && searchState.sortBy !== 'newest') {
    params.set('sort', searchState.sortBy);
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
  const typeParam = params.get('type');
  const stateParam = params.get('state') || '';
  const districtParam = params.get('district') || '';
  const cityParam = params.get('city') || '';
  const localityParam = params.get('locality') || '';

  const minPriceParam = params.get('minPrice');
  const maxPriceParam = params.get('maxPrice');
  const minAreaParam = params.get('minArea');
  const maxAreaParam = params.get('maxArea');
  const bhkParam = params.get('bhk');
  const bathsParam = params.get('baths');
  const facingParam = params.get('facing');
  const furnishingParam = params.get('furnishing');
  const amenitiesParam = params.get('amenities');
  const radiusParam = params.get('radius');
  const nearParam = params.get('near');
  const sortParam = params.get('sort');

  // Validate Purpose Enum
  const validPurpose = Object.values(Purpose).includes(purposeParam) ? purposeParam : 'ALL';

  // Validate PropertyType Enum
  const validPropertyType = Object.values(PropertyType).includes(typeParam) ? typeParam : 'ALL';

  return {
    query: q,
    purpose: validPurpose,
    propertyType: validPropertyType,
    state: stateParam,
    district: districtParam,
    city: cityParam,
    locality: localityParam,
    minPrice: (minPriceParam && !isNaN(Number(minPriceParam))) ? Number(minPriceParam) : '',
    maxPrice: (maxPriceParam && !isNaN(Number(maxPriceParam))) ? Number(maxPriceParam) : '',
    minAreaSqFt: (minAreaParam && !isNaN(Number(minAreaParam))) ? Number(minAreaParam) : '',
    maxAreaSqFt: (maxAreaParam && !isNaN(Number(maxAreaParam))) ? Number(maxAreaParam) : '',
    bedrooms: bhkParam || 'ANY',
    bathrooms: bathsParam || 'ANY',
    facing: facingParam || 'ALL',
    furnishing: furnishingParam || 'ALL',
    amenities: amenitiesParam ? amenitiesParam.split(',').filter(Boolean) : [],
    radiusKm: (radiusParam && !isNaN(Number(radiusParam))) ? Number(radiusParam) : null,
    referencePlace: nearParam || '',
    sortBy: sortParam || 'newest'
  };
}
