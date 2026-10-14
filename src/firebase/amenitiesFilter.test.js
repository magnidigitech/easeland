import { describe, it, expect } from 'vitest';
import { propertyHasAmenity, matchesSearchFilters } from '../utils/filterMatchingUtils.js';

describe('Amenities Filtering & Canonical Matching Suite', () => {
  it('correctly matches canonical uppercase amenity IDs against human UI filter labels', () => {
    const prop = {
      id: 'p1',
      title: 'Residential Plot in Gated Township',
      amenities: ['GATED_COMMUNITY', 'SECURITY_24X7', 'WATER_SUPPLY_24X7']
    };

    expect(propertyHasAmenity(prop, 'Gated Community')).toBe(true);
    expect(propertyHasAmenity(prop, '24/7 Security')).toBe(true);
    expect(propertyHasAmenity(prop, 'Water Supply')).toBe(true);
    expect(propertyHasAmenity(prop, 'Swimming Pool')).toBe(false);
  });

  it('matches specifications.amenities and features', () => {
    const prop = {
      id: 'p2',
      title: 'Modern High-Rise Apartment',
      specifications: {
        amenities: ['SWIMMING_POOL', 'GYMNASIUM', 'LIFT_ELEVATOR', 'CHILDREN_PLAY_AREA']
      }
    };

    expect(propertyHasAmenity(prop, 'Swimming Pool')).toBe(true);
    expect(propertyHasAmenity(prop, 'Gym')).toBe(true);
    expect(propertyHasAmenity(prop, 'Lift')).toBe(true);
    expect(propertyHasAmenity(prop, 'Park')).toBe(true);
    expect(propertyHasAmenity(prop, 'Clubhouse')).toBe(false);
  });

  it('matches boolean flags in amenitiesMap', () => {
    const prop = {
      id: 'p3',
      title: 'Luxury Villa',
      amenitiesMap: {
        clubhouse: true,
        powerBackup: true,
        carParking: true
      }
    };

    expect(propertyHasAmenity(prop, 'Clubhouse')).toBe(true);
    expect(propertyHasAmenity(prop, 'Power Backup')).toBe(true);
    expect(propertyHasAmenity(prop, 'Car Parking')).toBe(true);
    expect(propertyHasAmenity(prop, 'Swimming Pool')).toBe(false);
  });

  it('matches full descriptive labels and plain text descriptions', () => {
    const prop = {
      id: 'p4',
      title: 'Independent House with 24/7 Security and generator power backup',
      amenities: ['Reserved Covered Car Parking']
    };

    expect(propertyHasAmenity(prop, 'Car Parking')).toBe(true);
    expect(propertyHasAmenity(prop, 'Power Backup')).toBe(true);
    expect(propertyHasAmenity(prop, '24/7 Security')).toBe(true);
  });

  it('evaluates matchesSearchFilters with multi-amenity conjunction (AND logic)', () => {
    const propMatchingBoth = {
      id: 'p5',
      title: 'Gated Luxury Apartment',
      amenities: ['GATED_COMMUNITY', 'SWIMMING_POOL', 'GYMNASIUM']
    };

    const propMissingOne = {
      id: 'p6',
      title: 'Gated Villa without pool',
      amenities: ['GATED_COMMUNITY', 'SECURITY_24X7']
    };

    const searchState = {
      amenities: ['Gated Community', 'Swimming Pool']
    };

    expect(matchesSearchFilters(propMatchingBoth, searchState)).toBe(true);
    expect(matchesSearchFilters(propMissingOne, searchState)).toBe(false);
  });
});
