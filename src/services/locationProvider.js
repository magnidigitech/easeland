/**
 * EaseLand Location & Geocoding Provider Abstraction Layer
 * Exclusively powered by Google Maps Platform APIs (Geocoding API & Device Geolocation API).
 * Nominatim / OpenStreetMap fallbacks have been completely removed.
 */

const GOOGLE_MAPS_KEY = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_GOOGLE_MAPS_API_KEY)
  || (typeof process !== 'undefined' && process.env?.VITE_GOOGLE_MAPS_API_KEY)
  || 'AIzaSyB5PrlDfnJ2jLEOTaEMENd34e_u-sQSDfA';

/**
 * Helper to dynamically load Google Maps JS SDK script if not already present
 */
export function loadGoogleMapsScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve(null);
    if (window.google && window.google.maps) {
      return resolve(window.google.maps);
    }
    if (document.getElementById('google-maps-js-sdk')) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.google && window.google.maps) {
          clearInterval(interval);
          resolve(window.google.maps);
        } else if (attempts > 80) {
          clearInterval(interval);
          resolve(null);
        }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-js-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places,geometry`;
    script.async = true;
    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps SDK failed to load.'));
      }
    };
    script.onerror = () => reject(new Error('Google Maps SDK network load error.'));
    document.head.appendChild(script);
  });
}

/**
 * Helper: Build un-fabricated empty location hierarchy object
 */
export function buildEmptyLocationHierarchy(lat = 0, lng = 0) {
  return {
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
    address: lat && lng ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : ''
  };
}

/**
 * Extract canonical location hierarchy from Google Maps Geocoding API address_components
 * Intelligently supports Indian administrative hierarchy:
 * - Sublocality (Brodipet, MVP Colony) -> City (Guntur, Visakhapatnam)
 * - Town / Village (Perecherla) -> Taluk / Mandal (Guntur) -> District (Guntur) -> State (AP)
 */
export function extractGoogleLocationHierarchy(geocodedResult) {
  if (!geocodedResult || !Array.isArray(geocodedResult.address_components)) {
    return buildEmptyLocationHierarchy();
  }

  const components = geocodedResult.address_components;
  const getComp = (type) => {
    const item = components.find(c => Array.isArray(c.types) && c.types.includes(type));
    return item ? item.long_name : '';
  };

  const rawSubLocality = getComp('sublocality_level_1') || getComp('sublocality') || getComp('neighborhood');
  const rawLocality = getComp('locality');
  const admin3 = getComp('administrative_area_level_3');
  const admin2 = getComp('administrative_area_level_2');
  const admin1 = getComp('administrative_area_level_1');

  // Hierarchy resolution:
  // Case A: Neighborhood in a City (e.g. Brodipet in Guntur)
  // Case B: Village or Town in a Taluk/District (e.g. Perecherla in Guntur)
  const locality = rawSubLocality || rawLocality || '';
  const city = rawSubLocality
    ? (rawLocality || admin3 || admin2)
    : (admin3 || admin2 || rawLocality);
  const district = admin2 || admin3 || (rawSubLocality ? rawLocality : '');
  const state = admin1;

  return {
    country: getComp('country') || 'India',
    state: state,
    district: district,
    city: city,
    mandal: admin3 || admin2 || city,
    locality: locality,
    subLocality: getComp('sublocality_level_2') || rawSubLocality,
    village: getComp('administrative_area_level_4') || getComp('village'),
    road: getComp('route'),
    colony: getComp('premise') || getComp('subpremise'),
    landmark: getComp('landmark') || getComp('point_of_interest'),
    postalCode: getComp('postal_code'),
    address: geocodedResult.formatted_address || ''
  };
}

/**
 * Request device location via standard browser Geolocation API
 */
export async function getCurrentDeviceLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation is not supported by your browser.'));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        let msg = 'Failed to retrieve location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = 'Location permission denied. Please allow location access in browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            msg = 'Device location information is unavailable.';
            break;
          case error.TIMEOUT:
            msg = 'Location request timed out. Please try again.';
            break;
        }
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

/**
 * Reverse Geocode Coordinates via Google Maps Geocoding API
 */
export async function reverseGeocodeLocation(lat, lng) {
  // 1. Try Google Maps JS SDK Geocoder instance if window.google is loaded
  if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.Geocoder) {
    return new Promise((resolve) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          resolve(extractGoogleLocationHierarchy(results[0]));
        } else {
          resolve(buildEmptyLocationHierarchy(lat, lng));
        }
      });
    });
  }

  // 2. Direct Google Maps Geocoding REST API request
  if (!GOOGLE_MAPS_KEY) {
    console.warn('Google Maps API key missing in VITE_GOOGLE_MAPS_API_KEY environment variable.');
    return buildEmptyLocationHierarchy(lat, lng);
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
      return extractGoogleLocationHierarchy(data.results[0]);
    }
  } catch (err) {
    console.warn('Google Maps Geocoding API network request error:', err.message);
  }

  return buildEmptyLocationHierarchy(lat, lng);
}

/**
 * Search Location Query via Google Maps Geocoding / Places API
 */
export async function searchLocationQuery(queryStr) {
  if (!queryStr || queryStr.trim().length < 3) return [];

  // 1. Try Google Maps JS SDK Geocoder instance if window.google is loaded
  if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.Geocoder) {
    return new Promise((resolve) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: queryStr.trim(), componentRestrictions: { country: 'IN' } }, (results, status) => {
        if (status === 'OK' && results) {
          resolve(results.map(r => {
            const hierarchy = extractGoogleLocationHierarchy(r);
            const loc = r.geometry.location;
            const rLat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
            const rLng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
            return {
              lat: rLat,
              lng: rLng,
              displayName: r.formatted_address,
              ...hierarchy
            };
          }));
        } else {
          resolve([]);
        }
      });
    });
  }

  // 2. Direct Google Maps Geocoding REST API request
  if (!GOOGLE_MAPS_KEY) {
    console.warn('Google Maps API key missing in VITE_GOOGLE_MAPS_API_KEY environment variable.');
    return [];
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(queryStr.trim())}&components=country:IN&key=${GOOGLE_MAPS_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === 'OK' && Array.isArray(data.results)) {
      return data.results.map(r => {
        const hierarchy = extractGoogleLocationHierarchy(r);
        const loc = r.geometry.location;
        return {
          lat: loc.lat,
          lng: loc.lng,
          displayName: r.formatted_address,
          ...hierarchy
        };
      });
    }
  } catch (err) {
    console.warn('Google Maps Geocoding search error:', err.message);
  }

  return [];
}

/**
 * Fallback geocode search when Places predictions return ZERO_RESULTS
 */
async function fallbackGeocodeSearch(trimmed) {
  try {
    const results = await searchLocationQuery(trimmed);
    return results.map((r, idx) => {
      const parts = (r.displayName || '').split(',');
      const mainText = parts[0]?.trim() || trimmed;
      const secondaryText = parts.slice(1).join(',').trim();
      return {
        placeId: `geo_${idx}_${Date.now()}`,
        mainText,
        secondaryText,
        description: r.displayName || trimmed,
        lat: r.lat,
        lng: r.lng,
        hierarchy: r
      };
    });
  } catch (e) {
    return [];
  }
}

let placesAutocompleteServiceInstance = null;
let placesDetailsServiceInstance = null;

/**
 * Fetch live Google Places Autocomplete predictions (Restricted to India)
 */
export async function fetchGooglePlacesPredictions(queryStr) {
  if (!queryStr || typeof queryStr !== 'string' || queryStr.trim().length < 2) {
    return [];
  }

  const trimmed = queryStr.trim();

  try {
    const maps = await loadGoogleMapsScript();
    if (maps && maps.places && maps.places.AutocompleteService) {
      if (!placesAutocompleteServiceInstance) {
        placesAutocompleteServiceInstance = new maps.places.AutocompleteService();
      }

      return new Promise((resolve) => {
        placesAutocompleteServiceInstance.getPlacePredictions(
          {
            input: trimmed,
            componentRestrictions: { country: 'in' },
          },
          (predictions, status) => {
            if (
              status === maps.places.PlacesServiceStatus.OK &&
              Array.isArray(predictions) &&
              predictions.length > 0
            ) {
              const formatted = predictions.map((p) => ({
                placeId: p.place_id,
                mainText: p.structured_formatting?.main_text || p.description,
                secondaryText: p.structured_formatting?.secondary_text || '',
                description: p.description,
                types: p.types || []
              }));
              resolve(formatted);
            } else {
              fallbackGeocodeSearch(trimmed).then(resolve);
            }
          }
        );
      });
    }
  } catch (err) {
    console.warn('Google Places predictions load error:', err.message);
  }

  return fallbackGeocodeSearch(trimmed);
}

/**
 * Fetch deep Google Place Details with coordinates and administrative hierarchy
 */
export async function fetchGooglePlaceDetails(placeId, fallbackName = '') {
  if (!placeId) return null;

  try {
    const maps = await loadGoogleMapsScript();
    if (maps && maps.places) {
      if (!placesDetailsServiceInstance) {
        const dummy = document.createElement('div');
        placesDetailsServiceInstance = new maps.places.PlacesService(dummy);
      }

      return new Promise((resolve) => {
        placesDetailsServiceInstance.getDetails(
          {
            placeId: placeId,
            fields: ['geometry', 'address_components', 'formatted_address', 'name']
          },
          (place, status) => {
            if (status === maps.places.PlacesServiceStatus.OK && place && place.geometry) {
              const loc = place.geometry.location;
              const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
              const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
              const hierarchy = extractGoogleLocationHierarchy(place);

              resolve({
                placeId,
                lat,
                lng,
                name: place.name || fallbackName,
                displayName: place.formatted_address || place.name || fallbackName,
                hierarchy: {
                  ...hierarchy,
                  address: place.formatted_address || hierarchy.address
                }
              });
            } else {
              // Fallback to Geocoder placeId lookup
              if (maps.Geocoder) {
                const geocoder = new maps.Geocoder();
                geocoder.geocode({ placeId }, (results, gStatus) => {
                  if (gStatus === 'OK' && results && results[0]) {
                    const r = results[0];
                    const loc = r.geometry.location;
                    const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
                    const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
                    const hierarchy = extractGoogleLocationHierarchy(r);
                    resolve({
                      placeId,
                      lat,
                      lng,
                      name: fallbackName || r.formatted_address,
                      displayName: r.formatted_address,
                      hierarchy: {
                        ...hierarchy,
                        address: r.formatted_address
                      }
                    });
                    return;
                  }
                  resolve(null);
                });
              } else {
                resolve(null);
              }
            }
          }
        );
      });
    }
  } catch (err) {
    console.warn('Google Place Details error:', err.message);
  }

  return null;
}

/**
 * Geocode a place/locality string with full administrative hierarchy and coordinates
 */
export async function geocodePlaceWithHierarchy(queryStr) {
  if (!queryStr || typeof queryStr !== 'string' || !queryStr.trim()) return null;
  const results = await searchLocationQuery(queryStr.trim());
  if (Array.isArray(results) && results.length > 0) {
    return results[0];
  }
  return null;
}

/**
 * Extract canonical boundary polygon array [[lat, lng], ...] from any property format
 */
export function extractBoundaryPolygon(item) {
  if (!item) return [];

  let boundObj = item.boundary || item.ownerSubmittedBoundary;
  if (typeof boundObj === 'string') {
    try { boundObj = JSON.parse(boundObj); } catch (e) { boundObj = null; }
  }

  let rawPoly = Array.isArray(boundObj)
    ? boundObj
    : (
      boundObj?.vertices ||
      boundObj?.approvedPolygon ||
      boundObj?.coordinates ||
      boundObj?.points ||
      boundObj?.polygon ||
      (Array.isArray(item.boundary) ? item.boundary : null) ||
      (Array.isArray(item.ownerSubmittedBoundary) ? item.ownerSubmittedBoundary : null)
    );

  if (typeof rawPoly === 'string') {
    try { rawPoly = JSON.parse(rawPoly); } catch (e) { rawPoly = null; }
  }

  if (rawPoly && typeof rawPoly === 'object' && !Array.isArray(rawPoly)) {
    rawPoly = rawPoly.vertices || rawPoly.approvedPolygon || rawPoly.coordinates || rawPoly.points || rawPoly.polygon || null;
  }

  if (!rawPoly || !Array.isArray(rawPoly) || rawPoly.length < 3) return [];

  return rawPoly.map(pt => {
    if (Array.isArray(pt) && pt.length >= 2) return [Number(pt[0]), Number(pt[1])];
    if (pt && typeof pt === 'object') return [Number(pt.lat ?? pt.latitude), Number(pt.lng ?? pt.longitude)];
    return null;
  }).filter(pt => pt && !isNaN(pt[0]) && !isNaN(pt[1]));
}

/**
 * Extract canonical lat and lng numbers from any property format (object, stringified JSON, GeoPoint, centroid)
 */
export function extractCoordinates(item) {
  if (!item) return { lat: NaN, lng: NaN };

  // 1. Priority 1: If property has a boundary polygon, ALWAYS use polygon centroid for 100% exact plot alignment
  const formattedPoly = extractBoundaryPolygon(item);
  if (formattedPoly && formattedPoly.length >= 3) {
    let sumLat = 0;
    let sumLng = 0;
    formattedPoly.forEach(pt => {
      sumLat += pt[0];
      sumLng += pt[1];
    });
    return {
      lat: sumLat / formattedPoly.length,
      lng: sumLng / formattedPoly.length
    };
  }

  let loc = item.location;
  if (typeof loc === 'string') {
    try { loc = JSON.parse(loc); } catch (e) { loc = null; }
  }

  let centroid = item.centroid;
  if (typeof centroid === 'string') {
    try { centroid = JSON.parse(centroid); } catch (e) { centroid = null; }
  }

  // 2. Check centroid
  let lat = Number(centroid?.lat ?? centroid?.latitude);
  let lng = Number(centroid?.lng ?? centroid?.longitude);

  // 3. Check location
  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    lat = Number(
      loc?.lat ??
      loc?.latitude ??
      loc?.geoPoint?.latitude ??
      (Array.isArray(loc?.coordinates) ? loc.coordinates[1] : undefined)
    );
    lng = Number(
      loc?.lng ??
      loc?.longitude ??
      loc?.geoPoint?.longitude ??
      (Array.isArray(loc?.coordinates) ? loc.coordinates[0] : undefined)
    );
  }

  // 4. Check direct item properties
  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    lat = Number(item.lat ?? item.latitude ?? item.centroidLat);
    lng = Number(item.lng ?? item.longitude ?? item.centroidLng);
  }

  return { lat, lng };
}

/**
 * Canonical coordinates dictionary for known hubs and cities across AP, Telangana, and Pan-India
 */
export const KNOWN_PLACE_COORDS = {
  // Andhra Pradesh
  'amaravati': { lat: 16.5131, lng: 80.5165, name: 'Amaravati' },
  'amaravathi': { lat: 16.5131, lng: 80.5165, name: 'Amaravati' },
  'guntur': { lat: 16.3067, lng: 80.4365, name: 'Guntur' },
  'vijayawada': { lat: 16.5062, lng: 80.6480, name: 'Vijayawada' },
  'mangalagiri': { lat: 16.4300, lng: 80.5600, name: 'Mangalagiri' },
  'tenali': { lat: 16.2430, lng: 80.6400, name: 'Tenali' },
  'tadepalli': { lat: 16.4800, lng: 80.6000, name: 'Tadepalli' },
  'brodipet': { lat: 16.3090, lng: 80.4370, name: 'Brodipet, Guntur' },
  'arundelpet': { lat: 16.3080, lng: 80.4320, name: 'Arundelpet, Guntur' },
  'kannavarithota': { lat: 16.3010, lng: 80.4420, name: 'Kannavarithota, Guntur' },
  'pattabhipuram': { lat: 16.3040, lng: 80.4280, name: 'Pattabhipuram, Guntur' },
  'syndicate nagar': { lat: 16.3150, lng: 80.4250, name: 'Syndicate Nagar, Guntur' },
  'kaza': { lat: 16.4020, lng: 80.5520, name: 'Kaza' },
  'navuluru': { lat: 16.4400, lng: 80.5500, name: 'Navuluru, Mangalagiri' },
  'namburu': { lat: 16.3800, lng: 80.5200, name: 'Namburu' },
  'benz circle': { lat: 16.4998, lng: 80.6543, name: 'Benz Circle, Vijayawada' },
  'kanuru': { lat: 16.4900, lng: 80.6900, name: 'Kanuru, Vijayawada' },
  'poranki': { lat: 16.4800, lng: 80.7100, name: 'Poranki, Vijayawada' },
  'gannavaram': { lat: 16.5380, lng: 80.8030, name: 'Gannavaram' },
  'visakhapatnam': { lat: 17.6868, lng: 83.2185, name: 'Visakhapatnam' },
  'vizag': { lat: 17.6868, lng: 83.2185, name: 'Visakhapatnam' },
  'tirupati': { lat: 13.6288, lng: 79.4192, name: 'Tirupati' },
  'rajahmundry': { lat: 17.0005, lng: 81.8040, name: 'Rajahmundry' },
  'kakinada': { lat: 16.9891, lng: 82.2475, name: 'Kakinada' },
  'nellore': { lat: 14.4426, lng: 79.9865, name: 'Nellore' },
  'kurnool': { lat: 15.8281, lng: 78.0373, name: 'Kurnool' },
  'kadapa': { lat: 14.4673, lng: 78.8242, name: 'Kadapa' },
  'anantapur': { lat: 14.6819, lng: 77.6006, name: 'Anantapur' },
  'ongole': { lat: 15.5057, lng: 80.0499, name: 'Ongole' },
  'eluru': { lat: 16.7107, lng: 81.0952, name: 'Eluru' },
  'machilipatnam': { lat: 16.1875, lng: 81.1389, name: 'Machilipatnam' },

  // Telangana
  'hyderabad': { lat: 17.3850, lng: 78.4867, name: 'Hyderabad' },
  'secunderabad': { lat: 17.4399, lng: 78.4983, name: 'Secunderabad' },
  'gachibowli': { lat: 17.4401, lng: 78.3489, name: 'Gachibowli, Hyderabad' },
  'hitec city': { lat: 17.4474, lng: 78.3762, name: 'Hitec City, Hyderabad' },
  'madhapur': { lat: 17.4483, lng: 78.3915, name: 'Madhapur, Hyderabad' },
  'kondapur': { lat: 17.4699, lng: 78.3578, name: 'Kondapur, Hyderabad' },
  'jubilee hills': { lat: 17.4319, lng: 78.4073, name: 'Jubilee Hills, Hyderabad' },
  'banjara hills': { lat: 17.4156, lng: 78.4350, name: 'Banjara Hills, Hyderabad' },
  'kukatpally': { lat: 17.4849, lng: 78.4138, name: 'Kukatpally, Hyderabad' },
  'miyapur': { lat: 17.4968, lng: 78.3614, name: 'Miyapur, Hyderabad' },
  'manikonda': { lat: 17.3986, lng: 78.3847, name: 'Manikonda, Hyderabad' },
  'tellapur': { lat: 17.4589, lng: 78.2750, name: 'Tellapur, Hyderabad' },
  'narsingi': { lat: 17.3860, lng: 78.3560, name: 'Narsingi, Hyderabad' },
  'shamshabad': { lat: 17.2403, lng: 78.4294, name: 'Shamshabad, Hyderabad' },
  'warangal': { lat: 17.9689, lng: 79.5941, name: 'Warangal' },

  // Pan-India Metros
  'bengaluru': { lat: 12.9716, lng: 77.5946, name: 'Bengaluru' },
  'bangalore': { lat: 12.9716, lng: 77.5946, name: 'Bengaluru' },
  'whitefield': { lat: 12.9698, lng: 77.7500, name: 'Whitefield, Bengaluru' },
  'indiranagar': { lat: 12.9784, lng: 77.6408, name: 'Indiranagar, Bengaluru' },
  'chennai': { lat: 13.0827, lng: 80.2707, name: 'Chennai' },
  'mumbai': { lat: 19.0760, lng: 72.8777, name: 'Mumbai' },
  'delhi': { lat: 28.6139, lng: 77.2090, name: 'Delhi' },
  'pune': { lat: 18.5204, lng: 73.8567, name: 'Pune' },
  'kolkata': { lat: 22.5726, lng: 88.3639, name: 'Kolkata' }
};

/**
 * Resolve canonical coordinates for a place name string from known hubs or partial matching
 */
export function resolvePlaceCoordinates(placeName) {
  if (!placeName || typeof placeName !== 'string') return null;
  const cleaned = placeName.trim().toLowerCase();
  if (KNOWN_PLACE_COORDS[cleaned]) {
    return KNOWN_PLACE_COORDS[cleaned];
  }
  const keyMatch = Object.keys(KNOWN_PLACE_COORDS).find(k => cleaned.includes(k) || k.includes(cleaned));
  if (keyMatch) {
    return KNOWN_PLACE_COORDS[keyMatch];
  }
  return null;
}

/**
 * Calculate Spherical Haversine Distance between two coordinates in kilometers
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371; // Earth's mean radius in km
  const dLat = (Number(lat2) - Number(lat1)) * (Math.PI / 180);
  const dLon = (Number(lon2) - Number(lon1)) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(Number(lat1) * (Math.PI / 180)) * Math.cos(Number(lat2) * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

