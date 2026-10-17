import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeReauditDiff, normalizeAmenities, formatInr } from '../utils/reauditDiffUtils.js';

describe('Verification Workspace Re-Audit Diff & Boundary Detection Suite', () => {

  it('1. Returns isReaudit=false when property has no pending re-audit modifications', () => {
    const regularProperty = {
      id: 'prop-101',
      title: 'Standard Approved Land Plot',
      price: 5000000,
      area: 1200,
      hasPendingEdits: false,
      pendingReauditData: null
    };

    const diffResult = computeReauditDiff(regularProperty);
    assert.strictEqual(diffResult.isReaudit, false);
    assert.strictEqual(diffResult.hasChanges, false);
    assert.strictEqual(diffResult.changedFieldCount, 0);
  });

  it('2. Accurately detects and highlights price, area, title and furnishing diffs', () => {
    const livePropWithEdits = {
      id: 'prop-102',
      title: 'Luxury 3 BHK Villa in Guntur',
      price: 12000000,
      priceDisplay: 'Rs. 1.20 Crore',
      area: 2400,
      areaUnit: 'sq ft',
      areaDisplay: '2400 sq ft',
      specs: {
        furnishing: 'Semi-Furnished',
        facing: 'East'
      },
      hasPendingEdits: true,
      pendingReauditData: {
        title: 'Luxury 4 BHK Villa with Private Garden in Guntur',
        price: 14500000,
        priceDisplay: 'Rs. 1.45 Crore',
        area: 2800,
        areaUnit: 'sq ft',
        areaDisplay: '2800 sq ft',
        specs: {
          furnishing: 'Fully-Furnished',
          facing: 'East'
        }
      }
    };

    const diffResult = computeReauditDiff(livePropWithEdits);
    assert.strictEqual(diffResult.isReaudit, true);
    assert.strictEqual(diffResult.hasChanges, true);

    // Title
    assert.strictEqual(diffResult.diffs.title.changed, true);
    assert.strictEqual(diffResult.diffs.title.live, 'Luxury 3 BHK Villa in Guntur');
    assert.strictEqual(diffResult.diffs.title.proposed, 'Luxury 4 BHK Villa with Private Garden in Guntur');

    // Price
    assert.strictEqual(diffResult.diffs.price.changed, true);
    assert.strictEqual(diffResult.diffs.price.live, 12000000);
    assert.strictEqual(diffResult.diffs.price.proposed, 14500000);

    // Area
    assert.strictEqual(diffResult.diffs.area.changed, true);
    assert.strictEqual(diffResult.diffs.area.live, 2400);
    assert.strictEqual(diffResult.diffs.area.proposed, 2800);

    // Furnishing
    assert.strictEqual(diffResult.diffs.furnishing.changed, true);
    assert.strictEqual(diffResult.diffs.furnishing.live, 'Semi-Furnished');
    assert.strictEqual(diffResult.diffs.furnishing.proposed, 'Fully-Furnished');

    // Facing did not change
    assert.strictEqual(diffResult.diffs.facing, undefined);
  });

  it('3. Accurately detects added and removed amenities', () => {
    const liveProp = {
      id: 'prop-103',
      amenities: ['SECURITY_24X7', 'CCTV', 'POWER_BACKUP', 'WATER_SUPPLY'],
      hasPendingEdits: true,
      pendingReauditData: {
        amenities: ['SECURITY_24X7', 'CCTV', 'LIFT_ELEVATOR', 'CLUBHOUSE']
      }
    };

    const diffResult = computeReauditDiff(liveProp);
    assert.strictEqual(diffResult.diffs.amenities.changed, true);

    const added = diffResult.diffs.amenities.added;
    const removed = diffResult.diffs.amenities.removed;

    assert.strictEqual(added.includes('LIFT_ELEVATOR'), true);
    assert.strictEqual(added.includes('CLUBHOUSE'), true);
    assert.strictEqual(removed.includes('POWER_BACKUP'), true);
    assert.strictEqual(removed.includes('WATER_SUPPLY'), true);
  });

  it('4. Accurately detects location address and coordinate pin modifications', () => {
    const liveProp = {
      id: 'prop-104',
      location: {
        address: 'Old Highway Road, Guntur',
        lat: 16.3067,
        lng: 80.4365,
        surveyNo: '102/4',
        lpNo: 'LP-2023-88'
      },
      hasPendingEdits: true,
      pendingReauditData: {
        location: {
          address: 'Amaravati Inner Ring Road, Guntur',
          lat: 16.3200,
          lng: 80.4500,
          surveyNo: '102/4B',
          lpNo: 'LP-2024-99'
        }
      }
    };

    const diffResult = computeReauditDiff(liveProp);
    assert.strictEqual(diffResult.diffs.location.changed, true);
    assert.strictEqual(diffResult.diffs.location.addressDiff, true);
    assert.strictEqual(diffResult.diffs.location.coordsDiff, true);
    assert.strictEqual(diffResult.diffs.surveyNo.changed, true);
    assert.strictEqual(diffResult.diffs.surveyNo.proposed, '102/4B');
    assert.strictEqual(diffResult.diffs.lpNo.changed, true);
    assert.strictEqual(diffResult.diffs.lpNo.proposed, 'LP-2024-99');
  });

  it('5. Accurately detects plot boundary polygon vertex modifications and area delta', () => {
    const liveProp = {
      id: 'prop-105',
      boundary: {
        vertices: [
          { lat: 16.3067, lng: 80.4365 },
          { lat: 16.3070, lng: 80.4370 },
          { lat: 16.3065, lng: 80.4372 },
          { lat: 16.3062, lng: 80.4367 }
        ]
      },
      hasPendingEdits: true,
      pendingReauditData: {
        boundary: {
          vertices: [
            { lat: 16.3067, lng: 80.4365 },
            { lat: 16.3072, lng: 80.4372 },
            { lat: 16.3070, lng: 80.4375 },
            { lat: 16.3065, lng: 80.4375 },
            { lat: 16.3062, lng: 80.4367 }
          ]
        }
      }
    };

    const diffResult = computeReauditDiff(liveProp);
    assert.strictEqual(diffResult.diffs.boundary.changed, true);
    assert.strictEqual(diffResult.diffs.boundary.liveVertexCount, 4);
    assert.strictEqual(diffResult.diffs.boundary.proposedVertexCount, 5);
    assert.strictEqual(diffResult.diffs.boundary.liveAreaSqFt > 0, true);
    assert.strictEqual(diffResult.diffs.boundary.proposedAreaSqFt > 0, true);
  });

  it('6. Accurately detects newly uploaded photos and documents during re-verification', () => {
    const liveProp = {
      id: 'prop-106',
      photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
      documents: [
        { name: 'Pahani 2023.pdf', url: 'https://example.com/docs/pahani.pdf' }
      ],
      hasPendingEdits: true,
      pendingReauditData: {
        photos: [
          'https://example.com/photo1.jpg',
          'https://example.com/photo2.jpg',
          'https://example.com/photo3_drone.jpg',
          'https://example.com/photo4_site.jpg'
        ],
        documents: [
          { name: 'Pahani 2023.pdf', url: 'https://example.com/docs/pahani.pdf' },
          { name: 'Layout Approval Certificate 2024.pdf', url: 'https://example.com/docs/layout_2024.pdf' }
        ]
      }
    };

    const diffResult = computeReauditDiff(liveProp);
    assert.strictEqual(diffResult.diffs.photos.changed, true);
    assert.strictEqual(diffResult.diffs.photos.newCount, 2);
    assert.strictEqual(diffResult.diffs.photos.newPhotos.includes('https://example.com/photo3_drone.jpg'), true);

    assert.strictEqual(diffResult.diffs.documents.changed, true);
    assert.strictEqual(diffResult.diffs.documents.newCount, 1);
  });
});
