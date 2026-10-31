import { describe, it } from 'node:test';
import assert from 'node:assert';
import { applySiteTheme, mockApi, safeArray, DEFAULT_SITE_CONFIG, resetModuleConfig } from './mockApi.js';

describe('Site Theme & CMS Popup Modal Item Creation Suite', () => {
  it('1. applySiteTheme safely exits in non-DOM or undefined config without throwing', () => {
    assert.doesNotThrow(() => {
      applySiteTheme(null);
      applySiteTheme(undefined);
      applySiteTheme({});
    });
  });

  it('2. applySiteTheme calculates correct CSS variables, contrast text, and font quotation on mock document', () => {
    const properties = {};
    const mockHead = {
      appendChild: (el) => { mockHead.children.push(el); },
      children: []
    };
    const mockDocument = {
      documentElement: {
        style: {
          setProperty: (key, val) => {
            properties[key] = val;
          }
        }
      },
      head: mockHead,
      body: {
        style: {}
      },
      getElementById: (id) => {
        return mockHead.children.find(c => c.id === id) || null;
      },
      createElement: (tag) => {
        return { tag, id: '', rel: '', href: '' };
      }
    };

    globalThis.document = mockDocument;

    // Test with bright green (#08e717) and Plus Jakarta Sans
    applySiteTheme({
      primaryColor: '#08e717',
      darkBgColor: '#3b8df1',
      accentColor: '#ffffff',
      fontFamily: 'Plus Jakarta Sans'
    });

    assert.strictEqual(properties['--brand-yellow'], '#08e717');
    assert.strictEqual(properties['--metallic-gold'], '#08e717');
    assert.strictEqual(properties['--brand-yellow-text'], '#0b2545'); // dark text on bright green
    assert.strictEqual(properties['--brand-navy'], '#3b8df1');
    assert.strictEqual(properties['--brand-charcoal'], '#3b8df1');
    assert.strictEqual(properties['--brand-blue'], '#ffffff');
    assert.strictEqual(properties['--brand-font'], '"Plus Jakarta Sans", sans-serif');
    assert.strictEqual(mockDocument.body.style.fontFamily, '"Plus Jakarta Sans", sans-serif');
    assert.ok(mockHead.children.length > 0);
    assert.ok(mockHead.children[0].href.includes('family=Plus+Jakarta+Sans'));

    // Test with dark primary color to verify contrast flips to white
    applySiteTheme({
      primaryColor: '#1e293b'
    });

    assert.strictEqual(properties['--brand-yellow'], '#1e293b');
    assert.strictEqual(properties['--brand-yellow-text'], '#ffffff'); // white text on dark background
  });

  it('3. Category creation from modal adds populated object at the top of list', () => {
    const existingCategories = [
      { id: 'cat-1', title: 'Open Plots', countText: '10 Plots' }
    ];

    const newCategoryForm = {
      title: 'Luxury Agricultural Farmland',
      countText: '25+ Verified Farms',
      imageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef'
    };

    const newCat = {
      id: 'cat-' + Date.now(),
      title: newCategoryForm.title.trim(),
      countText: newCategoryForm.countText.trim() || '0 Properties',
      imageUrl: newCategoryForm.imageUrl.trim()
    };

    const updated = [newCat, ...safeArray(existingCategories)];

    assert.strictEqual(updated.length, 2);
    assert.strictEqual(updated[0].id, newCat.id);
    assert.strictEqual(updated[0].title, 'Luxury Agricultural Farmland');
    assert.strictEqual(updated[0].countText, '25+ Verified Farms');
    assert.strictEqual(updated[1].id, 'cat-1');
  });

  it('4. FAQ creation from modal adds populated Q&A pair at the top of list', () => {
    const existingFaqs = [
      { id: 'faq-1', question: 'Old Question', answer: 'Old Answer' }
    ];

    const newFaqForm = {
      question: 'How do I schedule an on-site visit with EaseLand?',
      answer: 'Click Request Site Visit or contact the dedicated relationship manager directly.'
    };

    const newFaq = {
      id: 'faq-' + Date.now(),
      question: newFaqForm.question.trim(),
      answer: newFaqForm.answer.trim()
    };

    const updated = [newFaq, ...safeArray(existingFaqs)];

    assert.strictEqual(updated.length, 2);
    assert.strictEqual(updated[0].id, newFaq.id);
    assert.strictEqual(updated[0].question, 'How do I schedule an on-site visit with EaseLand?');
    assert.strictEqual(updated[0].answer, 'Click Request Site Visit or contact the dedicated relationship manager directly.');
    assert.strictEqual(updated[1].id, 'faq-1');
  });

  it('5. mockApi.updateSiteConfig stores theme updates and updates in-memory config', () => {
    const newTheme = {
      primaryColor: '#08e717',
      darkBgColor: '#3b8df1',
      accentColor: '#ffffff',
      fontFamily: 'Outfit'
    };

    const result = mockApi.updateSiteConfig({ theme: newTheme });
    assert.ok(result);
    assert.strictEqual(result.theme.primaryColor, '#08e717');
    assert.strictEqual(result.theme.darkBgColor, '#3b8df1');
    assert.strictEqual(result.theme.accentColor, '#ffffff');
    assert.strictEqual(result.theme.fontFamily, 'Outfit');
  });

  it('6. resetModuleConfig restores individual module to exact factory defaults', () => {
    // Mutate multiple modules in mockApi
    mockApi.updateSiteConfig({
      overview: { siteName: 'Mutated Custom Portal' },
      theme: { primaryColor: '#ff0000', fontFamily: 'Cinzel' },
      mapsConfig: { defaultLat: 99.9999 }
    });

    const activeConfig = mockApi.getSiteConfig();
    assert.strictEqual(activeConfig.overview.siteName, 'Mutated Custom Portal');
    assert.strictEqual(activeConfig.theme.fontFamily, 'Cinzel');
    assert.strictEqual(activeConfig.mapsConfig.defaultLat, 99.9999);

    // Reset overview module
    const resetOverviewRes = mockApi.resetModuleConfig('overview');
    assert.strictEqual(resetOverviewRes.overview.siteName, DEFAULT_SITE_CONFIG.overview.siteName);
    // Other modules remain mutated until individually reset
    assert.strictEqual(resetOverviewRes.theme.fontFamily, 'Cinzel');

    // Reset maps module
    const resetMapsRes = mockApi.resetModuleConfig('maps');
    assert.strictEqual(resetMapsRes.mapsConfig.defaultLat, DEFAULT_SITE_CONFIG.mapsConfig.defaultLat);

    // Reset theme module
    const resetThemeRes = mockApi.resetModuleConfig('theme');
    assert.strictEqual(resetThemeRes.theme.fontFamily, DEFAULT_SITE_CONFIG.theme.fontFamily);
    assert.strictEqual(resetThemeRes.theme.primaryColor, DEFAULT_SITE_CONFIG.theme.primaryColor);
  });
});
