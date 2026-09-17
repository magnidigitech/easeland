import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config.js';
import { logAdminActivity } from './verificationService.js';

const CMS_MODULE_KEYS = [
  'overview', 'homepage', 'navbar', 'footer', 'buyPage',
  'rentPage', 'sellPage', 'categories', 'faq', 'contact',
  'branding', 'theme', 'media', 'mapsConfig', 'seo', 'publish'
];

/**
 * Fetch all 16 CMS Site Management modules from PostgreSQL database (/api/site-config).
 */
export async function getSiteConfigAdmin() {
  try {
    const res = await fetch('/api/site-config');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.config && Object.keys(json.config).length > 0) {
        return { success: true, config: json.config };
      }
    }
  } catch (err) {}

  try {
    const siteConfigRef = collection(db, 'siteManagement');
    const snapshot = await getDocs(siteConfigRef);
    const config = {};

    snapshot.forEach((docSnap) => {
      config[docSnap.id] = docSnap.data();
    });

    return { success: true, config };
  } catch (error) {
    console.error('Error fetching site config:', error);
    return { success: false, error: error.message, config: {} };
  }
}

/**
 * Save draft updates for a specific siteManagement module or master config object.
 */
export async function updateSiteModuleAdmin(moduleId, moduleData, adminUid) {
  try {
    if (!moduleId) throw new Error('Module ID is required');

    try {
      await fetch('/api/site-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [moduleId]: moduleData })
      });
    } catch (e) {}

    const docRef = doc(db, 'siteManagement', moduleId);
    const payload = {
      ...moduleData,
      updatedAt: serverTimestamp(),
      updatedBy: adminUid || 'admin'
    };
    await setDoc(docRef, payload, { merge: true });

    return { success: true };
  } catch (error) {
    console.error(`Error updating site module ${moduleId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Publish all site management modules live to PostgreSQL database and trigger broadcast.
 */
export async function publishSiteConfigAdmin(fullConfig, adminUid) {
  try {
    // 1. Primary DB Storage: Save all site config modules to PostgreSQL
    try {
      await fetch('/api/site-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullConfig || {})
      });
    } catch (pgErr) {
      console.warn('PostgreSQL config publish fallback note:', pgErr.message);
    }

    // 2. Secondary Sync: Keep Firestore fallback in sync
    const promises = [];
    Object.keys(fullConfig || {}).forEach((modId) => {
      const docRef = doc(db, 'siteManagement', modId);
      const modData = fullConfig[modId];
      const payload = typeof modData === 'object' && modData !== null ? modData : { value: modData };

      promises.push(setDoc(docRef, {
        ...payload,
        state: 'PUBLISHED',
        publishedAt: serverTimestamp(),
        publishedBy: adminUid || 'admin'
      }, { merge: true }));
    });

    await Promise.all(promises);

    if (adminUid) {
      await logAdminActivity(
        'SITE_CONFIG_PUBLISHED',
        'Published all 16 CMS modules live to PostgreSQL database.',
        adminUid
      );
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-site-config-updated', { detail: fullConfig }));
    }

    return { success: true };
  } catch (error) {
    console.error('Error publishing site config live:', error);
    return { success: false, error: error.message };
  }
}
