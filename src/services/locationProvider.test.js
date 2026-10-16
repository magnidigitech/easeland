import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractGoogleLocationHierarchy,
  buildEmptyLocationHierarchy,
  calculateDistanceKm,
  resolvePlaceCoordinates,
  extractBoundaryPolygon,
  extractCoordinates,
  fetchGooglePlacesPredictions
} from './locationProvider.js';

describe('EaseLand Location Provider & Google Places Hierarchy Suite', () => {
  it('extracts complete Indian administrative hierarchy from Google address_components', () => {
    const mockGoogleGeocodeResult = {
      formatted_address: 'Dr no: 5-93-19, Ground Floor, 6/13, opposite Krisals Apartment, Brodipet, Guntur, Andhra Pradesh 522002, India',
      address_components: [
        { long_name: '5-93-19', types: ['premise'] },
        { long_name: '6/13', types: ['route'] },
        { long_name: 'Brodipet', types: ['sublocality_level_1', 'sublocality', 'political'] },
        { long_name: 'Guntur', types: ['locality', 'political'] },
        { long_name: 'Guntur', types: ['administrative_area_level_3', 'political'] },
        { long_name: 'Guntur', types: ['administrative_area_level_2', 'political'] },
        { long_name: 'Andhra Pradesh', types: ['administrative_area_level_1', 'political'] },
        { long_name: 'India', types: ['country', 'political'] },
        { long_name: '522002', types: ['postal_code'] }
      ]
    };

    const hierarchy = extractGoogleLocationHierarchy(mockGoogleGeocodeResult);

    assert.strictEqual(hierarchy.country, 'India');
    assert.strictEqual(hierarchy.state, 'Andhra Pradesh');
    assert.strictEqual(hierarchy.district, 'Guntur');
    assert.strictEqual(hierarchy.city, 'Guntur');
    assert.strictEqual(hierarchy.locality, 'Brodipet');
    assert.strictEqual(hierarchy.postalCode, '522002');
    assert.strictEqual(hierarchy.road, '6/13');
    assert.strictEqual(hierarchy.colony, '5-93-19');
    assert.strictEqual(
      hierarchy.address,
      'Dr no: 5-93-19, Ground Floor, 6/13, opposite Krisals Apartment, Brodipet, Guntur, Andhra Pradesh 522002, India'
    );
  });

  it('gracefully handles empty or missing geocode objects with un-fabricated defaults', () => {
    const empty = extractGoogleLocationHierarchy(null);
    assert.strictEqual(empty.country, 'India');
    assert.strictEqual(empty.state, '');
    assert.strictEqual(empty.city, '');
    assert.strictEqual(empty.postalCode, '');
  });

  it('accurately resolves canonical coordinates for known hubs across India', () => {
    const guntur = resolvePlaceCoordinates('Guntur');
    assert.ok(guntur);
    assert.strictEqual(guntur.lat, 16.3067);
    assert.strictEqual(guntur.lng, 80.4365);

    const brodipet = resolvePlaceCoordinates('Brodipet');
    assert.ok(brodipet);
    assert.strictEqual(brodipet.lat, 16.3090);
    assert.strictEqual(brodipet.lng, 80.4370);

    const hyderabad = resolvePlaceCoordinates('Hyderabad');
    assert.ok(hyderabad);
    assert.strictEqual(hyderabad.lat, 17.3850);
  });

  it('calculates spherical haversine distance correctly between two coordinates in km', () => {
    // Distance between Guntur and Vijayawada (~32-35 km)
    const dist = calculateDistanceKm(16.3067, 80.4365, 16.5062, 80.6480);
    assert.ok(dist >= 30 && dist <= 40, `Expected distance ~32km, got ${dist}`);
  });

  it('extracts centroid coordinates accurately when property has boundary polygon', () => {
    const propertyWithPoly = {
      boundary: [
        [16.30, 80.40],
        [16.32, 80.40],
        [16.32, 80.42],
        [16.30, 80.42]
      ]
    };

    const coords = extractCoordinates(propertyWithPoly);
    assert.strictEqual(Number(coords.lat.toFixed(2)), 16.31);
    assert.strictEqual(Number(coords.lng.toFixed(2)), 80.41);
  });

  it('rejects short query strings in fetchGooglePlacesPredictions', async () => {
    const emptyRes = await fetchGooglePlacesPredictions('');
    assert.deepStrictEqual(emptyRes, []);

    const shortRes = await fetchGooglePlacesPredictions('a');
    assert.deepStrictEqual(shortRes, []);
  });

  it('serializes and parses search coordinates accurately into URL parameters', async () => {
    const { searchStateToUrlParams, urlParamsToSearchState } = await import('../firebase/searchUrl.js');
    const state = {
      query: 'PC Overseas Education Pvt. Ltd.',
      searchLat: 16.310243,
      searchLng: 80.4338427
    };
    const url = searchStateToUrlParams(state);
    assert.ok(url.includes('lat=16.310243'), 'URL should contain lat param');
    assert.ok(url.includes('lng=80.4338427'), 'URL should contain lng param');

    const parsed = urlParamsToSearchState(url.replace('/properties', ''));
    assert.strictEqual(parsed.searchLat, 16.310243);
    assert.strictEqual(parsed.searchLng, 80.4338427);
  });

  it('measures distance accurately and enforces radius range properly', async () => {
    const { matchesSearchFilters } = await import('../utils/filterMatchingUtils.js');

    // Reference center: Brodipet, Guntur (16.3090, 80.4370)
    // Property A: Arundelpet (~0.8 km away)
    const propArundelpet = {
      id: 'prop-arundelpet',
      title: 'Commercial Space in Arundelpet',
      location: { city: 'Guntur', locality: 'Arundelpet', lat: 16.3035, lng: 80.4402 }
    };

    // Property B: Perecherla (~11 km away)
    const propPerecherla = {
      id: 'prop-perecherla',
      title: 'Residential Plot in Perecherla',
      location: { city: 'Guntur', locality: 'Perecherla', lat: 16.2917, lng: 80.3344 }
    };

    // Property C: Vijayawada (~33 km away)
    const propVijayawada = {
      id: 'prop-vijayawada',
      title: 'Villa in Benz Circle Vijayawada',
      location: { city: 'Vijayawada', locality: 'Benz Circle', lat: 16.4988, lng: 80.6558 }
    };

    // Case 1: Radius Within 1 km around Brodipet
    const filter1km = {
      referencePlace: 'Brodipet',
      referenceLat: 16.3090,
      referenceLng: 80.4370,
      radiusKm: 1
    };
    assert.strictEqual(matchesSearchFilters(propArundelpet, filter1km), true, 'Arundelpet (~0.8km) should be included within 1km');
    assert.strictEqual(propArundelpet.distKm != null && propArundelpet.distKm <= 1, true, 'distKm should be attached and <= 1');
    assert.strictEqual(matchesSearchFilters(propPerecherla, filter1km), false, 'Perecherla (~11km) should be excluded within 1km');
    assert.strictEqual(matchesSearchFilters(propVijayawada, filter1km), false, 'Vijayawada (~33km) should be excluded within 1km');

    // Case 2: Radius Within 5 km around Brodipet
    const filter5km = {
      referencePlace: 'Brodipet',
      referenceLat: 16.3090,
      referenceLng: 80.4370,
      radiusKm: 5
    };
    assert.strictEqual(matchesSearchFilters(propArundelpet, filter5km), true, 'Arundelpet should be included within 5km');
    assert.strictEqual(matchesSearchFilters(propPerecherla, filter5km), false, 'Perecherla (~11km) should be excluded within 5km');
    assert.strictEqual(matchesSearchFilters(propVijayawada, filter5km), false, 'Vijayawada (~33km) should be excluded within 5km');

    // Case 3: Radius Within 25 km around Brodipet
    const filter25km = {
      referencePlace: 'Brodipet',
      referenceLat: 16.3090,
      referenceLng: 80.4370,
      radiusKm: 25
    };
    assert.strictEqual(matchesSearchFilters(propArundelpet, filter25km), true, 'Arundelpet should be included within 25km');
    assert.strictEqual(matchesSearchFilters(propPerecherla, filter25km), true, 'Perecherla should be included within 25km');
    assert.strictEqual(matchesSearchFilters(propVijayawada, filter25km), false, 'Vijayawada (~33km) should be excluded within 25km');

    // Case 4: Radius Within 50 km around Brodipet
    const filter50km = {
      referencePlace: 'Brodipet',
      referenceLat: 16.3090,
      referenceLng: 80.4370,
      radiusKm: 50
    };
    assert.strictEqual(matchesSearchFilters(propArundelpet, filter50km), true, 'Arundelpet should be included within 50km');
    assert.strictEqual(matchesSearchFilters(propPerecherla, filter50km), true, 'Perecherla should be included within 50km');
    assert.strictEqual(matchesSearchFilters(propVijayawada, filter50km), true, 'Vijayawada (~33km) should be included within 50km');

    // Case 5: Any Distance (radiusKm is null) around Brodipet does not reject properties by distance
    const filterAnyDistance = {
      referencePlace: 'Brodipet',
      referenceLat: 16.3090,
      referenceLng: 80.4370,
      radiusKm: null
    };
    assert.strictEqual(matchesSearchFilters(propArundelpet, filterAnyDistance), true);
  });
});
