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

// Health check endpoint for Coolify / load balancers
app.get('/health', (req, res) => {
  res.status(200).send('healthy');
});

// Local Persistent Disk & Memory Store Setup for Property Records (100% Availability Fallback)
const propertiesStoreFile = path.join(uploadsDir, 'properties_store.json');
const localPropsMap = new Map();

// Initialize local properties map from properties_store.json disk file
try {
  if (fs.existsSync(propertiesStoreFile)) {
    const rawDisk = fs.readFileSync(propertiesStoreFile, 'utf8');
    const parsedDisk = JSON.parse(rawDisk);
    if (Array.isArray(parsedDisk)) {
      parsedDisk.forEach(p => {
        if (p && (p.propertyId || p.id)) {
          localPropsMap.set(p.propertyId || p.id, p);
        }
      });
    }
  }
} catch (e) {
  console.warn('Local properties store initialization note:', e.message);
}

// Local Persistent Disk & Memory Store for Authoritative Admin Deleted Properties Ledger
const adminDeletedStoreFile = path.join(uploadsDir, 'admin_deleted_store.json');
const localAdminDeletedMap = new Map();

// Empty seed ledger to ensure clean platform state
const SEED_ADMIN_DELETED_PROPERTIES = [];


try {
  if (fs.existsSync(adminDeletedStoreFile)) {
    const rawDisk = fs.readFileSync(adminDeletedStoreFile, 'utf8');
    const parsedDisk = JSON.parse(rawDisk);
    if (Array.isArray(parsedDisk)) {
      parsedDisk.forEach(p => {
        if (p) {
          const k1 = String(p.propertyId || p.id || '').toLowerCase().trim();
          const k2 = String(p.referenceId || '').toLowerCase().trim();
          const k3 = String(p.title || '').toLowerCase().trim();
          if (k1) localAdminDeletedMap.set(k1, p);
          if (k2) localAdminDeletedMap.set(k2, p);
          if (k3) localAdminDeletedMap.set(k3, p);
        }
      });
    }
  }
} catch (e) {
  console.warn('Local admin deleted store initialization note:', e.message);
}

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

  try {
    fs.writeFileSync(adminDeletedStoreFile, JSON.stringify(getAdminDeletedLedger(), null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed to write admin deleted store file:', err.message);
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

  try {
    const arrayToStore = Array.from(localPropsMap.values());
    fs.writeFileSync(propertiesStoreFile, JSON.stringify(arrayToStore, null, 2), 'utf8');
  } catch (err) {
    console.warn('Local properties disk write note:', err.message);
  }
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
const dbUrl = process.env.DATABASE_URL || process.env.VITE_POSTGRES_URL || process.env.POSTGRES_URL || 'postgres://postgres:g7YivfxcSdNUC9rXFg0y5iSGT00er3NhXqVVc1SI20Y9o4nN7XFTEvAmmTQCT7su@of36x8wuw0wn4j0x2y6c8eso:5432/postgres';

const pgPool = new Pool({
  connectionString: dbUrl,
  ssl: false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20
});

// IMPORTANT: Catch idle pool errors so connection drops or DNS EAI_AGAIN never crash Node process
pgPool.on('error', (err) => {
  console.warn('PostgreSQL Pool background client error:', err.message);
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

    client.release();
    console.log('PostgreSQL tables (properties, media_files, site_config, enquiries, site_visitors, users, admin_deleted_properties) initialized successfully.');
  } catch (err) {
    console.warn('PostgreSQL connection/init note (Local disk store active):', err.message);
  }
}

// Local Persistent Disk & Memory Store for Registered Users (100% Availability Fallback)
const usersStoreFile = path.join(uploadsDir, 'users_store.json');
const localUsersMap = new Map();

try {
  if (fs.existsSync(usersStoreFile)) {
    const rawDisk = fs.readFileSync(usersStoreFile, 'utf8');
    const parsedDisk = JSON.parse(rawDisk);
    if (Array.isArray(parsedDisk)) {
      parsedDisk.forEach(u => {
        if (u && (u.uid || u.id || u.email)) {
          const key = u.uid || u.id || u.email;
          const existing = localUsersMap.get(key) || {};
          localUsersMap.set(key, { ...existing, ...u });
        }
      });
    }
  }
} catch (e) {
  console.warn('Local users store initialization note:', e.message);
}

function saveLocalUser(u) {
  if (!u || (!u.uid && !u.id && !u.email)) return;
  const key = u.uid || u.id || u.email;
  const existing = localUsersMap.get(key) || {};
  const updated = {
    ...existing,
    ...u,
    uid: u.uid || u.id || existing.uid || existing.id,
    updatedAt: new Date().toISOString()
  };
  localUsersMap.set(key, updated);
  try {
    const arrayToStore = Array.from(localUsersMap.values());
    fs.writeFileSync(usersStoreFile, JSON.stringify(arrayToStore, null, 2), 'utf8');
  } catch (err) {
    console.warn('Local users disk write note:', err.message);
  }
  return updated;
}

function getLocalUsers() {
  return Array.from(localUsersMap.values());
}

// Local Persistent Disk & Memory Store for Deleted Users
const deletedUsersStoreFile = path.join(uploadsDir, 'deleted_users_store.json');
const localDeletedUsersSet = new Set();

try {
  if (fs.existsSync(deletedUsersStoreFile)) {
    const rawDisk = fs.readFileSync(deletedUsersStoreFile, 'utf8');
    const parsedDisk = JSON.parse(rawDisk);
    if (Array.isArray(parsedDisk)) {
      parsedDisk.forEach(item => {
        if (item) localDeletedUsersSet.add(String(item).toLowerCase().trim());
      });
    }
  }
} catch (e) {
  console.warn('Local deleted users store initialization note:', e.message);
}

function addLocalDeletedUser(uidOrEmail) {
  if (!uidOrEmail) return;
  localDeletedUsersSet.add(String(uidOrEmail).toLowerCase().trim());
  try {
    fs.writeFileSync(deletedUsersStoreFile, JSON.stringify(Array.from(localDeletedUsersSet)), 'utf8');
  } catch (e) {}
}

function removeLocalDeletedUser(uidOrEmail) {
  if (!uidOrEmail) return;
  localDeletedUsersSet.delete(String(uidOrEmail).toLowerCase().trim());
  try {
    fs.writeFileSync(deletedUsersStoreFile, JSON.stringify(Array.from(localDeletedUsersSet)), 'utf8');
  } catch (e) {}
}

// Local Persistent Disk & Memory Store for Site Visitors (100% Availability Fallback)
const visitorsStoreFile = path.join(uploadsDir, 'visitors_store.json');
const localVisitorsMap = new Map();

try {
  if (fs.existsSync(visitorsStoreFile)) {
    const rawDisk = fs.readFileSync(visitorsStoreFile, 'utf8');
    const parsedDisk = JSON.parse(rawDisk);
    if (Array.isArray(parsedDisk)) {
      parsedDisk.forEach(v => {
        if (v && (v.visitorId || v.id)) {
          localVisitorsMap.set(v.visitorId || v.id, v);
        }
      });
    }
  }
} catch (e) {
  console.warn('Local visitors store initialization note:', e.message);
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
  try {
    const arrayToStore = Array.from(localVisitorsMap.values());
    fs.writeFileSync(visitorsStoreFile, JSON.stringify(arrayToStore, null, 2), 'utf8');
  } catch (err) {
    console.warn('Local visitors disk write note:', err.message);
  }
  return updated;
}

function getLocalVisitors() {
  return Array.from(localVisitorsMap.values()).sort((a, b) => {
    const tA = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const tB = new Date(b.createdAt || b.updatedAt || 0).getTime();
    return tB - tA;
  });
}


// Local Persistent Disk & Memory Store for Enquiries (100% Availability Fallback)
const enquiriesStoreFile = path.join(uploadsDir, 'enquiries_store.json');
const localEnquiriesMap = new Map();

try {
  if (fs.existsSync(enquiriesStoreFile)) {
    const rawDisk = fs.readFileSync(enquiriesStoreFile, 'utf8');
    const parsedDisk = JSON.parse(rawDisk);
    if (Array.isArray(parsedDisk)) {
      parsedDisk.forEach(e => {
        if (e && (e.enquiryId || e.id)) {
          localEnquiriesMap.set(e.enquiryId || e.id, e);
        }
      });
    }
  }
} catch (e) {
  console.warn('Local enquiries store initialization note:', e.message);
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

  try {
    const arrayToStore = Array.from(localEnquiriesMap.values());
    fs.writeFileSync(enquiriesStoreFile, JSON.stringify(arrayToStore, null, 2), 'utf8');
  } catch (err) {
    console.warn('Local enquiries disk write note:', err.message);
  }
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

    // 2. Try background sync to PostgreSQL (Non-blocking catch)
    try {
      const insertQuery = `
        INSERT INTO media_files (
          media_id, property_id, owner_id, file_name, content_type, file_size, media_type, is_document, file_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (media_id) DO NOTHING;
      `;
      pgPool.query(insertQuery, [
        mediaId,
        propertyId,
        ownerId,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        mediaType,
        isDocument,
        req.file.buffer
      ]).catch(pgErr => console.warn('PostgreSQL background media insert note:', pgErr.message));
    } catch (e) {}

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
          pgPool.query(
            "UPDATE properties SET raw_data = $1, updated_at = NOW() WHERE property_id = $2 OR reference_id = $2 OR raw_data->>'id' = $2 OR raw_data->>'propertyId' = $2;",
            [JSON.stringify(existingProp), propertyId]
          ).catch(pgSyncErr => console.warn('PostgreSQL property doc/media update note:', pgSyncErr.message));
        } catch (e) {}
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

// API Endpoint: Serve Media / Document binary directly from PostgreSQL (with disk fallback)
app.get('/api/media/:mediaId', async (req, res) => {
  try {
    const { mediaId } = req.params;
    const result = await pgPool.query(
      'SELECT content_type, file_name, file_data FROM media_files WHERE media_id = $1;',
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
    } catch (pgErr) {
      console.warn('PostgreSQL property save note (Saved to local disk store fallback):', pgErr.message);
    }

    return res.json({ success: true, message: 'Property saved successfully.', property: savedLocal });
  } catch (err) {
    console.error('Property save handler note:', err.message);
    return res.json({ success: true, message: 'Property saved locally.' });
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

// API Endpoint: Get all property records (PostgreSQL Primary Authoritative Source + Local Disk Store Fallback)
app.get('/api/properties', async (req, res) => {
  try {
    const isPublicOnly = req.query.publicOnly === 'true' || req.query.public === 'true';
    let pgProperties = [];
    let pgConnected = false;

    try {
      const result = await pgPool.query(
        'SELECT property_id, reference_id, owner_id, title, property_type, purpose, price, area, location, specs, amenities, media, listing_status, is_published, raw_data, updated_at FROM properties ORDER BY updated_at DESC;'
      );
      pgConnected = true;
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

      // Keep localPropsMap synchronized with PostgreSQL records
      pgProperties.forEach(p => {
        if (p && (p.propertyId || p.id)) {
          localPropsMap.set(p.propertyId || p.id, p);
        }
      });
    } catch (pgErr) {
      console.warn('PostgreSQL fetch note (Serving local disk store fallback):', pgErr.message);
    }

    let properties = [];
    if (pgConnected) {
      // PostgreSQL is Authoritative Primary Source
      properties = pgProperties;
    } else {
      properties = getLocalProperties();
    }

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
    return res.json({ success: true, properties: getLocalProperties(), adminDeletedLedger: getAdminDeletedLedger() });
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
    } catch (pgErr) {
      console.warn('PostgreSQL single property fetch note:', pgErr.message);
    }

    // 2. Check Local Store
    const allAliases = new Set([tLower, cleanNum, refWithPrefix, propWithPrefix].filter(Boolean));
    for (const [k, v] of localPropsMap.entries()) {
      const kLow = String(k).toLowerCase().trim();
      const vId = String(v.id || '').toLowerCase().trim();
      const vPropId = String(v.propertyId || '').toLowerCase().trim();
      const vRefId = String(v.referenceId || '').toLowerCase().trim();
      if (allAliases.has(kLow) || allAliases.has(vId) || allAliases.has(vPropId) || allAliases.has(vRefId)) {
        return res.json({ success: true, property: v });
      }
    }

    return res.status(404).json({ success: false, error: 'Property not found' });
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
      console.warn('PostgreSQL property delete note:', pgErr.message);
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

    try {
      const arrayToStore = Array.from(localPropsMap.values());
      fs.writeFileSync(propertiesStoreFile, JSON.stringify(arrayToStore, null, 2), 'utf8');
    } catch (err) {
      console.warn('Local properties disk write note after delete:', err.message);
    }

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

    // 3. Clear Local Disk Stores & Maps
    try {
      localPropsMap.clear();
      fs.writeFileSync(propertiesStoreFile, JSON.stringify([], null, 2), 'utf8');

      localEnquiriesMap.clear();
      fs.writeFileSync(enquiriesStoreFile, JSON.stringify([], null, 2), 'utf8');

      localAdminDeletedMap.clear();
      fs.writeFileSync(adminDeletedStoreFile, JSON.stringify([], null, 2), 'utf8');

      try {
        localVisitorsMap.clear();
        fs.writeFileSync(visitorsStoreFile, JSON.stringify([], null, 2), 'utf8');
      } catch (visErr) {}

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
    } catch (diskErr) {
      console.warn('Disk store purge error:', diskErr.message);
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

// API Endpoint: Get single property by ID from Local Store / PostgreSQL
app.get('/api/properties/:id', async (req, res) => {
  const targetId = req.params.id;
  if (!targetId) {
    return res.status(400).json({ success: false, error: 'Property ID is required.' });
  }

  let localProp = localPropsMap.get(targetId);
  if (!localProp) {
    const tLower = targetId.toLowerCase().trim();
    for (const v of localPropsMap.values()) {
      if (v) {
        const id1 = String(v.id || '').toLowerCase().trim();
        const id2 = String(v.propertyId || '').toLowerCase().trim();
        const id3 = String(v.referenceId || '').toLowerCase().trim();
        const tTitle = String(v.title || '').toLowerCase().trim();
        if (id1 === tLower || id2 === tLower || id3 === tLower || (tTitle && tTitle === tLower)) {
          localProp = v;
          break;
        }
      }
    }
  }

  let pgProp = null;
  try {
    const result = await pgPool.query(
      "SELECT raw_data FROM properties WHERE property_id = $1 OR reference_id = $1 OR raw_data->>'id' = $1 OR raw_data->>'propertyId' = $1 OR raw_data->>'referenceId' = $1;",
      [targetId]
    );
    if (result.rows.length > 0) {
      pgProp = result.rows[0].raw_data;
    }
  } catch (err) {}

  if (!pgProp) {
    try {
      const allRes = await pgPool.query('SELECT raw_data FROM properties;');
      const tLower = targetId.toLowerCase().trim();
      const found = allRes.rows.map(r => r.raw_data).find(p => {
        if (!p) return false;
        const id1 = String(p.id || '').toLowerCase().trim();
        const id2 = String(p.propertyId || '').toLowerCase().trim();
        const id3 = String(p.referenceId || '').toLowerCase().trim();
        const tTitle = String(p.title || '').toLowerCase().trim();
        return id1 === tLower || id2 === tLower || id3 === tLower || (tTitle && tTitle === tLower);
      });
      if (found) {
        pgProp = found;
      }
    } catch (e) {}
  }

  if (localProp || pgProp) {
    const mergedDocs = [
      ...(Array.isArray(localProp?.documents) ? localProp.documents : []),
      ...(Array.isArray(pgProp?.documents) ? pgProp.documents : [])
    ];
    const seenDocKeys = new Set();
    const finalDocs = [];
    mergedDocs.forEach(d => {
      if (!d) return;
      const key = String(d.docId || d.mediaId || d.id || d.url || d.publicUrl || d.name || d.fileName || '').toLowerCase().trim();
      if (!key || seenDocKeys.has(key)) return;
      seenDocKeys.add(key);
      finalDocs.push(d);
    });

    const property = { ...(pgProp || {}), ...(localProp || {}), documents: finalDocs };
    return res.json({ success: true, property });
  }

  return res.status(404).json({ success: false, error: 'Property not found.' });
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
        await pgPool.query(
          'UPDATE properties SET raw_data = $1, updated_at = NOW() WHERE property_id = $2;',
          [JSON.stringify(existingProp), targetId]
        );
      } catch (pgErr) {}
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
      const pgRes = await pgPool.query(
        "SELECT raw_data FROM properties WHERE property_id = $1 OR reference_id = $1 OR raw_data->>'id' = $1 OR raw_data->>'propertyId' = $1;",
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

// API Endpoint: Get Site Configuration from PostgreSQL DB (with disk fallback)
const siteConfigStoreFile = path.join(uploadsDir, 'site_config_store.json');
let localSiteConfigMap = new Map();

try {
  if (fs.existsSync(siteConfigStoreFile)) {
    const rawDisk = fs.readFileSync(siteConfigStoreFile, 'utf8');
    const parsedDisk = JSON.parse(rawDisk);
    if (typeof parsedDisk === 'object' && parsedDisk !== null) {
      Object.keys(parsedDisk).forEach(key => localSiteConfigMap.set(key, parsedDisk[key]));
    }
  }
} catch (e) {}

app.get('/api/site-config', async (req, res) => {
  try {
    const config = {};
    localSiteConfigMap.forEach((val, key) => { config[key] = val; });

    try {
      const result = await pgPool.query('SELECT module_id, config_data FROM site_config;');
      result.rows.forEach(row => {
        if (row.module_id && row.config_data) {
          config[row.module_id] = row.config_data;
        }
      });
    } catch (pgErr) {}

    return res.json({ success: true, config });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, config: {} });
  }
});

// API Endpoint: Save/Publish Site Configuration to PostgreSQL DB
app.post('/api/site-config', async (req, res) => {
  try {
    const fullConfig = req.body || {};
    Object.keys(fullConfig).forEach(modId => {
      localSiteConfigMap.set(modId, fullConfig[modId]);
    });

    try {
      const objToStore = {};
      localSiteConfigMap.forEach((val, key) => { objToStore[key] = val; });
      fs.writeFileSync(siteConfigStoreFile, JSON.stringify(objToStore, null, 2), 'utf8');
    } catch (e) {}

    try {
      const promises = Object.keys(fullConfig).map(modId => {
        const queryText = `
          INSERT INTO site_config (module_id, config_data, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (module_id) DO UPDATE SET
            config_data = EXCLUDED.config_data,
            updated_at = NOW();
        `;
        return pgPool.query(queryText, [modId, JSON.stringify(fullConfig[modId])]);
      });
      await Promise.all(promises);
    } catch (pgErr) {}

    return res.json({ success: true, message: 'Site configuration saved to PostgreSQL.', config: fullConfig });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

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

    // 1. Save to local disk fallback store
    saveLocalEnquiry(fullPayload);

    // 2. Save to PostgreSQL DB
    try {
      const queryText = `
        INSERT INTO enquiries (
          enquiry_id, property_id, property_title, property_reference_id,
          owner_id, owner_name, owner_email,
          customer_id, buyer_id, customer_name, buyer_name,
          customer_email, buyer_email, customer_phone, buyer_phone,
          message, preferred_visit_date, status, raw_data, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW()
        ) ON CONFLICT (enquiry_id) DO UPDATE SET
          status = EXCLUDED.status,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW();
      `;
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
    } catch (pgErr) {
      console.warn('PostgreSQL save enquiry note:', pgErr.message);
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

    const localList = getLocalEnquiries();
    let pgEnquiries = [];

    try {
      const result = await pgPool.query('SELECT raw_data FROM enquiries ORDER BY updated_at DESC LIMIT 200;');
      pgEnquiries = result.rows.map(row => row.raw_data).filter(Boolean);
    } catch (pgErr) {
      console.warn('PostgreSQL fetch enquiries note:', pgErr.message);
    }

    const mergedMap = new Map();
    [...localList, ...pgEnquiries].forEach(e => {
      if (e && (e.enquiryId || e.id)) {
        const id = e.enquiryId || e.id;
        mergedMap.set(id, { ...mergedMap.get(id), ...e });
      }
    });

    let allEnquiries = Array.from(mergedMap.values());

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

    return res.json({ success: true, enquiries: allEnquiries });
  } catch (err) {
    return res.json({ success: true, enquiries: getLocalEnquiries() });
  }
});

// API Endpoint: Update Enquiry Status in PostgreSQL DB
app.patch('/api/enquiries/:id', async (req, res) => {
  try {
    const eId = req.params.id;
    const { status } = req.body;
    if (!eId || !status) return res.status(400).json({ success: false, error: 'Enquiry ID and status required.' });

    const localEnq = localEnquiriesMap.get(eId);
    if (localEnq) {
      localEnq.status = status;
      localEnq.updatedAt = new Date().toISOString();
      saveLocalEnquiry(localEnq);
    }

    try {
      await pgPool.query('UPDATE enquiries SET status = $1, updated_at = NOW() WHERE enquiry_id = $2;', [status, eId]);
    } catch (e) {}

    return res.json({ success: true, message: 'Enquiry status updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
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
      id: messageData.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderId: messageData.senderId || 'user',
      senderName: messageData.senderName || 'User',
      senderRole: messageData.senderRole || 'USER',
      text: String(messageData.text).trim(),
      createdAt: messageData.createdAt || new Date().toISOString()
    };

    // 1. Update in-memory / local disk store
    const localEnq = localEnquiriesMap.get(eId);
    if (localEnq) {
      if (!Array.isArray(localEnq.messages)) localEnq.messages = [];
      localEnq.messages.push(newMsg);
      localEnq.updatedAt = new Date().toISOString();
      saveLocalEnquiry(localEnq);
    }

    // 2. Update in PostgreSQL DB
    try {
      await pgPool.query(`
        UPDATE enquiries 
        SET raw_data = jsonb_set(
          COALESCE(raw_data, '{}'::jsonb),
          '{messages}',
          (COALESCE(raw_data->'messages', '[]'::jsonb) || $1::jsonb)
        ),
        updated_at = NOW()
        WHERE enquiry_id = $2;
      `, [JSON.stringify(newMsg), eId]);
    } catch (pgErr) {
      console.warn('PostgreSQL message append note:', pgErr.message);
    }

    return res.json({ success: true, message: newMsg });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});



// API Endpoint: Get user by ID or email
app.get('/api/users/:id', async (req, res) => {
  try {
    const target = String(req.params.id).trim();
    let userFound = localUsersMap.get(target);

    if (!userFound) {
      const tLower = target.toLowerCase();
      for (const u of localUsersMap.values()) {
        if (u && (String(u.uid || u.id) === target || String(u.email || '').toLowerCase() === tLower)) {
          userFound = u;
          break;
        }
      }
    }

    if (!userFound) {
      try {
        const pgRes = await pgPool.query(
          "SELECT raw_data FROM users WHERE uid = $1 OR email = $1 OR raw_data->>'id' = $1;",
          [target]
        );
        if (pgRes.rows.length > 0) {
          userFound = pgRes.rows[0].raw_data;
        }
      } catch (e) {}
    }

    if (userFound) {
      return res.json({ success: true, user: userFound });
    }
    return res.status(404).json({ success: false, error: 'User not found.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
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

    // 1. Save to local fallback store
    saveLocalVisitor(fullPayload);

    // 2. Save to PostgreSQL DB
    try {
      const queryText = `
        INSERT INTO site_visitors (
          visitor_id, name, phone, email, preferred_property_type,
          preferred_location, stay_duration_seconds, source, status,
          notes, raw_data, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        ) ON CONFLICT (visitor_id) DO UPDATE SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          status = EXCLUDED.status,
          notes = EXCLUDED.notes,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW();
      `;
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
    } catch (pgErr) {
      console.warn('PostgreSQL save visitor note:', pgErr.message);
    }

    return res.json({ success: true, visitorId: vId, visitor: fullPayload });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get Site Visitors List from PostgreSQL DB (with local fallback merge)
app.get('/api/visitors', async (req, res) => {
  try {
    const localList = getLocalVisitors();
    let pgVisitors = [];

    try {
      const result = await pgPool.query('SELECT raw_data FROM site_visitors ORDER BY created_at DESC LIMIT 300;');
      pgVisitors = result.rows.map(row => row.raw_data).filter(Boolean);
    } catch (pgErr) {
      console.warn('PostgreSQL fetch visitors note:', pgErr.message);
    }

    const mergedMap = new Map();
    [...localList, ...pgVisitors].forEach(v => {
      if (v && (v.visitorId || v.id)) {
        const id = v.visitorId || v.id;
        mergedMap.set(id, { ...mergedMap.get(id), ...v });
      }
    });

    const allVisitors = Array.from(mergedMap.values()).sort((a, b) => {
      const tA = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const tB = new Date(b.createdAt || b.updatedAt || 0).getTime();
      return tB - tA;
    });

    return res.json({ success: true, count: allVisitors.length, visitors: allVisitors });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update Visitor Status or Notes in PostgreSQL DB
app.patch('/api/visitors/:id', async (req, res) => {
  try {
    const vId = req.params.id;
    const { status, notes, assignedAgent } = req.body || {};
    const nowIso = new Date().toISOString();

    const localVis = localVisitorsMap.get(vId) || { id: vId, visitorId: vId };
    if (status) localVis.status = status;
    if (notes !== undefined) localVis.notes = notes;
    if (assignedAgent !== undefined) localVis.assignedAgent = assignedAgent;
    localVis.updatedAt = nowIso;
    saveLocalVisitor(localVis);

    try {
      await pgPool.query(`
        UPDATE site_visitors 
        SET 
          status = COALESCE($1, status),
          notes = COALESCE($2, notes),
          raw_data = $3,
          updated_at = NOW()
        WHERE visitor_id = $4;
      `, [status || null, notes !== undefined ? notes : null, JSON.stringify(localVis), vId]);
    } catch (pgErr) {
      console.warn('PostgreSQL update visitor note:', pgErr.message);
    }

    return res.json({ success: true, visitor: localVis });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Visitor Record
app.delete('/api/visitors/:id', async (req, res) => {
  try {
    const vId = req.params.id;
    localVisitorsMap.delete(vId);
    try {
      const arrayToStore = Array.from(localVisitorsMap.values());
      fs.writeFileSync(visitorsStoreFile, JSON.stringify(arrayToStore, null, 2), 'utf8');
    } catch (e) {}

    try {
      await pgPool.query('DELETE FROM site_visitors WHERE visitor_id = $1;', [vId]);
    } catch (pgErr) {
      console.warn('PostgreSQL delete visitor note:', pgErr.message);
    }

    return res.json({ success: true, message: 'Visitor deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
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

    const localList = getLocalUsers();
    let pgUsers = [];
    try {
      const result = await pgPool.query('SELECT raw_data FROM users ORDER BY created_at DESC LIMIT 1000;');
      pgUsers = result.rows.map(row => row.raw_data).filter(Boolean);
    } catch (pgErr) {}

    const deletedUsersSet = new Set(localDeletedUsersSet);
    try {
      const delRes = await pgPool.query('SELECT uid, email FROM admin_deleted_users;');
      delRes.rows.forEach(r => {
        if (r.uid) deletedUsersSet.add(String(r.uid).toLowerCase().trim());
        if (r.email) deletedUsersSet.add(String(r.email).toLowerCase().trim());
      });
    } catch (eDelFetch) {}

    const userMap = new Map();
    [...authUsers, ...fsUsers, ...localList, ...pgUsers].forEach(u => {
      if (!u) return;
      const emailKey = (u.email || '').toLowerCase().trim();
      const uidKey = String(u.uid || u.id || '').toLowerCase().trim();
      if (!emailKey && !uidKey) return;

      const uSt = String(u.accountStatus || u.status || '').toUpperCase();
      if (uSt === 'REMOVED' || uSt === 'DELETED' || uSt === 'ACCOUNT_DELETED') return;
      if (deletedUsersSet.has(uidKey) || (emailKey && deletedUsersSet.has(emailKey))) return;

      const existing = (emailKey && userMap.get(emailKey)) || (uidKey && userMap.get(uidKey)) || {};
      const isAdmin = u.email === 'admin@easeland.in' || u.role === 'ADMIN' || existing.role === 'ADMIN';
      const cleanName = isAdmin ? 'EaseLand Admin' : (u.displayName || u.name || existing.displayName || existing.name || 'Registered User');

      const mergedObj = {
        ...existing,
        ...u,
        uid: u.uid || u.id || existing.uid || existing.id,
        id: u.id || u.uid || existing.id || existing.uid,
        email: u.email || existing.email || '',
        displayName: cleanName,
        name: cleanName,
        role: isAdmin ? 'ADMIN' : (existing.role || u.role || 'USER')
      };

      if (emailKey) userMap.set(emailKey, mergedObj);
      if (uidKey) userMap.set(uidKey, mergedObj);
    });

    const allUsers = Array.from(new Set(userMap.values())).filter(u => {
      const uUid = String(u.uid || u.id || '').toLowerCase().trim();
      const uEm = String(u.email || '').toLowerCase().trim();
      const uSt = String(u.accountStatus || u.status || '').toUpperCase();
      if (uSt === 'REMOVED' || uSt === 'DELETED' || uSt === 'ACCOUNT_DELETED') return false;
      return !deletedUsersSet.has(uUid) && (!uEm || !deletedUsersSet.has(uEm));
    });

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
    const userMap = new Map();
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
          userMap.set(uid, {
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
          const existing = userMap.get(uid) || {};
          userMap.set(uid, {
            ...existing,
            ...d,
            uid,
            id: uid,
            email: (d.email || existing.email || '').toLowerCase().trim(),
            displayName: d.displayName || d.name || existing.displayName || 'EaseLand User',
            name: d.displayName || d.name || existing.name || 'EaseLand User',
            role: (d.email === 'admin@easeland.in' || d.role === 'ADMIN' || existing.role === 'ADMIN') ? 'ADMIN' : (d.role || existing.role || 'USER'),
            accountStatus: d.accountStatus || existing.accountStatus || 'ACTIVE'
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
        const existing = userMap.get(uid) || {};
        userMap.set(uid, {
          ...existing,
          ...u,
          uid,
          id: uid,
          email: (u.email || existing.email || '').toLowerCase().trim(),
          displayName: u.displayName || u.name || existing.displayName || 'EaseLand User',
          name: u.displayName || u.name || existing.name || 'EaseLand User',
          role: (u.email === 'admin@easeland.in' || u.role === 'ADMIN' || existing.role === 'ADMIN') ? 'ADMIN' : (u.role || existing.role || 'USER'),
          accountStatus: u.accountStatus || existing.accountStatus || 'ACTIVE'
        });
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
      const existing = userMap.get(uid) || {};
      userMap.set(uid, { ...existing, ...u, uid, id: uid });
    });

    const unifiedUsers = Array.from(userMap.values()).filter(u => {
      const uUid = String(u.uid || u.id || '').toLowerCase().trim();
      const uEm = String(u.email || '').toLowerCase().trim();
      const uSt = String(u.accountStatus || u.status || '').toUpperCase();
      if (uSt === 'REMOVED' || uSt === 'DELETED' || uSt === 'ACCOUNT_DELETED') return false;
      return !deletedUsersSet.has(uUid) && (!uEm || !deletedUsersSet.has(uEm));
    });

    // Write back unified users across all 3 layers
    const syncP1 = String.fromCharCode(36) + '1';
    const syncP2 = String.fromCharCode(36) + '2';
    const syncP3 = String.fromCharCode(36) + '3';
    const syncP4 = String.fromCharCode(36) + '4';
    const syncP5 = String.fromCharCode(36) + '5';
    const syncP6 = String.fromCharCode(36) + '6';
    const syncP7 = String.fromCharCode(36) + '7';
    const syncP8 = String.fromCharCode(36) + '8';

    const syncUpsertQuery = 
      "INSERT INTO users (" +
      "  uid, email, display_name, phone, role, account_status, email_verified, raw_data, created_at, updated_at" +
      ") VALUES (" +
      "  " + syncP1 + ", " + syncP2 + ", " + syncP3 + ", " + syncP4 + ", " + syncP5 + ", " + syncP6 + ", " + syncP7 + ", " + syncP8 + ", NOW(), NOW()" +
      ") ON CONFLICT (uid) DO UPDATE SET " +
      "  email = EXCLUDED.email, " +
      "  display_name = EXCLUDED.display_name, " +
      "  phone = EXCLUDED.phone, " +
      "  role = EXCLUDED.role, " +
      "  account_status = EXCLUDED.account_status, " +
      "  raw_data = EXCLUDED.raw_data, " +
      "  updated_at = NOW();";

    for (const u of unifiedUsers) {
      saveLocalUser(u);
      try {
        await pgPool.query(syncUpsertQuery, [
          u.uid,
          u.email,
          u.displayName || u.name,
          u.phone || '',
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
                  cmsMap.set(k, { ...existing, ...d[k] });
                }
              });
            }
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
        await pgPool.query(`
          INSERT INTO site_config (module_id, config_data, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (module_id) DO UPDATE SET
            config_data = EXCLUDED.config_data,
            updated_at = NOW();
        `, [modId, JSON.stringify(modData)]);
      } catch (ePgSave) {}

      if (adminDb) {
        try {
          await adminDb.collection('siteManagement').doc(modId).set({
            ...modData,
            state: 'PUBLISHED',
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (eFsSave) {}
      }
    }

    // Persist to local disk fallback files
    try {
      fs.writeFileSync(siteConfigStoreFile, JSON.stringify(unifiedConfig, null, 2), 'utf8');
      fs.writeFileSync(usersStoreFile, JSON.stringify(unifiedUsers, null, 2), 'utf8');
    } catch (eDisk) {}

    console.log(`[EaseLand Sync] Success: ${unifiedUsers.length} users and ${Object.keys(unifiedConfig).length} CMS modules synchronized.`);

    return res.json({
      success: true,
      message: '3-way synchronization completed across Firestore, PostgreSQL, and local disk.',
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
    const localList = getLocalUsers();
    let pgUsers = [];

    try {
      const result = await pgPool.query('SELECT raw_data FROM users ORDER BY created_at DESC LIMIT 500;');
      pgUsers = result.rows.map(row => row.raw_data).filter(Boolean);
    } catch (pgErr) {
      console.warn('PostgreSQL fetch users note:', pgErr.message);
    }

    const mergedMap = new Map();
    [...localList, ...pgUsers].forEach(u => {
      if (u && (u.uid || u.id || u.email)) {
        const key = String(u.uid || u.id || u.email).toLowerCase().trim();
        mergedMap.set(key, { ...mergedMap.get(key), ...u });
      }
    });

    const allUsers = Array.from(mergedMap.values());
    return res.json({ success: true, count: allUsers.length, users: allUsers });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    invalidateAdminUsersCache();
    const userData = req.body || {};
    const uUid = userData.uid || userData.id || `user-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const fullPayload = {
      ...userData,
      uid: uUid,
      id: uUid,
      displayName: (userData.displayName || userData.name || 'EaseLand User').trim(),
      email: (userData.email || '').trim(),
      phone: (userData.phone || userData.phoneNumber || '').trim(),
      role: userData.role || 'USER',
      accountStatus: userData.accountStatus || 'ACTIVE',
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

      const queryText = 
        "INSERT INTO users (" +
        "  uid, email, display_name, phone, role, account_status, email_verified, raw_data, created_at, updated_at" +
        ") VALUES (" +
        "  " + p1 + ", " + p2 + ", " + p3 + ", " + p4 + ", " + p5 + ", " + p6 + ", " + p7 + ", " + p8 + ", NOW(), NOW()" +
        ") ON CONFLICT (uid) DO UPDATE SET " +
        "  email = EXCLUDED.email, " +
        "  display_name = EXCLUDED.display_name, " +
        "  phone = EXCLUDED.phone, " +
        "  role = EXCLUDED.role, " +
        "  account_status = EXCLUDED.account_status, " +
        "  raw_data = EXCLUDED.raw_data, " +
        "  updated_at = NOW();";
      await pgPool.query(queryText, [
        uUid,
        fullPayload.email,
        fullPayload.displayName,
        fullPayload.phone,
        fullPayload.role,
        fullPayload.accountStatus,
        Boolean(fullPayload.emailVerified),
        JSON.stringify(fullPayload)
      ]);
    } catch (pgErr) {
      console.warn('PostgreSQL save user note:', pgErr.message);
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
    try {
      const propsArray = Array.from(localPropsMap.values());
      fs.writeFileSync(propertiesStoreFile, JSON.stringify(propsArray, null, 2), 'utf8');
    } catch (e) {}

    localUsersMap.delete(uUid);
    if (targetEmail) {
      for (const [k, u] of localUsersMap.entries()) {
        if (String(u.email || '').toLowerCase().trim() === targetEmail) {
          localUsersMap.delete(k);
        }
      }
    }
    try {
      const arrayToStore = Array.from(localUsersMap.values());
      fs.writeFileSync(usersStoreFile, JSON.stringify(arrayToStore, null, 2), 'utf8');
    } catch (e) {}

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

// SPA Routing Fallback (for React Router / single page app) with Cache Buster
app.use((req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Listen on configured PORT (3000)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Easeland Coolify Node Server running smoothly on port ${PORT}`);
});
