import { describe, it, expect } from 'vitest';
import { parseNaturalLanguageQuery, parseIndianPriceToNumber } from './searchParser.js';
import { matchesSearchFilters } from '../utils/filterMatchingUtils.js';
import { mockApi } from '../services/mockApi.js';
import { PropertyType, Purpose } from './schema.js';

describe('EaseLand Dynamic NLP Search Engine Suite', () => {
  describe('Intent & Named Entity Recognition (NER)', () => {
    it('dynamically extracts budget ceilings and flags pure intent without false locations', () => {
      const conversationalQueries = [
        'properties under 50 lakhs',
        'looking for budget properties below 50 lakhs',
        'show me properties with max budget 50 lakhs',
        'cheap properties under 50 lac',
        'homes under 50 lakhs'
      ];

      for (const query of conversationalQueries) {
        const parsed = parseNaturalLanguageQuery(query);
        expect(parsed.originalQuery).toBe(query);
        expect(parsed.query).toBe(query);
        expect(parsed.maxPrice).toBe(5000000);
        expect(parsed.isLocationSpecific).toBe(false);
      }
    });

    it('dynamically parses complex conversational questions with intent, type, price, and location', () => {
      const q = 'Can I get cheap agricultural land near perecherla below 50 lakhs?';
      const parsed = parseNaturalLanguageQuery(q);

      expect(parsed.originalQuery).toBe(q);
      expect(parsed.propertyType).toBe(PropertyType.LAND);
      expect(parsed.maxPrice).toBe(5000000);
      expect(parsed.nlpMetadata.budgetIntent).toBe('AFFORDABLE');
      expect(parsed.isLocationSpecific).toBe(true);
      expect(parsed.locationQuery.toLowerCase()).toContain('perecherla');
    });

    it('dynamically normalizes word-based numbers and bedroom queries', () => {
      const q = 'Looking for a three bedroom flat in vidyanagar for rent';
      const parsed = parseNaturalLanguageQuery(q);

      expect(parsed.purpose).toBe(Purpose.RENT);
      expect(parsed.propertyType).toBe(PropertyType.APARTMENT);
      expect(parsed.bedrooms).toBe(3);
      expect(parsed.isLocationSpecific).toBe(true);
      expect(parsed.locationQuery.toLowerCase()).toContain('vidyanagar');
    });

    it('dynamically parses crore-denominated price ranges and luxury villa intent', () => {
      const q = 'luxury duplex villas between 1.5 crore and 2.5 crores in amaravathi';
      const parsed = parseNaturalLanguageQuery(q);

      expect(parsed.propertyType).toBe(PropertyType.VILLA);
      expect(parsed.minPrice).toBe(15000000);
      expect(parsed.maxPrice).toBe(25000000);
      expect(parsed.nlpMetadata.budgetIntent).toBe('LUXURY');
      expect(parsed.isLocationSpecific).toBe(true);
      expect(parsed.locationQuery.toLowerCase()).toContain('amaravathi');
    });

    it('dynamically parses commercial spaces for lease or rent', () => {
      const q = 'commercial office space for lease in auto nagar';
      const parsed = parseNaturalLanguageQuery(q);

      expect(parsed.purpose).toBe(Purpose.RENT);
      expect(parsed.propertyType).toBe(PropertyType.COMMERCIAL);
      expect(parsed.isLocationSpecific).toBe(true);
      expect(parsed.locationQuery.toLowerCase()).toContain('auto nagar');
    });

    it('dynamically parses proximity radius intents e.g. within 5 km of landmark', () => {
      const q = 'plots within 5 km of vijayawada airport';
      const parsed = parseNaturalLanguageQuery(q);

      expect(parsed.propertyType).toBe(PropertyType.OPEN_PLOT);
      expect(parsed.radiusKm).toBe(5);
      expect(parsed.referencePlace.toLowerCase()).toContain('vijayawada airport');
      expect(parsed.isLocationSpecific).toBe(true);
    });

    it('parses diverse Indian currency unit formats accurately', () => {
      expect(parseIndianPriceToNumber('50', 'lakhs')).toBe(5000000);
      expect(parseIndianPriceToNumber('25.5', 'lacs')).toBe(2550000);
      expect(parseIndianPriceToNumber('1.25', 'crore')).toBe(12500000);
      expect(parseIndianPriceToNumber('2', 'cr')).toBe(20000000);
      expect(parseIndianPriceToNumber('50', 'k')).toBe(50000);
      expect(parseIndianPriceToNumber('75', 'thousand')).toBe(75000);
      expect(parseIndianPriceToNumber('1', 'koti')).toBe(10000000);
    });
  });

  describe('Semantic Filter & Dynamic Entity Matching', () => {
    const propertyCatalog = [
      {
        id: 'prop-land-1',
        title: 'Fertile Land in Perecherla',
        description: 'Ideal agricultural farm land along Guntur Highway',
        price: 5000000,
        propertyType: 'LAND',
        category: 'Agricultural Lands',
        purpose: 'SALE',
        location: {
          city: 'Guntur',
          locality: 'Perecherla',
          state: 'Andhra Pradesh'
        }
      },
      {
        id: 'prop-apt-2',
        title: 'Luxury 3BHK Apartment in Vidyanagar',
        description: 'High rise luxury apartment with clubhouse and swimming pool',
        price: 7500000,
        propertyType: 'APARTMENT',
        category: 'Apartments/Flat',
        bedrooms: 3,
        purpose: 'SALE',
        location: {
          city: 'Guntur',
          locality: 'Vidyanagar',
          state: 'Andhra Pradesh'
        }
      },
      {
        id: 'prop-plot-3',
        title: 'CRDA Approved Plot in Perecherla',
        description: 'Gated community layout plot venture with clear title',
        price: 4500000,
        propertyType: 'OPEN_PLOT',
        category: 'Open Plot Ventures',
        purpose: 'SALE',
        location: {
          city: 'Guntur',
          locality: 'Perecherla',
          state: 'Andhra Pradesh'
        }
      },
      {
        id: 'prop-comm-4',
        title: 'Prime Commercial Showroom in Auto Nagar',
        description: 'Main road facing commercial space ideal for retail or office',
        price: 65000,
        propertyType: 'COMMERCIAL',
        category: 'Commercial Properties',
        purpose: 'RENT',
        location: {
          city: 'Vijayawada',
          locality: 'Auto Nagar',
          state: 'Andhra Pradesh'
        }
      }
    ];

    it('matches casual budget queries dynamically without rejecting on conversational words', () => {
      const casualState = { query: 'properties under 50 lakhs' };
      const matches = propertyCatalog.filter(p => matchesSearchFilters(p, casualState));

      // Land (50L), Plot (45L), and Commercial Rent (65k) match under 50L; Apartment (75L) excluded
      expect(matches.some(p => p.id === 'prop-land-1')).toBe(true);
      expect(matches.some(p => p.id === 'prop-plot-3')).toBe(true);
      expect(matches.some(p => p.id === 'prop-apt-2')).toBe(false);
    });

    it('matches semantic synonyms dynamically (e.g. "flat" matches APARTMENT category)', () => {
      const flatQueryState = { query: '3 bedroom flats in vidyanagar' };
      const matches = propertyCatalog.filter(p => matchesSearchFilters(p, flatQueryState));

      expect(matches.length).toBe(1);
      expect(matches[0].id).toBe('prop-apt-2');
    });

    it('matches conversational questions dynamically via mockApi.getPublicProperties', () => {
      const origGetProps = mockApi.getProperties;
      mockApi.getProperties = () => propertyCatalog.map(p => ({
        ...p,
        status: 'LIVE',
        listingStatus: 'LIVE',
        isPlatformVerified: true,
        verificationStatus: 'Platform Verified'
      }));

      try {
        const results = mockApi.getPublicProperties({ query: 'cheap farm land near perecherla under 50 lakhs' });
        expect(results.length).toBe(1);
        expect(results[0].id).toBe('prop-land-1');
        expect(results[0].price).toBe(5000000);
      } finally {
        mockApi.getProperties = origGetProps;
      }
    });
  });
});
