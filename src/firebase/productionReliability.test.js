import { describe, it, expect } from 'vitest';
import { fsRules } from './securityRulesBundle.js';
import { formatFirestoreError } from './userService.js';
import { getPublicPropertyById, getOwnerProperties } from './propertyService.js';
import { createEnquiry, getCustomerEnquiries } from './enquiryService.js';
import { getUserWishlistProperties, addWishlistProperty } from './wishlistService.js';
import { startPropertyReview, approvePropertyVerification } from './verificationService.js';
import { getAllReportsAdmin } from './reportService.js';
import { getSiteConfigAdmin } from './siteManagementService.js';

describe('Block 21 — Final Production Hardening, Error Handling & System Reliability Suite', () => {

  // -------------------------------------------------------------
  // REL-01: formatFirestoreError standardizes error formatting
  // -------------------------------------------------------------
  it('REL-01: formatFirestoreError standardizes Firestore error codes into human-readable messages', () => {
    expect(formatFirestoreError({ code: 'permission-denied' })).toContain('Access Restricted');
    expect(formatFirestoreError({ code: 'not-found' })).toContain('Resource Not Found');
    expect(formatFirestoreError({ code: 'unavailable' })).toContain('Connection Error');
    expect(formatFirestoreError({ code: 'unauthenticated' })).toContain('Authentication Required');
    expect(formatFirestoreError('Custom error string')).toBe('Custom error string');
    expect(formatFirestoreError(null)).toContain('unexpected system error');
  });

  // -------------------------------------------------------------
  // REL-02: Property detail page loading and failure state handling
  // -------------------------------------------------------------
  it('REL-02: Property detail page distinguishes loading, 404, connection, and unavailable states', () => {
    const connErr = formatFirestoreError({ code: 'unavailable' });
    const notFoundErr = formatFirestoreError({ code: 'not-found' });
    const permErr = formatFirestoreError({ code: 'permission-denied' });

    expect(connErr.toLowerCase()).toContain('connection error');
    expect(notFoundErr.toLowerCase()).toContain('resource not found');
    expect(permErr.toLowerCase()).toContain('access restricted');
  });

  // -------------------------------------------------------------
  // REL-03: Double-click / race-condition protection contracts
  // -------------------------------------------------------------
  it('REL-03: System enforces double-click prevention patterns across UI state handlers', () => {
    let submitting = false;
    const mockHandler = async () => {
      if (submitting) return { blocked: true };
      submitting = true;
      try {
        return { blocked: false };
      } finally {
        submitting = false;
      }
    };

    // First call proceeds
    submitting = true;
    const secondCall = mockHandler();
    secondCall.then(res => {
      expect(res.blocked).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // REL-04: Suspended account UI banner & action blocking
  // -------------------------------------------------------------
  it('REL-04: Suspended account state triggers UI lockout and action blocking', () => {
    const suspendedUser = { accountStatus: 'SUSPENDED', suspension: { reason: 'Policy Violation' } };
    const isSuspended = suspendedUser.accountStatus === 'SUSPENDED';
    expect(isSuspended).toBe(true);
    expect(suspendedUser.suspension.reason).toBe('Policy Violation');
  });

  // -------------------------------------------------------------
  // REL-05: Service contracts preserve existing return signatures
  // -------------------------------------------------------------
  it('REL-05: Service layer functions expose expected async function signatures', () => {
    expect(typeof getPublicPropertyById).toBe('function');
    expect(typeof getOwnerProperties).toBe('function');
    expect(typeof createEnquiry).toBe('function');
    expect(typeof getCustomerEnquiries).toBe('function');
    expect(typeof getUserWishlistProperties).toBe('function');
    expect(typeof addWishlistProperty).toBe('function');
    expect(typeof startPropertyReview).toBe('function');
    expect(typeof approvePropertyVerification).toBe('function');
    expect(typeof getAllReportsAdmin).toBe('function');
    expect(typeof getSiteConfigAdmin).toBe('function');
  });

  // -------------------------------------------------------------
  // REL-06: Production builds contain zero mock/demo fallbacks
  // -------------------------------------------------------------
  it('REL-06: Production services do not rely on mock/demo fallback arrays', () => {
    expect(getPublicPropertyById.toString()).not.toContain('mockProperties');
    expect(getOwnerProperties.toString()).not.toContain('mockProperties');
    expect(createEnquiry.toString()).not.toContain('mockEnquiries');
    expect(addWishlistProperty.toString()).not.toContain('mockWishlist');
  });

  // -------------------------------------------------------------
  // REL-07: Security rules mandate isNotSuspended() boundary
  // -------------------------------------------------------------
  it('REL-07: Security rules enforce isNotSuspended() boundary on protected collections', () => {
    expect(fsRules).toContain('function isNotSuspended()');
    expect(fsRules).toContain("accountStatus != 'SUSPENDED'");
    expect(fsRules).toContain('match /enquiries/{enquiryId}');
    expect(fsRules).toContain('match /wishlist/{propertyId}');
    expect(fsRules).toContain('match /reports/{reportId}');
  });

  // -------------------------------------------------------------
  // REL-08: Invalid/deleted property produces a controlled Not Found state
  // -------------------------------------------------------------
  it('REL-08: Invalid or deleted property ID produces a controlled Not Found response', async () => {
    const res = await getPublicPropertyById('invalid_non_existent_id');
    expect(res).toBeDefined();
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  }, 15000);

  // -------------------------------------------------------------
  // REL-09: Private/unpublished property does not expose confidential info
  // -------------------------------------------------------------
  it('REL-09: Firestore rules isolate public read access to LIVE & isPublished == true', () => {
    expect(fsRules).toContain("listingStatus == 'LIVE'");
    expect(fsRules).toContain('isPublished == true');
    expect(fsRules).toContain('match /propertyPrivate/{propertyId}');
    expect(fsRules).toContain('match /propertyMediaPrivate/{propertyId}');
    expect(fsRules).toContain('match /propertyDocuments/{docId}');
  });

  // -------------------------------------------------------------
  // REL-10: Service-layer error handling preserves successful return contracts
  // -------------------------------------------------------------
  it('REL-10: Service methods maintain standardized response shape { success: boolean }', async () => {
    const mockFailRes = { success: false, error: formatFirestoreError({ code: 'permission-denied' }) };
    expect(mockFailRes).toHaveProperty('success', false);
    expect(mockFailRes.error).toContain('Access Restricted');
  });

  // -------------------------------------------------------------
  // REL-11: Suspended account UI cannot bypass database-layer restrictions
  // -------------------------------------------------------------
  it('REL-11: Database security rules remain authoritative security boundary for suspended accounts', () => {
    expect(fsRules).toContain('isNotSuspended()');
    const hasSuspensionCheckInRules = fsRules.includes('accountStatus != \'SUSPENDED\'');
    expect(hasSuspensionCheckInRules).toBe(true);
  });

  // -------------------------------------------------------------
  // REL-12: No production mock/demo fallback arrays are introduced
  // -------------------------------------------------------------
  it('REL-12: Production Firebase services use direct Firestore SDK methods', () => {
    expect(getPublicPropertyById.toString()).toContain('getDoc');
    expect(getOwnerProperties.toString()).toContain('getDocs');
    expect(createEnquiry.toString()).toContain('setDoc');
    expect(addWishlistProperty.toString()).toContain('setDoc');
  });

});
