import { INDIA_LOCATION_DATA } from '../data/indiaLocationData.js';

/**
 * Pre-flatten all localities from INDIA_LOCATION_DATA into a fast-lookup index
 */
let CACHED_LOCALITY_INDEX = null;
let CACHED_CITY_INDEX = null;

function buildLocationIndexes() {
  if (CACHED_LOCALITY_INDEX && CACHED_CITY_INDEX) {
    return { localities: CACHED_LOCALITY_INDEX, cities: CACHED_CITY_INDEX };
  }

  const localities = [];
  const cityMap = new Map();

  for (const [state, stateObj] of Object.entries(INDIA_LOCATION_DATA)) {
    if (!stateObj?.districts) continue;
    for (const [district, distObj] of Object.entries(stateObj.districts)) {
      if (!distObj?.cities) continue;
      for (const [city, cityObj] of Object.entries(distObj.cities)) {
        // Record city
        if (!cityMap.has(city.toLowerCase())) {
          cityMap.set(city.toLowerCase(), {
            city,
            district,
            state,
            displayText: `${city}, ${state}`
          });
        }

        // Record localities
        if (Array.isArray(cityObj)) {
          cityObj.forEach(loc => {
            localities.push({
              locality: loc,
              mandal: '',
              city,
              district,
              state,
              displayText: `${loc}, ${city}, ${state}`
            });
          });
        } else if (cityObj?.mandals) {
          for (const [mandal, locList] of Object.entries(cityObj.mandals)) {
            if (Array.isArray(locList)) {
              locList.forEach(loc => {
                localities.push({
                  locality: loc,
                  mandal,
                  city,
                  district,
                  state,
                  displayText: `${loc}, ${city}, ${state}`
                });
              });
            }
          }
        }
      }
    }
  }

  CACHED_LOCALITY_INDEX = localities;
  CACHED_CITY_INDEX = Array.from(cityMap.values());
  return { localities, cities: CACHED_CITY_INDEX };
}

/**
 * Resolve full administrative hierarchy (City, District, State) from a locality name
 */
export function resolveLocalityHierarchy(localityName) {
  if (!localityName || typeof localityName !== 'string') return null;
  const clean = localityName.trim().toLowerCase();
  if (!clean) return null;

  const { localities } = buildLocationIndexes();

  // 1. Exact match on locality name
  const exact = localities.find(l => l.locality.toLowerCase() === clean);
  if (exact) return exact;

  // 2. Prefix match only if user typed at least 4 chars and starts with clean string
  if (clean.length >= 4) {
    const starts = localities.find(l => l.locality.toLowerCase().startsWith(clean));
    if (starts) return starts;
  }

  return null;
}

/**
 * Search localities matching a query, optionally scoped to a city
 */
export function searchLocalities(query = '', filterCity = '', maxResults = 12) {
  const { localities } = buildLocationIndexes();
  const q = String(query || '').trim().toLowerCase();
  const cityFilter = String(filterCity || '').trim().toLowerCase();

  return localities
    .filter(item => {
      // Scoped city filter
      if (cityFilter) {
        const itemCity = item.city.toLowerCase();
        if (!itemCity.includes(cityFilter) && !cityFilter.includes(itemCity)) {
          return false;
        }
      }

      if (!q) return true; // If no query, return top localities for the city
      return (
        item.locality.toLowerCase().includes(q) ||
        (item.mandal && item.mandal.toLowerCase().includes(q)) ||
        item.city.toLowerCase().includes(q)
      );
    })
    .slice(0, maxResults);
}

/**
 * Search cities matching a query
 */
export function searchCities(query = '', maxResults = 12) {
  const { cities } = buildLocationIndexes();
  const q = String(query || '').trim().toLowerCase();
  if (!q) return cities.slice(0, maxResults);

  return cities
    .filter(c => c.city.toLowerCase().includes(q) || c.state.toLowerCase().includes(q) || c.district.toLowerCase().includes(q))
    .slice(0, maxResults);
}

/**
 * Get all localities for a specific city name
 */
export function getLocalitiesForCity(cityName) {
  if (!cityName) return [];
  const cleanCity = String(cityName).trim().toLowerCase();
  const { localities } = buildLocationIndexes();
  return localities.filter(l => {
    const c = l.city.toLowerCase();
    return c === cleanCity || c.includes(cleanCity) || cleanCity.includes(c);
  });
}
