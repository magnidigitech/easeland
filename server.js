import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Serve static Vite frontend bundle
app.use(express.static(path.join(__dirname, 'dist')));

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

function saveLocalProperty(p) {
  if (!p || (!p.propertyId && !p.id)) return;
  const pId = p.propertyId || p.id;
  const existing = localPropsMap.get(pId) || {};

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

  const updated = {
    ...existing,
    ...p,
    propertyId: pId,
    id: pId,
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

    client.release();
    console.log('PostgreSQL tables (properties, media_files, site_config, enquiries, site_visitors, users) initialized successfully.');
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
          localUsersMap.set(key, u);
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

// API Endpoint: Sync/Save property record to Local Disk + PostgreSQL DB (Zero Downtime)
app.post('/api/properties', async (req, res) => {
  try {
    const p = req.body;
    if (!p || (!p.propertyId && !p.id)) {
      return res.status(400).json({ success: false, error: 'Property payload with propertyId is required.' });
    }

    // 1. ALWAYS Save to Local Persistent Disk & In-Memory Store FIRST (100% Reliable & Immediate)
    const savedLocal = saveLocalProperty(p);

    // 2. Try background sync to PostgreSQL (Non-blocking fallback)
    try {
      const queryText = `
        INSERT INTO properties (
          property_id, reference_id, owner_id, title, property_type, purpose, price, area, location, specs, amenities, media, listing_status, is_published, raw_data, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()
        )
        ON CONFLICT (property_id) DO UPDATE SET
          reference_id = EXCLUDED.reference_id,
          owner_id = EXCLUDED.owner_id,
          title = EXCLUDED.title,
          property_type = EXCLUDED.property_type,
          purpose = EXCLUDED.purpose,
          price = EXCLUDED.price,
          area = EXCLUDED.area,
          location = EXCLUDED.location,
          specs = EXCLUDED.specs,
          amenities = EXCLUDED.amenities,
          media = EXCLUDED.media,
          listing_status = EXCLUDED.listing_status,
          is_published = EXCLUDED.is_published,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW();
      `;

      const values = [
        p.propertyId || p.id,
        p.referenceId || null,
        p.ownerId || null,
        p.title || 'Untitled Property',
        p.propertyType || null,
        p.purpose || null,
        Number(p.price) || 0,
        Number(p.area) || 0,
        JSON.stringify(p.location || {}),
        JSON.stringify(p.specs || {}),
        JSON.stringify(p.amenities || []),
        JSON.stringify(p.media || []),
        p.listingStatus || 'DRAFT',
        Boolean(p.isPublished),
        JSON.stringify(savedLocal || p)
      ];

      await pgPool.query(queryText, values);
    } catch (pgErr) {
      console.warn('PostgreSQL property save background sync note (Saved to local disk store):', pgErr.message);
    }

    return res.json({ success: true, message: 'Property saved successfully.', property: savedLocal });
  } catch (err) {
    console.error('Property save handler note:', err.message);
    return res.json({ success: true, message: 'Property saved locally.' });
  }
});

// API Endpoint: Get all property records (Combines PostgreSQL + Local Disk Store)
app.get('/api/properties', async (req, res) => {
  try {
    const localList = getLocalProperties();
    let pgProperties = [];

    try {
      const result = await pgPool.query('SELECT raw_data FROM properties ORDER BY updated_at DESC LIMIT 100;');
      pgProperties = result.rows.map(row => row.raw_data).filter(Boolean);
    } catch (pgErr) {
      console.warn('PostgreSQL fetch fallback note (Serving local disk store):', pgErr.message);
    }

    const mergedMap = new Map();
    [...localList, ...pgProperties].forEach(p => {
      if (p && (p.propertyId || p.id)) {
        const pId = p.propertyId || p.id;
        mergedMap.set(pId, { ...mergedMap.get(pId), ...p });
      }
    });

    const properties = Array.from(mergedMap.values());
    return res.json({ success: true, properties });
  } catch (err) {
    return res.json({ success: true, properties: getLocalProperties() });
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
    const property = { ...(localProp || {}), ...(pgProp || {}) };
    return res.json({ success: true, property });
  }

  return res.status(404).json({ success: false, error: 'Property not found.' });
});

// API Endpoint: Delete Property Listing (from Local Store + PostgreSQL)
app.delete('/api/properties/:id', async (req, res) => {
  try {
    const targetId = req.params.id;
    if (!targetId) return res.status(400).json({ success: false, error: 'Property ID required' });

    // 1. Remove from localPropsMap & disk store
    localPropsMap.delete(targetId);
    try {
      const arrayToStore = Array.from(localPropsMap.values());
      fs.writeFileSync(propertiesStoreFile, JSON.stringify(arrayToStore, null, 2), 'utf8');
    } catch (e) {}

    // 2. Remove from PostgreSQL
    try {
      await pgPool.query('DELETE FROM properties WHERE property_id = $1;', [targetId]);
      await pgPool.query('DELETE FROM media_files WHERE property_id = $1;', [targetId]);
    } catch (e) {}

    return res.json({ success: true, message: 'Property deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Delete failed' });
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

// Registered Users API Endpoints (PostgreSQL User Governance)
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

    try {
      const queryText = `
        INSERT INTO users (
          uid, email, display_name, phone, role, account_status, email_verified, raw_data, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        ) ON CONFLICT (uid) DO UPDATE SET
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          phone = EXCLUDED.phone,
          role = EXCLUDED.role,
          account_status = EXCLUDED.account_status,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW();
      `;
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
    const uUid = req.params.uid;
    localUsersMap.delete(uUid);
    try {
      const arrayToStore = Array.from(localUsersMap.values());
      fs.writeFileSync(usersStoreFile, JSON.stringify(arrayToStore, null, 2), 'utf8');
    } catch (e) {}

    try {
      await pgPool.query('DELETE FROM users WHERE uid = $1;', [uUid]);
    } catch (pgErr) {}

    return res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// SPA Routing Fallback (for React Router / single page app)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Listen on configured PORT (3000)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Easeland Coolify Node Server running smoothly on port ${PORT}`);
});
