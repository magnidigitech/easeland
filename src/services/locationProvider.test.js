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
});
