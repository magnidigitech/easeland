import { test } from 'node:test';
import assert from 'node:assert';
import {
  STANDARD_CATEGORIES,
  getPropertyTypeFromCategory,
  getCategoryFromPropertyType
} from './categoryUtils.js';
import { matchesSearchFilters } from './filterMatchingUtils.js';

test('getPropertyTypeFromCategory accurately maps all standard categories to PropertyType enum', () => {
  assert.strictEqual(getPropertyTypeFromCategory('Open Plot Ventures'), 'OPEN_PLOT');
  assert.strictEqual(getPropertyTypeFromCategory('Open Plot (City)'), 'OPEN_PLOT');
  assert.strictEqual(getPropertyTypeFromCategory('Amaravathi LPS layout plots'), 'OPEN_PLOT');
  assert.strictEqual(getPropertyTypeFromCategory('Apartments/Flat'), 'APARTMENT');
  assert.strictEqual(getPropertyTypeFromCategory('Independent House/Villa'), 'HOUSE');
  assert.strictEqual(getPropertyTypeFromCategory('Commerical Property'), 'COMMERCIAL');
  assert.strictEqual(getPropertyTypeFromCategory('Agricultural Lands'), 'LAND');
  assert.strictEqual(getPropertyTypeFromCategory('Others'), 'OTHER');
  assert.strictEqual(getPropertyTypeFromCategory('All'), '');
  assert.strictEqual(getPropertyTypeFromCategory(''), '');
});

test('getCategoryFromPropertyType maps PropertyType enums to standard category names', () => {
  assert.strictEqual(getCategoryFromPropertyType('OPEN_PLOT'), 'Open Plot Ventures');
  assert.strictEqual(getCategoryFromPropertyType('APARTMENT'), 'Apartments/Flat');
  assert.strictEqual(getCategoryFromPropertyType('HOUSE'), 'Independent House/Villa');
  assert.strictEqual(getCategoryFromPropertyType('COMMERCIAL'), 'Commerical Property');
  assert.strictEqual(getCategoryFromPropertyType('LAND'), 'Agricultural Lands');
  assert.strictEqual(getCategoryFromPropertyType('OTHER'), 'Others');
  assert.strictEqual(getCategoryFromPropertyType('ALL'), 'All');
});

test('matchesSearchFilters resolves conflicting category and stale propertyType without returning zero results', () => {
  const houseListing = {
    id: 'h-1',
    title: 'Luxury 3 BHK Villa in Perecherla',
    propertyType: 'HOUSE',
    category: 'Independent House/Villa',
    status: 'APPROVED',
    listingStatus: 'APPROVED',
    purpose: 'SALE',
    price: 8500000,
    specs: { bedrooms: 3, furnishing: 'Semi-Furnished' }
  };

  // Simulating user having stale propertyType: 'OPEN_PLOT' while selecting Category: 'Independent House/Villa'
  const conflictingSearchState = {
    category: 'Independent House/Villa',
    propertyType: 'OPEN_PLOT',
    purpose: 'ALL'
  };

  const isMatch = matchesSearchFilters(houseListing, conflictingSearchState);
  assert.strictEqual(isMatch, true, 'House listing must match because user explicitly selected Independent House/Villa category, ignoring stale OPEN_PLOT');
});

test('matchesSearchFilters resolves plot when category is Open Plot Ventures even if stale propertyType is HOUSE', () => {
  const plotListing = {
    id: 'p-1',
    title: 'Gated Venture DTCP Plot',
    propertyType: 'OPEN_PLOT',
    category: 'Open Plot Ventures',
    status: 'APPROVED',
    listingStatus: 'APPROVED',
    purpose: 'SALE',
    price: 2500000
  };

  // Simulating user having stale propertyType: 'HOUSE' while selecting Category: 'Open Plot Ventures'
  const conflictingSearchState = {
    category: 'Open Plot Ventures',
    propertyType: 'HOUSE',
    purpose: 'ALL'
  };

  const isMatch = matchesSearchFilters(plotListing, conflictingSearchState);
  assert.strictEqual(isMatch, true, 'Plot listing must match because user explicitly selected Open Plot Ventures category, ignoring stale HOUSE');
});
