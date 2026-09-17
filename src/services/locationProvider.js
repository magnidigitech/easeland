/**
 * EaseLand Location & Geocoding Provider Abstraction Layer
 * Exclusively powered by Google Maps Platform APIs (Geocoding API & Device Geolocation API).
 * Nominatim / OpenStreetMap fallbacks have been completely removed.
 */

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

/**
 * Helper to dynamically load Google Maps JS SDK script if not already present
 */
export function loadGoogleMapsScript() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      return resolve(window.google.maps);
    }
    if (document.getElementById('google-maps-js-sdk')) {
      const interval = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(interval);
          resolve(window.google.maps);
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

  return {
    country: getComp('country') || 'India',
    state: getComp('administrative_area_level_1'),
    district: getComp('administrative_area_level_2'),
    city: getComp('locality') || getComp('administrative_area_level_3') || getComp('sublocality_level_1'),
    mandal: getComp('administrative_area_level_3') || getComp('sublocality_level_1'),
    locality: getComp('sublocality_level_1') || getComp('sublocality') || getComp('neighborhood'),
    subLocality: getComp('sublocality_level_2') || getComp('neighborhood'),
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
  if (window.google && window.google.maps && window.google.maps.Geocoder) {
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
  if (window.google && window.google.maps && window.google.maps.Geocoder) {
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

  let loc = item.location;
  if (typeof loc === 'string') {
    try { loc = JSON.parse(loc); } catch (e) { loc = null; }
  }

  let centroid = item.centroid;
  if (typeof centroid === 'string') {
    try { centroid = JSON.parse(centroid); } catch (e) { centroid = null; }
  }

  // 1. Check centroid
  let lat = Number(centroid?.lat ?? centroid?.latitude);
  let lng = Number(centroid?.lng ?? centroid?.longitude);

  // 2. Check location
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

  // 3. Check direct item properties
  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    lat = Number(item.lat ?? item.latitude ?? item.centroidLat);
    lng = Number(item.lng ?? item.longitude ?? item.centroidLng);
  }

  // 4. Check boundary centroid if polygon exists
  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    const formattedPoly = extractBoundaryPolygon(item);
    if (formattedPoly && formattedPoly.length >= 3) {
      let sumLat = 0;
      let sumLng = 0;
      formattedPoly.forEach(pt => {
        sumLat += pt[0];
        sumLng += pt[1];
      });
      lat = sumLat / formattedPoly.length;
      lng = sumLng / formattedPoly.length;
    }
  }

  return { lat, lng };
}

