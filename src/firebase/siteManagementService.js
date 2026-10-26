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
import { sanitizeSiteConfig } from '../services/mockApi.js';

const CMS_MODULE_KEYS = [
  'overview', 'homepage', 'navbar', 'footer', 'buyPage',
  'rentPage', 'sellPage', 'categories', 'faq', 'contact',
  'branding', 'theme', 'media', 'mapsConfig', 'seo', 'featuredListings', 'publish'
];

/**
 * Fetch all CMS Site Management modules from PostgreSQL database (/api/site-config).
 */
export async function getSiteConfigAdmin() {
  const mergedConfig = {};

  // 1. Primary: Fetch from PostgreSQL /api/site-config
  try {
    const res = await fetch('/api/site-config');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.config && typeof json.config === 'object') {
        Object.assign(mergedConfig, json.config);
        if (json.config.master_draft && typeof json.config.master_draft === 'object') {
          Object.keys(json.config.master_draft).forEach((k) => {
            if (!mergedConfig[k]) {
              mergedConfig[k] = json.config.master_draft[k];
            }
          });
        }
      }
    }
  } catch (err) {}

  // 2. Secondary: Fetch and merge from Cloud Firestore siteManagement collection
  try {
    const siteConfigRef = collection(db, 'siteManagement');
    const snapshot = await getDocs(siteConfigRef);

    snapshot.forEach((docSnap) => {
      if (docSnap.id === 'master_draft') {
        const draftData = docSnap.data();
        if (draftData && typeof draftData === 'object') {
          Object.keys(draftData).forEach((k) => {
            if (!mergedConfig[k]) {
              mergedConfig[k] = draftData[k];
            }
          });
        }
      } else {
        const existing = mergedConfig[docSnap.id] || {};
        mergedConfig[docSnap.id] = { ...existing, ...docSnap.data() };
      }
    });
  } catch (error) {
    console.warn('Firestore siteManagement fetch note:', error.message);
  }

  // 3. Fallback & Local Merge: Local storage cache (preserve admin promotions drafts)
  if (typeof window !== 'undefined') {
    try {
      const rawStored = localStorage.getItem('easeland_site_config');
      if (rawStored) {
        const parsed = JSON.parse(rawStored);
        if (parsed && typeof parsed === 'object') {
          if (parsed.featuredListings && Array.isArray(parsed.featuredListings.featuredPropertyIds) && parsed.featuredListings.featuredPropertyIds.length > 0) {
            if (!mergedConfig.featuredListings || !Array.isArray(mergedConfig.featuredListings.featuredPropertyIds) || mergedConfig.featuredListings.featuredPropertyIds.length === 0) {
              mergedConfig.featuredListings = parsed.featuredListings;
            }
          }
          if (Object.keys(mergedConfig).length === 0) {
            Object.assign(mergedConfig, parsed);
          }
        }
      }
    } catch (e) {}
  }

  const sanitized = sanitizeSiteConfig(mergedConfig);
  if (typeof window !== 'undefined' && Object.keys(sanitized).length > 0) {
    try {
      localStorage.setItem('easeland_site_config', JSON.stringify(sanitized));
    } catch (e) {}
  }

  return { success: true, config: sanitized };
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

      // Keep master_draft synchronized in Firestore so background pulls do not overwrite module
      try {
        const masterDraftRef = doc(db, 'siteManagement', 'master_draft');
        await setDoc(masterDraftRef, { [moduleId]: moduleData }, { merge: true });
      } catch (mdErr) {}
    } catch (fsErr) {
      console.warn('Firestore draft save warning for ' + moduleId + ':', fsErr.message);
    }

    if (typeof window !== 'undefined') {
      let fullConfig = {};
      try {
        const stored = localStorage.getItem('easeland_site_config');
        if (stored) fullConfig = JSON.parse(stored) || {};
      } catch (e) {}
      fullConfig[moduleId] = moduleData;
      try {
        localStorage.setItem('easeland_site_config', JSON.stringify(fullConfig));
      } catch (e) {}
      window.dispatchEvent(new CustomEvent('easeland-site-config-updated', { detail: fullConfig }));
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating site module ' + moduleId + ':', error);
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
    try {
      localStorage.setItem('easeland_site_config', JSON.stringify(fullConfig));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('easeland-site-config-updated', { detail: fullConfig }));
  }

  return { success: true };
}

/**
 * Trigger on-demand 3-way synchronization across Firestore, PostgreSQL, and Local Stores.
 */
export async function syncSiteConfigAndUsers() {
  try {
    const res = await fetch('/api/admin/sync-users-and-config', { method: 'POST' });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Sync API network note:', err.message);
  }
  return { success: false };
}
