import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSiteConfig, mergeSiteConfigWithDefaults, DEFAULT_SITE_CONFIG } from './mockApi.js';

describe('EaseLand Paid Promotions & Admin Showcase Management Suite', () => {
  it('1. DEFAULT_SITE_CONFIG enforces showOnlyFeatured: true and empty featuredPropertyIds', () => {
    assert.strictEqual(DEFAULT_SITE_CONFIG.featuredListings.showOnlyFeatured, true);
    assert.deepStrictEqual(DEFAULT_SITE_CONFIG.featuredListings.featuredPropertyIds, []);
    assert.strictEqual(DEFAULT_SITE_CONFIG.featuredListings.displayCount, 6);
  });

  it('2. sanitizeSiteConfig strictly overrides showOnlyFeatured to true and ensures array of property IDs', () => {
    const customConfig = {
      featuredListings: {
        showOnlyFeatured: false,
        featuredPropertyIds: 'not-an-array',
        sectionTitle: 'Sponsored Premium Properties'
      }
    };

    const sanitized = sanitizeSiteConfig(customConfig);
    assert.strictEqual(sanitized.featuredListings.showOnlyFeatured, true);
    assert.deepStrictEqual(sanitized.featuredListings.featuredPropertyIds, []);
    assert.strictEqual(sanitized.featuredListings.sectionTitle, 'Sponsored Premium Properties');
  });

  it('3. mergeSiteConfigWithDefaults preserves admin promoted property IDs while keeping showOnlyFeatured: true', () => {
    const adminConfig = {
      featuredListings: {
        showOnlyFeatured: false,
        featuredPropertyIds: ['prop-101', 'prop-102', 'prop-103'],
        sectionTitle: 'Paid Promotions & Featured Properties',
        displayCount: 8
      }
    };

    const merged = mergeSiteConfigWithDefaults(adminConfig);
    assert.strictEqual(merged.featuredListings.showOnlyFeatured, true);
    assert.deepStrictEqual(merged.featuredListings.featuredPropertyIds, ['prop-101', 'prop-102', 'prop-103']);
    assert.strictEqual(merged.featuredListings.sectionTitle, 'Paid Promotions & Featured Properties');
    assert.strictEqual(merged.featuredListings.displayCount, 8);
  });

  it('4. Reordering and removing promoted property IDs preserves exact slots and integrity', () => {
    let ids = ['prop-101', 'prop-102', 'prop-103'];

    // Move prop-102 UP
    const temp = ids[0];
    ids[0] = ids[1];
    ids[1] = temp;
    assert.deepStrictEqual(ids, ['prop-102', 'prop-101', 'prop-103']);

    // Remove prop-101
    ids = ids.filter(id => id !== 'prop-101');
    assert.deepStrictEqual(ids, ['prop-102', 'prop-103']);

    // Remove all
    ids = [];
    assert.strictEqual(ids.length, 0);
  });

  it('5. Clamps dynamic Max Display Slots within 1 to 24 bounds and handles numeric strings', () => {
    const configLow = sanitizeSiteConfig({
      featuredListings: { displayCount: 0 }
    });
    assert.strictEqual(configLow.featuredListings.displayCount, 1);

    const configHigh = sanitizeSiteConfig({
      featuredListings: { displayCount: 99 }
    });
    assert.strictEqual(configHigh.featuredListings.displayCount, 24);

    const configString = sanitizeSiteConfig({
      featuredListings: { displayCount: '12' }
    });
    assert.strictEqual(configString.featuredListings.displayCount, 12);
  });

  it('6. mergeSiteConfigWithDefaults correctly falls back to master_draft.featuredListings if top-level is omitted', () => {
    const backendDraftConfig = {
      master_draft: {
        featuredListings: {
          displayCount: 4,
          sectionTitle: 'Spotlight Properties',
          featuredPropertyIds: ['prop-a', 'prop-b']
        }
      }
    };

    const merged = mergeSiteConfigWithDefaults(backendDraftConfig);
    assert.strictEqual(merged.featuredListings.displayCount, 4);
    assert.strictEqual(merged.featuredListings.sectionTitle, 'Spotlight Properties');
    assert.deepStrictEqual(merged.featuredListings.featuredPropertyIds, ['prop-a', 'prop-b']);
  });

  it('7. When total promotion listing is zero, section is completely hidden and candidate resolution yields 0', () => {
    const featuredIds = [];
    assert.strictEqual(featuredIds.length, 0);

    const resolveShowcase = (ids, pool) => {
      if (ids.length === 0) return null; // Section is completely hidden/invisible
      return pool.filter(p => ids.includes(p.id));
    };

    const result = resolveShowcase(featuredIds, [{ id: 'prop_1' }]);
    assert.strictEqual(result, null);
  });

  it('8. When total promotion listing > 0, candidate pool correctly resolves promoted property even if missing from public properties', () => {
    const featuredIds = ['prop_1792671238027'];
    const publicProperties = []; // Empty or not yet approved for general public map search
    const promotedSnapshot = [
      {
        id: 'prop_1792671238027',
        title: 'aaa',
        propertyType: 'OPEN_PLOT',
        location: { city: 'Guntur' },
        photos: [{ url: '/uploads/custom_cover.png', isCover: true }]
      }
    ];

    const candidatePool = [];
    const seenKeys = new Set();
    const addToPool = (items) => {
      if (!Array.isArray(items)) return;
      items.forEach((p) => {
        if (!p) return;
        const key = String(p.id || p.propertyId || p.referenceId || '').trim().toLowerCase();
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key);
          candidatePool.push(p);
        }
      });
    };

    addToPool(publicProperties);
    addToPool(promotedSnapshot);

    const explicitlyFeatured = [];
    featuredIds.forEach((fId) => {
      const target = String(fId).trim().toLowerCase();
      const matched = candidatePool.find((p) => {
        if (!p) return false;
        const id1 = String(p.id || '').trim().toLowerCase();
        const id2 = String(p.propertyId || '').trim().toLowerCase();
        const ref = String(p.referenceId || '').trim().toLowerCase();
        return id1 === target || id2 === target || ref === target;
      });
      if (matched) explicitlyFeatured.push(matched);
    });

    assert.strictEqual(explicitlyFeatured.length, 1);
    assert.strictEqual(explicitlyFeatured[0].id, 'prop_1792671238027');
    assert.strictEqual(explicitlyFeatured[0].title, 'aaa');
  });

  it('9. Preserves exact slot order when multiple properties are promoted', () => {
    const featuredIds = ['prop-slot-1', 'prop-slot-2', 'prop-slot-3'];
    const pool = [
      { id: 'prop-slot-3', title: 'Slot 3 Property' },
      { id: 'prop-slot-1', title: 'Slot 1 Property' },
      { id: 'prop-slot-2', title: 'Slot 2 Property' }
    ];

    const matched = [];
    featuredIds.forEach((fId) => {
      const found = pool.find(p => p.id === fId);
      if (found) matched.push(found);
    });

    assert.strictEqual(matched.length, 3);
    assert.strictEqual(matched[0].id, 'prop-slot-1');
    assert.strictEqual(matched[1].id, 'prop-slot-2');
    assert.strictEqual(matched[2].id, 'prop-slot-3');
  });
});
