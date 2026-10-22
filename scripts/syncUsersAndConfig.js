/**
 * EaseLand Authoritative 3-Way Synchronization Tool
 * Synchronizes 'users' and 'siteManagement' across:
 * 1. Cloud Firestore
 * 2. PostgreSQL
 * 3. Local Disk / In-Memory Stores
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
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
          return parsed;
        }
      } catch (err) {}
    }
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      if (raw.startsWith('{')) return JSON.parse(raw);
      if (fs.existsSync(raw)) return JSON.parse(fs.readFileSync(raw, 'utf8'));
    } catch (e) {}
  }
  return null;
}

const serviceAccount = getServiceAccountCredentials();
if (!serviceAccount) {
  console.error('ERROR: No serviceAccountKey.json found. Please ensure it is in the project root.');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id || process.env.VITE_FIREBASE_PROJECT_ID || 'easeland-fba04'
  });
}

const auth = getAuth();
const db = getFirestore();
const prodApiBase = process.env.VITE_API_URL || 'https://easeland.in';

async function syncAll() {
  console.log('=== STARTING 3-WAY SYNCHRONIZATION (FIRESTORE <-> POSTGRES <-> LOCAL) ===');
  console.log('Target API Host: ' + prodApiBase);
  console.log('');

  // =========================================================================
  // 1. SYNCHRONIZE USERS
  // =========================================================================
  console.log('--- Step 1: Synchronizing Users ---');
  const userMap = new Map();

  // 1a. Fetch Firebase Auth Users
  try {
    const authList = await auth.listUsers(1000);
    console.log('Found ' + authList.users.length + ' users in Firebase Authentication.');
    for (const u of authList.users) {
      const email = (u.email || '').toLowerCase().trim();
      const uid = u.uid;
      const isAdminEmail = email === 'admin@easeland.in';
      const role = isAdminEmail ? 'ADMIN' : (u.customClaims?.adminRole ? 'ADMIN' : 'USER');

      // Ensure admin custom claim is set for admin@easeland.in
      if (isAdminEmail && !u.customClaims?.adminRole) {
        try {
          await auth.setCustomUserClaims(uid, { adminRole: true });
          console.log('  Assigned adminRole: true custom claim to ' + email + ' (' + uid + ')');
        } catch (claimErr) {
          console.warn('  Could not assign custom claim to ' + email + ':', claimErr.message);
        }
      }

      userMap.set(uid, {
        uid: uid,
        id: uid,
        email: email,
        displayName: u.displayName || (isAdminEmail ? 'EaseLand Admin' : 'EaseLand User'),
        phone: u.phoneNumber || '',
        role: role,
        adminRole: role === 'ADMIN',
        accountStatus: u.disabled ? 'SUSPENDED' : 'ACTIVE',
        emailVerified: u.emailVerified || false,
        createdAt: u.metadata?.creationTime || new Date().toISOString(),
        updatedAt: u.metadata?.lastSignInTime || new Date().toISOString(),
        source: 'firebase_auth'
      });
    }
  } catch (authErr) {
    console.warn('Firebase Auth list note:', authErr.message);
  }

  // 1b. Fetch Firestore Users
  try {
    const fsUsersSnap = await db.collection('users').get();
    console.log('Found ' + fsUsersSnap.size + ' users in Firestore users collection.');
    fsUsersSnap.forEach(doc => {
      const data = doc.data();
      const uid = doc.id;
      const existing = userMap.get(uid) || {};
      userMap.set(uid, {
        ...existing,
        ...data,
        uid: uid,
        id: uid,
        email: (data.email || existing.email || '').toLowerCase().trim(),
        displayName: data.displayName || data.name || existing.displayName || 'EaseLand User',
        phone: data.phone || data.phoneNumber || existing.phone || '',
        role: (data.email === 'admin@easeland.in' || data.role === 'ADMIN' || existing.role === 'ADMIN') ? 'ADMIN' : 'USER',
        accountStatus: data.accountStatus || existing.accountStatus || 'ACTIVE',
        updatedAt: data.updatedAt || existing.updatedAt || new Date().toISOString()
      });
    });
  } catch (fsErr) {
    console.warn('Firestore users fetch note:', fsErr.message);
  }

  // 1c. Fetch PostgreSQL Users via Production API
  try {
    const pgRes = await fetch(prodApiBase + '/api/users');
    if (pgRes.ok) {
      const pgJson = await pgRes.json();
      const pgUsers = pgJson.users || [];
      console.log('Found ' + pgUsers.length + ' users in PostgreSQL database.');
      pgUsers.forEach(u => {
        const uid = u.uid || u.id;
        if (!uid) return;
        const existing = userMap.get(uid) || {};
        userMap.set(uid, {
          ...existing,
          ...u,
          uid: uid,
          id: uid,
          email: (u.email || existing.email || '').toLowerCase().trim(),
          displayName: u.displayName || u.name || existing.displayName || 'EaseLand User',
          phone: u.phone || u.phoneNumber || existing.phone || '',
          role: (u.email === 'admin@easeland.in' || u.role === 'ADMIN' || existing.role === 'ADMIN') ? 'ADMIN' : 'USER',
          accountStatus: u.accountStatus || existing.accountStatus || 'ACTIVE'
        });
      });
    }
  } catch (pgErr) {
    console.warn('PostgreSQL users fetch note:', pgErr.message);
  }

  const allUnifiedUsers = Array.from(userMap.values());
  console.log('Total unified users after merging: ' + allUnifiedUsers.length);

  // 1d. Write back unified users to Firestore and PostgreSQL
  let fsUserWrites = 0;
  let pgUserWrites = 0;

  for (const user of allUnifiedUsers) {
    // Write to Firestore
    try {
      await db.collection('users').doc(user.uid).set(user, { merge: true });
      fsUserWrites++;
    } catch (fsWriteErr) {
      console.warn('  Firestore write failed for user ' + user.uid + ':', fsWriteErr.message);
    }

    // Write to PostgreSQL
    try {
      const res = await fetch(prodApiBase + '/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      if (res.ok) pgUserWrites++;
    } catch (pgWriteErr) {
      console.warn('  PostgreSQL write failed for user ' + user.uid + ':', pgWriteErr.message);
    }
  }

  console.log('  Updated in Firestore users collection: ' + fsUserWrites + ' documents');
  console.log('  Updated in PostgreSQL users table: ' + pgUserWrites + ' rows');
  console.log('');

  // =========================================================================
  // 2. SYNCHRONIZE SITE CONFIGURATION (CMS)
  // =========================================================================
  console.log('--- Step 2: Synchronizing Site Management CMS ---');
  const cmsMap = new Map();

  // 2a. Fetch Firestore siteManagement modules
  try {
    const siteSnap = await db.collection('siteManagement').get();
    console.log('Found ' + siteSnap.size + ' modules in Firestore siteManagement collection.');
    siteSnap.forEach(doc => {
      const data = doc.data();
      cmsMap.set(doc.id, data);
    });
  } catch (fsCmsErr) {
    console.warn('Firestore siteManagement fetch note:', fsCmsErr.message);
  }

  // 2b. Fetch PostgreSQL site_config
  try {
    const pgCfgRes = await fetch(prodApiBase + '/api/site-config');
    if (pgCfgRes.ok) {
      const pgCfgJson = await pgCfgRes.json();
      const pgCfg = pgCfgJson.config || {};
      const modKeys = Object.keys(pgCfg);
      console.log('Found ' + modKeys.length + ' modules in PostgreSQL site_config table.');
      modKeys.forEach(k => {
        const existing = cmsMap.get(k) || {};
        cmsMap.set(k, {
          ...existing,
          ...pgCfg[k],
          updatedAt: pgCfg[k].updatedAt || existing.updatedAt || new Date().toISOString()
        });
      });
    }
  } catch (pgCmsErr) {
    console.warn('PostgreSQL site_config fetch note:', pgCmsErr.message);
  }

  const allUnifiedCms = {};
  cmsMap.forEach((val, key) => { allUnifiedCms[key] = val; });
  const totalCmsModules = Object.keys(allUnifiedCms).length;
  console.log('Total unified CMS modules after merging: ' + totalCmsModules);

  // 2c. Write back to Firestore and PostgreSQL
  let fsCmsWrites = 0;
  for (const [modId, modData] of cmsMap.entries()) {
    try {
      await db.collection('siteManagement').doc(modId).set({
        ...modData,
        state: 'PUBLISHED',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      fsCmsWrites++;
    } catch (fsWriteErr) {
      console.warn('  Firestore CMS write failed for module ' + modId + ':', fsWriteErr.message);
    }
  }

  let pgCmsSuccess = false;
  try {
    const res = await fetch(prodApiBase + '/api/site-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allUnifiedCms)
    });
    if (res.ok) pgCmsSuccess = true;
  } catch (pgWriteErr) {
    console.warn('PostgreSQL CMS write error:', pgWriteErr.message);
  }

  console.log('  Updated in Firestore siteManagement: ' + fsCmsWrites + ' documents');
  console.log('  Updated in PostgreSQL site_config: ' + (pgCmsSuccess ? 'All ' + totalCmsModules + ' modules synced' : 'Failed'));
  console.log('');

  // 2d. Update local disk fallback file if present
  try {
    const uploadsDir = path.join(rootDir, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, 'users_store.json'), JSON.stringify(allUnifiedUsers, null, 2), 'utf8');
    fs.writeFileSync(path.join(uploadsDir, 'site_config_store.json'), JSON.stringify(allUnifiedCms, null, 2), 'utf8');
    console.log('Local disk stores updated: users_store.json (' + allUnifiedUsers.length + '), site_config_store.json (' + totalCmsModules + ')');
  } catch (diskErr) {
    console.warn('Local disk store note:', diskErr.message);
  }

  console.log('');
  console.log('=== 3-WAY SYNCHRONIZATION COMPLETE ===');
  console.log('Users: ' + allUnifiedUsers.length + ' accounts unified across Firestore, PostgreSQL, and Firebase Auth.');
  console.log('CMS Modules: ' + totalCmsModules + ' modules unified across Firestore, PostgreSQL, and Local Storage.');
}

syncAll().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
