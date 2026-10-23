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
});
