import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSiteConfig, mergeSiteConfigWithDefaults, DEFAULT_SITE_CONFIG } from './mockApi.js';

describe('EaseLand Site Config Sanitization & Zero-Claims Scrubbing Suite', () => {
  it('scrubs stale "Zero agents. Zero commission." hero subtitle and replaces with verified messaging', () => {
    const staleConfig = {
      homepage: {
        heroSubtitle: 'Zero agents. Zero commission. Explore land plots, houses, apartments, and commercial spaces on our interactive map across all of India.'
      }
    };

    const cleaned = sanitizeSiteConfig(staleConfig);
    assert.strictEqual(
      cleaned.homepage.heroSubtitle,
      '100% verified listings. Zero boundary disputes & crystal-clear titles. Explore land plots, houses, apartments, and commercial spaces on our interactive map across all of India.'
    );
  });

  it('scrubs zero-brokerage claims in footer tagline, sell page, and rent page', () => {
    const staleConfig = {
      footer: {
        tagline: 'EaseLand is India\'s premier direct property discovery and verification marketplace. Zero brokerage, 100% verified land titles and plot boundaries.'
      },
      rentPage: {
        subtitle: 'Save on high brokerage fees. EaseLand connects tenants directly with verified house owners and landlords across India.'
      },
      sellPage: {
        title: 'List Your Property Directly — Zero Brokerage Commission',
        subtitle: 'Receive direct customer enquiries with zero broker commission.'
      },
      branding: {
        slogan: 'Zero Brokerage. 100% Verified.'
      }
    };

    const cleaned = sanitizeSiteConfig(staleConfig);
    assert.strictEqual(cleaned.footer.tagline, DEFAULT_SITE_CONFIG.footer.tagline);
    assert.strictEqual(cleaned.rentPage.subtitle, DEFAULT_SITE_CONFIG.rentPage.subtitle);
    assert.strictEqual(cleaned.sellPage.title, DEFAULT_SITE_CONFIG.sellPage.title);
    assert.strictEqual(cleaned.sellPage.subtitle, DEFAULT_SITE_CONFIG.sellPage.subtitle);
    assert.strictEqual(cleaned.branding.slogan, DEFAULT_SITE_CONFIG.branding.slogan);
  });

  it('scrubs legacy FAQ referencing zero middleman commission', () => {
    const staleConfig = {
      faqs: [
        {
          id: 'faq-2',
          question: 'Are there any brokerage or hidden agent commissions?',
          answer: 'No. EaseLand is a 100% direct buyer-to-owner platform. Buyers contact property owners directly with zero middleman commissions.'
        }
      ]
    };

    const cleaned = sanitizeSiteConfig(staleConfig);
    assert.strictEqual(cleaned.faqs[0].id, 'faq-2');
    assert.strictEqual(cleaned.faqs[0].question, 'How does EaseLand ensure a safe and smooth property transaction?');
    assert.ok(cleaned.faqs[0].answer.includes('rigorous on-ground verification'));
  });

  it('preserves valid custom non-stale configuration values during merge', () => {
    const customConfig = {
      homepage: {
        heroTagline: 'Custom Verified Plots In Guntur',
        heroTitlePrefix: 'Explore Verified Properties '
      },
      navbar: {
        logoTextPrefix: 'Ease',
        logoTextSuffix: 'Land'
      }
    };

    const merged = mergeSiteConfigWithDefaults(customConfig);
    assert.strictEqual(merged.homepage.heroTagline, 'Custom Verified Plots In Guntur');
    assert.strictEqual(merged.homepage.heroTitlePrefix, 'Explore Verified Properties ');
    assert.strictEqual(merged.homepage.heroSubtitle, DEFAULT_SITE_CONFIG.homepage.heroSubtitle);
  });
});
