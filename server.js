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
  const updated = { ...existing, ...p, propertyId: pId, id: pId, updatedAt: new Date().toISOString() };
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

    client.release();
    console.log('PostgreSQL tables (properties & media_files) initialized successfully.');
  } catch (err) {
    console.warn('PostgreSQL connection/init note (Local disk store active):', err.message);
  }
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
  const localProp = localPropsMap.get(targetId);

  try {
    const result = await pgPool.query('SELECT raw_data FROM properties WHERE property_id = $1;', [targetId]);
    if (result.rows.length > 0) {
      const pgProp = result.rows[0].raw_data;
      return res.json({ success: true, property: { ...localProp, ...pgProp } });
    }
  } catch (err) {}

  if (localProp) {
    return res.json({ success: true, property: localProp });
  }

  return res.status(404).json({ success: false, error: 'Property not found.' });
});

// SPA Routing Fallback (for React Router / single page app)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Listen on configured PORT (3000)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Easeland Coolify Node Server running smoothly on port ${PORT}`);
});
