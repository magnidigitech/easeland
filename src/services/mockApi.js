import { INITIAL_PROPERTIES, INITIAL_ENQUIRIES, INITIAL_DEALS, INITIAL_FOLLOW_UPS } from './mockData.js';
import { extractCoordinates } from './locationProvider.js';
import { getCategoryBadgeLabel } from '../utils/categoryUtils.js';
import { parseNaturalLanguageQuery, REAL_ESTATE_STOPWORDS, getSemanticSynonyms } from '../firebase/searchParser.js';
import { normalizeFurnishing, normalizeFacing } from '../utils/filterMatchingUtils.js';

export const safeArray = (val) => {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') {
    if (Array.isArray(val.items)) return val.items;
    if (Array.isArray(val.list)) return val.list;
    if (Array.isArray(val.faqs)) return val.faqs;
    if (Array.isArray(val.categories)) return val.categories;
    const values = Object.keys(val)
      .filter(k => !['state', 'publishedAt', 'publishedBy', 'updatedAt', 'updatedBy'].includes(k))
      .map(k => val[k])
      .filter(item => item && (typeof item === 'object' || typeof item === 'string'));
    return values;
  }
  return [];
};

// Helper to initialize local storage
const getStoredData = (key, initial) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return initial;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : initial;
  } catch (err) {
    return initial;
  }
};

const setStoredData = (key, data) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn('LocalStorage write note:', err);
  }
};

export const applySiteTheme = (themeConfig) => {
  if (!themeConfig || typeof document === 'undefined') return;

  const root = document.documentElement;

  if (themeConfig.primaryColor) {
    root.style.setProperty('--brand-yellow', themeConfig.primaryColor);
    root.style.setProperty('--brand-yellow-hover', themeConfig.primaryColor);
  }

  if (themeConfig.darkBgColor) {
    root.style.setProperty('--brand-navy', themeConfig.darkBgColor);
    root.style.setProperty('--brand-navy-light', themeConfig.darkBgColor);
  }

  if (themeConfig.accentColor) {
    root.style.setProperty('--brand-blue', themeConfig.accentColor);
  }

  if (themeConfig.fontFamily) {
    root.style.setProperty('--brand-font', themeConfig.fontFamily);
    if (document.body) {
      document.body.style.fontFamily = `"${themeConfig.fontFamily}", sans-serif`;
    }
  }
};

const FAKE_PROP_IDS = new Set([
  'prop-101', 'prop-102', 'prop-103', 'prop-104', 'prop-105', 'prop-106', 'prop-107', 'prop-108',
  'EL-PROP-1001', 'EL-PROP-1002', 'EL-PROP-1003', 'EL-PROP-1004', 'EL-PROP-1005', 'EL-PROP-1006'
]);

const FAKE_TITLES_LOWER = [
  'corner open plot near inner ring road',
  'spacious 2 bhk rental apartment in indiranagar',
  'east facing residential land plot',
  'luxury 4 bhk independent villa',
  '3 bhk modern apartment in whitefield',
  'prime gachibowli open plot for villa',
  'demo property',
  'sample property'
];

export const isFakeProperty = (p) => {
  if (!p) return true;
  const pId = String(p.id || p.propertyId || '').toLowerCase().trim();
  if (FAKE_PROP_IDS.has(pId) || pId.startsWith('prop-10') || pId.startsWith('el-prop-100') || pId.startsWith('mock-')) {
    return true;
  }
  const title = String(p.title || '').toLowerCase().trim();
  if (FAKE_TITLES_LOWER.some(t => title.includes(t))) {
    return true;
  }
  const ownerEmail = String(p.ownerPrivateEmail || p.ownerPublicEmail || p.owner?.email || '').toLowerCase().trim();
  if (ownerEmail === 'testowner@easeland.in') {
    return true;
  }
  const ownerName = String(p.ownerPublicName || p.owner?.name || '').toLowerCase().trim();
  if (ownerName === 'demo owner') {
    return true;
  }
  return false;
};

// Bulletproof Deduplication Algorithm across all properties (Zero Duplicate Law)
export const deduplicateProperties = (items) => {
  if (!Array.isArray(items)) return [];

  // Priority sort: newly created/updated properties take priority over static mocks
  const sorted = [...items].filter(p => !isFakeProperty(p)).sort((a, b) => {
    if (a.createdAt && b.createdAt) return new Date(b.createdAt) - new Date(a.createdAt);
    if (a.createdAt && !b.createdAt) return -1;
    if (!a.createdAt && b.createdAt) return 1;
    return 0;
  });

  const result = [];

  for (const item of sorted) {
    if (!item || isFakeProperty(item)) continue;

    const isDuplicate = result.some(existing => {
      // 1. Same ID check
      if (item.id && existing.id && item.id === existing.id) return true;

      // 2. Exact Title match check (case-insensitive)
      const sameTitle = item.title && existing.title &&
        item.title.toLowerCase().trim() === existing.title.toLowerCase().trim();

      // 3. Exact Geospatial proximity match (within ~10m / 0.0001 deg)
      let exactGeoMatch = false;
      const locA = extractCoordinates(item);
      const locB = extractCoordinates(existing);
      if (!isNaN(locA.lat) && !isNaN(locB.lat)) {
        const latDiff = Math.abs(locA.lat - locB.lat);
        const lngDiff = Math.abs(locA.lng - locB.lng);
        exactGeoMatch = latDiff < 0.0001 && lngDiff < 0.0001;
      }

      return sameTitle || exactGeoMatch;
    });

    if (!isDuplicate) {
      result.push(item);
    }
  }

  return result;
};

// Storage state (Clean and overwrite stale localStorage duplicates)
let rawProperties = (getStoredData('easeland_properties', INITIAL_PROPERTIES) || []).filter(p => !isFakeProperty(p));
let properties = deduplicateProperties(rawProperties).map(p => {
  if (!p) return p;
  const isPhotoUrl = (m) => {
    if (!m) return false;
    if (typeof m === 'string') {
      const u = m.toLowerCase().trim();
      if (!u) return false;
      if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('drive.google.com')) return false;
      if (u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.mov') || u.endsWith('.avi') || u.endsWith('.pdf') || u.endsWith('.doc') || u.endsWith('.docx')) return false;
      return true;
    }
    if (m.type === 'WALKTHROUGH_VIDEO' || m.type === 'DRONE_VIDEO' || m.type === 'VIDEO' || m.type === 'DOCUMENT') return false;
    if (m.contentType && (m.contentType.startsWith('video/') || m.contentType.startsWith('application/'))) return false;
    if (m.provider || m.videoId || m.fileId || m.embedUrl) return false;
    const u = (m.url || m.mediaUrl || m.publicUrl || '').toLowerCase();
    if (!u) return false;
    if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('drive.google.com') || u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.mov') || u.endsWith('.pdf')) return false;
    return true;
  };
  const extractUrl = (m) => {
    if (!isPhotoUrl(m)) return null;
    return typeof m === 'string' ? m : (m?.url || m?.mediaUrl || m?.publicUrl || null);
  };
  const mediaPhotos = (Array.isArray(p.media) ? p.media : []).map(extractUrl).filter(Boolean);
  const photosArray = (Array.isArray(p.photos) ? p.photos : []).map(extractUrl).filter(Boolean);
  const combinedPhotos = Array.from(new Set([...photosArray, ...mediaPhotos]));
  return {
    ...p,
    photos: combinedPhotos
  };
}).filter(p => !isFakeProperty(p));

setStoredData('easeland_properties', properties);

// Scrub all local storage keys containing property arrays
if (typeof window !== 'undefined') {
  try {
    const keysToClean = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties', 'easeland_submitted_properties'];
    keysToClean.forEach(key => {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(item => {
            if (typeof item === 'string') return !FAKE_PROP_IDS.has(item) && !item.startsWith('prop-10') && !item.startsWith('EL-PROP-100');
            return !isFakeProperty(item);
          });
          localStorage.setItem(key, JSON.stringify(cleaned));
        }
      }
    });
  } catch (e) {}
}

let enquiries = getStoredData('easeland_enquiries', INITIAL_ENQUIRIES);
let deals = getStoredData('easeland_deals', INITIAL_DEALS);
let followUps = getStoredData('easeland_followups', INITIAL_FOLLOW_UPS);
let wishlist = getStoredData('easeland_wishlist', []);

const INITIAL_USERS = [];

export const DEFAULT_SITE_CONFIG = {
  overview: {
    siteName: 'EaseLand',
    status: 'PUBLISHED',
    lastPublished: '2026-09-02T12:00:00Z',
    domain: 'easeland.in',
    emergencyMaintenance: false
  },
  homepage: {
    heroTagline: 'India-Wide Direct Property Marketplace — Powered by Google Maps Platform',
    heroTitlePrefix: 'Find, Explore & Verify Properties ',
    heroTitleHighlight: 'Directly from Owners',
    heroSubtitle: '100% verified listings. Zero boundary disputes & crystal-clear titles. Explore land plots, houses, apartments, and commercial spaces on our interactive map across all of India.',
    showSearchCard: true,
    showPopularSearches: true,
    heroBackgroundImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80'
  },
  navbar: {
    logoTextPrefix: 'Ease',
    logoTextSuffix: 'Land',
    logoSubtext: 'DIRECT PROPERTY PLATFORM',
    logoEmblemUrl: '/easeland_emblem_transparent.png',
    buyLabel: 'BUY',
    rentLabel: 'RENT',
    sellLabel: 'SELL',
    postButtonLabel: 'POST PROPERTY',
    stickyNavbar: true
  },
  footer: {
    tagline: 'EaseLand is India\'s premier property discovery and verification marketplace. 100% physically inspected listings, crystal-clear land titles, and zero boundary disputes.',
    officeAddress: 'Door No. 4-12-89, 4th Line Main, Brodipet, Guntur Central Mandal, Guntur, AP - 522002, India',
    supportPhone: '+91 98765 43210',
    supportEmail: 'support@easeland.in',
    copyrightText: '© 2026 EaseLand Platform India Private Limited. All Rights Reserved.',
    socialTwitter: 'https://twitter.com/easeland_in',
    socialLinkedin: 'https://linkedin.com/company/easeland-india',
    socialYoutube: 'https://youtube.com/@easeland_official'
  },
  buyPage: {
    title: 'Buy Verified Land Plots & Properties Across India',
    subtitle: 'Browse 100% physically inspected plots, houses, and commercial spaces with delineated boundaries and verified title deeds.',
    badgeText: 'DIRECT OWNER LISTINGS'
  },
  rentPage: {
    title: 'Rent Verified Apartments & Independent Houses',
    subtitle: 'Find rental properties with verified property details, authenticated owners, and complete agreement support.',
    badgeText: 'DIRECT TENANT CONNECT'
  },
  sellPage: {
    title: 'List Your Property — Connect with Verified Serious Buyers',
    subtitle: 'Post your open plot, villa, apartment, or commercial land in under 3 minutes. Our verification specialist inspects your property within 24 hours.',
    badgeText: 'POST PROPERTY FOR FREE'
  },
  categories: [
    { id: 'cat-1', title: 'Open Plot Ventures', countText: 'Layout & Gated Ventures', icon: 'MapPin', imageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80' },
    { id: 'cat-2', title: 'Open Plot (City)', countText: 'In-City Residential Plots', icon: 'MapPin', imageUrl: 'https://images.unsplash.com/photo-1592595896551-12b371d546d5?auto=format&fit=crop&w=600&q=80' },
    { id: 'cat-3', title: 'Apartments/Flat', countText: 'High-Rise Modern Flats', icon: 'Building', imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80' },
    { id: 'cat-4', title: 'Independent House/Villa', countText: 'Independent Villas & Gated Houses', icon: 'Building2', imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80' },
    { id: 'cat-5', title: 'Commerical Property', countText: 'Commercial Plots & Offices', icon: 'Briefcase', imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80' },
    { id: 'cat-6', title: 'Agricultural Lands', countText: 'Farmlands & Agri Acreages', icon: 'Trees', imageUrl: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80' },
    { id: 'cat-7', title: 'Amaravathi LPS layout plots', countText: 'CRDA Amaravathi LPS Plots', icon: 'LandPlot', imageUrl: 'https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?auto=format&fit=crop&w=600&q=80' },
    { id: 'cat-8', title: 'Others', countText: 'Warehouses & Mixed Use', icon: 'Compass', imageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80' }
  ],
  faqs: [
    { id: 'faq-1', question: 'How does EaseLand verify property titles and land boundaries?', answer: 'EaseLand deploys field inspection specialists who perform physical site visits, capture GeoJSON plot boundary coordinates, and audit land records (Pahani, Adangal, Encumbrance Certificates) before publishing listings live.' },
    { id: 'faq-2', question: 'How does EaseLand ensure a safe and smooth property transaction?', answer: 'EaseLand conducts rigorous on-ground verification, reviews title documents, guarantees zero boundary disputes, and connects genuine buyers with verified owners for a seamless transaction experience.' },
    { id: 'faq-3', question: 'How long does property verification take after posting?', answer: 'Property verification is completed within 24 hours of document submission. Our legal auditors inspect documents and publish the verified listing.' },
    { id: 'faq-4', question: 'Are confidential land title documents accessible to public users?', answer: 'No. Property title deeds and Pahani extracts are stored in an encrypted vault accessible only to EaseLand legal auditors and verified property owners.' }
  ],
  contact: {
    heading: 'Get in Touch with EaseLand',
    subheading: 'Have questions about property verification, land titles, or platform features? Our team is available 24/7.',
    recipientEmail: 'leads@easeland.in',
    phoneDisplay: '+91 98765 43210',
    emailDisplay: 'support@easeland.in'
  },
  branding: {
    logoUrl: '/easeland_logo.png',
    emblemUrl: '/easeland_emblem_transparent.png',
    brandTagline: 'India\'s Direct Property & Verified Land Discovery Platform',
    slogan: '100% Verified. Transparent Deals.'
  },
  theme: {
    primaryColor: '#eab308',
    darkBgColor: '#0b2545',
    accentColor: '#ffffff',
    fontFamily: 'Plus Jakarta Sans',
    darkMode: false
  },
  media: {
    heroBannerUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80',
    mapPlaceholderUrl: 'https://mt1.google.com/vt/lyrs=m&x=1468&y=948&z=11',
    fallbackPropertyImageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'
  },
  mapsConfig: {
    defaultLat: 16.3124,
    defaultLng: 80.4285,
    defaultZoom: 13,
    maxZoom: 20,
    locationZoom250: 20,
    googleMapsApiKey: 'AIzaSy_GPROP_MAP_API_KEY_LIVE',
    enableSatellite: true,
    enableTraffic: true,
    enablePlotPolygons: true
  },
  seo: {
    metaTitle: 'EaseLand — Pan-India Verified Property & Land Marketplace',
    metaDescription: 'Discover and verify open plots, villas, apartments, and agricultural lands. 100% verified title deeds, zero boundary disputes, and Leaflet Google satellite map polygons.',
    keywords: 'land plots, buy land, guntur real estate, hyderabad plots, verified property, transparent deals, plot boundary, real estate india',
    ogImageUrl: '/easeland_logo.png',
    canonicalUrl: 'https://easeland.in'
  },
  featuredListings: {
    badgeText: 'VERIFIED LISTINGS',
    sectionTitle: 'Featured & Recent Verified Properties',
    displayCount: 3,
    featuredPropertyIds: [],
    showOnlyFeatured: false
  },
  publish: {
    autoPublish: false,
    version: '2.4.0',
    lastPublishedBy: 'EaseLand Admin'
  }
};

export const sanitizeSiteConfig = (cfg) => {
  if (!cfg || typeof cfg !== 'object') return { ...DEFAULT_SITE_CONFIG };

  const sanitized = JSON.parse(JSON.stringify(cfg));

  // 1. Scrub homepage hero subtitle
  const heroSub = sanitized.homepage?.heroSubtitle;
  if (
    !heroSub ||
    typeof heroSub !== 'string' ||
    heroSub.includes('Zero agents') ||
    heroSub.includes('Zero commission') ||
    heroSub.includes('Zero brokerage') ||
    heroSub.includes('zero broker') ||
    heroSub.includes('zero-brokerage') ||
    heroSub.includes('zero-commission') ||
    heroSub.includes('Accurate plot boundaries')
  ) {
    if (!sanitized.homepage) sanitized.homepage = {};
    sanitized.homepage.heroSubtitle = DEFAULT_SITE_CONFIG.homepage.heroSubtitle;
  }

  // 2. Scrub footer tagline
  const footerTag = sanitized.footer?.tagline;
  if (
    footerTag &&
    (footerTag.includes('Zero brokerage') || footerTag.includes('zero brokerage') || footerTag.includes('precise plot boundaries'))
  ) {
    if (!sanitized.footer) sanitized.footer = {};
    sanitized.footer.tagline = DEFAULT_SITE_CONFIG.footer.tagline;
  }

  // 3. Scrub rent page
  const rentSub = sanitized.rentPage?.subtitle;
  if (
    rentSub &&
    (rentSub.toLowerCase().includes('brokerage') || rentSub.toLowerCase().includes('commission') || rentSub.toLowerCase().includes('middleman'))
  ) {
    if (!sanitized.rentPage) sanitized.rentPage = {};
    sanitized.rentPage.subtitle = DEFAULT_SITE_CONFIG.rentPage.subtitle;
  }

  // 4. Scrub sell page
  const sellTitle = sanitized.sellPage?.title;
  if (
    sellTitle &&
    (sellTitle.includes('Zero Brokerage') || sellTitle.includes('zero brokerage') || sellTitle.includes('Zero commission'))
  ) {
    if (!sanitized.sellPage) sanitized.sellPage = {};
    sanitized.sellPage.title = DEFAULT_SITE_CONFIG.sellPage.title;
  }
  const sellSub = sanitized.sellPage?.subtitle;
  if (
    sellSub &&
    (sellSub.includes('zero broker') || sellSub.includes('zero commission') || sellSub.includes('zero brokerage'))
  ) {
    if (!sanitized.sellPage) sanitized.sellPage = {};
    sanitized.sellPage.subtitle = DEFAULT_SITE_CONFIG.sellPage.subtitle;
  }

  // 5. Scrub branding slogan
  const slogan = sanitized.branding?.slogan;
  if (
    slogan &&
    (slogan.includes('Zero Brokerage') || slogan.includes('zero brokerage') || slogan.includes('Zero commission'))
  ) {
    if (!sanitized.branding) sanitized.branding = {};
    sanitized.branding.slogan = DEFAULT_SITE_CONFIG.branding.slogan;
  }

  // 6. Scrub FAQs
  if (Array.isArray(sanitized.faqs)) {
    sanitized.faqs = sanitized.faqs.map(faq => {
      if (
        faq.question?.includes('brokerage or hidden agent commissions') ||
        faq.answer?.includes('zero middleman') ||
        faq.answer?.includes('100% direct buyer-to-owner platform')
      ) {
        return DEFAULT_SITE_CONFIG.faqs.find(f => f.id === 'faq-2') || faq;
      }
      return faq;
    });
  }

  // 7. Scrub SEO
  if (sanitized.seo?.metaDescription && (sanitized.seo.metaDescription.includes('Zero brokerage') || sanitized.seo.metaDescription.includes('zero brokerage'))) {
    sanitized.seo.metaDescription = DEFAULT_SITE_CONFIG.seo.metaDescription;
  }
  if (sanitized.seo?.keywords && (sanitized.seo.keywords.includes('zero brokerage') || sanitized.seo.keywords.includes('zero-brokerage'))) {
    sanitized.seo.keywords = DEFAULT_SITE_CONFIG.seo.keywords;
  }

  return sanitized;
};

export const mergeSiteConfigWithDefaults = (userConfig = {}) => {
  if (!userConfig || typeof userConfig !== 'object') return { ...DEFAULT_SITE_CONFIG };
  const merged = {
    overview: { ...DEFAULT_SITE_CONFIG.overview, ...(userConfig.overview || {}) },
    homepage: { ...DEFAULT_SITE_CONFIG.homepage, ...(userConfig.homepage || {}) },
    featuredListings: { ...DEFAULT_SITE_CONFIG.featuredListings, ...(userConfig.featuredListings || {}) },
    navbar: { ...DEFAULT_SITE_CONFIG.navbar, ...(userConfig.navbar || {}) },
    footer: { ...DEFAULT_SITE_CONFIG.footer, ...(userConfig.footer || {}) },
    buyPage: { ...DEFAULT_SITE_CONFIG.buyPage, ...(userConfig.buyPage || {}) },
    rentPage: { ...DEFAULT_SITE_CONFIG.rentPage, ...(userConfig.rentPage || {}) },
    sellPage: { ...DEFAULT_SITE_CONFIG.sellPage, ...(userConfig.sellPage || {}) },
    categories: (Array.isArray(userConfig.categories) && userConfig.categories.length > 0)
      ? userConfig.categories
      : DEFAULT_SITE_CONFIG.categories,
    faqs: (Array.isArray(userConfig.faqs) && userConfig.faqs.length > 0)
      ? userConfig.faqs
      : (Array.isArray(userConfig.faq) && userConfig.faq.length > 0 ? userConfig.faq : DEFAULT_SITE_CONFIG.faqs),
    contact: { ...DEFAULT_SITE_CONFIG.contact, ...(userConfig.contact || {}) },
    branding: { ...DEFAULT_SITE_CONFIG.branding, ...(userConfig.branding || {}) },
    theme: { ...DEFAULT_SITE_CONFIG.theme, ...(userConfig.theme || {}) },
    media: { ...DEFAULT_SITE_CONFIG.media, ...(userConfig.media || {}) },
    mapsConfig: { ...DEFAULT_SITE_CONFIG.mapsConfig, ...(userConfig.mapsConfig || {}) },
    seo: { ...DEFAULT_SITE_CONFIG.seo, ...(userConfig.seo || {}) },
    publish: { ...DEFAULT_SITE_CONFIG.publish, ...(userConfig.publish || {}) }
  };
  return sanitizeSiteConfig(merged);
};

let rawUsers = getStoredData('easeland_registered_users', INITIAL_USERS);
let registeredUsers = rawUsers.filter(u => u && u.status !== 'DELETED' && u.isCustomRegistered);

setStoredData('easeland_registered_users', registeredUsers);

// Auto-scrub stale zero-agent/zero-commission siteConfig from localStorage
if (typeof window !== 'undefined') {
  try {
    const rawConfig = localStorage.getItem('easeland_site_config');
    if (rawConfig && (
      rawConfig.includes('Zero agents') ||
      rawConfig.includes('Zero commission') ||
      rawConfig.includes('Zero brokerage') ||
      rawConfig.includes('zero brokerage') ||
      rawConfig.includes('zero broker') ||
      rawConfig.includes('Accurate plot boundaries')
    )) {
      localStorage.removeItem('easeland_site_config');
    }
  } catch (e) {}
}

let siteConfig = mergeSiteConfigWithDefaults(getStoredData('easeland_site_config', DEFAULT_SITE_CONFIG));
setStoredData('easeland_site_config', siteConfig);

export const mockApi = {
  // -------------------------------------------------------------
  // 1. PUBLIC PROPERTY APIS (Strict Enforcement: APPROVED_LIVE only & No Duplicates)
  // -------------------------------------------------------------
  getPublicProperties: (filters = {}) => {
    // Clear All Enforcement: Return empty array if user cleared filters until they filter or search again
    if (filters.cleared) {
      return [];
    }

    let localProps = [];
    let deletedIds = [];
    let adminDeletedList = [];
    try {
      if (typeof window !== 'undefined') {
        const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties', 'easeland_submitted_properties'];
        keys.forEach(k => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) localProps.push(...parsed);
            else if (parsed && typeof parsed === 'object') localProps.push(parsed);
          }
        });
        const delRaw = localStorage.getItem('easeland_deleted_properties');
        if (delRaw) deletedIds = JSON.parse(delRaw).map(v => String(v).toLowerCase().trim());
        const adminDelRaw = localStorage.getItem('easeland_admin_deleted_properties');
        if (adminDelRaw) adminDeletedList = JSON.parse(adminDelRaw);
      }
    } catch (e) {}

    const isDeletedProp = (p) => {
      if (!p) return true;
      if (p.isDeleted === true || p.deletedByAdmin === true) return true;
      const st = String(p.status || p.listingStatus || '').toUpperCase();
      const lst = String(p.listingStatus || '').toUpperCase();
      if (st === 'DELETED' || st === 'DELETED_BY_ADMIN' || lst === 'DELETED' || lst === 'DELETED_BY_ADMIN') return true;

      const pId1 = String(p.id || '').toLowerCase().trim();
      const pId2 = String(p.propertyId || '').toLowerCase().trim();
      const pId3 = String(p.referenceId || '').toLowerCase().trim();
      const num1 = pId1.replace(/^(el-prop-|prop-)/, '');
      const num2 = pId2.replace(/^(el-prop-|prop-)/, '');
      const num3 = pId3.replace(/^(el-prop-|prop-)/, '');
      const normTitle = String(p.title || '').toLowerCase().trim();

      const inDeletedIds = deletedIds.some(d => {
        const dStr = String(d || '').toLowerCase().trim();
        const dNum = dStr.replace(/^(el-prop-|prop-)/, '');
        return (
          (dStr && (dStr === pId1 || dStr === pId2 || dStr === pId3)) ||
          (dNum && ((num1 && dNum === num1) || (num2 && dNum === num2) || (num3 && dNum === num3))) ||
          (normTitle && dStr === normTitle)
        );
      });
      if (inDeletedIds) return true;

      const inAdminDel = adminDeletedList.some(item => {
        if (!item) return false;
        const iId1 = String(item.id || '').toLowerCase().trim();
        const iId2 = String(item.propertyId || '').toLowerCase().trim();
        const iId3 = String(item.referenceId || '').toLowerCase().trim();
        const iNum1 = iId1.replace(/^(el-prop-|prop-)/, '');
        const iNum2 = iId2.replace(/^(el-prop-|prop-)/, '');
        const iTitle = String(item.title || '').toLowerCase().trim();
        return (
          (iId1 && (iId1 === pId1 || iId1 === pId2 || iId1 === pId3)) ||
          (iId2 && (iId2 === pId1 || iId2 === pId2 || iId2 === pId3)) ||
          (iId3 && (iId3 === pId1 || iId3 === pId2 || iId3 === pId3)) ||
          (iNum1 && ((num1 && iNum1 === num1) || (num2 && iNum1 === num2) || (num3 && iNum1 === num3))) ||
          (iNum2 && ((num1 && iNum2 === num1) || (num2 && iNum2 === num2) || (num3 && iNum2 === num3))) ||
          (iTitle && normTitle && iTitle === normTitle)
        );
      });
      return inAdminDel;
    };

    const baseList = (typeof mockApi !== 'undefined' && typeof mockApi.getProperties === 'function')
      ? mockApi.getProperties()
      : properties;
    const combined = [...INITIAL_PROPERTIES, ...baseList, ...localProps];
    const candidateMap = new Map();
    combined.forEach(p => {
      if (!p || isDeletedProp(p)) return;
      const pId = String(p.id || p.propertyId || p.referenceId || '');
      if (pId) {
        const existing = candidateMap.get(pId);
        if (!existing) {
          candidateMap.set(pId, { ...p });
        } else {
          const exSt = String(existing.status || existing.listingStatus || '').toUpperCase();
          const newSt = String(p.status || p.listingStatus || '').toUpperCase();
          const exVst = String(existing.verificationStatus || '').toUpperCase();
          const newVst = String(p.verificationStatus || '').toUpperCase();
          const isNewLive = newSt === 'LIVE' || newSt === 'APPROVED_LIVE' || newSt === 'APPROVED' || newSt === 'PLATFORM VERIFIED' || newVst === 'PLATFORM VERIFIED' || newVst === 'VERIFIED' || p.isPlatformVerified === true || p.isPublished === true;
          const isExLive = exSt === 'LIVE' || exSt === 'APPROVED_LIVE' || exSt === 'APPROVED' || exSt === 'PLATFORM VERIFIED' || exVst === 'PLATFORM VERIFIED' || exVst === 'VERIFIED' || existing.isPlatformVerified === true || existing.isPublished === true;

          const merged = { ...existing, ...p };
          if (isExLive || isNewLive) {
            merged.status = 'LIVE';
            merged.listingStatus = 'LIVE';
            merged.isPlatformVerified = true;
            merged.isPublished = true;
            merged.verificationStatus = 'Platform Verified';
          }
          candidateMap.set(pId, merged);
        }
      }
    });

    let allProps = Array.from(candidateMap.values());
    let result = allProps.filter(p => {
      if (!p) return false;
      const st = String(p.status || p.listingStatus || '').toUpperCase();
      const lst = String(p.listingStatus || '').toUpperCase();
      const vst = String(p.verificationStatus || '').toUpperCase();

      const isLive = (st === 'LIVE' || st === 'APPROVED_LIVE' || st === 'APPROVED' || lst === 'LIVE' || lst === 'APPROVED_LIVE' || lst === 'APPROVED' || p.isPublished === true);
      const isVerified = (p.isPlatformVerified === true || vst === 'PLATFORM VERIFIED' || vst === 'VERIFIED' || vst === 'APPROVED');
      const isBlocked = (st === 'REJECTED' || st === 'DRAFT' || st === 'PENDING' || st === 'PENDING_VERIFICATION' || lst === 'REJECTED' || lst === 'DRAFT' || lst === 'PENDING' || lst === 'PENDING_VERIFICATION' || st === 'CHANGES_REQUIRED');

      // Strict Enforcement: Exclude unverified drafts or pending submissions from public verified listings
      if (isBlocked && !p.isPlatformVerified) return false;
      if (!isLive && !isVerified) return false;
      return true;
    });
    result = deduplicateProperties(result);

    // Natural Language Query Extraction for Casual Searches
    let effectiveFilters = filters;
    if (filters.query && typeof filters.query === 'string' && filters.query.trim().toLowerCase() !== 'near me') {
      const parsed = parseNaturalLanguageQuery(filters.query);
      effectiveFilters = {
        ...parsed,
        ...filters,
        maxPrice: (filters.maxPrice != null && filters.maxPrice !== '') ? filters.maxPrice : parsed.maxPrice,
        minPrice: (filters.minPrice != null && filters.minPrice !== '') ? filters.minPrice : parsed.minPrice,
        propertyType: (filters.propertyType && filters.propertyType !== 'ALL') ? filters.propertyType : parsed.propertyType,
        purpose: (filters.purpose && filters.purpose !== 'ALL') ? filters.purpose : parsed.purpose,
        cleanKeywords: filters.cleanKeywords !== undefined ? filters.cleanKeywords : parsed.cleanKeywords
      };
    }

    // Category Filter
    if (effectiveFilters.category && effectiveFilters.category !== 'All') {
      const targetCat = String(effectiveFilters.category).toLowerCase().trim();
      result = result.filter(p => {
        if (!p) return false;
        const pBadge = String(getCategoryBadgeLabel(p)).toLowerCase();
        if (pBadge === targetCat) return true;
        const pCat = String(p.category || '').toLowerCase();
        const pType = String(p.propertyType || '').toLowerCase();
        const pTitle = String(p.title || '').toLowerCase();
        if (pCat === targetCat || pType === targetCat) return true;

        if (targetCat.includes('amaravathi') || targetCat.includes('lps')) {
          return pCat.includes('amaravathi') || pTitle.includes('amaravathi') || pCat.includes('lps') || pTitle.includes('lps');
        }
        if (targetCat.includes('agricultural') || targetCat.includes('farm')) {
          return pCat.includes('agri') || pType.includes('land') || pTitle.includes('agri') || pTitle.includes('farm');
        }
        if (targetCat.includes('commercial') || targetCat.includes('commeric')) {
          return pCat.includes('commercial') || pCat.includes('commeric') || pType.includes('commercial') || pCat.includes('shop') || pCat.includes('office') || pTitle.includes('shop') || pTitle.includes('office');
        }
        if (targetCat.includes('apartment') || targetCat.includes('flat')) {
          return pCat.includes('apartment') || pCat.includes('flat') || pType === 'apartment' || pTitle.includes('apartment') || pTitle.includes('flat');
        }
        if (targetCat.includes('house') || targetCat.includes('villa') || targetCat.includes('independent')) {
          return pCat.includes('house') || pCat.includes('villa') || pType === 'house' || pType === 'villa' || pTitle.includes('house') || pTitle.includes('villa');
        }
        if (targetCat.includes('city') && targetCat.includes('plot')) {
          const isPlot = pType.includes('plot') || pCat.includes('plot');
          const isCity = pCat.includes('city') || pTitle.includes('city') || pCat.includes('colony') || pTitle.includes('colony');
          const isAmaravathi = pCat.includes('amaravathi') || pTitle.includes('amaravathi') || pCat.includes('lps') || pTitle.includes('lps');
          return isPlot && isCity && !isAmaravathi;
        }
        if (targetCat.includes('venture')) {
          const isPlot = pType.includes('plot') || pCat.includes('plot') || pCat.includes('venture') || pTitle.includes('venture');
          const isAmaravathi = pCat.includes('amaravathi') || pTitle.includes('amaravathi') || pCat.includes('lps') || pTitle.includes('lps');
          const isCity = pBadge === 'open plot (city)' || (pCat.includes('city') && !pCat.includes('venture'));
          return isPlot && !isAmaravathi && !isCity;
        }
        if (targetCat.includes('other')) {
          return pType.includes('other') || pCat.includes('other') || pCat.includes('warehouse') || pTitle.includes('warehouse');
        }
        return false;
      });
    }

    // Property Type Filter (Structured or NLP Inferred)
    if (effectiveFilters.propertyType && effectiveFilters.propertyType !== 'ALL' && effectiveFilters.propertyType !== 'ANY') {
      const targetType = String(effectiveFilters.propertyType).toUpperCase();
      result = result.filter(p => {
        const pType = String(p.propertyType || '').toUpperCase();
        const pCat = String(p.category || '').toUpperCase();
        if (targetType === 'LAND') {
          return pType.includes('LAND') || pCat.includes('LAND') || pCat.includes('AGRI') || pCat.includes('FARM');
        }
        if (targetType === 'OPEN_PLOT') {
          return pType.includes('PLOT') || (pCat.includes('PLOT') && !pCat.includes('COMMERCIAL'));
        }
        if (targetType === 'APARTMENT') {
          return pType.includes('APARTMENT') || pType.includes('FLAT') || pCat.includes('APARTMENT') || pCat.includes('FLAT');
        }
        if (targetType === 'HOUSE' || targetType === 'VILLA') {
          return pType.includes('HOUSE') || pType.includes('VILLA') || pCat.includes('HOUSE') || pCat.includes('VILLA');
        }
        if (targetType === 'COMMERCIAL') {
          return pType.includes('COMMERCIAL') || pCat.includes('COMMERCIAL') || pCat.includes('OFFICE') || pCat.includes('SHOP');
        }
        return true;
      });
    }

    // Purpose Filter (buy vs rent)
    if (effectiveFilters.purpose && effectiveFilters.purpose !== 'ALL' && effectiveFilters.purpose !== 'ANY') {
      const targetPurp = String(effectiveFilters.purpose).toLowerCase();
      result = result.filter(p => {
        const pPurp = String(p.purpose || 'sale').toLowerCase();
        if (targetPurp === 'rent') return pPurp.includes('rent');
        if (targetPurp === 'sale') return pPurp.includes('sale') || (!pPurp.includes('rent') && !pPurp.includes('lease'));
        return true;
      });
    }

    // Deep 12-Tier Spatial & Multi-Token Text Search Query Engine
    const rawQuery = (effectiveFilters.query || effectiveFilters.address || '').toLowerCase().trim();
    if (rawQuery) {
      if (rawQuery === 'near me' || rawQuery.includes('near me')) {
        if (effectiveFilters.userLat && effectiveFilters.userLng) {
          result.sort((a, b) => {
            const latA = a.location?.lat || 0;
            const lngA = a.location?.lng || 0;
            const latB = b.location?.lat || 0;
            const lngB = b.location?.lng || 0;
            const distA = Math.hypot(latA - effectiveFilters.userLat, lngA - effectiveFilters.userLng);
            const distB = Math.hypot(latB - effectiveFilters.userLat, lngB - effectiveFilters.userLng);
            return distA - distB;
          });
        }
      } else if (rawQuery === 'india' || rawQuery.includes('india')) {
        // Return all Indian properties
      } else {
        let tokens = [];
        if (effectiveFilters.cleanKeywords !== undefined) {
          tokens = effectiveFilters.cleanKeywords ? effectiveFilters.cleanKeywords.toLowerCase().split(/\s+/).filter(Boolean) : [];
        } else {
          tokens = rawQuery
            .split(/[\s,/\-]+/)
            .map(t => t.trim())
            .filter(t => t.length > 1 && !REAL_ESTATE_STOPWORDS.has(t) && !/^\d+$/.test(t));
        }

        if (tokens.length > 0) {
          result = result.filter(p => {
            const loc = p.location || {};
            const searchableBlob = [
              p.title,
              p.description,
              p.category,
              p.propertyType,
              p.facing,
              p.priceDisplay,
              loc.country,
              loc.state,
              loc.district,
              loc.city,
              loc.mandal,
              loc.taluk,
              loc.tehsil,
              loc.locality,
              loc.subLocality,
              loc.village,
              loc.road,
              loc.street,
              loc.colony,
              loc.layout,
              loc.landmark,
              loc.doorNo,
              loc.address,
              Array.isArray(p.amenities) ? p.amenities.join(' ') : ''
            ].filter(Boolean).join(' ').toLowerCase();

            // Direct exact phrase check
            if (searchableBlob.includes(rawQuery)) return true;

            // Multi-token match: EVERY search keyword token (or its semantic synonyms) must match searchableBlob
            return tokens.every(token => {
              const syns = getSemanticSynonyms(token);
              return syns.some(syn => searchableBlob.includes(syn));
            });
          });
        }
      }
    }

    // Price Filter Range
    if (effectiveFilters.minPrice) result = result.filter(p => p.price >= Number(effectiveFilters.minPrice));
    if (effectiveFilters.maxPrice) result = result.filter(p => p.price <= Number(effectiveFilters.maxPrice));

    // Area Filter Range
    if (effectiveFilters.minArea) result = result.filter(p => p.area >= Number(effectiveFilters.minArea));
    if (effectiveFilters.maxArea) result = result.filter(p => p.area <= Number(effectiveFilters.maxArea));

    // Specific Filters
    if (effectiveFilters.bedrooms && effectiveFilters.bedrooms !== 'Any' && effectiveFilters.bedrooms !== 'ANY') {
      const beds = parseInt(effectiveFilters.bedrooms);
      if (!isNaN(beds)) {
        result = result.filter(p => (Number(p.bedrooms || p.bhk || 0)) >= beds);
      }
    }
    if (effectiveFilters.cornerPlot) result = result.filter(p => p.cornerPlot === true);
    if (effectiveFilters.gatedCommunity) result = result.filter(p => p.gatedCommunity === true);

    if (effectiveFilters.furnishing && effectiveFilters.furnishing !== 'ALL' && effectiveFilters.furnishing !== 'ANY') {
      const targetFurn = normalizeFurnishing(effectiveFilters.furnishing);
      if (targetFurn) {
        result = result.filter(p => {
          const raw = p.specs?.furnishing || p.specs?.furnishingStatus || p.specifications?.furnishing || p.specifications?.furnishingStatus || p.furnishing || p.furnishingStatus || '';
          return normalizeFurnishing(raw) === targetFurn;
        });
      }
    }

    if (effectiveFilters.facing && effectiveFilters.facing !== 'ALL' && effectiveFilters.facing !== 'ANY') {
      const targetFacing = normalizeFacing(effectiveFilters.facing);
      if (targetFacing) {
        result = result.filter(p => {
          const raw = p.facing || p.specs?.facing || p.specifications?.facing || '';
          return normalizeFacing(raw) === targetFacing;
        });
      }
    }

    // Location Filters (State, District, City, Locality)
    if (filters.state && filters.state.trim()) {
      const stateVal = filters.state.toLowerCase().trim();
      result = result.filter(p => {
        const loc = p.location || {};
        const stateBlob = [loc.state, p.state].filter(Boolean).join(' ').toLowerCase();
        return stateBlob.includes(stateVal);
      });
    }

    if (filters.district && filters.district.trim()) {
      const distVal = filters.district.toLowerCase().trim();
      result = result.filter(p => {
        const loc = p.location || {};
        const distBlob = [loc.district, p.district].filter(Boolean).join(' ').toLowerCase();
        return distBlob.includes(distVal);
      });
    }

    if (filters.city && filters.city.trim()) {
      const cityVal = filters.city.toLowerCase().trim();
      result = result.filter(p => {
        const loc = p.location || {};
        const cityBlob = [
          loc.city, loc.mandal, loc.address, loc.locality,
          p.city, p.title, p.address
        ].filter(Boolean).join(' ').toLowerCase();
        return cityBlob.includes(cityVal);
      });
    }

    if (filters.locality && filters.locality.trim()) {
      const locClean = filters.locality.toLowerCase().trim();
      const locTokens = locClean.split(/[\s,]+/).filter(tok => tok.length > 1);
      result = result.filter(p => {
        const loc = p.location || {};
        const locBlob = [
          loc.locality, loc.subLocality, loc.colony, loc.mandal, loc.village,
          loc.road, loc.street, loc.layout, loc.landmark, loc.address, loc.formattedAddress,
          p.locality, p.address, p.title, p.description
        ].filter(Boolean).join(' ').toLowerCase();

        if (locBlob.includes(locClean)) return true;
        if (locTokens.length > 0) {
          return locTokens.every(tok => locBlob.includes(tok));
        }
        return false;
      });
    }

    return result;
  },

  getProperties: () => properties,

  getPropertyById: (id) => {
    if (!id) return null;
    const targetIdStr = String(id);
    let localProps = [];
    try {
      if (typeof window !== 'undefined') {
        const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties', 'easeland_submitted_properties'];
        keys.forEach(k => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) localProps.push(...parsed);
            else if (parsed && typeof parsed === 'object') localProps.push(parsed);
          }
        });
      }
    } catch (e) {}
    return [...properties, ...localProps].filter(p => !isFakeProperty(p)).find(p => p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr)) || null;
  },

  // -------------------------------------------------------------
  // 2. OWNER PROPERTY APIS
  // -------------------------------------------------------------
  createOwnerListing: (newPropertyPayload, isDraft = false) => {
    const freshProps = getStoredData('easeland_properties', properties);
    const newId = newPropertyPayload.id || newPropertyPayload.propertyId || ('prop-' + Date.now());

    const ownerObj = newPropertyPayload.owner || {
      id: newPropertyPayload.ownerId || 'owner_default',
      name: newPropertyPayload.ownerPublicName || 'Property Owner',
      email: newPropertyPayload.ownerPrivateEmail || ''
    };

    const pType = String(newPropertyPayload.propertyType || 'OPEN_PLOT').toUpperCase();
    const isPlotOrLand = ['OPEN_PLOT', 'LAND', 'AGRICULTURAL_LAND', 'COMMERCIAL_LAND'].includes(pType) || pType.includes('PLOT');
    const existingFurn = newPropertyPayload.specs?.furnishing || newPropertyPayload.furnishing;
    const defaultFurn = (!isPlotOrLand && !existingFurn) ? 'Unfurnished' : existingFurn;

    const targetProp = {
      ...newPropertyPayload,
      id: newId,
      propertyId: newId,
      referenceId: newPropertyPayload.referenceId || `EL-PROP-${Math.floor(10000 + Math.random() * 90000)}`,
      title: newPropertyPayload.title || 'Submitted Property Listing',
      price: Number(newPropertyPayload.price) || 0,
      priceDisplay: newPropertyPayload.priceDisplay || `Rs. ${newPropertyPayload.price || 0}`,
      area: Number(newPropertyPayload.area) || 0,
      areaDisplay: newPropertyPayload.areaDisplay || `${newPropertyPayload.area || 0} sq ft`,
      location: newPropertyPayload.location || {},
      propertyType: newPropertyPayload.propertyType || 'OPEN_PLOT',
      purpose: newPropertyPayload.purpose || 'SALE',
      specs: {
        ...(newPropertyPayload.specs || {}),
        ...(defaultFurn ? { furnishing: newPropertyPayload.specs?.furnishing || defaultFurn } : {})
      },
      furnishing: defaultFurn || newPropertyPayload.furnishing,
      status: isDraft ? 'DRAFT' : 'PENDING_VERIFICATION',
      listingStatus: isDraft ? 'DRAFT' : 'PENDING_VERIFICATION',
      verificationStatus: isDraft ? 'Draft' : 'Pending Admin Verification',
      isPlatformVerified: false,
      isPublished: false,
      ownerId: newPropertyPayload.ownerId || ownerObj.id,
      ownerPrivateEmail: newPropertyPayload.ownerPrivateEmail || ownerObj.email,
      owner: ownerObj,
      isUserSubmitted: true,
      createdAt: newPropertyPayload.createdAt || new Date().toISOString()
    };

    const newRefId = newPropertyPayload.referenceId;
    const existingIndex = freshProps.findIndex(
      p => p && (
        (newId && (String(p.id) === String(newId) || String(p.propertyId) === String(newId))) ||
        (newRefId && String(p.referenceId) === String(newRefId)) ||
        (p.title && newPropertyPayload.title && p.title.toLowerCase().trim() === newPropertyPayload.title.toLowerCase().trim())
      )
    );

    if (existingIndex !== -1) {
      const existing = freshProps[existingIndex];
      const isExistingLive = Boolean(
        newPropertyPayload.isAlreadyLive === true ||
        (existing && (
          existing.status === 'LIVE' || existing.listingStatus === 'LIVE' ||
          existing.status === 'APPROVED' || existing.listingStatus === 'APPROVED' ||
          existing.status === 'APPROVED_LIVE' ||
          existing.verificationStatus === 'Platform Verified' ||
          existing.isPlatformVerified || existing.isPublished
        ))
      );

      const isAdminApproval = Boolean(
        newPropertyPayload.adminVerified === true ||
        newPropertyPayload.isAdminApproval === true ||
        (newPropertyPayload.isPlatformVerified === true && newPropertyPayload.hasPendingEdits === false && !newPropertyPayload.pendingReauditData && !newPropertyPayload.reAuditStatus)
      );

      if (isExistingLive && !isAdminApproval) {
        // The property is verified & LIVE. Incoming payload is an owner modification or draft step.
        // Under NO circumstances overwrite root live approved details visible to public!
        // Stage updates into pendingReauditData while keeping approved root fields intact.
        const incomingProposed = newPropertyPayload.pendingReauditData || newPropertyPayload.pendingEdits || newPropertyPayload;
        const existingPending = existing.pendingReauditData || existing.pendingEdits || {};
        const cleanProposed = {};
        const protectedKeys = [
          'id', 'propertyId', 'referenceId', 'ownerId', 'listingStatus', 'status',
          'isPublished', 'isPlatformVerified', 'verificationStatus', 'createdAt', 'views', 'enquiriesCount'
        ];
        for (const [k, v] of Object.entries(incomingProposed)) {
          if (!protectedKeys.includes(k) && v !== undefined && v !== null && v !== '') {
            cleanProposed[k] = v;
          }
        }
        const mergedPending = {
          ...existingPending,
          ...cleanProposed,
          updatedAt: new Date().toISOString()
        };

        const preservedLiveProp = {
          ...existing, // 100% retain approved live root fields!
          hasPendingEdits: true,
          reAuditStatus: 'PENDING_VERIFICATION',
          reAuditRequestedAt: existing.reAuditRequestedAt || new Date().toISOString(),
          pendingReauditData: mergedPending,
          status: 'LIVE',
          listingStatus: 'LIVE',
          isPublished: true,
          isPlatformVerified: true,
          verificationStatus: existing.verificationStatus || 'Platform Verified'
        };

        freshProps[existingIndex] = preservedLiveProp;
        properties = freshProps.filter(p => !isFakeProperty(p));
        setStoredData('easeland_properties', properties);
        if (typeof window !== 'undefined') {
          const userPropsRaw = localStorage.getItem('easeland_user_properties');
          if (userPropsRaw) {
            try {
              const parsed = JSON.parse(userPropsRaw);
              if (Array.isArray(parsed)) {
                const uIdx = parsed.findIndex(p => p && (String(p.id) === String(newId) || String(p.propertyId) === String(newId)));
                if (uIdx !== -1) {
                  parsed[uIdx] = preservedLiveProp;
                  localStorage.setItem('easeland_user_properties', JSON.stringify(parsed));
                }
              }
            } catch (e) {}
          }
          window.dispatchEvent(new CustomEvent('easeland-property-updated', { detail: preservedLiveProp }));
        }
        return preservedLiveProp;
      }

      freshProps[existingIndex] = { ...freshProps[existingIndex], ...targetProp };
    } else {
      freshProps.unshift(targetProp);
    }

    properties = freshProps.filter(p => !isFakeProperty(p));
    setStoredData('easeland_properties', properties);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-property-created', { detail: targetProp }));
      window.dispatchEvent(new CustomEvent('easeland-property-submitted', { detail: targetProp }));
    }
    return targetProp;
  },

  addProperty: function (payload, isDraft = false) {
    return this.createOwnerListing(payload, isDraft);
  },

  getMyProperties: (ownerId, ownerEmail) => {
    const targetEmail = (ownerEmail || '').toLowerCase().trim();
    const targetId = ownerId ? String(ownerId).toLowerCase().trim() : '';

    let localProps = [];
    try {
      if (typeof window !== 'undefined') {
        const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties', 'easeland_submitted_properties'];
        keys.forEach(k => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) localProps.push(...parsed);
            else if (parsed && typeof parsed === 'object') localProps.push(parsed);
          }
        });
      }
    } catch (e) {}

    const allPropsMap = new Map();
    [...properties, ...localProps].forEach(p => {
      if (!p || isFakeProperty(p)) return;
      const pId = String(p.id || p.propertyId || p.referenceId || '');
      if (pId) {
        const existing = allPropsMap.get(pId) || {};
        const isLive = Boolean(
          p.status === 'LIVE' || p.listingStatus === 'LIVE' || p.status === 'APPROVED' || p.listingStatus === 'APPROVED' || p.status === 'APPROVED_LIVE' ||
          p.verificationStatus === 'Platform Verified' || p.verificationStatus === 'PLATFORM VERIFIED' || p.isPlatformVerified || p.isPublished ||
          existing.status === 'LIVE' || existing.listingStatus === 'LIVE' || existing.status === 'APPROVED' || existing.listingStatus === 'APPROVED' || existing.status === 'APPROVED_LIVE' ||
          existing.verificationStatus === 'Platform Verified' || existing.verificationStatus === 'PLATFORM VERIFIED' || existing.isPlatformVerified || existing.isPublished
        );
        const resolvedStatus = isLive ? 'LIVE' : (p.status || existing.status || 'DRAFT');
        const resolvedListingStatus = isLive ? 'LIVE' : (p.listingStatus || existing.listingStatus || 'DRAFT');
        const resolvedVerStatus = isLive ? 'Platform Verified' : (p.verificationStatus || existing.verificationStatus || 'Pending Admin Verification');

        allPropsMap.set(pId, {
          ...existing,
          ...p,
          status: resolvedStatus,
          listingStatus: resolvedListingStatus,
          verificationStatus: resolvedVerStatus,
          isPlatformVerified: isLive || Boolean(p.isPlatformVerified || existing.isPlatformVerified),
          isPublished: isLive || Boolean(p.isPublished || existing.isPublished)
        });
      }
    });

    let deletedIds = [];
    try {
      if (typeof window !== 'undefined') {
        const rawDel = localStorage.getItem('easeland_deleted_properties');
        if (rawDel) deletedIds = JSON.parse(rawDel);
      }
    } catch (e) {}

    const mergedProps = Array.from(allPropsMap.values()).filter(p => p && !isFakeProperty(p) && !deletedIds.includes(String(p.id || p.propertyId)));

    const isAdmin = targetEmail === 'admin@easeland.in' || targetEmail.includes('admin') || targetId === 'admin_uid_001' || targetId === 'admin-101';

    return mergedProps.filter(p => {
      if (!p || isFakeProperty(p)) return false;
      const pOwnerId = String(p.ownerId || p.owner?.id || p.userId || p.uid || p.submittedBy || p.createdBy || '').toLowerCase().trim();
      const pOwnerEmail = (p.ownerPrivateEmail || p.ownerPublicEmail || p.owner?.email || p.email || p.userEmail || '').toLowerCase().trim();

      if (targetId && pOwnerId && pOwnerId === targetId) return true;
      if (targetEmail && pOwnerEmail && pOwnerEmail === targetEmail) return true;
      if (isAdmin && (pOwnerEmail.includes('admin') || p.ownerPublicName === 'EaseLand Admin')) return true;
      return false;
    });
  },

  submitDraftForVerification: (propertyId) => {
    const currentProps = getStoredData('easeland_properties', properties);
    const prop = currentProps.find(p => (p.id === propertyId || p.propertyId === propertyId));
    if (prop) {
      prop.status = 'PENDING_VERIFICATION';
      prop.listingStatus = 'PENDING_VERIFICATION';
      prop.verificationStatus = 'Pending Admin Verification';
      setStoredData('easeland_properties', currentProps.filter(p => !isFakeProperty(p)));
    }
    return prop;
  },

  approvePropertyAdmin: (propertyId, notes = '') => {
    if (!propertyId) return false;
    const pIdStr = String(propertyId);
    const noteText = notes || 'Verified & Approved by EaseLand Senior Admin Auditor.';

    // 1. Update in-memory properties array
    properties = properties.map(p => {
      if (p && (String(p.id) === pIdStr || String(p.propertyId) === pIdStr || String(p.referenceId) === pIdStr)) {
        return {
          ...p,
          status: 'LIVE',
          listingStatus: 'LIVE',
          verificationStatus: 'Platform Verified',
          isPlatformVerified: true,
          isPublished: true,
          verifiedDate: new Date().toISOString(),
          verificationNotes: noteText,
          ownerFacingNotes: noteText,
          adminNotes: noteText
        };
      }
      return p;
    });

    // 2. Update ALL localStorage keys
    if (typeof window !== 'undefined') {
      const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties', 'easeland_submitted_properties'];
      keys.forEach(k => {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const updated = parsed.map(p => {
                if (p && (String(p.id) === pIdStr || String(p.propertyId) === pIdStr || String(p.referenceId) === pIdStr)) {
                  return {
                    ...p,
                    status: 'LIVE',
                    listingStatus: 'LIVE',
                    verificationStatus: 'Platform Verified',
                    isPlatformVerified: true,
                    isPublished: true,
                    verifiedDate: new Date().toISOString(),
                    verificationNotes: noteText,
                    ownerFacingNotes: noteText,
                    adminNotes: noteText
                  };
                }
                return p;
              });
              localStorage.setItem(k, JSON.stringify(updated));
            }
          }
        } catch (e) {}
      });
    }

    setStoredData('easeland_properties', properties.filter(p => !isFakeProperty(p)));
    return true;
  },

  rejectPropertyAdmin: (propertyId, notes = '') => {
    if (!propertyId) return false;
    const pIdStr = String(propertyId);
    const noteText = notes || 'Listing rejected by platform admin auditor.';

    properties = properties.map(p => {
      if (p && (String(p.id) === pIdStr || String(p.propertyId) === pIdStr || String(p.referenceId) === pIdStr)) {
        return {
          ...p,
          status: 'REJECTED',
          listingStatus: 'REJECTED',
          verificationStatus: 'Rejected',
          isPlatformVerified: false,
          isPublished: false,
          verificationNotes: noteText,
          rejectionReason: noteText
        };
      }
      return p;
    });

    if (typeof window !== 'undefined') {
      const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties', 'easeland_submitted_properties'];
      keys.forEach(k => {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const updated = parsed.map(p => {
                if (p && (String(p.id) === pIdStr || String(p.propertyId) === pIdStr || String(p.referenceId) === pIdStr)) {
                  return {
                    ...p,
                    status: 'REJECTED',
                    listingStatus: 'REJECTED',
                    verificationStatus: 'Rejected',
                    isPlatformVerified: false,
                    isPublished: false,
                    verificationNotes: noteText,
                    rejectionReason: noteText
                  };
                }
                return p;
              });
              localStorage.setItem(k, JSON.stringify(updated));
            }
          }
        } catch (e) {}
      });
    }

    setStoredData('easeland_properties', properties.filter(p => !isFakeProperty(p)));
    return true;
  },

  deleteProperty: (propertyId, propertyObj = null, isAdmin = true) => {
    if (!propertyId && !propertyObj) return false;
    const pIdStr = String(propertyId || propertyObj?.id || propertyObj?.propertyId || '');
    const id2 = String(propertyObj?.propertyId || '');
    const id3 = String(propertyObj?.referenceId || '');
    const num1 = pIdStr.replace(/^(el-prop-|prop-)/i, '');
    const num2 = id2.replace(/^(el-prop-|prop-)/i, '');
    const num3 = id3.replace(/^(el-prop-|prop-)/i, '');
    const normTitle = String(propertyObj?.title || '').toLowerCase().trim();

    const allAliases = new Set([
      pIdStr.toLowerCase(),
      id2.toLowerCase(),
      id3.toLowerCase(),
      num1 ? `el-prop-${num1}`.toLowerCase() : '',
      num1 ? `prop-${num1}`.toLowerCase() : '',
      num1 ? num1.toLowerCase() : '',
      num2 ? `el-prop-${num2}`.toLowerCase() : '',
      num2 ? num2.toLowerCase() : '',
      num3 ? `el-prop-${num3}`.toLowerCase() : '',
      num3 ? num3.toLowerCase() : ''
    ].filter(Boolean));

    const matchesAlias = (p) => {
      if (!p) return false;
      const pid = String(p.id || '').toLowerCase().trim();
      const ppid = String(p.propertyId || '').toLowerCase().trim();
      const pref = String(p.referenceId || '').toLowerCase().trim();
      const pnum = pid.replace(/^(el-prop-|prop-)/i, '');
      const ptitle = String(p.title || '').toLowerCase().trim();

      return (
        allAliases.has(pid) ||
        allAliases.has(ppid) ||
        allAliases.has(pref) ||
        (pnum && allAliases.has(pnum)) ||
        (normTitle && ptitle && ptitle === normTitle)
      );
    };

    // 1. Remove from in-memory properties array
    for (let i = properties.length - 1; i >= 0; i--) {
      if (matchesAlias(properties[i])) {
        properties.splice(i, 1);
      }
    }

    // 2. Remove/update in stored easeland_properties in localStorage
    const currentProps = getStoredData('easeland_properties', properties);
    const updatedProps = currentProps.map(p => {
      if (matchesAlias(p)) {
        if (isAdmin) {
          return {
            ...p,
            status: 'DELETED_BY_ADMIN',
            listingStatus: 'DELETED_BY_ADMIN',
            deletedByAdmin: true,
            isDeleted: true,
            isPublished: false,
            adminFeedback: 'Notification: Deleted by Admin',
            adminNotes: 'Deleted by Admin'
          };
        }
        return null;
      }
      return p;
    }).filter(Boolean);
    setStoredData('easeland_properties', updatedProps);

    // 3. Track deleted IDs & admin deletion metadata in localStorage
    try {
      if (typeof window !== 'undefined') {
        const rawUserProps = localStorage.getItem('easeland_user_properties');
        if (rawUserProps) {
          const parsed = JSON.parse(rawUserProps);
          const updatedUserProps = parsed.map(p => {
            if (matchesAlias(p)) {
              if (isAdmin) {
                return {
                  ...p,
                  status: 'DELETED_BY_ADMIN',
                  listingStatus: 'DELETED_BY_ADMIN',
                  deletedByAdmin: true,
                  isDeleted: true,
                  isPublished: false,
                  adminFeedback: 'Notification: Deleted by Admin',
                  adminNotes: 'Deleted by Admin'
                };
              }
              return null;
            }
            return p;
          }).filter(Boolean);
          localStorage.setItem('easeland_user_properties', JSON.stringify(updatedUserProps));
        }

        const rawDeleted = localStorage.getItem('easeland_deleted_properties') || '[]';
        const parsedDeleted = JSON.parse(rawDeleted);
        allAliases.forEach(alias => {
          if (!parsedDeleted.includes(alias)) parsedDeleted.push(alias);
        });
        if (normTitle && !parsedDeleted.includes(normTitle)) {
          parsedDeleted.push(normTitle);
        }
        localStorage.setItem('easeland_deleted_properties', JSON.stringify(parsedDeleted));

        if (isAdmin) {
          const rawAdminDel = localStorage.getItem('easeland_admin_deleted_properties') || '[]';
          const parsedAdminDel = JSON.parse(rawAdminDel);
          const exists = parsedAdminDel.some(item => matchesAlias(item));
          if (!exists) {
            parsedAdminDel.push({
              id: pIdStr,
              propertyId: id2 || pIdStr,
              referenceId: id3 || `EL-PROP-${num1 || pIdStr}`,
              title: propertyObj?.title || '',
              deletedByAdmin: true,
              adminFeedback: 'Notification: Deleted by Admin',
              adminNotes: 'Deleted by Admin',
              deletedAt: new Date().toISOString()
            });
            localStorage.setItem('easeland_admin_deleted_properties', JSON.stringify(parsedAdminDel));
          }
        }

        window.dispatchEvent(new CustomEvent('easeland-property-deleted', { detail: { propertyId: pIdStr, isAdmin } }));
      }
    } catch (e) {}

    return true;
  },

  // -------------------------------------------------------------
  // 3. ADMIN VERIFICATION & MANAGEMENT APIS
  // -------------------------------------------------------------
  getVerificationQueue: () => {
    let deletedIds = [];
    let submittedIds = [];
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('easeland_deleted_properties');
        if (raw) deletedIds = JSON.parse(raw).map(String);
        const rawSub = localStorage.getItem('easeland_submitted_properties');
        if (rawSub) submittedIds = JSON.parse(rawSub).map(String);
      }
    } catch (e) {}

    const currentProps = getStoredData('easeland_properties', properties);
    return currentProps.filter(p => {
      if (!p || isFakeProperty(p)) return false;
      const pId = String(p.id || p.propertyId || p.referenceId || '');
      if (deletedIds.includes(pId)) return false;

      const st = String(p.status || p.listingStatus || '').toUpperCase();
      const lst = String(p.listingStatus || '').toUpperCase();

      const isLive = st === 'LIVE' || st === 'APPROVED_LIVE' || st === 'APPROVED' || lst === 'LIVE' || lst === 'APPROVED_LIVE' || lst === 'APPROVED' || (p.isPlatformVerified === true && p.isPublished === true);
      const isClosed = st === 'REJECTED' || st === 'DELETED' || st === 'REJECTED_CLOSED' || st === 'CLOSED' || st === 'ARCHIVED' || lst === 'REJECTED' || lst === 'DELETED';
      const isChangesRequired = st === 'CHANGES_REQUIRED' || st === 'CHANGES_REQUESTED' || st === 'REVISION_REQUESTED' || lst === 'CHANGES_REQUIRED' || lst === 'CHANGES_REQUESTED' || lst === 'REVISION_REQUESTED';
      const isDraft = st === 'DRAFT' || lst === 'DRAFT' || p.isDraft === true;

      // Check if property has pending edits submitted for re-audit
      const hasPendingReaudit = Boolean(
        (p.hasPendingEdits === true || Boolean(p.pendingReauditData)) &&
        (p.reAuditStatus === 'PENDING_VERIFICATION' || p.reAuditStatus === 'UNDER_REVIEW')
      );

      if (hasPendingReaudit) return true;

      // Never show in verification queue if approved, rejected, changes requested, or draft
      if (isLive || isClosed || isChangesRequired || isDraft) return false;

      const isPending = st === 'PENDING_VERIFICATION' || lst === 'PENDING_VERIFICATION' || st === 'UNDER_REVIEW' || lst === 'UNDER_REVIEW' || st === 'SUBMITTED' || lst === 'SUBMITTED';

      return isPending || (submittedIds.includes(pId) && !isDraft && !isChangesRequired && !isClosed && !isLive);
    });
  },

  getAllPropertiesAdmin: () => {
    let localProps = [];
    let deletedIds = [];
    try {
      if (typeof window !== 'undefined') {
        const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties'];
        keys.forEach(k => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) localProps.push(...parsed.filter(item => item && typeof item === 'object' && !Array.isArray(item) && (item.id || item.propertyId || item.title)));
            else if (parsed && typeof parsed === 'object') localProps.push(parsed);
          }
        });
        const delRaw = localStorage.getItem('easeland_deleted_properties');
        if (delRaw) deletedIds = JSON.parse(delRaw).map(String);
      }
    } catch (e) {}
    const combined = [...properties, ...localProps];
    const candidateMap = new Map();
    combined.forEach(p => {
      if (!p || isFakeProperty(p)) return;
      const pId = String(p.id || p.propertyId || p.referenceId || '');
      if (pId && !deletedIds.includes(pId)) {
        const existing = candidateMap.get(pId) || {};
        candidateMap.set(pId, { ...existing, ...p });
      }
    });
    return Array.from(candidateMap.values()).filter(p => !isFakeProperty(p));
  },

  approvePropertyAdmin: (propertyId, notes = 'Approved by Admin') => {
    if (!propertyId) return null;
    const targetIdStr = String(propertyId);
    let localProps = [];
    try {
      if (typeof window !== 'undefined') {
        const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties'];
        keys.forEach(k => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) localProps.push(...parsed.filter(item => item && typeof item === 'object' && !Array.isArray(item)));
            else if (parsed && typeof parsed === 'object') localProps.push(parsed);
          }
        });
      }
    } catch (e) {}

    const all = [...properties, ...localProps];
    const prop = all.find(p => p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr));

    if (prop) {
      const pendingEdits = prop.pendingReauditData || prop.pendingEdits || {};
      Object.assign(prop, pendingEdits);
      prop.hasPendingEdits = false;
      prop.reAuditStatus = null;
      prop.pendingReauditData = null;
      prop.pendingEdits = null;
      prop.status = 'LIVE';
      prop.listingStatus = 'LIVE';
      prop.isPlatformVerified = true;
      prop.isPublished = true;
      prop.verificationStatus = 'Platform Verified';
      prop.verifiedDate = new Date().toISOString().split('T')[0];
      prop.verificationNotes = notes;

      const idx = properties.findIndex(p => p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr));
      if (idx !== -1) {
        properties[idx] = { ...properties[idx], ...prop };
      } else {
        properties.unshift(prop);
      }
      setStoredData('easeland_properties', properties);

      if (typeof window !== 'undefined') {
        try {
          const rawSub = localStorage.getItem('easeland_submitted_properties');
          if (rawSub) {
            const parsedSub = JSON.parse(rawSub);
            if (Array.isArray(parsedSub)) {
              localStorage.setItem('easeland_submitted_properties', JSON.stringify(parsedSub.filter(id => String(id) !== targetIdStr && String(id) !== String(prop.id) && String(id) !== String(prop.propertyId) && String(id) !== String(prop.referenceId))));
            }
          }

          const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties'];
          keys.forEach(k => {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                const updated = parsed.map(p => {
                  if (p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr)) {
                    return {
                      ...p,
                      ...pendingEdits,
                      hasPendingEdits: false,
                      reAuditStatus: null,
                      pendingReauditData: null,
                      pendingEdits: null,
                      status: 'LIVE',
                      listingStatus: 'LIVE',
                      isPlatformVerified: true,
                      isPublished: true,
                      verificationStatus: 'Platform Verified',
                      verificationNotes: notes
                    };
                  }
                  return p;
                });
                localStorage.setItem(k, JSON.stringify(updated));
              }
            }
          });
        } catch (e) {}

        window.dispatchEvent(new CustomEvent('easeland-property-approved', { detail: prop }));
        window.dispatchEvent(new CustomEvent('easeland-property-status-updated', { detail: prop }));
      }
    }
    return prop;
  },

  rejectPropertyEditsAdmin: (propertyId, reason = 'Proposed changes rejected by Admin') => {
    const targetIdStr = String(propertyId);
    let localProps = [];
    try {
      if (typeof window !== 'undefined') {
        const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties'];
        keys.forEach(k => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) localProps.push(...parsed);
          }
        });
      }
    } catch (e) {}

    const all = [...properties, ...localProps];
    let prop = all.find(p => p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr));
    if (prop) {
      prop.hasPendingEdits = false;
      prop.reAuditStatus = 'EDITS_REJECTED';
      prop.pendingReauditData = null;
      prop.pendingEdits = null;
      prop.adminFeedback = reason;
      prop.verificationNotes = reason;

      const idx = properties.findIndex(p => p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr));
      if (idx !== -1) {
        properties[idx] = { ...properties[idx], ...prop };
      } else {
        properties.unshift(prop);
      }
      setStoredData('easeland_properties', properties);

      if (typeof window !== 'undefined') {
        const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties'];
        keys.forEach(k => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const updated = parsed.map(item => {
                if (item && (String(item.id) === targetIdStr || String(item.propertyId) === targetIdStr || String(item.referenceId) === targetIdStr)) {
                  return {
                    ...item,
                    hasPendingEdits: false,
                    reAuditStatus: 'EDITS_REJECTED',
                    pendingReauditData: null,
                    pendingEdits: null,
                    adminFeedback: reason,
                    verificationNotes: reason
                  };
                }
                return item;
              });
              localStorage.setItem(k, JSON.stringify(updated));
            }
          }
        });
        window.dispatchEvent(new CustomEvent('easeland-property-updated', { detail: prop }));
      }
    }
    return prop;
  },

  rejectPropertyAdmin: (propertyId, reason = 'Listing information incomplete') => {
    const targetIdStr = String(propertyId);
    let prop = properties.find(p => p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr));

    if (!prop) {
      prop = { id: propertyId, propertyId, title: 'Property Listing' };
      properties.unshift(prop);
    }

    prop.status = 'REJECTED';
    prop.listingStatus = 'REJECTED';
    prop.isPublished = false;
    prop.isPlatformVerified = false;
    prop.verificationStatus = 'Verification Rejected';
    prop.rejectionReason = reason;
    prop.verificationNotes = reason;
    prop.ownerFacingNotes = reason;
    prop.adminNotes = reason;
    prop.adminFeedback = reason;

    setStoredData('easeland_properties', properties);

    if (typeof window !== 'undefined') {
      try {
        const rawSub = localStorage.getItem('easeland_submitted_properties');
        if (rawSub) {
          const parsedSub = JSON.parse(rawSub);
          if (Array.isArray(parsedSub)) {
            localStorage.setItem('easeland_submitted_properties', JSON.stringify(parsedSub.filter(id => String(id) !== targetIdStr && String(id) !== String(prop.id) && String(id) !== String(prop.propertyId) && String(id) !== String(prop.referenceId))));
          }
        }

        const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties'];
        keys.forEach(k => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const updated = parsed.map(item => {
                if (item && (String(item.id) === targetIdStr || String(item.propertyId) === targetIdStr || String(item.referenceId) === targetIdStr)) {
                  return {
                    ...item,
                    status: 'REJECTED',
                    listingStatus: 'REJECTED',
                    isPublished: false,
                    isPlatformVerified: false,
                    verificationStatus: 'Verification Rejected',
                    rejectionReason: reason,
                    verificationNotes: reason,
                    ownerFacingNotes: reason,
                    adminNotes: reason,
                    adminFeedback: reason
                  };
                }
                return item;
              });
              localStorage.setItem(k, JSON.stringify(updated));
            }
          }
        });
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('easeland-property-status-updated', { detail: prop }));
      window.dispatchEvent(new CustomEvent('easeland-property-updated', { detail: prop }));
    }
    return prop;
  },

  requestChangesAdmin: (propertyId, feedback = 'Please update layout boundary and tax receipt') => {
    const targetIdStr = String(propertyId);
    let prop = properties.find(p => p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr));

    if (!prop) {
      prop = { id: propertyId, propertyId, title: 'Property Listing' };
      properties.unshift(prop);
    }

    prop.status = 'CHANGES_REQUIRED';
    prop.listingStatus = 'CHANGES_REQUIRED';
    prop.isPublished = false;
    prop.isPlatformVerified = false;
    prop.verificationStatus = 'Changes Requested by Admin';
    prop.adminFeedback = feedback;
    prop.ownerFacingNotes = feedback;
    prop.verificationNotes = feedback;
    prop.adminNotes = feedback;

    setStoredData('easeland_properties', properties);

    if (typeof window !== 'undefined') {
      try {
        const rawSub = localStorage.getItem('easeland_submitted_properties');
        if (rawSub) {
          const parsedSub = JSON.parse(rawSub);
          if (Array.isArray(parsedSub)) {
            localStorage.setItem('easeland_submitted_properties', JSON.stringify(parsedSub.filter(id => String(id) !== targetIdStr && String(id) !== String(prop.id) && String(id) !== String(prop.propertyId) && String(id) !== String(prop.referenceId))));
          }
        }

        const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties'];
        keys.forEach(k => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const updated = parsed.map(item => {
                if (item && (String(item.id) === targetIdStr || String(item.propertyId) === targetIdStr || String(item.referenceId) === targetIdStr)) {
                  return {
                    ...item,
                    status: 'CHANGES_REQUIRED',
                    listingStatus: 'CHANGES_REQUIRED',
                    isPublished: false,
                    isPlatformVerified: false,
                    verificationStatus: 'Changes Requested by Admin',
                    adminFeedback: feedback,
                    ownerFacingNotes: feedback,
                    verificationNotes: feedback,
                    adminNotes: feedback
                  };
                }
                return item;
              });
              localStorage.setItem(k, JSON.stringify(updated));
            }
          }
        });
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('easeland-property-status-updated', { detail: prop }));
      window.dispatchEvent(new CustomEvent('easeland-property-updated', { detail: prop }));
    }
    return prop;
  },

  // -------------------------------------------------------------
  // 4. CONFIDENTIAL DOCUMENTS SECURITY API
  // -------------------------------------------------------------
  getConfidentialDocuments: (propertyId, userRole = 'CUSTOMER', userId = null) => {
    const prop = properties.find(p => p.id === propertyId);
    if (!prop) return { error: 'Property not found', documents: [] };

    // Security Check: Customer role CANNOT access documents under any condition
    if (userRole === 'ADMIN') {
      return { accessGranted: true, documents: prop.documents || [] };
    }

    if (userRole === 'OWNER' && prop.owner && prop.owner.id === userId) {
      return { accessGranted: true, documents: prop.documents || [] };
    }

    // Access Denied for Customer or unauthorized user
    return {
      accessGranted: false,
      error: 'Access Denied: Property documents are strictly confidential and accessible only to property owners and EaseLand Admin staff.',
      documents: []
    };
  },

  // -------------------------------------------------------------
  // 5. ENQUIRIES, DEALS & FOLLOW-UPS APIS
  // -------------------------------------------------------------
  createEnquiry: (enquiryPayload) => {
    const newEnquiry = {
      id: 'enq-' + Date.now().toString().slice(-6),
      createdAt: new Date().toISOString(),
      status: 'NEW',
      ...enquiryPayload
    };
    enquiries.unshift(newEnquiry);
    setStoredData('easeland_enquiries', enquiries);

    // Auto-create a CRM Deal entry for Admin tracking
    const newDeal = {
      id: 'deal-' + Date.now().toString().slice(-6),
      propertyId: enquiryPayload.propertyId,
      propertyTitle: enquiryPayload.propertyTitle,
      listedPrice: enquiryPayload.propertyPriceDisplay || 'Rs. 32 Lakhs',
      negotiatedPrice: 'Under Negotiation',
      customerName: enquiryPayload.customerName,
      customerPhone: enquiryPayload.customerPhone,
      ownerName: enquiryPayload.ownerName || 'Property Owner',
      stage: 'NEW',
      assignedAdmin: 'EaseLand Admin',
      createdAt: new Date().toISOString().split('T')[0],
      lastUpdate: new Date().toISOString().split('T')[0],
      notes: `Enquiry received: "${enquiryPayload.message}"`
    };
    deals.unshift(newDeal);
    setStoredData('easeland_deals', deals);

    return newEnquiry;
  },

  getEnquiriesAdmin: () => enquiries,

  getDealsAdmin: () => deals,

  updateDealStageAdmin: (dealId, stage, notes = '') => {
    const deal = deals.find(d => d.id === dealId);
    if (deal) {
      deal.stage = stage;
      deal.lastUpdate = new Date().toISOString().split('T')[0];
      if (notes) deal.notes = notes;
      setStoredData('easeland_deals', deals);
    }
    return deal;
  },

  getFollowUpsAdmin: () => followUps,

  createFollowUpAdmin: (followUpPayload) => {
    const newFup = {
      id: 'fup-' + Date.now().toString().slice(-6),
      status: 'SCHEDULED',
      ...followUpPayload
    };
    followUps.unshift(newFup);
    setStoredData('easeland_followups', followUps);
    return newFup;
  },

  // -------------------------------------------------------------
  // 6. WISHLIST APIS
  // -------------------------------------------------------------
  getWishlist: () => {
    let storedWishlistIds = getStoredData('easeland_wishlist', wishlist);
    if (!Array.isArray(storedWishlistIds)) storedWishlistIds = [];

    let allP = [...properties];
    try {
      if (typeof window !== 'undefined') {
        const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties', 'easeland_submitted_properties'];
        keys.forEach(k => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) allP.push(...parsed);
            else if (parsed && typeof parsed === 'object') allP.push(parsed);
          }
        });
      }
    } catch (e) {}

    const map = new Map();
    allP.forEach(p => {
      if (!p) return;
      const id = String(p.id || p.propertyId || p.referenceId || '');
      if (id) map.set(id, { ...(map.get(id) || {}), ...p });
    });

    return storedWishlistIds
      .map(wId => map.get(String(wId)))
      .filter(Boolean);
  },

  toggleWishlist: (propertyId) => {
    if (wishlist.includes(propertyId)) {
      wishlist = wishlist.filter(id => id !== propertyId);
    } else {
      wishlist = Array.from(new Set([...wishlist, propertyId]));
    }
    setStoredData('easeland_wishlist', wishlist);
    return wishlist;
  },

  isWishlisted: (propertyId) => {
    return wishlist.includes(propertyId);
  },

  getAllUsersAdmin: () => {
    return [...registeredUsers].sort((a, b) => {
      const aIsAdmin = a.role === 'ADMIN' || a.email === 'admin@easeland.in' || a.status === 'ADMIN';
      const bIsAdmin = b.role === 'ADMIN' || b.email === 'admin@easeland.in' || b.status === 'ADMIN';
      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;
      return 0;
    });
  },

  registerUser: ({ name, email, phone, password }) => {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const existing = registeredUsers.find(u => u.email.toLowerCase() === normalizedEmail);

    if (existing) {
      return { success: false, error: 'An account with this email address already exists! Please log in instead.' };
    }

    const newUser = {
      id: 'usr-' + Date.now().toString().slice(-6),
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password: password,
      role: 'Verified Property Owner & Buyer',
      status: 'ACTIVE',
      joinedDate: new Date().toISOString().split('T')[0],
      postedListingsCount: 0,
      enquiriesCount: 0,
      isCustomRegistered: true,
      suspension: null
    };

    registeredUsers.unshift(newUser);
    setStoredData('easeland_registered_users', registeredUsers);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-users-updated', { detail: registeredUsers }));
    }

    return {
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        token: 'jwt-user-token-' + Date.now()
      }
    };
  },

  loginUser: ({ email, password }) => {
    const normalizedEmail = (email || '').toLowerCase().trim();

    // Special Handling for Admin Credentials
    if (normalizedEmail === 'admin@easeland.in' || normalizedEmail === 'scarlett.admin@easeland.in') {
      if (password === 'Admin@12345' || password === 'Admin@2026') {
        const adminAccount = {
          id: 'admin-101',
          name: 'EaseLand Admin',
          email: 'admin@easeland.in',
          phone: '+91 98765 00000',
          role: 'ADMIN',
          token: 'jwt-admin-token-' + Date.now()
        };
        return { success: true, user: adminAccount };
      } else {
        return { success: false, error: 'Incorrect Admin password! User can only log in if they use the exact registered password.' };
      }
    }

    const matchedUser = registeredUsers.find(
      u => u.email.toLowerCase() === normalizedEmail
    );

    if (!matchedUser) {
      return { success: false, error: 'No registered account found with this email. Please register first.' };
    }

    if (matchedUser.password && matchedUser.password !== password) {
      return { success: false, error: 'Incorrect password! User can only log in if they use the same email and password.' };
    }

    // Check for suspension
    if (matchedUser.status === 'SUSPENDED' && matchedUser.suspension) {
      const until = new Date(matchedUser.suspension.suspendedUntil);
      if (new Date() < until) {
        return {
          success: false,
          error: `ACCOUNT SUSPENDED: Your account is blocked until ${until.toLocaleDateString()} for policy violation ("${matchedUser.suspension.reason}").`
        };
      }
    }

    const role = (matchedUser.role === 'ADMIN' || matchedUser.status === 'ADMIN' || normalizedEmail === 'admin@easeland.in') ? 'ADMIN' : 'USER';

    return {
      success: true,
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email,
        phone: matchedUser.phone,
        role: role,
        token: 'jwt-' + role.toLowerCase() + '-token-' + Date.now()
      }
    };
  },

  suspendUserAdmin: (userId, days = 7, hours = 0, reason = 'Violation of platform verification guidelines') => {
    const usr = registeredUsers.find(u => u.id === userId || u.email === userId);
    if (usr) {
      const now = new Date();
      const numDays = parseInt(days) || 0;
      const numHours = parseInt(hours) || 0;
      const suspendedUntil = new Date(now.getTime() + (numDays * 24 * 60 * 60 * 1000) + (numHours * 60 * 60 * 1000)).toISOString();

      usr.status = 'SUSPENDED';
      usr.suspension = {
        days: numDays,
        hours: numHours,
        reason: reason || 'Violation of platform verification rules',
        suspendedAt: now.toISOString(),
        suspendedUntil: suspendedUntil,
        suspendedBy: 'EaseLand Admin'
      };
      setStoredData('easeland_registered_users', registeredUsers);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('easeland-users-updated', { detail: registeredUsers }));
      }
    }
    return usr;
  },

  unsuspendUserAdmin: (userId) => {
    const usr = registeredUsers.find(u => u.id === userId || u.email === userId);
    if (usr) {
      usr.status = 'ACTIVE';
      usr.suspension = null;
      setStoredData('easeland_registered_users', registeredUsers);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('easeland-users-updated', { detail: registeredUsers }));
      }
    }
    return usr;
  },

  removeUserAdmin: (userId, reason = 'Account permanently deleted by platform admin') => {
    const usrIndex = registeredUsers.findIndex(u => u.id === userId || u.email === userId);
    if (usrIndex !== -1) {
      const removedUser = registeredUsers[usrIndex];
      registeredUsers.splice(usrIndex, 1);
      setStoredData('easeland_registered_users', registeredUsers);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('easeland-users-updated', { detail: registeredUsers }));
      }
      return removedUser;
    }
    return null;
  },

  getCurrentUser: () => {
    return getStoredData('easeland_active_user', null);
  },

  setCurrentUser: (userObj) => {
    setStoredData('easeland_active_user', userObj);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-session-updated', { detail: userObj }));
    }
    return userObj;
  },

  updateUserProfile: (userId, updatedFields) => {
    const usrIndex = registeredUsers.findIndex(u => u.id === userId || u.email === userId);
    let updatedUser = null;

    if (usrIndex !== -1) {
      registeredUsers[usrIndex] = {
        ...registeredUsers[usrIndex],
        ...updatedFields
      };
      updatedUser = registeredUsers[usrIndex];
    } else {
      updatedUser = {
        id: userId,
        ...updatedFields
      };
      registeredUsers.unshift(updatedUser);
    }

    setStoredData('easeland_registered_users', registeredUsers);

    // Update active session user if currently logged in
    const activeSession = getStoredData('easeland_active_user', null);
    if (activeSession && (activeSession.id === userId || activeSession.email === userId)) {
      const mergedSession = { ...activeSession, ...updatedFields };
      setStoredData('easeland_active_user', mergedSession);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-users-updated', { detail: registeredUsers }));
      window.dispatchEvent(new CustomEvent('easeland-user-profile-updated', { detail: updatedUser }));
    }

    return updatedUser;
  },

  isUserSuspended: (user) => {
    if (!user) return { isSuspended: false };
    const userEmail = (user.email || '').toLowerCase();
    const userId = (user.id || '').toLowerCase();
    const userName = (user.name || '').toLowerCase();

    const usr = registeredUsers.find(u => {
      const uEmail = (u.email || '').toLowerCase();
      const uId = (u.id || '').toLowerCase();
      const uName = (u.name || '').toLowerCase();

      return (
        (userEmail && uEmail && (userEmail === uEmail || userEmail.split('@')[0] === uEmail.split('@')[0])) ||
        (userId && uId && userId === uId) ||
        (userName && uName && (userName === uName || userName.includes(uName) || uName.includes(userName)))
      );
    });

    if (!usr || usr.status !== 'SUSPENDED' || !usr.suspension) return { isSuspended: false };

    const until = new Date(usr.suspension.suspendedUntil);
    const now = new Date();

    if (now >= until) {
      usr.status = 'ACTIVE';
      usr.suspension = null;
      setStoredData('easeland_registered_users', registeredUsers);
      return { isSuspended: false };
    }

    const remainingMs = until - now;
    const daysLeft = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minsLeft = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      isSuspended: true,
      user: usr,
      reason: usr.suspension.reason,
      suspendedUntil: usr.suspension.suspendedUntil,
      formattedUntil: until.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      countdownText: `${daysLeft}d ${hoursLeft}h ${minsLeft}m`
    };
  },

  // Initial Theme Hydration
  initTheme: () => {
    if (siteConfig && siteConfig.theme) {
      applySiteTheme(siteConfig.theme);
    }
  },

  mergeSiteConfigWithDefaults: mergeSiteConfigWithDefaults,
  sanitizeSiteConfig: sanitizeSiteConfig,

  getSiteConfig: () => {
    siteConfig = mergeSiteConfigWithDefaults(siteConfig);
    if (siteConfig && siteConfig.theme) {
      applySiteTheme(siteConfig.theme);
    }
    return siteConfig;
  },

  updateSiteConfig: (newPartialConfig) => {
    siteConfig = mergeSiteConfigWithDefaults({
      ...siteConfig,
      ...newPartialConfig,
      publish: {
        ...(siteConfig.publish || {}),
        ...(newPartialConfig.publish || {}),
        lastPublishedBy: 'EaseLand Admin',
        lastPublishedTime: new Date().toISOString()
      }
    });
    setStoredData('easeland_site_config', siteConfig);
    if (siteConfig.theme) {
      applySiteTheme(siteConfig.theme);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-site-config-updated', { detail: siteConfig }));
    }
    return siteConfig;
  },

  resetSiteConfigAdmin: () => {
    siteConfig = JSON.parse(JSON.stringify(DEFAULT_SITE_CONFIG));
    setStoredData('easeland_site_config', siteConfig);
    if (siteConfig.theme) {
      applySiteTheme(siteConfig.theme);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-site-config-updated', { detail: siteConfig }));
    }
    return siteConfig;
  }
};
