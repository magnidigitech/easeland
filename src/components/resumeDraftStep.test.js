import { describe, it, expect } from 'vitest';
import { determineResumeStep } from '../utils/draftResumeUtils.js';

describe('EaseLand Draft Resumption - determineResumeStep Suite', () => {
  it('returns Step 2 when draft has only Step 1 completed (e.g. Untitled Property Listing, price 0, area 0)', () => {
    const draft = {
      propertyType: 'OPEN_PLOT',
      purpose: 'SALE',
      title: 'Untitled Property Listing',
      price: 0,
      area: 0,
      description: '',
      lastStep: 1
    };
    expect(determineResumeStep(draft)).toBe(2);
  });

  it('returns Step 2 when draft has explicit lastStep missing and no Title/Price', () => {
    const draft = {
      propertyType: 'AGRICULTURAL_LAND',
      purpose: 'SALE',
      title: '',
      price: null,
      area: null
    };
    expect(determineResumeStep(draft)).toBe(2);
  });

  it('respects explicitly saved lastStep >= 2 directly', () => {
    const draft = {
      title: 'Green Valley Plot',
      lastStep: 4,
      propertyType: 'OPEN_PLOT',
      purpose: 'SALE'
    };
    expect(determineResumeStep(draft)).toBe(4);
  });

  it('returns Step 3 (Location) when Step 2 is complete but Location is missing', () => {
    const draft = {
      propertyType: 'OPEN_PLOT',
      purpose: 'SALE',
      title: 'Guntur Prime Ventures',
      price: 1500000,
      area: 1200,
      description: 'Prime investment opportunity in growing suburb with road access.',
      location: null,
      lastStep: 1
    };
    expect(determineResumeStep(draft)).toBe(3);
  });

  it('returns Step 4 (Specs) when Step 2 and Step 3 are complete', () => {
    const draft = {
      propertyType: 'OPEN_PLOT',
      purpose: 'SALE',
      title: 'Amaravati Residential Plot',
      price: 2500000,
      area: 1500,
      description: 'Clear title zone, immediate registration available.',
      location: {
        geoPoint: { latitude: 16.5, longitude: 80.6 },
        confirmed: true,
        locality: 'Amaravati'
      },
      specs: { areaUnit: 'sq ft' },
      amenities: [],
      lastStep: 1
    };
    expect(determineResumeStep(draft)).toBe(4);
  });

  it('returns Step 5 (Media) when Specs are filled but Media is missing', () => {
    const draft = {
      propertyType: 'OPEN_PLOT',
      purpose: 'SALE',
      title: 'Amaravati Residential Plot',
      price: 2500000,
      area: 1500,
      description: 'Clear title zone, immediate registration available.',
      location: {
        geoPoint: { latitude: 16.5, longitude: 80.6 },
        confirmed: true,
        locality: 'Amaravati'
      },
      specs: { areaUnit: 'sq ft', facing: 'East' },
      amenities: ['Water Supply'],
      media: [],
      photos: []
    };
    expect(determineResumeStep(draft)).toBe(5);
  });

  it('returns Step 1 for approved/published LIVE properties with no active draft step', () => {
    const liveListing = {
      status: 'LIVE',
      isPublished: true,
      isPlatformVerified: true,
      title: 'Verified Commercial Plot',
      price: 10000000,
      area: 5000,
      description: 'Premium highway-facing commercial site.',
      location: { geoPoint: { lat: 16.3, lng: 80.4 }, confirmed: true }
    };
    expect(determineResumeStep(liveListing)).toBe(1);
  });
});
