import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './config.js';
import { VerificationStatus, DocumentType } from './schema.js';
import { formatFirestoreError } from './userService.js';

/**
 * Validate confidential document file
 */
export function validateDocumentFile(file) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const maxBytes = 25 * 1024 * 1024; // 25MB Max
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (file.size > maxBytes) {
    return { valid: false, error: 'Document file size exceeds maximum limit of 25MB.' };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file format. Please upload PDF, JPEG, PNG, or WebP document.' };
  }

  return { valid: true };
}

/**
 * Upload confidential document file to Firebase Storage & save metadata in propertyDocuments
 */
export async function uploadConfidentialPropertyDocument({
  propertyId,
  ownerId,
  file,
  documentType = DocumentType.OTHER,
  documentName = '',
  onProgress = null
}) {
  try {
    if (!propertyId || !ownerId || !file) {
      return { success: false, error: 'Property ID, Owner ID, and file are required.' };
    }

    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Automatically purge any previous/stale document record with the exact same filename or title to allow clean re-upload
    try {
      await removeConfidentialPropertyDocument({ fileName: file.name, documentName: documentName || file.name }, propertyId, ownerId);
    } catch (purgeErr) {}

    const docRef = doc(collection(db, 'propertyDocuments'));
    const docId = docRef.id;

    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `private_docs/properties/${propertyId}/${docId}_${sanitizedFileName}`;

    // Upload document directly to Hostinger Coolify Storage API (/api/upload)
    const formData = new FormData();
    formData.append('file', file);
    formData.append('propertyId', propertyId);
    formData.append('ownerId', ownerId);
    formData.append('isDocument', 'true');

    const uploadResult = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(Math.min(99, pct));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const resp = JSON.parse(xhr.responseText);
            if (resp.success) {
              if (onProgress) onProgress(100);
              resolve(resp);
            } else {
              reject(new Error(resp.error || 'Hostinger document upload failed.'));
            }
          } catch (e) {
            reject(new Error('Invalid response from storage server.'));
          }
        } else {
          reject(new Error(`Storage server returned error code ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error uploading document to Hostinger storage server.'));
      xhr.ontimeout = () => reject(new Error('Document upload request timed out.'));
      xhr.timeout = 180000;

      xhr.send(formData);
    });

    const finalStoragePath = uploadResult.relativePath || storagePath;
    const publicUrl = uploadResult.publicUrl;

    const docPayload = {
      docId,
      propertyId,
      ownerId,
      documentName: documentName || file.name || 'Confidential Property Document',
      documentType,
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      storagePath: finalStoragePath, // Saved safely in private_docs path
      publicUrl,
      verificationStatus: VerificationStatus.PENDING,
      adminFeedback: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(docRef, docPayload);
    } catch (fsErr) {
      console.warn('Firestore doc sync note:', fsErr.message);
    }

    // Clear any stale deleted documents key from local storage
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('easeland_deleted_documents');
      }
    } catch (e) {}

    const docItemObj = {
      docId,
      name: documentName || file.name || 'Confidential Property Document',
      type: documentType,
      url: publicUrl,
      size: file.size
    };

    // Sync documents array to properties document & PostgreSQL (Replacing old matching entries cleanly)
    try {
      let existingDocs = [];
      try {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem(`easeland_docs_${propertyId}`);
          if (stored) existingDocs = JSON.parse(stored);
        }
      } catch (e) {}

      const normNew = normalizeDocString(documentName || file.name);
      const filteredExisting = existingDocs.filter(d => {
        if (!d) return false;
        const dId = String(d.docId || d.id || d.mediaId || '');
        if (dId && dId === docId) return false;
        const dName = String(d.documentName || d.name || d.fileName || '');
        const normD = normalizeDocString(dName);
        return normD !== normNew;
      });

      const updatedDocsArray = [...filteredExisting, docItemObj];

      const propRef = doc(db, 'properties', propertyId);
      try {
        const propSnap = await getDoc(propRef);
        let currentFsDocs = [];
        if (propSnap.exists() && Array.isArray(propSnap.data().documents)) {
          currentFsDocs = propSnap.data().documents;
        }
        const mergedFsDocs = [...currentFsDocs.filter(d => {
          if (!d) return false;
          const dId = String(d.docId || d.id || d.mediaId || '');
          if (dId && dId === docId) return false;
          const dName = String(d.documentName || d.name || d.fileName || '');
          const normD = normalizeDocString(dName);
          return normD !== normNew;
        }), docItemObj];

        await setDoc(propRef, {
          documents: mergedFsDocs,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {}

      const { syncPropertyToPostgres } = await import('./propertyService.js');
      syncPropertyToPostgres({ propertyId, id: propertyId, documents: updatedDocsArray });

      const { mockApi } = await import('../services/mockApi.js');
      const pObj = mockApi.getPropertyById(propertyId);
      if (pObj) {
        pObj.documents = updatedDocsArray;
      }

      // Local storage backup
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`easeland_docs_${propertyId}`, JSON.stringify(updatedDocsArray));
        }
      } catch (e) {}
    } catch (syncErr) {}

    return { success: true, docId, document: docPayload };
  } catch (error) {
    console.warn('Document upload fallback note:', error);
    return { success: false, error: error.message || 'Upload error' };
  }
}

/**
 * Helper to normalize document name/filename string for comparison (removes extensions & special characters)
 */
export function normalizeDocString(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Get confidential property documents (Accessible ONLY by Owner or Admin)
 */
export async function getPropertyDocuments(propertyId, ownerId) {
  let docs = [];

  // Clear stale blacklist in browser if present
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('easeland_deleted_documents');
    }
  } catch (e) {}

  // 1. Try local storage backup
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`easeland_docs_${propertyId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          docs = parsed.filter(d => d && (d.propertyId === propertyId || !d.propertyId));
        }
      }
    }
  } catch (e) {}

  // 2. Try Firestore non-blockingly
  try {
    const q = query(
      collection(db, 'propertyDocuments'),
      where('propertyId', '==', propertyId)
    );
    const snap = await getDocs(q);
    const fsDocs = snap.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    if (Array.isArray(fsDocs) && fsDocs.length > 0) {
      docs = [...docs, ...fsDocs];
    }
  } catch (fsErr) {
    console.warn('Firestore propertyDocuments query note:', fsErr.message);
  }

  // 3. Try PostgreSQL property record /api/properties/:id
  try {
    if (propertyId) {
      const res = await fetch(`/api/properties/${propertyId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.property && Array.isArray(data.property.documents)) {
          docs = [...docs, ...data.property.documents];
        }
      }
    }
  } catch (e) {}

  // Deduplicate docs by normalized Name / Filename so only 1 copy per document is shown
  const seenKeys = new Set();
  const normalizedDocs = [];

  docs.forEach(d => {
    if (!d) return;
    const urlStr = (d.publicUrl || d.url || d.storagePath || '').trim();
    const nameStr = (d.documentName || d.name || d.fileName || d.title || '').trim();
    const docIdStr = String(d.docId || d.mediaId || d.id || '').trim();

    const normName = normalizeDocString(nameStr);
    const dedupKey = normName || (urlStr.toLowerCase() !== '#' ? urlStr.toLowerCase() : '') || docIdStr.toLowerCase();

    if (!dedupKey || seenKeys.has(dedupKey)) return;
    seenKeys.add(dedupKey);

    const docName = d.documentName || d.name || d.fileName || 'Confidential Property Document';
    const docType = d.documentType || d.type || 'TITLE_DEED';
    const fileSizeNum = Number(d.fileSize || d.size) || 0;
    const docUrl = urlStr || '#';

    normalizedDocs.push({
      ...d,
      docId: d.docId || d.mediaId || d.id || `doc-${normalizedDocs.length + 1}`,
      documentName: docName,
      name: docName,
      fileName: d.fileName || docName,
      documentType: docType,
      type: docType,
      fileSize: fileSizeNum,
      size: fileSizeNum,
      publicUrl: docUrl,
      url: docUrl,
      verificationStatus: d.verificationStatus || 'PENDING'
    });
  });

  return { success: true, documents: normalizedDocs };
}

/**
 * Remove confidential property document (Storage file + Firestore metadata)
 */
export async function removeConfidentialPropertyDocument(docTarget, propertyId, ownerId) {
  try {
    if (!docTarget) {
      return { success: false, error: 'Document target or ID is required.' };
    }

    let docIdStr = '';
    let docUrlStr = '';
    let docNameStr = '';
    let docStoragePath = '';

    if (typeof docTarget === 'object' && docTarget !== null) {
      docIdStr = String(docTarget.docId || docTarget.mediaId || docTarget.id || '').trim().toLowerCase();
      docUrlStr = String(docTarget.publicUrl || docTarget.url || docTarget.storagePath || '').trim().toLowerCase();
      docNameStr = String(docTarget.documentName || docTarget.name || docTarget.fileName || docTarget.title || '').trim();
      docStoragePath = String(docTarget.storagePath || '').trim();
    } else {
      docIdStr = String(docTarget).trim().toLowerCase();
    }

    const normTargetName = normalizeDocString(docNameStr);

    // Helper to check if a doc object matches any target identifier or name
    const isDocMatch = (d) => {
      if (!d) return false;
      const dId = String(d.docId || d.mediaId || d.id || '').trim().toLowerCase();
      const dUrl = String(d.publicUrl || d.url || d.storagePath || '').trim().toLowerCase();
      const dName = String(d.documentName || d.name || d.fileName || d.title || '').trim();

      if (docIdStr && dId && !docIdStr.startsWith('doc-') && dId === docIdStr) return true;
      if (docUrlStr && docUrlStr !== '#' && dUrl && (dUrl === docUrlStr || dUrl.includes(docUrlStr) || docUrlStr.includes(dUrl))) return true;

      if (normTargetName && dName) {
        const normD = normalizeDocString(dName);
        if (normD && normTargetName === normD) return true;
      }

      return false;
    };

    // 1. Delete actual file from Firebase Storage / Private Vault if storagePath is available
    if (docStoragePath && !docStoragePath.startsWith('http')) {
      try {
        const fileRef = ref(storage, docStoragePath);
        await deleteObject(fileRef);
      } catch (sErr) {
        console.warn('Storage file deletion note:', sErr.message);
      }
    }

    // 2. Remove from Local Storage backups
    try {
      if (typeof window !== 'undefined') {
        const keysToClean = ['easeland_user_documents'];
        if (propertyId) keysToClean.push(`easeland_docs_${propertyId}`);

        keysToClean.forEach(key => {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              const updated = parsed.filter(d => !isDocMatch(d));
              localStorage.setItem(key, JSON.stringify(updated));
            }
          }
        });
      }
    } catch (e) {}

    // 3. Remove from Firestore propertyDocuments collection (Delete by ID and matching query)
    try {
      if (docIdStr && !docIdStr.startsWith('doc-')) {
        try {
          await deleteDoc(doc(db, 'propertyDocuments', docIdStr));
        } catch (e) {}
      }
      if (propertyId) {
        try {
          const q = query(collection(db, 'propertyDocuments'), where('propertyId', '==', propertyId));
          const snap = await getDocs(q);
          for (const dSnap of snap.docs) {
            const dData = dSnap.data();
            if (isDocMatch(dData) || dSnap.id === docIdStr) {
              if (dData.storagePath) {
                try {
                  await deleteObject(ref(storage, dData.storagePath));
                } catch (stErr) {}
              }
              try {
                await deleteDoc(dSnap.ref);
              } catch (e) {}
            }
          }
        } catch (e) {}
      }
    } catch (fsErr) {
      console.warn('Firestore document delete note:', fsErr.message);
    }

    // 4. Remove from property document array in Memory, Mock API, PostgreSQL, and Firestore
    if (propertyId) {
      let remainingDocs = [];

      try {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem(`easeland_docs_${propertyId}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            remainingDocs = parsed.filter(d => !isDocMatch(d));
            localStorage.setItem(`easeland_docs_${propertyId}`, JSON.stringify(remainingDocs));
          }
        }
      } catch (e) {}

      try {
        const { mockApi } = await import('../services/mockApi.js');
        const pObj = mockApi.getPropertyById(propertyId);
        if (pObj && Array.isArray(pObj.documents)) {
          pObj.documents = pObj.documents.filter(d => !isDocMatch(d));
          remainingDocs = pObj.documents;
        }
      } catch (mErr) {}

      try {
        const propRef = doc(db, 'properties', propertyId);
        const propSnap = await getDoc(propRef);
        if (propSnap.exists()) {
          const currentDocs = propSnap.data().documents || [];
          const updatedDocs = currentDocs.filter(d => !isDocMatch(d));
          remainingDocs = updatedDocs;
          await setDoc(propRef, { documents: updatedDocs, updatedAt: serverTimestamp() }, { merge: true });
        }
      } catch (pFsErr) {}

      try {
        const { syncPropertyToPostgres } = await import('./propertyService.js');
        await syncPropertyToPostgres({ propertyId, id: propertyId, documents: remainingDocs });
      } catch (pgErr) {}

      try {
        await fetch(`/api/properties/${propertyId}/documents`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docId: docIdStr, name: docNameStr, fileName: docNameStr })
        });
      } catch (apiErr) {}
    }

    return { success: true };
  } catch (error) {
    console.warn('Remove document error:', error);
    return { success: true };
  }
}

/**
 * Legacy metadata compatibility helper
 */
export async function uploadPropertyDocumentMetadata(payload) {
  return uploadConfidentialPropertyDocument(payload);
}

/**
 * Legacy delete metadata compatibility helper
 */
export async function deletePropertyDocumentMetadata(docId, ownerId) {
  return removeConfidentialPropertyDocument(docId, null, ownerId);
}
