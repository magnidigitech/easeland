import { test } from 'node:test';
import assert from 'node:assert';
import { PAN_INDIA_ADMINISTRATIVE_HIERARCHY } from './indiaLocationHierarchy.js';
import {
  PAN_INDIA_DISTRICT_SUBDIVISIONS,
  getDistrictSubdivisions,
  getAllDistrictCities,
  getAllDistrictMandals
} from './indiaSubdivisionsData.js';
import {
  getStatesList,
  getDistrictsList,
  getCitiesList,
  getMandalsList,
  getLocalitiesList
} from '../data/indiaLocationData.js';

test('Pan-India Cities and Mandals Comprehensive Test Suite', async (t) => {
  await t.test('1. Validates all 36 States and Union Territories exist in PAN_INDIA_DISTRICT_SUBDIVISIONS', () => {
    const states = Object.keys(PAN_INDIA_DISTRICT_SUBDIVISIONS);
    assert.strictEqual(states.length, 36, 'Should have exactly 36 States and UTs');
    assert.ok(states.includes('Andhra Pradesh'));
    assert.ok(states.includes('Telangana'));
    assert.ok(states.includes('Karnataka'));
    assert.ok(states.includes('Tamil Nadu'));
    assert.ok(states.includes('Maharashtra'));
    assert.ok(states.includes('Gujarat'));
    assert.ok(states.includes('Uttar Pradesh'));
    assert.ok(states.includes('Delhi (NCT)'));
  });

  await t.test('2. Every single district in PAN_INDIA_ADMINISTRATIVE_HIERARCHY has valid cities and mandals', () => {
    let totalDistrictsChecked = 0;
    for (const [state, districts] of Object.entries(PAN_INDIA_ADMINISTRATIVE_HIERARCHY)) {
      for (const dist of districts) {
        totalDistrictsChecked++;
        const { cities, mandals } = getDistrictSubdivisions(state, dist);
        assert.ok(Array.isArray(cities) && cities.length > 0, `District ${dist} in ${state} must have at least 1 city`);
        assert.ok(Array.isArray(mandals) && mandals.length > 0, `District ${dist} in ${state} must have at least 1 mandal`);
      }
    }
    assert.ok(totalDistrictsChecked >= 780, `Expected at least 780 districts checked, got ${totalDistrictsChecked}`);
  });

  await t.test('3. Verifies Andhra Pradesh districts have official mandals and cities', () => {
    const guntur = getDistrictSubdivisions('Andhra Pradesh', 'Guntur');
    assert.ok(guntur.cities.includes('Guntur'));
    assert.ok(guntur.cities.includes('Mangalagiri'));
    assert.ok(guntur.cities.includes('Tenali'));
    assert.ok(guntur.mandals.includes('Guntur East') || guntur.mandals.includes('Guntur West'));
    assert.ok(guntur.mandals.includes('Thullur'));
    assert.ok(guntur.mandals.includes('Mangalagiri'));

    const ntr = getDistrictSubdivisions('Andhra Pradesh', 'NTR');
    assert.ok(ntr.cities.includes('Vijayawada'));
    assert.ok(ntr.cities.includes('Ibrahimpatnam'));
    assert.ok(ntr.mandals.includes('Mylavaram') || ntr.mandals.some(m => m.includes('Vijayawada')));
  });

  await t.test('4. Verifies Telangana districts have official mandals and cities', () => {
    const hyd = getDistrictSubdivisions('Telangana', 'Hyderabad');
    assert.ok(hyd.cities.includes('Hyderabad'));
    assert.ok(hyd.mandals.includes('Khairatabad'));
    assert.ok(hyd.mandals.includes('Secunderabad'));
    assert.ok(hyd.mandals.includes('Charminar'));

    const rr = getDistrictSubdivisions('Telangana', 'Rangareddy');
    assert.ok(rr.mandals.includes('Serilingampally'));
    assert.ok(rr.mandals.includes('Gandipet'));
    assert.ok(rr.mandals.includes('Rajendranagar'));
  });

  await t.test('5. Verifies Karnataka districts have official taluks and cities', () => {
    const blr = getDistrictSubdivisions('Karnataka', 'Bengaluru Urban');
    assert.ok(blr.cities.includes('Bengaluru') || blr.cities.includes('Bangalore'));
    assert.ok(blr.cities.includes('Whitefield'));
    assert.ok(blr.mandals.includes('Bengaluru South'));
    assert.ok(blr.mandals.includes('Bengaluru East'));
  });

  await t.test('6. Verifies Tamil Nadu districts have official taluks and cities', () => {
    const chennai = getDistrictSubdivisions('Tamil Nadu', 'Chennai');
    assert.ok(chennai.cities.includes('Chennai'));
    assert.ok(chennai.mandals.includes('Guindy'));
    assert.ok(chennai.mandals.includes('Mylapore'));
    assert.ok(chennai.mandals.includes('Alandur'));
  });

  await t.test('7. Verifies Maharashtra districts have official talukas and cities', () => {
    const pune = getDistrictSubdivisions('Maharashtra', 'Pune');
    assert.ok(pune.cities.includes('Pune'));
    assert.ok(pune.cities.includes('Pimpri-Chinchwad'));
    assert.ok(pune.mandals.some(m => m.includes('Haveli') || m.includes('Mulshi') || m.includes('Baramati')));
  });

  await t.test('8. Verifies getCitiesList and getMandalsList work seamlessly from indiaLocationData', () => {
    const cities = getCitiesList('Andhra Pradesh', 'Guntur');
    assert.ok(cities.length >= 5);
    assert.ok(cities.includes('Guntur'));

    // Mandal list without city specified returns all mandals for that district!
    const mandalsNoCity = getMandalsList('Andhra Pradesh', 'Guntur');
    assert.ok(mandalsNoCity.length >= 10, 'Should return all district mandals without needing city');
    assert.ok(mandalsNoCity.includes('Mangalagiri'));

    // Mandal list with city specified also returns mandals
    const mandalsWithCity = getMandalsList('Andhra Pradesh', 'Guntur', 'Guntur');
    assert.ok(mandalsWithCity.length >= 10);
  });

  await t.test('9. Case-insensitive and alias matching in getDistrictSubdivisions', () => {
    const res1 = getDistrictSubdivisions('andhra pradesh', 'guntur');
    assert.ok(res1.cities.length > 0);

    const res2 = getDistrictSubdivisions('TELANGANA', 'HYDERABAD');
    assert.ok(res2.mandals.length > 0);

    const res3 = getDistrictSubdivisions('Uttar Pradesh', 'Gautam Buddha Nagar');
    assert.ok(res3.cities.includes('Noida') || res3.cities.includes('Greater Noida'));
  });
});

