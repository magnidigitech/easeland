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
    assert.ok(dist >= 30 && dist <= 40, 'Expected distance ~32km, got ' + dist);
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

    // Case 6: Text query with and without spatial search
    const queryFilterWithoutSpatial = {
      query: 'Arundelpet Commercial'
    };
    assert.strictEqual(matchesSearchFilters(propArundelpet, queryFilterWithoutSpatial), true);

    const queryFilterWithSpatial = {
      query: 'Commercial Space',
      referencePlace: 'Brodipet',
      referenceLat: 16.3090,
      referenceLng: 80.4370,
      radiusKm: 5
    };
    assert.strictEqual(matchesSearchFilters(propArundelpet, queryFilterWithSpatial), true);
  });
});

describe('EaseLand Distance Filter Consistency & Haversine Proximity Suite', () => {
  const gunturCenterLat = 16.3067;
  const gunturCenterLng = 80.4365;

  const propVidyanagar = {
    id: 'prop-vidyanagar',
    title: 'Furnished 3BHK in Vidyanagar',
    status: 'LIVE',
    listingStatus: 'LIVE',
    approvalStatus: 'APPROVED',
    adminApprovalStatus: 'APPROVED',
    isApproved: true,
    isLive: true,
    isBlocked: false,
    price: 20000000,
    purpose: 'SALE',
    propertyType: 'Apartment',
    furnishing: 'Furnished',
    facing: 'East',
    location: {
      city: 'Guntur',
      locality: 'Vidyanagar',
      lat: 16.3195,
      lng: 80.4300
    }
  };

  const propNear1km = {
    id: 'prop-near-1km',
    title: 'Plot within 1km boundary',
    status: 'LIVE',
    listingStatus: 'LIVE',
    approvalStatus: 'APPROVED',
    adminApprovalStatus: 'APPROVED',
    isApproved: true,
    isLive: true,
    isBlocked: false,
    price: 5000000,
    purpose: 'SALE',
    propertyType: 'Plot',
    furnishing: 'Unfurnished',
    facing: 'North',
    location: {
      city: 'Guntur',
      locality: 'Brodipet North',
      lat: 16.3155,
      lng: 80.4365
    }
  };

  const propPerecherla = {
    id: 'prop-perecherla',
    title: 'Fertile Land in Perecherla',
    status: 'LIVE',
    listingStatus: 'LIVE',
    approvalStatus: 'APPROVED',
    adminApprovalStatus: 'APPROVED',
    isApproved: true,
    isLive: true,
    isBlocked: false,
    price: 15000000,
    purpose: 'SALE',
    propertyType: 'Agricultural Land',
    furnishing: 'Unfurnished',
    facing: 'East',
    location: {
      city: 'Guntur',
      locality: 'Perecherla',
      lat: 16.2917,
      lng: 80.3450
    }
  };

  const propVijayawada = {
    id: 'prop-vijayawada',
    title: 'Villa in Benz Circle Vijayawada',
    status: 'LIVE',
    listingStatus: 'LIVE',
    approvalStatus: 'APPROVED',
    adminApprovalStatus: 'APPROVED',
    isApproved: true,
    isLive: true,
    isBlocked: false,
    price: 35000000,
    purpose: 'SALE',
    propertyType: 'Villa',
    furnishing: 'Furnished',
    facing: 'North-East',
    location: {
      city: 'Vijayawada',
      locality: 'Benz Circle',
      lat: 16.4988,
      lng: 80.6558
    }
  };

  it('1. Any Distance does not impose a radius restriction when radiusKm is null or any', async () => {
    const { matchesSearchFilters } = await import('../utils/filterMatchingUtils.js');
    const filterNull = {
      referencePlace: 'Guntur',
      referenceLat: gunturCenterLat,
      referenceLng: gunturCenterLng,
      radiusKm: null
    };
    const filterAny = {
      referencePlace: 'Guntur',
      referenceLat: gunturCenterLat,
      referenceLng: gunturCenterLng,
      radiusKm: 'any'
    };
    assert.strictEqual(matchesSearchFilters(propVidyanagar, filterNull), true);
    assert.strictEqual(matchesSearchFilters(propPerecherla, filterNull), true);
    assert.strictEqual(matchesSearchFilters(propVidyanagar, filterAny), true);
    assert.strictEqual(matchesSearchFilters(propPerecherla, filterAny), true);
  });

  it('2. Within 1 km returns eligible properties inside 1 km radius', async () => {
    const { matchesSearchFilters } = await import('../utils/filterMatchingUtils.js');
    const filter1km = {
      referencePlace: 'Guntur',
      referenceLat: gunturCenterLat,
      referenceLng: gunturCenterLng,
      radiusKm: 1
    };
    assert.strictEqual(matchesSearchFilters(propNear1km, filter1km), true);
    assert.ok(propNear1km.distKm != null && propNear1km.distKm <= 1.0);
  });

  it('3. Properties outside 1 km are excluded at 1 km but included at larger radius (e.g. 5 km)', async () => {
    const { matchesSearchFilters } = await import('../utils/filterMatchingUtils.js');
    const filter1km = {
      referencePlace: 'Guntur',
      referenceLat: gunturCenterLat,
      referenceLng: gunturCenterLng,
      radiusKm: 1
    };
    const filter5km = {
      referencePlace: 'Guntur',
      referenceLat: gunturCenterLat,
      referenceLng: gunturCenterLng,
      radiusKm: 5
    };
    assert.strictEqual(matchesSearchFilters(propVidyanagar, filter1km), false);
    assert.strictEqual(matchesSearchFilters(propVidyanagar, filter5km), true);
  });

  it('4. Each larger distance option applies the correct kilometre value (5, 10, 25, 50 km)', async () => {
    const { matchesSearchFilters } = await import('../utils/filterMatchingUtils.js');
    const baseFilter = {
      referencePlace: 'Guntur',
      referenceLat: gunturCenterLat,
      referenceLng: gunturCenterLng
    };
    assert.strictEqual(matchesSearchFilters(propPerecherla, { ...baseFilter, radiusKm: 5 }), false);
    assert.strictEqual(matchesSearchFilters(propPerecherla, { ...baseFilter, radiusKm: 10 }), true);
    assert.strictEqual(matchesSearchFilters(propPerecherla, { ...baseFilter, radiusKm: 25 }), true);
    assert.strictEqual(matchesSearchFilters(propPerecherla, { ...baseFilter, radiusKm: 50 }), true);

    assert.strictEqual(matchesSearchFilters(propVijayawada, { ...baseFilter, radiusKm: 25 }), false);
    assert.strictEqual(matchesSearchFilters(propVijayawada, { ...baseFilter, radiusKm: 50 }), true);
  });

  it('5. Boundary-distance comparison uses inclusive boundary for properties on the radius', async () => {
    const { matchesSearchFilters } = await import('../utils/filterMatchingUtils.js');
    const exactBoundaryProp = {
      id: 'prop-exact-boundary',
      location: { lat: 16.3157, lng: 80.4365, city: 'Guntur' }
    };
    const filterBoundary = {
      referenceLat: gunturCenterLat,
      referenceLng: gunturCenterLng,
      radiusKm: 1.0
    };
    const isMatched = matchesSearchFilters(exactBoundaryProp, filterBoundary);
    assert.strictEqual(isMatched, true);
  });

  it('6. Missing or invalid origin coordinates do not match spatial radius queries without valid coordinates', async () => {
    const { matchesSearchFilters } = await import('../utils/filterMatchingUtils.js');
    const filterInvalidOrigin = {
      referenceLat: null,
      referenceLng: null,
      radiusKm: 1
    };
    assert.strictEqual(matchesSearchFilters(propVidyanagar, filterInvalidOrigin), false);
  });

  it('7. Invalid property coordinates are handled safely without throwing errors', async () => {
    const { matchesSearchFilters } = await import('../utils/filterMatchingUtils.js');
    const propNoCoords = {
      id: 'prop-no-coords',
      title: 'Ungeocoded Property in Guntur',
      location: { city: 'Guntur' }
    };
    const propCorruptedCoords = {
      id: 'prop-nan-coords',
      title: 'Corrupted Coords Property',
      location: { lat: NaN, lng: 'invalid' }
    };
    const filter10km = {
      referencePlace: 'Guntur',
      referenceLat: gunturCenterLat,
      referenceLng: gunturCenterLng,
      radiusKm: 10
    };
    assert.doesNotThrow(() => {
      matchesSearchFilters(propNoCoords, filter10km);
      matchesSearchFilters(propCorruptedCoords, filter10km);
    });
  });

  it('8. Changing distance options updates results correctly across consecutive checks', async () => {
    const { matchesSearchFilters } = await import('../utils/filterMatchingUtils.js');
    const base = {
      referencePlace: 'Guntur',
      referenceLat: gunturCenterLat,
      referenceLng: gunturCenterLng
    };
    assert.strictEqual(matchesSearchFilters(propVidyanagar, { ...base, radiusKm: 1 }), false);
    assert.strictEqual(matchesSearchFilters(propVidyanagar, { ...base, radiusKm: 5 }), true);
    assert.strictEqual(matchesSearchFilters(propVidyanagar, { ...base, radiusKm: null }), true);
    assert.strictEqual(matchesSearchFilters(propVidyanagar, { ...base, radiusKm: 1 }), false);
  });

  it('9. Other filters (furnishing, facing, purpose) continue to work together with distance filter', async () => {
    const { matchesSearchFilters } = await import('../utils/filterMatchingUtils.js');
    const filterWithMultiple = {
      referencePlace: 'Guntur',
      referenceLat: gunturCenterLat,
      referenceLng: gunturCenterLng,
      radiusKm: 5,
      purpose: 'SALE',
      furnishing: 'Furnished',
      facing: 'East'
    };
    assert.strictEqual(matchesSearchFilters(propVidyanagar, filterWithMultiple), true);
    assert.strictEqual(matchesSearchFilters(propVidyanagar, { ...filterWithMultiple, furnishing: 'Unfurnished' }), false);
    assert.strictEqual(matchesSearchFilters(propVidyanagar, { ...filterWithMultiple, purpose: 'RENT' }), false);
  });

  it('10. Non-LIVE and unapproved properties are rejected from public visibility regardless of proximity', async () => {
    const { isPropertyPubliclyVisible } = await import('../utils/filterMatchingUtils.js');
    const unapprovedNearProp = {
      ...propNear1km,
      id: 'unapproved-near',
      adminApprovalStatus: 'PENDING',
      approvalStatus: 'PENDING',
      isApproved: false,
      isPlatformVerified: false,
      status: 'PENDING',
      listingStatus: 'PENDING'
    };
    const draftNearProp = {
      ...propNear1km,
      id: 'draft-near',
      listingStatus: 'DRAFT',
      status: 'DRAFT',
      isLive: false,
      isPublished: false
    };
    const blockedNearProp = {
      ...propNear1km,
      id: 'blocked-near',
      isBlocked: true
    };

    assert.strictEqual(isPropertyPubliclyVisible(propNear1km), true);
    assert.strictEqual(isPropertyPubliclyVisible(unapprovedNearProp), false);
    assert.strictEqual(isPropertyPubliclyVisible(draftNearProp), false);
    assert.strictEqual(isPropertyPubliclyVisible(blockedNearProp), false);
  });
});

