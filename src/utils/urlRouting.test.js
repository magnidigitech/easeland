import { test } from 'node:test';
import assert from 'node:assert';
import { parseRouteFromUrl as getInitialPageState } from './routeUtils.js';

test('getInitialPageState parses home route accurately', () => {
  const loc = { pathname: '/', search: '', hash: '' };
  const res = getInitialPageState(loc);
  assert.strictEqual(res.page, 'home');
  assert.strictEqual(res.propId, null);
});

test('getInitialPageState parses property detail page URL when pasted into new tab', () => {
  const loc1 = { pathname: '/property/prop_17654321', search: '', hash: '' };
  const res1 = getInitialPageState(loc1);
  assert.strictEqual(res1.page, 'property-detail');
  assert.strictEqual(res1.propId, 'prop_17654321');

  const loc2 = { pathname: '/property/EL-PROP-1001', search: '', hash: '' };
  const res2 = getInitialPageState(loc2);
  assert.strictEqual(res2.page, 'property-detail');
  assert.strictEqual(res2.propId, 'EL-PROP-1001');

  const loc3 = { pathname: '/property-detail/EL-PROP-2002', search: '', hash: '' };
  const res3 = getInitialPageState(loc3);
  assert.strictEqual(res3.page, 'property-detail');
  assert.strictEqual(res3.propId, 'EL-PROP-2002');
});

test('getInitialPageState parses properties search page URL with filters when pasted', () => {
  const loc = { pathname: '/properties', search: '?city=Hyderabad&purpose=SALE&propertyType=APARTMENT', hash: '' };
  const res = getInitialPageState(loc);
  assert.strictEqual(res.page, 'map');
  assert.strictEqual(res.filters?.city, 'Hyderabad');
  assert.strictEqual(res.filters?.purpose, 'SALE');
  assert.strictEqual(res.filters?.propertyType, 'APARTMENT');
});

test('getInitialPageState parses informational and transactional pages when pasted into new tab', () => {
  assert.strictEqual(getInitialPageState({ pathname: '/buy', search: '', hash: '' }).page, 'buy');
  assert.strictEqual(getInitialPageState({ pathname: '/rent', search: '', hash: '' }).page, 'rent');
  assert.strictEqual(getInitialPageState({ pathname: '/sell', search: '', hash: '' }).page, 'sell');
  assert.strictEqual(getInitialPageState({ pathname: '/post-property', search: '', hash: '' }).page, 'post-property');
  assert.strictEqual(getInitialPageState({ pathname: '/admin', search: '', hash: '' }).page, 'admin');
  assert.strictEqual(getInitialPageState({ pathname: '/privacy-policy', search: '', hash: '' }).page, 'privacy-policy');

  const dashRes = getInitialPageState({ pathname: '/dashboard', search: '?tab=my-properties', hash: '' });
  assert.strictEqual(dashRes.page, 'dashboard');
  assert.strictEqual(dashRes.tab, 'my-properties');
});

test('getInitialPageState parses crm route and hash variants accurately', () => {
  assert.strictEqual(getInitialPageState({ pathname: '/crm', search: '', hash: '' }).page, 'crm');
  assert.strictEqual(getInitialPageState({ pathname: '/', search: '', hash: '#/crm' }).page, 'crm');
  assert.strictEqual(getInitialPageState({ pathname: '/', search: '', hash: '#crm' }).page, 'crm');
  assert.strictEqual(getInitialPageState({ pathname: '/', search: '?page=crm', hash: '' }).page, 'crm');
  assert.strictEqual(getInitialPageState({ pathname: '/', search: '?view=crm', hash: '' }).page, 'crm');
  assert.strictEqual(getInitialPageState({ pathname: '/', search: '?mode=crm', hash: '' }).page, 'crm');
});

test('getInitialPageState supports hash routing as seamless fallback', () => {
  const loc = { pathname: '/', search: '', hash: '#/property/prop_hash_999' };
  const res = getInitialPageState(loc);
  assert.strictEqual(res.page, 'property-detail');
  assert.strictEqual(res.propId, 'prop_hash_999');
});

test('getInitialPageState parses specific dashboard tabs accurately', () => {
  assert.strictEqual(getInitialPageState({ pathname: '/dashboard', search: '?tab=properties', hash: '' }).tab, 'properties');
  assert.strictEqual(getInitialPageState({ pathname: '/dashboard', search: '?tab=verification', hash: '' }).tab, 'verification');
  assert.strictEqual(getInitialPageState({ pathname: '/dashboard', search: '?tab=wishlist', hash: '' }).tab, 'wishlist');
  assert.strictEqual(getInitialPageState({ pathname: '/dashboard', search: '?tab=account', hash: '' }).tab, 'account');
  assert.strictEqual(getInitialPageState({ pathname: '/dashboard', search: '', hash: '' }).tab, 'overview');
});

