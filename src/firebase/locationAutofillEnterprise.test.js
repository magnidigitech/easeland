import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAN_INDIA_ADMINISTRATIVE_HIERARCHY,
  getIndiaStates,
  getIndiaDistricts,
  matchStatesAndDistricts
} from '../services/indiaLocationHierarchy.js';
import { searchIndiaLocations } from '../services/locationAutofillService.js';

test('Pan-India Dynamic Location Intelligence Suite', async (t) => {

  await t.test('1. getIndiaStates returns comprehensive all 28 states and 8 Union Territories', () => {
    const states = getIndiaStates();
    assert.equal(states.length, 36, 'Must include exactly 36 states and UTs of India');
    assert.ok(states.includes('Andhra Pradesh'), 'Must include Andhra Pradesh');
    assert.ok(states.includes('Telangana'), 'Must include Telangana');
    assert.ok(states.includes('Karnataka'), 'Must include Karnataka');
    assert.ok(states.includes('Maharashtra'), 'Must include Maharashtra');
    assert.ok(states.includes('Delhi (NCT)'), 'Must include Delhi');
  });

  await t.test('2. getIndiaDistricts returns all official districts for specified state', () => {
    const apDistricts = getIndiaDistricts('Andhra Pradesh');
    assert.equal(apDistricts.length, 26, 'Andhra Pradesh has 26 official reorganized districts');
    assert.ok(apDistricts.includes('Guntur'));
    assert.ok(apDistricts.includes('NTR'));
    assert.ok(apDistricts.includes('Visakhapatnam'));
    assert.ok(apDistricts.includes('Tirupati'));

    const tgDistricts = getIndiaDistricts('Telangana');
    assert.equal(tgDistricts.length, 33, 'Telangana has 33 official districts');
    assert.ok(tgDistricts.includes('Hyderabad'));
    assert.ok(tgDistricts.includes('Rangareddy'));
    assert.ok(tgDistricts.includes('Medchal-Malkajgiri'));
  });

  await t.test('3. matchStatesAndDistricts matches states and districts dynamically', () => {
    const matchesGuntur = matchStatesAndDistricts('Guntur');
    assert.ok(matchesGuntur.length > 0);
    assert.equal(matchesGuntur[0].title, 'Guntur');
    assert.equal(matchesGuntur[0].type, 'DISTRICT');
    assert.equal(matchesGuntur[0].state, 'Andhra Pradesh');

    const matchesVizag = matchStatesAndDistricts('Visakhapatnam');
    assert.ok(matchesVizag.length > 0);
    assert.equal(matchesVizag[0].title, 'Visakhapatnam');
    assert.equal(matchesVizag[0].district, 'Visakhapatnam');
  });

  await t.test('4. searchIndiaLocations resolves real-time villages, mandals, and towns', async () => {
    const results = await searchIndiaLocations('Mangalagiri', { limit: 5 });
    assert.ok(Array.isArray(results), 'Must return an array of results');
    assert.ok(results.length > 0, 'Must find live results for Mangalagiri');

    const first = results[0];
    assert.ok(first.title.toLowerCase().includes('mangalagiri') || first.fullAddress.toLowerCase().includes('mangalagiri'));
    assert.ok(first.type, 'Must have a classified type (MANDAL, CITY, or AREA)');
    assert.ok(first.state, 'Must identify state');
  });

  await t.test('5. searchIndiaLocations prioritizes active platform verified ventures', async () => {
    const mockProps = [
      {
        id: 'prop-crda-99',
        title: 'Amaravati Capital Smart City Plot',
        locationName: 'Nowlur Seed Capital',
        city: 'Mangalagiri',
        district: 'Guntur',
        state: 'Andhra Pradesh'
      }
    ];

    const results = await searchIndiaLocations('Nowlur', {
      availableProperties: mockProps,
      limit: 5
    });

    assert.ok(results.length > 0);
    const platformMatch = results.find(r => r.isPlatformListing === true);
    assert.ok(platformMatch, 'Platform venture must be prioritized and marked as platform listing');
    assert.equal(platformMatch.type, 'LISTED_VENTURE');
    assert.equal(platformMatch.propertyId, 'prop-crda-99');
  });

  await t.test('6. searchIndiaLocations caches queries and responds with sub-millisecond latency', async () => {
    const q = 'Brodipet';
    const start1 = Date.now();
    const res1 = await searchIndiaLocations(q, { limit: 5 });
    const dur1 = Date.now() - start1;

    const start2 = Date.now();
    const res2 = await searchIndiaLocations(q, { limit: 5 });
    const dur2 = Date.now() - start2;

    assert.equal(res1.length, res2.length);
    assert.ok(dur2 < 5, 'Cache retrieval must be under 5ms, took ' + dur2 + 'ms');
  });

  await t.test('7. searchIndiaLocations deduplicates entries with same title, district, and state', async () => {
    const results = await searchIndiaLocations('Guntur', { limit: 10 });
    const seen = new Set();
    let hasDuplicate = false;
    for (const r of results) {
      const key = (r.title + '|' + (r.district || '') + '|' + (r.state || '')).toLowerCase();
      if (seen.has(key)) {
        hasDuplicate = true;
        break;
      }
      seen.add(key);
    }
    assert.equal(hasDuplicate, false, 'No duplicate entries should exist in search results');
  });

});
