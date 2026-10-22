import test from 'node:test';
import assert from 'node:assert';
import {
  getAppVersion,
  withCacheBuster,
  isCacheBusted,
  getNoCacheHeaders,
  fetchWithCacheBuster,
  clearAppCaches
} from './cacheBuster.js';

test('EaseLand Cache Buster Suite', async (t) => {
  await t.test('1. getAppVersion returns non-empty version string', () => {
    const version = getAppVersion();
    assert.strictEqual(typeof version, 'string');
    assert.ok(version.length > 0, 'Version string must not be empty');
  });

  await t.test('2. withCacheBuster appends query parameter to plain URL', () => {
    const url = '/api/properties';
    const busted = withCacheBuster(url);
    assert.ok(busted.startsWith('/api/properties?_cb='), 'Should append ?_cb= to plain URL');
    assert.strictEqual(isCacheBusted(busted), true);
  });

  await t.test('3. withCacheBuster appends with ampersand when query params already exist', () => {
    const url = '/api/properties?publicOnly=true';
    const busted = withCacheBuster(url);
    assert.ok(busted.startsWith('/api/properties?publicOnly=true&_cb='), 'Should append &_cb= to URL with params');
    assert.strictEqual(isCacheBusted(busted), true);
  });

  await t.test('4. withCacheBuster preserves hash fragment at the end', () => {
    const url = '/properties?city=Hyderabad#top';
    const busted = withCacheBuster(url, 'v', '20261022');
    assert.strictEqual(busted, '/properties?city=Hyderabad&v=20261022#top');
    assert.strictEqual(isCacheBusted(busted, 'v'), true);
  });

  await t.test('5. withCacheBuster handles empty, null, or non-string inputs safely', () => {
    assert.strictEqual(withCacheBuster(''), '');
    assert.strictEqual(withCacheBuster(null), '');
    assert.strictEqual(withCacheBuster(undefined), '');
    assert.strictEqual(isCacheBusted(''), false);
    assert.strictEqual(isCacheBusted(null), false);
  });

  await t.test('6. getNoCacheHeaders returns standard HTTP cache-busting headers', () => {
    const headers = getNoCacheHeaders();
    assert.strictEqual(headers['Cache-Control'], 'no-cache, no-store, must-revalidate');
    assert.strictEqual(headers['Pragma'], 'no-cache');
    assert.strictEqual(headers['Expires'], '0');
  });

  await t.test('7. clearAppCaches handles environments without window/caches safely', async () => {
    const result = await clearAppCaches();
    assert.strictEqual(typeof result, 'object');
    assert.strictEqual(result.cacheStorageCleared, 0);
    assert.strictEqual(result.serviceWorkersUpdated, 0);
  });
});
