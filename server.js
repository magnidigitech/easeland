import express from 'express';
import multer from 'multer';
import path from 'path';
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

// Configure Multer Memory Storage for PostgreSQL upload
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

// Serve static Vite frontend bundle
app.use(express.static(path.join(__dirname, 'dist')));

// Health check endpoint for Coolify / load balancers (Responds instantly on port 3000 & 80)
app.get('/health', (req, res) => {
  res.status(200).send('healthy');
});

// PostgreSQL Connection Pool Setup
const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL || process.env.VITE_POSTGRES_URL || 'postgres://postgres:g7YivfxcSdNUC9rXFg0y5iSGT00er3NhXqVVc1SI20Y9o4nN7XFTEvAmmTQCT7su@of36x8wuw0wn4j0x2y6c8eso:5432/postgres';

const pgPool = new Pool({
  connectionString: dbUrl,
  ssl: false,
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 30000,
  max: 20
});

// IMPORTANT: Catch idle pool errors so connection drops never crash Node process
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
    console.warn('PostgreSQL connection/init note:', err.message);
  }
}

// Trigger DB init asynchronously so server startup is 100% instant
setImmediate(() => {
  initPgDb();
});

// API Endpoint: Save Uploaded Media / Document File directly into PostgreSQL BYTEA column
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

    const insertQuery = `
      INSERT INTO media_files (
        media_id, property_id, owner_id, file_name, content_type, file_size, media_type, is_document, file_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
    `;

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

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers.host || 'easeland.in';
    const publicUrl = `${protocol}://${host}/api/media/${mediaId}`;
    const relativePath = `/api/media/${mediaId}`;

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
    console.error('PostgreSQL media upload error:', error);
    return res.status(500).json({ success: false, error: error.message || 'PostgreSQL media upload failed' });
  }
});

// API Endpoint: Serve Media / Document binary directly from PostgreSQL
app.get('/api/media/:mediaId', async (req, res) => {
  try {
    const { mediaId } = req.params;
    const result = await pgPool.query(
      'SELECT content_type, file_name, file_data FROM media_files WHERE media_id = $1;',
      [mediaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Media file not found in PostgreSQL');
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

// API Endpoint: Sync/Save property record to PostgreSQL database
app.post('/api/properties', async (req, res) => {
  try {
    const p = req.body;
    if (!p || !p.propertyId) {
      return res.status(400).json({ success: false, error: 'Property payload with propertyId is required.' });
    }

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
      p.propertyId,
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
      JSON.stringify(p)
    ];

    await pgPool.query(queryText, values);
    return res.json({ success: true, message: 'Property synchronized to PostgreSQL database.' });
  } catch (err) {
    console.error('PostgreSQL property save error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint: Get all property records from PostgreSQL database
app.get('/api/properties', async (req, res) => {
  try {
    const result = await pgPool.query('SELECT raw_data FROM properties ORDER BY updated_at DESC LIMIT 100;');
    const properties = result.rows.map(row => row.raw_data);
    return res.json({ success: true, properties });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint: Get single property by ID from PostgreSQL database
app.get('/api/properties/:id', async (req, res) => {
  try {
    const result = await pgPool.query('SELECT raw_data FROM properties WHERE property_id = $1;', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Property not found in PostgreSQL database.' });
    }
    return res.json({ success: true, property: result.rows[0].raw_data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// SPA Routing Fallback (for React Router / single page app)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Listen on configured PORT (default 3000)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Easeland Coolify Node Server listening on port ${PORT}`);
});

// Also listen on Port 80 if main PORT is 3000 to catch Traefik port 80 routing
if (Number(PORT) !== 80) {
  try {
    const server80 = app.listen(80, '0.0.0.0', () => {
      console.log('Easeland Coolify Node Server also listening on port 80');
    });
    server80.on('error', () => {
      // Ignore if port 80 is already bound
    });
  } catch (e) {}
}
