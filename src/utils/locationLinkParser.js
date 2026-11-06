/**
 * EaseLand Universal Location Link & Coordinates Parser
 * Supports pasting Google Maps, Apple Maps, OpenStreetMap links and raw GPS coordinates
 * directly into search bars across the platform.
 * 
 * Supports:
 * - Google Maps Share Short Links: https://maps.app.goo.gl/xyz, https://goo.gl/maps/xyz
 * - Google Maps Standard Place URLs: https://www.google.com/maps/place/Brodipet/@16.3090,80.4370,17z
 * - Google Maps Coordinate URLs: https://maps.google.com/?q=16.3090,80.4370, https://www.google.com/maps?ll=16.3090,80.4370
 * - Google Maps Protobuf Data URLs: !3d16.3090!4d80.4370
 * - Apple Maps URLs: https://maps.apple.com/?ll=16.3090,80.4370, https://maps.apple.com/?q=16.3090,80.4370
 * - OpenStreetMap URLs: https://www.openstreetmap.org/#map=16/16.3090/80.4370
 * - Geo URIs: geo:16.3090,80.4370
 * - Decimal Coordinates: "16.3090, 80.4370", "16.3090 80.4370", "16.3090N, 80.4370E"
 * - Degrees Minutes Seconds (DMS): 16°18'32.4"N 80°26'13.2"E
 */

import { reverseGeocodeLocation, searchLocationQuery } from '../services/locationProvider.js';

/**
 * Check if the input string is a map URL, Geo URI, or raw coordinate string
 */
export function isLocationLinkOrCoordinates(inputStr) {
  if (!inputStr || typeof inputStr !== 'string') return false;
  const raw = inputStr.trim();
  if (raw.length < 3) return false;

  // 1. Map URL signatures
  if (/^https?:\/\//i.test(raw) || /^(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.|google\.[a-z.]+\/maps|maps\.apple\.com|openstreetmap\.org)/i.test(raw)) {
    return true;
  }

  // 2. Geo URI scheme
  if (/^geo:[-+]?\d+/i.test(raw)) {
    return true;
  }

  // 3. Raw decimal coordinates format: "16.506174, 80.648015" or "16.506174N, 80.648015E"
  const rawCoordRegex = /^[-+]?([0-8]?\d(?:\.\d+)?|90(?:\.0+)?)\s*[NSns]?[,\s]+[-+]?(180(?:\.0+)?|(?:1[0-7]\d|\d{1,2})(?:\.\d+)?)\s*[EWew]?$/;
  if (rawCoordRegex.test(raw)) {
    return true;
  }

  // 4. DMS (Degrees Minutes Seconds) coordinates: 16°30'22.2"N 80°38'52.9"E
  const dmsRegex = /([0-8]?\d|90)[°\s]+(\d+)['\s]+(\d+(?:\.\d+)?)\"?\s*([NSns])[,\s]+(180|(?:1[0-7]\d|\d{1,2}))[°\s]+(\d+)['\s]+(\d+(?:\.\d+)?)\"?\s*([EWew])/i;
  if (dmsRegex.test(raw)) {
    return true;
  }

  return false;
}

/**
 * Synchronous parser that extracts coordinates or place identifiers from location input
 */
export function parseLocationInput(inputStr) {
  if (!inputStr || typeof inputStr !== 'string') return null;
  const raw = inputStr.trim();
  if (!raw) return null;

  // 1. Raw Decimal Coordinates format
  const rawCoordRegex = /^[-+]?([0-8]?\d(?:\.\d+)?|90(?:\.0+)?)\s*([NSns])?[,\s]+[-+]?(180(?:\.0+)?|(?:1[0-7]\d|\d{1,2})(?:\.\d+)?)\s*([EWew])?$/;
  const directMatch = raw.match(rawCoordRegex);
  if (directMatch) {
    let lat = parseFloat(directMatch[1]);
    const latDir = (directMatch[2] || '').toUpperCase();
    if (latDir === 'S') lat = -lat;

    let lng = parseFloat(directMatch[3]);
    const lngDir = (directMatch[4] || '').toUpperCase();
    if (lngDir === 'W') lng = -lng;

    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        type: 'COORDINATES',
        lat,
        lng,
        placeName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        source: 'RAW_COORDINATES'
      };
    }
  }

  // 2. DMS format: 16°30'22.2"N 80°38'52.9"E
  const dmsRegex = /([0-8]?\d|90)[°\s]+(\d+)['\s]+(\d+(?:\.\d+)?)\"?\s*([NSns])[,\s]+(180|(?:1[0-7]\d|\d{1,2}))[°\s]+(\d+)['\s]+(\d+(?:\.\d+)?)\"?\s*([EWew])/i;
  const dmsMatch = raw.match(dmsRegex);
  if (dmsMatch) {
    const latDeg = parseFloat(dmsMatch[1]);
    const latMin = parseFloat(dmsMatch[2]);
    const latSec = parseFloat(dmsMatch[3]);
    const latDir = dmsMatch[4].toUpperCase();

    const lngDeg = parseFloat(dmsMatch[5]);
    const lngMin = parseFloat(dmsMatch[6]);
    const lngSec = parseFloat(dmsMatch[7]);
    const lngDir = dmsMatch[8].toUpperCase();

    let lat = latDeg + latMin / 60 + latSec / 3600;
    if (latDir === 'S') lat = -lat;

    let lng = lngDeg + lngMin / 60 + lngSec / 3600;
    if (lngDir === 'W') lng = -lng;

    return {
      type: 'COORDINATES',
      lat,
      lng,
      placeName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      source: 'DMS_COORDINATES'
    };
  }

  // 3. Geo URI scheme: geo:16.506174,80.648015
  if (raw.toLowerCase().startsWith('geo:')) {
    const geoMatch = raw.match(/geo:([-+]?\d+(?:\.\d+)?),([-+]?\d+(?:\.\d+)?)/i);
    if (geoMatch) {
      const lat = parseFloat(geoMatch[1]);
      const lng = parseFloat(geoMatch[2]);
      return {
        type: 'COORDINATES',
        lat,
        lng,
        placeName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        source: 'GEO_URI'
      };
    }
  }

  // 4. URL detection
  const isUrl = /^https?:\/\//i.test(raw) || /^(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.|google\.[a-z.]+\/maps|maps\.apple\.com|openstreetmap\.org)/i.test(raw);
  if (isUrl) {
    let cleanUrl = raw;
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }

    // Check for Shortened Google Maps links
    if (/maps\.app\.goo\.gl\/|goo\.gl\/maps\//i.test(cleanUrl)) {
      return {
        type: 'SHORT_URL',
        url: cleanUrl,
        source: 'GOOGLE_MAPS_SHORT_URL'
      };
    }

    // 4a. Google Maps @lat,lng pattern
    const atCoordMatch = cleanUrl.match(/@([-+]?\d+(?:\.\d+)?),([-+]?\d+(?:\.\d+)?)/);
    let placeFromPath = '';
    const placeMatch = cleanUrl.match(/\/place\/([^/@?#]+)/);
    if (placeMatch) {
      try {
        placeFromPath = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      } catch (e) {
        placeFromPath = placeMatch[1].replace(/\+/g, ' ');
      }
    }

    if (atCoordMatch) {
      const lat = parseFloat(atCoordMatch[1]);
      const lng = parseFloat(atCoordMatch[2]);
      return {
        type: 'COORDINATES',
        lat,
        lng,
        placeName: placeFromPath || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        source: 'GOOGLE_MAPS_AT_URL'
      };
    }

    // 4b. Query parameters: q=lat,lng, query=lat,lng, ll=lat,lng, daddr=lat,lng
    const queryCoordMatch = cleanUrl.match(/[?&](?:q|query|ll|daddr|saddr|center|mlat)=([-+]?\d+(?:\.\d+)?)(?:%2C|,|&mlon=)([-+]?\d+(?:\.\d+)?)/i);
    if (queryCoordMatch) {
      const lat = parseFloat(queryCoordMatch[1]);
      const lng = parseFloat(queryCoordMatch[2]);
      return {
        type: 'COORDINATES',
        lat,
        lng,
        placeName: placeFromPath || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        source: 'MAPS_QUERY_PARAM_URL'
      };
    }

    // 4c. Google Maps protobuf format: !3d16.3090!4d80.4370
    const protoCoordMatch = cleanUrl.match(/!3d([-+]?\d+(?:\.\d+)?)(?:!4d|.*!4d)([-+]?\d+(?:\.\d+)?)/);
    if (protoCoordMatch) {
      const lat = parseFloat(protoCoordMatch[1]);
      const lng = parseFloat(protoCoordMatch[2]);
      return {
        type: 'COORDINATES',
        lat,
        lng,
        placeName: placeFromPath || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        source: 'GOOGLE_MAPS_PROTOBUF_URL'
      };
    }

    // 4d. OpenStreetMap #map=zoom/lat/lng
    const osmMapMatch = cleanUrl.match(/#map=\d+\/([-+]?\d+(?:\.\d+)?)\/([-+]?\d+(?:\.\d+)?)/);
    if (osmMapMatch) {
      const lat = parseFloat(osmMapMatch[1]);
      const lng = parseFloat(osmMapMatch[2]);
      return {
        type: 'COORDINATES',
        lat,
        lng,
        placeName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        source: 'OPENSTREETMAP_URL'
      };
    }

    // 4e. Path-based coordinates: /place/16.3090,80.4370 or /search/16.3090,80.4370
    const pathCoordMatch = cleanUrl.match(/\/(?:place|search)\/([-+]?\d+(?:\.\d+)?)[,+]+([-+]?\d+(?:\.\d+)?)/i);
    if (pathCoordMatch) {
      const lat = parseFloat(pathCoordMatch[1]);
      const lng = parseFloat(pathCoordMatch[2]);
      return {
        type: 'COORDINATES',
        lat,
        lng,
        placeName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        source: 'GOOGLE_MAPS_PATH_COORDINATES'
      };
    }

    // 4f. Place name encoded in Google Maps /place URL without explicit coordinates
    if (placeFromPath && !/\d+°\d+'/.test(placeFromPath)) {
      return {
        type: 'PLACE_NAME',
        placeName: placeFromPath,
        source: 'GOOGLE_MAPS_PLACE_NAME'
      };
    }

    // 4g. Place name in query parameter: e.g. https://maps.google.com/?q=Brodipet+Guntur
    const queryTextMatch = cleanUrl.match(/[?&](?:q|query)=([^&#]+)/i);
    if (queryTextMatch) {
      try {
        const decodedQuery = decodeURIComponent(queryTextMatch[1].replace(/\+/g, ' '));
        return {
          type: 'PLACE_NAME',
          placeName: decodedQuery,
          source: 'GOOGLE_MAPS_QUERY_NAME'
        };
      } catch (e) {
        return {
          type: 'PLACE_NAME',
          placeName: queryTextMatch[1].replace(/\+/g, ' '),
          source: 'GOOGLE_MAPS_QUERY_NAME'
        };
      }
    }
  }

  return null;
}

/**
 * Expand shortened Google Maps URL via backend redirect-resolver API
 */
export async function expandShortLocationUrl(shortUrl) {
  if (!shortUrl) return null;
  try {
    const res = await fetch('/api/resolve-location-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: shortUrl })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.parsed) {
        return data.parsed;
      }
      if (data && data.finalUrl) {
        return parseLocationInput(data.finalUrl);
      }
    }
  } catch (err) {
    console.warn('Backend short location URL resolution failed:', err);
  }
  return null;
}

/**
 * Master Resolver: Accepts a URL or coordinate string and resolves full coordinates + administrative hierarchy
 */
export async function resolveLocationLink(inputStr) {
  if (!inputStr || typeof inputStr !== 'string') return null;

  let parsed = parseLocationInput(inputStr);
  if (!parsed) return null;

  // Handle Short URLs via backend expander
  if (parsed.type === 'SHORT_URL') {
    const expanded = await expandShortLocationUrl(parsed.url);
    if (expanded) {
      parsed = expanded;
    }
  }

  // If coordinates are extracted, reverse-geocode via Google Maps Geocoding API
  if (parsed && parsed.lat != null && parsed.lng != null && !isNaN(parsed.lat) && !isNaN(parsed.lng)) {
    const lat = Number(parsed.lat);
    const lng = Number(parsed.lng);
    let hierarchy = null;
    let formattedAddress = '';
    let resolvedName = parsed.placeName || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    try {
      hierarchy = await reverseGeocodeLocation(lat, lng);
      if (hierarchy) {
        formattedAddress = hierarchy.address || '';
        resolvedName = hierarchy.locality || hierarchy.city || hierarchy.district || resolvedName;
      }
    } catch (err) {
      console.warn('Reverse geocode in resolveLocationLink failed:', err);
    }

    return {
      success: true,
      lat,
      lng,
      placeName: resolvedName,
      formattedAddress: formattedAddress || resolvedName,
      hierarchy: hierarchy || {
        country: 'India',
        state: '',
        district: '',
        city: '',
        locality: '',
        address: formattedAddress || resolvedName
      },
      source: parsed.source
    };
  }

  // If only place name is available, forward-geocode via Google Places / Geocoder
  if (parsed && parsed.placeName) {
    try {
      const searchResults = await searchLocationQuery(parsed.placeName);
      if (Array.isArray(searchResults) && searchResults.length > 0 && searchResults[0].lat && searchResults[0].lng) {
        const top = searchResults[0];
        return {
          success: true,
          lat: Number(top.lat),
          lng: Number(top.lng),
          placeName: top.displayName || parsed.placeName,
          formattedAddress: top.displayName || parsed.placeName,
          hierarchy: top,
          source: parsed.source
        };
      }
    } catch (err) {
      console.warn('Forward geocode in resolveLocationLink failed:', err);
    }
  }

  return null;
}

