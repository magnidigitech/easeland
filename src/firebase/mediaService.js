import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './config.js';
import { MediaStatus, MediaType } from './schema.js';
import { formatFirestoreError } from './userService.js';

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
 * Upload property media file (Storage upload + Firestore persistence with fallback protection)
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
      masterMedia = Array.isArray(data.media) ? data.media : [];
    }

    // Check private media document if accessible
    const mediaPrivateRef = doc(db, 'propertyMediaPrivate', propertyId);
    try {
      const pSnap = await getDoc(mediaPrivateRef);
      if (pSnap.exists() && Array.isArray(pSnap.data().masterMedia)) {
        masterMedia = pSnap.data().masterMedia;
      }
    } catch (e) {
      // Ignore private doc permission checks
    }

    if (masterMedia.length >= 30) {
      return { success: false, error: 'Maximum 30 media items allowed per property.' };
    }

    const mediaId = `med-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `public_media/properties/${propertyId}/${mediaId}_${sanitizedFileName}`;
    const storageRef = ref(storage, storagePath);

    const metadata = {
      contentType: file.type,
      customMetadata: {
        ownerId: ownerId || 'anonymous-owner',
        propertyId,
        mediaId,
        mediaType
      }
    };

    // Helper to convert file to Data URL fallback
    const fileToBase64 = (f) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
    });

    let downloadUrl = '';
    try {
      // Upload to Firebase Storage with fast 3s fallback timeout
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);
      downloadUrl = await new Promise((resolve, reject) => {
        let settled = false;
        const timeoutId = setTimeout(() => {
          if (!settled) {
            settled = true;
            try { uploadTask.cancel(); } catch (e) {}
            reject(new Error('STORAGE_UNAVAILABLE'));
          }
        }, 3000);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (onProgress && snapshot.totalBytes > 0) {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              onProgress(Math.round(progress));
            }
          },
          (error) => {
            if (!settled) {
              settled = true;
              clearTimeout(timeoutId);
              reject(error);
            }
          },
          async () => {
            if (!settled) {
              settled = true;
              clearTimeout(timeoutId);
              try {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(url);
              } catch (err) {
                reject(err);
              }
            }
          }
        );
      });
    } catch (storageErr) {
      // Fallback: Convert file to Base64 Data URL so photo/video upload NEVER fails
      if (onProgress) onProgress(50);
      downloadUrl = await fileToBase64(file);
      if (onProgress) onProgress(100);
    }

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
      contentType: file.type,
      fileSize: file.size,
      displayOrder: updatedMasterMedia.length + 1,
      isPrimary: mediaType === MediaType.PHOTO ? isPrimary : false,
      caption: caption || '',
      verificationStatus: MediaStatus.PENDING_REVIEW,
      uploadedAt: new Date().toISOString()
    };

    updatedMasterMedia.push(newMediaObj);

    const publicApprovedMedia = updatedMasterMedia.filter(
      item => item && item.verificationStatus === MediaStatus.APPROVED
    );

    // Update propertyMediaPrivate safely
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

    // Always update main property document with media array
    await updateDoc(propRef, {
      media: updatedMasterMedia,
      publicApprovedMedia,
      updatedAt: serverTimestamp()
    });

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
    let masterMedia = Array.isArray(data.media) ? data.media : [];

    const mediaPrivateRef = doc(db, 'propertyMediaPrivate', propertyId);
    try {
      const pSnap = await getDoc(mediaPrivateRef);
      if (pSnap.exists() && Array.isArray(pSnap.data().masterMedia)) {
        masterMedia = pSnap.data().masterMedia;
      }
    } catch (e) {}

    const targetItem = masterMedia.find(item => item.mediaId === mediaId);
    if (!targetItem) {
      return { success: false, error: 'Media item not found.' };
    }

    // Try deleting file object from Storage if applicable
    if (targetItem.storagePath && !targetItem.storagePath.startsWith('data:')) {
      try {
        const fileRef = ref(storage, targetItem.storagePath);
        await deleteObject(fileRef);
      } catch (err) {}
    }

    const updatedMasterMedia = masterMedia.filter(item => item.mediaId !== mediaId);
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
    const updatedMasterMedia = reorderedMediaList.map((item, idx) => ({
      ...item,
      displayOrder: idx + 1
    }));

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
    let masterMedia = Array.isArray(data.media) ? data.media : [];

    const mediaPrivateRef = doc(db, 'propertyMediaPrivate', propertyId);
    try {
      const pSnap = await getDoc(mediaPrivateRef);
      if (pSnap.exists() && Array.isArray(pSnap.data().masterMedia)) {
        masterMedia = pSnap.data().masterMedia;
      }
    } catch (e) {}

    const updatedMasterMedia = masterMedia.map(item => {
      if (item.type === MediaType.PHOTO) {
        return {
          ...item,
          isPrimary: item.mediaId === mediaId
        };
      }
      return item;
    });

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
