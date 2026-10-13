import { describe, it, expect, beforeEach } from 'vitest';
import { resolveLocalityHierarchy, searchLocalities, searchCities } from '../utils/locationHierarchyUtils.js';
import { matchesSearchFilters } from '../utils/filterMatchingUtils.js';
import { mockApi } from '../services/mockApi.js';

describe('Locality Filter & Administrative Hierarchy Satisfaction Suite', () => {
  it('resolves locality to its exact administrative City, District, and State hierarchy', () => {
    const brodipet = resolveLocalityHierarchy('Brodipet');
    expect(brodipet).not.toBeNull();
    expect(brodipet.city).toBe('Guntur');
    expect(brodipet.district).toBe('Guntur');
    expect(brodipet.state).toBe('Andhra Pradesh');

    const gachibowli = resolveLocalityHierarchy('Gachibowli');
    expect(gachibowli).not.toBeNull();
    expect(gachibowli.city).toContain('Hyderabad');
    expect(gachibowli.state).toBe('Telangana');

    const mvp = resolveLocalityHierarchy('MVP Colony');
    expect(mvp).not.toBeNull();
    expect(mvp.city).toBe('Visakhapatnam');
    expect(mvp.state).toBe('Andhra Pradesh');
  });

  it('searches localities and scopes results to city when specified', () => {
    const allBrod = searchLocalities('Brodi');
    expect(allBrod.length).toBeGreaterThan(0);
    expect(allBrod[0].locality).toBe('Brodipet');

    const gunturLocalities = searchLocalities('', 'Guntur');
    expect(gunturLocalities.length).toBeGreaterThan(0);
    const names = gunturLocalities.map(l => l.locality);
    expect(names).toContain('Brodipet');
  });

  it('matches properties accurately with matchesSearchFilters when locality filter is set', () => {
    const propertyGuntur = {
      id: 'test-p1',
      title: 'Premium Villa in Brodipet',
      location: {
        city: 'Guntur',
        locality: 'Brodipet',
        district: 'Guntur',
        state: 'Andhra Pradesh'
      }
    };

    const propertyHyd = {
      id: 'test-p2',
      title: 'Modern Apartment in Gachibowli',
      location: {
        city: 'Hyderabad',
        locality: 'Gachibowli',
        district: 'Ranga Reddy',
        state: 'Telangana'
      }
    };

    // Filter by locality "Brodipet"
    expect(matchesSearchFilters(propertyGuntur, { locality: 'Brodipet' })).toBe(true);
    expect(matchesSearchFilters(propertyHyd, { locality: 'Brodipet' })).toBe(false);

    // Filter by locality "Gachibowli"
    expect(matchesSearchFilters(propertyHyd, { locality: 'Gachibowli' })).toBe(true);
    expect(matchesSearchFilters(propertyGuntur, { locality: 'Gachibowli' })).toBe(false);

    // Both City and Locality satisfied
    expect(matchesSearchFilters(propertyGuntur, { city: 'Guntur', locality: 'Brodipet' })).toBe(true);
    // City and Locality conflict
    expect(matchesSearchFilters(propertyGuntur, { city: 'Hyderabad', locality: 'Brodipet' })).toBe(false);
  });

  it('filters properties in mockApi.getPublicProperties by locality', () => {
    const dummy = {
      id: 'prop-custom-1',
      title: 'Guntur Brodipet House',
      status: 'LIVE',
      isPlatformVerified: true,
      location: {
        city: 'Guntur',
        locality: 'Brodipet',
        state: 'Andhra Pradesh'
      }
    };

    // Store in localStorage if window is defined
    if (typeof window !== 'undefined') {
      localStorage.setItem('easeland_properties', JSON.stringify([dummy]));
      const res = mockApi.getPublicProperties({ locality: 'Brodipet' });
      expect(res.some(p => p.id === dummy.id)).toBe(true);

      const noRes = mockApi.getPublicProperties({ locality: 'NonExistentLocality123' });
      expect(noRes.some(p => p.id === dummy.id)).toBe(false);
    }
  });

  it('verifies Perecherla never resolves to Chennai and fetches accurately via Google Maps', async () => {
    // 1. Ensure hardcoded lookup doesn't falsely greedily match "per" to Chennai
    const resolved = resolveLocalityHierarchy('perecherla');
    if (resolved) {
      expect(resolved.city).not.toBe('Chennai');
    }

    // 2. Test Google Maps Platform Geocoding for Perecherla
    const { geocodePlaceWithHierarchy } = await import('../services/locationProvider.js');
    const geoPerecherla = await geocodePlaceWithHierarchy('Perecherla');
    expect(geoPerecherla).not.toBeNull();
    expect(geoPerecherla.city).toBe('Guntur');
    expect(geoPerecherla.state).toBe('Andhra Pradesh');
    expect(geoPerecherla.city).not.toBe('Chennai');
    expect(geoPerecherla.lat).toBeGreaterThan(16);
    expect(geoPerecherla.lng).toBeGreaterThan(80);

    // 3. Test filter matching for Perecherla listing
    const perecherlaProperty = {
      id: 'prop-perecherla-1',
      title: 'Agricultural Land near Perecherla Junction',
      location: {
        city: 'Guntur',
        locality: 'Perecherla',
        district: 'Guntur',
        state: 'Andhra Pradesh'
      }
    };
    expect(matchesSearchFilters(perecherlaProperty, { locality: 'perecherla' })).toBe(true);
    expect(matchesSearchFilters(perecherlaProperty, { locality: 'perecherla', city: 'Guntur' })).toBe(true);
    expect(matchesSearchFilters(perecherlaProperty, { locality: 'perecherla', city: 'Chennai' })).toBe(false);
  });
});
