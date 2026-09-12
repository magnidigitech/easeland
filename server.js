import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Ensure upload directories exist on VPS disk
const uploadDir = path.join(__dirname, 'uploads');
const propertyMediaDir = path.join(uploadDir, 'properties');
const propertyDocsDir = path.join(uploadDir, 'documents');

fs.mkdirSync(propertyMediaDir, { recursive: true });
fs.mkdirSync(propertyDocsDir, { recursive: true });

// Configure Multer Storage for Hostinger VPS disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const propertyId = req.body.propertyId || 'common';
    const isDoc = req.body.isDocument === 'true' || req.path.includes('document');
    const targetDir = isDoc
      ? path.join(propertyDocsDir, propertyId)
      : path.join(propertyMediaDir, propertyId);

    fs.mkdirSync(targetDir, { recursive: true });
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}_${sanitizedName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB limit for high quality property videos
  }
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded media files publicly under /uploads
app.use('/uploads', express.static(uploadDir, {
  maxAge: '30d',
  immutable: true
}));

// Serve static Vite frontend bundle
app.use(express.static(path.join(__dirname, 'dist')));

// Health check endpoint for Coolify / load balancers
app.get('/health', (req, res) => {
  res.status(200).send('healthy');
});

// API Endpoint: Upload Media / Document File to Hostinger VPS Storage
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file attached.' });
    }

    const propertyId = req.body.propertyId || 'common';
    const isDoc = req.body.isDocument === 'true';
    const relativePath = isDoc
      ? `/uploads/documents/${propertyId}/${req.file.filename}`
      : `/uploads/properties/${propertyId}/${req.file.filename}`;

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers.host || 'easeland.in';
    const publicUrl = `${protocol}://${host}${relativePath}`;

    return res.json({
      success: true,
      publicUrl,
      relativePath,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      contentType: req.file.mimetype
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Storage server error' });
  }
});

// SPA Routing Fallback (for React Router / single page app)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Easeland Coolify Node Server listening on port ${PORT}`);
});
