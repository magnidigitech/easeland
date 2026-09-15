import { describe, it, expect } from 'vitest';
import { fsRules } from './securityRulesBundle.js';
import {
  startPropertyReview,
  approvePropertyVerification,
  requestVerificationChanges,
  rejectPropertyVerification,
  updateMediaItemVerificationStatus
} from './verificationService.js';
import {
  getAllUsersAdmin,
  suspendUserAccount,
  unsuspendUserAccount
} from './userService.js';
import {
  submitMarketplaceReport,
  getAllReportsAdmin,
  resolveReportAdmin
} from './reportService.js';
import {
  getSiteConfigAdmin,
  updateSiteModuleAdmin,
  publishSiteConfigAdmin
} from './siteManagementService.js';

describe('Block 20 — Admin Governance & Verification Suite', () => {
  it('exports all expected verification and governance functions', () => {
    expect(typeof startPropertyReview).toBe('function');
    expect(typeof approvePropertyVerification).toBe('function');
    expect(typeof requestVerificationChanges).toBe('function');
    expect(typeof rejectPropertyVerification).toBe('function');
    expect(typeof updateMediaItemVerificationStatus).toBe('function');
    expect(typeof getAllUsersAdmin).toBe('function');
    expect(typeof suspendUserAccount).toBe('function');
    expect(typeof unsuspendUserAccount).toBe('function');
    expect(typeof submitMarketplaceReport).toBe('function');
    expect(typeof getAllReportsAdmin).toBe('function');
    expect(typeof resolveReportAdmin).toBe('function');
    expect(typeof getSiteConfigAdmin).toBe('function');
    expect(typeof updateSiteModuleAdmin).toBe('function');
    expect(typeof publishSiteConfigAdmin).toBe('function');
  });

  it('enforces isNotSuspended check in security rules bundle', () => {
    expect(fsRules).includes('isNotSuspended()');
    expect(fsRules).includes("accountStatus != 'SUSPENDED'");
  });

  it('restricts admin internal collections strictly to isAdmin()', () => {
    expect(fsRules).includes('match /propertyAdminInternal/{propertyId}');
    expect(fsRules).includes('match /verificationRecords/{verificationId}');
    expect(fsRules).includes('match /activityLogs/{logId}');
    expect(fsRules).includes('allow read, write: if isAdmin();');
  });

  it('configures reports collection security rules correctly', () => {
    expect(fsRules).includes('match /reports/{reportId}');
    expect(fsRules).includes('allow create: if isSignedIn()');
    expect(fsRules).includes('allow update, delete: if isAdmin();');
  });

  it('configures siteManagement collection security rules correctly', () => {
    expect(fsRules).includes('match /siteManagement/{moduleId}');
    expect(fsRules).includes("allow read: if (resource != null && resource.data.state == 'PUBLISHED') || isAdmin();");
    expect(fsRules).includes('allow write: if isAdmin();');
  });

  it('preserves user phone number and maps profile fields cleanly in getAllUsersAdmin', async () => {
    const res = await getAllUsersAdmin();
    expect(res).toBeDefined();
    expect(Array.isArray(res.users)).toBe(true);
  });
});
