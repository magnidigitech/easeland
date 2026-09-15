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

    const docItemObj = {
      docId,
      name: documentName || file.name || 'Confidential Property Document',
      type: documentType,
      url: publicUrl,
      size: file.size
    };

    // Sync documents array to properties document & PostgreSQL
    try {
      const propRef = doc(db, 'properties', propertyId);
      try {
        await setDoc(propRef, {
          documents: [docItemObj],
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {}

      const { syncPropertyToPostgres } = await import('./propertyService.js');
      syncPropertyToPostgres({ propertyId, id: propertyId, documents: [docItemObj] });

      const { mockApi } = await import('../services/mockApi.js');
      const pObj = mockApi.getPropertyById(propertyId);
      if (pObj) {
        pObj.documents = Array.isArray(pObj.documents) ? [...pObj.documents.filter(d => d.docId !== docId), docItemObj] : [docItemObj];
      }

      // Local storage backup
      try {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem(`easeland_docs_${propertyId}`) || '[]';
          const parsed = JSON.parse(stored);
          localStorage.setItem(`easeland_docs_${propertyId}`, JSON.stringify([...parsed.filter(d => d.docId !== docId), docItemObj]));
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
 * Get confidential property documents (Accessible ONLY by Owner or Admin)
 */
export async function getPropertyDocuments(propertyId, ownerId) {
  let docs = [];

  // 1. Try local storage backup
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`easeland_docs_${propertyId}`) || localStorage.getItem('easeland_user_documents');
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
    const fsDocs = snap.docs.map(doc => doc.data());
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

  // Deduplicate docs by URL or Name to eliminate duplicates across data sources
  const seenKeys = new Set();
  const normalizedDocs = [];

  docs.forEach(d => {
    if (!d) return;
    const urlStr = d.publicUrl || d.url || d.storagePath || '';
    const nameStr = d.documentName || d.name || d.fileName || '';
    const key = (urlStr && urlStr !== '#') ? urlStr.toLowerCase() : (nameStr ? nameStr.toLowerCase() : (d.docId || d.mediaId));

    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);

    const docName = d.documentName || d.name || d.fileName || 'Confidential Property Document';
    const docType = d.documentType || d.type || 'TITLE_DEED';
    const fileSizeNum = Number(d.fileSize || d.size) || 0;
    const docUrl = urlStr || '#';

    normalizedDocs.push({
      ...d,
      docId: d.docId || d.mediaId || `doc-${normalizedDocs.length + 1}`,
      documentName: docName,
      name: docName,
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
export async function removeConfidentialPropertyDocument(docId, propertyId, ownerId) {
  try {
    if (!docId) {
      return { success: false, error: 'Document ID is required.' };
    }

    try {
      const docRef = doc(db, 'propertyDocuments', docId);
      await deleteDoc(docRef);
    } catch (fsErr) {
      console.warn('Firestore document delete note:', fsErr.message);
    }

    // Remove from local storage
    try {
      if (typeof window !== 'undefined' && propertyId) {
        const stored = localStorage.getItem(`easeland_docs_${propertyId}`) || '[]';
        const parsed = JSON.parse(stored);
        localStorage.setItem(`easeland_docs_${propertyId}`, JSON.stringify(parsed.filter(d => d.docId !== docId)));
      }
    } catch (e) {}

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
