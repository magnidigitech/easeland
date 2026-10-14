import { describe, it, expect } from 'vitest';
import { parseNaturalLanguageQuery } from './searchParser.js';
import { matchesSearchFilters } from '../utils/filterMatchingUtils.js';
import { mockApi } from '../services/mockApi.js';
import { PropertyType, Purpose } from './schema.js';

describe('EaseLand Natural Language & Casual Search Suite', () => {
  it('parses "properties under 50 lakhs" without truncating query and extracts maxPrice', () => {
    const raw = 'properties under 50 lakhs';
    const parsed = parseNaturalLanguageQuery(raw);

    expect(parsed.query).toBe(raw);
    expect(parsed.originalQuery).toBe(raw);
    expect(parsed.maxPrice).toBe(5000000);
    expect(parsed.isLocationSpecific).toBe(false);
    expect(parsed.cleanKeywords).toBe('');
    expect(parsed.locationQuery).toBe('');
  });

  it('parses "plots in perecherla under 60 lakhs" with exact type, price, and location', () => {
    const raw = 'plots in perecherla under 60 lakhs';
    const parsed = parseNaturalLanguageQuery(raw);

    expect(parsed.query).toBe(raw);
    expect(parsed.propertyType).toBe(PropertyType.OPEN_PLOT);
    expect(parsed.maxPrice).toBe(6000000);
    expect(parsed.isLocationSpecific).toBe(true);
    expect(parsed.locationQuery).toBe('perecherla');
  });

  it('parses "agricultural lands under 50 lakhs" with LAND property type', () => {
    const raw = 'agricultural lands under 50 lakhs';
    const parsed = parseNaturalLanguageQuery(raw);

    expect(parsed.query).toBe(raw);
    expect(parsed.propertyType).toBe(PropertyType.LAND);
    expect(parsed.maxPrice).toBe(5000000);
    expect(parsed.isLocationSpecific).toBe(false);
  });

  it('parses "3 bhk in vidyanagar" with bedroom count and location', () => {
    const raw = '3 bhk in vidyanagar';
    const parsed = parseNaturalLanguageQuery(raw);

    expect(parsed.query).toBe(raw);
    expect(parsed.bedrooms).toBe(3);
    expect(parsed.isLocationSpecific).toBe(true);
    expect(parsed.locationQuery).toContain('vidyanagar');
  });

  it('parses price range "between 20 and 40 lakhs"', () => {
    const raw = 'between 20 and 40 lakhs';
    const parsed = parseNaturalLanguageQuery(raw);

    expect(parsed.minPrice).toBe(2000000);
    expect(parsed.maxPrice).toBe(4000000);
  });

  it('evaluates matchesSearchFilters correctly for casual queries without rejecting due to stopwords', () => {
    const affordableProp = {
      id: 'prop-1',
      title: 'Fertile Land in Perecherla',
      description: 'Ideal agricultural land near Guntur Highway',
      price: 5000000,
      propertyType: 'LAND',
      category: 'Agricultural Lands',
      purpose: 'SALE',
      location: {
        city: 'Guntur',
        locality: 'Perecherla',
        state: 'Andhra Pradesh'
      }
    };

    const expensiveProp = {
      id: 'prop-2',
      title: 'Luxury 3BHK Apartment in Vidyanagar',
      description: 'Ultra luxury high rise apartment',
      price: 20000000,
      propertyType: 'APARTMENT',
      category: 'Apartments/Flat',
      purpose: 'SALE',
      location: {
        city: 'Guntur',
        locality: 'Vidyanagar',
        state: 'Andhra Pradesh'
      }
    };

    // Test casual query "properties under 50 lakhs"
    const casualSearchState = { query: 'properties under 50 lakhs' };
    expect(matchesSearchFilters(affordableProp, casualSearchState)).toBe(true);
    expect(matchesSearchFilters(expensiveProp, casualSearchState)).toBe(false);

    // Test casual query with location "plots in perecherla under 60 lakhs"
    const plotInPerecherla = {
      id: 'prop-3',
      title: 'CRDA Approved Plot in Perecherla',
      description: 'Gated community venture',
      price: 4500000,
      propertyType: 'OPEN_PLOT',
      category: 'Open Plot Ventures',
      purpose: 'SALE',
      location: {
        city: 'Guntur',
        locality: 'Perecherla',
        state: 'Andhra Pradesh'
      }
    };
    expect(matchesSearchFilters(plotInPerecherla, { query: 'plots in perecherla under 60 lakhs' })).toBe(true);
    expect(matchesSearchFilters(expensiveProp, { query: 'plots in perecherla under 60 lakhs' })).toBe(false);
  });

  it('returns matching properties from mockApi.getPublicProperties for "properties under 50 lakhs"', () => {
    const sampleProps = [
      {
        id: 'live-test-1',
        title: 'Fertile Land in Perecherla',
        description: 'Ideal agricultural land near Guntur Highway',
        price: 5000000,
        propertyType: 'LAND',
        category: 'Agricultural Lands',
        purpose: 'sale',
        status: 'LIVE',
        listingStatus: 'LIVE',
        isPlatformVerified: true,
        verificationStatus: 'Platform Verified'
      },
      {
        id: 'live-test-2',
        title: 'Luxury 3BHK Apartment in Vidyanagar',
        description: 'Ultra luxury high rise apartment',
        price: 20000000,
        propertyType: 'APARTMENT',
        category: 'Apartments/Flat',
        purpose: 'sale',
        status: 'LIVE',
        listingStatus: 'LIVE',
        isPlatformVerified: true,
        verificationStatus: 'Platform Verified'
      }
    ];

    const origGetProps = mockApi.getProperties;
    mockApi.getProperties = () => sampleProps;

    try {
      const results = mockApi.getPublicProperties({ query: 'properties under 50 lakhs' });
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('live-test-1');
      expect(results[0].price).toBe(5000000);
    } finally {
      mockApi.getProperties = origGetProps;
    }
  });
});
