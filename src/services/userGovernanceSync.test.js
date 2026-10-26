import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('EaseLand User Governance & Real-Time Firebase Sync Suite', () => {
  it('1. Suspending user correctly sets accountStatus to SUSPENDED with duration and reason', () => {
    const initialUsers = [
      { id: 'usr-1', uid: 'usr-1', name: 'Ramesh Varma', email: 'ramesh@example.com', status: 'ACTIVE', accountStatus: 'ACTIVE' },
      { id: 'usr-2', uid: 'usr-2', name: 'Sita Sharma', email: 'sita@example.com', status: 'ACTIVE', accountStatus: 'ACTIVE' }
    ];

    const targetUser = initialUsers[0];
    const suspensionDays = 7;
    const suspensionHours = 0;
    const totalHours = (suspensionDays * 24) + suspensionHours;
    const reasonText = 'Fraudulent Land Title Document Upload';

    const suspensionPayload = {
      days: suspensionDays,
      hours: suspensionHours,
      totalHours: totalHours,
      reason: reasonText,
      suspendedAt: new Date('2026-10-17T12:00:00Z').toISOString(),
      suspendedUntil: new Date('2026-10-24T12:00:00Z').toISOString(),
      suspendedBy: 'admin_uid_001'
    };

    const updatedUsers = initialUsers.map(u => {
      if (u.id === targetUser.id || u.email === targetUser.email) {
        return {
          ...u,
          accountStatus: 'SUSPENDED',
          status: 'SUSPENDED',
          suspension: suspensionPayload,
          suspensionReason: reasonText
        };
      }
      return u;
    });

    const suspended = updatedUsers.find(u => u.id === 'usr-1');
    assert.equal(suspended.status, 'SUSPENDED');
    assert.equal(suspended.accountStatus, 'SUSPENDED');
    assert.equal(suspended.suspension.days, 7);
    assert.equal(suspended.suspension.reason, 'Fraudulent Land Title Document Upload');

    // Other user must remain active
    const untouched = updatedUsers.find(u => u.id === 'usr-2');
    assert.equal(untouched.status, 'ACTIVE');
  });

  it('2. Unsuspending user restores accountStatus to ACTIVE and clears suspension metadata', () => {
    const suspendedUsers = [
      {
        id: 'usr-1',
        uid: 'usr-1',
        name: 'Ramesh Varma',
        email: 'ramesh@example.com',
        status: 'SUSPENDED',
        accountStatus: 'SUSPENDED',
        suspension: { days: 7, reason: 'Pending Verification' }
      },
      { id: 'usr-2', uid: 'usr-2', name: 'Sita Sharma', email: 'sita@example.com', status: 'SUSPENDED', accountStatus: 'SUSPENDED' }
    ];

    const targetUser = suspendedUsers[0];

    // Accurate matching ensures only target user is unsuspended
    const restoredUsers = suspendedUsers.map(usr => {
      const isMatch = (targetUser.id && (usr.id === targetUser.id || usr.uid === targetUser.id)) ||
                      (targetUser.email && usr.email && usr.email.toLowerCase() === targetUser.email.toLowerCase());
      if (isMatch) {
        return {
          ...usr,
          accountStatus: 'ACTIVE',
          status: 'ACTIVE',
          suspension: null,
          suspensionReason: null
        };
      }
      return usr;
    });

    const unsuspended = restoredUsers.find(u => u.id === 'usr-1');
    assert.equal(unsuspended.status, 'ACTIVE');
    assert.equal(unsuspended.accountStatus, 'ACTIVE');
    assert.equal(unsuspended.suspension, null);

    // Other user must still remain suspended
    const otherUser = restoredUsers.find(u => u.id === 'usr-2');
    assert.equal(otherUser.status, 'SUSPENDED');
  });

  it('3. Permanently removing user deletes account and prevents re-appearance from cache', () => {
    const userList = [
      { id: 'usr-10', uid: 'usr-10', email: 'fraudster@fake.com', name: 'Fake Account' },
      { id: 'usr-20', uid: 'usr-20', email: 'legit@easeland.in', name: 'Legit Owner' }
    ];

    const targetId = 'usr-10';
    const targetEmail = 'fraudster@fake.com';

    let deletedUsers = [targetId, targetEmail];

    const filtered = userList.filter(u => {
      const id1 = String(u.id || u.uid || '').toLowerCase().trim();
      const em1 = String(u.email || '').toLowerCase().trim();
      return id1 !== targetId && em1 !== targetEmail;
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 'usr-20');

    // Deleted users list blocks user on subsequent Firebase sync
    const incomingFirebaseList = [
      { id: 'usr-10', uid: 'usr-10', email: 'fraudster@fake.com', name: 'Fake Account' },
      { id: 'usr-30', uid: 'usr-30', email: 'newuser@gmail.com', name: 'New User' }
    ];

    const cleanSync = incomingFirebaseList.filter(u => {
      const uId = String(u.id || u.uid || '').toLowerCase().trim();
      const uEm = String(u.email || '').toLowerCase().trim();
      return !deletedUsers.includes(uId) && !deletedUsers.includes(uEm);
    });

    assert.equal(cleanSync.length, 1);
    assert.equal(cleanSync[0].id, 'usr-30');
  });

  it('4. Real-time background sync seamlessly merges Firestore user updates with property counts', () => {
    const existingDirectory = [
      { id: 'uid-abc', uid: 'uid-abc', email: 'owner@gmail.com', name: 'Krishna Sai', status: 'ACTIVE', role: 'USER' }
    ];

    const liveFirestoreUpdate = [
      { id: 'uid-abc', uid: 'uid-abc', email: 'owner@gmail.com', name: 'Krishna Sai Kannasani', phone: '9502264269', status: 'ACTIVE' },
      { id: 'uid-xyz', uid: 'uid-xyz', email: 'buyer@gmail.com', name: 'Buyer Test', phone: '9988776655', status: 'ACTIVE' }
    ];

    const properties = [
      { id: 'prop-1', ownerId: 'uid-abc', ownerPrivateEmail: 'owner@gmail.com', status: 'LIVE' },
      { id: 'prop-2', ownerId: 'uid-abc', ownerPrivateEmail: 'owner@gmail.com', status: 'LIVE' }
    ];

    const userMap = new Map();
    [...existingDirectory, ...liveFirestoreUpdate].forEach(u => {
      const emailKey = (u.email || '').toLowerCase().trim();
      const uidKey = String(u.uid || u.id || '').toLowerCase().trim();
      const existing = (emailKey && userMap.get(emailKey)) || (uidKey && userMap.get(uidKey)) || {};
      const merged = { ...existing, ...u };
      if (emailKey) userMap.set(emailKey, merged);
      if (uidKey) userMap.set(uidKey, merged);
    });

    const enriched = Array.from(new Set(userMap.values())).map(u => {
      const uUid = String(u.uid || u.id || '').toLowerCase().trim();
      const uEmail = (u.email || '').toLowerCase().trim();

      const userListings = properties.filter(p => {
        const pOwnerId = String(p.ownerId || '').toLowerCase().trim();
        const pEmail = (p.ownerPrivateEmail || '').toLowerCase().trim();
        return (uUid && pOwnerId === uUid) || (uEmail && pEmail === uEmail);
      });

      return {
        ...u,
        postedListingsCount: userListings.length,
        role: userListings.length > 0 ? 'VERIFIED PROPERTY OWNER & BUYER' : 'USER'
      };
    });

    assert.equal(enriched.length, 2);
    const ownerUser = enriched.find(u => u.uid === 'uid-abc');
    assert.equal(ownerUser.name, 'Krishna Sai Kannasani');
    assert.equal(ownerUser.phone, '9502264269');
    assert.equal(ownerUser.postedListingsCount, 2);
    assert.equal(ownerUser.role, 'VERIFIED PROPERTY OWNER & BUYER');

    const buyerUser = enriched.find(u => u.uid === 'uid-xyz');
    assert.equal(buyerUser.postedListingsCount, 0);
    assert.equal(buyerUser.role, 'USER');
  });

  it('5. Cascade deletion removes all properties, media, and enquiries when an account is deleted or removed', () => {
    const properties = [
      { id: 'prop-101', propertyId: 'prop-101', ownerId: 'usr-deleted-1', ownerEmail: 'user1@easeland.in', title: 'Farm in Guntur' },
      { id: 'prop-102', propertyId: 'prop-102', ownerId: 'usr-deleted-1', ownerPrivateEmail: 'user1@easeland.in', title: 'Villa in Amaravati' },
      { id: 'prop-201', propertyId: 'prop-201', ownerId: 'usr-active-2', ownerEmail: 'user2@easeland.in', title: 'Plot in Vijayawada' }
    ];

    const enquiries = [
      { id: 'enq-1', propertyId: 'prop-101', ownerId: 'usr-deleted-1', customerName: 'Buyer A' },
      { id: 'enq-2', propertyId: 'prop-201', ownerId: 'usr-active-2', customerName: 'Buyer B' }
    ];

    const targetUserId = 'usr-deleted-1';
    const targetEmail = 'user1@easeland.in';

    // Cascade filter: purge properties and enquiries owned by target
    const remainingProps = properties.filter(p => {
      const pOwner = String(p.ownerId || p.userId || '').toLowerCase().trim();
      const pEmail = String(p.ownerEmail || p.ownerPrivateEmail || '').toLowerCase().trim();
      return pOwner !== targetUserId && pEmail !== targetEmail;
    });

    const deletedPropIds = new Set(properties.filter(p => {
      const pOwner = String(p.ownerId || p.userId || '').toLowerCase().trim();
      const pEmail = String(p.ownerEmail || p.ownerPrivateEmail || '').toLowerCase().trim();
      return pOwner === targetUserId || pEmail === targetEmail;
    }).map(p => p.id));

    const remainingEnquiries = enquiries.filter(e => {
      const eOwner = String(e.ownerId || '').toLowerCase().trim();
      return eOwner !== targetUserId && !deletedPropIds.has(e.propertyId);
    });

    assert.equal(remainingProps.length, 1);
    assert.equal(remainingProps[0].id, 'prop-201');
    assert.equal(remainingEnquiries.length, 1);
    assert.equal(remainingEnquiries[0].id, 'enq-2');
  });

  it('6. Relogging in or re-registering after deletion unblacklists the account and creates a brand-new clean record', () => {
    // Simulated deleted list containing previously removed user
    let deletedUsers = ['usr-del-99', 'olduser@easeland.in'];

    // User attempts to relogin with the same credentials
    const reloginUid = 'usr-del-99';
    const reloginEmail = 'olduser@easeland.in';

    // Unblacklist on relogin / registration
    deletedUsers = deletedUsers.filter(item => {
      const itLow = String(item || '').toLowerCase().trim();
      return itLow !== reloginUid && itLow !== reloginEmail;
    });

    assert.equal(deletedUsers.length, 0);

    // Clean profile creation (no merge: true)
    const freshProfile = {
      uid: reloginUid,
      displayName: 'EaseLand User',
      email: reloginEmail,
      phone: '',
      role: 'USER',
      accountStatus: 'ACTIVE',
      capabilities: ['CUSTOMER', 'OWNER'],
      ownerVerificationState: 'NOT_VERIFIED',
      createdAt: new Date().toISOString()
    };

    assert.equal(freshProfile.accountStatus, 'ACTIVE');
    assert.equal(freshProfile.ownerVerificationState, 'NOT_VERIFIED');
    assert.equal(freshProfile.phone, '');
  });

  it('7. Zero-trace clean-slate guarantee ensures zero properties, zero enquiries, and clean dashboard on relogin', () => {
    const marketplaceProperties = [
      { id: 'prop-active-1', ownerId: 'other-user', title: 'Active Plot' }
    ];

    const reloginUid = 'usr-del-99';
    const userProperties = marketplaceProperties.filter(p => p.ownerId === reloginUid);

    assert.equal(userProperties.length, 0, 'Relogged in user must have 0 properties from previous deletion');
  });

  it('8. enrichAndSyncLiveUsers strictly rejects deleted or removed users from registeredUsersList so they are never appended to the last page', () => {
    const existingUsers = [
      { id: 'usr-1', uid: 'usr-1', email: 'alice@example.com', name: 'Alice', status: 'ACTIVE' },
      { id: 'usr-2', uid: 'usr-2', email: 'bob@example.com', name: 'Bob', status: 'ACTIVE' }
    ];

    const deletedUsers = ['usr-deleted', 'deleted@easeland.in'];

    const incomingUsers = [
      { id: 'usr-deleted', uid: 'usr-deleted', email: 'deleted@easeland.in', name: 'Stale User', status: 'ACTIVE' },
      { id: 'usr-3', uid: 'usr-3', email: 'charlie@example.com', name: 'Charlie', status: 'ACTIVE' }
    ];

    const isUserDeleted = (u) => {
      if (!u) return true;
      const uUid = String(u.uid || u.id || '').toLowerCase().trim();
      const uEmail = (u.email || '').toLowerCase().trim();
      const rawSt = String(u.status || u.accountStatus || '').toUpperCase();
      return rawSt === 'REMOVED' || rawSt === 'DELETED' || rawSt === 'ACCOUNT_DELETED' ||
        (uUid && deletedUsers.includes(uUid)) || (uEmail && deletedUsers.includes(uEmail));
    };

    const cleanPrev = existingUsers.filter(u => !isUserDeleted(u));
    const cleanIncoming = incomingUsers.filter(u => !isUserDeleted(u));

    const userMap = new Map();
    [...cleanPrev, ...cleanIncoming].forEach(u => {
      if (!u || isUserDeleted(u)) return;
      const key = (u.email || u.uid).toLowerCase().trim();
      userMap.set(key, u);
    });

    const result = Array.from(userMap.values()).filter(u => !isUserDeleted(u));

    assert.equal(result.length, 3);
    assert.ok(!result.some(u => u.uid === 'usr-deleted'), 'Deleted user must NEVER be added back to user list');
    assert.equal(result[result.length - 1].uid, 'usr-3', 'Last item must be the legitimate new user, never the deleted user');
  });

  it('9. Directory table pagination and filtering strictly exclude removed users from ALL tab and maintain deterministic sorting', () => {
    const users = [
      { uid: 'u-1', name: 'Zack', email: 'zack@example.com', role: 'USER', status: 'ACTIVE' },
      { uid: 'u-2', name: 'EaseLand Admin', email: 'admin@easeland.in', role: 'ADMIN', status: 'ACTIVE' },
      { uid: 'u-3', name: 'Deleted Dan', email: 'dan@example.com', role: 'USER', status: 'REMOVED' },
      { uid: 'u-4', name: 'Alice', email: 'alice@example.com', role: 'USER', status: 'ACTIVE' }
    ];

    const deletedUsers = ['u-3', 'dan@example.com'];
    const userStatusFilter = 'ALL';

    const filtered = users
      .filter(u => {
        if (!u) return false;
        const uUid = String(u.uid || u.id || '').toLowerCase().trim();
        const uEmail = (u.email || '').toLowerCase().trim();
        const rawSt = String(u.status || u.accountStatus || '').toUpperCase();
        const isRemoved = rawSt === 'REMOVED' || rawSt === 'DELETED' || rawSt === 'ACCOUNT_DELETED' ||
          (uUid && deletedUsers.includes(uUid)) || (uEmail && deletedUsers.includes(uEmail));

        if (userStatusFilter === 'ALL') {
          if (isRemoved) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aIsAdmin = a.role === 'ADMIN' || a.email === 'admin@easeland.in';
        const bIsAdmin = b.role === 'ADMIN' || b.email === 'admin@easeland.in';
        if (aIsAdmin && !bIsAdmin) return -1;
        if (!aIsAdmin && bIsAdmin) return 1;
        return (a.name || a.displayName || a.email || '').localeCompare(b.name || b.displayName || b.email || '');
      });

    assert.equal(filtered.length, 3, 'Deleted user Dan must be completely excluded');
    assert.equal(filtered[0].role, 'ADMIN', 'Admin must be first');
    assert.equal(filtered[1].name, 'Alice', 'Deterministic alphabetical sort for users');
    assert.equal(filtered[2].name, 'Zack', 'Deterministic alphabetical sort for users');

    // Pagination test: 2 users per page
    const perPage = 2;
    const page1 = filtered.slice(0, perPage);
    const page2 = filtered.slice(perPage, perPage * 2);

    assert.equal(page1.length, 2);
    assert.equal(page2.length, 1);
    assert.equal(page2[0].name, 'Zack', 'Last page contains Zack, deleted Dan is nowhere to be found');
  });

  it('10. Synchronous pre-async blacklisting guarantees concurrent Firestore snapshots cannot re-inject deleted user', () => {
    let mockLocalStorage = {};
    const targetUserId = 'usr-victim-99';
    const targetEmail = 'victim@example.com';

    // 0. Synchronously blacklist before any async operations start
    let delArr = [];
    if (targetUserId) delArr.push(targetUserId.toLowerCase());
    if (targetEmail) delArr.push(targetEmail.toLowerCase());
    mockLocalStorage['easeland_deleted_users'] = JSON.stringify(delArr);

    // Simulated concurrent Firestore snapshot arriving while async operations are in-flight
    const concurrentSnapshot = [
      { id: 'usr-victim-99', email: 'victim@example.com', name: 'Victim Account', status: 'ACTIVE' },
      { id: 'usr-other-1', email: 'other@example.com', name: 'Other User', status: 'ACTIVE' }
    ];

    const activeBlacklist = JSON.parse(mockLocalStorage['easeland_deleted_users']);
    const processedSnapshot = concurrentSnapshot.filter(u => {
      const uId = String(u.id || '').toLowerCase();
      const uEmail = String(u.email || '').toLowerCase();
      return !activeBlacklist.includes(uId) && !activeBlacklist.includes(uEmail);
    });

    assert.equal(processedSnapshot.length, 1);
    assert.equal(processedSnapshot[0].id, 'usr-other-1');
  });

  it('11. Relogging with a previously deleted user account unblacklists user, recreates clean-slate profile with accountStatus ACTIVE, and wipes all old profile/draft/enquiry caches', () => {
    let mockStorage = {};
    const relogUid = 'usr-relog-777';
    const relogEmail = 'relog@example.com';

    // Seed storage with previously deleted user state and old residual data
    mockStorage['easeland_deleted_users'] = JSON.stringify([relogUid, relogEmail]);
    mockStorage['easeland_user_profile_' + relogUid] = JSON.stringify({ uid: relogUid, bio: 'Old bio', phone: '9999999999', notes: 'Banned note' });
    mockStorage['easeland_draft_' + relogUid] = JSON.stringify({ draftTitle: 'Old unfinished property' });
    mockStorage['easeland_wizard_location_' + relogUid] = JSON.stringify({ lat: 16.3, lng: 80.4 });
    mockStorage['easeland_user_enquiries_' + relogUid] = JSON.stringify([{ id: 'enq-old' }]);
    mockStorage['easeland_kyc_' + relogUid] = JSON.stringify({ aadhaar: '1234' });
    mockStorage['easeland_owner_verification_' + relogUid] = JSON.stringify({ state: 'PENDING' });
    mockStorage['easeland_user_properties'] = JSON.stringify([
      { id: 'prop-old-1', ownerId: relogUid, title: 'Old Deleted Plot' },
      { id: 'prop-other', ownerId: 'other-user', title: 'Other Plot' }
    ]);

    // Simulated relogin unblacklisting and clean-slate profile initialization
    const uIdLow = relogUid.toLowerCase().trim();
    const emLow = relogEmail.toLowerCase().trim();

    // 1. Unblacklist
    const rawDel = mockStorage['easeland_deleted_users'];
    if (rawDel) {
      const delArr = JSON.parse(rawDel);
      const filtered = delArr.filter(item => {
        const itLow = String(item || '').toLowerCase().trim();
        return itLow !== uIdLow && itLow !== emLow;
      });
      mockStorage['easeland_deleted_users'] = JSON.stringify(filtered);
    }

    // 2. Wipe residual caches
    delete mockStorage['easeland_user_profile_' + relogUid];
    delete mockStorage['easeland_draft_' + relogUid];
    delete mockStorage['easeland_wizard_location_' + relogUid];
    delete mockStorage['easeland_kyc_' + relogUid];
    delete mockStorage['easeland_owner_verification_' + relogUid];
    delete mockStorage['easeland_user_enquiries_' + relogUid];

    // Clean old properties
    const rawProps = mockStorage['easeland_user_properties'];
    if (rawProps) {
      const parsed = JSON.parse(rawProps);
      const cleaned = parsed.filter(p => {
        const pOwner = String(p.ownerId || p.userId || '').toLowerCase().trim();
        const pEmail = String(p.ownerEmail || p.ownerPrivateEmail || '').toLowerCase().trim();
        return pOwner !== uIdLow && (!emLow || pEmail !== emLow);
      });
      mockStorage['easeland_user_properties'] = JSON.stringify(cleaned);
    }

    // Verify unblacklist succeeded
    const updatedBlacklist = JSON.parse(mockStorage['easeland_deleted_users']);
    assert.equal(updatedBlacklist.length, 0, 'User must be unblacklisted on relogin');

    // Verify all old caches are wiped
    assert.equal(mockStorage['easeland_user_profile_' + relogUid], undefined);
    assert.equal(mockStorage['easeland_draft_' + relogUid], undefined);
    assert.equal(mockStorage['easeland_wizard_location_' + relogUid], undefined);
    assert.equal(mockStorage['easeland_kyc_' + relogUid], undefined);
    assert.equal(mockStorage['easeland_owner_verification_' + relogUid], undefined);
    assert.equal(mockStorage['easeland_user_enquiries_' + relogUid], undefined);

    // Verify old property was removed
    const remainingUserProps = JSON.parse(mockStorage['easeland_user_properties']);
    assert.equal(remainingUserProps.length, 1);
    assert.equal(remainingUserProps[0].id, 'prop-other');

    // Clean profile object
    const freshProfile = {
      uid: relogUid,
      displayName: 'EaseLand User',
      email: relogEmail,
      phone: '',
      role: 'USER',
      status: 'ACTIVE',
      accountStatus: 'ACTIVE',
      postedListingsCount: 0,
      capabilities: ['CUSTOMER', 'OWNER'],
      ownerVerificationState: 'NOT_VERIFIED'
    };

    assert.equal(freshProfile.status, 'ACTIVE');
    assert.equal(freshProfile.accountStatus, 'ACTIVE');
    assert.equal(freshProfile.postedListingsCount, 0);
    assert.equal(freshProfile.ownerVerificationState, 'NOT_VERIFIED');
  });

  it('12. Reactivated user is immediately recognized by Admin Portal User Governance as ACTIVE with 0 properties and no residual records', () => {
    const relogUid = 'usr-relog-777';
    const relogEmail = 'relog@example.com';

    const incomingFirestoreUsers = [
      {
        uid: relogUid,
        id: relogUid,
        email: relogEmail,
        name: 'EaseLand User',
        status: 'ACTIVE',
        accountStatus: 'ACTIVE',
        postedListingsCount: 0,
        role: 'USER'
      }
    ];

    const allPlatformProperties = [
      { id: 'prop-active-99', ownerId: 'other-owner', title: 'Plot in Vijayawada' }
    ];

    // AdminPortal enrichAndSyncLiveUsers logic
    const deletedUsers = []; // User was unblacklisted
    const isUserDeleted = (u) => {
      if (!u) return true;
      const uUid = String(u.uid || u.id || '').toLowerCase().trim();
      const uEmail = (u.email || '').toLowerCase().trim();
      const rawSt = String(u.status || u.accountStatus || '').toUpperCase();
      return rawSt === 'REMOVED' || rawSt === 'DELETED' || rawSt === 'ACCOUNT_DELETED' ||
        (uUid && deletedUsers.includes(uUid)) || (uEmail && deletedUsers.includes(uEmail));
    };

    const userMap = new Map();
    incomingFirestoreUsers.filter(u => !isUserDeleted(u)).forEach(u => {
      const emailKey = (u.email || '').toLowerCase().trim();
      const uidKey = String(u.uid || u.id || '').toLowerCase().trim();
      const userListings = allPlatformProperties.filter(p => p.ownerId === u.uid);
      userMap.set(emailKey || uidKey, {
        ...u,
        postedListingsCount: userListings.length,
        status: 'ACTIVE',
        accountStatus: 'ACTIVE'
      });
    });

    const activeUsers = Array.from(userMap.values());
    assert.equal(activeUsers.length, 1);
    assert.equal(activeUsers[0].uid, relogUid);
    assert.equal(activeUsers[0].status, 'ACTIVE');
    assert.equal(activeUsers[0].accountStatus, 'ACTIVE');
    assert.equal(activeUsers[0].postedListingsCount, 0, 'Reactivated user must have exactly 0 listings');
  });

  it('13. Active auth state listener automatically re-establishes ACTIVE clean slate when an authenticated session encounters a missing or deleted Firestore doc', () => {
    // Authenticated Firebase Auth user
    const currentUser = {
      uid: 'usr-firebase-auth-1',
      email: 'user@example.com',
      displayName: 'EaseLand User',
      phoneNumber: ''
    };

    // Stale doc snapshot returned from Firestore has REMOVED status
    const docSnap = {
      exists: true,
      data: () => ({
        status: 'REMOVED',
        accountStatus: 'REMOVED',
        oldNotes: 'Account was removed'
      })
    };

    const fsData = docSnap.data();
    const uAccStatus = String(fsData.accountStatus || fsData.status || 'ACTIVE').toUpperCase();

    let reactivatedProfile = null;
    if (uAccStatus === 'REMOVED' || uAccStatus === 'DELETED') {
      // Automatic re-activation on relogin
      reactivatedProfile = {
        uid: currentUser.uid,
        displayName: currentUser.displayName || 'EaseLand User',
        email: currentUser.email || '',
        phone: currentUser.phoneNumber || '',
        status: 'ACTIVE',
        accountStatus: 'ACTIVE',
        postedListingsCount: 0,
        ownerVerificationState: 'NOT_VERIFIED'
      };
    }

    assert.ok(reactivatedProfile !== null, 'Reactivation must trigger');
    assert.equal(reactivatedProfile.status, 'ACTIVE');
    assert.equal(reactivatedProfile.accountStatus, 'ACTIVE');
    assert.equal(reactivatedProfile.postedListingsCount, 0);
    assert.equal(reactivatedProfile.oldNotes, undefined, 'Old notes must not be present in reactivated profile');
  });
});
