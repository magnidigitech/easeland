import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeFurnishing, normalizeFacing, matchesSearchFilters } from './filterMatchingUtils.js';

test('normalizeFurnishing handles all case, hyphen, and underscore variations', () => {
  assert.strictEqual(normalizeFurnishing('Semi-Furnished'), 'SEMI_FURNISHED');
  assert.strictEqual(normalizeFurnishing('SEMI_FURNISHED'), 'SEMI_FURNISHED');
  assert.strictEqual(normalizeFurnishing('Semi Furnished'), 'SEMI_FURNISHED');
  assert.strictEqual(normalizeFurnishing('semi-furnished'), 'SEMI_FURNISHED');
  assert.strictEqual(normalizeFurnishing('semi'), 'SEMI_FURNISHED');

  assert.strictEqual(normalizeFurnishing('Unfurnished'), 'UNFURNISHED');
  assert.strictEqual(normalizeFurnishing('UNFURNISHED'), 'UNFURNISHED');
  assert.strictEqual(normalizeFurnishing('unfurnished'), 'UNFURNISHED');

  assert.strictEqual(normalizeFurnishing('Fully Furnished'), 'FULLY_FURNISHED');
  assert.strictEqual(normalizeFurnishing('FULLY_FURNISHED'), 'FULLY_FURNISHED');
  assert.strictEqual(normalizeFurnishing('Fully-Furnished'), 'FULLY_FURNISHED');
  assert.strictEqual(normalizeFurnishing('Furnished'), 'FULLY_FURNISHED');

  assert.strictEqual(normalizeFurnishing(''), '');
  assert.strictEqual(normalizeFurnishing(null), '');
  assert.strictEqual(normalizeFurnishing(undefined), '');
});

test('normalizeFacing handles all direction variations cleanly', () => {
  assert.strictEqual(normalizeFacing('North-East'), 'NORTHEAST');
  assert.strictEqual(normalizeFacing('NORTH_EAST'), 'NORTHEAST');
  assert.strictEqual(normalizeFacing('North East'), 'NORTHEAST');
  assert.strictEqual(normalizeFacing('East'), 'EAST');
  assert.strictEqual(normalizeFacing('WEST'), 'WEST');
  assert.strictEqual(normalizeFacing('South-West'), 'SOUTHWEST');
});

test('matchesSearchFilters correctly filters by furnishing status across specs and root properties', () => {
  const semiPropSpecs = {
    id: 'p1',
    title: '3BHK Apartment in Guntur',
    propertyType: 'APARTMENT',
    specs: {
      furnishing: 'Semi-Furnished',
      bedrooms: 3
    }
  };

  const semiPropRoot = {
    id: 'p2',
    title: 'Independent Villa',
    propertyType: 'VILLA',
    furnishingStatus: 'SEMI_FURNISHED'
  };

  const fullyProp = {
    id: 'p3',
    title: 'Luxury Flat',
    propertyType: 'APARTMENT',
    specs: {
      furnishing: 'Fully Furnished'
    }
  };

  const unfurnishedProp = {
    id: 'p4',
    title: 'Budget Flat',
    propertyType: 'APARTMENT',
    specs: {
      furnishing: 'Unfurnished'
    }
  };

  const plotNoFurnishing = {
    id: 'p5',
    title: 'Residential Plot in Guntur',
    propertyType: 'OPEN_PLOT',
    specs: {}
  };

  // 1. Filter for Semi Furnished (dropdown value SEMI_FURNISHED)
  const semiFilter = { furnishing: 'SEMI_FURNISHED' };
  assert.strictEqual(matchesSearchFilters(semiPropSpecs, semiFilter), true, 'Semi-Furnished in specs should match SEMI_FURNISHED filter');
  assert.strictEqual(matchesSearchFilters(semiPropRoot, semiFilter), true, 'SEMI_FURNISHED on root should match SEMI_FURNISHED filter');
  assert.strictEqual(matchesSearchFilters(fullyProp, semiFilter), false, 'Fully Furnished property should NOT match SEMI_FURNISHED filter');
  assert.strictEqual(matchesSearchFilters(unfurnishedProp, semiFilter), false, 'Unfurnished property should NOT match SEMI_FURNISHED filter');
  assert.strictEqual(matchesSearchFilters(plotNoFurnishing, semiFilter), false, 'Property with no furnishing spec should NOT match SEMI_FURNISHED filter');

  // 2. Filter for Fully Furnished (dropdown value FULLY_FURNISHED)
  const fullyFilter = { furnishing: 'FULLY_FURNISHED' };
  assert.strictEqual(matchesSearchFilters(fullyProp, fullyFilter), true, 'Fully Furnished property should match FULLY_FURNISHED filter');
  assert.strictEqual(matchesSearchFilters(semiPropSpecs, fullyFilter), false, 'Semi-Furnished property should NOT match FULLY_FURNISHED filter');
  assert.strictEqual(matchesSearchFilters(unfurnishedProp, fullyFilter), false, 'Unfurnished property should NOT match FULLY_FURNISHED filter');

  // 3. Filter for Unfurnished (dropdown value UNFURNISHED)
  const unfurnFilter = { furnishing: 'UNFURNISHED' };
  assert.strictEqual(matchesSearchFilters(unfurnishedProp, unfurnFilter), true, 'Unfurnished property should match UNFURNISHED filter');
  assert.strictEqual(matchesSearchFilters(semiPropSpecs, unfurnFilter), false, 'Semi-Furnished property should NOT match UNFURNISHED filter');

  // 4. Any / All Furnishing should match all properties
  assert.strictEqual(matchesSearchFilters(semiPropSpecs, { furnishing: '' }), true);
  assert.strictEqual(matchesSearchFilters(semiPropSpecs, { furnishing: 'ALL' }), true);
  assert.strictEqual(matchesSearchFilters(semiPropSpecs, { furnishing: 'ANY' }), true);
  assert.strictEqual(matchesSearchFilters(plotNoFurnishing, { furnishing: 'ALL' }), true);
});

test('matchesSearchFilters correctly filters by facing direction with hyphens and underscores', () => {
  const northEastProp = {
    id: 'p10',
    title: 'East Facing Flat',
    specs: { facing: 'North-East' }
  };
  const westProp = {
    id: 'p11',
    title: 'West Villa',
    specs: { facing: 'West' }
  };

  assert.strictEqual(matchesSearchFilters(northEastProp, { facing: 'NORTH_EAST' }), true);
  assert.strictEqual(matchesSearchFilters(northEastProp, { facing: 'WEST' }), false);
  assert.strictEqual(matchesSearchFilters(westProp, { facing: 'WEST' }), true);
  assert.strictEqual(matchesSearchFilters(westProp, { facing: 'NORTH_EAST' }), false);
});

test('matchesSearchFilters matches properties by their actual furnishing and does not hardcode un-specified ones', () => {
  const apartmentWithoutFurnishing = {
    id: 'p20',
    title: 'Already Posted Flat Without Furnishing Filled',
    propertyType: 'APARTMENT',
    specs: {}
  };

  const apartmentWithUnfurnished = {
    id: 'p21',
    title: 'Flat Posted With Unfurnished Default',
    propertyType: 'APARTMENT',
    specs: {
      furnishing: 'Unfurnished'
    }
  };

  const unfurnFilter = { furnishing: 'UNFURNISHED' };
  const semiFilter = { furnishing: 'SEMI_FURNISHED' };
  const allFilter = { furnishing: 'ALL' };

  // Flat posted with Unfurnished matches UNFURNISHED filter
  assert.strictEqual(matchesSearchFilters(apartmentWithUnfurnished, unfurnFilter), true);
  assert.strictEqual(matchesSearchFilters(apartmentWithUnfurnished, semiFilter), false);

  // Already posted flat where user left furnishing empty is left as-is without hardcoding
  assert.strictEqual(matchesSearchFilters(apartmentWithoutFurnishing, unfurnFilter), false);
  assert.strictEqual(matchesSearchFilters(apartmentWithoutFurnishing, semiFilter), false);
  assert.strictEqual(matchesSearchFilters(apartmentWithoutFurnishing, allFilter), true);
});
