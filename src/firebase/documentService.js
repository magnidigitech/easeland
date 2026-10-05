import { VerificationStatus, DocumentType } from './schema.js';

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
 * Upload confidential document file to Hostinger PostgreSQL Storage API (/api/upload)
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

    // Upload document directly to Hostinger PostgreSQL Storage API (/api/upload)
    const formData = new FormData();
    formData.append('file', file);
    formData.append('propertyId', propertyId);
    formData.append('ownerId', ownerId);
    formData.append('documentType', documentType);
    formData.append('documentName', documentName || file.name);
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
              reject(new Error(resp.error || 'Document upload failed.'));
            }
          } catch (e) {
            reject(new Error('Invalid response from storage server.'));
          }
        } else {
          reject(new Error(`Storage server returned error code ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error uploading document to server.'));
      xhr.ontimeout = () => reject(new Error('Document upload request timed out.'));
      xhr.timeout = 180000;

      xhr.send(formData);
    });

    const docId = uploadResult.mediaId;
    const publicUrl = uploadResult.publicUrl;

    const docPayload = {
      docId,
      propertyId,
      ownerId,
      documentName: documentName || file.name,
      name: documentName || file.name,
      documentType,
      type: documentType,
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      size: file.size,
      publicUrl,
      url: publicUrl,
      verificationStatus: VerificationStatus.PENDING
    };

    return { success: true, docId, document: docPayload };
  } catch (error) {
    console.warn('Document upload note:', error);
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
 * Get confidential property documents (Exclusively from PostgreSQL property record /api/properties/:id)
 */
export async function getPropertyDocuments(propertyId, ownerId) {
  try {
    if (!propertyId) return { success: true, documents: [] };

    const res = await fetch(`/api/properties/${propertyId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.property && Array.isArray(data.property.documents)) {
        const seenKeys = new Set();
        const normalizedDocs = [];

        data.property.documents.forEach(d => {
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
    }
    return { success: true, documents: [] };
  } catch (e) {
    return { success: true, documents: [] };
  }
}

/**
 * Remove confidential property document (Exclusively from PostgreSQL backend server)
 */
export async function removeConfidentialPropertyDocument(docTarget, propertyId, ownerId) {
  try {
    if (!docTarget) {
      return { success: false, error: 'Document target or ID is required.' };
    }

    let docIdStr = '';
    let docNameStr = '';

    if (typeof docTarget === 'object' && docTarget !== null) {
      docIdStr = String(docTarget.docId || docTarget.mediaId || docTarget.id || '').trim();
      docNameStr = String(docTarget.documentName || docTarget.name || docTarget.fileName || docTarget.title || '').trim();
    } else {
      docIdStr = String(docTarget).trim();
    }

    if (propertyId) {
      await fetch(`/api/properties/${propertyId}/documents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: docIdStr, name: docNameStr, fileName: docNameStr })
      });
    }

    return { success: true };
  } catch (error) {
    console.warn('Remove document note:', error);
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
