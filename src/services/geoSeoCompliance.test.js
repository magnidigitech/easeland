import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GEOGRAPHIC_HUBS, REGIONAL_STATES, getGeoSeoMetadata } from './geoMapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

describe('EaseLand GEO, SEO & Psychological Copywriting Compliance Suite', () => {
  it('1. public/sitemap.xml exists, is valid XML, and contains all core routes and regional hubs', () => {
    const sitemapPath = path.join(rootDir, 'public', 'sitemap.xml');
    assert.ok(fs.existsSync(sitemapPath), 'sitemap.xml must exist in public directory');

    const content = fs.readFileSync(sitemapPath, 'utf8');
    assert.ok(content.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Must have standard XML header');
    assert.ok(content.includes('<urlset'), 'Must declare urlset element');
    assert.ok(content.includes('https://easeland.in/'), 'Must include canonical root URL');
    assert.ok(content.includes('https://easeland.in/properties'), 'Must include properties page');
    assert.ok(content.includes('https://easeland.in/?city=Guntur'), 'Must include Guntur geo hub');
    assert.ok(content.includes('https://easeland.in/?city=Amaravati'), 'Must include Amaravati geo hub');
    assert.ok(content.includes('https://easeland.in/?city=Hyderabad'), 'Must include Hyderabad geo hub');
    assert.ok(content.includes('https://easeland.in/?state=Andhra+Pradesh'), 'Must include Andhra Pradesh state hub');
    assert.ok(content.includes('https://easeland.in/?state=Telangana'), 'Must include Telangana state hub');
    assert.ok(content.includes('https://easeland.in/?category=open-plot-ventures'), 'Must include open plot ventures');
    assert.ok(content.includes('https://easeland.in/?category=amaravathi-lps'), 'Must include Amaravathi LPS plots');
  });

  it('2. public/robots.txt exists, disallows internal admin/crm/api, and references sitemap.xml', () => {
    const robotsPath = path.join(rootDir, 'public', 'robots.txt');
    assert.ok(fs.existsSync(robotsPath), 'robots.txt must exist in public directory');

    const content = fs.readFileSync(robotsPath, 'utf8');
    assert.ok(content.includes('User-agent: *'), 'Must specify user-agent directive');
    assert.ok(content.includes('Allow: /'), 'Must allow public crawling');
    assert.ok(content.includes('Disallow: /admin'), 'Must protect admin portal');
    assert.ok(content.includes('Disallow: /crm'), 'Must protect CRM clearance house');
    assert.ok(content.includes('Disallow: /api/'), 'Must protect API endpoints');
    assert.ok(content.includes('Sitemap: https://easeland.in/sitemap.xml'), 'Must point to canonical sitemap');
  });

  it('3. public/geo-mapping.json exists, is valid JSON, and defines Guntur, Amaravati, AP, TG & India', () => {
    const geoPath = path.join(rootDir, 'public', 'geo-mapping.json');
    assert.ok(fs.existsSync(geoPath), 'geo-mapping.json must exist in public directory');

    const content = fs.readFileSync(geoPath, 'utf8');
    const parsed = JSON.parse(content);

    assert.strictEqual(parsed.headquarters.locality, 'Guntur');
    assert.strictEqual(parsed.headquarters.state, 'Andhra Pradesh');
    assert.strictEqual(parsed.headquarters.postalCode, '522002');
    assert.strictEqual(parsed.headquarters.coordinates.latitude, 16.3124);
    assert.strictEqual(parsed.headquarters.coordinates.longitude, 80.4285);

    const hubs = parsed.geographicHierarchy.primaryFocusHubs;
    assert.ok(Array.isArray(hubs) && hubs.length >= 5, 'Must contain at least 5 focal hubs');

    const gunturHub = hubs.find(h => h.city === 'Guntur');
    assert.ok(gunturHub, 'Guntur hub must exist');
    assert.ok(gunturHub.microLocalities.includes('Brodipet'), 'Must include Brodipet');
    assert.ok(gunturHub.microLocalities.includes('Lakshmipuram'), 'Must include Lakshmipuram');

    const amaravatiHub = hubs.find(h => h.city === 'Amaravati');
    assert.ok(amaravatiHub, 'Amaravati hub must exist');
    assert.ok(amaravatiHub.topCategories.includes('Amaravathi LPS layout plots'));

    const hyderabadHub = hubs.find(h => h.city === 'Hyderabad');
    assert.ok(hyderabadHub, 'Hyderabad hub must exist');
    assert.strictEqual(hyderabadHub.state, 'Telangana');

    assert.strictEqual(parsed.geographicHierarchy.nationalScope.country, 'India');
  });

  it('4. index.html contains complete Schema.org JSON-LD graph, Geo meta tags, and OpenGraph cards', () => {
    const indexPath = path.join(rootDir, 'index.html');
    const html = fs.readFileSync(indexPath, 'utf8');

    // Geo Meta Tags
    assert.ok(html.includes('meta name="geo.region" content="IN-AP"'), 'Must have IN-AP geo.region');
    assert.ok(html.includes('meta name="geo.placename" content="Guntur, Andhra Pradesh, India"'), 'Must have Guntur placename');
    assert.ok(html.includes('meta name="geo.position" content="16.3124;80.4285"'), 'Must have geo coordinates');
    assert.ok(html.includes('meta name="ICBM" content="16.3124, 80.4285"'), 'Must have ICBM tag');

    // Social Cards
    assert.ok(html.includes('meta property="og:title"'), 'Must have og:title');
    assert.ok(html.includes('meta name="twitter:card"'), 'Must have twitter:card');

    // Schema.org Graph
    assert.ok(html.includes('application/ld+json'), 'Must contain ld+json script');
    assert.ok(html.includes('"@type": ["RealEstateAgent", "LocalBusiness"]'), 'Must declare RealEstateAgent and LocalBusiness');
    assert.ok(html.includes('"addressLocality": "Guntur"'), 'Must have Guntur address');
    assert.ok(html.includes('"postalCode": "522002"'), 'Must have Guntur pincode 522002');
    assert.ok(html.includes('"name": "Amaravati"'), 'Must serve Amaravati in areaServed');
    assert.ok(html.includes('"name": "Hyderabad"'), 'Must serve Hyderabad in areaServed');
  });

  it('5. Forbidden zero-commission/no-brokerage claims are completely absent from public customer surfaces', () => {
    const filesToCheck = [
      path.join(rootDir, 'index.html'),
      path.join(rootDir, 'public', 'manifest.json'),
      path.join(rootDir, 'src', 'components', 'AnimatedPromotionBanner.jsx')
    ];

    const forbiddenPatterns = [
      /zero\s+brokerage/i,
      /zero\s+commission/i,
      /no\s+brokerage/i,
      /no\s+commission/i,
      /0%\s+brokerage/i,
      /0%\s+commission/i,
      /zero\s+brokers/i
    ];

    for (const filePath of filesToCheck) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const pattern of forbiddenPatterns) {
        assert.ok(
          !pattern.test(content),
          'File ' + path.basename(filePath) + ' must NOT contain forbidden phrase matching ' + pattern
        );
      }
    }
  });

  it('6. geoMapping service returns non-spammy, tailored SEO metadata for cities and categories', () => {
    const gunturMeta = getGeoSeoMetadata('Guntur', null);
    assert.ok(gunturMeta.title.includes('Guntur'));
    assert.ok(gunturMeta.title.includes('Direct Deal Facilitation'));
    assert.ok(gunturMeta.description.includes('Guntur'));
    assert.ok(gunturMeta.description.includes('Certified satellite boundaries'));

    const catMeta = getGeoSeoMetadata(null, 'Open Plot Ventures');
    assert.ok(catMeta.title.includes('Open Plot Ventures'));
    assert.ok(catMeta.title.includes('Guntur, AP, Telangana & India'));

    const defaultMeta = getGeoSeoMetadata(null, null);
    assert.ok(defaultMeta.title.includes('EaseLand'));
    assert.ok(defaultMeta.description.includes('Guntur, Andhra Pradesh, Telangana, and Pan-India'));

    assert.ok(GEOGRAPHIC_HUBS.length >= 5);
    assert.ok(REGIONAL_STATES.length >= 3);
  });
});
