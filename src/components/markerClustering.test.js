import { describe, it, expect } from 'vitest';
import { extractCoordinates } from '../services/locationProvider.js';
import { deduplicateProperties } from '../services/mockApi.js';

describe('Smart Marker Clustering & Data Integrity Suite', () => {

  it('safely handles missing, NaN, and zero coordinates without crashing', () => {
    const invalidProps = [
      { id: 'p1', title: 'Invalid 1', location: { lat: NaN, lng: 80.42 } },
      { id: 'p2', title: 'Invalid 2', location: { lat: 0, lng: 0 } },
      { id: 'p3', title: 'Invalid 3', location: null },
      { id: 'p4', title: 'Valid 1', location: { lat: 16.312, lng: 80.428 } }
    ];

    const validCandidates = invalidProps.filter(p => {
      const coords = extractCoordinates(p);
      const lat = coords?.lat;
      const lng = coords?.lng;
      return !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
    });

    expect(validCandidates).toHaveLength(1);
    expect(validCandidates[0].id).toBe('p4');
  });

  it('guarantees cluster count represents distinct eligible properties without duplicates', () => {
    const propsWithDups = [
      { id: 'real-prop-201', title: 'Grand Villa A', location: { lat: 16.31, lng: 80.42 }, listingStatus: 'LIVE' },
      { id: 'real-prop-201', title: 'Grand Villa A Duplicate', location: { lat: 16.31, lng: 80.42 }, listingStatus: 'LIVE' },
      { id: 'real-prop-202', title: 'Green Plot B', location: { lat: 16.311, lng: 80.421 }, listingStatus: 'LIVE' }
    ];

    const deduplicated = deduplicateProperties(propsWithDups);
    expect(deduplicated).toHaveLength(2);
    expect(deduplicated.map(p => p.id)).toEqual(['real-prop-201', 'real-prop-202']);
  });

  it('strictly excludes non-live, draft, or rejected properties from public clustering dataset', () => {
    const rawProperties = [
      { id: 'p-live', title: 'Live Villa', listingStatus: 'LIVE', isPublished: true },
      { id: 'p-approved', title: 'Approved Plot', status: 'APPROVED', isPublished: true },
      { id: 'p-draft', title: 'Draft Property', listingStatus: 'DRAFT', isPublished: false },
      { id: 'p-rejected', title: 'Rejected Property', status: 'REJECTED', isPublished: false },
      { id: 'p-changes', title: 'Changes Required', status: 'CHANGES_REQUIRED', isPublished: false }
    ];

    const eligibleForClustering = rawProperties.filter(p => {
      const st = String(p.status || p.listingStatus || '').toUpperCase();
      const lst = String(p.listingStatus || '').toUpperCase();
      const isLive = st === 'LIVE' || st === 'APPROVED' || st === 'APPROVED_LIVE' || lst === 'LIVE' || lst === 'APPROVED';
      const isBlocked = st === 'REJECTED' || st === 'DRAFT' || lst === 'REJECTED' || lst === 'DRAFT' || st === 'CHANGES_REQUIRED';
      return isLive && !isBlocked && p.isPublished;
    });

    expect(eligibleForClustering).toHaveLength(2);
    expect(eligibleForClustering.map(p => p.id)).toEqual(['p-live', 'p-approved']);
  });

  it('calculates proper cluster badge dimensions and typography scaling across count tiers', () => {
    const getBadgeConfig = (count) => {
      let size = 26;
      let fontSize = 11.5;
      let strokeWidth = 1.5;
      if (count >= 100) {
        size = 38;
        fontSize = 13;
        strokeWidth = 2;
      } else if (count >= 50) {
        size = 34;
        fontSize = 12.5;
        strokeWidth = 2;
      } else if (count >= 10) {
        size = 30;
        fontSize = 12;
        strokeWidth = 2;
      }
      return { size, fontSize, strokeWidth };
    };

    expect(getBadgeConfig(5)).toEqual({ size: 26, fontSize: 11.5, strokeWidth: 1.5 });
    expect(getBadgeConfig(15)).toEqual({ size: 30, fontSize: 12, strokeWidth: 2 });
    expect(getBadgeConfig(60)).toEqual({ size: 34, fontSize: 12.5, strokeWidth: 2 });
    expect(getBadgeConfig(150)).toEqual({ size: 38, fontSize: 13, strokeWidth: 2 });
  });

  it('enforces numbers visibility rule: hidden on global/continental zoom (< 5) and visible within India (>= 5)', () => {
    const isClusterVisible = (zoom) => zoom >= 5;

    // Zoom 0 to 4 (World & Continent view) -> strictly false
    expect(isClusterVisible(1)).toBe(false);
    expect(isClusterVisible(3)).toBe(false);
    expect(isClusterVisible(4)).toBe(false);

    // Zoom 5 to 18 (India National, State, District, City view) -> true
    expect(isClusterVisible(5)).toBe(true);
    expect(isClusterVisible(8)).toBe(true);
    expect(isClusterVisible(13)).toBe(true);
  });

});
