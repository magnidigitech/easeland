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

    const storageRef = ref(storage, storagePath);
    const metadata = {
      contentType: file.type,
      customMetadata: {
        ownerId,
        propertyId,
        docId,
        documentType
      }
    };

    // Helper to convert file to Data URL fallback
    const fileToBase64 = (f) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
    });

    let docUrl = '';
    const uploadTask = uploadBytesResumable(storageRef, file, metadata);
    await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (onProgress && snapshot.totalBytes > 0) {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(Math.min(99, Math.round(progress)));
          }
        },
        (error) => {
          reject(error);
        },
        () => {
          if (onProgress) onProgress(100);
          resolve();
        }
      );
    });
    docUrl = storagePath;

    const docPayload = {
      docId,
      propertyId,
      ownerId,
      documentName: documentName || file.name || 'Confidential Property Document',
      documentType,
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      storagePath, // Saved safely in private_docs path
      verificationStatus: VerificationStatus.PENDING,
      adminFeedback: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(docRef, docPayload);
    return { success: true, docId, document: docPayload };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Get confidential property documents (Accessible ONLY by Owner or Admin)
 */
export async function getPropertyDocuments(propertyId, ownerId) {
  try {
    if (!propertyId || !ownerId) {
      return { success: false, error: 'Property ID and Owner ID are required.' };
    }

    const q = query(
      collection(db, 'propertyDocuments'),
      where('propertyId', '==', propertyId),
      where('ownerId', '==', ownerId)
    );

    const snap = await getDocs(q);
    const documents = snap.docs.map(doc => doc.data());
    return { success: true, documents };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Remove confidential property document (Storage file + Firestore metadata)
 */
export async function removeConfidentialPropertyDocument(docId, propertyId, ownerId) {
  try {
    if (!docId || !ownerId) {
      return { success: false, error: 'Document ID and Owner ID are required.' };
    }

    const docRef = doc(db, 'propertyDocuments', docId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, error: 'Document not found.' };
    }

    const docData = snap.data();
    if (docData.ownerId !== ownerId) {
      return { success: false, error: 'Unauthorized: You do not own this document.' };
    }

    // Delete Storage file object if storagePath exists
    if (docData.storagePath) {
      try {
        const fileRef = ref(storage, docData.storagePath);
        await deleteObject(fileRef);
      } catch (err) {
        console.warn('Storage document file deletion note:', err.message);
      }
    }

    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
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
