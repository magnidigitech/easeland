/**
 * EaseLand Standalone Properties & Associated Collections 3-Way Purge Script
 *
 * Usage:
 *   node scripts/purgeAllProperties.js --confirm
 *
 * Safety Invariants:
 * 1. Requires explicit --confirm flag.
 * 2. Never deletes user accounts or credentials.
 * 3. Never deletes site CMS configuration.
 * 4. Bypasses client security rules via Firebase Admin SDK with Service Account Key.
 * 5. Wipes PostgreSQL properties, media_files, enquiries, admin_deleted_properties.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper: Load .env variables into process.env if present
try {
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    envLines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
} catch (envErr) {
  console.warn('Could not parse .env file:', envErr.message);
}

const args = process.argv.slice(2);
const isConfirmed = args.includes('--confirm');

if (!isConfirmed) {
  console.log('SAFETY CHECK: This script will authoritatively wipe ALL test properties across PostgreSQL, Cloud Firestore, and Local Storage.');
  console.log('User accounts and site configurations will be preserved.');
  console.log('');
  console.log('To execute the purge, run:');
  console.log('  node scripts/purgeAllProperties.js --confirm');
  process.exit(1);
}

// Locate Firebase Service Account Credentials
function getServiceAccountCredentials() {
  const candidatePaths = [
    path.join(rootDir, 'serviceAccountKey.json'),
    path.join(rootDir, 'firebase-service-account.json'),
    path.join(__dirname, 'serviceAccountKey.json')
  ];

  for (const cPath of candidatePaths) {
    if (fs.existsSync(cPath)) {
      try {
        const content = fs.readFileSync(cPath, 'utf8');
        const parsed = JSON.parse(content);
        if (parsed.project_id && parsed.private_key) {
          console.log('Found Service Account Key at: ' + cPath);
          return parsed;
        }
      } catch (err) {
        console.warn('Found key at ' + cPath + ' but could not parse:', err.message);
      }
    }
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      if (raw.startsWith('{')) {
        return JSON.parse(raw);
      }
      if (fs.existsSync(raw)) {
        return JSON.parse(fs.readFileSync(raw, 'utf8'));
      }
    } catch (e) {
      console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT_KEY env var:', e.message);
    }
  }

  return null;
}

async function runPurge() {
  console.log('=== Starting EaseLand Authoritative 3-Way Purge ===');
  const results = {
    postgres: {},
    firestore: {},
    localStorageFiles: []
  };

  // 1. PostgreSQL Purge
  const pgUrl = process.env.VITE_POSTGRES_URL || process.env.DATABASE_URL;
  if (pgUrl) {
    console.log('Connecting to PostgreSQL database...');
    const pool = new pg.Pool({
      connectionString: pgUrl,
      ssl: pgUrl.includes('localhost') || pgUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
    });
    try {
      const mRes = await pool.query('DELETE FROM media_files;');
      results.postgres.media_files = mRes.rowCount || 0;

      const pRes = await pool.query('DELETE FROM properties;');
      results.postgres.properties = pRes.rowCount || 0;

      const eRes = await pool.query('DELETE FROM enquiries;');
      results.postgres.enquiries = eRes.rowCount || 0;

      const adRes = await pool.query('DELETE FROM admin_deleted_properties;');
      results.postgres.admin_deleted_properties = adRes.rowCount || 0;

      console.log('PostgreSQL purged successfully:', results.postgres);
    } catch (pgErr) {
      console.warn('PostgreSQL purge warning:', pgErr.message);
    } finally {
      await pool.end();
    }
  } else {
    console.log('No PostgreSQL connection string provided; skipping PostgreSQL direct query.');
  }

  // 2. Cloud Firestore Purge via Firebase Admin SDK
  const serviceAccount = getServiceAccountCredentials();
  if (serviceAccount) {
    try {
      if (!getApps().length) {
        initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || process.env.VITE_FIREBASE_PROJECT_ID || 'easeland-fba04'
        });
      }
      const adminDb = getFirestore();
      const targetCollections = [
        'properties',
        'propertyPrivate',
        'propertyMediaPrivate',
        'propertyDocuments',
        'verificationRecords',
        'enquiries'
      ];

      console.log('Purging Cloud Firestore collections in batches of 300...');
      for (const colName of targetCollections) {
        let count = 0;
        while (true) {
          const snap = await adminDb.collection(colName).limit(300).get();
          if (snap.empty) break;

          const batch = adminDb.batch();
          snap.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();

          count += snap.size;
          if (snap.size < 300) break;
        }
        results.firestore[colName] = count;
        console.log('  [Firestore] Collection ' + colName + ': deleted ' + count + ' documents');
      }
    } catch (fsErr) {
      console.error('Firestore purge error:', fsErr.message);
      results.firestore.error = fsErr.message;
    }
  } else {
    console.warn('');
    console.warn('CRITICAL NOTICE: No Firebase Service Account Key found!');
    console.warn('To purge Cloud Firestore:');
    console.warn('  1. Go to Firebase Console -> Project Settings -> Service accounts');
    console.warn('  2. Click "Generate new private key" and download the JSON file');
    console.warn('  3. Save it as serviceAccountKey.json in the project root: ' + rootDir);
    console.warn('  4. Re-run: node scripts/purgeAllProperties.js --confirm');
    console.warn('');
    results.firestore.status = 'SKIPPED_NO_CREDENTIALS';
  }

  // 3. Local Disk Storage Purge
  const uploadsDir = path.join(rootDir, 'uploads');
  const propStore = path.join(uploadsDir, 'properties_store.json');
  const enqStore = path.join(uploadsDir, 'enquiries_store.json');
  const delStore = path.join(uploadsDir, 'admin_deleted_store.json');

  [propStore, enqStore, delStore].forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
        results.localStorageFiles.push(path.basename(filePath));
      }
    } catch (e) {}
  });

  const propUploadsDir = path.join(uploadsDir, 'properties');
  const docUploadsDir = path.join(uploadsDir, 'documents');
  [propUploadsDir, docUploadsDir].forEach(dir => {
    try {
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(f => {
          try { fs.rmSync(path.join(dir, f), { recursive: true, force: true }); } catch (e) {}
        });
      }
    } catch (e) {}
  });

  console.log('');
  console.log('=== PURGE SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
}

runPurge().catch(err => {
  console.error('Fatal error during purge:', err);
  process.exit(1);
});
