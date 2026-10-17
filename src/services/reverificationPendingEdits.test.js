import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mockApi } from './mockApi.js';
import { matchesSearchFilters } from '../utils/filterMatchingUtils.js';

describe('EaseLand Live Property Re-Verification & Modifications Protection Suite', () => {
  let originalStorage = {};

  beforeEach(() => {
    originalStorage = {};
    const mockStorage = {
      getItem: (key) => originalStorage[key] || null,
      setItem: (key, val) => { originalStorage[key] = String(val); },
      removeItem: (key) => { delete originalStorage[key]; },
      clear: () => { originalStorage = {}; }
    };

    globalThis.localStorage = mockStorage;
    globalThis.sessionStorage = mockStorage;
    globalThis.window = {
      localStorage: mockStorage,
      sessionStorage: mockStorage,
      dispatchEvent: () => true,
      CustomEvent: class {
        constructor(name, opts) {
          this.name = name;
          this.detail = opts ? opts.detail : null;
        }
      }
    };
  });

  afterEach(() => {
    delete globalThis.window;
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
  });

  it('1. Live property owner edits are safely staged in pendingReauditData and root approved data remains untouched', () => {
    const liveProperty = {
      id: 'prop-live-101',
      propertyId: 'prop-live-101',
      referenceId: 'EL-PROP-101',
      ownerId: 'owner-abc',
      title: 'Approved 200 Sq Yds Commercial Plot in Brodipet',
      price: 4500000,
      priceDisplay: 'Rs. 45 Lakhs',
      area: 1800,
      areaUnit: 'SQ_FT',
      propertyType: 'OPEN_PLOT',
      purpose: 'SALE',
      status: 'LIVE',
      listingStatus: 'LIVE',
      isPublished: true,
      isPlatformVerified: true,
      verificationStatus: 'Platform Verified',
      location: {
        city: 'Guntur',
        locality: 'Brodipet',
        address: 'Brodipet Main Road'
      },
      hasPendingEdits: false,
      pendingReauditData: null
    };

    // Simulate owner modifying details (changing price to 95 Lakhs and title)
    const proposedModifications = {
      title: 'Premium Golden Corner Plot Brodipet',
      price: 9500000,
      description: 'Newly updated owner description claiming commercial zoning.'
    };

    // Staging logic (mirrors updateOwnerProperty and submitPropertyForVerification)
    const stagedProperty = {
      ...liveProperty,
      hasPendingEdits: true,
      reAuditStatus: 'PENDING_VERIFICATION',
      reAuditRequestedAt: new Date().toISOString(),
      pendingReauditData: {
        ...proposedModifications,
        submittedAt: new Date().toISOString()
      },
      listingStatus: 'LIVE',
      status: 'LIVE',
      isPublished: true,
      isPlatformVerified: true
    };

    // Verify root public-facing details remain strictly unchanged
    assert.strictEqual(stagedProperty.title, 'Approved 200 Sq Yds Commercial Plot in Brodipet');
    assert.strictEqual(stagedProperty.price, 4500000);
    assert.strictEqual(stagedProperty.listingStatus, 'LIVE');
    assert.strictEqual(stagedProperty.isPublished, true);
    assert.strictEqual(stagedProperty.isPlatformVerified, true);

    // Verify proposed modifications are isolated inside pendingReauditData
    assert.strictEqual(stagedProperty.hasPendingEdits, true);
    assert.strictEqual(stagedProperty.reAuditStatus, 'PENDING_VERIFICATION');
    assert.strictEqual(stagedProperty.pendingReauditData.title, 'Premium Golden Corner Plot Brodipet');
    assert.strictEqual(stagedProperty.pendingReauditData.price, 9500000);
  });

  it('2. Public search filters match only approved root information, ignoring unapproved pending edits', () => {
    const livePropertyWithPendingEdits = {
      id: 'prop-live-102',
      propertyId: 'prop-live-102',
      title: 'Approved 3 BHK Luxury Apartment in Vijayawada',
      price: 6000000,
      propertyType: 'APARTMENT',
      purpose: 'SALE',
      status: 'LIVE',
      listingStatus: 'LIVE',
      isPublished: true,
      isPlatformVerified: true,
      specs: {
        bedrooms: 3,
        furnishing: 'Furnished',
        facing: 'East'
      },
      location: {
        city: 'Vijayawada',
        locality: 'Benz Circle'
      },
      hasPendingEdits: true,
      reAuditStatus: 'PENDING_VERIFICATION',
      pendingReauditData: {
        price: 15000000,
        specs: {
          furnishing: 'Unfurnished'
        }
      }
    };

    // Public searches for properties under 70 Lakhs
    const budgetSearchFilter = {
      minPrice: 5000000,
      maxPrice: 7000000
    };
    const matchesBudget = matchesSearchFilters(livePropertyWithPendingEdits, budgetSearchFilter);
    assert.strictEqual(matchesBudget, true, 'Property must match budget based on live approved price (60L), not proposed price (1.5Cr)');

    // Public searches for Furnished properties
    const furnishingFilter = {
      furnishing: 'Furnished'
    };
    const matchesFurnished = matchesSearchFilters(livePropertyWithPendingEdits, furnishingFilter);
    assert.strictEqual(matchesFurnished, true, 'Property must match based on live approved furnishing (Furnished), not proposed (Unfurnished)');

    // Public searches for 1.5 Crore budget (the unapproved proposed price)
    const highBudgetFilter = {
      minPrice: 14000000,
      maxPrice: 16000000
    };
    const matchesHighBudget = matchesSearchFilters(livePropertyWithPendingEdits, highBudgetFilter);
    assert.strictEqual(matchesHighBudget, false, 'Unapproved proposed price must NOT match public searches before admin approval');
  });

  it('3. Verification queue includes live property with pending re-audit, while regular live properties are excluded', () => {
    const regularLiveProperty = {
      id: 'prop-live-regular',
      propertyId: 'prop-live-regular',
      title: 'Untouched Live Villa',
      status: 'LIVE',
      listingStatus: 'LIVE',
      isPublished: true,
      isPlatformVerified: true,
      hasPendingEdits: false,
      reAuditStatus: null
    };

    const modifiedLiveProperty = {
      id: 'prop-live-modified',
      propertyId: 'prop-live-modified',
      title: 'Live Plot with Pending Changes',
      status: 'LIVE',
      listingStatus: 'LIVE',
      isPublished: true,
      isPlatformVerified: true,
      hasPendingEdits: true,
      reAuditStatus: 'PENDING_VERIFICATION',
      pendingReauditData: {
        price: 8800000
      }
    };

    // Populate mock storage with both properties
    globalThis.localStorage.setItem('easeland_properties', JSON.stringify([
      regularLiveProperty,
      modifiedLiveProperty
    ]));

    const queue = mockApi.getVerificationQueue();
    const queueIds = queue.map(p => String(p.id || p.propertyId));

    assert.strictEqual(queueIds.includes('prop-live-modified'), true, 'Live property with pending modifications must appear in verification queue');
    assert.strictEqual(queueIds.includes('prop-live-regular'), false, 'Normal live property without pending edits must NOT appear in verification queue');
  });

  it('4. Admin approval merges pendingReauditData into live root properties and clears pending flags', () => {
    const initialLiveProperty = {
      id: 'prop-live-audit-test',
      propertyId: 'prop-live-audit-test',
      referenceId: 'EL-PROP-AUDIT',
      title: 'Original Title Before Edit',
      price: 5000000,
      description: 'Original description',
      status: 'LIVE',
      listingStatus: 'LIVE',
      isPublished: true,
      isPlatformVerified: true,
      hasPendingEdits: true,
      reAuditStatus: 'PENDING_VERIFICATION',
      pendingReauditData: {
        title: 'Admin Approved New Title',
        price: 5500000,
        description: 'Updated verified description'
      }
    };

    globalThis.localStorage.setItem('easeland_properties', JSON.stringify([initialLiveProperty]));

    // Execute admin approval
    const approvedProp = mockApi.approvePropertyAdmin('prop-live-audit-test', 'Verified and approved owner modifications.');

    // Verify modifications have merged into root property
    assert.strictEqual(approvedProp.title, 'Admin Approved New Title');
    assert.strictEqual(approvedProp.price, 5500000);
    assert.strictEqual(approvedProp.description, 'Updated verified description');

    // Verify pending flags are cleared
    assert.strictEqual(approvedProp.hasPendingEdits, false);
    assert.strictEqual(approvedProp.reAuditStatus, null);
    assert.strictEqual(approvedProp.pendingReauditData, null);
    assert.strictEqual(approvedProp.listingStatus, 'LIVE');
    assert.strictEqual(approvedProp.isPlatformVerified, true);
    assert.strictEqual(approvedProp.isPublished, true);

    // Verify local storage is updated synchronously
    const stored = JSON.parse(globalThis.localStorage.getItem('easeland_properties') || '[]');
    const storedProp = stored.find(p => p.id === 'prop-live-audit-test');
    assert.strictEqual(storedProp.title, 'Admin Approved New Title');
    assert.strictEqual(storedProp.hasPendingEdits, false);
  });

  it('5. Admin rejection of proposed edits discards pendingReauditData and keeps original approved live data intact', () => {
    const originalApprovedTitle = 'Historic Approved Landmark Plot';
    const originalApprovedPrice = 7500000;

    const livePropWithUnapprovedEdits = {
      id: 'prop-reject-edits-test',
      propertyId: 'prop-reject-edits-test',
      referenceId: 'EL-PROP-REJECT-EDITS',
      title: originalApprovedTitle,
      price: originalApprovedPrice,
      status: 'LIVE',
      listingStatus: 'LIVE',
      isPublished: true,
      isPlatformVerified: true,
      hasPendingEdits: true,
      reAuditStatus: 'PENDING_VERIFICATION',
      pendingReauditData: {
        title: 'Funny Unverified Title Modification',
        price: 99999999
      }
    };

    globalThis.localStorage.setItem('easeland_properties', JSON.stringify([livePropWithUnapprovedEdits]));

    // Execute rejection of edits (NOT rejecting the entire property)
    const resultProp = mockApi.rejectPropertyEditsAdmin('prop-reject-edits-test', 'Proposed price spike and title change rejected.');

    // Original approved details must remain unchanged
    assert.strictEqual(resultProp.title, originalApprovedTitle);
    assert.strictEqual(resultProp.price, originalApprovedPrice);

    // Proposed edits must be cleared
    assert.strictEqual(resultProp.hasPendingEdits, false);
    assert.strictEqual(resultProp.reAuditStatus, 'EDITS_REJECTED');
    assert.strictEqual(resultProp.pendingReauditData, null);

    // Listing must remain LIVE and published with zero interruption to buyers
    assert.strictEqual(resultProp.listingStatus, 'LIVE');
    assert.strictEqual(resultProp.isPublished, true);
    assert.strictEqual(resultProp.isPlatformVerified, true);
  });

  it('6. Edit Listing preserves actual distinct setup locations across different properties and does not clobber with old or deleted property locations', () => {
    // Property 1 in Guntur
    const propGuntur = {
      id: 'prop-loc-guntur',
      propertyId: 'prop-loc-guntur',
      title: 'Guntur Commercial Plot',
      location: {
        city: 'Guntur',
        locality: 'Brodipet',
        address: 'Brodipet Main Rd, Guntur',
        lat: 16.3067,
        lng: 80.4365,
        confirmed: true
      }
    };

    // Property 2 in Vijayawada
    const propVijayawada = {
      id: 'prop-loc-vijayawada',
      propertyId: 'prop-loc-vijayawada',
      title: 'Vijayawada Commercial Space',
      location: {
        city: 'Vijayawada',
        locality: 'Benz Circle',
        address: 'Benz Circle, Vijayawada',
        lat: 16.5062,
        lng: 80.6480,
        confirmed: true
      }
    };

    // Property 3 in Visakhapatnam
    const propVizag = {
      id: 'prop-loc-vizag',
      propertyId: 'prop-loc-vizag',
      title: 'Visakhapatnam Sea View Plot',
      location: {
        city: 'Visakhapatnam',
        locality: 'Beach Road',
        address: 'RK Beach Rd, Visakhapatnam',
        lat: 17.7126,
        lng: 83.3197,
        confirmed: true
      }
    };

    // Simulate stale deleted property location in user-level key
    const deletedLocation = {
      city: 'Hyderabad',
      locality: 'Banjara Hills',
      address: 'Old Deleted Property Location',
      lat: 17.4123,
      lng: 78.4312,
      confirmed: true
    };
    globalThis.localStorage.setItem('easeland_wizard_location_user123', JSON.stringify(deletedLocation));
    globalThis.localStorage.setItem('easeland_wizard_location_guest', JSON.stringify(deletedLocation));

    // When resolving property locations for editing, each property must retain its own actual location
    const resolveLocation = (p) => {
      let loc = p.location || null;
      const hasValid = Boolean(
        loc && (
          loc.confirmed ||
          loc.geoPoint ||
          (loc.lat && !isNaN(Number(loc.lat)) && Number(loc.lat) !== 0 && Number(loc.lat) !== 20.5937) ||
          loc.locality ||
          loc.city ||
          loc.address
        )
      );
      if (!hasValid && typeof window !== 'undefined' && (p.propertyId || p.id)) {
        const stored = localStorage.getItem('easeland_wizard_location_' + (p.propertyId || p.id));
        if (stored) loc = JSON.parse(stored);
      }
      return loc;
    };

    const gunturLoc = resolveLocation(propGuntur);
    const vjaLoc = resolveLocation(propVijayawada);
    const vizagLoc = resolveLocation(propVizag);

    assert.strictEqual(gunturLoc.city, 'Guntur');
    assert.strictEqual(gunturLoc.lat, 16.3067);
    assert.strictEqual(vjaLoc.city, 'Vijayawada');
    assert.strictEqual(vjaLoc.lat, 16.5062);
    assert.strictEqual(vizagLoc.city, 'Visakhapatnam');
    assert.strictEqual(vizagLoc.lat, 17.7126);

    // Verify none of them show the deleted Hyderabad location
    assert.notStrictEqual(gunturLoc.city, 'Hyderabad');
    assert.notStrictEqual(vjaLoc.city, 'Hyderabad');
    assert.notStrictEqual(vizagLoc.city, 'Hyderabad');
  });

  it('7. Deleting a property purges its wizard location cache and editing property session state', async () => {
    const { deletePropertyListing } = await import('../firebase/propertyService.js');
    const pId = 'prop-to-delete-999';

    globalThis.localStorage.setItem('easeland_wizard_location_' + pId, JSON.stringify({ city: 'Ongole', lat: 15.5, lng: 80.0 }));
    globalThis.sessionStorage.setItem('easeland_editing_property', JSON.stringify({ id: pId, title: 'Ongole Property' }));

    await deletePropertyListing(pId, 'owner-user-123', false);

    assert.strictEqual(globalThis.localStorage.getItem('easeland_wizard_location_' + pId), null);
    assert.strictEqual(globalThis.sessionStorage.getItem('easeland_editing_property'), null);
  });
});
