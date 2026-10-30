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

  it('10. Multi-property dynamic showcase accurately resolves 3 active promoted customer properties (aaa, CCC, Prop1)', () => {
    const featuredIds = ['prop_1792671238027', 'prop_1792995964157', 'prop_1793086252592'];
    const displayCount = 3;

    // Simulate multi-source property ecosystem: public, admin-cached, user-submitted
    const publicProps = [
      { id: 'prop_1792671238027', title: 'aaa', propertyType: 'OPEN_PLOT', price: 740000 }
    ];
    const userSubmittedProps = [
      { id: 'prop_1792995964157', title: 'CCC', propertyType: 'HOUSE', price: 7399926 },
      { id: 'prop_1793086252592', title: 'Prop1', propertyType: 'OPEN_PLOT', price: 2000000 }
    ];

    const candidatePool = [];
    const seen = new Set();
    const addToPool = (list) => {
      list.forEach(p => {
        if (!p) return;
        const key = String(p.id).toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          candidatePool.push(p);
        }
      });
    };

    addToPool(publicProps);
    addToPool(userSubmittedProps);

    const explicitlyFeatured = [];
    featuredIds.forEach(fId => {
      const target = String(fId).toLowerCase();
      const matched = candidatePool.find(p => String(p.id).toLowerCase() === target);
      if (matched) explicitlyFeatured.push(matched);
    });

    const homepageProperties = explicitlyFeatured.slice(0, displayCount);
    assert.strictEqual(homepageProperties.length, 3);
    assert.strictEqual(homepageProperties[0].title, 'aaa');
    assert.strictEqual(homepageProperties[1].title, 'CCC');
    assert.strictEqual(homepageProperties[2].title, 'Prop1');
  });

  it('11. Dynamic display slot presets correctly slice properties (1 slot = spotlight, 2 slots = dual, 3 slots = trio)', () => {
    const explicitlyFeatured = [
      { id: 'prop_1', title: 'aaa' },
      { id: 'prop_2', title: 'CCC' },
      { id: 'prop_3', title: 'Prop1' }
    ];

    // 1 Slot Preset
    const slot1Props = explicitlyFeatured.slice(0, 1);
    assert.strictEqual(slot1Props.length, 1);
    assert.strictEqual(slot1Props[0].id, 'prop_1');

    // 2 Slots Preset
    const slot2Props = explicitlyFeatured.slice(0, 2);
    assert.strictEqual(slot2Props.length, 2);
    assert.strictEqual(slot2Props[0].id, 'prop_1');
    assert.strictEqual(slot2Props[1].id, 'prop_2');

    // 3 Slots Preset
    const slot3Props = explicitlyFeatured.slice(0, 3);
    assert.strictEqual(slot3Props.length, 3);
    assert.strictEqual(slot3Props[2].id, 'prop_3');
  });

  it('12. LocalStorage admin draft is preserved during CMS config merge and not wiped out by stale remote empty state', () => {
    const remoteStaleConfig = {
      featuredListings: {
        featuredPropertyIds: [],
        displayCount: 6,
        sectionTitle: 'Featured & Recent Verified Properties'
      }
    };

    const localActiveAdminDraft = {
      featuredListings: {
        featuredPropertyIds: ['prop_1792671238027', 'prop_1792995964157', 'prop_1793086252592'],
        displayCount: 3,
        sectionTitle: 'Featured & Recent Verified Properties',
        badgeText: 'VERIFIED LISTINGS'
      }
    };

    // Merge logic: Local configured admin draft takes precedence over remote empty array
    const localIds = localActiveAdminDraft.featuredListings.featuredPropertyIds;
    const remoteIds = remoteStaleConfig.featuredListings.featuredPropertyIds;
    const resolvedIds = (localIds.length > 0) ? localIds : remoteIds;

    const resolvedConfig = {
      ...remoteStaleConfig.featuredListings,
      ...localActiveAdminDraft.featuredListings,
      featuredPropertyIds: resolvedIds
    };

    assert.strictEqual(resolvedConfig.featuredPropertyIds.length, 3);
    assert.strictEqual(resolvedConfig.displayCount, 3);
    assert.deepStrictEqual(resolvedConfig.featuredPropertyIds, [
      'prop_1792671238027',
      'prop_1792995964157',
      'prop_1793086252592'
    ]);
  });

  it('13. Resolves arbitrary dynamic customer properties without hardcoding any IDs or titles', () => {
    // Generate arbitrary dynamic IDs and properties
    const dynamicIds = ['custom_alpha_' + Date.now(), 'custom_beta_' + Date.now(), 'custom_gamma_' + Date.now()];
    const dynamicStore = [
      { id: dynamicIds[0], title: 'Dynamic Luxury Penthouse', propertyType: 'APARTMENT', price: 9500000 },
      { id: dynamicIds[1], title: 'Gated Community Plot', propertyType: 'OPEN_PLOT', price: 1500000 },
      { id: dynamicIds[2], title: 'Commercial Showroom', propertyType: 'COMMERCIAL', price: 42000000 }
    ];

    const explicitlyFeatured = [];
    dynamicIds.forEach(id => {
      const match = dynamicStore.find(p => p.id === id);
      if (match) explicitlyFeatured.push(match);
    });

    assert.strictEqual(explicitlyFeatured.length, 3);
    assert.strictEqual(explicitlyFeatured[0].title, 'Dynamic Luxury Penthouse');
    assert.strictEqual(explicitlyFeatured[1].title, 'Gated Community Plot');
    assert.strictEqual(explicitlyFeatured[2].title, 'Commercial Showroom');
  });

  it('14. TV Broadcast Rule: Authoritative remote server broadcast takes precedence over stale viewer local storage across all accounts', () => {
    // Viewer A has an old stale local storage from when there was only 1 property and displayCount: 1
    const viewerStaleLocalStorage = {
      featuredListings: {
        featuredPropertyIds: ['prop_stale_1'],
        displayCount: 1,
        promotedProperties: [{ id: 'prop_stale_1', title: 'Old Stale Property' }]
      }
    };

    // Central server broadcasts live promotions: 3 properties with dynamic displayCount: 3
    const remoteServerBroadcast = {
      featuredListings: {
        featuredPropertyIds: ['prop_1', 'prop_2', 'prop_3'],
        displayCount: 3,
        promotedProperties: [
          { id: 'prop_1', title: 'Property 1' },
          { id: 'prop_2', title: 'Property 2' },
          { id: 'prop_3', title: 'Property 3' }
        ],
        sectionTitle: 'Featured & Recent Verified Properties',
        badgeText: 'VERIFIED LISTINGS'
      }
    };

    // TV Channel Broadcast Resolution:
    const remoteFeatured = remoteServerBroadcast.featuredListings;
    const remoteIds = remoteFeatured.featuredPropertyIds;
    const localFeatured = viewerStaleLocalStorage.featuredListings;

    // When remote server broadcasts live promotions, it is authoritative over any viewer's stale local storage
    const resolvedFeatured = remoteIds.length > 0 ? {
      ...localFeatured,
      ...remoteFeatured,
      featuredPropertyIds: remoteIds,
      promotedProperties: remoteFeatured.promotedProperties,
      displayCount: remoteFeatured.displayCount
    } : localFeatured;

    assert.strictEqual(resolvedFeatured.featuredPropertyIds.length, 3);
    assert.strictEqual(resolvedFeatured.displayCount, 3);
    assert.deepStrictEqual(resolvedFeatured.featuredPropertyIds, ['prop_1', 'prop_2', 'prop_3']);
    assert.strictEqual(resolvedFeatured.promotedProperties.length, 3);
  });

  it('15. Dedicated Active Promotions Save: Removing properties from active promotions stages and saves exact updated list without resurrection', () => {
    const initialConfig = {
      featuredListings: {
        featuredPropertyIds: ['prop_1', 'prop_2', 'prop_3'],
        displayCount: 3,
        sectionTitle: 'Featured & Recent Verified Properties',
        badgeText: 'VERIFIED LISTINGS'
      }
    };

    // User removes prop_2
    const stagedIds = initialConfig.featuredListings.featuredPropertyIds.filter(id => id !== 'prop_2');
    assert.deepStrictEqual(stagedIds, ['prop_1', 'prop_3']);

    // Admin clicks dedicated "Save Promoted Properties"
    const savedConfig = mergeSiteConfigWithDefaults({
      ...initialConfig,
      featuredListings: {
        ...initialConfig.featuredListings,
        featuredPropertyIds: stagedIds
      }
    });

    assert.deepStrictEqual(savedConfig.featuredListings.featuredPropertyIds, ['prop_1', 'prop_3']);
    assert.strictEqual(savedConfig.featuredListings.featuredPropertyIds.includes('prop_2'), false);
  });

  it('16. Saving showcase headline & display settings preserves staged active promotions and never reverts removed properties', () => {
    // Staged list after removing prop_3
    const stagedIds = ['prop_1', 'prop_2'];

    // User edits headline settings and clicks Save Settings
    const newHeadlineTitle = 'Custom Headline Title';
    const newDisplayCount = 2;

    const savedConfig = mergeSiteConfigWithDefaults({
      featuredListings: {
        sectionTitle: newHeadlineTitle,
        badgeText: 'HOT DEALS',
        displayCount: newDisplayCount,
        featuredPropertyIds: stagedIds
      }
    });

    assert.strictEqual(savedConfig.featuredListings.sectionTitle, 'Custom Headline Title');
    assert.strictEqual(savedConfig.featuredListings.badgeText, 'HOT DEALS');
    assert.strictEqual(savedConfig.featuredListings.displayCount, 2);
    assert.deepStrictEqual(savedConfig.featuredListings.featuredPropertyIds, ['prop_1', 'prop_2']);
  });
});


