import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  META_PIXEL_ID,
  initMetaPixel,
  trackPageView,
  trackRegistrationComplete,
  trackLeadSubmitted,
  trackPropertyView,
  trackContactInitiated,
  setTrackingConsent,
  isTrackingPermitted,
  _resetTrackingStateForTesting
} from './metaPixel.js';

describe('EaseLand Meta Pixel & Ads Conversion Tracking Test Suite', () => {
  let calls = [];
  let storage = {};

  const mockLocalStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, val) => { storage[key] = String(val); },
    removeItem: (key) => { delete storage[key]; },
    clear: () => { storage = {}; }
  };

  const mockFbq = (...args) => {
    calls.push(args);
  };
  mockFbq.callMethod = (...args) => { calls.push(args); };
  mockFbq.queue = [];
  mockFbq.loaded = true;
  mockFbq.version = '2.0';

  const mockDocument = {
    createElement: () => ({ src: '', async: false }),
    getElementsByTagName: () => [{ parentNode: { insertBefore: () => {} } }],
    head: { appendChild: () => {} }
  };

  const getTrackCalls = () => calls.filter(c => c[0] === 'track' || c[0] === 'trackCustom');

  beforeEach(() => {
    calls = [];
    storage = {};
    _resetTrackingStateForTesting();

    globalThis.document = mockDocument;
    globalThis.window = {
      fbq: mockFbq,
      _fbq: mockFbq,
      location: {
        pathname: '/test',
        search: ''
      },
      document: mockDocument,
      localStorage: mockLocalStorage
    };
    globalThis.localStorage = mockLocalStorage;
  });

  afterEach(() => {
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
    _resetTrackingStateForTesting();
  });

  it('verifies the configured Meta Pixel ID is 1091569030464660', () => {
    assert.strictEqual(META_PIXEL_ID, '1091569030464660');
  });

  it('safely initializes Meta Pixel with Pixel ID', () => {
    delete globalThis.window.fbq;
    delete globalThis.window._fbq;

    const initialized = initMetaPixel();
    assert.strictEqual(initialized, true);
    assert.strictEqual(typeof globalThis.window.fbq, 'function');
  });

  it('tracks PageView and deduplicates consecutive route re-renders', () => {
    trackPageView('/listings');
    let trackCalls = getTrackCalls();
    assert.strictEqual(trackCalls.length, 1);
    assert.deepStrictEqual(trackCalls[0], ['track', 'PageView']);

    // Duplicate call for the same route (e.g. component re-render)
    trackPageView('/listings');
    trackCalls = getTrackCalls();
    assert.strictEqual(trackCalls.length, 1, 'Duplicate consecutive PageView must not be emitted');

    // Route transition to a new path
    trackPageView('/property/prop-789');
    trackCalls = getTrackCalls();
    assert.strictEqual(trackCalls.length, 2);
    assert.deepStrictEqual(trackCalls[1], ['track', 'PageView']);
  });

  it('tracks CompleteRegistration upon confirmed account creation with single-fire session guard', () => {
    trackRegistrationComplete('mobile_otp');
    let trackCalls = getTrackCalls();
    assert.strictEqual(trackCalls.length, 1);
    assert.deepStrictEqual(trackCalls[0], [
      'track',
      'CompleteRegistration',
      { status: 'success', method: 'mobile_otp' }
    ]);

    // Subsequent registration call within the same session must be blocked
    trackRegistrationComplete('mobile_otp');
    trackCalls = getTrackCalls();
    assert.strictEqual(trackCalls.length, 1, 'CompleteRegistration must fire at most once per session');
  });

  it('tracks Lead submission upon confirmed inquiry with zero PII', () => {
    const mockProperty = {
      id: 'prop-101',
      title: '2 Acre Mango Farm in Shadnagar',
      propertyType: 'Agricultural Land',
      price: 4500000,
      customerName: 'Secret Customer',
      customerPhone: '+919999999999',
      customerEmail: 'secret@customer.com'
    };

    trackLeadSubmitted(mockProperty);

    const trackCalls = getTrackCalls();
    assert.strictEqual(trackCalls.length, 1);
    assert.strictEqual(trackCalls[0][0], 'track');
    assert.strictEqual(trackCalls[0][1], 'Lead');

    const eventParams = trackCalls[0][2];
    assert.strictEqual(eventParams.content_name, '2 Acre Mango Farm in Shadnagar');
    assert.strictEqual(eventParams.content_category, 'Agricultural Land');
    assert.deepStrictEqual(eventParams.content_ids, ['prop-101']);
    assert.strictEqual(eventParams.value, 4500000);
    assert.strictEqual(eventParams.currency, 'INR');

    // Strict PII Verification
    assert.strictEqual(eventParams.customerName, undefined);
    assert.strictEqual(eventParams.customerPhone, undefined);
    assert.strictEqual(eventParams.customerEmail, undefined);
    assert.strictEqual(eventParams.name, undefined);
    assert.strictEqual(eventParams.phone, undefined);
    assert.strictEqual(eventParams.email, undefined);
  });

  it('handles Lead submission without price cleanly without undefined value', () => {
    trackLeadSubmitted({
      id: 'visitor-01',
      title: 'Commercial Land Visitor Lead',
      propertyType: 'Commercial Land'
    });

    const trackCalls = getTrackCalls();
    assert.strictEqual(trackCalls.length, 1);
    assert.deepStrictEqual(trackCalls[0], [
      'track',
      'Lead',
      {
        content_name: 'Commercial Land Visitor Lead',
        content_category: 'Commercial Land',
        content_ids: ['visitor-01']
      }
    ]);
  });

  it('tracks ViewContent for approved property and deduplicates repeated views in same session', () => {
    const property = {
      id: 'prop-555',
      title: 'Luxury Villa Plot in Mokila',
      propertyType: 'Open Plot Ventures',
      price: 8000000
    };

    trackPropertyView(property);
    let trackCalls = getTrackCalls();
    assert.strictEqual(trackCalls.length, 1);
    assert.deepStrictEqual(trackCalls[0], [
      'track',
      'ViewContent',
      {
        content_name: 'Luxury Villa Plot in Mokila',
        content_category: 'Open Plot Ventures',
        content_ids: ['prop-555'],
        content_type: 'product',
        value: 8000000,
        currency: 'INR'
      }
    ]);

    // Same property view in the same session must be deduplicated
    trackPropertyView(property);
    trackCalls = getTrackCalls();
    assert.strictEqual(trackCalls.length, 1);
  });

  it('tracks Contact initiation for WhatsApp and Phone calls', () => {
    const property = {
      id: 'prop-404',
      title: 'Highway Commercial Facing Bit'
    };

    trackContactInitiated('whatsapp', property);
    let trackCalls = getTrackCalls();
    assert.strictEqual(trackCalls.length, 1);
    assert.deepStrictEqual(trackCalls[0], [
      'track',
      'Contact',
      {
        contact_method: 'whatsapp',
        content_name: 'Highway Commercial Facing Bit',
        content_ids: ['prop-404']
      }
    ]);

    trackContactInitiated('phone', property);
    trackCalls = getTrackCalls();
    assert.strictEqual(trackCalls.length, 2);
    assert.deepStrictEqual(trackCalls[1], [
      'track',
      'Contact',
      {
        contact_method: 'phone',
        content_name: 'Highway Commercial Facing Bit',
        content_ids: ['prop-404']
      }
    ]);
  });

  it('suppresses tracking when user declines consent', () => {
    setTrackingConsent(false);
    assert.strictEqual(isTrackingPermitted(), false);

    trackPageView('/test');
    trackLeadSubmitted({ id: 'prop-1' });
    trackRegistrationComplete('email');

    assert.strictEqual(calls.length, 0, 'No events should fire when consent is declined');
  });
});
