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
      if (docSnap.id === 'master_draft') {
        const draftData = docSnap.data();
        if (draftData && typeof draftData === 'object') {
          Object.assign(config, draftData);
        }
      } else {
        config[docSnap.id] = docSnap.data();
      }
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

    try {
      const docRef = doc(db, 'siteManagement', moduleId);
      const payload = {
        ...(typeof moduleData === 'object' && moduleData !== null ? moduleData : { value: moduleData }),
        updatedAt: serverTimestamp(),
        updatedBy: adminUid || 'admin'
      };
      await setDoc(docRef, payload, { merge: true });
    } catch (fsErr) {
      console.warn(`Firestore draft save warning for ${moduleId}:`, fsErr.message);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-site-config-updated', { detail: moduleData }));
    }

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
  try {
    const promises = [];
    Object.keys(fullConfig || {}).forEach((modId) => {
      if (modId === 'master_draft') return;
      const docRef = doc(db, 'siteManagement', modId);
      const modData = fullConfig[modId];
      const payload = typeof modData === 'object' && modData !== null ? modData : { value: modData };

      promises.push(
        setDoc(docRef, {
          ...payload,
          state: 'PUBLISHED',
          publishedAt: serverTimestamp(),
          publishedBy: adminUid || 'admin'
        }, { merge: true }).catch(err => console.warn(`Firestore sync note for ${modId}:`, err.message))
      );
    });

    await Promise.all(promises);
  } catch (fsErr) {
    console.warn('Firestore publish sync note:', fsErr.message);
  }

  if (adminUid) {
    try {
      await logAdminActivity(
        'SITE_CONFIG_PUBLISHED',
        'Published all 16 CMS modules live.',
        adminUid
      );
    } catch (e) {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('easeland-site-config-updated', { detail: fullConfig }));
  }

  return { success: true };
}
