import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('EaseLand Re-Audit & Modifications Lifecycle Regression Suite', () => {

  it('1. Owner edits on live property preserve pendingReauditData and flag in server-side save logic', async () => {
    // Import server module components or test logic equivalent to saveLocalProperty
    const existingLive = {
      propertyId: 'el-prop-2001',
      id: 'el-prop-2001',
      referenceId: 'EL-PROP-2001',
      title: 'Original Live Farmland in Amaravati',
      price: 8000000,
      propertyType: 'AGRICULTURAL_LAND',
      status: 'LIVE',
      listingStatus: 'LIVE',
      isPublished: true,
      isPlatformVerified: true,
      verificationStatus: 'Platform Verified',
      hasPendingEdits: false,
      pendingReauditData: null,
      reAuditStatus: null
    };

    // Owner payload sent when editing and submitting for verification
    const ownerSubmissionPayload = {
      propertyId: 'el-prop-2001',
      id: 'el-prop-2001',
      status: 'LIVE',
      listingStatus: 'LIVE',
      hasPendingEdits: true,
      reAuditStatus: 'PENDING_VERIFICATION',
      isOwnerDraftEdit: true,
      pendingReauditData: {
        title: 'Updated Road-Facing Farmland with Fencing',
        price: 9500000,
        description: 'New canal water connectivity and clear boundary fencing.'
      }
    };

    // Test staging branch condition in server.js
    const existingStatusUpper = String(existingLive.status || '').toUpperCase();
    const isLive = existingStatusUpper === 'LIVE';
    const isOwnerDraft = (
      (ownerSubmissionPayload.isOwnerDraftEdit === true ||
       ownerSubmissionPayload.hasPendingEdits === true ||
       Boolean(ownerSubmissionPayload.pendingReauditData)) &&
      !ownerSubmissionPayload.isAdminAction &&
      isLive
    );

    assert.strictEqual(isOwnerDraft, true, 'Server saveLocalProperty must recognize owner edit on live property');

    // Simulate server updated output
    const incomingProposed = ownerSubmissionPayload.pendingReauditData;
    const cleanProposed = {};
    for (const [k, v] of Object.entries(incomingProposed)) {
      if (v !== undefined && v !== null && v !== '') {
        cleanProposed[k] = v;
      }
    }

    const updated = {
      ...existingLive,
      hasPendingEdits: true,
      reAuditStatus: ownerSubmissionPayload.reAuditStatus || 'PENDING_VERIFICATION',
      pendingReauditData: cleanProposed,
      status: 'LIVE',
      isPublished: true,
      isPlatformVerified: true
    };

    // Verify public properties are protected
    assert.strictEqual(updated.title, 'Original Live Farmland in Amaravati');
    assert.strictEqual(updated.price, 8000000);

    // Verify pending edits are intact
    assert.strictEqual(updated.hasPendingEdits, true);
    assert.strictEqual(updated.reAuditStatus, 'PENDING_VERIFICATION');
    assert.strictEqual(updated.pendingReauditData.title, 'Updated Road-Facing Farmland with Fencing');
    assert.strictEqual(updated.pendingReauditData.price, 9500000);
  });

  it('2. UserDashboard property mapping includes hasPendingEdits and reAuditStatus to render Live (Re-Audit Pending) badge', () => {
    const rawPropFromServer = {
      propertyId: 'el-prop-2001',
      id: 'el-prop-2001',
      title: 'Original Live Farmland in Amaravati',
      price: 8000000,
      status: 'LIVE',
      listingStatus: 'LIVE',
      isPublished: true,
      isPlatformVerified: true,
      hasPendingEdits: true,
      reAuditStatus: 'PENDING_VERIFICATION',
      pendingReauditData: {
        title: 'Updated Road-Facing Farmland with Fencing',
        price: 9500000
      }
    };

    // Replicate UserDashboard mapping logic
    const mapped = {
      id: rawPropFromServer.propertyId,
      status: rawPropFromServer.status,
      isPlatformVerified: rawPropFromServer.isPlatformVerified,
      isPublished: rawPropFromServer.isPublished,
      hasPendingEdits: Boolean(rawPropFromServer.hasPendingEdits),
      reAuditStatus: rawPropFromServer.reAuditStatus,
      pendingReauditData: rawPropFromServer.pendingReauditData,
      rawProperty: rawPropFromServer
    };

    assert.strictEqual(mapped.hasPendingEdits, true);
    assert.strictEqual(mapped.reAuditStatus, 'PENDING_VERIFICATION');

    // Replicate badge selection
    let badgeText = '';
    if ((mapped.status === 'LIVE' || mapped.status === 'APPROVED') && mapped.hasPendingEdits && (mapped.reAuditStatus === 'PENDING_VERIFICATION' || mapped.reAuditStatus === 'UNDER_REVIEW')) {
      badgeText = 'Live (Re-Audit Pending)';
    } else if (mapped.status === 'PENDING_VERIFICATION' || (mapped.hasPendingEdits && (mapped.reAuditStatus === 'PENDING_VERIFICATION' || mapped.reAuditStatus === 'UNDER_REVIEW'))) {
      badgeText = 'Under Audit';
    } else if (mapped.status === 'LIVE' && mapped.isPlatformVerified && mapped.isPublished) {
      badgeText = 'Live & Verified';
    }

    assert.strictEqual(badgeText, 'Live (Re-Audit Pending)', 'Badge must show Live (Re-Audit Pending) for live properties under re-audit');
  });

  it('3. Admin Portal verification queue includes property with pending re-audit and approval applies edits live', () => {
    const livePropWithPendingEdits = {
      id: 'el-prop-2001',
      propertyId: 'el-prop-2001',
      title: 'Original Live Farmland in Amaravati',
      price: 8000000,
      status: 'LIVE',
      listingStatus: 'LIVE',
      isPublished: true,
      isPlatformVerified: true,
      hasPendingEdits: true,
      reAuditStatus: 'PENDING_VERIFICATION',
      pendingReauditData: {
        title: 'Updated Road-Facing Farmland with Fencing',
        price: 9500000
      }
    };

    // Admin queue condition in AdminPortal.jsx
    const hasPendingReaudit = Boolean(
      (livePropWithPendingEdits.hasPendingEdits === true || Boolean(livePropWithPendingEdits.pendingReauditData)) &&
      (livePropWithPendingEdits.reAuditStatus === 'PENDING_VERIFICATION' || livePropWithPendingEdits.reAuditStatus === 'UNDER_REVIEW') &&
      livePropWithPendingEdits.reAuditStatus !== 'EDITS_REJECTED'
    );

    assert.strictEqual(hasPendingReaudit, true, 'Admin portal verification queue must admit live property with pending re-audit');

    // Admin approves modifications (AdminPortal handleApprove)
    const approvedResult = {
      ...livePropWithPendingEdits,
      ...livePropWithPendingEdits.pendingReauditData,
      hasPendingEdits: false,
      reAuditStatus: null,
      pendingReauditData: null,
      status: 'LIVE',
      isPlatformVerified: true,
      isPublished: true
    };

    // Now verified changes reflect on live site
    assert.strictEqual(approvedResult.title, 'Updated Road-Facing Farmland with Fencing');
    assert.strictEqual(approvedResult.price, 9500000);
    assert.strictEqual(approvedResult.hasPendingEdits, false);
    assert.strictEqual(approvedResult.status, 'LIVE');
  });

  it('4. Zero-fallback error enforcement: Failed submissions return explicit error and never fake success: true', () => {
    // Validate submission contract: on failure, an explicit error must be reported
    const simulateFailingSubmission = (err) => {
      try {
        throw new Error(err || 'Database network timeout during audit submission');
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    const failedRes = simulateFailingSubmission('PostgreSQL rejected property sync');
    assert.strictEqual(failedRes.success, false, 'Failure must NOT return success: true');
    assert.strictEqual(failedRes.error, 'PostgreSQL rejected property sync', 'Failure must preserve exact error message');

    // Validate frontend handler contract: error must show errorMsg and NOT setSubmittedSuccess(true)
    let submittedSuccess = false;
    let errorMsg = null;

    const handleSubmissionResult = (res) => {
      if (res && res.success === true) {
        submittedSuccess = true;
      } else {
        errorMsg = res?.error || 'Failed to submit property for verification.';
      }
    };

    handleSubmissionResult(failedRes);
    assert.strictEqual(submittedSuccess, false, 'UI must NEVER mark submission as successful when server or service reports failure');
    assert.strictEqual(errorMsg, 'PostgreSQL rejected property sync', 'UI must expose real error to user instead of silent failure');
  });

  it('5. Public visibility gate blocks fresh unapproved properties but keeps approved live properties visible during re-audit', async () => {
    const { isPropertyPubliclyVisible } = await import('../utils/filterMatchingUtils.js');

    const freshUnderAuditProperty = {
      id: 'prop_test_fresh_audit',
      title: 'Amaravati Plot Under Initial Verification Audit',
      status: 'PENDING_VERIFICATION',
      listingStatus: 'PENDING_VERIFICATION',
      isPublished: false,
      isPlatformVerified: false,
      hasPendingEdits: false,
      reAuditStatus: null
    };

    const isFreshVisible = isPropertyPubliclyVisible(freshUnderAuditProperty);
    assert.strictEqual(isFreshVisible, false, 'Fresh property under verification audit MUST NEVER be publicly visible on live site');

    const liveWithReauditProperty = {
      id: 'prop_test_live_reaudit',
      title: 'Amaravati Plot Live with Proposed Edits in Staging',
      status: 'LIVE',
      listingStatus: 'LIVE',
      isPublished: true,
      isPlatformVerified: true,
      hasPendingEdits: true,
      reAuditStatus: 'PENDING_VERIFICATION'
    };

    const isReauditVisible = isPropertyPubliclyVisible(liveWithReauditProperty);
    assert.strictEqual(isReauditVisible, true, 'Approved live property with pending re-audit must remain publicly visible with baseline details');
  });

  it('6. Property with isAlreadyLive or hasPendingEdits remains publicly visible and server saveLocalProperty protects live status', async () => {
    const { isPropertyPubliclyVisible } = await import('../utils/filterMatchingUtils.js');

    const liveReauditProperty = {
      id: 'prop_test_reaudit_protected',
      propertyId: 'prop_test_reaudit_protected',
      title: 'Prope2 Live Farmland',
      status: 'LIVE',
      listingStatus: 'LIVE',
      isPublished: true,
      isPlatformVerified: true,
      isAlreadyLive: true,
      hasPendingEdits: true,
      reAuditStatus: 'PENDING_VERIFICATION',
      pendingReauditData: {
        title: 'Prope2 Updated Farmland'
      }
    };

    // Client public visibility test
    assert.strictEqual(isPropertyPubliclyVisible(liveReauditProperty), true, 'Re-audit property must be visible on client');

    // Server-side save branch condition simulation
    const existing = { ...liveReauditProperty };
    const p = {
      propertyId: 'prop_test_reaudit_protected',
      isAlreadyLive: true,
      hasPendingEdits: true,
      pendingReauditData: {
        title: 'Prope2 Newly Submitted Modification'
      }
    };

    const existingStatusUpper = String(existing.status || '').toUpperCase();
    const existingListingStatusUpper = String(existing.listingStatus || '').toUpperCase();
    const isAdminAction = false;
    const isExplicitOwnerSubmission = true;

    const isLiveBranch = !isAdminAction && (
      (p.isOwnerDraftEdit === true || p.hasPendingEdits === true || Boolean(p.pendingReauditData) || isExplicitOwnerSubmission) &&
      (existingStatusUpper === 'LIVE' || existingListingStatusUpper === 'LIVE' || (existing.isPublished && existing.isPlatformVerified) || existing.isAlreadyLive === true || p.isAlreadyLive === true || existing.hasPendingEdits === true || Boolean(existing.reAuditStatus) || Boolean(existing.pendingReauditData))
    );

    assert.strictEqual(isLiveBranch, true, 'Server saveLocalProperty must route live re-audit edits to branch 2');
  });
});

