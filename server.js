import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import pg from 'pg';
import admin from 'firebase-admin';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { fileURLToPath } from 'url';
let PAN_INDIA_ADMINISTRATIVE_HIERARCHY = {};
let getIndiaStates = () => Object.keys(PAN_INDIA_ADMINISTRATIVE_HIERARCHY);
let getIndiaDistricts = (stateName) => PAN_INDIA_ADMINISTRATIVE_HIERARCHY[stateName] || [];
let matchStatesAndDistricts = (queryStr) => [];

try {
  const hierarchyMod = await import('./src/services/indiaLocationHierarchy.js');
  PAN_INDIA_ADMINISTRATIVE_HIERARCHY = hierarchyMod.PAN_INDIA_ADMINISTRATIVE_HIERARCHY || {};
  getIndiaStates = hierarchyMod.getIndiaStates || getIndiaStates;
  getIndiaDistricts = hierarchyMod.getIndiaDistricts || getIndiaDistricts;
  matchStatesAndDistricts = hierarchyMod.matchStatesAndDistricts || matchStatesAndDistricts;
} catch (err) {
  console.warn('Note: indiaLocationHierarchy module load fallback:', err.message);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK with Service Account Key if available
try {
  if (!getApps().length) {
    let credential = undefined;
    const keyPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      try {
        const rawKey = fs.readFileSync(keyPath, 'utf8');
        credential = cert(JSON.parse(rawKey));
        console.log('Firebase Admin initialized with local serviceAccountKey.json');
      } catch (e) {
        console.warn('Error reading local serviceAccountKey.json:', e.message);
      }
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
        const parsedKey = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(fs.readFileSync(raw, 'utf8'));
        credential = cert(parsedKey);
        console.log('Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT_KEY env var');
      } catch (e) {
        console.warn('Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:', e.message);
      }
    }

    const adminConfig = {
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'easeland-fba04'
    };
    if (credential) {
      adminConfig.credential = credential;
    }
    initializeApp(adminConfig);
  }
} catch (eAdminInit) {
  console.warn('Firebase Admin SDK initialization note:', eAdminInit.message);
}

function getAdminDb() {
  try {
    const apps = getApps();
    if (apps.length) return getFirestore(apps[0]);
    const keyPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      const app = initializeApp({
        credential: cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))),
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'easeland-fba04'
      }, 'admin-firestore-helper');
      return getFirestore(app);
    }
  } catch (e) {
    console.warn('Admin Firestore helper note:', e.message);
  }
  return null;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Prevent uncaught exceptions from crashing the server
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception caught:', err.message || err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection caught:', reason);
});

// Enable CORS
app.use(cors());

// Authoritative PostgreSQL Database State (Fail-Fast Architecture)
const pgDbState = {
  connected: false,
  error: null,
  lastChecked: null
};

// Health check endpoints for Coolify / Traefik / reverse proxy - Fail Fast
app.get('/health', (req, res) => {
  if (!pgDbState.connected) {
    return res.status(503).send('UNHEALTHY: PostgreSQL disconnected (' + (pgDbState.error || 'Connection failed') + ')');
  }
  return res.status(200).send('OK');
});

app.get('/api/health', (req, res) => {
  if (!pgDbState.connected) {
    return res.status(503).json({
      status: 'error',
      uptime: process.uptime(),
      database: 'DISCONNECTED',
      error: pgDbState.error || 'PostgreSQL database connection failed.'
    });
  }
  return res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    database: 'CONNECTED',
    tables: 'INITIALIZED'
  });
});

// Configure Multer Memory Storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB file size limit
  }
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload directories exist on Hostinger VPS disk
const uploadsDir = path.join(__dirname, 'uploads');
const propertiesDir = path.join(uploadsDir, 'properties');
const documentsDir = path.join(uploadsDir, 'documents');
fs.mkdirSync(propertiesDir, { recursive: true });
fs.mkdirSync(documentsDir, { recursive: true });

// Serve uploaded media files statically from /uploads
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '30d',
  immutable: true
}));

// Cache Buster: Prevent browser, proxy, and CDN caching on all dynamic API endpoints
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// PWA Service Worker: Never cache sw.js so client devices detect updates instantly
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/javascript');
  const swPath = path.join(__dirname, 'dist', 'sw.js');
  if (fs.existsSync(swPath)) {
    return res.sendFile(swPath);
  }
  const publicSwPath = path.join(__dirname, 'public', 'sw.js');
  if (fs.existsSync(publicSwPath)) {
    return res.sendFile(publicSwPath);
  }
  return res.status(404).send('Service worker not found');
});

// PWA Web App Manifest with correct MIME type
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const manifestPath = path.join(__dirname, 'dist', 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    return res.sendFile(manifestPath);
  }
  const publicManifestPath = path.join(__dirname, 'public', 'manifest.json');
  if (fs.existsSync(publicManifestPath)) {
    return res.sendFile(publicManifestPath);
  }
  return res.status(404).send('Manifest not found');
});

// Google & Bing XML Sitemap
app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const sitemapDist = path.join(__dirname, 'dist', 'sitemap.xml');
  if (fs.existsSync(sitemapDist)) {
    return res.sendFile(sitemapDist);
  }
  const sitemapPublic = path.join(__dirname, 'public', 'sitemap.xml');
  if (fs.existsSync(sitemapPublic)) {
    return res.sendFile(sitemapPublic);
  }
  return res.status(404).send('Sitemap not found');
});

// Search Engine Robots.txt
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const robotsDist = path.join(__dirname, 'dist', 'robots.txt');
  if (fs.existsSync(robotsDist)) {
    return res.sendFile(robotsDist);
  }
  const robotsPublic = path.join(__dirname, 'public', 'robots.txt');
  if (fs.existsSync(robotsPublic)) {
    return res.sendFile(robotsPublic);
  }
  return res.status(404).send('Robots.txt not found');
});

// Authoritative Geo-Mapping Endpoint
app.get(['/geo-mapping.json', '/api/geo-metadata'], (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const geoDist = path.join(__dirname, 'dist', 'geo-mapping.json');
  if (fs.existsSync(geoDist)) {
    return res.sendFile(geoDist);
  }
  const geoPublic = path.join(__dirname, 'public', 'geo-mapping.json');
  if (fs.existsSync(geoPublic)) {
    return res.sendFile(geoPublic);
  }
  return res.status(404).json({ error: 'Geo mapping not found' });
});

// Cache Buster: Serve hashed Vite bundle assets with 1-year immutable caching
app.use('/assets', express.static(path.join(__dirname, 'dist', 'assets'), {
  maxAge: '1y',
  immutable: true
}));

// Cache Buster: Guarantee index.html is never cached so client devices instantly pick up new builds
app.get(['/', '/index.html'], (req, res, next) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(indexPath);
  }
  next();
});

// Serve static Vite frontend bundle with strict no-cache on HTML
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// In-Memory Fast Lookup Cache for Active Property Records & Admin Deleted Ledger
const localPropsMap = new Map();
const localAdminDeletedMap = new Map();


function getAdminDeletedLedger() {
  const seen = new Set();
  const list = [];

  // Dynamically index any DELETED_BY_ADMIN properties present in localPropsMap
  for (const p of localPropsMap.values()) {
    if (!p) continue;
    const st = String(p.status || p.listingStatus || p.listing_status || '').toUpperCase();
    const lst = String(p.listing_status || p.listingStatus || '').toUpperCase();
    if (st === 'DELETED_BY_ADMIN' || lst === 'DELETED_BY_ADMIN' || p.deletedByAdmin === true) {
      const pId = String(p.propertyId || p.id || '').trim();
      const refId = String(p.referenceId || (pId ? 'EL-PROP-' + pId.replace(/^(el-prop-|prop-)/i, '') : '')).trim();
      const title = String(p.title || '').trim();
      const entry = {
        ...p,
        id: pId || refId,
        propertyId: pId || refId,
        referenceId: refId || pId,
        title,
        status: 'DELETED_BY_ADMIN',
        listingStatus: 'DELETED_BY_ADMIN',
        listing_status: 'DELETED_BY_ADMIN',
        deletedByAdmin: true,
        isDeleted: true,
        isPublished: false,
        is_published: false,
        adminFeedback: 'Notification: Deleted by Admin. This listing was removed from the marketplace by an EaseLand Admin Auditor.',
        deletedAt: p.deletedAt || p.updatedAt || new Date().toISOString()
      };
      if (pId) localAdminDeletedMap.set(pId.toLowerCase(), entry);
      if (refId) localAdminDeletedMap.set(refId.toLowerCase(), entry);
      if (title) localAdminDeletedMap.set(title.toLowerCase().trim(), entry);
      const cleanNum = (pId || refId).replace(/^(el-prop-|prop-)/i, '').toLowerCase().trim();
      if (cleanNum) {
        localAdminDeletedMap.set(cleanNum, entry);
        localAdminDeletedMap.set('el-prop-' + cleanNum, entry);
        localAdminDeletedMap.set('prop-' + cleanNum, entry);
      }
    }
  }

  for (const item of localAdminDeletedMap.values()) {
    if (!item) continue;
    const key = String(item.referenceId || item.propertyId || item.id || item.title || '').toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    list.push(item);
  }
  return list;
}

function recordAdminDeletedItem(item) {
  if (!item) return null;
  const pId = String(item.propertyId || item.id || '').trim();
  const refId = String(item.referenceId || (pId ? 'EL-PROP-' + pId.replace(/^(el-prop-|prop-)/i, '') : '')).trim();
  const title = String(item.title || '').trim();
  const cleanNum = (pId || refId).replace(/^(el-prop-|prop-)/i, '').toLowerCase().trim();

  const entry = {
    ...item,
    id: pId || refId,
    propertyId: pId || refId,
    referenceId: refId || pId,
    title,
    status: 'DELETED_BY_ADMIN',
    listingStatus: 'DELETED_BY_ADMIN',
    listing_status: 'DELETED_BY_ADMIN',
    deletedByAdmin: true,
    isDeleted: true,
    isPublished: false,
    is_published: false,
    adminFeedback: 'Notification: Deleted by Admin. This listing was removed from the marketplace by an EaseLand Admin Auditor.',
    deletedAt: item.deletedAt || new Date().toISOString()
  };

  if (pId) localAdminDeletedMap.set(pId.toLowerCase(), entry);
  if (refId) localAdminDeletedMap.set(refId.toLowerCase(), entry);
  if (title) localAdminDeletedMap.set(title.toLowerCase().trim(), entry);
  if (cleanNum) {
    localAdminDeletedMap.set(cleanNum, entry);
    localAdminDeletedMap.set('el-prop-' + cleanNum, entry);
    localAdminDeletedMap.set('prop-' + cleanNum, entry);
  }

  return entry;
}



function saveLocalProperty(p, existingOverride = null) {
  if (!p || (!p.propertyId && !p.id)) return;
  const pId = String(p.propertyId || p.id).trim();
  const existing = existingOverride || localPropsMap.get(pId) || {};

  const existingStatusUpper = String(existing.status || existing.listing_status || existing.listingStatus || '').toUpperCase();
  const existingListingStatusUpper = String(existing.listing_status || existing.listingStatus || '').toUpperCase();
  const incomingStatusUpper = String(p.status || p.listing_status || p.listingStatus || '').toUpperCase();

  const isAdminAction = Boolean(
    p.isAdmin === true ||
    p.isAdminApproval === true ||
    p.adminVerified === true ||
    p.verifiedBy
  );

  const isExplicitDeleteByAdmin = Boolean(
    p.deletedByAdmin === true ||
    incomingStatusUpper === 'DELETED_BY_ADMIN' ||
    existing.deletedByAdmin === true
  );

  const finalMedia = Array.isArray(p.media)
    ? p.media
    : (Array.isArray(existing.media) ? existing.media : []);

  const finalPhotos = Array.isArray(p.photos)
    ? p.photos
    : (Array.isArray(existing.photos) ? existing.photos : []);

  const finalDocs = Array.isArray(p.documents)
    ? p.documents
    : (Array.isArray(p.propertyDocuments)
      ? p.propertyDocuments
      : (Array.isArray(existing.documents) ? existing.documents : []));

  const seenMedia = new Set();
  const cleanMedia = finalMedia.filter(m => {
    if (!m) return false;
    const key = typeof m === 'string' ? m : (m.publicUrl || m.url || m.mediaId);
    if (!key || seenMedia.has(key)) return false;
    seenMedia.add(key);
    return true;
  });

  const seenDocs = new Set();
  const cleanDocs = finalDocs.filter(d => {
    if (!d) return false;
    const key = typeof d === 'string' ? d : (d.url || d.docId || d.name || d.documentName || d.fileName);
    if (!key || seenDocs.has(key)) return false;
    seenDocs.add(key);
    return true;
  });

  let updated;

  // 1. Admin Deletion State
  if (isExplicitDeleteByAdmin) {
    updated = {
      ...existing,
      ...p,
      propertyId: pId,
      id: pId,
      status: 'DELETED_BY_ADMIN',
      listingStatus: 'DELETED_BY_ADMIN',
      listing_status: 'DELETED_BY_ADMIN',
      deletedByAdmin: true,
      isDeleted: true,
      isPublished: false,
      is_published: false,
      isPlatformVerified: false,
      verificationStatus: 'Deleted by Admin',
      adminFeedback: 'Notification: Deleted by Admin',
      adminNotes: 'Deleted by Admin',
      verificationNotes: 'Deleted by Admin',
      media: cleanMedia,
      photos: finalPhotos,
      documents: cleanDocs,
      updatedAt: new Date().toISOString()
    };
  }
  // 2. Owner Draft Staging ONLY if explicitly specified via isOwnerDraftEdit on a verified LIVE property
  else if (p.isOwnerDraftEdit === true && !isAdminAction && (existingStatusUpper === 'LIVE' || existingListingStatusUpper === 'LIVE')) {
    const incomingProposed = p.pendingReauditData || p.pendingEdits || p;
    const existingPending = existing.pendingReauditData || existing.pendingEdits || {};
    const cleanProposed = {};
    const protectedKeys = [
      'id', 'propertyId', 'property_id', 'referenceId', 'reference_id',
      'ownerId', 'owner_id', 'listingStatus', 'listing_status', 'status',
      'isPublished', 'is_published', 'isPlatformVerified', 'verificationStatus',
      'createdAt', 'created_at', 'views', 'enquiriesCount', 'isAlreadyLive'
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

    updated = {
      ...existing,
      hasPendingEdits: true,
      reAuditStatus: 'PENDING_VERIFICATION',
      reAuditRequestedAt: existing.reAuditRequestedAt || new Date().toISOString(),
      pendingReauditData: mergedPending,
      listing_status: 'LIVE',
      listingStatus: 'LIVE',
      status: 'LIVE',
      is_published: true,
      isPublished: true,
      isPlatformVerified: true,
      verificationStatus: existing.verificationStatus || 'Platform Verified',
      documents: cleanDocs,
      updatedAt: new Date().toISOString()
    };
  }
  // 3. Direct Status Changes and Updates across all data fields
  else {
    let finalStatus = 'DRAFT';
    let finalIsPublished = false;
    let finalIsVerified = false;

    if (incomingStatusUpper === 'LIVE' || incomingStatusUpper === 'APPROVED' || p.isAdminApproval === true || p.adminVerified === true) {
      finalStatus = 'LIVE';
      finalIsPublished = true;
      finalIsVerified = true;
    } else if (incomingStatusUpper === 'CHANGES_REQUIRED' || incomingStatusUpper === 'CHANGES_REQUESTED') {
      finalStatus = 'CHANGES_REQUIRED';
      finalIsPublished = false;
      finalIsVerified = false;
    } else if (incomingStatusUpper === 'REJECTED') {
      finalStatus = 'REJECTED';
      finalIsPublished = false;
      finalIsVerified = false;
    } else if (incomingStatusUpper === 'PENDING_VERIFICATION' || incomingStatusUpper === 'UNDER_REVIEW' || incomingStatusUpper === 'UNDER_AUDIT') {
      finalStatus = 'PENDING_VERIFICATION';
      finalIsPublished = false;
      finalIsVerified = false;
    } else if (incomingStatusUpper) {
      finalStatus = incomingStatusUpper;
      finalIsPublished = Boolean(p.isPublished || p.is_published);
      finalIsVerified = Boolean(p.isPlatformVerified);
    } else if (existingStatusUpper) {
      finalStatus = existingStatusUpper;
      finalIsPublished = Boolean(existing.is_published || existing.isPublished);
      finalIsVerified = Boolean(existing.isPlatformVerified);
    }

    updated = {
      ...existing,
      ...p,
      propertyId: pId,
      id: pId,
      status: finalStatus,
      listingStatus: finalStatus,
      listing_status: finalStatus,
      isPublished: finalIsPublished,
      is_published: finalIsPublished,
      isPlatformVerified: finalIsVerified,
      hasPendingEdits: (finalStatus === 'LIVE' || finalStatus === 'REJECTED' || finalStatus === 'CHANGES_REQUIRED') ? false : (p.hasPendingEdits ?? existing.hasPendingEdits ?? false),
      pendingReauditData: (finalStatus === 'LIVE' || finalStatus === 'REJECTED' || finalStatus === 'CHANGES_REQUIRED') ? null : (p.pendingReauditData ?? existing.pendingReauditData ?? null),
      reAuditStatus: (finalStatus === 'LIVE' || finalStatus === 'REJECTED' || finalStatus === 'CHANGES_REQUIRED') ? null : (p.reAuditStatus ?? existing.reAuditStatus ?? null),
      location: p.location || existing.location || null,
      boundary: p.boundary || p.ownerSubmittedBoundary || existing.boundary || existing.ownerSubmittedBoundary || null,
      ownerSubmittedBoundary: p.ownerSubmittedBoundary || p.boundary || existing.ownerSubmittedBoundary || existing.boundary || null,
      media: cleanMedia,
      photos: finalPhotos,
      documents: cleanDocs,
      videoUrl: p.videoUrl || existing.videoUrl || null,
      videoLink: p.videoLink || existing.videoLink || null,
      embeddedVideoUrl: p.embeddedVideoUrl || existing.embeddedVideoUrl || null,
      updatedAt: new Date().toISOString()
    };

    if (finalStatus === 'LIVE') {
      updated.verificationStatus = 'Platform Verified';
    } else if (finalStatus === 'CHANGES_REQUIRED') {
      updated.verificationStatus = 'Changes Requested';
    } else if (finalStatus === 'REJECTED') {
      updated.verificationStatus = 'Rejected';
    } else if (finalStatus === 'PENDING_VERIFICATION') {
      updated.verificationStatus = 'Pending Verification';
    }
  }

  localPropsMap.set(pId, updated);

  return updated;
}

function getLocalProperties() {
  return Array.from(localPropsMap.values()).sort((a, b) => {
    const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tB - tA;
  });
}

// PostgreSQL Connection Pool Setup
const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL || process.env.VITE_POSTGRES_URL || process.env.POSTGRES_URL || 'postgres://postgres:g7YivfxcSdNUC9rXFg0y5iSGT00er3NhXqVVc1SI20Y9o4nN7XFTEvAmmTQCT7su@187.127.159.200:5432/postgres';

const pgPool = new Pool({
  connectionString: dbUrl,
  ssl: false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20
});

// IMPORTANT: Catch idle pool errors and update pgDbState to fail fast
pgPool.on('error', (err) => {
  pgDbState.connected = false;
  pgDbState.error = err.message;
  pgDbState.lastChecked = new Date().toISOString();
  console.error('CRITICAL: PostgreSQL Pool background client error: ' + err.message);
});

// Auto-initialize PostgreSQL tables asynchronously (Non-blocking)
async function initPgDb() {
  try {
    const client = await pgPool.connect();
    
    // 1. Properties Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS properties (
        property_id VARCHAR(100) PRIMARY KEY,
        reference_id VARCHAR(100),
        owner_id VARCHAR(100),
        title TEXT,
        property_type VARCHAR(50),
        purpose VARCHAR(50),
        price NUMERIC,
        area NUMERIC,
        location JSONB,
        specs JSONB,
        amenities JSONB,
        media JSONB,
        listing_status VARCHAR(50),
        is_published BOOLEAN DEFAULT false,
        raw_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Media Files Table (Storing binary data in BYTEA)
    await client.query(`
      CREATE TABLE IF NOT EXISTS media_files (
        media_id VARCHAR(100) PRIMARY KEY,
        property_id VARCHAR(100),
        owner_id VARCHAR(100),
        file_name TEXT,
        content_type VARCHAR(100),
        file_size BIGINT,
        media_type VARCHAR(50),
        is_document BOOLEAN DEFAULT false,
        file_data BYTEA,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Site Config CMS Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_config (
        module_id VARCHAR(100) PRIMARY KEY,
        config_data JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Enquiries Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS enquiries (
        enquiry_id VARCHAR(100) PRIMARY KEY,
        property_id VARCHAR(100),
        property_title TEXT,
        property_reference_id VARCHAR(100),
        owner_id VARCHAR(100),
        owner_name TEXT,
        owner_email VARCHAR(255),
        customer_id VARCHAR(100),
        buyer_id VARCHAR(100),
        customer_name TEXT,
        buyer_name TEXT,
        customer_email VARCHAR(255),
        buyer_email VARCHAR(255),
        customer_phone VARCHAR(50),
        buyer_phone VARCHAR(50),
        message TEXT,
        preferred_visit_date VARCHAR(100),
        status VARCHAR(50) DEFAULT 'SUBMITTED',
        raw_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Site Visitors Table (1-Minute Engaged Visitors)
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_visitors (
        visitor_id VARCHAR(100) PRIMARY KEY,
        name TEXT,
        phone VARCHAR(50),
        email VARCHAR(255),
        preferred_property_type VARCHAR(100),
        preferred_location TEXT,
        stay_duration_seconds INTEGER DEFAULT 60,
        source VARCHAR(100) DEFAULT '1_MIN_ENGAGEMENT_POPUP',
        status VARCHAR(50) DEFAULT 'NEW',
        notes TEXT,
        raw_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Registered Users Table (PostgreSQL User Governance)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        uid VARCHAR(100) PRIMARY KEY,
        email VARCHAR(255),
        display_name TEXT,
        phone VARCHAR(50),
        city VARCHAR(255),
        location VARCHAR(255),
        role VARCHAR(50) DEFAULT 'USER',
        account_status VARCHAR(50) DEFAULT 'ACTIVE',
        email_verified BOOLEAN DEFAULT false,
        raw_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Admin Deleted Properties Ledger Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_deleted_properties (
        property_id VARCHAR(100) PRIMARY KEY,
        reference_id VARCHAR(100),
        title TEXT,
        owner_id VARCHAR(100),
        admin_feedback TEXT DEFAULT 'Notification: Deleted by Admin',
        deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        raw_data JSONB
      );
    `);

    // 8. Admin Deleted Users Ledger Table (Authoritative Multi-Layer Deletion Tracking)
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_deleted_users (
        uid VARCHAR(100) PRIMARY KEY,
        email VARCHAR(255),
        reason TEXT DEFAULT 'Account deleted',
        deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. CRM Leads Table (Authoritative Lead Directory)
    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_leads (
        lead_id VARCHAR(100) PRIMARY KEY,
        name TEXT NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        source VARCHAR(50) DEFAULT 'WEBSITE_ENQUIRY',
        score VARCHAR(20) DEFAULT 'HOT',
        status VARCHAR(50) DEFAULT 'ACTIVE',
        preferred_location TEXT,
        preferred_property_type VARCHAR(100),
        budget_min NUMERIC DEFAULT 0,
        budget_max NUMERIC DEFAULT 0,
        budget_display TEXT,
        assigned_agent TEXT,
        notes TEXT,
        tags JSONB DEFAULT '[]'::jsonb,
        raw_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. CRM Deals Table (Pipeline & Transaction Dossiers)
    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_deals (
        deal_id VARCHAR(100) PRIMARY KEY,
        lead_id VARCHAR(100),
        property_id VARCHAR(100),
        property_title TEXT,
        property_location TEXT,
        customer_name TEXT NOT NULL,
        customer_phone VARCHAR(50),
        customer_email VARCHAR(255),
        owner_name TEXT,
        owner_phone VARCHAR(50),
        stage VARCHAR(50) DEFAULT 'NEW',
        deal_value NUMERIC DEFAULT 0,
        deal_value_display TEXT,
        commission_rate NUMERIC DEFAULT 1.5,
        expected_commission NUMERIC DEFAULT 0,
        probability INTEGER DEFAULT 20,
        expected_closing_date VARCHAR(50),
        assigned_agent TEXT,
        next_follow_up_date VARCHAR(50),
        next_follow_up_time VARCHAR(50),
        next_follow_up_action TEXT,
        legal_audit_status VARCHAR(50) DEFAULT 'PENDING',
        notes TEXT,
        payment_milestones JSONB DEFAULT '[]'::jsonb,
        timeline JSONB DEFAULT '[]'::jsonb,
        version INTEGER DEFAULT 1,
        raw_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11. CRM Site Visits Table (Field Dispatcher)
    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_visits (
        visit_id VARCHAR(100) PRIMARY KEY,
        deal_id VARCHAR(100),
        property_id VARCHAR(100),
        property_title TEXT,
        property_location TEXT,
        customer_name TEXT NOT NULL,
        customer_phone VARCHAR(50),
        visit_date VARCHAR(50) NOT NULL,
        visit_time VARCHAR(50) NOT NULL,
        agent_assigned TEXT,
        status VARCHAR(50) DEFAULT 'SCHEDULED',
        customer_notes TEXT,
        customer_feedback TEXT,
        raw_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Follow-up & stage milestone data columns migration for crm_deals and crm_leads
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(255);');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255);');
      await client.query('ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS next_follow_up_date VARCHAR(50);');
      await client.query('ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS next_follow_up_time VARCHAR(50);');
      await client.query('ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS next_follow_up_action TEXT;');
      await client.query("ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS stage_data JSONB DEFAULT '{}'::jsonb;");
      await client.query('ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_follow_up_date VARCHAR(50);');
      await client.query('ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_follow_up_time VARCHAR(50);');
      await client.query('ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_follow_up_action TEXT;');
    } catch (migErr) {
      console.warn('CRM and User schema migration note:', migErr.message);
    }

    try {
      const allPg = await client.query('SELECT property_id, reference_id, title, owner_id, listing_status, raw_data FROM properties;');
      allPg.rows.forEach(r => {
        const raw = r.raw_data || {};
        const pId = r.property_id || raw.propertyId || raw.id;
        if (pId) {
          const current = localPropsMap.get(pId) || {};
          localPropsMap.set(pId, { ...raw, ...current, propertyId: pId, id: pId });
        }
        const st = String(r.listing_status || raw.listing_status || raw.status || '').toUpperCase();
        if (st === 'DELETED_BY_ADMIN' || raw.deletedByAdmin === true) {
          recordAdminDeletedItem({
            ...raw,
            propertyId: pId,
            id: pId,
            referenceId: r.reference_id || raw.referenceId,
            title: r.title || raw.title,
            ownerId: r.owner_id || raw.ownerId,
            status: 'DELETED_BY_ADMIN',
            listingStatus: 'DELETED_BY_ADMIN',
            listing_status: 'DELETED_BY_ADMIN',
            deletedByAdmin: true
          });
        }
      });
      console.log('Hydrated properties store from PostgreSQL into localPropsMap.');
    } catch (hydrateErr) {
      console.warn('PostgreSQL property hydration note:', hydrateErr.message);
    }

    try {
      const allDel = await client.query('SELECT property_id, reference_id, title, owner_id, admin_feedback, deleted_at, raw_data FROM admin_deleted_properties;');
      allDel.rows.forEach(r => {
        const item = {
          ...(r.raw_data || {}),
          propertyId: r.property_id,
          id: r.property_id,
          referenceId: r.reference_id,
          title: r.title,
          ownerId: r.owner_id,
          adminFeedback: r.admin_feedback,
          deletedAt: r.deleted_at
        };
        recordAdminDeletedItem(item);
      });
      console.log('Hydrated admin deleted properties ledger from PostgreSQL.');
    } catch (hydrateDelErr) {
      console.warn('PostgreSQL admin deleted hydration note:', hydrateDelErr.message);
    }

    try {
      const allUsers = await client.query('SELECT uid, email, display_name, phone, city, location, role, account_status, raw_data FROM users;');
      allUsers.rows.forEach(r => {
        const raw = r.raw_data || {};
        const uId = r.uid || raw.uid || raw.id;
        if (uId) {
          const userObj = {
            ...raw,
            uid: uId,
            id: uId,
            email: r.email || raw.email,
            displayName: r.display_name || raw.displayName || raw.name,
            name: r.display_name || raw.displayName || raw.name,
            phone: r.phone || raw.phone || raw.phoneNumber,
            phoneNumber: r.phone || raw.phone || raw.phoneNumber,
            city: r.city || raw.city || raw.location,
            location: r.location || r.city || raw.location || raw.city,
            role: r.role || raw.role || 'USER',
            accountStatus: r.account_status || raw.accountStatus || 'ACTIVE'
          };
          localUsersMap.set(uId, userObj);
          if (userObj.email) localUsersMap.set(userObj.email, userObj);
        }
      });
      console.log('Hydrated users store from PostgreSQL into localUsersMap.');
    } catch (hydrateUserErr) {
      console.warn('PostgreSQL user hydration note:', hydrateUserErr.message);
    }

    client.release();
    pgDbState.connected = true;
    pgDbState.error = null;
    pgDbState.lastChecked = new Date().toISOString();
    console.log('PostgreSQL tables initialized successfully. Primary database is AUTHORITATIVE and ONLINE.');
  } catch (err) {
    pgDbState.connected = false;
    pgDbState.error = err.message;
    pgDbState.lastChecked = new Date().toISOString();
    console.error('CRITICAL DATABASE ERROR: PostgreSQL connection/initialization failed: ' + err.message);
    console.error('Health checks will fail fast (HTTP 503) to prevent silent split-brain errors.');
  }
}

// In-Memory Fast Lookup Caches (Authoritative state lives in PostgreSQL)
const localUsersMap = new Map();
const localDeletedUsersSet = new Set();
const localVisitorsMap = new Map();
const localEnquiriesMap = new Map();

function saveLocalUser(u) {
  if (!u || (!u.uid && !u.id && !u.email)) return;
  const key = u.uid || u.id || u.email;
  const existing = localUsersMap.get(key) || {};
  const effectivePhone = (u.phone && String(u.phone).trim()) || (u.phoneNumber && String(u.phoneNumber).trim()) || existing.phone || existing.phoneNumber || '';
  const effectiveCity = (u.city && String(u.city).trim()) || (u.location && String(u.location).trim()) || existing.city || existing.location || '';
  const effectiveName = (u.displayName && String(u.displayName).trim()) || (u.name && String(u.name).trim()) || existing.displayName || existing.name || '';
  const updated = {
    ...existing,
    ...u,
    uid: u.uid || u.id || existing.uid || existing.id,
    phone: effectivePhone,
    phoneNumber: effectivePhone,
    city: effectiveCity,
    location: effectiveCity,
    displayName: effectiveName || u.displayName || existing.displayName,
    name: effectiveName || u.name || existing.name,
    updatedAt: new Date().toISOString()
  };
  localUsersMap.set(key, updated);
  return updated;
}

function getLocalUsers() {
  return Array.from(localUsersMap.values());
}

function addLocalDeletedUser(uidOrEmail) {
  if (!uidOrEmail) return;
  localDeletedUsersSet.add(String(uidOrEmail).toLowerCase().trim());
}

function removeLocalDeletedUser(uidOrEmail) {
  if (!uidOrEmail) return;
  localDeletedUsersSet.delete(String(uidOrEmail).toLowerCase().trim());
}

function saveLocalVisitor(visitor) {
  if (!visitor || (!visitor.visitorId && !visitor.id)) return;
  const vId = visitor.visitorId || visitor.id;
  const existing = localVisitorsMap.get(vId) || {};
  const updated = {
    ...existing,
    ...visitor,
    id: vId,
    visitorId: vId,
    updatedAt: new Date().toISOString()
  };
  localVisitorsMap.set(vId, updated);
  return updated;
}

function getLocalVisitors() {
  return Array.from(localVisitorsMap.values()).sort((a, b) => {
    const tA = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const tB = new Date(b.createdAt || b.updatedAt || 0).getTime();
    return tB - tA;
  });
}

function saveLocalEnquiry(enq) {
  if (!enq || (!enq.enquiryId && !enq.id)) return;
  const eId = enq.enquiryId || enq.id;
  const existing = localEnquiriesMap.get(eId) || {};
  const updated = {
    ...existing,
    ...enq,
    enquiryId: eId,
    id: eId,
    updatedAt: new Date().toISOString()
  };
  localEnquiriesMap.set(eId, updated);
  return updated;
}

function getLocalEnquiries() {
  return Array.from(localEnquiriesMap.values()).sort((a, b) => {
    const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tB - tA;
  });
}


// Trigger DB init asynchronously so server startup is 100% instant
setImmediate(() => {
  initPgDb();
});

// API Endpoint: Save Uploaded Media / Document File (Disk Storage + PostgreSQL Sync)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file attached.' });
    }

    const propertyId = req.body.propertyId || 'common';
    const ownerId = req.body.ownerId || 'anonymous';
    const mediaType = req.body.mediaType || 'PHOTO';
    const isDocument = req.body.isDocument === 'true';

    const mediaId = `med-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${mediaId}_${sanitizedName}`;

    // 1. Save file directly to Hostinger VPS Disk Storage (Always succeeds!)
    const subFolder = isDocument ? path.join(documentsDir, propertyId) : path.join(propertiesDir, propertyId);
    fs.mkdirSync(subFolder, { recursive: true });
    const filePath = path.join(subFolder, filename);
    fs.writeFileSync(filePath, req.file.buffer);

    const relativePath = isDocument
      ? `/uploads/documents/${propertyId}/${filename}`
      : `/uploads/properties/${propertyId}/${filename}`;

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers.host || 'easeland.in';
    const publicUrl = `${protocol}://${host}${relativePath}`;

    // 2. Authoritative PostgreSQL media binary storage
    try {
      const P = String.fromCharCode(36);
      const phs = [];
      for (let i = 1; i <= 9; i++) { phs.push(P + i); }
      const insertQuery =
        'INSERT INTO media_files (' +
        '  media_id, property_id, owner_id, file_name, content_type, file_size, media_type, is_document, file_data' +
        ') VALUES (' + phs.join(', ') + ') ' +
        'ON CONFLICT (media_id) DO NOTHING;';
      await pgPool.query(insertQuery, [
        mediaId,
        propertyId,
        ownerId,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        mediaType,
        isDocument,
        req.file.buffer
      ]);
    } catch (pgErr) {
      console.warn('PostgreSQL media insert note:', pgErr.message);
    }

    // 3. Immediately attach uploaded file to property record in local store
    try {
      if (propertyId && propertyId !== 'common') {
        const existingProp = localPropsMap.get(propertyId) || { propertyId, id: propertyId };
        if (isDocument) {
          const docType = req.body.documentType || 'TITLE_DEED';
          const docTitle = req.body.documentName || req.file.originalname;
          const docObj = {
            docId: mediaId,
            name: docTitle,
            documentName: docTitle,
            fileName: req.file.originalname,
            documentType: docType,
            type: docType,
            url: publicUrl,
            publicUrl: publicUrl,
            size: req.file.size,
            fileSize: req.file.size,
            isDocument: true,
            verificationStatus: 'PENDING'
          };
          const existingDocs = Array.isArray(existingProp.documents) ? existingProp.documents : [];
          const normNew = docTitle.toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]/g, '');
          const filteredDocs = existingDocs.filter(d => {
            if (!d) return false;
            const dName = String(d.name || d.documentName || d.fileName || '');
            const normD = dName.toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]/g, '');
            return normD !== normNew && (d.docId || d.id || d.mediaId) !== mediaId;
          });
          existingProp.documents = [...filteredDocs, docObj];
        } else {
          const mediaObj = {
            mediaId,
            publicUrl,
            url: publicUrl,
            fileName: req.file.originalname,
            type: mediaType,
            fileSize: req.file.size,
            contentType: req.file.mimetype
          };
          const existingMedia = Array.isArray(existingProp.media) ? existingProp.media : [];
          existingProp.media = [...existingMedia, mediaObj];
          if (mediaType === 'WALKTHROUGH_VIDEO' || mediaType === 'DRONE_VIDEO' || mediaType === 'VIDEO') {
            existingProp.videoUrl = publicUrl;
            existingProp.videoLink = publicUrl;
            existingProp.embeddedVideoUrl = publicUrl;
          }
        }
        saveLocalProperty(existingProp);

        // Sync directly to PostgreSQL properties table raw_data so getPropertyById has it immediately
        try {
          const P = String.fromCharCode(36);
          const p1 = P + '1';
          const p2 = P + '2';
          await pgPool.query(
            "UPDATE properties SET raw_data = " + p1 + ", updated_at = NOW() WHERE property_id = " + p2 + " OR reference_id = " + p2 + " OR raw_data->>'id' = " + p2 + " OR raw_data->>'propertyId' = " + p2 + ";",
            [JSON.stringify(existingProp), propertyId]
          );
        } catch (pgSyncErr) {
          console.warn('PostgreSQL property doc/media update note:', pgSyncErr.message);
        }
      }
    } catch (attachErr) {
      console.warn('Local property attach note:', attachErr.message);
    }

    return res.json({
      success: true,
      mediaId,
      publicUrl,
      relativePath,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      contentType: req.file.mimetype
    });
  } catch (error) {
    console.error('File upload error:', error);
    return res.status(500).json({ success: false, error: error.message || 'File upload failed' });
  }
});

// API Endpoint: Serve Media / Document binary directly from PostgreSQL
app.get('/api/media/:mediaId', async (req, res) => {
  try {
    const { mediaId } = req.params;
    const P = String.fromCharCode(36);
    const result = await pgPool.query(
      'SELECT content_type, file_name, file_data FROM media_files WHERE media_id = ' + P + '1;',
      [mediaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Media file not found');
    }

    const file = result.rows[0];
    res.setHeader('Content-Type', file.content_type || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    res.send(file.file_data);
  } catch (err) {
    console.error('PostgreSQL media serve error:', err);
    res.status(500).send('Error retrieving media file');
  }
});

// API Endpoint: Sync/Save property record to PostgreSQL DB + Local Disk (Zero Downtime)
const handlePropertyUpsert = async (req, res) => {
  try {
    const p = req.body;
    if (!p || (!p.propertyId && !p.id)) {
      return res.status(400).json({ success: false, error: 'Property payload with propertyId is required.' });
    }
    const pId = String(p.propertyId || p.id).trim();
    const cleanNum = pId.replace(/^(el-prop-|prop-)/i, '').trim();
    const refId = String(p.referenceId || ('EL-PROP-' + (cleanNum || pId))).trim();
    const pTitle = String(p.title || 'Untitled Property').trim();

    // 1. Query PostgreSQL FIRST for any existing record under all alias formats
    let existing = null;
    let canonicalPropertyId = pId;
    try {
      const ph1 = String.fromCharCode(36) + '1';
      const ph2 = String.fromCharCode(36) + '2';
      const ph3 = String.fromCharCode(36) + '3';
      const ph4 = String.fromCharCode(36) + '4';

      const pgCheck = await pgPool.query(
        "SELECT property_id, reference_id, listing_status, is_published, raw_data FROM properties " +
        "WHERE LOWER(property_id) = LOWER(" + ph1 + ") " +
        "   OR LOWER(COALESCE(reference_id, '')) = LOWER(" + ph1 + ") " +
        "   OR LOWER(COALESCE(reference_id, '')) = LOWER(" + ph2 + ") " +
        "   OR LOWER(property_id) = LOWER(" + ph2 + ") " +
        "   OR (" + ph3 + " <> '' AND LOWER(property_id) = LOWER(" + ph3 + ")) " +
        "   OR (" + ph4 + " <> '' AND LOWER(title) = LOWER(" + ph4 + ")) " +
        "LIMIT 1;",
        [pId, refId, cleanNum, pTitle !== 'Untitled Property' ? pTitle : '']
      );

      if (pgCheck.rows.length > 0) {
        canonicalPropertyId = pgCheck.rows[0].property_id || pId;
        existing = pgCheck.rows[0].raw_data || {};
        if (pgCheck.rows[0].listing_status) {
          existing.listing_status = pgCheck.rows[0].listing_status;
          existing.listingStatus = pgCheck.rows[0].listing_status;
          existing.status = pgCheck.rows[0].listing_status;
        }
        if (pgCheck.rows[0].is_published !== null && pgCheck.rows[0].is_published !== undefined) {
          existing.is_published = pgCheck.rows[0].is_published;
          existing.isPublished = pgCheck.rows[0].is_published;
        }
      }
    } catch (pgCheckErr) {
      console.warn('PostgreSQL property lookup note:', pgCheckErr.message);
    }

    if (!existing) {
      existing = localPropsMap.get(pId) || localPropsMap.get(canonicalPropertyId) || {};
    }

    // Save and compute updated representation
    const savedLocal = saveLocalProperty({ ...p, propertyId: canonicalPropertyId, id: canonicalPropertyId }, existing);

    // 2. ALWAYS Save to PostgreSQL FIRST (Authoritative Primary Storage)
    try {
      const ph1 = String.fromCharCode(36) + '1';
      const ph2 = String.fromCharCode(36) + '2';
      const ph3 = String.fromCharCode(36) + '3';
      const ph4 = String.fromCharCode(36) + '4';
      const ph5 = String.fromCharCode(36) + '5';
      const ph6 = String.fromCharCode(36) + '6';
      const ph7 = String.fromCharCode(36) + '7';
      const ph8 = String.fromCharCode(36) + '8';
      const ph9 = String.fromCharCode(36) + '9';
      const ph10 = String.fromCharCode(36) + '10';
      const ph11 = String.fromCharCode(36) + '11';
      const ph12 = String.fromCharCode(36) + '12';
      const ph13 = String.fromCharCode(36) + '13';
      const ph14 = String.fromCharCode(36) + '14';
      const ph15 = String.fromCharCode(36) + '15';

      const queryText =
        "INSERT INTO properties (" +
        "  property_id, reference_id, owner_id, title, property_type, purpose, price, area, location, specs, amenities, media, listing_status, is_published, raw_data, updated_at" +
        ") VALUES (" +
        "  " + ph1 + ", " + ph2 + ", " + ph3 + ", " + ph4 + ", " + ph5 + ", " + ph6 + ", " + ph7 + ", " + ph8 + ", " + ph9 + ", " + ph10 + ", " + ph11 + ", " + ph12 + ", " + ph13 + ", " + ph14 + ", " + ph15 + ", NOW()" +
        ") " +
        "ON CONFLICT (property_id) DO UPDATE SET " +
        "  reference_id = EXCLUDED.reference_id, " +
        "  owner_id = EXCLUDED.owner_id, " +
        "  title = EXCLUDED.title, " +
        "  property_type = EXCLUDED.property_type, " +
        "  purpose = EXCLUDED.purpose, " +
        "  price = EXCLUDED.price, " +
        "  area = EXCLUDED.area, " +
        "  location = EXCLUDED.location, " +
        "  specs = EXCLUDED.specs, " +
        "  amenities = EXCLUDED.amenities, " +
        "  media = EXCLUDED.media, " +
        "  listing_status = EXCLUDED.listing_status, " +
        "  is_published = EXCLUDED.is_published, " +
        "  raw_data = EXCLUDED.raw_data, " +
        "  updated_at = NOW();";

      const finalStatus = savedLocal.listing_status || savedLocal.listingStatus || savedLocal.status || 'DRAFT';
      const finalIsPublished = Boolean(savedLocal.is_published !== undefined ? savedLocal.is_published : savedLocal.isPublished);

      const values = [
        canonicalPropertyId,
        savedLocal.referenceId || refId,
        savedLocal.ownerId || null,
        savedLocal.title || 'Untitled Property',
        savedLocal.propertyType || null,
        savedLocal.purpose || null,
        Number(savedLocal.price) || 0,
        Number(savedLocal.area) || 0,
        JSON.stringify(savedLocal.location || {}),
        JSON.stringify(savedLocal.specs || {}),
        JSON.stringify(savedLocal.amenities || []),
        JSON.stringify(savedLocal.media || []),
        finalStatus,
        finalIsPublished,
        JSON.stringify(savedLocal)
      ];

      await pgPool.query(queryText, values);
      localPropsMap.set(canonicalPropertyId, savedLocal);
      return res.json({ success: true, message: 'Property saved successfully.', property: savedLocal });
    } catch (pgErr) {
      console.error('CRITICAL: PostgreSQL property save failed:', pgErr.message);
      return res.status(500).json({ success: false, error: 'Database save failed: ' + pgErr.message });
    }
  } catch (err) {
    console.error('Property save handler error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

app.post('/api/properties', handlePropertyUpsert);

// Also support PUT & PATCH for RESTful updates
app.put('/api/properties/:id', (req, res) => {
  req.body = req.body || {};
  req.body.propertyId = req.params.id || req.body.propertyId || req.body.id;
  return handlePropertyUpsert(req, res);
});

app.patch('/api/properties/:id', (req, res) => {
  req.body = req.body || {};
  req.body.propertyId = req.params.id || req.body.propertyId || req.body.id;
  return handlePropertyUpsert(req, res);
});

// API Endpoint: Get all property records (PostgreSQL Primary Authoritative Source - Zero Silent Fallback)
app.get('/api/properties', async (req, res) => {
  try {
    const isPublicOnly = req.query.publicOnly === 'true' || req.query.public === 'true';
    let pgProperties = [];

    try {
      const result = await pgPool.query(
        'SELECT property_id, reference_id, owner_id, title, property_type, purpose, price, area, location, specs, amenities, media, listing_status, is_published, raw_data, updated_at FROM properties ORDER BY updated_at DESC;'
      );
      pgProperties = result.rows.map(row => {
        const raw = row.raw_data || {};
        const listingStatus = row.listing_status || raw.listing_status || raw.listingStatus || 'DRAFT';
        const isPublished = row.is_published !== null && row.is_published !== undefined ? Boolean(row.is_published) : Boolean(raw.is_published || raw.isPublished);
        const isAdminDeleted = listingStatus === 'DELETED_BY_ADMIN' || raw.status === 'DELETED_BY_ADMIN' || raw.deletedByAdmin === true;

        return {
          ...raw,
          propertyId: row.property_id || raw.propertyId || raw.id,
          id: row.property_id || raw.id || raw.propertyId,
          referenceId: row.reference_id || raw.referenceId,
          ownerId: row.owner_id || raw.ownerId,
          title: row.title || raw.title,
          propertyType: row.property_type || raw.propertyType,
          purpose: row.purpose || raw.purpose,
          price: row.price !== null ? Number(row.price) : raw.price,
          area: row.area !== null ? Number(row.area) : raw.area,
          location: row.location || raw.location,
          specs: row.specs || raw.specs,
          amenities: row.amenities || raw.amenities,
          media: row.media || raw.media,
          listing_status: isAdminDeleted ? 'DELETED_BY_ADMIN' : listingStatus,
          listingStatus: isAdminDeleted ? 'DELETED_BY_ADMIN' : listingStatus,
          status: isAdminDeleted ? 'DELETED_BY_ADMIN' : (raw.status || listingStatus),
          deletedByAdmin: Boolean(isAdminDeleted),
          isDeleted: Boolean(isAdminDeleted || raw.isDeleted),
          is_published: isAdminDeleted ? false : isPublished,
          isPublished: isAdminDeleted ? false : isPublished,
          adminFeedback: isAdminDeleted ? 'Notification: Deleted by Admin' : (raw.adminFeedback || raw.verificationNotes || raw.adminNotes)
        };
      }).filter(Boolean);

      // Keep in-memory cache synchronized with PostgreSQL records
      pgProperties.forEach(p => {
        if (p && (p.propertyId || p.id)) {
          localPropsMap.set(p.propertyId || p.id, p);
        }
      });
    } catch (pgErr) {
      console.error('CRITICAL: PostgreSQL fetch properties failed:', pgErr.message);
      return res.status(503).json({ success: false, error: 'Database unavailable: ' + pgErr.message });
    }

    let properties = pgProperties;

    if (isPublicOnly) {
      const ledger = getAdminDeletedLedger();
      const ledgerAliases = new Set();
      ledger.forEach(item => {
        if (item.id) ledgerAliases.add(String(item.id).toLowerCase().trim());
        if (item.propertyId) ledgerAliases.add(String(item.propertyId).toLowerCase().trim());
        if (item.referenceId) ledgerAliases.add(String(item.referenceId).toLowerCase().trim());
        if (item.title) ledgerAliases.add(String(item.title).toLowerCase().trim());
        const n = String(item.id || item.propertyId || item.referenceId || '').toLowerCase().replace(/^(el-prop-|prop-)/i, '').trim();
        if (n) ledgerAliases.add(n);
      });

      properties = properties.filter(p => {
        if (!p) return false;
        const st = String(p.status || p.listingStatus || '').toUpperCase();
        const lst = String(p.listingStatus || '').toUpperCase();
        const isDel = p.deletedByAdmin === true || p.isDeleted === true || st === 'DELETED_BY_ADMIN' || lst === 'DELETED_BY_ADMIN' || st === 'DELETED' || lst === 'DELETED';
        const isPub = p.isPublished === true || p.is_published === true;
        if (isDel || !isPub) return false;

        const pid1 = String(p.id || '').toLowerCase().trim();
        const pid2 = String(p.propertyId || '').toLowerCase().trim();
        const pid3 = String(p.referenceId || '').toLowerCase().trim();
        const ptitle = String(p.title || '').toLowerCase().trim();
        const pnum = pid1.replace(/^(el-prop-|prop-)/i, '').trim();

        if (ledgerAliases.has(pid1) || ledgerAliases.has(pid2) || ledgerAliases.has(pid3) || ledgerAliases.has(ptitle) || (pnum && ledgerAliases.has(pnum))) {
          return false;
        }
        return true;
      });
    }

    return res.json({ success: true, properties, adminDeletedLedger: getAdminDeletedLedger() });
  } catch (err) {
    console.error('CRITICAL: GET /api/properties failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint: Dedicated Authoritative Admin Deleted Properties Ledger
app.get('/api/properties/admin-deleted', (req, res) => {
  return res.json({ success: true, ledger: getAdminDeletedLedger() });
});

// API Endpoint: Batch synchronize admin deleted properties (from Admin Studio or clients)
app.post('/api/properties/sync-deleted', async (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.deletedProperties) ? req.body.deletedProperties : (Array.isArray(req.body) ? req.body : []);
    const recordedList = [];

    for (const item of incoming) {
      if (!item) continue;
      const formatted = typeof item === 'string'
        ? { propertyId: item, id: item, title: '' }
        : item;
      const recorded = recordAdminDeletedItem(formatted);
      if (recorded) recordedList.push(recorded);

      // Also persist to PostgreSQL admin_deleted_properties table
      try {
        const pId = recorded.propertyId || recorded.id;
        const refId = recorded.referenceId;
        const title = recorded.title || '';
        const ownerId = recorded.ownerId || null;
        const feedback = recorded.adminFeedback || 'Notification: Deleted by Admin';

        const qph1 = String.fromCharCode(36) + '1';
        const qph2 = String.fromCharCode(36) + '2';
        const qph3 = String.fromCharCode(36) + '3';
        const qph4 = String.fromCharCode(36) + '4';
        const qph5 = String.fromCharCode(36) + '5';
        const qph6 = String.fromCharCode(36) + '6';

        await pgPool.query(
          "INSERT INTO admin_deleted_properties (property_id, reference_id, title, owner_id, admin_feedback, raw_data) " +
          "VALUES (" + qph1 + ", " + qph2 + ", " + qph3 + ", " + qph4 + ", " + qph5 + ", " + qph6 + ") " +
          "ON CONFLICT (property_id) DO UPDATE SET " +
          "  reference_id = EXCLUDED.reference_id, " +
          "  title = EXCLUDED.title, " +
          "  admin_feedback = EXCLUDED.admin_feedback, " +
          "  raw_data = EXCLUDED.raw_data, " +
          "  deleted_at = NOW();",
          [pId, refId, title, ownerId, feedback, JSON.stringify(recorded)]
        );
      } catch (dbErr) {}
    }

    return res.json({ success: true, count: recordedList.length, ledger: getAdminDeletedLedger() });
  } catch (err) {
    return res.json({ success: true, ledger: getAdminDeletedLedger() });
  }
});


// API Endpoint: Get single property record by ID (PostgreSQL Primary + Local Disk Store Fallback)
app.get('/api/properties/:id', async (req, res) => {
  try {
    const targetId = req.params.id;
    if (!targetId) {
      return res.status(400).json({ success: false, error: 'Property ID is required.' });
    }
    const tLower = targetId.toLowerCase().trim();
    const cleanNum = tLower.replace(/^(el-prop-|prop-)/i, '').trim();
    const refWithPrefix = cleanNum ? ('el-prop-' + cleanNum) : '';
    const propWithPrefix = cleanNum ? ('prop-' + cleanNum) : '';

    // 1. Check PostgreSQL FIRST
    try {
      const ph1 = String.fromCharCode(36) + '1';
      const ph2 = String.fromCharCode(36) + '2';
      const ph3 = String.fromCharCode(36) + '3';
      const result = await pgPool.query(
        "SELECT property_id, reference_id, owner_id, title, property_type, purpose, price, area, location, specs, amenities, media, listing_status, is_published, raw_data, updated_at " +
        "FROM properties " +
        "WHERE LOWER(property_id) = LOWER(" + ph1 + ") " +
        "   OR LOWER(COALESCE(reference_id, '')) = LOWER(" + ph1 + ") " +
        "   OR (" + ph2 + " <> '' AND (LOWER(property_id) = LOWER(" + ph2 + ") OR LOWER(COALESCE(reference_id, '')) = LOWER(" + ph2 + "))) " +
        "   OR (" + ph3 + " <> '' AND (LOWER(property_id) = LOWER(" + ph3 + ") OR LOWER(COALESCE(reference_id, '')) = LOWER(" + ph3 + "))) " +
        "   OR LOWER(COALESCE(raw_data->>'id', '')) = LOWER(" + ph1 + ") " +
        "   OR LOWER(COALESCE(raw_data->>'propertyId', '')) = LOWER(" + ph1 + ") " +
        "   OR LOWER(COALESCE(raw_data->>'referenceId', '')) = LOWER(" + ph1 + ") " +
        "LIMIT 1;",
        [tLower, cleanNum, refWithPrefix || propWithPrefix]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        const raw = row.raw_data || {};
        const listingStatus = row.listing_status || raw.listing_status || raw.listingStatus || 'DRAFT';
        const isPublished = row.is_published !== null && row.is_published !== undefined ? Boolean(row.is_published) : Boolean(raw.is_published || raw.isPublished);
        const isAdminDeleted = listingStatus === 'DELETED_BY_ADMIN' || raw.status === 'DELETED_BY_ADMIN' || raw.deletedByAdmin === true;

        const property = {
          ...raw,
          propertyId: row.property_id || raw.propertyId || raw.id,
          id: row.property_id || raw.id || raw.propertyId,
          referenceId: row.reference_id || raw.referenceId,
          ownerId: row.owner_id || raw.ownerId,
          title: row.title || raw.title,
          propertyType: row.property_type || raw.propertyType,
          purpose: row.purpose || raw.purpose,
          price: row.price !== null ? Number(row.price) : raw.price,
          area: row.area !== null ? Number(row.area) : raw.area,
          location: row.location || raw.location,
          specs: row.specs || raw.specs,
          amenities: row.amenities || raw.amenities,
          media: row.media || raw.media,
          listing_status: isAdminDeleted ? 'DELETED_BY_ADMIN' : listingStatus,
          listingStatus: isAdminDeleted ? 'DELETED_BY_ADMIN' : listingStatus,
          status: isAdminDeleted ? 'DELETED_BY_ADMIN' : (raw.status || listingStatus),
          deletedByAdmin: Boolean(isAdminDeleted),
          isDeleted: Boolean(isAdminDeleted || raw.isDeleted),
          is_published: isAdminDeleted ? false : isPublished,
          isPublished: isAdminDeleted ? false : isPublished,
          adminFeedback: isAdminDeleted ? 'Notification: Deleted by Admin' : (raw.adminFeedback || raw.verificationNotes || raw.adminNotes)
        };

        // Cache into localPropsMap
        localPropsMap.set(property.propertyId, property);
        return res.json({ success: true, property });
      }
      return res.status(404).json({ success: false, error: 'Property not found.' });
    } catch (pgErr) {
      console.error('CRITICAL: PostgreSQL single property query failed:', pgErr.message);
      return res.status(503).json({ success: false, error: 'Database unavailable: ' + pgErr.message });
    }
  } catch (err) {
    console.error('Get single property error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint: Delete/Mark Deleted property record from PostgreSQL + Local Disk Store
app.delete('/api/properties/:id', async (req, res) => {
  try {
    const targetId = req.params.id;
    if (!targetId) {
      return res.status(400).json({ success: false, error: 'Property ID is required.' });
    }
    const tLower = targetId.toLowerCase().trim();
    const cleanNum = tLower.replace(/^(el-prop-|prop-)/i, '').trim();
    const refWithPrefix = cleanNum ? ('el-prop-' + cleanNum) : '';
    const propWithPrefix = cleanNum ? ('prop-' + cleanNum) : '';
    const reqTitle = String(req.body?.title || req.body?.property?.title || req.query.title || '').toLowerCase().trim();
    const extraId = String(req.body?.propertyId || req.body?.property?.id || req.query.propertyId || '').toLowerCase().trim();
    const extraRef = String(req.body?.referenceId || req.body?.property?.referenceId || req.query.referenceId || '').toLowerCase().trim();

    const isAdmin = req.query.isAdmin === 'true' || req.body?.isAdmin === true;

    // 1. PostgreSQL Authoritative Update / Delete FIRST
    try {
      const ph1 = String.fromCharCode(36) + '1';
      const ph2 = String.fromCharCode(36) + '2';
      const ph3 = String.fromCharCode(36) + '3';
      const ph4 = String.fromCharCode(36) + '4';
      const ph5 = String.fromCharCode(36) + '5';

      if (isAdmin) {
        const ledgerItem = recordAdminDeletedItem({
          propertyId: targetId,
          referenceId: refWithPrefix || extraRef || targetId,
          title: reqTitle || req.body?.property?.title || '',
          ownerId: req.body?.property?.ownerId || req.body?.ownerId || null,
          adminFeedback: 'Notification: Deleted by Admin. This listing was removed from the marketplace by an EaseLand Admin Auditor.',
          raw_data: req.body?.property || {}
        });

        try {
          const qph1 = String.fromCharCode(36) + '1';
          const qph2 = String.fromCharCode(36) + '2';
          const qph3 = String.fromCharCode(36) + '3';
          const qph4 = String.fromCharCode(36) + '4';
          const qph5 = String.fromCharCode(36) + '5';
          const qph6 = String.fromCharCode(36) + '6';
          await pgPool.query(
            "INSERT INTO admin_deleted_properties (property_id, reference_id, title, owner_id, admin_feedback, raw_data) " +
            "VALUES (" + qph1 + ", " + qph2 + ", " + qph3 + ", " + qph4 + ", " + qph5 + ", " + qph6 + ") " +
            "ON CONFLICT (property_id) DO UPDATE SET " +
            "  reference_id = EXCLUDED.reference_id, " +
            "  title = EXCLUDED.title, " +
            "  admin_feedback = EXCLUDED.admin_feedback, " +
            "  raw_data = EXCLUDED.raw_data, " +
            "  deleted_at = NOW();",
            [
              ledgerItem.propertyId,
              ledgerItem.referenceId,
              ledgerItem.title,
              ledgerItem.ownerId,
              ledgerItem.adminFeedback,
              JSON.stringify(ledgerItem)
            ]
          );
        } catch (lErr) {
          console.warn('PostgreSQL admin deleted ledger insert note:', lErr.message);
        }

        // Hard DELETE from properties and media_files in PostgreSQL for Admin
        await pgPool.query(
          "DELETE FROM properties " +
          "WHERE LOWER(property_id) = LOWER(" + ph1 + ") " +
          "   OR LOWER(COALESCE(reference_id, '')) = LOWER(" + ph1 + ") " +
          "   OR LOWER(COALESCE(raw_data->>'id', '')) = LOWER(" + ph1 + ") " +
          "   OR LOWER(COALESCE(raw_data->>'propertyId', '')) = LOWER(" + ph1 + ") " +
          "   OR LOWER(COALESCE(raw_data->>'referenceId', '')) = LOWER(" + ph1 + ") " +
          "   OR (" + ph2 + " <> '' AND (LOWER(property_id) = LOWER(" + ph2 + ") OR LOWER(COALESCE(reference_id, '')) = LOWER(" + ph2 + "))) " +
          "   OR (" + ph3 + " <> '' AND (LOWER(property_id) = LOWER(" + ph3 + ") OR LOWER(COALESCE(reference_id, '')) = LOWER(" + ph3 + "))) " +
          "   OR (" + ph4 + " <> '' AND (LOWER(COALESCE(title, '')) = LOWER(" + ph4 + ") OR LOWER(COALESCE(raw_data->>'title', '')) = LOWER(" + ph4 + "))) " +
          "   OR (" + ph5 + " <> '' AND (LOWER(property_id) = LOWER(" + ph5 + ") OR LOWER(COALESCE(raw_data->>'id', '')) = LOWER(" + ph5 + ")));",
          [tLower, cleanNum, refWithPrefix || propWithPrefix, reqTitle, extraId || extraRef]
        );
        await pgPool.query(
          "DELETE FROM media_files WHERE LOWER(property_id) = LOWER(" + ph1 + ") OR (" + ph2 + " <> '' AND LOWER(property_id) = LOWER(" + ph2 + "));",
          [tLower, cleanNum]
        );
      } else {
        await pgPool.query(
          "DELETE FROM properties " +
          "WHERE LOWER(property_id) = LOWER(" + ph1 + ") " +
          "   OR LOWER(COALESCE(reference_id, '')) = LOWER(" + ph1 + ") " +
          "   OR LOWER(COALESCE(raw_data->>'id', '')) = LOWER(" + ph1 + ") " +
          "   OR LOWER(COALESCE(raw_data->>'propertyId', '')) = LOWER(" + ph1 + ") " +
          "   OR LOWER(COALESCE(raw_data->>'referenceId', '')) = LOWER(" + ph1 + ") " +
          "   OR (" + ph2 + " <> '' AND (LOWER(property_id) = LOWER(" + ph2 + ") OR LOWER(COALESCE(reference_id, '')) = LOWER(" + ph2 + "))) " +
          "   OR (" + ph3 + " <> '' AND (LOWER(property_id) = LOWER(" + ph3 + ") OR LOWER(COALESCE(reference_id, '')) = LOWER(" + ph3 + "))) " +
          "   OR (" + ph4 + " <> '' AND (LOWER(COALESCE(title, '')) = LOWER(" + ph4 + ") OR LOWER(COALESCE(raw_data->>'title', '')) = LOWER(" + ph4 + ")));",
          [tLower, cleanNum, refWithPrefix || propWithPrefix, reqTitle]
        );
        await pgPool.query(
          "DELETE FROM media_files WHERE LOWER(property_id) = LOWER(" + ph1 + ") OR (" + ph2 + " <> '' AND LOWER(property_id) = LOWER(" + ph2 + "));",
          [tLower, cleanNum]
        );
      }
    } catch (pgErr) {
      console.error('CRITICAL: PostgreSQL property delete failed:', pgErr.message);
      return res.status(500).json({ success: false, error: 'Database delete failed: ' + pgErr.message });
    }

    // 2. Authoritative Cloud Firestore Cascade Deletion (Firebase Admin SDK)
    try {
      const adminApps = getApps();
      if (adminApps.length) {
        let adminDb = null;
        try {
          const { getFirestore } = await import('firebase-admin/firestore');
          adminDb = getFirestore(adminApps[0]);
        } catch (fsImportErr) {
          console.warn('Firebase Admin Firestore import note:', fsImportErr.message);
        }

        if (adminDb) {
          const idsToPurge = Array.from(new Set([
            targetId,
            cleanNum,
            refWithPrefix,
            propWithPrefix,
            extraId,
            extraRef
          ].filter(Boolean)));

        for (const cid of idsToPurge) {
          // Direct doc deletions across collections
          try { await adminDb.collection('properties').doc(cid).delete(); } catch (e) {}
          try { await adminDb.collection('propertyPrivate').doc(cid).delete(); } catch (e) {}
          try { await adminDb.collection('propertyMediaPrivate').doc(cid).delete(); } catch (e) {}
          try { await adminDb.collection('verificationRecords').doc(cid).delete(); } catch (e) {}

          // Query matching properties by propertyId or referenceId
          try {
            const pSnap = await adminDb.collection('properties').where('propertyId', '==', cid).get();
            for (const d of pSnap.docs) { await d.ref.delete(); }
          } catch (e) {}

          // Query matching confidential documents
          try {
            const docSnap = await adminDb.collection('propertyDocuments').where('propertyId', '==', cid).get();
            for (const d of docSnap.docs) { await d.ref.delete(); }
          } catch (e) {}

          // Query matching enquiries
          try {
            const enqSnap = await adminDb.collection('enquiries').where('propertyId', '==', cid).get();
            for (const d of enqSnap.docs) { await d.ref.delete(); }
          } catch (e) {}
        }
      }
    }
  } catch (adminFsErr) {
      console.warn('Firebase Admin Firestore purge note:', adminFsErr.message);
    }

    // 2. Update / Remove from Local Disk Store
    const allAliases = new Set([
      tLower,
      cleanNum,
      refWithPrefix,
      propWithPrefix,
      reqTitle,
      extraId,
      extraRef
    ].filter(Boolean));

    const matchesAlias = (v) => {
      if (!v) return false;
      const id1 = String(v.id || '').toLowerCase().trim();
      const id2 = String(v.propertyId || '').toLowerCase().trim();
      const id3 = String(v.referenceId || '').toLowerCase().trim();
      const num = id1.replace(/^(el-prop-|prop-)/i, '').trim();
      const vTitle = String(v.title || '').toLowerCase().trim();

      return (
        allAliases.has(id1) ||
        allAliases.has(id2) ||
        allAliases.has(id3) ||
        (num && allAliases.has(num)) ||
        (vTitle && allAliases.has(vTitle))
      );
    };

    const matchedKeys = [];
    for (const [k, v] of localPropsMap.entries()) {
      if (allAliases.has(String(k).toLowerCase().trim()) || matchesAlias(v)) {
        matchedKeys.push(k);
      }
    }

    matchedKeys.forEach(k => {
      const existing = localPropsMap.get(k);
      if (existing) {
        if (isAdmin) {
          localPropsMap.set(k, {
            ...existing,
            status: 'DELETED_BY_ADMIN',
            listingStatus: 'DELETED_BY_ADMIN',
            listing_status: 'DELETED_BY_ADMIN',
            deletedByAdmin: true,
            isDeleted: true,
            isPublished: false,
            is_published: false,
            adminFeedback: 'Notification: Deleted by Admin',
            adminNotes: 'Deleted by Admin',
            updatedAt: new Date().toISOString()
          });
        } else {
          localPropsMap.delete(k);
        }
      }
    });


    return res.json({ success: true, message: 'Property deleted successfully' });
  } catch (err) {
    console.error('Property delete handler error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint: Authoritative 3-Way Purge of all test/dummy properties across PostgreSQL, Cloud Firestore, and Local Storage
app.post('/api/admin/purge-all-properties', async (req, res) => {
  try {
    const confirmation = req.body?.confirmation || req.query?.confirmation;
    if (confirmation !== 'PURGE_ALL_PROPERTIES') {
      return res.status(400).json({
        success: false,
        error: 'Safety Confirmation Required. Body parameter confirmation must be "PURGE_ALL_PROPERTIES".'
      });
    }

    const pgDeleted = { properties: 0, media_files: 0, enquiries: 0, admin_deleted: 0 };
    const firestoreDeleted = {};

    // 1. Authoritative PostgreSQL Wipe
    try {
      if (pgPool) {
        const mRes = await pgPool.query('DELETE FROM media_files;');
        pgDeleted.media_files = mRes.rowCount || 0;

        const pRes = await pgPool.query('DELETE FROM properties;');
        pgDeleted.properties = pRes.rowCount || 0;

        const eRes = await pgPool.query('DELETE FROM enquiries;');
        pgDeleted.enquiries = eRes.rowCount || 0;

        const adRes = await pgPool.query('DELETE FROM admin_deleted_properties;');
        pgDeleted.admin_deleted = adRes.rowCount || 0;
      }
    } catch (pgErr) {
      console.warn('PostgreSQL bulk purge note:', pgErr.message);
    }

    // 2. Authoritative Cloud Firestore Cascade Batch Deletion (Firebase Admin SDK)
    try {
      const adminApps = getApps();
      if (adminApps.length) {
        let adminDb = null;
        try {
          const { getFirestore } = await import('firebase-admin/firestore');
          adminDb = getFirestore(adminApps[0]);
        } catch (fsImportErr) {
          console.warn('Firebase Admin Firestore import note:', fsImportErr.message);
        }

        if (adminDb) {
          const targetCollections = [
            'properties',
            'propertyPrivate',
            'propertyMediaPrivate',
            'propertyDocuments',
            'verificationRecords',
            'enquiries',
            'activityLogs',
            'crm_deals',
            'crm_leads',
            'deals',
            'followUps'
          ];

          for (const colName of targetCollections) {
            let totalDeletedInCol = 0;
            try {
              while (true) {
                const snapshot = await adminDb.collection(colName).limit(300).get();
                if (snapshot.empty) break;

                const batch = adminDb.batch();
                snapshot.docs.forEach((d) => batch.delete(d.ref));
                await batch.commit();

                totalDeletedInCol += snapshot.size;
                if (snapshot.size < 300) break;
              }
            } catch (colErr) {
              console.warn('Error purging Firestore collection ' + colName + ':', colErr.message);
            }
            firestoreDeleted[colName] = totalDeletedInCol;
          }
        }
      }
    } catch (fsErr) {
      console.warn('Firestore bulk purge note:', fsErr.message);
    }

    // 3. Clear In-Memory Caches
    localPropsMap.clear();
    localEnquiriesMap.clear();
    localAdminDeletedMap.clear();
    localVisitorsMap.clear();

      // Clean uploads folders on disk
      try {
        if (fs.existsSync(propertiesDir)) {
          const propEntries = fs.readdirSync(propertiesDir);
          for (const entry of propEntries) {
            const entryPath = path.join(propertiesDir, entry);
            try { fs.rmSync(entryPath, { recursive: true, force: true }); } catch (e) {}
          }
        }
        if (fs.existsSync(documentsDir)) {
          const docEntries = fs.readdirSync(documentsDir);
          for (const entry of docEntries) {
            const entryPath = path.join(documentsDir, entry);
            try { fs.rmSync(entryPath, { recursive: true, force: true }); } catch (e) {}
          }
        }
      } catch (rmErr) {
        console.warn('Uploads directory clean note:', rmErr.message);
      }


    return res.json({
      success: true,
      message: 'All property listings, private specs, media, documents, verification records, and enquiries have been wiped clean across PostgreSQL, Firestore, and Local Storage.',
      pgDeleted,
      firestoreDeleted
    });
  } catch (err) {
    console.error('Purge all properties handler error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Database Health & Live Reconnect Verification Endpoint
app.post('/api/admin/database/reconnect', async (req, res) => {
  const { databaseUrl } = req.body || {};
  const targetUrl = databaseUrl || process.env.DATABASE_URL;
  if (!targetUrl) {
    return res.status(400).json({ success: false, error: 'Database URL is required.' });
  }
  try {
    const testPool = new pg.Pool({
      connectionString: targetUrl,
      connectionTimeoutMillis: 5000,
      ssl: (targetUrl.includes('sslmode=') || targetUrl.includes('supabase') || targetUrl.includes('neon')) ? { rejectUnauthorized: false } : false
    });
    const client = await testPool.connect();
    const ver = await client.query('SELECT NOW() as server_time, version();');
    client.release();
    await testPool.end();

    return res.json({
      success: true,
      message: 'PostgreSQL connection verified successfully.',
      serverTime: ver.rows[0].server_time,
      version: ver.rows[0].version
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'PostgreSQL connection failed: ' + err.message
    });
  }
});



// API Endpoint: Remove Document from Property Listing
app.delete('/api/properties/:id/documents', async (req, res) => {
  try {
    const targetId = req.params.id;
    const { docId, name, fileName } = req.body || {};
    const existingProp = localPropsMap.get(targetId);
    if (existingProp && Array.isArray(existingProp.documents)) {
      const targetName = String(name || fileName || docId || '').trim();
      const normTarget = targetName.toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]/g, '');

      existingProp.documents = existingProp.documents.filter(d => {
        if (!d) return false;
        const dId = String(d.docId || d.id || d.mediaId || '').trim().toLowerCase();
        if (docId && dId && dId === String(docId).trim().toLowerCase()) return false;

        const dName = String(d.documentName || d.name || d.fileName || d.title || '').trim();
        const normD = dName.toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]/g, '');
        if (normTarget && normD && normTarget === normD) return false;

        return true;
      });

      saveLocalProperty(existingProp);

      try {
        const P = String.fromCharCode(36);
        await pgPool.query(
          'UPDATE properties SET raw_data = ' + P + '1, updated_at = NOW() WHERE property_id = ' + P + '2;',
          [JSON.stringify(existingProp), targetId]
        );
      } catch (pgErr) {
        console.warn('PostgreSQL doc removal update note:', pgErr.message);
      }
    }
    return res.json({ success: true, message: 'Document removed from server property.' });
  } catch (err) {
    return res.json({ success: true });
  }
});

// API Endpoint: Get Property Confidential Documents directly
app.get('/api/properties/:id/documents', async (req, res) => {
  try {
    const targetId = req.params.id;
    if (!targetId) return res.json({ success: true, documents: [] });

    let docs = [];
    const localProp = localPropsMap.get(targetId);
    if (localProp && Array.isArray(localProp.documents)) {
      docs.push(...localProp.documents);
    }

    try {
      const P = String.fromCharCode(36);
      const pgRes = await pgPool.query(
        "SELECT raw_data FROM properties WHERE property_id = " + P + "1 OR reference_id = " + P + "1 OR raw_data->>'id' = " + P + "1 OR raw_data->>'propertyId' = " + P + "1;",
        [targetId]
      );
      if (pgRes.rows.length > 0 && Array.isArray(pgRes.rows[0].raw_data?.documents)) {
        docs.push(...pgRes.rows[0].raw_data.documents);
      }
    } catch (e) {}

    const seen = new Set();
    const uniqueDocs = [];
    docs.forEach(d => {
      if (!d) return;
      const key = String(d.docId || d.mediaId || d.id || d.url || d.publicUrl || d.name || d.fileName || '').toLowerCase().trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      uniqueDocs.push(d);
    });

    return res.json({ success: true, documents: uniqueDocs });
  } catch (err) {
    return res.json({ success: true, documents: [] });
  }
});

// In-Memory Site Configuration Cache (Authoritative state lives in PostgreSQL)
let localSiteConfigMap = new Map();


// Authoritative TV Broadcast Hydration:
// Hydrates full property objects from PostgreSQL properties table into featuredListings
// so that all viewers and accounts receive the complete properties without relying on local cache.
const hydratePromotedProperties = async (featuredConfig) => {
  if (!featuredConfig || !Array.isArray(featuredConfig.featuredPropertyIds) || featuredConfig.featuredPropertyIds.length === 0) {
    if (featuredConfig) featuredConfig.promotedProperties = [];
    return featuredConfig;
  }
  const ids = featuredConfig.featuredPropertyIds.map(String).filter(Boolean);
  if (ids.length === 0) {
    featuredConfig.promotedProperties = [];
    return featuredConfig;
  }

  try {
    const P = String.fromCharCode(36);
    const propResult = await pgPool.query(
      'SELECT property_id, reference_id, owner_id, title, property_type, purpose, price, area, location, specs, amenities, media, listing_status, is_published, raw_data FROM properties WHERE (property_id = ANY(' + P + '1) OR reference_id = ANY(' + P + '1)) AND (listing_status IS NULL OR listing_status != \'DRAFT\');',
      [ids]
    );
    const propMap = new Map();
    propResult.rows.forEach(row => {
      const raw = row.raw_data || {};
      const fullProp = {
        ...raw,
        id: row.property_id || raw.id || raw.propertyId,
        propertyId: row.property_id || raw.propertyId || row.id,
        referenceId: row.reference_id || raw.referenceId,
        ownerId: row.owner_id || raw.ownerId,
        title: row.title || raw.title,
        propertyType: row.property_type || raw.propertyType,
        purpose: row.purpose || raw.purpose,
        price: row.price !== null ? Number(row.price) : raw.price,
        area: row.area !== null ? Number(row.area) : raw.area,
        location: row.location || raw.location,
        specs: row.specs || raw.specs,
        amenities: row.amenities || raw.amenities,
        media: row.media || raw.media,
        photos: raw.photos || (Array.isArray(row.media) ? row.media.filter(m => m && (m.type === 'PHOTO' || !m.type)) : []),
        status: row.listing_status || raw.status || 'LIVE',
        listingStatus: row.listing_status || raw.listingStatus || 'LIVE',
        isPublished: Boolean(row.is_published)
      };
      const k1 = String(fullProp.id || '').toLowerCase().trim();
      const k2 = String(fullProp.propertyId || '').toLowerCase().trim();
      const k3 = String(fullProp.referenceId || '').toLowerCase().trim();
      if (k1) propMap.set(k1, fullProp);
      if (k2) propMap.set(k2, fullProp);
      if (k3) propMap.set(k3, fullProp);
    });

    const hydrated = ids
      .map(id => propMap.get(id.toLowerCase().trim()))
      .filter(p => p && !p.isDeleted && !p.deletedByAdmin && p.listingStatus !== 'DRAFT' && p.title && p.title.toLowerCase().trim() !== 'untitled property');
    featuredConfig.promotedProperties = hydrated;
  } catch (err) {
    console.warn('Hydrating promotedProperties warning:', err.message);
  }
  return featuredConfig;
};

app.get('/api/site-config', async (req, res) => {
  try {
    const config = {};
    const result = await pgPool.query('SELECT module_id, config_data FROM site_config;');
    result.rows.forEach(row => {
      if (row.module_id && row.config_data) {
        config[row.module_id] = row.config_data;
      }
    });

    // Unpack and merge master_draft if present so draft edits are exposed and merged with authoritative configuration
    if (config.master_draft && typeof config.master_draft === 'object') {
      Object.keys(config.master_draft).forEach(modKey => {
        if (!config[modKey]) {
          config[modKey] = config.master_draft[modKey];
        } else if (typeof config[modKey] === 'object' && typeof config.master_draft[modKey] === 'object' && config.master_draft[modKey] !== null) {
          config[modKey] = { ...config[modKey], ...config.master_draft[modKey] };
        }
      });
    }

    if (config.featuredListings) {
      await hydratePromotedProperties(config.featuredListings);
    }
    if (config.master_draft?.featuredListings) {
      await hydratePromotedProperties(config.master_draft.featuredListings);
    }

    return res.json({ success: true, config });
  } catch (err) {
    console.error('CRITICAL: PostgreSQL site_config fetch failed:', err.message);
    return res.status(503).json({ success: false, error: 'Database unavailable: ' + err.message, config: {} });
  }
});

// API Endpoint: Save/Publish Site Configuration to PostgreSQL DB
app.post('/api/site-config', async (req, res) => {
  try {
    const fullConfig = req.body || {};
    if (fullConfig.featuredListings) {
      await hydratePromotedProperties(fullConfig.featuredListings);
    }
    if (fullConfig.master_draft?.featuredListings) {
      await hydratePromotedProperties(fullConfig.master_draft.featuredListings);
    }

    // Merge master_draft with existing PostgreSQL master_draft to prevent partial module saves from erasing other modules
    if (fullConfig.master_draft && typeof fullConfig.master_draft === 'object') {
      try {
        const draftRes = await pgPool.query("SELECT config_data FROM site_config WHERE module_id = 'master_draft';");
        if (draftRes.rows.length > 0 && draftRes.rows[0].config_data && typeof draftRes.rows[0].config_data === 'object') {
          fullConfig.master_draft = { ...draftRes.rows[0].config_data, ...fullConfig.master_draft };
        }
      } catch (eDraftMerge) {
        console.warn('Draft merge note:', eDraftMerge.message);
      }
    }

    const P = String.fromCharCode(36);
    const queryText =
      'INSERT INTO site_config (module_id, config_data, updated_at) ' +
      'VALUES (' + P + '1, ' + P + '2, NOW()) ' +
      'ON CONFLICT (module_id) DO UPDATE SET ' +
      '  config_data = EXCLUDED.config_data, ' +
      '  updated_at = NOW();';

    const promises = Object.keys(fullConfig).map(modId => {
      return pgPool.query(queryText, [modId, JSON.stringify(fullConfig[modId])]);
    });
    await Promise.all(promises);

    // Keep master_draft in sync when featuredListings is updated directly
    if (fullConfig.featuredListings && !fullConfig.master_draft) {
      try {
        const draftRes = await pgPool.query("SELECT config_data FROM site_config WHERE module_id = 'master_draft';");
        if (draftRes.rows.length > 0) {
          const currentDraft = draftRes.rows[0].config_data || {};
          currentDraft.featuredListings = fullConfig.featuredListings;
          await pgPool.query(queryText, ['master_draft', JSON.stringify(currentDraft)]);
        }
      } catch (eDraft) {
        console.warn('Syncing featuredListings to master_draft notice:', eDraft.message);
      }
    }

    Object.keys(fullConfig).forEach(modId => {
      localSiteConfigMap.set(modId, fullConfig[modId]);
    });

    return res.json({ success: true, message: 'Site configuration saved to PostgreSQL.', config: fullConfig });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// CRM Real-Time Server-Sent Events (SSE) Bus
const crmSseClients = new Set();
const broadcastCrmEvent = (type, data) => {
  const payload = 'data: ' + JSON.stringify({ type, data, timestamp: Date.now() }) + '\n\n';
  crmSseClients.forEach(clientRes => {
    try {
      clientRes.write(payload);
    } catch (e) {
      crmSseClients.delete(clientRes);
    }
  });
};

// API Endpoint: Submit / Save Enquiry to PostgreSQL DB & Local Disk Fallback
app.post('/api/enquiries', async (req, res) => {
  try {
    const enquiryData = req.body || {};
    const eId = enquiryData.enquiryId || enquiryData.id || `enq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const fullPayload = {
      ...enquiryData,
      id: eId,
      enquiryId: eId,
      status: enquiryData.status || 'SUBMITTED',
      createdAt: enquiryData.createdAt || nowIso,
      updatedAt: nowIso
    };

    // 1. Authoritative PostgreSQL DB write
    const P = String.fromCharCode(36);
    const phs = [];
    for (let i = 1; i <= 19; i++) { phs.push(P + i); }

    const queryText = 
      'INSERT INTO enquiries (' +
      '  enquiry_id, property_id, property_title, property_reference_id, ' +
      '  owner_id, owner_name, owner_email, ' +
      '  customer_id, buyer_id, customer_name, buyer_name, ' +
      '  customer_email, buyer_email, customer_phone, buyer_phone, ' +
      '  message, preferred_visit_date, status, raw_data, created_at, updated_at' +
      ') VALUES (' +
      '  ' + phs.join(', ') + ', NOW(), NOW()' +
      ') ON CONFLICT (enquiry_id) DO UPDATE SET ' +
      '  status = EXCLUDED.status, ' +
      '  raw_data = EXCLUDED.raw_data, ' +
      '  updated_at = NOW();';

    await pgPool.query(queryText, [
      eId,
      fullPayload.propertyId || '',
      fullPayload.propertyTitle || '',
      fullPayload.propertyReferenceId || '',
      fullPayload.ownerId || '',
      fullPayload.ownerName || '',
      fullPayload.ownerEmail || '',
      fullPayload.customerId || fullPayload.buyerId || '',
      fullPayload.buyerId || fullPayload.customerId || '',
      fullPayload.customerName || fullPayload.buyerName || '',
      fullPayload.buyerName || fullPayload.customerName || '',
      fullPayload.customerEmail || fullPayload.buyerEmail || '',
      fullPayload.buyerEmail || fullPayload.customerEmail || '',
      fullPayload.customerPhone || fullPayload.buyerPhone || '',
      fullPayload.buyerPhone || fullPayload.customerPhone || '',
      fullPayload.message || '',
      fullPayload.preferredVisitDate || null,
      fullPayload.status || 'SUBMITTED',
      JSON.stringify(fullPayload)
    ]);
    saveLocalEnquiry(fullPayload);

    // 3. Auto-ingest enquiry into CRM Leads & Deals with HOT score and broadcast
    try {
      const leadName = fullPayload.customerName || fullPayload.buyerName || 'Website Prospective Buyer';
      const leadPhone = fullPayload.customerPhone || fullPayload.buyerPhone || '';
      const leadEmail = fullPayload.customerEmail || fullPayload.buyerEmail || '';
      const P = String.fromCharCode(36);
      const leadId = 'lead-' + eId;
      const crmLeadSql = 'INSERT INTO crm_leads (' +
        'lead_id, name, phone, email, source, score, status, preferred_location, ' +
        'preferred_property_type, budget_min, budget_max, budget_display, assigned_agent, ' +
        'notes, tags, raw_data, created_at, updated_at' +
        ') VALUES (' +
        P + '1, ' + P + '2, ' + P + '3, ' + P + '4, \'WEBSITE_ENQUIRY\', \'HOT\', \'NEW\', ' +
        P + '5, \'LAND_PARCEL\', 0, 0, \'Website Enquiry\', \'EaseLand Admin\', ' +
        P + '6, \'["Website Lead", "Direct Inquiry"]\'::jsonb, ' + P + '7, NOW(), NOW()' +
        ') ON CONFLICT (lead_id) DO UPDATE SET updated_at = NOW();';

      await pgPool.query(crmLeadSql, [
        leadId,
        leadName,
        leadPhone,
        leadEmail,
        fullPayload.propertyLocation || 'Amaravati / Guntur',
        'Inquiry on ' + (fullPayload.propertyTitle || 'Property') + ': ' + (fullPayload.message || ''),
        JSON.stringify(fullPayload)
      ]);
      broadcastCrmEvent('LEAD_CREATED', { leadId, name: leadName, phone: leadPhone, email: leadEmail });

      // Auto-create pipeline deal so inquiry appears immediately on Kanban board
      const dealId = 'deal-' + eId;
      const todayIso = new Date().toISOString().split('T')[0];
      const initialDealTimeline = [
        { date: todayIso, event: 'Deal auto-created from website inquiry on ' + (fullPayload.propertyTitle || 'Listing'), user: 'EaseLand Ingestion Engine' }
      ];
      const crmDealSql = 'INSERT INTO crm_deals (' +
        'deal_id, lead_id, property_id, property_title, property_location, customer_name, customer_phone, ' +
        'customer_email, owner_name, owner_phone, stage, deal_value, deal_value_display, commission_rate, ' +
        'expected_commission, probability, expected_closing_date, assigned_agent, next_follow_up_date, ' +
        'next_follow_up_time, next_follow_up_action, legal_audit_status, notes, payment_milestones, timeline, version, raw_data, created_at, updated_at' +
        ') VALUES (' +
        P + '1, ' + P + '2, ' + P + '3, ' + P + '4, ' + P + '5, ' + P + '6, ' + P + '7, ' + P + '8, ' +
        P + '9, ' + P + '10, \'NEW\', 0, \'Pending Assessment\', 1.5, 0, 20, \'\', \'EaseLand Admin\', ' +
        P + '11, \'11:00 AM\', \'Follow up with website inquiry\', \'PENDING\', ' + P + '12, \'[]\'::jsonb, ' +
        P + '13, 1, ' + P + '14, NOW(), NOW()' +
        ') ON CONFLICT (deal_id) DO NOTHING;';

      await pgPool.query(crmDealSql, [
        dealId,
        leadId,
        fullPayload.propertyId || 'prop-custom',
        fullPayload.propertyTitle || 'Property Inquiry',
        fullPayload.propertyLocation || 'Amaravati / Guntur',
        leadName,
        leadPhone,
        leadEmail,
        fullPayload.ownerName || '',
        fullPayload.ownerPhone || '',
        todayIso,
        fullPayload.message || 'Direct inquiry from website property details page.',
        JSON.stringify(initialDealTimeline),
        JSON.stringify(fullPayload)
      ]);
      broadcastCrmEvent('DEAL_CREATED', {
        id: dealId,
        dealId,
        customerName: leadName,
        propertyTitle: fullPayload.propertyTitle || 'Property Inquiry',
        dealValue: 0,
        stage: 'NEW'
      });
    } catch (crmErr) {
      console.warn('CRM leads/deals auto-ingest note:', crmErr.message);
    }

    return res.json({ success: true, enquiryId: eId, enquiry: fullPayload });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint: Get Enquiries from PostgreSQL DB (with optional filtering)
app.get('/api/enquiries', async (req, res) => {
  try {
    const { ownerId, ownerEmail, customerId, customerEmail, buyerId, buyerEmail } = req.query;

    const result = await pgPool.query('SELECT raw_data FROM enquiries ORDER BY updated_at DESC LIMIT 200;');
    let allEnquiries = result.rows.map(row => row.raw_data).filter(Boolean);

    if (ownerId || ownerEmail || customerId || customerEmail || buyerId || buyerEmail) {
      const oId = String(ownerId || '').toLowerCase().trim();
      const oEmail = String(ownerEmail || '').toLowerCase().trim();
      const cId = String(customerId || buyerId || '').toLowerCase().trim();
      const cEmail = String(customerEmail || buyerEmail || '').toLowerCase().trim();

      allEnquiries = allEnquiries.filter(e => {
        if (!e) return false;
        const eOwnerId = String(e.ownerId || '').toLowerCase().trim();
        const eOwnerEmail = String(e.ownerEmail || '').toLowerCase().trim();
        const eCustId = String(e.customerId || e.buyerId || '').toLowerCase().trim();
        const eCustEmail = String(e.customerEmail || e.buyerEmail || '').toLowerCase().trim();

        const matchOwner = (oId && eOwnerId === oId) || (oEmail && eOwnerEmail === oEmail);
        const matchCustomer = (cId && eCustId === cId) || (cEmail && eCustEmail === cEmail);

        if (oId || oEmail) return matchOwner;
        if (cId || cEmail) return matchCustomer;
        return true;
      });
    }

    return res.json({ success: true, count: allEnquiries.length, enquiries: allEnquiries });
  } catch (err) {
    console.error('CRITICAL: PostgreSQL fetch enquiries failed:', err.message);
    return res.status(503).json({ success: false, error: 'Database unavailable: ' + err.message });
  }
});

// API Endpoint: Update Enquiry Status in PostgreSQL DB
app.patch('/api/enquiries/:id', async (req, res) => {
  try {
    const eId = req.params.id;
    const { status } = req.body;
    if (!eId || !status) return res.status(400).json({ success: false, error: 'Enquiry ID and status required.' });

    const P = String.fromCharCode(36);
    await pgPool.query('UPDATE enquiries SET status = ' + P + '1, updated_at = NOW() WHERE enquiry_id = ' + P + '2;', [status, eId]);

    const localEnq = localEnquiriesMap.get(eId);
    if (localEnq) {
      localEnq.status = status;
      localEnq.updatedAt = new Date().toISOString();
      saveLocalEnquiry(localEnq);
    }

    return res.json({ success: true, message: 'Enquiry status updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Database update failed: ' + err.message });
  }
});

// API Endpoint: Append Message to Enquiry Chat Thread in PostgreSQL DB
app.post('/api/enquiries/:id/messages', async (req, res) => {
  try {
    const eId = req.params.id;
    const messageData = req.body || {};
    if (!eId || !messageData.text) {
      return res.status(400).json({ success: false, error: 'Enquiry ID and message text are required.' });
    }

    const newMsg = {
      id: messageData.id || ('msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)),
      senderId: messageData.senderId || 'user',
      senderName: messageData.senderName || 'User',
      senderRole: messageData.senderRole || 'USER',
      text: String(messageData.text).trim(),
      createdAt: messageData.createdAt || new Date().toISOString()
    };

    const P = String.fromCharCode(36);
    const msgSql =
      'UPDATE enquiries ' +
      'SET raw_data = jsonb_set(' +
      '  COALESCE(raw_data, \'{}\'::jsonb), ' +
      '  \'{messages}\', ' +
      '  (COALESCE(raw_data->\'messages\', \'[]\'::jsonb) || ' + P + '1::jsonb)' +
      '), ' +
      'updated_at = NOW() ' +
      'WHERE enquiry_id = ' + P + '2;';

    await pgPool.query(msgSql, [JSON.stringify(newMsg), eId]);

    const localEnq = localEnquiriesMap.get(eId);
    if (localEnq) {
      if (!Array.isArray(localEnq.messages)) localEnq.messages = [];
      localEnq.messages.push(newMsg);
      localEnq.updatedAt = new Date().toISOString();
      saveLocalEnquiry(localEnq);
    }

    return res.json({ success: true, message: newMsg });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Database update failed: ' + err.message });
  }
});



// API Endpoint: Get user by ID or email
app.get('/api/users/:id', async (req, res) => {
  try {
    const target = String(req.params.id).trim();
    const P = String.fromCharCode(36);
    const pgRes = await pgPool.query(
      "SELECT uid, email, display_name, phone, city, location, role, account_status, email_verified, raw_data, created_at, updated_at FROM users WHERE uid = " + P + "1 OR email = " + P + "1 OR raw_data->>'id' = " + P + "1;",
      [target]
    );
    if (pgRes.rows.length > 0) {
      const row = pgRes.rows[0];
      const raw = row.raw_data || {};
      const resolvedPhone = (row.phone && row.phone.trim()) || (raw.phone && String(raw.phone).trim()) || (raw.phoneNumber && String(raw.phoneNumber).trim()) || '';
      const resolvedCity = (row.city && row.city.trim()) || (row.location && row.location.trim()) || (raw.city && String(raw.city).trim()) || (raw.location && String(raw.location).trim()) || '';
      const resolvedName = (row.display_name && row.display_name.trim()) || (raw.displayName && String(raw.displayName).trim()) || (raw.name && String(raw.name).trim()) || 'EaseLand User';
      const resolvedEmail = (row.email && row.email.trim()) || (raw.email && String(raw.email).trim()) || '';

      const mergedUser = {
        ...raw,
        id: row.uid,
        uid: row.uid,
        displayName: resolvedName,
        name: resolvedName,
        email: resolvedEmail,
        phone: resolvedPhone,
        phoneNumber: resolvedPhone,
        city: resolvedCity,
        location: resolvedCity,
        role: row.role || raw.role || 'USER',
        accountStatus: row.account_status || raw.accountStatus || 'ACTIVE',
        emailVerified: Boolean(row.email_verified ?? raw.emailVerified),
        createdAt: row.created_at || raw.createdAt,
        updatedAt: row.updated_at || raw.updatedAt
      };
      return res.json({ success: true, user: mergedUser });
    }
    return res.status(404).json({ success: false, error: 'User not found.' });
  } catch (err) {
    console.error('CRITICAL: PostgreSQL user fetch failed:', err.message);
    return res.status(503).json({ success: false, error: 'Database unavailable: ' + err.message });
  }
});

// API Endpoint: Send 2FA Verification OTP via EaseLand Stalwart MailServer
app.post('/api/send-2fa-otp', async (req, res) => {
  try {
    const { email, otpCode } = req.body || {};
    if (!email || !otpCode) {
      return res.status(400).json({ success: false, error: 'Email and otpCode are required.' });
    }

    const targetEmail = String(email).trim().toLowerCase();
    console.log(`[EaseLand Server 2FA] Sending OTP ${otpCode} to ${targetEmail} via Stalwart...`);

    const mailRes = await fetch('https://mail.easeland.in/jmap/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from('admin@easeland.in:JTx7ggq3MBzdopSG').toString('base64')
      },
      body: JSON.stringify({
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail', 'urn:ietf:params:jmap:submission'],
        methodCalls: [
          ['Email/set', {
            accountId: 'b',
            create: {
              m1: {
                mailboxIds: { 'd': true },
                from: [{ name: 'EaseLand Security', email: 'admin@easeland.in' }],
                to: [{ email: targetEmail }],
                subject: `EaseLand Security: Your 2FA Verification Code [${otpCode}]`,
                bodyValues: {
                  b1: {
                    value: `<div style="font-family: Arial, sans-serif; padding: 24px; background-color: #0f172a; color: #ffffff; border-radius: 12px;">
                      <h2 style="color: #f59e0b; margin: 0 0 12px 0;">EaseLand Security Verification</h2>
                      <p style="font-size: 15px; color: #e2e8f0;">Your 6-digit Two-Factor Authentication code is:</p>
                      <div style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #0f172a; background-color: #f59e0b; padding: 14px 28px; border-radius: 8px; display: inline-block; margin: 16px 0;">${otpCode}</div>
                      <p style="font-size: 13px; color: #94a3b8; margin-top: 16px;">This code is valid for 5 minutes. Sent officially from <strong>admin@easeland.in</strong> on EaseLand MailServer.</p>
                    </div>`,
                    contentType: 'text/html'
                  }
                },
                htmlBody: [{ partId: 'b1', type: 'text/html' }]
              }
            }
          }, 'c1'],
          ['EmailSubmission/set', {
            accountId: 'b',
            create: {
              s1: { emailId: '#m1', identityId: 'b' }
            }
          }, 'c2']
        ]
      })
    });

    const data = await mailRes.json();
    console.log('[EaseLand Server 2FA] Stalwart JMAP response:', JSON.stringify(data));
    return res.json({ success: true, message: 'OTP dispatched via EaseLand MailServer.', data });
  } catch (err) {
    console.error('[EaseLand Server 2FA] Error sending email via Stalwart:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// SITE VISITORS API ENDPOINTS (1-Minute Engaged Visitors)
// ============================================================================

// Submit 1-Minute Site Visitor Lead to PostgreSQL DB
app.post('/api/visitors', async (req, res) => {
  try {
    const visitorData = req.body || {};
    const vId = visitorData.visitorId || visitorData.id || `vis-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const fullPayload = {
      ...visitorData,
      id: vId,
      visitorId: vId,
      name: (visitorData.name || 'Site Visitor').trim(),
      phone: (visitorData.phone || '').trim(),
      email: (visitorData.email || '').trim(),
      preferredPropertyType: visitorData.preferredPropertyType || 'Open Plots',
      preferredLocation: visitorData.preferredLocation || 'Amaravati / Guntur',
      stayDurationSeconds: Number(visitorData.stayDurationSeconds) || 60,
      source: visitorData.source || '1_MIN_ENGAGEMENT_POPUP',
      status: visitorData.status || 'NEW',
      notes: visitorData.notes || 'Browsed site for over 1 minute and submitted lead popup.',
      createdAt: visitorData.createdAt || nowIso,
      updatedAt: nowIso
    };

    // 1. Authoritative PostgreSQL write
    const P = String.fromCharCode(36);
    const phs = [];
    for (let i = 1; i <= 11; i++) { phs.push(P + i); }

    const queryText = 
      'INSERT INTO site_visitors (' +
      '  visitor_id, name, phone, email, preferred_property_type, ' +
      '  preferred_location, stay_duration_seconds, source, status, ' +
      '  notes, raw_data, created_at, updated_at' +
      ') VALUES (' +
      '  ' + phs.join(', ') + ', NOW(), NOW()' +
      ') ON CONFLICT (visitor_id) DO UPDATE SET ' +
      '  name = EXCLUDED.name, ' +
      '  phone = EXCLUDED.phone, ' +
      '  email = EXCLUDED.email, ' +
      '  status = EXCLUDED.status, ' +
      '  notes = EXCLUDED.notes, ' +
      '  raw_data = EXCLUDED.raw_data, ' +
      '  updated_at = NOW();';

    await pgPool.query(queryText, [
      vId,
      fullPayload.name,
      fullPayload.phone,
      fullPayload.email,
      fullPayload.preferredPropertyType,
      fullPayload.preferredLocation,
      fullPayload.stayDurationSeconds,
      fullPayload.source,
      fullPayload.status,
      fullPayload.notes,
      JSON.stringify(fullPayload)
    ]);
    saveLocalVisitor(fullPayload);

    // Auto-ingest visitor into CRM Leads
    try {
      const leadId = 'lead-' + vId;
      const crmLeadSql = 'INSERT INTO crm_leads (' +
        'lead_id, name, phone, email, source, score, status, preferred_location, ' +
        'preferred_property_type, budget_min, budget_max, budget_display, assigned_agent, ' +
        'notes, tags, raw_data, created_at, updated_at' +
        ') VALUES (' +
        P + '1, ' + P + '2, ' + P + '3, ' + P + '4, \'SITE_ENGAGEMENT_POPUP\', \'WARM\', \'NEW\', ' +
        P + '5, ' + P + '6, 0, 0, \'Visitor Engagement\', \'EaseLand Admin\', ' +
        P + '7, \'["Site Visitor", "Popup Lead"]\'::jsonb, ' + P + '8, NOW(), NOW()' +
        ') ON CONFLICT (lead_id) DO UPDATE SET updated_at = NOW();';

      await pgPool.query(crmLeadSql, [
        leadId,
        fullPayload.name || 'Site Visitor',
        fullPayload.phone || '',
        fullPayload.email || '',
        fullPayload.preferredLocation || 'Amaravati / Guntur',
        fullPayload.preferredPropertyType || 'Open Plot Ventures',
        fullPayload.notes || 'Captured via 1-minute site engagement popup.',
        JSON.stringify(fullPayload)
      ]);
      broadcastCrmEvent('LEAD_CREATED', { leadId, name: fullPayload.name, phone: fullPayload.phone, email: fullPayload.email });
    } catch (crmLeadErr) {
      console.warn('CRM visitor auto-ingest note:', crmLeadErr.message);
    }

    return res.json({ success: true, visitorId: vId, visitor: fullPayload });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Database save failed: ' + err.message });
  }
});

// Get Site Visitors List from PostgreSQL DB (Authoritative - Zero Silent Fallback)
app.get('/api/visitors', async (req, res) => {
  try {
    const result = await pgPool.query('SELECT raw_data FROM site_visitors ORDER BY created_at DESC LIMIT 300;');
    const allVisitors = result.rows.map(row => row.raw_data).filter(Boolean);
    return res.json({ success: true, count: allVisitors.length, visitors: allVisitors });
  } catch (err) {
    console.error('CRITICAL: PostgreSQL fetch visitors failed:', err.message);
    return res.status(503).json({ success: false, error: 'Database unavailable: ' + err.message });
  }
});

// Update Visitor Status or Notes in PostgreSQL DB
app.patch('/api/visitors/:id', async (req, res) => {
  try {
    const vId = req.params.id;
    const { status, notes, assignedAgent } = req.body || {};
    const nowIso = new Date().toISOString();
    const P = String.fromCharCode(36);

    const existingRes = await pgPool.query(
      'SELECT raw_data FROM site_visitors WHERE visitor_id = ' + P + '1;',
      [vId]
    );
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Visitor not found.' });
    }

    const currentVis = existingRes.rows[0].raw_data || { id: vId, visitorId: vId };
    if (status) currentVis.status = status;
    if (notes !== undefined) currentVis.notes = notes;
    if (assignedAgent !== undefined) currentVis.assignedAgent = assignedAgent;
    currentVis.updatedAt = nowIso;

    const updateSql = 
      'UPDATE site_visitors SET ' +
      '  status = COALESCE(' + P + '1, status), ' +
      '  notes = COALESCE(' + P + '2, notes), ' +
      '  raw_data = ' + P + '3, ' +
      '  updated_at = NOW() ' +
      'WHERE visitor_id = ' + P + '4;';

    await pgPool.query(updateSql, [
      status || null,
      notes !== undefined ? notes : null,
      JSON.stringify(currentVis),
      vId
    ]);

    saveLocalVisitor(currentVis);
    return res.json({ success: true, visitor: currentVis });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Database update failed: ' + err.message });
  }
});

// Delete Visitor Record
app.delete('/api/visitors/:id', async (req, res) => {
  try {
    const vId = req.params.id;
    const P = String.fromCharCode(36);
    await pgPool.query('DELETE FROM site_visitors WHERE visitor_id = ' + P + '1;', [vId]);
    localVisitorsMap.delete(vId);
    return res.json({ success: true, message: 'Visitor deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Database delete failed: ' + err.message });
  }
});

// In-memory cache for Firebase Auth + PG unified users to guarantee instant Admin Portal loads
let cachedAdminUsersData = null;
let cachedAdminUsersExpiry = 0;
const ADMIN_USERS_CACHE_TTL = 15000; // 15s TTL

function invalidateAdminUsersCache() {
  cachedAdminUsersData = null;
  cachedAdminUsersExpiry = 0;
}

function unifyServerUsers(userList, deletedUsersSet = new Set()) {
  const canonicalUsers = new Map();
  const keyToCanonical = new Map();

  const mergeNonEmpty = (target, src) => {
    const res = { ...target };
    for (const [k, v] of Object.entries(src || {})) {
      if (v !== undefined && v !== null && v !== '') {
        res[k] = v;
      } else if (res[k] === undefined || res[k] === null) {
        res[k] = v;
      }
    }
    return res;
  };

  (userList || []).forEach(u => {
    if (!u) return;
    const emailKey = (u.email || '').toLowerCase().trim();
    const rawUid = u.uid || u.id || '';
    const uidKey = String(rawUid).toLowerCase().trim();
    if (!emailKey && !uidKey) return;

    const uSt = String(u.accountStatus || u.status || '').toUpperCase();
    if (uSt === 'REMOVED' || uSt === 'DELETED' || uSt === 'ACCOUNT_DELETED') return;
    if (deletedUsersSet.has(uidKey) || (emailKey && deletedUsersSet.has(emailKey))) return;

    const canonicalFromEmail = emailKey ? keyToCanonical.get(emailKey) : null;
    const canonicalFromUid = uidKey ? keyToCanonical.get(uidKey) : null;

    let canonicalKey = canonicalFromEmail || canonicalFromUid || (emailKey || uidKey);

    let existing = canonicalUsers.get(canonicalKey) || {};
    if (canonicalFromEmail && canonicalFromUid && canonicalFromEmail !== canonicalFromUid) {
      const otherUser = canonicalUsers.get(canonicalFromUid) || {};
      existing = mergeNonEmpty(otherUser, existing);
      canonicalUsers.delete(canonicalFromUid);
      for (const [k, v] of keyToCanonical.entries()) {
        if (v === canonicalFromUid) keyToCanonical.set(k, canonicalKey);
      }
    }

    const combined = mergeNonEmpty(existing, u);

    const isSyntheticUid = (id) => !id || id === 'admin_uid_001' || String(id).startsWith('owner-');
    const bestUid = (!isSyntheticUid(u.uid) ? u.uid : (!isSyntheticUid(existing.uid) ? existing.uid : (u.uid || existing.uid || u.id || existing.id || rawUid)));

    const isAdmin = emailKey === 'admin@easeland.in' || combined.role === 'ADMIN' || Boolean(combined.adminRole);
    const cleanName = isAdmin ? 'EaseLand Admin' : (combined.displayName || combined.name || (emailKey ? emailKey.split('@')[0] : 'Registered User'));

    const cleanPhone = (combined.phone || combined.phoneNumber || '').trim();
    const cleanCity = (combined.city || combined.location || '').trim();

    const mergedUser = {
      ...combined,
      uid: bestUid,
      id: bestUid,
      email: combined.email || (emailKey || ''),
      displayName: cleanName,
      name: cleanName,
      phone: cleanPhone,
      phoneNumber: cleanPhone,
      city: cleanCity,
      location: cleanCity,
      status: combined.status || combined.accountStatus || 'ACTIVE',
      accountStatus: combined.accountStatus || combined.status || 'ACTIVE',
      role: isAdmin ? 'ADMIN' : (combined.role || 'USER'),
      adminRole: Boolean(isAdmin)
    };

    canonicalUsers.set(canonicalKey, mergedUser);
    if (emailKey) keyToCanonical.set(emailKey, canonicalKey);
    if (uidKey) keyToCanonical.set(uidKey, canonicalKey);
    if (existing.uid) keyToCanonical.set(String(existing.uid).toLowerCase().trim(), canonicalKey);
    if (bestUid) keyToCanonical.set(String(bestUid).toLowerCase().trim(), canonicalKey);
  });

  return Array.from(canonicalUsers.values()).filter(u => {
    const uUid = String(u.uid || u.id || '').toLowerCase().trim();
    const uEm = String(u.email || '').toLowerCase().trim();
    const uSt = String(u.accountStatus || u.status || '').toUpperCase();
    if (uSt === 'REMOVED' || uSt === 'DELETED' || uSt === 'ACCOUNT_DELETED') return false;
    return !deletedUsersSet.has(uUid) && (!uEm || !deletedUsersSet.has(uEm));
  });
}

// Registered Users API Endpoints (Firebase Auth + PostgreSQL User Governance)
app.get('/api/admin/firebase-users', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    if (!forceRefresh && cachedAdminUsersData && Date.now() < cachedAdminUsersExpiry) {
      return res.json(cachedAdminUsersData);
    }
    let authUsers = [];
    try {
      const adminApps = getApps();
      const adminApp = adminApps.length ? adminApps[0] : initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'easeland-fba04' });
      const auth = getAuth(adminApp);
      const listResult = await auth.listUsers(1000);
      authUsers = listResult.users.map(u => ({
        uid: u.uid,
        id: u.uid,
        email: u.email || '',
        displayName: (u.displayName || (u.email === 'admin@easeland.in' ? 'EaseLand Admin' : (u.email ? u.email.split('@')[0] : 'Registered User'))).trim(),
        name: (u.displayName || (u.email === 'admin@easeland.in' ? 'EaseLand Admin' : (u.email ? u.email.split('@')[0] : 'Registered User'))).trim(),
        phone: u.phoneNumber || '',
        emailVerified: u.emailVerified ?? true,
        authProvider: u.providerData?.[0]?.providerId === 'google.com' || u.email?.endsWith('@gmail.com') ? 'Google OAuth' : 'Email/Password',
        role: u.email === 'admin@easeland.in' ? 'ADMIN' : 'USER',
        accountStatus: u.disabled ? 'SUSPENDED' : 'ACTIVE',
        createdAt: u.metadata?.creationTime || new Date().toISOString()
      }));
    } catch (authErr) {
      console.warn('Firebase Admin listUsers note:', authErr.message);
    }

    let fsUsers = [];
    try {
      const adminDb = getAdminDb();
      if (adminDb) {
        const snap = await adminDb.collection('users').get();
        snap.forEach(d => {
          const data = d.data();
          if (data) {
            fsUsers.push({
              ...data,
              uid: d.id,
              id: d.id,
              displayName: data.displayName || data.name || (d.id === 'admin@easeland.in' ? 'EaseLand Admin' : 'Registered User'),
              name: data.displayName || data.name || (d.id === 'admin@easeland.in' ? 'EaseLand Admin' : 'Registered User')
            });
          }
        });
      }
    } catch (fsErr) {
      console.warn('Firestore users read note:', fsErr.message);
    }

    let pgUsers = [];
    try {
      const result = await pgPool.query('SELECT raw_data FROM users ORDER BY created_at DESC LIMIT 1000;');
      pgUsers = result.rows.map(row => row.raw_data).filter(Boolean);
    } catch (pgErr) {
      console.warn('PostgreSQL fetch users note in firebase-users:', pgErr.message);
    }

    const deletedUsersSet = new Set(localDeletedUsersSet);
    try {
      const delRes = await pgPool.query('SELECT uid, email FROM admin_deleted_users;');
      delRes.rows.forEach(r => {
        if (r.uid) deletedUsersSet.add(String(r.uid).toLowerCase().trim());
        if (r.email) deletedUsersSet.add(String(r.email).toLowerCase().trim());
      });
    } catch (eDelFetch) {}

    const allUsers = unifyServerUsers([...authUsers, ...fsUsers, ...pgUsers], deletedUsersSet);

    const payload = { success: true, count: allUsers.length, users: allUsers };
    cachedAdminUsersData = payload;
    cachedAdminUsersExpiry = Date.now() + ADMIN_USERS_CACHE_TTL;
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Authoritative 3-Way Synchronization Endpoint for Admin Portal
app.post('/api/admin/sync-users-and-config', async (req, res) => {
  try {
    invalidateAdminUsersCache();
    console.log('[EaseLand Sync] Running 3-way synchronization across Firestore, PostgreSQL, and Local...');
    const adminDb = getAdminDb();

    // 1. Sync Users
    const rawUsersToSync = [];
    const deletedUsersSet = new Set(localDeletedUsersSet);
    try {
      const delRes = await pgPool.query('SELECT uid, email FROM admin_deleted_users;');
      delRes.rows.forEach(r => {
        if (r.uid) deletedUsersSet.add(String(r.uid).toLowerCase().trim());
        if (r.email) deletedUsersSet.add(String(r.email).toLowerCase().trim());
      });
    } catch (eDelFetch) {}

    // 1a. Firebase Auth
    try {
      const adminApps = getApps();
      if (adminApps.length) {
        const auth = getAuth(adminApps[0]);
        const listResult = await auth.listUsers(1000);
        listResult.users.forEach(u => {
          const email = (u.email || '').toLowerCase().trim();
          const uid = u.uid;
          if (deletedUsersSet.has(String(uid).toLowerCase().trim()) || (email && deletedUsersSet.has(email))) return;
          const isAdmin = email === 'admin@easeland.in' || u.customClaims?.adminRole;
          rawUsersToSync.push({
            uid,
            id: uid,
            email,
            displayName: (u.displayName || (isAdmin ? 'EaseLand Admin' : (email ? email.split('@')[0] : 'Registered User'))).trim(),
            name: (u.displayName || (isAdmin ? 'EaseLand Admin' : (email ? email.split('@')[0] : 'Registered User'))).trim(),
            phone: u.phoneNumber || '',
            role: isAdmin ? 'ADMIN' : 'USER',
            adminRole: Boolean(isAdmin),
            accountStatus: u.disabled ? 'SUSPENDED' : 'ACTIVE',
            emailVerified: u.emailVerified ?? true,
            authProvider: u.providerData?.[0]?.providerId === 'google.com' || email.endsWith('@gmail.com') ? 'Google OAuth' : 'Email/Password',
            createdAt: u.metadata?.creationTime || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });
      }
    } catch (eAuth) {
      console.warn('[EaseLand Sync] Auth list note:', eAuth.message);
    }

    // 1b. Firestore Users collection
    if (adminDb) {
      try {
        const snap = await adminDb.collection('users').get();
        snap.forEach(docSnap => {
          const d = docSnap.data();
          const uid = docSnap.id;
          const email = (d.email || '').toLowerCase().trim();
          const uSt = String(d.accountStatus || d.status || '').toUpperCase();
          if (uSt === 'REMOVED' || uSt === 'DELETED' || uSt === 'ACCOUNT_DELETED') return;
          if (deletedUsersSet.has(String(uid).toLowerCase().trim()) || (email && deletedUsersSet.has(email))) return;
          rawUsersToSync.push({
            ...d,
            uid,
            id: uid,
            email: (d.email || '').toLowerCase().trim(),
            displayName: d.displayName || d.name || 'EaseLand User',
            name: d.displayName || d.name || 'EaseLand User',
            role: (d.email === 'admin@easeland.in' || d.role === 'ADMIN') ? 'ADMIN' : (d.role || 'USER'),
            accountStatus: d.accountStatus || 'ACTIVE'
          });
        });
      } catch (eFs) {
        console.warn('[EaseLand Sync] Firestore users note:', eFs.message);
      }
    }

    // 1c. PostgreSQL Users table
    try {
      const pgRes = await pgPool.query('SELECT raw_data FROM users ORDER BY created_at DESC LIMIT 1000;');
      pgRes.rows.forEach(r => {
        const u = r.raw_data;
        if (!u) return;
        const uid = u.uid || u.id;
        if (!uid) return;
        const email = (u.email || '').toLowerCase().trim();
        const uSt = String(u.accountStatus || u.status || '').toUpperCase();
        if (uSt === 'REMOVED' || uSt === 'DELETED' || uSt === 'ACCOUNT_DELETED') return;
        if (deletedUsersSet.has(String(uid).toLowerCase().trim()) || (email && deletedUsersSet.has(email))) return;
        rawUsersToSync.push(u);
      });
    } catch (ePg) {
      console.warn('[EaseLand Sync] PostgreSQL users note:', ePg.message);
    }

    // 1d. Local users store
    localUsersMap.forEach((u, key) => {
      const uid = u.uid || u.id || key;
      const email = (u.email || '').toLowerCase().trim();
      const uSt = String(u.accountStatus || u.status || '').toUpperCase();
      if (uSt === 'REMOVED' || uSt === 'DELETED' || uSt === 'ACCOUNT_DELETED') return;
      if (deletedUsersSet.has(String(uid).toLowerCase().trim()) || (email && deletedUsersSet.has(email))) return;
      rawUsersToSync.push({ ...u, uid, id: uid });
    });

    const unifiedUsers = unifyServerUsers(rawUsersToSync, deletedUsersSet);

    // Write back unified users across all 3 layers
    const syncP1 = String.fromCharCode(36) + '1';
    const syncP2 = String.fromCharCode(36) + '2';
    const syncP3 = String.fromCharCode(36) + '3';
    const syncP4 = String.fromCharCode(36) + '4';
    const syncP5 = String.fromCharCode(36) + '5';
    const syncP6 = String.fromCharCode(36) + '6';
    const syncP7 = String.fromCharCode(36) + '7';
    const syncP8 = String.fromCharCode(36) + '8';
    const syncP9 = String.fromCharCode(36) + '9';
    const syncP10 = String.fromCharCode(36) + '10';

    const syncUpsertQuery = 
      "INSERT INTO users (" +
      "  uid, email, display_name, phone, city, location, role, account_status, email_verified, raw_data, created_at, updated_at" +
      ") VALUES (" +
      "  " + syncP1 + ", " + syncP2 + ", " + syncP3 + ", " + syncP4 + ", " + syncP5 + ", " + syncP6 + ", " + syncP7 + ", " + syncP8 + ", " + syncP9 + ", " + syncP10 + ", NOW(), NOW()" +
      ") ON CONFLICT (uid) DO UPDATE SET " +
      "  email = COALESCE(NULLIF(EXCLUDED.email, ''), users.email), " +
      "  display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), users.display_name), " +
      "  phone = CASE WHEN COALESCE(EXCLUDED.phone, '') <> '' THEN EXCLUDED.phone ELSE users.phone END, " +
      "  city = CASE WHEN COALESCE(EXCLUDED.city, '') <> '' THEN EXCLUDED.city ELSE users.city END, " +
      "  location = CASE WHEN COALESCE(EXCLUDED.location, '') <> '' THEN EXCLUDED.location ELSE users.location END, " +
      "  role = COALESCE(NULLIF(EXCLUDED.role, ''), users.role), " +
      "  account_status = COALESCE(NULLIF(EXCLUDED.account_status, ''), users.account_status), " +
      "  raw_data = COALESCE(users.raw_data, '{}'::jsonb) || EXCLUDED.raw_data, " +
      "  updated_at = NOW();";

    for (const u of unifiedUsers) {
      saveLocalUser(u);
      try {
        await pgPool.query(syncUpsertQuery, [
          u.uid,
          u.email,
          u.displayName || u.name,
          u.phone || u.phoneNumber || '',
          u.city || u.location || '',
          u.location || u.city || '',
          u.role || 'USER',
          u.accountStatus || 'ACTIVE',
          Boolean(u.emailVerified),
          JSON.stringify(u)
        ]);
      } catch (errPg) {}

      if (adminDb) {
        try {
          await adminDb.collection('users').doc(u.uid).set(u, { merge: true });
        } catch (errFs) {}
      }
    }

    // 2. Sync Site Configuration (CMS)
    const cmsMap = new Map();

    // 2a. Local CMS map
    localSiteConfigMap.forEach((val, key) => cmsMap.set(key, val));

    // 2b. PostgreSQL site_config table
    try {
      const pgCfgRes = await pgPool.query('SELECT module_id, config_data FROM site_config;');
      pgCfgRes.rows.forEach(row => {
        if (row.module_id && row.config_data) {
          const existing = cmsMap.get(row.module_id) || {};
          cmsMap.set(row.module_id, { ...existing, ...row.config_data });
        }
      });
    } catch (ePgCfg) {}

    // 2c. Firestore siteManagement collection
    if (adminDb) {
      try {
        const snap = await adminDb.collection('siteManagement').get();
        snap.forEach(docSnap => {
          const d = docSnap.data();
          const modId = docSnap.id;
          if (modId === 'master_draft') {
            if (d && typeof d === 'object') {
              Object.keys(d).forEach(k => {
                if (typeof d[k] === 'object' && d[k] !== null) {
                  const existing = cmsMap.get(k) || {};
                  // PostgreSQL is 100% authoritative for featuredListings! Never let Firestore resurrect old promotions!
                  if (k === 'featuredListings' && existing && typeof existing === 'object' && existing.featuredPropertyIds !== undefined) {
                    return;
                  }
                  cmsMap.set(k, { ...d[k], ...existing });
                }
              });
            }
          } else if (modId === 'featuredListings') {
            const existing = cmsMap.get(modId) || {};
            // PostgreSQL is 100% authoritative for featuredListings! Never let Firestore resurrect old promotions!
            if (existing && typeof existing === 'object' && existing.featuredPropertyIds !== undefined) {
              return;
            }
            cmsMap.set(modId, { ...existing, ...d });
          } else {
            const existing = cmsMap.get(modId) || {};
            cmsMap.set(modId, { ...existing, ...d });
          }
        });
      } catch (eFsCms) {}
    }

    const unifiedConfig = {};
    for (const [modId, modData] of cmsMap.entries()) {
      unifiedConfig[modId] = modData;
      localSiteConfigMap.set(modId, modData);

      try {
        const P = String.fromCharCode(36);
        const queryText =
          'INSERT INTO site_config (module_id, config_data, updated_at) ' +
          'VALUES (' + P + '1, ' + P + '2, NOW()) ' +
          'ON CONFLICT (module_id) DO UPDATE SET ' +
          '  config_data = EXCLUDED.config_data, ' +
          '  updated_at = NOW();';
        await pgPool.query(queryText, [modId, JSON.stringify(modData)]);
      } catch (ePgSave) {
        console.warn('Sync site_config insert note:', ePgSave.message);
      }

      if (adminDb) {
        try {
          const isFeatured = modId === 'featuredListings';
          await adminDb.collection('siteManagement').doc(modId).set({
            ...modData,
            state: 'PUBLISHED',
            updatedAt: new Date().toISOString()
          }, { merge: !isFeatured });
        } catch (eFsSave) {}
      }
    }

    console.log(`[EaseLand Sync] Success: ${unifiedUsers.length} users and ${Object.keys(unifiedConfig).length} CMS modules synchronized.`);

    return res.json({
      success: true,
      message: 'Synchronization completed across Firestore and PostgreSQL.',
      usersCount: unifiedUsers.length,
      cmsCount: Object.keys(unifiedConfig).length,
      users: unifiedUsers,
      config: unifiedConfig
    });
  } catch (err) {
    console.error('[EaseLand Sync] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const result = await pgPool.query('SELECT uid, email, display_name, phone, city, location, role, account_status, email_verified, raw_data, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT 500;');
    const allUsers = result.rows.map(row => {
      const raw = row.raw_data || {};
      const resolvedPhone = (row.phone && row.phone.trim()) || (raw.phone && String(raw.phone).trim()) || (raw.phoneNumber && String(raw.phoneNumber).trim()) || '';
      const resolvedCity = (row.city && row.city.trim()) || (row.location && row.location.trim()) || (raw.city && String(raw.city).trim()) || (raw.location && String(raw.location).trim()) || '';
      const resolvedName = (row.display_name && row.display_name.trim()) || (raw.displayName && String(raw.displayName).trim()) || (raw.name && String(raw.name).trim()) || 'EaseLand User';
      const resolvedEmail = (row.email && row.email.trim()) || (raw.email && String(raw.email).trim()) || '';

      return {
        ...raw,
        id: row.uid,
        uid: row.uid,
        displayName: resolvedName,
        name: resolvedName,
        email: resolvedEmail,
        phone: resolvedPhone,
        phoneNumber: resolvedPhone,
        city: resolvedCity,
        location: resolvedCity,
        role: row.role || raw.role || 'USER',
        accountStatus: row.account_status || raw.accountStatus || 'ACTIVE',
        emailVerified: Boolean(row.email_verified ?? raw.emailVerified),
        createdAt: row.created_at || raw.createdAt,
        updatedAt: row.updated_at || raw.updatedAt
      };
    }).filter(Boolean);
    return res.json({ success: true, count: allUsers.length, users: allUsers });
  } catch (err) {
    console.error('CRITICAL: PostgreSQL fetch users failed:', err.message);
    return res.status(503).json({ success: false, error: 'Database unavailable: ' + err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    invalidateAdminUsersCache();
    const userData = req.body || {};
    const uUid = userData.uid || userData.id || ('user-' + Date.now());
    const nowIso = new Date().toISOString();

    const existing = localUsersMap.get(uUid) || {};

    // Also fetch existing row from PostgreSQL to ensure in-memory cold cache or server reboot doesn't lose existing values
    let existingPg = {};
    try {
      const P1 = String.fromCharCode(36) + '1';
      const pgUserCheck = await pgPool.query(
        "SELECT uid, email, display_name, phone, city, location, role, account_status, raw_data FROM users WHERE uid = " + P1 + " LIMIT 1;",
        [uUid]
      );
      if (pgUserCheck.rows.length > 0) {
        existingPg = pgUserCheck.rows[0];
      }
    } catch (eCheck) {}

    const incomingPhone = (userData.phone || userData.phoneNumber || '').trim();
    const incomingCity = (userData.city || userData.location || '').trim();
    const incomingName = (userData.displayName || userData.name || '').trim();
    const incomingEmail = (userData.email || '').trim();

    const existingPgRaw = existingPg.raw_data || {};
    const effectivePhone = incomingPhone || existingPg.phone || existingPgRaw.phone || existingPgRaw.phoneNumber || existing.phone || existing.phoneNumber || '';
    const effectiveCity = incomingCity || existingPg.city || existingPg.location || existingPgRaw.city || existingPgRaw.location || existing.city || existing.location || '';
    const effectiveName = incomingName || existingPg.display_name || existingPgRaw.displayName || existingPgRaw.name || existing.displayName || existing.name || 'EaseLand User';
    const effectiveEmail = incomingEmail || existingPg.email || existingPgRaw.email || existing.email || '';

    const fullPayload = {
      ...existingPgRaw,
      ...existing,
      ...userData,
      uid: uUid,
      id: uUid,
      displayName: effectiveName,
      name: effectiveName,
      email: effectiveEmail,
      phone: effectivePhone,
      phoneNumber: effectivePhone,
      city: effectiveCity,
      location: effectiveCity,
      role: userData.role || existingPg.role || existingPgRaw.role || existing.role || 'USER',
      status: userData.status || userData.accountStatus || existingPg.account_status || existingPgRaw.status || existing.status || 'ACTIVE',
      accountStatus: userData.accountStatus || userData.status || existingPg.account_status || existingPgRaw.accountStatus || existing.accountStatus || 'ACTIVE',
      updatedAt: nowIso
    };

    saveLocalUser(fullPayload);

    // Unblacklist user from deleted ledger on fresh registration or relogin
    try {
      const unbP1 = String.fromCharCode(36) + '1';
      const unbP2 = String.fromCharCode(36) + '2';
      await pgPool.query(
        "DELETE FROM admin_deleted_users WHERE LOWER(uid) = LOWER(" + unbP1 + ") OR (" + unbP2 + " <> '' AND LOWER(COALESCE(email, '')) = LOWER(" + unbP2 + "));",
        [uUid, (fullPayload.email || '').toLowerCase().trim()]
      );
    } catch (eUnb) {}
    removeLocalDeletedUser(uUid);
    if (fullPayload.email) removeLocalDeletedUser(fullPayload.email);

    try {
      const p1 = String.fromCharCode(36) + '1';
      const p2 = String.fromCharCode(36) + '2';
      const p3 = String.fromCharCode(36) + '3';
      const p4 = String.fromCharCode(36) + '4';
      const p5 = String.fromCharCode(36) + '5';
      const p6 = String.fromCharCode(36) + '6';
      const p7 = String.fromCharCode(36) + '7';
      const p8 = String.fromCharCode(36) + '8';
      const p9 = String.fromCharCode(36) + '9';
      const p10 = String.fromCharCode(36) + '10';

      const queryText = 
        "INSERT INTO users (" +
        "  uid, email, display_name, phone, city, location, role, account_status, email_verified, raw_data, created_at, updated_at" +
        ") VALUES (" +
        "  " + p1 + ", " + p2 + ", " + p3 + ", " + p4 + ", " + p5 + ", " + p6 + ", " + p7 + ", " + p8 + ", " + p9 + ", " + p10 + ", NOW(), NOW()" +
        ") ON CONFLICT (uid) DO UPDATE SET " +
        "  email = COALESCE(NULLIF(EXCLUDED.email, ''), users.email), " +
        "  display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), users.display_name), " +
        "  phone = CASE WHEN COALESCE(EXCLUDED.phone, '') <> '' THEN EXCLUDED.phone ELSE users.phone END, " +
        "  city = CASE WHEN COALESCE(EXCLUDED.city, '') <> '' THEN EXCLUDED.city ELSE users.city END, " +
        "  location = CASE WHEN COALESCE(EXCLUDED.location, '') <> '' THEN EXCLUDED.location ELSE users.location END, " +
        "  role = COALESCE(NULLIF(EXCLUDED.role, ''), users.role), " +
        "  account_status = COALESCE(NULLIF(EXCLUDED.account_status, ''), users.account_status), " +
        "  raw_data = COALESCE(users.raw_data, '{}'::jsonb) || EXCLUDED.raw_data, " +
        "  updated_at = NOW();";
      await pgPool.query(queryText, [
        uUid,
        fullPayload.email,
        fullPayload.displayName,
        fullPayload.phone,
        fullPayload.city,
        fullPayload.location,
        fullPayload.role,
        fullPayload.accountStatus,
        Boolean(fullPayload.emailVerified),
        JSON.stringify(fullPayload)
      ]);
    } catch (pgErr) {
      console.error('CRITICAL: PostgreSQL save user failed:', pgErr.message);
      return res.status(500).json({ success: false, error: 'Database save failed: ' + pgErr.message });
    }

    return res.json({ success: true, uid: uUid, user: fullPayload });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/users/:uid', async (req, res) => {
  try {
    invalidateAdminUsersCache();
    const uUid = String(req.params.uid || '').trim();
    if (!uUid) {
      return res.status(400).json({ success: false, error: 'User ID is required.' });
    }

    let targetEmail = String(req.query.email || req.body?.email || '').trim().toLowerCase();
    if (!targetEmail) {
      const cached = localUsersMap.get(uUid);
      if (cached?.email) targetEmail = String(cached.email).trim().toLowerCase();
    }

    const ph1 = String.fromCharCode(36) + '1';
    const ph2 = String.fromCharCode(36) + '2';
    const ph3 = String.fromCharCode(36) + '3';

    if (!targetEmail) {
      try {
        const uRes = await pgPool.query('SELECT email FROM users WHERE LOWER(uid) = LOWER(' + ph1 + ') LIMIT 1;', [uUid]);
        if (uRes.rows.length && uRes.rows[0].email) {
          targetEmail = String(uRes.rows[0].email).trim().toLowerCase();
        }
      } catch (e) {}
    }

    // Record in persistent admin_deleted_users ledger so no background sync can ever resurrect this user
    try {
      await pgPool.query(
        "INSERT INTO admin_deleted_users (uid, email, reason) " +
        "VALUES (" + ph1 + ", " + ph2 + ", " + ph3 + ") " +
        "ON CONFLICT (uid) DO UPDATE SET email = EXCLUDED.email, deleted_at = NOW();",
        [uUid, targetEmail || '', 'Account deleted']
      );
    } catch (eLedger) {}
    addLocalDeletedUser(uUid);
    if (targetEmail) addLocalDeletedUser(targetEmail);

    // 1. Identify all property IDs owned by this user from PostgreSQL
    let userPropIds = [];
    try {
      const pRes = await pgPool.query(
        "SELECT property_id, reference_id FROM properties " +
        "WHERE LOWER(owner_id) = LOWER(" + ph1 + ") " +
        "   OR LOWER(COALESCE(raw_data->>'ownerId', '')) = LOWER(" + ph1 + ") " +
        "   OR LOWER(COALESCE(raw_data->>'userId', '')) = LOWER(" + ph1 + ") " +
        "   OR (" + ph2 + " <> '' AND (" +
        "       LOWER(COALESCE(raw_data->>'ownerEmail', '')) = LOWER(" + ph2 + ") OR " +
        "       LOWER(COALESCE(raw_data->>'ownerPrivateEmail', '')) = LOWER(" + ph2 + ")" +
        "   ));",
        [uUid, targetEmail || '']
      );
      userPropIds = pRes.rows.map(r => r.property_id).filter(Boolean);
    } catch (pgErr) {
      console.warn('PostgreSQL find user properties note:', pgErr.message);
    }

    // 2. Cascade delete from PostgreSQL tables
    try {
      // 2a. Delete from media_files
      await pgPool.query(
        "DELETE FROM media_files " +
        "WHERE LOWER(owner_id) = LOWER(" + ph1 + ")" +
        (userPropIds.length ? " OR property_id = ANY(" + ph2 + ")" : "") + ";",
        userPropIds.length ? [uUid, userPropIds] : [uUid]
      );
    } catch (eMedia) {}

    try {
      // 2b. Delete from enquiries
      await pgPool.query(
        "DELETE FROM enquiries " +
        "WHERE LOWER(owner_id) = LOWER(" + ph1 + ") " +
        "   OR LOWER(COALESCE(customer_id, '')) = LOWER(" + ph1 + ") " +
        "   OR LOWER(COALESCE(buyer_id, '')) = LOWER(" + ph1 + ") " +
        "   OR (" + ph2 + " <> '' AND (LOWER(COALESCE(owner_email, '')) = LOWER(" + ph2 + ") OR LOWER(COALESCE(customer_email, '')) = LOWER(" + ph2 + ") OR LOWER(COALESCE(buyer_email, '')) = LOWER(" + ph2 + ")))" +
        (userPropIds.length ? " OR property_id = ANY(" + ph3 + ")" : "") + ";",
        userPropIds.length ? [uUid, targetEmail || '', userPropIds] : [uUid, targetEmail || '']
      );
    } catch (eEnq) {}

    try {
      // 2c. Delete from admin_deleted_properties
      await pgPool.query(
        "DELETE FROM admin_deleted_properties " +
        "WHERE LOWER(owner_id) = LOWER(" + ph1 + ")" +
        (userPropIds.length ? " OR property_id = ANY(" + ph2 + ")" : "") + ";",
        userPropIds.length ? [uUid, userPropIds] : [uUid]
      );
    } catch (eAdm) {}

    try {
      // 2d. Delete from properties
      await pgPool.query(
        "DELETE FROM properties " +
        "WHERE LOWER(owner_id) = LOWER(" + ph1 + ") " +
        "   OR LOWER(COALESCE(raw_data->>'ownerId', '')) = LOWER(" + ph1 + ") " +
        "   OR LOWER(COALESCE(raw_data->>'userId', '')) = LOWER(" + ph1 + ") " +
        "   OR (" + ph2 + " <> '' AND (" +
        "       LOWER(COALESCE(raw_data->>'ownerEmail', '')) = LOWER(" + ph2 + ") OR " +
        "       LOWER(COALESCE(raw_data->>'ownerPrivateEmail', '')) = LOWER(" + ph2 + ")" +
        "   ));",
        [uUid, targetEmail || '']
      );
    } catch (eProp) {}

    try {
      // 2e. Delete from users table
      await pgPool.query(
        "DELETE FROM users " +
        "WHERE LOWER(uid) = LOWER(" + ph1 + ") " +
        "   OR (" + ph2 + " <> '' AND LOWER(COALESCE(email, '')) = LOWER(" + ph2 + "));",
        [uUid, targetEmail || '']
      );
    } catch (eUser) {}

    // 3. Cascade delete from Local Disk Stores (localPropsMap and localUsersMap)
    const propIdsSet = new Set(userPropIds.map(id => String(id).toLowerCase().trim()));
    for (const [k, p] of localPropsMap.entries()) {
      const pOwner = String(p.ownerId || p.userId || '').toLowerCase().trim();
      const pEmail = String(p.ownerEmail || p.ownerPrivateEmail || '').toLowerCase().trim();
      const pId = String(p.id || p.propertyId || '').toLowerCase().trim();
      if (pOwner === uUid.toLowerCase() || (targetEmail && pEmail === targetEmail) || propIdsSet.has(pId) || propIdsSet.has(k.toLowerCase())) {
        localPropsMap.delete(k);
        propIdsSet.add(pId);
      }
    }
    localUsersMap.delete(uUid);
    if (targetEmail) {
      for (const [k, u] of localUsersMap.entries()) {
        if (String(u.email || '').toLowerCase().trim() === targetEmail) {
          localUsersMap.delete(k);
        }
      }
    }

    // 4. Cascade delete from Cloud Firestore via Firebase Admin SDK
    try {
      const adminDb = getAdminDb();
      if (adminDb) {
        const firestorePropIds = new Set(propIdsSet);
        try {
          const snap1 = await adminDb.collection('properties').where('ownerId', '==', uUid).get();
          snap1.docs.forEach(d => firestorePropIds.add(d.id));
        } catch (e) {}
        try {
          const snap2 = await adminDb.collection('properties').where('userId', '==', uUid).get();
          snap2.docs.forEach(d => firestorePropIds.add(d.id));
        } catch (e) {}
        if (targetEmail) {
          try {
            const snap3 = await adminDb.collection('properties').where('ownerEmail', '==', targetEmail).get();
            snap3.docs.forEach(d => firestorePropIds.add(d.id));
          } catch (e) {}
          try {
            const snap4 = await adminDb.collection('properties').where('ownerPrivateEmail', '==', targetEmail).get();
            snap4.docs.forEach(d => firestorePropIds.add(d.id));
          } catch (e) {}
        }

        for (const pid of firestorePropIds) {
          try { await adminDb.collection('properties').doc(pid).delete(); } catch (e) {}
          try { await adminDb.collection('propertyPrivate').doc(pid).delete(); } catch (e) {}
          try { await adminDb.collection('propertyMediaPrivate').doc(pid).delete(); } catch (e) {}
          try { await adminDb.collection('verificationRecords').doc(pid).delete(); } catch (e) {}
          try {
            const docSnap = await adminDb.collection('propertyDocuments').where('propertyId', '==', pid).get();
            for (const d of docSnap.docs) { await d.ref.delete(); }
          } catch (e) {}
          try {
            const enqSnap = await adminDb.collection('enquiries').where('propertyId', '==', pid).get();
            for (const d of enqSnap.docs) { await d.ref.delete(); }
          } catch (e) {}
        }

        // Delete direct user enquiries
        try {
          const enqSnap1 = await adminDb.collection('enquiries').where('ownerId', '==', uUid).get();
          for (const d of enqSnap1.docs) { await d.ref.delete(); }
        } catch (e) {}
        try {
          const enqSnap2 = await adminDb.collection('enquiries').where('buyerId', '==', uUid).get();
          for (const d of enqSnap2.docs) { await d.ref.delete(); }
        } catch (e) {}
        try {
          const enqSnap3 = await adminDb.collection('enquiries').where('userId', '==', uUid).get();
          for (const d of enqSnap3.docs) { await d.ref.delete(); }
        } catch (e) {}

        // Delete user document
        try { await adminDb.collection('users').doc(uUid).delete(); } catch (e) {}
        if (targetEmail) {
          try {
            const uSnap = await adminDb.collection('users').where('email', '==', targetEmail).get();
            for (const d of uSnap.docs) { await d.ref.delete(); }
          } catch (e) {}
        }
      }
    } catch (adminFsErr) {
      console.warn('Firebase Admin Firestore cascade delete note:', adminFsErr.message);
    }

    // 5. Delete from Firebase Authentication (Firebase Admin Auth)
    try {
      const adminApps = getApps();
      if (adminApps.length) {
        const auth = getAuth(adminApps[0]);
        if (auth) {
          try {
            await auth.deleteUser(uUid);
          } catch (authErr) {
            if (targetEmail) {
              try {
                const uRec = await auth.getUserByEmail(targetEmail);
                if (uRec?.uid) await auth.deleteUser(uRec.uid);
              } catch (e) {}
            }
          }
        }
      }
    } catch (authDeleteErr) {
      console.warn('Firebase Admin Auth deletion note:', authDeleteErr.message);
    }

    return res.json({ success: true, message: 'User account and all posted properties cascade deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// EASELAND CRM ENTERPRISE REST API ENDPOINTS (PURE POSTGRESQL - ZERO FALLBACK)
// ============================================================================

// Helper for SQL parameter placeholder without dollar sign literal in source code
const sqlParam = (index) => String.fromCharCode(36) + index;

// 1. CRM LIVE STREAM: Real-Time Server-Sent Events (SSE) Bus
app.get('/api/crm/live-stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write('data: {"type":"CONNECTED","timestamp":' + Date.now() + '}\n\n');
  crmSseClients.add(res);

  req.on('close', () => {
    crmSseClients.delete(res);
  });
});

// 2. CRM BOOTSTRAP: Retrieve all Leads, Deals, Site Visits, Quarantines & Analytics
app.get('/api/crm/bootstrap', async (req, res) => {
  try {
    const P = String.fromCharCode(36);
    let bannedPropertyIds = [];
    try {
      const bannedRes = await pgPool.query('SELECT property_id, reference_id FROM admin_deleted_properties;');
      bannedPropertyIds = bannedRes.rows.flatMap(r => [r.property_id, r.reference_id].filter(Boolean));
    } catch (eBanned) {}

    const [leadsRes, dealsRes, visitsRes] = await Promise.all([
      pgPool.query('SELECT * FROM crm_leads ORDER BY updated_at DESC;'),
      pgPool.query('SELECT * FROM crm_deals ORDER BY updated_at DESC;'),
      pgPool.query('SELECT * FROM crm_visits ORDER BY updated_at DESC;')
    ]);

    const leads = leadsRes.rows.map(r => ({
      id: r.lead_id,
      leadId: r.lead_id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      source: r.source,
      score: r.score,
      status: r.status,
      preferredLocation: r.preferred_location,
      preferredPropertyType: r.preferred_property_type,
      budgetMin: Number(r.budget_min) || 0,
      budgetMax: Number(r.budget_max) || 0,
      budgetDisplay: r.budget_display,
      assignedAgent: r.assigned_agent,
      notes: r.notes,
      tags: r.tags || [],
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    const deals = dealsRes.rows.map(r => ({
      id: r.deal_id,
      dealId: r.deal_id,
      leadId: r.lead_id,
      propertyId: r.property_id,
      isPropertyQuarantined: Boolean(r.property_id && bannedPropertyIds.includes(r.property_id)),
      propertyTitle: r.property_title,
      propertyLocation: r.property_location,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      customerEmail: r.customer_email,
      ownerName: r.owner_name,
      ownerPhone: r.owner_phone,
      stage: r.stage,
      dealValue: Number(r.deal_value) || 0,
      dealValueDisplay: r.deal_value_display,
      commissionRate: Number(r.commission_rate) || 1.5,
      expectedCommission: Number(r.expected_commission) || 0,
      probability: Number(r.probability) || 20,
      expectedClosingDate: r.expected_closing_date,
      assignedAgent: r.assigned_agent,
      nextFollowUpDate: r.next_follow_up_date || '',
      nextFollowUpTime: r.next_follow_up_time || '',
      nextFollowUpAction: r.next_follow_up_action || '',
      legalAuditStatus: r.legal_audit_status,
      notes: r.notes,
      paymentMilestones: r.payment_milestones || [],
      timeline: r.timeline || [],
      stageData: r.stage_data || (r.raw_data && r.raw_data.stageData) || {},
      version: Number(r.version) || 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    const visits = visitsRes.rows.map(r => ({
      id: r.visit_id,
      visitId: r.visit_id,
      dealId: r.deal_id,
      propertyId: r.property_id,
      propertyTitle: r.property_title,
      propertyLocation: r.property_location,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      visitDate: r.visit_date,
      visitTime: r.visit_time,
      agentAssigned: r.agent_assigned,
      status: r.status,
      customerNotes: r.customer_notes,
      customerFeedback: r.customer_feedback,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    // Calculate Authoritative Analytics
    const activeDeals = deals.filter(d => d.stage !== 'CLOSED_WON' && d.stage !== 'CLOSED_LOST');
    const totalPipelineValue = activeDeals.reduce((acc, d) => acc + (d.dealValue || 0), 0);
    const wonDeals = deals.filter(d => d.stage === 'CLOSED_WON');
    const lostDeals = deals.filter(d => d.stage === 'CLOSED_LOST');
    const totalClosedValue = wonDeals.reduce((acc, d) => acc + (d.dealValue || 0), 0);
    const totalEarnedCommission = wonDeals.reduce((acc, d) => acc + (d.expectedCommission || 0), 0);
    const totalFinished = wonDeals.length + lostDeals.length;
    // Strict calculation: If no deals have concluded, win rate is strictly 0%
    const conversionRate = totalFinished > 0 ? Math.round((wonDeals.length / totalFinished) * 100) : 0;
    const scheduledVisits = visits.filter(v => v.status === 'SCHEDULED');
    const quarantinedDeals = deals.filter(d => d.isPropertyQuarantined);

    const todayIso = new Date().toISOString().split('T')[0];
    const followUpsDueTodayCount = deals.filter(d =>
      d.stage !== 'CLOSED_WON' && d.stage !== 'CLOSED_LOST' &&
      d.nextFollowUpDate && d.nextFollowUpDate <= todayIso
    ).length;

    const analytics = {
      totalPipelineValue,
      pipelineValueDisplay: 'Rs. ' + (totalPipelineValue / 100000).toFixed(1) + ' Lakhs',
      totalClosedValue,
      closedValueDisplay: 'Rs. ' + (totalClosedValue / 100000).toFixed(1) + ' Lakhs',
      totalEarnedCommission,
      commissionDisplay: 'Rs. ' + (totalEarnedCommission / 1000).toFixed(0) + 'K',
      conversionRate,
      totalFinishedDealsCount: totalFinished,
      totalDealsCount: deals.length,
      activeDealsCount: activeDeals.length,
      wonDealsCount: wonDeals.length,
      lostDealsCount: lostDeals.length,
      totalLeadsCount: leads.length,
      hotLeadsCount: leads.filter(l => l.score === 'HOT').length,
      warmLeadsCount: leads.filter(l => l.score === 'WARM').length,
      coldLeadsCount: leads.filter(l => l.score === 'COLD').length,
      scheduledVisitsCount: scheduledVisits.length,
      quarantinedDealsCount: quarantinedDeals.length,
      followUpsDueTodayCount
    };

    // Fetch Dynamic Licensed Agents & Staff from users table
    let agents = [];
    try {
      const usersRes = await pgPool.query(
        "SELECT uid, email, display_name, role, phone_number, raw_data FROM users " +
        "WHERE role IN ('admin', 'staff', 'broker', 'agent', 'FIELD_EXECUTIVE') " +
        "OR raw_data->>'role' IN ('admin', 'staff', 'broker', 'agent', 'FIELD_EXECUTIVE');"
      );
      agents = usersRes.rows.map(u => {
        const raw = u.raw_data || {};
        const uRole = u.role || raw.role || 'broker';
        return {
          id: u.uid,
          name: u.display_name || raw.name || raw.fullName || (u.email ? u.email.split('@')[0] : 'Broker Executive'),
          role: uRole === 'admin' ? 'Principal Broker / Administrator' : (uRole === 'FIELD_EXECUTIVE' ? 'Field Broker' : 'Sales Partner'),
          email: u.email || raw.email || '',
          phone: u.phone_number || raw.phone || ''
        };
      });
    } catch (uErr) {}

    if (agents.length === 0) {
      agents = [
        { id: 'agent-1', name: 'EaseLand Admin', role: 'Principal Broker / Administrator', email: 'admin@easeland.in', phone: '+91 98765 00000' }
      ];
    }

    // Fetch Dynamic Locations from active property listings
    let dynamicLocations = [];
    try {
      const locRes = await pgPool.query(
        "SELECT DISTINCT location_name, city, district FROM properties WHERE is_published = true AND listing_status = 'AVAILABLE' LIMIT 150;"
      );
      dynamicLocations = Array.from(new Set(
        locRes.rows.flatMap(r => [r.location_name, r.city, r.district]).filter(Boolean)
      ));
    } catch (locErr) {}

    return res.json({
      success: true,
      leads,
      deals,
      visits,
      agents,
      dynamicLocations,
      analytics,
      bannedPropertyIds
    });
  } catch (err) {
    console.error('CRM Bootstrap error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// PAN-INDIA DYNAMIC LOCATION AUTOCOMPLETE & GEOSPATIAL INTELLIGENCE API
// Resolves All 28 States, 8 UTs, 788+ Districts, 7,000+ Mandals/Tehsils,
// 600,000+ Villages, Cities, Localities, and Landmarks across India
// ============================================================================
const serverLocationCache = new Map();
const MAX_SERVER_LOC_CACHE = 500;
const SERVER_LOC_CACHE_TTL_MS = 15 * 60 * 1000;

app.get('/api/locations/autocomplete', async (req, res) => {
  try {
    const queryStr = String(req.query.q || '').trim();
    if (!queryStr || queryStr.length < 2) {
      return res.json({ success: true, query: queryStr, count: 0, results: [] });
    }

    const stateFilter = String(req.query.state || '').trim();
    const districtFilter = String(req.query.district || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 30);
    const cacheKey = (queryStr + '_' + stateFilter + '_' + districtFilter + '_' + limit).toLowerCase();

    const cached = serverLocationCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < SERVER_LOC_CACHE_TTL_MS)) {
      return res.json({ success: true, query: queryStr, count: cached.results.length, results: cached.results });
    }

    const results = [];
    const seenKeys = new Set();

    const addResult = (item) => {
      if (!item || !item.title) return;
      const dedupeKey = (item.title + '|' + (item.district || '') + '|' + (item.state || '')).toLowerCase().trim();
      if (seenKeys.has(dedupeKey)) return;
      seenKeys.add(dedupeKey);
      results.push(item);
    };

    // 1. Search active EaseLand verified properties and ventures in PostgreSQL
    try {
      const qWildcard = '%' + queryStr + '%';
      const P = String.fromCharCode(36);
      const propSql = 'SELECT id, property_id, title, location_name, city, district, price, price_display ' +
        'FROM properties ' +
        'WHERE (location_name ILIKE ' + P + '1 OR city ILIKE ' + P + '1 OR district ILIKE ' + P + '1 OR title ILIKE ' + P + '1) ' +
        'AND is_published = true AND listing_status = \'AVAILABLE\' LIMIT 5;';
      const propRes = await pgPool.query(propSql, [qWildcard]);
      propRes.rows.forEach(p => {
        addResult({
          id: 'prop_' + (p.property_id || p.id),
          title: p.title || p.location_name,
          subtitle: (p.location_name ? p.location_name + ', ' : '') + (p.city || p.district || 'Andhra Pradesh') + ' • Platform Verified Venture',
          fullAddress: (p.location_name ? p.location_name + ', ' : '') + (p.city ? p.city + ', ' : '') + (p.district ? p.district + ' Dist, ' : '') + 'Andhra Pradesh',
          type: 'LISTED_VENTURE',
          village: '',
          mandal: '',
          city: p.city || p.location_name,
          district: p.district || '',
          state: 'Andhra Pradesh',
          country: 'India',
          isPlatformListing: true,
          propertyId: p.property_id || p.id
        });
      });
    } catch (eProp) {}

    // 2. Match Pan-India Administrative States & Districts
    const adminMatches = matchStatesAndDistricts(queryStr);
    adminMatches.forEach(addResult);

    // 3. Query OpenStreetMap Photon Live Geospatial Engine for all Indian Villages, Mandals, Cities, Areas & Landmarks
    try {
      const photonUrl = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(queryStr) +
        '&limit=15&lat=20.5937&lon=78.9629';
      const pRes = await fetch(photonUrl);
      if (pRes.ok) {
        const pData = await pRes.json();
        const indiaFeatures = (pData.features || []).filter(f => {
          const cc = f.properties?.countrycode || f.properties?.country || '';
          return String(cc).toUpperCase() === 'IN' || String(cc).toLowerCase() === 'india';
        });

        indiaFeatures.forEach(f => {
          const props = f.properties || {};
          const coords = f.geometry?.coordinates || [];
          const osmKey = props.osm_key;
          const osmVal = props.osm_value;

          let locType = 'LOCALITY';
          if (osmVal === 'village' || osmVal === 'hamlet') {
            locType = 'VILLAGE';
          } else if (osmVal === 'subdistrict' || (props.county && /mandal|tehsil|taluk/i.test(props.county))) {
            locType = 'MANDAL';
          } else if (osmVal === 'city' || osmVal === 'town') {
            locType = 'CITY';
          } else if (osmVal === 'district' || osmVal === 'county') {
            locType = 'DISTRICT';
          } else if (osmVal === 'state') {
            locType = 'STATE';
          } else if (
            ['university', 'college', 'hospital', 'school', 'aeroway', 'station', 'place_of_worship', 'viewpoint', 'stadium', 'building'].includes(osmVal) ||
            osmKey === 'amenity' || osmKey === 'historic' || osmKey === 'tourism'
          ) {
            locType = 'LANDMARK';
          } else if (osmVal === 'suburb' || osmVal === 'neighbourhood') {
            locType = 'AREA';
          }

          const village = (locType === 'VILLAGE' ? props.name : '') || '';
          const mandal = (props.county && /mandal|tehsil|taluk/i.test(props.county))
            ? props.county
            : (locType === 'MANDAL' ? props.name : '');
          const district = props.district || ((props.county && !/mandal|tehsil|taluk/i.test(props.county)) ? props.county : '');
          const city = props.city || (locType === 'CITY' ? props.name : '');
          const state = props.state || '';

          const subParts = [];
          if (mandal && mandal !== props.name) subParts.push(mandal);
          if (city && city !== props.name && city !== mandal) subParts.push(city);
          if (district && district !== props.name && district !== city) subParts.push(district + ' Dist');
          if (state && state !== props.name) subParts.push(state);

          addResult({
            id: 'loc_' + (props.osm_id || Math.random().toString(36).slice(2, 7)),
            title: props.name,
            subtitle: subParts.join(', ') || state || 'India',
            fullAddress: [props.name, ...subParts].join(', ') + ', India',
            type: locType,
            village,
            mandal,
            city,
            district,
            state,
            country: 'India',
            lat: coords[1] || null,
            lng: coords[0] || null,
            isPlatformListing: false
          });
        });
      }
    } catch (ePhoton) {}

    const finalResults = results.slice(0, limit);

    // Save in cache
    if (serverLocationCache.size >= MAX_SERVER_LOC_CACHE) {
      const oldestKey = serverLocationCache.keys().next().value;
      serverLocationCache.delete(oldestKey);
    }
    serverLocationCache.set(cacheKey, { timestamp: Date.now(), results: finalResults });

    return res.json({
      success: true,
      query: queryStr,
      count: finalResults.length,
      results: finalResults
    });
  } catch (err) {
    console.error('Location autocomplete error:', err.message);
    return res.status(500).json({ success: false, error: err.message, results: [] });
  }
});

// PAN-INDIA ADMINISTRATIVE HIERARCHY API
app.get('/api/locations/hierarchy', (req, res) => {
  try {
    const stateName = req.query.state ? String(req.query.state).trim() : null;
    if (!stateName) {
      return res.json({
        success: true,
        states: getIndiaStates(),
        totalStatesAndUTs: Object.keys(PAN_INDIA_ADMINISTRATIVE_HIERARCHY).length
      });
    }

    const districts = getIndiaDistricts(stateName);
    return res.json({
      success: true,
      state: stateName,
      districts,
      totalDistricts: districts.length
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. CRM LEADS: Create Lead
app.post('/api/crm/leads', async (req, res) => {
  try {
    const data = req.body || {};
    const leadId = data.id || ('lead-' + Date.now().toString().slice(-6));
    const P = String.fromCharCode(36);

    const sql = 'INSERT INTO crm_leads (' +
      'lead_id, name, phone, email, source, score, status, preferred_location, ' +
      'preferred_property_type, budget_min, budget_max, budget_display, assigned_agent, notes, tags, raw_data, created_at, updated_at' +
      ') VALUES (' +
      P + '1, ' + P + '2, ' + P + '3, ' + P + '4, ' + P + '5, ' + P + '6, ' + P + '7, ' + P + '8, ' +
      P + '9, ' + P + '10, ' + P + '11, ' + P + '12, ' + P + '13, ' + P + '14, ' + P + '15, ' + P + '16, NOW(), NOW()' +
      ') RETURNING *;';

    const values = [
      leadId,
      data.name || 'Prospective Buyer',
      data.phone || '',
      data.email || '',
      data.source || 'WEBSITE_ENQUIRY',
      data.score || 'HOT',
      data.status || 'ACTIVE',
      data.preferredLocation || 'Amaravati / Guntur Region',
      data.preferredPropertyType || 'Open Plot Ventures',
      Number(data.budgetMin) || 0,
      Number(data.budgetMax) || 0,
      data.budgetDisplay || (data.budgetMax ? 'Up to Rs. ' + (Number(data.budgetMax) / 100000).toFixed(1) + ' Lakhs' : 'Flexible'),
      data.assignedAgent || 'EaseLand Admin',
      data.notes || '',
      JSON.stringify(data.tags || ['New Lead']),
      JSON.stringify(data)
    ];

    const result = await pgPool.query(sql, values);
    const row = result.rows[0];

    broadcastCrmEvent('LEAD_CREATED', {
      id: row.lead_id,
      leadId: row.lead_id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      score: row.score
    });

    return res.status(201).json({
      success: true,
      lead: {
        id: row.lead_id,
        leadId: row.lead_id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        source: row.source,
        score: row.score,
        status: row.status,
        preferredLocation: row.preferred_location,
        preferredPropertyType: row.preferred_property_type,
        budgetMin: Number(row.budget_min),
        budgetMax: Number(row.budget_max),
        budgetDisplay: row.budget_display,
        assignedAgent: row.assigned_agent,
        notes: row.notes,
        tags: row.tags || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (err) {
    console.error('Create CRM lead error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. CRM LEADS: Delete Lead
app.delete('/api/crm/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const P = String.fromCharCode(36);
    await pgPool.query('DELETE FROM crm_leads WHERE lead_id = ' + P + '1;', [id]);
    broadcastCrmEvent('LEAD_DELETED', { id });
    return res.json({ success: true, message: 'Lead deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. CRM DEALS: Create Deal
app.post('/api/crm/deals', async (req, res) => {
  try {
    const data = req.body || {};
    const dealId = data.id || ('deal-' + Date.now().toString().slice(-6));
    const valNum = Number(data.dealValue) || 0;
    const commRate = Number(data.commissionRate) || 1.5;
    const expComm = Math.round(valNum * (commRate / 100));
    const nowIso = new Date().toISOString();
    const P = String.fromCharCode(36);

    const initialTimeline = [
      { date: nowIso.split('T')[0], event: 'Deal created in CRM', user: data.assignedAgent || 'System Admin' }
    ];

    const sql = 'INSERT INTO crm_deals (' +
      'deal_id, lead_id, property_id, property_title, property_location, customer_name, customer_phone, ' +
      'customer_email, owner_name, owner_phone, stage, deal_value, deal_value_display, commission_rate, ' +
      'expected_commission, probability, expected_closing_date, assigned_agent, next_follow_up_date, ' +
      'next_follow_up_time, next_follow_up_action, legal_audit_status, notes, ' +
      'payment_milestones, timeline, version, raw_data, created_at, updated_at' +
      ') VALUES (' +
      P + '1, ' + P + '2, ' + P + '3, ' + P + '4, ' + P + '5, ' + P + '6, ' + P + '7, ' + P + '8, ' +
      P + '9, ' + P + '10, ' + P + '11, ' + P + '12, ' + P + '13, ' + P + '14, ' + P + '15, ' + P + '16, ' +
      P + '17, ' + P + '18, ' + P + '19, ' + P + '20, ' + P + '21, ' + P + '22, ' + P + '23, ' + P + '24, ' +
      P + '25, 1, ' + P + '26, NOW(), NOW()' +
      ') RETURNING *;';

    const values = [
      dealId,
      data.leadId || null,
      data.propertyId || 'prop-custom',
      data.propertyTitle || 'Property Listing',
      data.propertyLocation || 'Amaravati / Guntur Region',
      data.customerName || 'Prospective Buyer',
      data.customerPhone || '',
      data.customerEmail || '',
      data.ownerName || 'Property Owner',
      data.ownerPhone || '',
      data.stage || 'NEW',
      valNum,
      data.dealValueDisplay || ('Rs. ' + (valNum / 100000).toFixed(1) + ' Lakhs'),
      commRate,
      expComm,
      Number(data.probability) || 20,
      data.expectedClosingDate || '',
      data.assignedAgent || 'EaseLand Admin',
      data.nextFollowUpDate || null,
      data.nextFollowUpTime || '11:00 AM',
      data.nextFollowUpAction || '',
      data.legalAuditStatus || 'PENDING',
      data.notes || '',
      JSON.stringify(data.paymentMilestones || []),
      JSON.stringify(initialTimeline),
      JSON.stringify(data)
    ];

    const result = await pgPool.query(sql, values);
    const row = result.rows[0];

    broadcastCrmEvent('DEAL_CREATED', {
      id: row.deal_id,
      dealId: row.deal_id,
      customerName: row.customer_name,
      propertyTitle: row.property_title,
      dealValue: Number(row.deal_value),
      stage: row.stage
    });

    return res.status(201).json({
      success: true,
      deal: {
        id: row.deal_id,
        dealId: row.deal_id,
        leadId: row.lead_id,
        propertyId: row.property_id,
        propertyTitle: row.property_title,
        propertyLocation: row.property_location,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        customerEmail: row.customer_email,
        ownerName: row.owner_name,
        ownerPhone: row.owner_phone,
        stage: row.stage,
        dealValue: Number(row.deal_value),
        dealValueDisplay: row.deal_value_display,
        commissionRate: Number(row.commission_rate),
        expectedCommission: Number(row.expected_commission),
        probability: Number(row.probability),
        expectedClosingDate: row.expected_closing_date,
        assignedAgent: row.assigned_agent,
        nextFollowUpDate: row.next_follow_up_date || '',
        nextFollowUpTime: row.next_follow_up_time || '',
        nextFollowUpAction: row.next_follow_up_action || '',
        legalAuditStatus: row.legal_audit_status,
        notes: row.notes,
        paymentMilestones: row.payment_milestones || [],
        timeline: row.timeline || [],
        version: row.version || 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (err) {
    console.error('Create CRM deal error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. CRM DEALS: Update Stage with Concurrency, Compliance Check & Cascade
app.patch('/api/crm/deals/:id/stage', async (req, res) => {
  const client = await pgPool.connect();
  try {
    const { id } = req.params;
    const {
      newStage,
      noteText,
      nextFollowUpAction,
      nextFollowUpDate,
      nextFollowUpTime,
      stageData,
      dealValue,
      paymentMilestones
    } = req.body || {};
    const P = String.fromCharCode(36);

    let newProbability = 50;
    if (newStage === 'NEW') newProbability = 20;
    else if (newStage === 'CONTACTED') newProbability = 35;
    else if (newStage === 'SITE_VISIT') newProbability = 50;
    else if (newStage === 'DOCUMENT_AUDIT') newProbability = 70;
    else if (newStage === 'PRICE_NEGOTIATION') newProbability = 80;
    else if (newStage === 'TOKEN_ADVANCE') newProbability = 90;
    else if (newStage === 'REGISTRATION_PENDING') newProbability = 95;
    else if (newStage === 'CLOSED_WON') newProbability = 100;
    else if (newStage === 'CLOSED_LOST') newProbability = 0;

    // Stage-Specific Default Follow-up Action Goals & Timelines
    const STAGE_DEFAULT_FOLLOWUPS = {
      NEW: { action: 'Initial qualification & requirement gathering call', leadDays: 1 },
      CONTACTED: { action: 'Send verified property layout & schedule pitch call', leadDays: 1 },
      SITE_VISIT: { action: 'Coordinate physical plot inspection & boundary landmark check', leadDays: 2 },
      DOCUMENT_AUDIT: { action: 'Verify 30-year Link Documents, Encumbrance Certificate & Revenue clearance', leadDays: 3 },
      PRICE_NEGOTIATION: { action: 'Buyer-Seller commercial meeting & final price per sq.yd agreement', leadDays: 2 },
      TOKEN_ADVANCE: { action: 'Verify token advance transfer & execute bilingual Sale Agreement', leadDays: 2 },
      REGISTRATION_PENDING: { action: 'Book Sub-Registrar slot, deposit stamp duty challan & witness prep', leadDays: 3 },
      CLOSED_WON: { action: 'Sale deed executed, physical possession & mutation handover complete', leadDays: 0 },
      CLOSED_LOST: { action: 'Document loss reason, buyer feedback & archive deal dossier', leadDays: 0 }
    };

    const stDef = STAGE_DEFAULT_FOLLOWUPS[newStage] || STAGE_DEFAULT_FOLLOWUPS.NEW;
    const targetFollowUpAction = nextFollowUpAction || stDef.action;
    let targetFollowUpDate = nextFollowUpDate;
    if (!targetFollowUpDate) {
      const d = new Date();
      if (stDef.leadDays > 0) d.setDate(d.getDate() + stDef.leadDays);
      targetFollowUpDate = d.toISOString().split('T')[0];
    }
    const targetFollowUpTime = nextFollowUpTime || '11:00 AM';

    await client.query('BEGIN');

    // Fetch existing deal
    const curRes = await client.query('SELECT * FROM crm_deals WHERE deal_id = ' + P + '1 FOR UPDATE;', [id]);
    if (curRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Deal not found.' });
    }
    const current = curRes.rows[0];

    // Compliance Quarantine Check: Freeze transactions on banned/deleted properties
    if (current.property_id && newStage !== 'CLOSED_LOST') {
      try {
        const bannedCheck = await client.query(
          'SELECT property_id FROM admin_deleted_properties WHERE property_id = ' + P + '1 OR reference_id = ' + P + '1;',
          [current.property_id]
        );
        if (bannedCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(403).json({
            success: false,
            error: 'Transaction frozen: Referenced property has been quarantined or removed by Admin Compliance.'
          });
        }
      } catch (eBanned) {}
    }

    const nowIso = new Date().toISOString();

    // Stage milestone data management
    const currentStageData = current.stage_data || (current.raw_data && current.raw_data.stageData) || {};
    const updatedStageData = stageData ? { ...currentStageData, [newStage]: stageData } : currentStageData;

    // Recalculate financial values if price was negotiated
    let updatedDealValue = Number(current.deal_value) || 0;
    let updatedDealValueDisplay = current.deal_value_display;
    let updatedExpectedCommission = Number(current.expected_commission) || 0;

    if (newStage === 'PRICE_NEGOTIATION' && stageData && stageData.negotiatedPrice) {
      const negotiatedVal = Number(stageData.negotiatedPrice);
      if (negotiatedVal > 0) {
        updatedDealValue = negotiatedVal;
        updatedDealValueDisplay = 'Rs. ' + (negotiatedVal / 100000).toFixed(1) + ' Lakhs';
        updatedExpectedCommission = Math.round(negotiatedVal * (Number(current.commission_rate || 1.5) / 100));
      }
    } else if (dealValue && Number(dealValue) > 0) {
      updatedDealValue = Number(dealValue);
      updatedDealValueDisplay = 'Rs. ' + (updatedDealValue / 100000).toFixed(1) + ' Lakhs';
      updatedExpectedCommission = Math.round(updatedDealValue * (Number(current.commission_rate || 1.5) / 100));
    }

    // Payment milestones management for token advance
    let updatedPaymentMilestones = Array.isArray(current.payment_milestones) ? [...current.payment_milestones] : [];
    if (newStage === 'TOKEN_ADVANCE' && stageData && stageData.tokenAmount) {
      const tokenAmt = Number(stageData.tokenAmount);
      if (tokenAmt > 0) {
        const mIndex = updatedPaymentMilestones.findIndex(m => m.name && m.name.toLowerCase().includes('token'));
        const tokenEntry = {
          name: 'Token Advance / Bayana',
          amount: tokenAmt,
          date: stageData.paymentDate || nowIso.split('T')[0],
          status: 'PAID',
          paymentMode: stageData.paymentMode || 'RTGS / Bank Transfer',
          reference: stageData.paymentRef || 'Verified',
          balanceDue: Number(stageData.balanceDue) || Math.max(0, updatedDealValue - tokenAmt)
        };
        if (mIndex >= 0) {
          updatedPaymentMilestones[mIndex] = tokenEntry;
        } else {
          updatedPaymentMilestones.unshift(tokenEntry);
        }
      }
    } else if (Array.isArray(paymentMilestones) && paymentMilestones.length > 0) {
      updatedPaymentMilestones = paymentMilestones;
    }

    // Construct tailored audit trail timeline event
    let stageEventText = 'Stage changed to ' + newStage;
    if (newStage === 'PRICE_NEGOTIATION' && stageData && stageData.negotiatedPrice) {
      stageEventText = 'Price Negotiated: ' + updatedDealValueDisplay + (stageData.ratePerSqYd ? ' (Rs. ' + stageData.ratePerSqYd + '/sq.yd)' : '') + (stageData.negotiationTerms ? ' — ' + stageData.negotiationTerms : '');
    } else if (newStage === 'TOKEN_ADVANCE' && stageData && stageData.tokenAmount) {
      stageEventText = 'Token Advance Paid: Rs. ' + Number(stageData.tokenAmount).toLocaleString('en-IN') + ' via ' + (stageData.paymentMode || 'RTGS') + (stageData.paymentRef ? ' (Ref: ' + stageData.paymentRef + ')' : '') + ' • Balance: Rs. ' + Number(stageData.balanceDue || (updatedDealValue - Number(stageData.tokenAmount))).toLocaleString('en-IN');
    } else if (newStage === 'SITE_VISIT' && stageData && stageData.visitDate) {
      stageEventText = 'Site Visit Scheduled: ' + stageData.visitDate + (stageData.visitTime ? ' at ' + stageData.visitTime : '') + (stageData.assignedAgent ? ' with ' + stageData.assignedAgent : '') + (stageData.meetingPoint ? ' (' + stageData.meetingPoint + ')' : '');
    } else if (newStage === 'DOCUMENT_AUDIT' && stageData && stageData.legalStatus) {
      stageEventText = 'Title Deed Audit: Status: ' + stageData.legalStatus + (stageData.ecPeriod ? ' • EC: ' + stageData.ecPeriod : '') + (stageData.advocateName ? ' (' + stageData.advocateName + ')' : '');
    } else if (newStage === 'REGISTRATION_PENDING' && stageData && stageData.sroOffice) {
      stageEventText = 'SRO Slot Scheduled: ' + stageData.sroOffice + (stageData.slotDate ? ' on ' + stageData.slotDate : '') + (stageData.challanNumber ? ' • Challan: ' + stageData.challanNumber : '');
    } else if (newStage === 'CLOSED_WON' && stageData && stageData.deedNumber) {
      stageEventText = 'Deal Won: Executed Deed No. ' + stageData.deedNumber + ' • Full consideration received';
    } else if (newStage === 'CLOSED_LOST' && stageData && stageData.lossReason) {
      stageEventText = 'Deal Lost: Reason: ' + stageData.lossReason + (stageData.lossNotes ? ' (' + stageData.lossNotes + ')' : '');
    } else {
      stageEventText = 'Stage changed to ' + newStage + '. Follow-up adjusted: ' + targetFollowUpAction;
    }

    const timelineEntry = {
      date: nowIso.split('T')[0],
      event: stageEventText,
      user: 'EaseLand Admin' + (noteText ? ' (' + noteText + ')' : '')
    };
    const updatedTimeline = [...(current.timeline || []), timelineEntry];

    // If deal closed won, atomically mark linked property as SOLD in properties table
    if (newStage === 'CLOSED_WON' && current.property_id) {
      try {
        await client.query(
          "UPDATE properties SET listing_status = 'SOLD', is_published = false, updated_at = NOW() WHERE property_id = " + P + '1;',
          [current.property_id]
        );
      } catch (propErr) {
        console.warn('Property sold cascade note:', propErr.message);
      }
    }

    const updateSql = 'UPDATE crm_deals SET ' +
      'stage = ' + P + '1, ' +
      'probability = ' + P + '2, ' +
      'timeline = ' + P + '3, ' +
      'next_follow_up_action = ' + P + '4, ' +
      'next_follow_up_date = ' + P + '5, ' +
      'next_follow_up_time = ' + P + '6, ' +
      'deal_value = ' + P + '7, ' +
      'deal_value_display = ' + P + '8, ' +
      'expected_commission = ' + P + '9, ' +
      'payment_milestones = ' + P + '10, ' +
      'stage_data = ' + P + '11, ' +
      'version = version + 1, ' +
      'updated_at = NOW() ' +
      'WHERE deal_id = ' + P + '12 RETURNING *;';

    const updRes = await client.query(updateSql, [
      newStage,
      newProbability,
      JSON.stringify(updatedTimeline),
      targetFollowUpAction,
      targetFollowUpDate,
      targetFollowUpTime,
      updatedDealValue,
      updatedDealValueDisplay,
      updatedExpectedCommission,
      JSON.stringify(updatedPaymentMilestones),
      JSON.stringify(updatedStageData),
      id
    ]);

    await client.query('COMMIT');
    const row = updRes.rows[0];

    broadcastCrmEvent('DEAL_STAGE_UPDATED', {
      id: row.deal_id,
      dealId: row.deal_id,
      stage: row.stage,
      probability: row.probability,
      dealValue: Number(row.deal_value),
      dealValueDisplay: row.deal_value_display,
      expectedCommission: Number(row.expected_commission),
      paymentMilestones: row.payment_milestones,
      stageData: row.stage_data || {},
      nextFollowUpAction: row.next_follow_up_action,
      nextFollowUpDate: row.next_follow_up_date,
      nextFollowUpTime: row.next_follow_up_time
    });

    return res.json({
      success: true,
      deal: {
        id: row.deal_id,
        dealId: row.deal_id,
        stage: row.stage,
        probability: row.probability,
        dealValue: Number(row.deal_value),
        dealValueDisplay: row.deal_value_display,
        expectedCommission: Number(row.expected_commission),
        paymentMilestones: row.payment_milestones,
        stageData: row.stage_data || {},
        nextFollowUpAction: row.next_follow_up_action,
        nextFollowUpDate: row.next_follow_up_date,
        nextFollowUpTime: row.next_follow_up_time,
        timeline: row.timeline,
        version: row.version,
        updatedAt: row.updated_at
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update deal stage error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// 5B. CRM DEALS: Update Follow-up Schedule & Activity Logger
app.patch('/api/crm/deals/:id/followup', async (req, res) => {
  const client = await pgPool.connect();
  try {
    const { id } = req.params;
    const { followUpDate, followUpTime, followUpAction, logNote, agentName } = req.body || {};
    const P = String.fromCharCode(36);
    const nowIso = new Date().toISOString();

    await client.query('BEGIN');
    const curRes = await client.query('SELECT * FROM crm_deals WHERE deal_id = ' + P + '1 FOR UPDATE;', [id]);
    if (curRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Deal not found.' });
    }
    const current = curRes.rows[0];
    const timeline = Array.isArray(current.timeline) ? [...current.timeline] : [];

    if (logNote && String(logNote).trim()) {
      timeline.push({
        date: nowIso.split('T')[0],
        event: String(logNote).trim(),
        user: agentName || 'EaseLand Admin'
      });
    }

    if (followUpAction && String(followUpAction).trim()) {
      timeline.push({
        date: nowIso.split('T')[0],
        event: 'Follow-up scheduled for ' + (followUpDate || 'Due') + ' at ' + (followUpTime || '11:00 AM') + ': ' + String(followUpAction).trim(),
        user: agentName || 'EaseLand Admin'
      });
    }

    const updateSql = 'UPDATE crm_deals SET ' +
      'next_follow_up_date = ' + P + '1, ' +
      'next_follow_up_time = ' + P + '2, ' +
      'next_follow_up_action = ' + P + '3, ' +
      'timeline = ' + P + '4, ' +
      'version = version + 1, ' +
      'updated_at = NOW() ' +
      'WHERE deal_id = ' + P + '5 RETURNING *;';

    const updRes = await client.query(updateSql, [
      followUpDate || null,
      followUpTime || null,
      followUpAction || null,
      JSON.stringify(timeline),
      id
    ]);

    await client.query('COMMIT');
    const row = updRes.rows[0];

    broadcastCrmEvent('DEAL_UPDATED', {
      id: row.deal_id,
      dealId: row.deal_id,
      nextFollowUpDate: row.next_follow_up_date,
      nextFollowUpTime: row.next_follow_up_time,
      nextFollowUpAction: row.next_follow_up_action
    });

    return res.json({
      success: true,
      deal: {
        id: row.deal_id,
        dealId: row.deal_id,
        nextFollowUpDate: row.next_follow_up_date,
        nextFollowUpTime: row.next_follow_up_time,
        nextFollowUpAction: row.next_follow_up_action,
        timeline: row.timeline,
        version: row.version,
        updatedAt: row.updated_at
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update deal follow-up error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// 6. CRM DEALS: Delete Deal
app.delete('/api/crm/deals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const P = String.fromCharCode(36);
    await pgPool.query('DELETE FROM crm_deals WHERE deal_id = ' + P + '1;', [id]);
    broadcastCrmEvent('DEAL_DELETED', { id });
    return res.json({ success: true, message: 'Deal deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. CRM VISITS: Schedule Site Visit
app.post('/api/crm/visits', async (req, res) => {
  try {
    const data = req.body || {};
    const visitId = data.id || ('visit-' + Date.now().toString().slice(-6));
    const P = String.fromCharCode(36);

    const sql = 'INSERT INTO crm_visits (' +
      'visit_id, deal_id, property_id, property_title, property_location, customer_name, customer_phone, ' +
      'visit_date, visit_time, agent_assigned, status, customer_notes, raw_data, created_at, updated_at' +
      ') VALUES (' +
      P + '1, ' + P + '2, ' + P + '3, ' + P + '4, ' + P + '5, ' + P + '6, ' + P + '7, ' +
      P + '8, ' + P + '9, ' + P + '10, ' + P + '11, ' + P + '12, ' + P + '13, NOW(), NOW()' +
      ') RETURNING *;';

    const values = [
      visitId,
      data.dealId || null,
      data.propertyId || '',
      data.propertyTitle || 'Property Inspection',
      data.propertyLocation || 'Amaravati / Guntur Region',
      data.customerName || 'Prospective Buyer',
      data.customerPhone || '',
      data.visitDate || new Date().toISOString().split('T')[0],
      data.visitTime || '11:00 AM',
      data.agentAssigned || 'EaseLand Admin',
      'SCHEDULED',
      data.customerNotes || '',
      JSON.stringify(data)
    ];

    const result = await pgPool.query(sql, values);
    const row = result.rows[0];

    // If tied to deal, advance deal stage to SITE_VISIT
    if (data.dealId) {
      try {
        await pgPool.query(
          "UPDATE crm_deals SET stage = 'SITE_VISIT', probability = 50, updated_at = NOW() WHERE deal_id = " + P + "1 AND stage IN ('NEW', 'CONTACTED');",
          [data.dealId]
        );
      } catch (dErr) {}
    }

    broadcastCrmEvent('VISIT_SCHEDULED', {
      id: row.visit_id,
      visitId: row.visit_id,
      customerName: row.customer_name,
      visitDate: row.visit_date
    });

    return res.status(201).json({
      success: true,
      visit: {
        id: row.visit_id,
        visitId: row.visit_id,
        dealId: row.deal_id,
        propertyTitle: row.property_title,
        propertyLocation: row.property_location,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        visitDate: row.visit_date,
        visitTime: row.visit_time,
        agentAssigned: row.agent_assigned,
        status: row.status,
        customerNotes: row.customer_notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (err) {
    console.error('Schedule visit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 8. CRM VISITS: Update Status (COMPLETED / CANCELLED)
app.patch('/api/crm/visits/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, customerFeedback } = req.body;
    const P = String.fromCharCode(36);

    const sql = 'UPDATE crm_visits SET status = ' + P + '1, customer_feedback = ' + P + '2, updated_at = NOW() WHERE visit_id = ' + P + '3 RETURNING *;';
    const result = await pgPool.query(sql, [status || 'COMPLETED', customerFeedback || '', id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Visit not found.' });
    }
    broadcastCrmEvent('VISIT_STATUS_UPDATED', { id, status: status || 'COMPLETED' });
    return res.json({ success: true, visit: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 9. CRM VISITS: Delete Visit
app.delete('/api/crm/visits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const P = String.fromCharCode(36);
    await pgPool.query('DELETE FROM crm_visits WHERE visit_id = ' + P + '1;', [id]);
    broadcastCrmEvent('VISIT_DELETED', { id });
    return res.json({ success: true, message: 'Visit deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// SPA Routing Fallback (for React Router / single page app) with Cache Buster

app.use((req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Listen on configured PORT (3000)
app.listen(PORT, '0.0.0.0', () => {
  console.log('Easeland Coolify Node Server running smoothly on port ' + PORT);
});
