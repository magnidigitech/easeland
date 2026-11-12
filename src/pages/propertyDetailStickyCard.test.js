import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('Property Detail Page Sticky Contact Card Suite', () => {
  it('1. Verifies PropertyDetailPage.jsx configures right sidebar card with sticky positioning and top offset', () => {
    const detailPath = path.join(rootDir, 'src', 'pages', 'PropertyDetailPage.jsx');
    assert.ok(fs.existsSync(detailPath), 'PropertyDetailPage.jsx must exist');
    const content = fs.readFileSync(detailPath, 'utf8');

    // Right column container occupies 1 column in lg grid
    assert.ok(content.includes('lg:col-span-1 relative'), 'Right column must have lg:col-span-1 relative');

    // Contact card has sticky top-28
    assert.ok(content.includes('lg:sticky lg:top-28') || content.includes('sticky top-28'), 'Card must have sticky positioning');

    // Support card details intact
    assert.ok(content.includes('Official EaseLand Support'), 'Card must show Official EaseLand Support badge');
    assert.ok(content.includes('EaseLand Team'), 'Card must show EaseLand Team title');
    assert.ok(content.includes('Interested in this Property? Contact EaseLand'), 'Card must show Contact EaseLand heading');
    assert.ok(content.includes('WhatsApp EaseLand'), 'Card must include WhatsApp EaseLand action');
    assert.ok(content.includes('Call EaseLand'), 'Card must include Call EaseLand action');
  });

  it('2. Verifies App.jsx uses overflow-x-clip to prevent breaking CSS sticky positioning context', () => {
    const appPath = path.join(rootDir, 'src', 'App.jsx');
    assert.ok(fs.existsSync(appPath), 'App.jsx must exist');
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(content.includes('overflow-x-clip'), 'App.jsx root wrapper must use overflow-x-clip');
    assert.ok(!content.includes('max-w-full overflow-x-hidden'), 'App.jsx must not use overflow-x-hidden on root wrapper');
  });

  it('3. Verifies index.css configures overflow-x clip on root and body to preserve window sticky behavior', () => {
    const cssPath = path.join(rootDir, 'src', 'index.css');
    assert.ok(fs.existsSync(cssPath), 'index.css must exist');
    const content = fs.readFileSync(cssPath, 'utf8');

    assert.ok(content.includes('overflow-x: clip;'), 'index.css must use overflow-x: clip');
  });
});
