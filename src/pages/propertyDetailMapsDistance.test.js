import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateDistanceKm, resolvePlaceCoordinates } from '../services/locationProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('Property Detail Page "View on Maps" & Distance Suite', () => {
  it('1. Verifies PropertyDetailPage.jsx defines user setup location resolution, distance calculation, and GPS detection', () => {
    const detailPath = path.join(rootDir, 'src', 'pages', 'PropertyDetailPage.jsx');
    assert.ok(fs.existsSync(detailPath), 'PropertyDetailPage.jsx must exist');

    const content = fs.readFileSync(detailPath, 'utf8');

    // Verify user setup location state
    assert.ok(content.includes('userLocationName'), 'Must track userLocationName state');
    assert.ok(content.includes('userCoords'), 'Must track userCoords state');
    assert.ok(content.includes('userLocationSource'), 'Must track userLocationSource state');

    // Verify distance calculation
    assert.ok(content.includes('distanceKm'), 'Must compute distanceKm');
    assert.ok(content.includes('estimatedDriveMinutes'), 'Must compute estimatedDriveMinutes');

    // Verify GPS detection and custom location selection
    assert.ok(content.includes('handleDetectDeviceLocation'), 'Must provide handleDetectDeviceLocation');
    assert.ok(content.includes('handleSelectCustomLocation'), 'Must provide handleSelectCustomLocation');
  });

  it('2. Verifies PropertyDetailPage.jsx renders dedicated "View on Maps & Distance" section with EaseLand Map and Google Maps navigation', () => {
    const detailPath = path.join(rootDir, 'src', 'pages', 'PropertyDetailPage.jsx');
    const content = fs.readFileSync(detailPath, 'utf8');

    // Verify view-on-maps-section container
    assert.ok(content.includes('id="view-on-maps-section"'), 'Must render view-on-maps-section container');
    assert.ok(content.includes('View on Maps & Distance'), 'Must render section title');

    // Verify EaseLand Map navigation CTA button
    assert.ok(content.includes('View on EaseLand Map'), 'Must render "View on EaseLand Map" button');
    assert.ok(content.includes('handleOpenEaselandMap'), 'Must hook up handleOpenEaselandMap');

    // Verify Google Maps directions navigation CTA button
    assert.ok(content.includes('Get Directions on Google Maps'), 'Must render "Get Directions on Google Maps" button');
    assert.ok(content.includes('googleMapsDirectionsUrl'), 'Must compute googleMapsDirectionsUrl');
    assert.ok(content.includes('https://www.google.com/maps/dir/?api=1'), 'Must format universal Google Maps directions link');

    // Verify mobile sticky bar map button
    assert.ok(content.includes('view-on-maps-section'), 'Mobile bar must link to view-on-maps-section');
  });

  it('3. Verifies PropertyDetailPage.jsx embedded map provides route synchronization and camera view controls', () => {
    const detailPath = path.join(rootDir, 'src', 'pages', 'PropertyDetailPage.jsx');
    const content = fs.readFileSync(detailPath, 'utf8');

    assert.ok(content.includes('handleCenterPropertyOnMap'), 'Must provide handleCenterPropertyOnMap');
    assert.ok(content.includes('handleFitRouteOnMap'), 'Must provide handleFitRouteOnMap');
    assert.ok(content.includes('renderRouteOnMap'), 'Must provide renderRouteOnMap helper');
    assert.ok(content.includes('Property View'), 'Must render Property View button');
    assert.ok(content.includes('Fit Route View'), 'Must render Fit Route View button');
  });

  it('4. Verifies App.jsx forwards navFilters and targetProperty in onNavigateMap callback', () => {
    const appPath = path.join(rootDir, 'src', 'App.jsx');
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(content.includes('onNavigateMap={(navFilters, targetProperty) => {'), 'App.jsx must pass navFilters and targetProperty');
    assert.ok(content.includes('changeActivePage(\'map\', navFilters'), 'Must route to map with navFilters');
  });

  it('5. Verifies UniversalMapEngine.jsx renders connecting route line and distance tooltip for focused property', () => {
    const mapPath = path.join(rootDir, 'src', 'components', 'UniversalMapEngine.jsx');
    const content = fs.readFileSync(mapPath, 'utf8');

    assert.ok(content.includes('distanceRouteLineRef'), 'UniversalMapEngine must define distanceRouteLineRef');
    assert.ok(content.includes('calculateDistanceKm'), 'Must import calculateDistanceKm');
    assert.ok(content.includes('📍 Distance:'), 'Must bind distance tooltip on route line');
  });

  it('6. Evaluates mathematical distance accuracy between known Andhra Pradesh hubs', () => {
    const guntur = resolvePlaceCoordinates('Guntur');
    const mangalagiri = resolvePlaceCoordinates('Mangalagiri');
    const vijayawada = resolvePlaceCoordinates('Vijayawada');

    assert.ok(guntur, 'Guntur must resolve coordinates');
    assert.ok(mangalagiri, 'Mangalagiri must resolve coordinates');
    assert.ok(vijayawada, 'Vijayawada must resolve coordinates');

    const distGunturMangalagiri = calculateDistanceKm(guntur.lat, guntur.lng, mangalagiri.lat, mangalagiri.lng);
    const distVijayawadaMangalagiri = calculateDistanceKm(vijayawada.lat, vijayawada.lng, mangalagiri.lat, mangalagiri.lng);

    // Guntur to Mangalagiri is approximately 18-20 km
    assert.ok(distGunturMangalagiri >= 17 && distGunturMangalagiri <= 21, `Expected ~19 km, got ${distGunturMangalagiri}`);

    // Vijayawada to Mangalagiri is approximately 11-14 km
    assert.ok(distVijayawadaMangalagiri >= 10 && distVijayawadaMangalagiri <= 15, `Expected ~12.5 km, got ${distVijayawadaMangalagiri}`);
  });
});

