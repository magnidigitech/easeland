import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './config.js';
import { MediaStatus, MediaType } from './schema.js';
import { formatFirestoreError } from './userService.js';

/**
 * Helper to parse YouTube and Google Drive video URLs into embed URLs and metadata
 */
export function parseVideoLink(url) {
  if (!url || typeof url !== 'string') return null;

  const cleanUrl = url.trim();

  // YouTube Patterns: watch?v=, youtu.be/, shorts/, embed/
  const ytMatch = cleanUrl.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return {
      provider: 'youtube',
      videoId,
      publicUrl: cleanUrl,
      embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      title: 'YouTube Video'
    };
  }

  // Google Drive Patterns: file/d/{id}/view, open?id={id}
  const driveMatch = cleanUrl.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/i);
  if (driveMatch) {
    const fileId = driveMatch[1] || driveMatch[2];
    return {
      provider: 'gdrive',
      fileId,
      publicUrl: cleanUrl,
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      thumbnailUrl: null,
      title: 'Google Drive Video'
    };
  }

  return null;
}

/**
 * Add external YouTube or Google Drive video link to property media
 */
export async function addPropertyVideoLink(
  propertyId,
  ownerId,
  url,
  {
    mediaType = MediaType.WALKTHROUGH_VIDEO,
    caption = ''
  } = {}
) {
  try {
    if (!propertyId || !url) {
      return { success: false, error: 'Property ID and video link URL are required.' };
    }

    const parsed = parseVideoLink(url);
    if (!parsed) {
      return { success: false, error: 'Invalid link. Please enter a valid YouTube or Google Drive URL.' };
    }

    const propRef = doc(db, 'properties', propertyId);
    let masterMedia = [];

    const snap = await getDoc(propRef);
    if (snap.exists()) {
      masterMedia = sanitizeMediaArray(snap.data().media);
    }

    const mediaId = `med-link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newMediaObj = {
      mediaId,
      propertyId,
      ownerId: ownerId || auth.currentUser?.uid || 'anonymous-owner',
      type: mediaType,
      provider: parsed.provider,
      storagePath: `external_link:${parsed.provider}:${parsed.videoId || parsed.fileId}`,
      publicUrl: parsed.publicUrl,
      embedUrl: parsed.embedUrl,
      thumbnailUrl: parsed.thumbnailUrl,
      fileName: `${parsed.title} (${parsed.provider === 'youtube' ? 'YouTube' : 'Google Drive'})`,
      contentType: 'video/external-link',
      fileSize: 0,
      displayOrder: masterMedia.length + 1,
      isPrimary: false,
      caption: caption || '',
      verificationStatus: MediaStatus.PENDING_REVIEW,
      uploadedAt: new Date().toISOString()
    };

    masterMedia.push(newMediaObj);
    masterMedia = sanitizeMediaArray(masterMedia);

    const publicApprovedMedia = masterMedia.filter(
      item => item && item.verificationStatus === MediaStatus.APPROVED
    );

    const mediaPrivateRef = doc(db, 'propertyMediaPrivate', propertyId);
    try {
      await setDoc(mediaPrivateRef, {
        propertyId,
        ownerId: ownerId || 'anonymous-owner',
        masterMedia,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {}

    const vUrl = parsed.publicUrl || parsed.embedUrl || parsed.url;
    await setDoc(propRef, {
      media: masterMedia,
      videoUrl: vUrl,
      videoLink: vUrl,
      embeddedVideoUrl: parsed.embedUrl || vUrl,
      publicApprovedMedia,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Also sync to PostgreSQL & mockApi
    try {
      const { syncPropertyToPostgres } = await import('./propertyService.js');
      const snapData = (await getDoc(propRef)).data();
      if (snapData) {
        syncPropertyToPostgres({ ...snapData, videoUrl: vUrl, videoLink: vUrl, embeddedVideoUrl: parsed.embedUrl || vUrl, media: masterMedia });
      }
    } catch (e) {}

    try {
      const { mockApi } = await import('../services/mockApi.js');
      const pObj = mockApi.getPropertyById(propertyId);
      if (pObj) {
        pObj.videoUrl = vUrl;
        pObj.videoLink = vUrl;
        pObj.embeddedVideoUrl = parsed.embedUrl || vUrl;
        pObj.media = masterMedia;
      }
    } catch (e) {}

    return { success: true, mediaItem: newMediaObj };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Sanitizes media array items to ensure no bloated base64 Data URLs are stored in Firestore
 */
export function sanitizeMediaArray(mediaArray) {
  if (!Array.isArray(mediaArray)) return [];
  return mediaArray.map(item => {
    if (!item) return null;
    if (typeof item === 'string') {
      return item.trim().length > 0 ? item : null;
    }
    let publicUrl = item.publicUrl || item.url || item.mediaUrl || item.embedUrl || '';
    let storagePath = item.storagePath || '';
    if (!publicUrl && !storagePath) {
      return null;
    }
    return {
      ...item,
      publicUrl: publicUrl || '',
      url: publicUrl || '',
      mediaUrl: publicUrl || '',
      storagePath
    };
  }).filter(Boolean);
}

/**
 * Client-side image compression helper (downscales & compresses images to ~200KB-800KB)
 */
export async function compressImageFile(file, maxWidth = 1920, maxHeight = 1080, quality = 0.82) {
  if (!file || !file.type.startsWith('image/')) {
    return file;
  }
  // Skip compression for small files (< 400KB)
  if (file.size < 400 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

/**
 * File validation helper for property media uploads
 */
export function validateMediaFile(file, mediaType = MediaType.PHOTO) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const isVideo = mediaType === MediaType.WALKTHROUGH_VIDEO || mediaType === MediaType.DRONE_VIDEO;

  if (isVideo) {
    // Video Validation: Max 100MB, mp4/webm/mov
    const maxVideoBytes = 100 * 1024 * 1024;
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];

    if (file.size > maxVideoBytes) {
      return { valid: false, error: 'Video file size exceeds maximum limit of 100MB.' };
    }
    if (!file.type.startsWith('video/') && !allowedVideoTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid video format. Please upload MP4, WebM, or MOV format.' };
    }
  } else {
    // Photo Validation: Max 10MB, jpeg/png/webp
    const maxPhotoBytes = 10 * 1024 * 1024;
    const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

    if (file.size > maxPhotoBytes) {
      return { valid: false, error: 'Photo file size exceeds maximum limit of 10MB.' };
    }
    if (!file.type.startsWith('image/') && !allowedPhotoTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid image format. Please upload JPEG, PNG, or WebP image.' };
    }
  }

  return { valid: true };
}

/**
 * Upload property media file to Firebase Storage & update Firestore property record
 */
export async function uploadPropertyMediaFile(
  propertyId,
  ownerId,
  file,
  {
    mediaType = MediaType.PHOTO,
    isPrimary = false,
    caption = '',
    onProgress = null
  } = {}
) {
  try {
    if (!propertyId || !file) {
      return { success: false, error: 'Property ID and file object are required.' };
    }

    const validation = validateMediaFile(file, mediaType);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const propRef = doc(db, 'properties', propertyId);
    let masterMedia = [];

    const snap = await getDoc(propRef);
    if (snap.exists()) {
      const data = snap.data();
      masterMedia = sanitizeMediaArray(data.media);
    }

    if (masterMedia.length >= 30) {
      return { success: false, error: 'Maximum 30 media items allowed per property.' };
    }

    // Compress photo on client side for fast upload performance
    let uploadFile = file;
    if (mediaType === MediaType.PHOTO) {
      try {
        uploadFile = await compressImageFile(file);
      } catch (compErr) {
        uploadFile = file;
      }
    }

    // Upload file directly to Hostinger Coolify Storage API (/api/upload)
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('propertyId', propertyId);
    formData.append('ownerId', ownerId || auth.currentUser?.uid || 'anonymous');
    formData.append('mediaType', mediaType);

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
              reject(new Error(resp.error || 'Hostinger storage upload failed.'));
            }
          } catch (e) {
            reject(new Error('Invalid response from storage server.'));
          }
        } else {
          reject(new Error(`Storage server returned error code ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error uploading file to Hostinger storage server.'));
      xhr.ontimeout = () => reject(new Error('Upload request timed out.'));
      xhr.timeout = 300000; // 5 minute timeout for large 200MB videos

      xhr.send(formData);
    });

    const mediaId = `med-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const downloadUrl = uploadResult.publicUrl;
    const storagePath = uploadResult.relativePath;

    // Enforce single primary cover image in masterMedia
    let updatedMasterMedia = masterMedia.map(item => {
      if (isPrimary && item.type === MediaType.PHOTO) {
        return { ...item, isPrimary: false };
      }
      return item;
    });

    const newMediaObj = {
      mediaId,
      propertyId,
      ownerId: ownerId || 'anonymous-owner',
      type: mediaType,
      storagePath,
      publicUrl: downloadUrl,
      fileName: file.name,
      contentType: uploadFile.type,
      fileSize: uploadFile.size,
      displayOrder: updatedMasterMedia.length + 1,
      isPrimary: mediaType === MediaType.PHOTO ? isPrimary : false,
      caption: caption || '',
      verificationStatus: MediaStatus.PENDING_REVIEW,
      uploadedAt: new Date().toISOString()
    };

    updatedMasterMedia.push(newMediaObj);
    updatedMasterMedia = sanitizeMediaArray(updatedMasterMedia);

    const publicApprovedMedia = updatedMasterMedia.filter(
      item => item && item.verificationStatus === MediaStatus.APPROVED
    );

    // Update propertyMediaPrivate safely
    const mediaPrivateRef = doc(db, 'propertyMediaPrivate', propertyId);
    try {
      await setDoc(mediaPrivateRef, {
        propertyId,
        ownerId: ownerId || 'anonymous-owner',
        masterMedia: updatedMasterMedia,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (privErr) {
      // Ignore private doc permission errors
    }

    const updatePayload = {
      media: updatedMasterMedia,
      publicApprovedMedia,
      updatedAt: serverTimestamp()
    };

    if (mediaType === MediaType.WALKTHROUGH_VIDEO || mediaType === MediaType.DRONE_VIDEO) {
      updatePayload.videoUrl = downloadUrl;
      updatePayload.videoLink = downloadUrl;
      updatePayload.embeddedVideoUrl = downloadUrl;
    }

    await setDoc(propRef, updatePayload, { merge: true });

    // Sync to PostgreSQL & mockApi
    try {
      const { syncPropertyToPostgres } = await import('./propertyService.js');
      const snapData = (await getDoc(propRef)).data();
      if (snapData) {
        syncPropertyToPostgres({ ...snapData, media: updatedMasterMedia });
      }
    } catch (e) {}

    return { success: true, mediaItem: newMediaObj };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Remove property media item
 */
export async function removePropertyMediaFile(propertyId, ownerId, mediaId) {
  try {
    if (!propertyId || !mediaId) {
      return { success: false, error: 'Property ID and Media ID are required.' };
    }

    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) {
      return { success: false, error: 'Property listing not found.' };
    }

    const data = snap.data();
    let masterMedia = sanitizeMediaArray(data.media);

    const mediaPrivateRef = doc(db, 'propertyMediaPrivate', propertyId);
    try {
      const pSnap = await getDoc(mediaPrivateRef);
      if (pSnap.exists() && Array.isArray(pSnap.data().masterMedia)) {
        masterMedia = sanitizeMediaArray(pSnap.data().masterMedia);
      }
    } catch (e) {}

    const targetItem = masterMedia.find(item => item.mediaId === mediaId);
    if (!targetItem) {
      return { success: false, error: 'Media item not found.' };
    }

    // Delete file object from Storage if applicable
    if (targetItem.storagePath && !targetItem.storagePath.startsWith('data:')) {
      try {
        const fileRef = ref(storage, targetItem.storagePath);
        await deleteObject(fileRef);
      } catch (err) {}
    }

    const updatedMasterMedia = sanitizeMediaArray(masterMedia.filter(item => item.mediaId !== mediaId));
    const publicApprovedMedia = updatedMasterMedia.filter(
      item => item && item.verificationStatus === MediaStatus.APPROVED
    );

    try {
      await setDoc(mediaPrivateRef, {
        propertyId,
        ownerId: ownerId || data.ownerId || 'anonymous-owner',
        masterMedia: updatedMasterMedia,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (privErr) {}

    await updateDoc(propRef, {
      media: updatedMasterMedia,
      publicApprovedMedia,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Update media display ordering
 */
export async function updatePropertyMediaOrder(propertyId, ownerId, reorderedMediaList) {
  try {
    if (!propertyId || !Array.isArray(reorderedMediaList)) {
      return { success: false, error: 'Property ID and media list array are required.' };
    }

    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) {
      return { success: false, error: 'Property not found.' };
    }

    const data = snap.data();
    const updatedMasterMedia = sanitizeMediaArray(
      reorderedMediaList.map((item, idx) => ({
        ...item,
        displayOrder: idx + 1
      }))
    );

    const publicApprovedMedia = updatedMasterMedia.filter(
      item => item && item.verificationStatus === MediaStatus.APPROVED
    );

    const mediaPrivateRef = doc(db, 'propertyMediaPrivate', propertyId);
    try {
      await setDoc(mediaPrivateRef, {
        propertyId,
        ownerId: ownerId || data.ownerId || 'anonymous-owner',
        masterMedia: updatedMasterMedia,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (privErr) {}

    await updateDoc(propRef, {
      media: updatedMasterMedia,
      publicApprovedMedia,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}

/**
 * Set target photo as primary cover image
 */
export async function setPrimaryPropertyPhoto(propertyId, ownerId, mediaId) {
  try {
    if (!propertyId || !mediaId) {
      return { success: false, error: 'Property ID and Media ID are required.' };
    }

    const propRef = doc(db, 'properties', propertyId);
    const snap = await getDoc(propRef);
    if (!snap.exists()) {
      return { success: false, error: 'Property not found.' };
    }

    const data = snap.data();
    let masterMedia = sanitizeMediaArray(data.media);

    const mediaPrivateRef = doc(db, 'propertyMediaPrivate', propertyId);
    try {
      const pSnap = await getDoc(mediaPrivateRef);
      if (pSnap.exists() && Array.isArray(pSnap.data().masterMedia)) {
        masterMedia = sanitizeMediaArray(pSnap.data().masterMedia);
      }
    } catch (e) {}

    const updatedMasterMedia = sanitizeMediaArray(
      masterMedia.map(item => {
        if (item.type === MediaType.PHOTO) {
          return {
            ...item,
            isPrimary: item.mediaId === mediaId
          };
        }
        return item;
      })
    );

    const publicApprovedMedia = updatedMasterMedia.filter(
      item => item && item.verificationStatus === MediaStatus.APPROVED
    );

    try {
      await setDoc(mediaPrivateRef, {
        propertyId,
        ownerId: ownerId || data.ownerId || 'anonymous-owner',
        masterMedia: updatedMasterMedia,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (privErr) {}

    await updateDoc(propRef, {
      media: updatedMasterMedia,
      publicApprovedMedia,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}
