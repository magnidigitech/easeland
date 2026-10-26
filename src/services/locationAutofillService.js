/**
 * EaseLand Universal Pan-India Dynamic Location & Autofill Service
 * Integrates:
 * 1. EaseLand Server-Side Location Intelligence API (/api/locations/autocomplete)
 * 2. OpenStreetMap / Photon Real-Time India Geospatial Service
 * 3. OpenStreetMap Nominatim Administrative Hierarchy Engine
 * 4. Pan-India 28 States & 8 UTs Official Master Registry
 * 5. Platform Verified Properties & Land Ventures
 */

import {
  PAN_INDIA_ADMINISTRATIVE_HIERARCHY,
  getIndiaStates,
  getIndiaDistricts,
  matchStatesAndDistricts
} from './indiaLocationHierarchy.js';

// In-memory client cache with 5-minute TTL
const clientLocationCache = new Map();
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Searches locations across all of India dynamically.
 * Resolves:
 * - States & Union Territories
 * - Districts
 * - Mandals, Tehsils & Taluks
 * - Cities & Towns
 * - Villages & Gram Panchayats
 * - Areas, Colonies & Suburbs
 * - Key Landmarks (Airports, Railway Stations, Universities, Hospitals, Government Offices)
 * - Platform Verified Land Ventures
 *
 * @param {string} queryStr - User typed text (minimum 2 characters)
 * @param {Object} [options] - Optional filters and parameters
 * @param {string} [options.state] - State filter
 * @param {string} [options.district] - District filter
 * @param {Array} [options.availableProperties] - In-memory property listings to prioritize
 * @param {number} [options.limit] - Max results to return (default 12)
 * @returns {Promise<Array>} List of structured location objects
 */
export async function searchIndiaLocations(queryStr, options = {}) {
  if (!queryStr || typeof queryStr !== 'string') return [];
  const q = queryStr.trim();
  if (q.length < 2) return [];

  const limit = options.limit || 12;
  const cacheKey = q.toLowerCase() + '_' + (options.state || '') + '_' + (options.district || '') + '_' + limit;

  // 1. Check in-memory client cache
  const cached = clientLocationCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS)) {
    return cached.results;
  }

  const results = [];
  const seenKeys = new Set();

  const addResult = (item) => {
    if (!item || !item.title) return;
    const dedupeKey = (item.title + '|' + (item.district || '') + '|' + (item.state || '')).toLowerCase().trim();
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);
    results.push(item);
  };

  // 2. Check local platform properties (if provided or active)
  const properties = options.availableProperties || [];
  if (Array.isArray(properties) && properties.length > 0) {
    const qLower = q.toLowerCase();
    properties.forEach((p) => {
      const title = p.title || '';
      const loc = p.locationName || p.address || '';
      const city = p.city || '';
      const dist = p.district || '';
      const mandal = p.mandal || '';
      const village = p.village || '';

      if (
        title.toLowerCase().includes(qLower) ||
        loc.toLowerCase().includes(qLower) ||
        city.toLowerCase().includes(qLower) ||
        dist.toLowerCase().includes(qLower) ||
        mandal.toLowerCase().includes(qLower) ||
        village.toLowerCase().includes(qLower)
      ) {
        addResult({
          id: 'prop_' + (p.id || p.propertyId || Math.random().toString(36).slice(2, 7)),
          title: title || loc,
          subtitle: (loc ? loc + ', ' : '') + (city || dist || 'Andhra Pradesh') + ' • Platform Venture',
          fullAddress: (loc ? loc + ', ' : '') + (city ? city + ', ' : '') + (dist ? dist + ' Dist, ' : '') + 'Andhra Pradesh',
          type: 'LISTED_VENTURE',
          village: village || '',
          mandal: mandal || '',
          city: city || loc,
          district: dist || '',
          state: p.state || 'Andhra Pradesh',
          country: 'India',
          lat: p.lat || null,
          lng: p.lng || null,
          isPlatformListing: true,
          propertyId: p.id || p.propertyId
        });
      }
    });
  }

  // 3. Match administrative States & Districts
  const adminMatches = matchStatesAndDistricts(q);
  adminMatches.forEach(addResult);

  // 4. Try EaseLand Backend Location API (/api/locations/autocomplete)
  let backendSucceeded = false;
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    try {
      const url = '/api/locations/autocomplete?q=' + encodeURIComponent(q) +
        (options.state ? '&state=' + encodeURIComponent(options.state) : '') +
        (options.district ? '&district=' + encodeURIComponent(options.district) : '') +
        '&limit=' + limit;

      const response = await window.fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.results)) {
          data.results.forEach(addResult);
          backendSucceeded = true;
        }
      }
    } catch (apiErr) {
      // Backend not running or in mock/offline mode
    }
  }

  // 5. Fallback directly to Photon Live Geospatial Engine for Pan-India if backend was unreachable
  if (!backendSucceeded) {
    try {
      const fetchFn = (typeof window !== 'undefined' && window.fetch) || (typeof fetch === 'function' && fetch);
      if (fetchFn) {
        const photonUrl = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(q) +
          '&limit=15&lat=20.5937&lon=78.9629';

        const pRes = await fetchFn(photonUrl);
        if (pRes.ok) {
          const pData = await pRes.json();
          const features = (pData.features || []).filter(f => {
            const cc = f.properties?.countrycode || f.properties?.country || '';
            return String(cc).toUpperCase() === 'IN' || String(cc).toLowerCase() === 'india';
          });

          features.forEach((f) => {
            const props = f.properties || {};
            const coords = f.geometry?.coordinates || [];
            const osmKey = props.osm_key;
            const osmVal = props.osm_value;

            let locType = 'LOCALITY';
            if (osmVal === 'village' || osmVal === 'hamlet') {
              locType = 'VILLAGE';
            } else if (osmVal === 'subdistrict' || (props.county && /mandal|tehsil|taluk/i.test(props.county))) {
              locType = 'MANDAL';
            } else if (osmVal === 'city' || osmVal === 'town') {
              locType = 'CITY';
            } else if (osmVal === 'district' || osmVal === 'county') {
              locType = 'DISTRICT';
            } else if (osmVal === 'state') {
              locType = 'STATE';
            } else if (
              ['university', 'college', 'hospital', 'school', 'aeroway', 'station', 'place_of_worship', 'viewpoint', 'stadium', 'building'].includes(osmVal) ||
              osmKey === 'amenity' || osmKey === 'historic' || osmKey === 'tourism'
            ) {
              locType = 'LANDMARK';
            } else if (osmVal === 'suburb' || osmVal === 'neighbourhood') {
              locType = 'AREA';
            }

            const village = (locType === 'VILLAGE' ? props.name : '') || '';
            const mandal = (props.county && /mandal|tehsil|taluk/i.test(props.county))
              ? props.county
              : (locType === 'MANDAL' ? props.name : '');
            const district = props.district || ((props.county && !/mandal|tehsil|taluk/i.test(props.county)) ? props.county : '');
            const city = props.city || (locType === 'CITY' ? props.name : '');
            const state = props.state || '';

            const subParts = [];
            if (mandal && mandal !== props.name) subParts.push(mandal);
            if (city && city !== props.name && city !== mandal) subParts.push(city);
            if (district && district !== props.name && district !== city) subParts.push(district + ' Dist');
            if (state && state !== props.name) subParts.push(state);

            addResult({
              id: 'loc_photon_' + (props.osm_id || Math.random().toString(36).slice(2, 7)),
              title: props.name,
              subtitle: subParts.join(', ') || state || 'India',
              fullAddress: [props.name, ...subParts].join(', ') + ', India',
              type: locType,
              village,
              mandal,
              city,
              district,
              state,
              country: 'India',
              lat: coords[1] || null,
              lng: coords[0] || null,
              isPlatformListing: false
            });
          });
        }
      }
    } catch (photonErr) {}
  }

  const finalResults = results.slice(0, limit);

  // Store in client cache
  clientLocationCache.set(cacheKey, {
    timestamp: Date.now(),
    results: finalResults
  });

  return finalResults;
}

export {
  getIndiaStates,
  getIndiaDistricts,
  matchStatesAndDistricts,
  PAN_INDIA_ADMINISTRATIVE_HIERARCHY
};
