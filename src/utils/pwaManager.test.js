import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

test('EaseLand PWA Suite — Manifest, Service Worker, and PWA Architecture', async (t) => {

  await t.test('1. manifest.json is valid and meets all PWA installability requirements', () => {
    const manifestPath = path.join(rootDir, 'public', 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist in public directory');

    const rawContent = fs.readFileSync(manifestPath, 'utf8');
    let manifest;
    assert.doesNotThrow(() => {
      manifest = JSON.parse(rawContent);
    }, 'manifest.json must be valid JSON');

    assert.ok(manifest.name && manifest.name.includes('EaseLand'), 'Manifest must have a descriptive name');
    assert.strictEqual(manifest.short_name, 'EaseLand', 'Manifest must have short_name EaseLand');
    assert.ok(manifest.start_url && manifest.start_url.startsWith('/'), 'Manifest must specify a valid start_url');
    assert.strictEqual(manifest.display, 'standalone', 'Manifest must specify standalone display mode');
    assert.strictEqual(manifest.theme_color, '#F59E0B', 'Manifest must specify brand theme color');
    assert.strictEqual(manifest.background_color, '#FFFFFF', 'Manifest must specify clean background color');

    // Icons validation
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'Manifest must have an array of icons');
    const icon192 = manifest.icons.find((i) => i.sizes === '192x192' && (!i.purpose || i.purpose.includes('any')));
    const icon512 = manifest.icons.find((i) => i.sizes === '512x512' && (!i.purpose || i.purpose.includes('any')));
    const maskableIcon = manifest.icons.find((i) => i.purpose && i.purpose.includes('maskable'));

    assert.ok(icon192, 'Manifest must include a 192x192 standard icon for mobile launchers');
    assert.ok(icon512, 'Manifest must include a 512x512 standard icon for splash screens');
    assert.ok(maskableIcon, 'Manifest must include at least one maskable icon for adaptive Android shapes');

    // Verify each referenced icon physically exists on disk
    for (const icon of manifest.icons) {
      const iconPath = path.join(rootDir, 'public', icon.src.replace(/^\//, ''));
      assert.ok(fs.existsSync(iconPath), `Icon file must exist on disk: ${icon.src}`);
      const stats = fs.statSync(iconPath);
      assert.ok(stats.size > 0, `Icon file must not be empty: ${icon.src}`);
    }

    // Shortcuts validation
    assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 2, 'Manifest must include quick-action shortcuts');
  });

  await t.test('2. sw.js Service Worker is defined with install, activate, fetch, and offline fallback', () => {
    const swPath = path.join(rootDir, 'public', 'sw.js');
    assert.ok(fs.existsSync(swPath), 'sw.js must exist in public directory');

    const swContent = fs.readFileSync(swPath, 'utf8');
    assert.ok(swContent.includes("addEventListener('install'"), 'sw.js must handle install event');
    assert.ok(swContent.includes("addEventListener('activate'"), 'sw.js must handle activate event');
    assert.ok(swContent.includes("addEventListener('fetch'"), 'sw.js must handle fetch event');
    assert.ok(swContent.includes('offline.html'), 'sw.js must provide offline.html fallback');
    assert.ok(swContent.includes('skipWaiting'), 'sw.js must support prompt activation with skipWaiting');
    assert.ok(swContent.includes('clients.claim'), 'sw.js must claim clients upon activation');
  });

  await t.test('3. offline.html exists, is self-contained, and includes EaseLand offline branding', () => {
    const offlinePath = path.join(rootDir, 'public', 'offline.html');
    assert.ok(fs.existsSync(offlinePath), 'offline.html must exist in public directory');

    const offlineContent = fs.readFileSync(offlinePath, 'utf8');
    assert.ok(offlineContent.includes('EaseLand'), 'offline.html must display EaseLand branding');
    assert.ok(offlineContent.includes('offline') || offlineContent.includes('Offline'), 'offline.html must mention offline mode');
    assert.ok(offlineContent.includes('Retry Connection'), 'offline.html must have a retry button');
  });

  await t.test('4. index.html links to manifest.json, specifies theme-color, and includes Apple touch icons', () => {
    const indexPath = path.join(rootDir, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');

    assert.ok(indexContent.includes('rel="manifest"'), 'index.html must link to manifest');
    assert.ok(indexContent.includes('name="theme-color"'), 'index.html must set theme-color');
    assert.ok(indexContent.includes('rel="apple-touch-icon"'), 'index.html must include apple-touch-icon');
    assert.ok(indexContent.includes('name="mobile-web-app-capable"'), 'index.html must enable mobile-web-app-capable');
  });

  await t.test('5. nginx.conf and server.js prevent caching of sw.js and serve manifest correctly', () => {
    const nginxPath = path.join(rootDir, 'nginx.conf');
    const nginxContent = fs.readFileSync(nginxPath, 'utf8');
    assert.ok(nginxContent.includes('/sw.js'), 'nginx.conf must have dedicated location for sw.js');
    assert.ok(nginxContent.includes('/manifest.json'), 'nginx.conf must have dedicated location for manifest.json');

    const serverPath = path.join(rootDir, 'server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    assert.ok(serverContent.includes("app.get('/sw.js'"), 'server.js must have dedicated route for /sw.js');
    assert.ok(serverContent.includes("app.get('/manifest.json'"), 'server.js must have dedicated route for /manifest.json');
  });

  await t.test('6. pwaManager module exports core functions and handles non-browser environments safely', async () => {
    const pwaManager = await import('./pwaManager.js');

    assert.strictEqual(typeof pwaManager.isPwaInstalled, 'function');
    assert.strictEqual(typeof pwaManager.isIOSDevice, 'function');
    assert.strictEqual(typeof pwaManager.registerServiceWorker, 'function');
    assert.strictEqual(typeof pwaManager.promptPwaInstall, 'function');
    assert.strictEqual(typeof pwaManager.skipWaitingAndReload, 'function');

    // In Node.js environment without window:
    assert.strictEqual(pwaManager.isPwaInstalled(), false, 'isPwaInstalled must return false when window is undefined');
    assert.strictEqual(pwaManager.isIOSDevice(), false, 'isIOSDevice must return false when window is undefined');

    const promptResult = await pwaManager.promptPwaInstall();
    assert.strictEqual(promptResult.outcome, 'unavailable', 'promptPwaInstall must report unavailable when no prompt is deferred');
  });

});
