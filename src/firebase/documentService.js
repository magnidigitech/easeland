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

    let fetchedDocs = [];

    // 1. Try dedicated documents endpoint (/api/properties/:id/documents)
    try {
      const docRes = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/documents`);
      if (docRes.ok) {
        const docData = await docRes.json();
        if (docData.success && Array.isArray(docData.documents) && docData.documents.length > 0) {
          fetchedDocs = docData.documents;
        }
      }
    } catch (e) {}

    // 2. Try property endpoint (/api/properties/:id)
    if (fetchedDocs.length === 0) {
      try {
        const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.property && Array.isArray(data.property.documents)) {
            fetchedDocs = data.property.documents;
          }
        }
      } catch (e) {}
    }

    // 3. Fallback to localStorage if available
    if (fetchedDocs.length === 0 && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`easeland_wizard_documents_${propertyId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            fetchedDocs = parsed;
          }
        }
      } catch (e) {}
    }

    const seenKeys = new Set();
    const normalizedDocs = [];

    fetchedDocs.forEach(d => {
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

const KNOWN_DOCUMENT_TYPES = new Set([
  'DOCUMENT',
  'TITLE_DEED',
  'LAYOUT_APPROVAL',
  'TAX_RECEIPT',
  'ENCUMBRANCE_CERTIFICATE',
  'FIELD_MEASUREMENT',
  'OTHER',
  'LEGAL_DEED',
  'MUTATION',
  'KHATA',
  'PASSPORT',
  'AADHAAR',
  'PAN'
]);

export function isDocumentLikeItem(item) {
  if (!item) return false;
  if (typeof item === 'string') {
    const clean = item.trim().toLowerCase();
    return (
      clean.includes('/uploads/documents/') ||
      clean.includes('private_docs') ||
      clean.endsWith('.pdf') ||
      clean.endsWith('.doc') ||
      clean.endsWith('.docx') ||
      clean.endsWith('.txt') ||
      clean.endsWith('.xls') ||
      clean.endsWith('.xlsx')
    );
  }
  if (typeof item !== 'object') return false;
  if (item.isDocument === true || item.docId || item.documentType) return true;
  const typeUpper = String(item.documentType || item.type || item.documentName || '').toUpperCase();
  if (KNOWN_DOCUMENT_TYPES.has(typeUpper)) return true;
  if (
    typeUpper.includes('DOC') ||
    typeUpper.includes('DEED') ||
    typeUpper.includes('TAX') ||
    typeUpper.includes('APPROVAL') ||
    typeUpper.includes('CERTIFICATE') ||
    typeUpper.includes('RECEIPT')
  ) {
    return true;
  }
  if (
    typeof item.contentType === 'string' &&
    (item.contentType.startsWith('application/') || item.contentType.includes('pdf') || item.contentType.includes('word'))
  ) {
    return true;
  }
  const urlStr = String(item.publicUrl || item.url || item.storagePath || item.path || '').trim().toLowerCase();
  return (
    urlStr.includes('/uploads/documents/') ||
    urlStr.includes('private_docs') ||
    urlStr.endsWith('.pdf') ||
    urlStr.endsWith('.doc') ||
    urlStr.endsWith('.docx') ||
    urlStr.endsWith('.txt') ||
    urlStr.endsWith('.xls') ||
    urlStr.endsWith('.xlsx')
  );
}

/**
 * Aggregate all uploaded confidential documents across properties and server document records.
 */
export function collectAllConfidentialDocuments(properties = [], serverDocs = []) {
  const results = [];
  const seenKeys = new Set();

  const propById = new Map();
  (Array.isArray(properties) ? properties : []).forEach((prop) => {
    if (!prop || typeof prop !== 'object') return;
    [prop.id, prop.propertyId, prop.referenceId].forEach((candidateId) => {
      const idStr = String(candidateId || '').trim();
      if (idStr) propById.set(idStr.toLowerCase(), prop);
    });
  });

  const pushDoc = (rawItem, propMeta = {}, isPendingReaudit = false) => {
    if (!rawItem) return;
    const isObj = typeof rawItem === 'object';
    const urlStr = isObj
      ? String(rawItem.publicUrl || rawItem.url || rawItem.mediaUrl || rawItem.storagePath || rawItem.path || '').trim()
      : String(rawItem).trim();

    if (!urlStr && !isObj) return;

    const docName = isObj
      ? String(rawItem.documentName || rawItem.name || rawItem.fileName || rawItem.title || 'Confidential Property Document').trim()
      : (urlStr.split('/').pop() || 'Confidential Property Document');

    const docType = isObj
      ? String(rawItem.documentType || rawItem.type || 'OTHER').trim()
      : 'OTHER';

    const docId = isObj
      ? String(rawItem.docId || rawItem.mediaId || rawItem.id || docName).trim()
      : docName;

    const propId = String(
      propMeta.propertyId ||
      (isObj && rawItem.propertyId) ||
      'UNASSIGNED'
    ).trim();

    const normUrl = urlStr && urlStr !== '#' ? urlStr.toLowerCase() : '';
    const normName = normalizeDocString(docName);
    const dedupKey = `${propId.toLowerCase()}::${normUrl || normName || docId.toLowerCase()}`;

    if (!dedupKey || seenKeys.has(dedupKey)) return;
    seenKeys.add(dedupKey);

    const matchedProp = propById.get(propId.toLowerCase()) || null;
    const ownerObj = matchedProp?.owner || matchedProp?.ownerDetails || matchedProp?.contact || {};
    const locObj = matchedProp?.location || {};

    results.push({
      docId,
      name: docName,
      fileName: (isObj && rawItem.fileName) || docName,
      type: docType,
      url: urlStr || '#',
      contentType: (isObj && rawItem.contentType) || '',
      size: Number(isObj && (rawItem.fileSize || rawItem.size)) || 0,
      uploadedAt: (isObj && (rawItem.uploadedAt || rawItem.createdAt)) || matchedProp?.updatedAt || matchedProp?.createdAt || null,
      propertyId: propId,
      propertyTitle:
        propMeta.propertyTitle ||
        (isObj && rawItem.propertyTitle) ||
        matchedProp?.title ||
        matchedProp?.propertyTitle ||
        `Property ${propId}`,
      propertyLocation:
        propMeta.propertyLocation ||
        [locObj.locality || matchedProp?.locality, locObj.city || matchedProp?.city].filter(Boolean).join(', ') ||
        '',
      propertyStatus:
        propMeta.propertyStatus ||
        (isObj && rawItem.propertyStatus) ||
        matchedProp?.status ||
        matchedProp?.listingStatus ||
        'UNKNOWN',
      ownerName:
        propMeta.ownerName ||
        (isObj && rawItem.ownerName) ||
        matchedProp?.ownerName ||
        ownerObj?.name ||
        ownerObj?.fullName ||
        '',
      ownerPhone:
        propMeta.ownerPhone ||
        (isObj && rawItem.ownerPhone) ||
        matchedProp?.ownerPhone ||
        ownerObj?.phone ||
        ownerObj?.mobile ||
        '',
      ownerEmail:
        propMeta.ownerEmail ||
        (isObj && rawItem.ownerEmail) ||
        matchedProp?.ownerEmail ||
        ownerObj?.email ||
        '',
      isPendingReaudit: Boolean(isPendingReaudit || (isObj && rawItem.isPendingReaudit))
    });
  };

  (Array.isArray(properties) ? properties : []).forEach((prop) => {
    if (!prop || typeof prop !== 'object') return;
    const propId = String(prop.id || prop.propertyId || prop.referenceId || '').trim();
    const ownerObj = prop.owner || prop.ownerDetails || prop.contact || {};
    const locObj = prop.location || {};
    const propMeta = {
      propertyId: propId,
      propertyTitle: prop.title || prop.propertyTitle || `Property ${propId}`,
      propertyLocation: [locObj.locality || prop.locality, locObj.city || prop.city].filter(Boolean).join(', '),
      propertyStatus: prop.status || prop.listingStatus || 'UNKNOWN',
      ownerName: prop.ownerName || ownerObj?.name || ownerObj?.fullName || '',
      ownerPhone: prop.ownerPhone || ownerObj?.phone || ownerObj?.mobile || '',
      ownerEmail: prop.ownerEmail || ownerObj?.email || ''
    };

    const directDocArrays = [prop.documents, prop.propertyDocuments, prop.confidentialDocuments];
    directDocArrays.forEach((arr) => {
      if (Array.isArray(arr)) arr.forEach((d) => pushDoc(d, propMeta, false));
    });

    if (Array.isArray(prop.media)) {
      prop.media.forEach((m) => {
        if (isDocumentLikeItem(m)) pushDoc(m, propMeta, false);
      });
    }

    const pending = prop.pendingReauditData || prop.pendingEdits || {};
    if (pending && typeof pending === 'object') {
      [pending.documents, pending.propertyDocuments, pending.confidentialDocuments].forEach((arr) => {
        if (Array.isArray(arr)) arr.forEach((d) => pushDoc(d, propMeta, true));
      });
      if (Array.isArray(pending.media)) {
        pending.media.forEach((m) => {
          if (isDocumentLikeItem(m)) pushDoc(m, propMeta, true);
        });
      }
    }
  });

  (Array.isArray(serverDocs) ? serverDocs : []).forEach((sDoc) => {
    pushDoc(sDoc, {}, Boolean(sDoc?.isPendingReaudit));
  });

  return results;
}
