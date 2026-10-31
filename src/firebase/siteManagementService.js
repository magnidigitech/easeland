import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
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

  // 1. Primary: Fetch from PostgreSQL /api/site-config (Authoritative Central Store)
  try {
    let res = await fetch('/api/site-config');
    if (!res.ok && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      try {
        res = await fetch('https://easeland.in/api/site-config');
      } catch (eRemote) {}
    }
    if (res && res.ok) {
      const json = await res.json();
      if (json.success && json.config && typeof json.config === 'object') {
        Object.assign(mergedConfig, json.config);
        if (json.config.master_draft && typeof json.config.master_draft === 'object') {
          Object.keys(json.config.master_draft).forEach((k) => {
            if (!mergedConfig[k]) {
              mergedConfig[k] = json.config.master_draft[k];
            } else if (typeof mergedConfig[k] === 'object' && typeof json.config.master_draft[k] === 'object') {
              mergedConfig[k] = { ...mergedConfig[k], ...json.config.master_draft[k] };
            }
          });
        }
      }
    }
  } catch (err) {}

  // 2. Secondary: Fetch and merge from Cloud Firestore siteManagement collection
  try {
    const docsToProcess = [];

    // 2a. First attempt: Query published documents (Permitted for public visitors per security rules)
    try {
      const q = query(collection(db, 'siteManagement'), where('state', '==', 'PUBLISHED'));
      const qSnap = await getDocs(q);
      qSnap.forEach(d => docsToProcess.push(d));
    } catch (qErr) {
      // 2b. Direct document fallback: Reading specific published document is always permitted by security rules
      try {
        const featDoc = await getDoc(doc(db, 'siteManagement', 'featuredListings'));
        if (featDoc.exists()) docsToProcess.push(featDoc);
      } catch (featErr) {}
    }

    // 2c. Fallback for authenticated admin sessions: fetch all docs if published query returned nothing
    if (docsToProcess.length === 0) {
      try {
        const fullSnap = await getDocs(collection(db, 'siteManagement'));
        fullSnap.forEach(d => docsToProcess.push(d));
      } catch (e) {}
    }

    // 2d. Always ensure featuredListings is checked directly if not yet in docsToProcess
    if (!docsToProcess.some(d => d.id === 'featuredListings')) {
      try {
        const featDoc = await getDoc(doc(db, 'siteManagement', 'featuredListings'));
        if (featDoc.exists()) docsToProcess.push(featDoc);
      } catch (e) {}
    }

    docsToProcess.forEach((docSnap) => {
      if (docSnap.id === 'master_draft') {
        const draftData = docSnap.data();
        if (draftData && typeof draftData === 'object') {
          Object.keys(draftData).forEach((k) => {
            if (!mergedConfig[k]) {
              mergedConfig[k] = draftData[k];
            } else if (typeof mergedConfig[k] === 'object' && typeof draftData[k] === 'object') {
              mergedConfig[k] = { ...mergedConfig[k], ...draftData[k] };
            }
          });
        }
      } else {
        const existing = mergedConfig[docSnap.id];
        if (!existing) {
          mergedConfig[docSnap.id] = docSnap.data();
        } else {
          const fsData = docSnap.data() || {};
          if (docSnap.id === 'featuredListings') {
            const pgFeatured = existing || {};
            // PostgreSQL is the authoritative central store. Never let older Firestore data override PostgreSQL broadcast!
            if (existing && typeof existing === 'object') {
              const pgIds = Array.isArray(pgFeatured.featuredPropertyIds) ? pgFeatured.featuredPropertyIds : [];
              mergedConfig[docSnap.id] = {
                ...fsData,
                ...pgFeatured,
                featuredPropertyIds: pgIds,
                promotedProperties: pgIds.length === 0
                  ? []
                  : (Array.isArray(pgFeatured.promotedProperties) && pgFeatured.promotedProperties.length > 0)
                    ? pgFeatured.promotedProperties
                    : [],
                displayCount: pgFeatured.displayCount !== undefined ? pgFeatured.displayCount : (fsData.displayCount ?? 6),
                sectionTitle: pgFeatured.sectionTitle || fsData.sectionTitle || 'Featured & Recent Verified Properties',
                badgeText: pgFeatured.badgeText || fsData.badgeText || 'VERIFIED LISTINGS',
                showOnlyFeatured: true
              };
            } else if (fsIds.length > 0) {
              mergedConfig[docSnap.id] = {
                ...fsData,
                featuredPropertyIds: fsIds,
                promotedProperties: Array.isArray(fsData.promotedProperties) ? fsData.promotedProperties : [],
                displayCount: fsData.displayCount ?? 6,
                sectionTitle: fsData.sectionTitle || 'Featured & Recent Verified Properties',
                badgeText: fsData.badgeText || 'VERIFIED LISTINGS',
                showOnlyFeatured: true
              };
            }
          } else {
            // PostgreSQL is authoritative for all other modules
            mergedConfig[docSnap.id] = { ...fsData, ...existing };
          }
        }
      }
    });
  } catch (error) {
    console.warn('Firestore siteManagement fetch note:', error.message);
  }

  // 3. Fallback & Local Merge: Local storage cache (offline fallback only)
  if (typeof window !== 'undefined') {
    try {
      const rawStored = localStorage.getItem('easeland_site_config');
      if (rawStored) {
        const parsed = JSON.parse(rawStored);
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach((k) => {
            if (k === 'master_draft' && parsed.master_draft && typeof parsed.master_draft === 'object') {
              Object.keys(parsed.master_draft).forEach((mk) => {
                if (!mergedConfig[mk]) {
                  mergedConfig[mk] = parsed.master_draft[mk];
                } else if (typeof mergedConfig[mk] === 'object' && typeof parsed.master_draft[mk] === 'object') {
                  mergedConfig[mk] = { ...mergedConfig[mk], ...parsed.master_draft[mk] };
                }
              });
            } else if (!mergedConfig[k]) {
              mergedConfig[k] = parsed[k];
            } else if (typeof mergedConfig[k] === 'object' && typeof parsed[k] === 'object') {
              mergedConfig[k] = { ...mergedConfig[k], ...parsed[k] };
            }
          });

          // Authoritative Broadcast for featuredListings:
          // The central database (PostgreSQL) is the TV broadcast station.
          // Stale local storage cache must NEVER override the active server broadcast!
          const localFeatured = parsed.featuredListings;
          if (localFeatured && typeof localFeatured === 'object') {
            const remoteFeatured = mergedConfig.featuredListings;
            if (remoteFeatured && typeof remoteFeatured === 'object') {
              // Remote broadcast is 100% authoritative for all accounts and viewers
              const remoteIds = Array.isArray(remoteFeatured.featuredPropertyIds) ? remoteFeatured.featuredPropertyIds : [];
              mergedConfig.featuredListings = {
                ...remoteFeatured,
                featuredPropertyIds: remoteIds,
                promotedProperties: remoteIds.length === 0
                  ? []
                  : (Array.isArray(remoteFeatured.promotedProperties) && remoteFeatured.promotedProperties.length > 0)
                    ? remoteFeatured.promotedProperties
                    : [],
                displayCount: remoteFeatured.displayCount !== undefined ? remoteFeatured.displayCount : (localFeatured.displayCount ?? 6),
                sectionTitle: remoteFeatured.sectionTitle || localFeatured.sectionTitle || 'Featured & Recent Verified Properties',
                badgeText: remoteFeatured.badgeText || localFeatured.badgeText || 'VERIFIED LISTINGS',
                showOnlyFeatured: true
              };
            } else if (!mergedConfig.featuredListings && Array.isArray(localFeatured.featuredPropertyIds) && localFeatured.featuredPropertyIds.length > 0) {
              mergedConfig.featuredListings = {
                ...localFeatured,
                showOnlyFeatured: true
              };
            }
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

    // Clean payload for JSON and Firestore (strip all undefined values to prevent Firestore rejection)
    const cleanModuleData = JSON.parse(JSON.stringify(moduleData, (k, v) => (v === undefined ? null : v)));

    try {
      let payload = {};
      if (moduleId === 'master_draft' && typeof cleanModuleData === 'object' && cleanModuleData !== null) {
        payload = { ...cleanModuleData, master_draft: cleanModuleData };
      } else {
        payload = { [moduleId]: cleanModuleData, master_draft: { [moduleId]: cleanModuleData } };
      }
      if (moduleId === 'featuredListings') {
        payload.master_draft = { featuredListings: cleanModuleData };
      }
      let saved = false;
      try {
        const res = await fetch('/api/site-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res && res.ok) saved = true;
      } catch (eLocal) {}

      if (!saved && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        try {
          await fetch('https://easeland.in/api/site-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } catch (eRemote) {}
      }
    } catch (e) {}

    try {
      if (moduleId === 'master_draft' && typeof cleanModuleData === 'object' && cleanModuleData !== null) {
        const promises = Object.keys(cleanModuleData).map(mId => {
          const mPayload = typeof cleanModuleData[mId] === 'object' && cleanModuleData[mId] !== null ? cleanModuleData[mId] : { value: cleanModuleData[mId] };
          return setDoc(doc(db, 'siteManagement', mId), {
            ...mPayload,
            state: 'PUBLISHED',
            updatedAt: serverTimestamp(),
            updatedBy: adminUid || 'admin'
          }, { merge: true }).catch(err => console.warn('Firestore draft note for ' + mId + ':', err.message));
        });
        await Promise.all(promises);
        const masterDraftRef = doc(db, 'siteManagement', 'master_draft');
        await setDoc(masterDraftRef, cleanModuleData, { merge: true });
      } else {
        const docRef = doc(db, 'siteManagement', moduleId);
        const payload = {
          ...(typeof cleanModuleData === 'object' && cleanModuleData !== null ? cleanModuleData : { value: cleanModuleData }),
          state: 'PUBLISHED',
          updatedAt: serverTimestamp(),
          updatedBy: adminUid || 'admin'
        };
        await setDoc(docRef, payload, { merge: true });

        // Keep master_draft synchronized in Firestore so background pulls do not overwrite module
        try {
          const masterDraftRef = doc(db, 'siteManagement', 'master_draft');
          await setDoc(masterDraftRef, { [moduleId]: cleanModuleData }, { merge: true });
        } catch (mdErr) {}
      }
    } catch (fsErr) {
      console.warn('Firestore draft save warning for ' + moduleId + ':', fsErr.message);
    }

    if (typeof window !== 'undefined') {
      let fullConfig = {};
      try {
        const stored = localStorage.getItem('easeland_site_config');
        if (stored) fullConfig = JSON.parse(stored) || {};
      } catch (e) {}

      if (moduleId === 'master_draft' && typeof moduleData === 'object' && moduleData !== null) {
        fullConfig = { ...fullConfig, ...moduleData, master_draft: { ...(fullConfig.master_draft || {}), ...moduleData } };
      } else {
        fullConfig[moduleId] = moduleData;
        if (!fullConfig.master_draft) fullConfig.master_draft = {};
        fullConfig.master_draft[moduleId] = moduleData;
      }
      const sanitized = sanitizeSiteConfig(fullConfig);
      try {
        localStorage.setItem('easeland_site_config', JSON.stringify(sanitized));
      } catch (e) {}
      window.dispatchEvent(new CustomEvent('easeland-site-config-updated', { detail: sanitized }));
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
  const cleanConfig = JSON.parse(JSON.stringify(fullConfig || {}, (k, v) => (v === undefined ? null : v)));
  const publishPayload = { ...cleanConfig, master_draft: cleanConfig };

  // 1. Primary DB Storage: Save all site config modules to PostgreSQL
  try {
    let saved = false;
    try {
      const res = await fetch('/api/site-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publishPayload)
      });
      if (res && res.ok) saved = true;
    } catch (eLocal) {}

    if (!saved && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      try {
        await fetch('https://easeland.in/api/site-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(publishPayload)
        });
      } catch (eRemote) {}
    }
  } catch (pgErr) {
    console.warn('PostgreSQL config publish fallback note:', pgErr.message);
  }

  // 2. Secondary Sync: Keep Firestore fallback in sync
  try {
    const promises = [];
    Object.keys(cleanConfig).forEach((modId) => {
      const docRef = doc(db, 'siteManagement', modId);
      const modData = cleanConfig[modId];
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
    const sanitized = sanitizeSiteConfig(publishPayload);
    try {
      localStorage.setItem('easeland_site_config', JSON.stringify(sanitized));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('easeland-site-config-updated', { detail: sanitized }));
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
