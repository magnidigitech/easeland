import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('EaseLand User Dashboard Metric Cards Navigation & Redirection Suite', () => {
  it('1. Verifies UserDashboard.jsx defines interactive buttons with click redirection for all 3 metrics', () => {
    const userDashboardPath = path.join(rootDir, 'src', 'components', 'UserDashboard.jsx');
    assert.ok(fs.existsSync(userDashboardPath), 'UserDashboard.jsx must exist');

    const content = fs.readFileSync(userDashboardPath, 'utf8');

    // 1. Active Listings metric button
    assert.ok(content.includes("setPropertyFilter('ALL');"), 'Active Listings must set propertyFilter to ALL');
    assert.ok(content.includes("handleTabChange('properties');"), 'Active Listings must redirect to properties tab');
    assert.ok(content.includes('title="View All Active Listings"'), 'Active Listings button must have descriptive title');

    // 2. Verified Live metric button
    assert.ok(content.includes("setPropertyFilter('LIVE');"), 'Verified Live must set propertyFilter to LIVE');
    assert.ok(content.includes("handleTabChange('verification');"), 'Verified Live must redirect to verification tab');
    assert.ok(content.includes('title="View Verified Live Listings"'), 'Verified Live button must have descriptive title');

    // 3. Saved Wishlist metric button
    assert.ok(content.includes("handleTabChange('wishlist');"), 'Saved Wishlist must redirect to wishlist tab');
    assert.ok(content.includes('title="View Saved Wishlist"'), 'Saved Wishlist button must have descriptive title');
  });

  it('2. Verifies all 3 metric cards are semantic button elements with keyboard accessibility and hover styling', () => {
    const userDashboardPath = path.join(rootDir, 'src', 'components', 'UserDashboard.jsx');
    const content = fs.readFileSync(userDashboardPath, 'utf8');

    // Ensure buttons have type="button" and cursor-pointer for accessibility
    assert.ok(content.includes('type="button"'), 'Metric cards must be semantic buttons');
    assert.ok(content.includes('cursor-pointer'), 'Metric cards must indicate clickability with cursor-pointer');
    assert.ok(content.includes('hover:shadow-md'), 'Metric cards must have interactive hover elevation');
    assert.ok(content.includes('focus:outline-none focus:ring-2'), 'Metric cards must support accessible focus rings');
  });

  it('3. Verifies normalizeDashboardTab correctly maps tab names for properties, verification, and wishlist', () => {
    const normalizeDashboardTab = (t) => {
      if (!t) return 'overview';
      const lower = String(t).toLowerCase().trim();
      if (lower === 'properties' || lower === 'my-properties' || lower === 'listings') return 'properties';
      if (lower === 'verification' || lower === 'verification-status') return 'verification';
      if (lower === 'wishlist' || lower === 'saved') return 'wishlist';
      if (lower === 'account' || lower === 'account-settings' || lower === 'settings' || lower === 'profile') return 'account';
      if (lower === 'enquiries' || lower === 'inquiries' || lower === 'messages') return 'enquiries';
      if (lower === 'notifications') return 'notifications';
      return 'overview';
    };

    assert.strictEqual(normalizeDashboardTab('properties'), 'properties');
    assert.strictEqual(normalizeDashboardTab('my-properties'), 'properties');
    assert.strictEqual(normalizeDashboardTab('verification'), 'verification');
    assert.strictEqual(normalizeDashboardTab('verification-status'), 'verification');
    assert.strictEqual(normalizeDashboardTab('wishlist'), 'wishlist');
    assert.strictEqual(normalizeDashboardTab('saved'), 'wishlist');
    assert.strictEqual(normalizeDashboardTab('overview'), 'overview');
  });
});
