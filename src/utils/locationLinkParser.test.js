import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLocationLinkOrCoordinates,
  parseLocationInput
} from './locationLinkParser.js';
import {
  getStatesList,
  getDistrictsList,
  getCitiesList,
  INDIA_LOCATION_DATA
} from '../data/indiaLocationData.js';
import {
  PAN_INDIA_ADMINISTRATIVE_HIERARCHY,
  getIndiaStates,
  getIndiaDistricts
} from '../services/indiaLocationHierarchy.js';

test('Location Link & Coordinates Parser Test Suite', async (t) => {

  await t.test('1. Correctly identifies location links vs normal text queries', () => {
    // Should be identified as location link or coordinates
    assert.equal(isLocationLinkOrCoordinates('https://maps.app.goo.gl/AbCdEf123'), true);
    assert.equal(isLocationLinkOrCoordinates('https://goo.gl/maps/AbCdEf123'), true);
    assert.equal(isLocationLinkOrCoordinates('https://www.google.com/maps/@16.506174,80.648015,15z'), true);
    assert.equal(isLocationLinkOrCoordinates('https://maps.google.com/?q=16.3090,80.4370'), true);
    assert.equal(isLocationLinkOrCoordinates('https://maps.apple.com/?ll=16.3090,80.4370'), true);
    assert.equal(isLocationLinkOrCoordinates('https://www.openstreetmap.org/#map=16/16.3090/80.4370'), true);
    assert.equal(isLocationLinkOrCoordinates('geo:16.506174,80.648015'), true);
    assert.equal(isLocationLinkOrCoordinates('16.506174, 80.648015'), true);
    assert.equal(isLocationLinkOrCoordinates('16.506174,80.648015'), true);
    assert.equal(isLocationLinkOrCoordinates('16.506174 80.648015'), true);
    assert.equal(isLocationLinkOrCoordinates('16°30\'22.2"N 80°38\'52.9"E'), true);

    // Should NOT be identified as location link
    assert.equal(isLocationLinkOrCoordinates('3 bhk apartment in guntur'), false);
    assert.equal(isLocationLinkOrCoordinates('agricultural land near perecherla'), false);
    assert.equal(isLocationLinkOrCoordinates('open plots under 50 lakhs'), false);
    assert.equal(isLocationLinkOrCoordinates('bengaluru commercial space'), false);
    assert.equal(isLocationLinkOrCoordinates(''), false);
    assert.equal(isLocationLinkOrCoordinates(null), false);
  });

  await t.test('2. Parses Google Maps standard place URLs with @lat,lng', () => {
    const url = 'https://www.google.com/maps/place/Brodipet,+Guntur/@16.3090,80.4370,17z/data=!3m1!4b1';
    const parsed = parseLocationInput(url);
    assert.ok(parsed);
    assert.equal(parsed.type, 'COORDINATES');
    assert.equal(parsed.lat, 16.309);
    assert.equal(parsed.lng, 80.437);
    assert.equal(parsed.placeName, 'Brodipet, Guntur');
  });

  await t.test('3. Parses Google Maps query coordinate URLs (?q=lat,lng & ?ll=lat,lng)', () => {
    const qUrl = 'https://maps.google.com/?q=16.5062,80.6480';
    const parsedQ = parseLocationInput(qUrl);
    assert.ok(parsedQ);
    assert.equal(parsedQ.type, 'COORDINATES');
    assert.equal(parsedQ.lat, 16.5062);
    assert.equal(parsedQ.lng, 80.648);

    const llUrl = 'https://www.google.com/maps?ll=17.3850,78.4867&z=14';
    const parsedLL = parseLocationInput(llUrl);
    assert.ok(parsedLL);
    assert.equal(parsedLL.type, 'COORDINATES');
    assert.equal(parsedLL.lat, 17.385);
    assert.equal(parsedLL.lng, 78.4867);
  });

  await t.test('4. Parses Google Maps protobuf coordinates (!3dlat!4dlng)', () => {
    const protoUrl = 'https://www.google.com/maps/place/Amaravati/data=!4m2!3m1!1s0x0:0x0!3d16.5131!4d80.5165';
    const parsed = parseLocationInput(protoUrl);
    assert.ok(parsed);
    assert.equal(parsed.type, 'COORDINATES');
    assert.equal(parsed.lat, 16.5131);
    assert.equal(parsed.lng, 80.5165);
    assert.equal(parsed.placeName, 'Amaravati');
  });

  await t.test('5. Identifies Google Maps shortened URLs for redirect expansion', () => {
    const short1 = 'https://maps.app.goo.gl/k9XyZ12345';
    const parsed1 = parseLocationInput(short1);
    assert.ok(parsed1);
    assert.equal(parsed1.type, 'SHORT_URL');
    assert.equal(parsed1.source, 'GOOGLE_MAPS_SHORT_URL');

    const short2 = 'https://goo.gl/maps/qW78E90';
    const parsed2 = parseLocationInput(short2);
    assert.ok(parsed2);
    assert.equal(parsed2.type, 'SHORT_URL');
  });

  await t.test('6. Parses Apple Maps and OpenStreetMap URLs', () => {
    const appleUrl = 'https://maps.apple.com/?ll=12.9716,77.5946&q=Bengaluru';
    const parsedApple = parseLocationInput(appleUrl);
    assert.ok(parsedApple);
    assert.equal(parsedApple.type, 'COORDINATES');
    assert.equal(parsedApple.lat, 12.9716);
    assert.equal(parsedApple.lng, 77.5946);

    const osmUrl = 'https://www.openstreetmap.org/#map=15/19.0760/72.8777';
    const parsedOsm = parseLocationInput(osmUrl);
    assert.ok(parsedOsm);
    assert.equal(parsedOsm.type, 'COORDINATES');
    assert.equal(parsedOsm.lat, 19.076);
    assert.equal(parsedOsm.lng, 72.8777);
  });

  await t.test('7. Parses raw GPS coordinates and DMS formats', () => {
    const raw1 = '16.3090, 80.4370';
    const parsed1 = parseLocationInput(raw1);
    assert.ok(parsed1);
    assert.equal(parsed1.lat, 16.309);
    assert.equal(parsed1.lng, 80.437);

    const raw2 = '16.3090N, 80.4370E';
    const parsed2 = parseLocationInput(raw2);
    assert.ok(parsed2);
    assert.equal(parsed2.lat, 16.309);
    assert.equal(parsed2.lng, 80.437);

    const dms = '16°30\'22.2"N 80°38\'52.9"E';
    const parsedDms = parseLocationInput(dms);
    assert.ok(parsedDms);
    assert.ok(Math.abs(parsedDms.lat - 16.506167) < 0.001);
    assert.ok(Math.abs(parsedDms.lng - 80.648028) < 0.001);
  });

  await t.test('8. Parses Geo URI scheme', () => {
    const geo = 'geo:17.4483,78.3915';
    const parsed = parseLocationInput(geo);
    assert.ok(parsed);
    assert.equal(parsed.lat, 17.4483);
    assert.equal(parsed.lng, 78.3915);
  });
});

test('Pan-India Master State & District Dropdown Coverage Suite', async (t) => {

  await t.test('1. getStatesList returns all 36 States and Union Territories of India', () => {
    const states = getStatesList();
    assert.equal(states.length, 36, 'Must include exactly all 28 states and 8 Union Territories');

    // Key major states
    assert.ok(states.includes('Andhra Pradesh'));
    assert.ok(states.includes('Telangana'));
    assert.ok(states.includes('Karnataka'));
    assert.ok(states.includes('Tamil Nadu'));
    assert.ok(states.includes('Maharashtra'));
    assert.ok(states.includes('Gujarat'));
    assert.ok(states.includes('Rajasthan'));
    assert.ok(states.includes('Uttar Pradesh'));
    assert.ok(states.includes('Madhya Pradesh'));
    assert.ok(states.includes('West Bengal'));
    assert.ok(states.includes('Bihar'));
    assert.ok(states.includes('Odisha'));
    assert.ok(states.includes('Punjab'));
    assert.ok(states.includes('Haryana'));
    assert.ok(states.includes('Assam'));
    assert.ok(states.includes('Kerala'));
    assert.ok(states.includes('Goa'));

    // Union Territories
    assert.ok(states.includes('Delhi (NCT)'));
    assert.ok(states.includes('Jammu and Kashmir'));
    assert.ok(states.includes('Ladakh'));
    assert.ok(states.includes('Chandigarh'));
    assert.ok(states.includes('Puducherry'));
    assert.ok(states.includes('Andaman and Nicobar Islands'));
    assert.ok(states.includes('Lakshadweep'));
    assert.ok(states.includes('Dadra and Nagar Haveli and Daman and Diu'));
  });

  await t.test('2. getDistrictsList returns all official districts for every State & UT', () => {
    // Andhra Pradesh: 26 reorganized districts
    const ap = getDistrictsList('Andhra Pradesh');
    assert.equal(ap.length, 26);
    assert.ok(ap.includes('Guntur'));
    assert.ok(ap.includes('NTR'));
    assert.ok(ap.includes('Visakhapatnam'));
    assert.ok(ap.includes('Tirupati'));
    assert.ok(ap.includes('Alluri Sitharama Raju'));
    assert.ok(ap.includes('Sri Sathya Sai'));

    // Telangana: 33 districts
    const tg = getDistrictsList('Telangana');
    assert.equal(tg.length, 33);
    assert.ok(tg.includes('Hyderabad'));
    assert.ok(tg.includes('Rangareddy'));
    assert.ok(tg.includes('Medchal-Malkajgiri'));
    assert.ok(tg.includes('Hanamkonda'));

    // Tamil Nadu: 38 districts including The Nilgiris
    const tn = getDistrictsList('Tamil Nadu');
    assert.equal(tn.length, 38);
    assert.ok(tn.includes('Chennai'));
    assert.ok(tn.includes('Coimbatore'));
    assert.ok(tn.includes('The Nilgiris'));

    // Karnataka: 31 districts
    const ka = getDistrictsList('Karnataka');
    assert.equal(ka.length, 31);
    assert.ok(ka.includes('Bengaluru Urban'));
    assert.ok(ka.includes('Bengaluru Rural'));
    assert.ok(ka.includes('Mysuru'));
    assert.ok(ka.includes('Dakshina Kannada'));

    // Maharashtra: 36 districts
    const mh = getDistrictsList('Maharashtra');
    assert.equal(mh.length, 36);
    assert.ok(mh.includes('Mumbai City'));
    assert.ok(mh.includes('Mumbai Suburban'));
    assert.ok(mh.includes('Pune'));
    assert.ok(mh.includes('Nagpur'));

    // Uttar Pradesh: 75 districts
    const up = getDistrictsList('Uttar Pradesh');
    assert.equal(up.length, 75);
    assert.ok(up.includes('Lucknow'));
    assert.ok(up.includes('Gautam Buddha Nagar (Noida)'));
    assert.ok(up.includes('Varanasi'));

    // Bihar: 38 districts
    const bh = getDistrictsList('Bihar');
    assert.equal(bh.length, 38);
    assert.ok(bh.includes('Patna'));
    assert.ok(bh.includes('Gaya'));
    assert.ok(bh.includes('Muzaffarpur'));

    // Madhya Pradesh: 55 districts
    const mp = getDistrictsList('Madhya Pradesh');
    assert.equal(mp.length, 55);
    assert.ok(mp.includes('Bhopal'));
    assert.ok(mp.includes('Indore'));
    assert.ok(mp.includes('Gwalior'));
    assert.ok(mp.includes('Maihar'));

    // Rajasthan: 50 districts
    const rj = getDistrictsList('Rajasthan');
    assert.equal(rj.length, 50);
    assert.ok(rj.includes('Jaipur'));
    assert.ok(rj.includes('Jodhpur'));
    assert.ok(rj.includes('Udaipur'));

    // Delhi (NCT): 11 districts
    const dl = getDistrictsList('Delhi (NCT)');
    assert.equal(dl.length, 11);
    assert.ok(dl.includes('New Delhi'));
    assert.ok(dl.includes('Central Delhi'));

    // Goa: North and South Goa
    const ga = getDistrictsList('Goa');
    assert.equal(ga.length, 2);
    assert.ok(ga.includes('North Goa'));
    assert.ok(ga.includes('South Goa'));
  });

  await t.test('3. Case-insensitive state lookup for getDistrictsList', () => {
    const apLower = getDistrictsList('andhra pradesh');
    assert.equal(apLower.length, 26);

    const tgMixed = getDistrictsList('  TeLaNgAnA  ');
    assert.equal(tgMixed.length, 33);
  });

  await t.test('4. getCitiesList returns available cities or clean district fallback', () => {
    const gunturCities = getCitiesList('Andhra Pradesh', 'Guntur');
    assert.ok(gunturCities.length > 0);
    assert.ok(gunturCities.includes('Guntur'));

    const patnaCities = getCitiesList('Bihar', 'Patna');
    assert.ok(patnaCities.length > 0);
    assert.ok(patnaCities.includes('Patna'));
  });

  await t.test('5. Total count of official districts across all 36 States & UTs exceeds 770', () => {
    let totalDistricts = 0;
    const allStates = getStatesList();
    allStates.forEach(st => {
      const districts = getDistrictsList(st);
      totalDistricts += districts.length;
    });
    assert.ok(totalDistricts >= 770, `Total districts (${totalDistricts}) must be 770 or higher`);
  });

});

