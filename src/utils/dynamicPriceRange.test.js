import { test } from 'node:test';
import assert from 'node:assert';
import {
  calculateDynamicPriceBounds,
  formatPriceCompact,
  getScaleMarkers,
  filterBudgetPresets
} from './dynamicPriceRange.js';

test('formatPriceCompact formats Indian currency numbers with clean units', () => {
  assert.strictEqual(formatPriceCompact(0), 'Rs. 0');
  assert.strictEqual(formatPriceCompact(15000), 'Rs. 15k');
  assert.strictEqual(formatPriceCompact(45000), 'Rs. 45k');
  assert.strictEqual(formatPriceCompact(100000), 'Rs. 1 L');
  assert.strictEqual(formatPriceCompact(2500000), 'Rs. 25 L');
  assert.strictEqual(formatPriceCompact(5000000), 'Rs. 50 L');
  assert.strictEqual(formatPriceCompact(15000000), 'Rs. 1.5 Cr');
  assert.strictEqual(formatPriceCompact(100000000), 'Rs. 10 Cr');
});

test('calculateDynamicPriceBounds extracts min and max from property listings', () => {
  const sampleProperties = [
    { id: 'p1', title: 'Plot 1', price: 2500000 },
    { id: 'p2', title: 'Plot 2', price: 4500000 },
    { id: 'p3', title: 'Villa 1', price: 15000000 },
    { id: 'p4', title: 'Villa 2', price: 35000000 }
  ];

  const bounds = calculateDynamicPriceBounds({
    properties: sampleProperties,
    purpose: 'SALE'
  });

  assert.strictEqual(bounds.hasPropertiesWithPrice, true);
  assert.strictEqual(bounds.count, 4);
  assert.strictEqual(bounds.rawMin, 2500000);
  assert.strictEqual(bounds.rawMax, 35000000);
  assert.strictEqual(bounds.min, 2500000);
  assert.strictEqual(bounds.max, 35000000);
});

test('calculateDynamicPriceBounds handles rental properties with thousands granularity', () => {
  const rentProperties = [
    { id: 'r1', price: 12500 },
    { id: 'r2', price: 25000 },
    { id: 'r3', price: 65000 }
  ];

  const bounds = calculateDynamicPriceBounds({
    properties: rentProperties,
    purpose: 'RENT'
  });

  assert.strictEqual(bounds.hasPropertiesWithPrice, true);
  assert.strictEqual(bounds.min, 12000); // floored to 1k
  assert.strictEqual(bounds.max, 65000); // ceiled to 5k
  assert.strictEqual(bounds.step, 5000);
});

test('calculateDynamicPriceBounds gracefully falls back when no properties or prices exist', () => {
  const boundsSale = calculateDynamicPriceBounds({
    properties: [],
    purpose: 'SALE'
  });

  assert.strictEqual(boundsSale.hasPropertiesWithPrice, false);
  assert.strictEqual(boundsSale.min, 0);
  assert.strictEqual(boundsSale.max, 100000000);

  const boundsRent = calculateDynamicPriceBounds({
    properties: [{ id: 'empty', price: 0 }],
    purpose: 'RENT'
  });

  assert.strictEqual(boundsRent.hasPropertiesWithPrice, false);
  assert.strictEqual(boundsRent.min, 0);
  assert.strictEqual(boundsRent.max, 200000);
});

test('calculateDynamicPriceBounds handles single property by padding bounds', () => {
  const bounds = calculateDynamicPriceBounds({
    properties: [{ id: 'single', price: 5000000 }],
    purpose: 'SALE'
  });

  assert.strictEqual(bounds.hasPropertiesWithPrice, true);
  assert.ok(bounds.min < 5000000, 'Min bound should be lower than single property price');
  assert.ok(bounds.max > 5000000, 'Max bound should be higher than single property price');
});

test('getScaleMarkers generates 4 evenly spaced markers along dynamic range', () => {
  const markers = getScaleMarkers(2000000, 10000000);
  assert.strictEqual(markers.length, 4);
  assert.strictEqual(markers[0].label, 'Rs. 20 L');
  assert.strictEqual(markers[3].label, 'Rs. 1 Cr');
});

test('filterBudgetPresets preserves only presets within dynamic bounds', () => {
  const salePresets = [
    { label: '< 25L', min: '', max: '2500000' },
    { label: '25L - 50L', min: '2500000', max: '5000000' },
    { label: '50L - 1 Cr', min: '5000000', max: '10000000' },
    { label: '1 - 2 Cr', min: '10000000', max: '20000000' },
    { label: '5 Cr+', min: '50000000', max: '' }
  ];

  const filtered = filterBudgetPresets(salePresets, 3000000, 15000000);
  const labels = filtered.map(p => p.label);

  assert.ok(labels.includes('25L - 50L'));
  assert.ok(labels.includes('50L - 1 Cr'));
  assert.ok(labels.includes('1 - 2 Cr'));
  assert.strictEqual(labels.includes('5 Cr+'), false);
});
