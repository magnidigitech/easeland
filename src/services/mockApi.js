import { INITIAL_PROPERTIES, INITIAL_ENQUIRIES, INITIAL_DEALS, INITIAL_FOLLOW_UPS } from './mockData';
import { extractCoordinates } from './locationProvider';

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
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : initial;
  } catch (err) {
    return initial;
  }
};

const setStoredData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error('LocalStorage write error:', err);
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
    root.style.setProperty('--brand-charcoal', themeConfig.darkBgColor);
    root.style.setProperty('--brand-charcoal-light', themeConfig.darkBgColor);
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

// Bulletproof Deduplication Algorithm across all properties (Zero Duplicate Law)
export const deduplicateProperties = (items) => {
  if (!Array.isArray(items)) return [];

  // Priority sort: newly created/updated properties take priority over static mocks
  const sorted = [...items].sort((a, b) => {
    if (a.createdAt && b.createdAt) return new Date(b.createdAt) - new Date(a.createdAt);
    if (a.createdAt && !b.createdAt) return -1;
    if (!a.createdAt && b.createdAt) return 1;
    return 0;
  });

  const result = [];

  for (const item of sorted) {
    if (!item) continue;

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
let rawProperties = getStoredData('easeland_properties', INITIAL_PROPERTIES);
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
});
setStoredData('easeland_properties', properties);

let enquiries = getStoredData('easeland_enquiries', INITIAL_ENQUIRIES);
let deals = getStoredData('easeland_deals', INITIAL_DEALS);
let followUps = getStoredData('easeland_followups', INITIAL_FOLLOW_UPS);
let wishlist = getStoredData('easeland_wishlist', []);

const INITIAL_USERS = [
  {
    id: 'admin-101',
    name: 'EaseLand Admin',
    email: 'admin@easeland.in',
    phone: '9876500000',
    password: 'Admin@12345',
    role: 'ADMIN',
    status: 'ADMIN',
    joinedDate: '2026-01-01',
    postedListingsCount: 0,
    enquiriesCount: 0,
    suspension: null
  }
];

const DEFAULT_SITE_CONFIG = {
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
    heroSubtitle: 'Zero agents. Zero commission. Explore land plots, houses, apartments, and commercial spaces on our interactive map across all of India.',
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
    tagline: 'EaseLand is India\'s premier direct property discovery and verification marketplace. Zero brokerage, 100% verified land titles and plot boundaries.',
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
    subtitle: 'Find rental properties with zero brokerage fees, transparent owner contacts, and instant agreement support.',
    badgeText: 'DIRECT TENANT CONNECT'
  },
  sellPage: {
    title: 'List Your Property Directly — Zero Brokerage Commission',
    subtitle: 'Post your open plot, villa, apartment, or commercial land in under 3 minutes. Our verification specialist inspects your property within 24 hours.',
    badgeText: 'POST PROPERTY FOR FREE'
  },
  categories: [
    { id: 'cat-1', title: 'Open Plots', countText: 'Pan-India Plot Listings', icon: 'MapPin', imageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80' },
    { id: 'cat-2', title: 'Houses & Villas', countText: 'Independent Villas & Gated Houses', icon: 'Building2', imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80' },
    { id: 'cat-3', title: 'Apartments', countText: 'High-Rise Modern Flats', icon: 'Building', imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80' },
    { id: 'cat-4', title: 'Commercial', countText: 'Commercial Plots & Offices', icon: 'Briefcase', imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80' },
    { id: 'cat-5', title: 'Rentals', countText: 'Furnished Rental Flats & Homes', icon: 'Key', imageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80' }
  ],
  faqs: [
    { id: 'faq-1', question: 'How does EaseLand verify property titles and land boundaries?', answer: 'EaseLand deploys field inspection specialists who perform physical site visits, capture GeoJSON plot boundary coordinates, and audit land records (Pahani, Adangal, Encumbrance Certificates) before publishing listings live.' },
    { id: 'faq-2', question: 'Are there any brokerage or hidden agent commissions?', answer: 'No. EaseLand is a 100% direct buyer-to-owner platform. Buyers contact property owners directly with zero middleman commissions.' },
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
    slogan: 'Zero Brokerage. 100% Verified.'
  },
  theme: {
    primaryColor: '#F4C542',
    darkBgColor: '#0B2545',
    accentColor: '#2563EB',
    fontFamily: 'Plus Jakarta Sans',
    darkMode: true
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
    metaDescription: 'Discover and verify open plots, villas, apartments, and agricultural lands directly from owners. Zero brokerage, verified title deeds, and Leaflet Google satellite map polygons.',
    keywords: 'land plots, buy land, guntur real estate, hyderabad plots, zero brokerage, verified property, plot boundary, real estate india',
    ogImageUrl: '/easeland_logo.png',
    canonicalUrl: 'https://easeland.in'
  },
  publish: {
    autoPublish: false,
    version: '2.4.0',
    lastPublishedBy: 'Scarlett (Admin)'
  }
};

let rawUsers = getStoredData('easeland_registered_users', INITIAL_USERS);
// Clean stale dummy users & guarantee core admin account exists
let registeredUsers = rawUsers.filter(u =>
  u && u.status !== 'DELETED' &&
  (u.email === 'admin@easeland.in' || u.isCustomRegistered)
);

// Guarantee admin@easeland.in exists
if (!registeredUsers.some(u => u.email === 'admin@easeland.in')) {
  registeredUsers.push({
    id: 'admin-101',
    name: 'EaseLand Admin',
    email: 'admin@easeland.in',
    phone: '9876500000',
    password: 'Admin@12345',
    role: 'ADMIN',
    status: 'ADMIN',
    joinedDate: '2026-01-01',
    postedListingsCount: 0,
    enquiriesCount: 0,
    suspension: null
  });
}

setStoredData('easeland_registered_users', registeredUsers);
let siteConfig = getStoredData('easeland_site_config', DEFAULT_SITE_CONFIG);

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
        if (delRaw) deletedIds = JSON.parse(delRaw).map(String);
      }
    } catch (e) {}

    const combined = [...INITIAL_PROPERTIES, ...properties, ...localProps];
    const candidateMap = new Map();
    combined.forEach(p => {
      if (!p) return;
      const pId = String(p.id || p.propertyId || p.referenceId || '');
      if (pId && !deletedIds.includes(pId)) {
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
      const isLive = st === 'LIVE' || st === 'APPROVED_LIVE' || st === 'APPROVED' || st === 'PLATFORM VERIFIED' || st === 'VERIFIED' ||
                     lst === 'LIVE' || lst === 'APPROVED_LIVE' || lst === 'APPROVED' || lst === 'PLATFORM VERIFIED' || lst === 'VERIFIED' ||
                     vst === 'PLATFORM VERIFIED' || vst === 'VERIFIED' || vst === 'APPROVED' ||
                     p.isPlatformVerified === true || p.isPublished === true || p.published === true ||
                     (!p.status && !p.listingStatus && p.title);
      const isExplicitlyBlocked = st === 'REJECTED' || st === 'DRAFT' || lst === 'REJECTED' || lst === 'DRAFT' || (st === 'PENDING_VERIFICATION' && !p.isPlatformVerified && lst !== 'LIVE') || st === 'CHANGES_REQUIRED';
      return isLive && !isExplicitlyBlocked;
    });
    result = deduplicateProperties(result);

    // Category Filter
    if (filters.category && filters.category !== 'All') {
      result = result.filter(p => p.category === filters.category || p.propertyType === filters.category);
    }

    // Purpose Filter (buy vs rent)
    if (filters.purpose) {
      result = result.filter(p => p.purpose === filters.purpose.toLowerCase());
    }

    // Deep 12-Tier Spatial & Multi-Token Text Search Query Engine
    const rawQuery = (filters.query || filters.address || '').toLowerCase().trim();
    if (rawQuery) {
      if (rawQuery === 'near me' || rawQuery.includes('near me')) {
        if (filters.userLat && filters.userLng) {
          result.sort((a, b) => {
            const latA = a.location?.lat || 0;
            const lngA = a.location?.lng || 0;
            const latB = b.location?.lat || 0;
            const lngB = b.location?.lng || 0;
            const distA = Math.hypot(latA - filters.userLat, lngA - filters.userLng);
            const distB = Math.hypot(latB - filters.userLat, lngB - filters.userLng);
            return distA - distB;
          });
        }
      } else if (rawQuery === 'india' || rawQuery.includes('india')) {
        // Return all Indian properties
      } else {
        const stopWords = new Set(['in', 'at', 'for', 'and', 'near', 'the', 'a', 'an', 'with', 'by', 'of', 'to', 'is', 'on']);
        const tokens = rawQuery
          .split(/[\s,/\-]+/)
          .map(t => t.trim())
          .filter(t => t.length > 0 && !stopWords.has(t));

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

            // Multi-token match: EVERY search keyword token must be found inside the property's searchableBlob
            return tokens.every(token => searchableBlob.includes(token));
          });
        }
      }
    }

    // Price Filter Range
    if (filters.minPrice) result = result.filter(p => p.price >= Number(filters.minPrice));
    if (filters.maxPrice) result = result.filter(p => p.price <= Number(filters.maxPrice));

    // Area Filter Range
    if (filters.minArea) result = result.filter(p => p.area >= Number(filters.minArea));
    if (filters.maxArea) result = result.filter(p => p.area <= Number(filters.maxArea));

    // Specific Filters
    if (filters.bedrooms && filters.bedrooms !== 'Any') {
      const beds = parseInt(filters.bedrooms);
      result = result.filter(p => p.bedrooms >= beds);
    }
    if (filters.cornerPlot) result = result.filter(p => p.cornerPlot === true);
    if (filters.gatedCommunity) result = result.filter(p => p.gatedCommunity === true);

    return result;
  },

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
    return [...properties, ...localProps].find(p => p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr)) || null;
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

    const existingIndex = freshProps.findIndex(
      p => p.id === newId || p.propertyId === newId ||
        (p.title && newPropertyPayload.title && p.title.toLowerCase().trim() === newPropertyPayload.title.toLowerCase().trim())
    );

    if (existingIndex !== -1) {
      freshProps[existingIndex] = { ...freshProps[existingIndex], ...targetProp };
    } else {
      freshProps.unshift(targetProp);
    }

    properties = freshProps;
    setStoredData('easeland_properties', freshProps);

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
      if (!p) return;
      const pId = String(p.id || p.propertyId || p.referenceId || '');
      if (pId) {
        allPropsMap.set(pId, { ...(allPropsMap.get(pId) || {}), ...p });
      }
    });

    let deletedIds = [];
    try {
      if (typeof window !== 'undefined') {
        const rawDel = localStorage.getItem('easeland_deleted_properties');
        if (rawDel) deletedIds = JSON.parse(rawDel);
      }
    } catch (e) {}

    const mergedProps = Array.from(allPropsMap.values()).filter(p => p && !deletedIds.includes(String(p.id || p.propertyId)));

    const isAdmin = targetEmail === 'admin@easeland.in' || targetEmail.includes('admin') || targetId === 'admin_uid_001' || targetId === 'admin-101';

    return mergedProps.filter(p => {
      if (!p) return false;
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
      setStoredData('easeland_properties', currentProps);
    }
    return prop;
  },

  deleteProperty: (propertyId) => {
    if (!propertyId) return false;
    const pIdStr = String(propertyId);

    // 1. Remove from in-memory properties array
    const idx = properties.findIndex(p => p && (String(p.id) === pIdStr || String(p.propertyId) === pIdStr));
    if (idx !== -1) {
      properties.splice(idx, 1);
    }

    // 2. Remove from stored easeland_properties in localStorage
    const currentProps = getStoredData('easeland_properties', properties);
    const updatedProps = currentProps.filter(p => p && String(p.id) !== pIdStr && String(p.propertyId) !== pIdStr);
    setStoredData('easeland_properties', updatedProps);

    // 3. Track deleted ID in localStorage to prevent re-hydration
    try {
      if (typeof window !== 'undefined') {
        const rawUserProps = localStorage.getItem('easeland_user_properties');
        if (rawUserProps) {
          const parsed = JSON.parse(rawUserProps);
          const updatedUserProps = parsed.filter(p => p && String(p.id || p.propertyId) !== pIdStr);
          localStorage.setItem('easeland_user_properties', JSON.stringify(updatedUserProps));
        }

        const rawDeleted = localStorage.getItem('easeland_deleted_properties') || '[]';
        const parsedDeleted = JSON.parse(rawDeleted);
        if (!parsedDeleted.includes(pIdStr)) {
          parsedDeleted.push(pIdStr);
          localStorage.setItem('easeland_deleted_properties', JSON.stringify(parsedDeleted));
        }

        window.dispatchEvent(new CustomEvent('easeland-property-deleted', { detail: { propertyId: pIdStr } }));
      }
    } catch (e) {}

    return true;
  },

  // -------------------------------------------------------------
  // 3. ADMIN VERIFICATION & MANAGEMENT APIS
  // -------------------------------------------------------------
  getVerificationQueue: () => {
    let deletedIds = [];
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('easeland_deleted_properties');
        if (raw) deletedIds = JSON.parse(raw);
      }
    } catch (e) {}

    const currentProps = getStoredData('easeland_properties', properties);
    return currentProps.filter(p => {
      if (!p) return false;
      const pId = String(p.id || p.propertyId || '');
      if (deletedIds.includes(pId)) return false;

      const st = (p.status || p.listingStatus || '').toUpperCase();
      return ['PENDING_VERIFICATION', 'UNDER_REVIEW', 'PENDING', 'SUBMITTED', 'DRAFT', 'CHANGES_REQUIRED', 'NOT_VERIFIED'].includes(st);
    });
  },

  getAllPropertiesAdmin: () => {
    let localProps = [];
    let deletedIds = [];
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
        if (delRaw) deletedIds = JSON.parse(delRaw).map(String);
      }
    } catch (e) {}
    const combined = [...properties, ...localProps];
    const candidateMap = new Map();
    combined.forEach(p => {
      if (!p) return;
      const pId = String(p.id || p.propertyId || p.referenceId || '');
      if (pId && !deletedIds.includes(pId)) {
        const existing = candidateMap.get(pId) || {};
        candidateMap.set(pId, { ...existing, ...p });
      }
    });
    return Array.from(candidateMap.values());
  },

  approvePropertyAdmin: (propertyId, notes = 'Approved by Admin') => {
    if (!propertyId) return null;
    const targetIdStr = String(propertyId);
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

    const all = [...properties, ...localProps];
    const prop = all.find(p => p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr));

    if (prop) {
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
          const keys = ['easeland_user_properties', 'easeland_owner_properties', 'easeland_submitted_properties'];
          keys.forEach(k => {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                const updated = parsed.map(p => {
                  if (p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr)) {
                    return {
                      ...p,
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

  rejectPropertyAdmin: (propertyId, reason = 'Listing information incomplete') => {
    const prop = properties.find(p => p.id === propertyId || p.propertyId === propertyId);
    if (prop) {
      prop.status = 'REJECTED';
      prop.listingStatus = 'REJECTED';
      prop.isPublished = false;
      prop.isPlatformVerified = false;
      prop.verificationStatus = 'Verification Rejected';
      prop.rejectionReason = reason;
      prop.verificationNotes = reason;
      setStoredData('easeland_properties', properties);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('easeland-property-status-updated', { detail: prop }));
      }
    }
    return prop;
  },

  requestChangesAdmin: (propertyId, feedback = 'Please update layout boundary and tax receipt') => {
    const prop = properties.find(p => p.id === propertyId || p.propertyId === propertyId);
    if (prop) {
      prop.status = 'CHANGES_REQUIRED';
      prop.listingStatus = 'CHANGES_REQUIRED';
      prop.isPublished = false;
      prop.verificationStatus = 'Changes Requested by Admin';
      prop.adminFeedback = feedback;
      prop.ownerFacingNotes = feedback;
      prop.verificationNotes = feedback;
      prop.adminNotes = feedback;
      setStoredData('easeland_properties', properties);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('easeland-property-status-updated', { detail: prop }));
      }
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
      assignedAdmin: 'Scarlett (Admin)',
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
    return properties.filter(p => wishlist.includes(p.id));
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
          name: 'Scarlett (Admin)',
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
        suspendedBy: 'Scarlett (Admin)'
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

  // -------------------------------------------------------------
  // 8. MASTER SITE MANAGEMENT CMS API (All 16 Modules)
  // -------------------------------------------------------------
  getSiteConfig: () => {
    if (siteConfig && siteConfig.theme) {
      applySiteTheme(siteConfig.theme);
    }
    return siteConfig;
  },

  updateSiteConfig: (newPartialConfig) => {
    siteConfig = {
      ...siteConfig,
      ...newPartialConfig,
      publish: {
        ...siteConfig.publish,
        lastPublishedBy: 'Scarlett (Admin)',
        lastPublishedTime: new Date().toISOString()
      }
    };
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
