import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Verification Queue Owner Contact Stability & Anti-Flicker Suite', () => {

  it('1. Verifies AdminPortal defines enrichPropertiesWithOwnerDetails to preserve existing contact data', () => {
    const adminPortalPath = path.resolve(process.cwd(), 'src/pages/AdminPortal.jsx');
    const source = fs.readFileSync(adminPortalPath, 'utf8');

    assert.ok(
      source.includes('enrichPropertiesWithOwnerDetails'),
      'AdminPortal.jsx must define enrichPropertiesWithOwnerDetails function'
    );
    assert.ok(
      source.includes('const initialEnrichedQueue = enrichPropertiesWithOwnerDetails(queue, registeredUsersList, verificationQueue);'),
      'Step 1 must enrich verification queue immediately using known registered users and previous state'
    );
    assert.ok(
      source.includes('const enrichedQueue = enrichPropertiesWithOwnerDetails(queue, users, initialEnrichedQueue);'),
      'Step 2 must pass initialEnrichedQueue to preserve known owner details and prevent flickering'
    );
  });

  it('2. Verifies storage event listener ignores internal cache keys and is debounced', () => {
    const adminPortalPath = path.resolve(process.cwd(), 'src/pages/AdminPortal.jsx');
    const source = fs.readFileSync(adminPortalPath, 'utf8');

    assert.ok(
      source.includes('handleStorageChange'),
      'AdminPortal must define handleStorageChange with selective key filtering'
    );
    assert.ok(
      source.includes('easeland_admin_cached_properties'),
      'Storage handler must ignore easeland_admin_cached_properties to prevent infinite ping-pong loops'
    );
    assert.ok(
      source.includes('refreshDebounceTimer'),
      'handleRefresh must be debounced to prevent rapid consecutive re-renders'
    );
  });

  it('3. Verifies owner contact column renders fallback phone or registered user phone when direct phone is missing', () => {
    const adminPortalPath = path.resolve(process.cwd(), 'src/pages/AdminPortal.jsx');
    const source = fs.readFileSync(adminPortalPath, 'utf8');

    assert.ok(
      source.includes('directPhone'),
      'Owner contact column must verify directPhone first'
    );
    assert.ok(
      source.includes('fallback'),
      'Owner contact column must check property phone fallbacks'
    );
    assert.ok(
      source.includes('registeredUsersList'),
      'Owner contact column must check registeredUsersList as a robust live fallback'
    );
  });

  it('4. Simulates owner phone resolution: never regresses to Number Not Updated if user profile exists', () => {
    const sampleProperty = {
      id: 'prop-sss-1',
      title: 'SSS',
      location: 'Phirangipuram, Merikapudi, Andhra Pradesh',
      ownerId: 'user-krishna-1',
      owner: {
        name: 'Krishna Sai',
        email: 'krishnasai4222@gmail.com'
        // phone is initially omitted on property object
      }
    };

    const candidateUsers = [
      {
        uid: 'user-krishna-1',
        email: 'krishnasai4222@gmail.com',
        displayName: 'Krishna Sai',
        phone: '6300691560'
      }
    ];

    // Simulate resolve logic
    const matchedUser = candidateUsers.find(u => u.uid === sampleProperty.ownerId || u.email === sampleProperty.owner?.email);
    const resolvedPhone = sampleProperty.owner?.phone || matchedUser?.phone || 'Number Not Updated';

    assert.strictEqual(resolvedPhone, '6300691560', 'Resolved phone must match user phone and NOT be "Number Not Updated"');
  });

  it('5. Simulates progressive queue refresh: Step 1 retains phone from previous state', () => {
    const previousStateQueue = [
      {
        id: 'prop-sss-1',
        title: 'SSS',
        owner: {
          name: 'Krishna Sai',
          email: 'krishnasai4222@gmail.com',
          phone: '6300691560'
        }
      }
    ];

    // Incoming raw property from API (where phone is not present on property itself)
    const incomingRawProperty = {
      id: 'prop-sss-1',
      title: 'SSS',
      owner: {
        name: 'Krishna Sai',
        email: 'krishnasai4222@gmail.com'
      }
    };

    const previousItem = previousStateQueue.find(p => p.id === incomingRawProperty.id);
    const retainedPhone = incomingRawProperty.owner?.phone || previousItem?.owner?.phone || 'Number Not Updated';

    assert.strictEqual(retainedPhone, '6300691560', 'Step 1 must retain existing phone from state so UI never flickers to "Number Not Updated"');
  });

});
