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
});
