import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  isPropertyDeleted,
  isPropertyPubliclyVisible
} from './filterMatchingUtils.js';

// Setup mock window and localStorage for node environment
const storageMock = new Map();
global.window = {
  localStorage: {
    getItem: (key) => storageMock.get(key) || null,
    setItem: (key, val) => storageMock.set(key, String(val)),
    removeItem: (key) => storageMock.delete(key),
    clear: () => storageMock.clear()
  }
};
global.localStorage = global.window.localStorage;

test('Admin Property Deletion & Public Visibility Suite', async (t) => {
  beforeEach(() => {
    storageMock.clear();
  });

  await t.test('1. Property marked as DELETED_BY_ADMIN is never publicly visible', () => {
    const deletedProp = {
      id: 'p1',
      title: 'MAGNI DIGI TECH',
      status: 'DELETED_BY_ADMIN',
      isPlatformVerified: true,
      isPublished: true
    };

    assert.strictEqual(isPropertyDeleted(deletedProp), true);
    assert.strictEqual(isPropertyPubliclyVisible(deletedProp), false);
  });

  await t.test('2. Property whose ID is in easeland_deleted_properties is excluded from public search', () => {
    storageMock.set('easeland_deleted_properties', JSON.stringify(['84040', '64847']));

    const propWithPrefix = {
      id: 'EL-PROP-84040',
      propertyId: '84040',
      title: 'Furnished 3BHK in Vidyanagar',
      status: 'LIVE',
      isPlatformVerified: true
    };

    assert.strictEqual(isPropertyDeleted(propWithPrefix), true);
    assert.strictEqual(isPropertyPubliclyVisible(propWithPrefix), false);
  });

  await t.test('3. Property matched by normalized title in admin deletion record is excluded', () => {
    storageMock.set('easeland_admin_deleted_properties', JSON.stringify([
      { id: '63727', title: 'MAGNI DIGI TECH' }
    ]));

    const candidateFromAnotherSource = {
      id: 'diff-id-999',
      title: 'magni digi tech',
      status: 'LIVE',
      isPlatformVerified: true
    };

    assert.strictEqual(isPropertyDeleted(candidateFromAnotherSource), true);
    assert.strictEqual(isPropertyPubliclyVisible(candidateFromAnotherSource), false);
  });

  await t.test('4. Live platform properties remain publicly visible when not deleted', () => {
    storageMock.set('easeland_deleted_properties', JSON.stringify(['84040', '64847']));

    const liveFarmHouse = {
      id: 'prop-farm-1',
      title: 'Farm House for Rental Purpose',
      status: 'LIVE',
      isPlatformVerified: true,
      isPublished: true
    };

    const livePlot = {
      id: 'prop-plot-2',
      title: '25 Acers Property',
      status: 'APPROVED',
      isPlatformVerified: true,
      isPublished: true
    };

    assert.strictEqual(isPropertyDeleted(liveFarmHouse), false);
    assert.strictEqual(isPropertyPubliclyVisible(liveFarmHouse), true);

    assert.strictEqual(isPropertyDeleted(livePlot), false);
    assert.strictEqual(isPropertyPubliclyVisible(livePlot), true);
  });
});
