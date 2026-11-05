/**
 * Normalizes and formats raw property category / type strings into clean human-readable Category Tags.
 * Supported standard category tags:
 * - Open Plot Ventures
 * - Open Plot (City)
 * - Apartments/Flat
 * - Independent House/Villa
 * - Commerical Property
 * - Agricultural Lands
 * - Amaravathi LPS layout plots
 * - Others
 */
export const STANDARD_CATEGORIES = [
  'Open Plot Ventures',
  'Open Plot (City)',
  'Apartments/Flat',
  'Independent House/Villa',
  'Commerical Property',
  'Agricultural Lands',
  'Amaravathi LPS layout plots',
  'Others'
];

/**
 * Resolves underlying PropertyType enum string from a standard category label
 */
export function getPropertyTypeFromCategory(category) {
  if (!category || category === 'All' || category === 'ALL') return '';
  const clean = String(category).trim().toLowerCase();
  if (clean.includes('amaravathi') || clean.includes('lps') || clean.includes('venture') || (clean.includes('city') && clean.includes('plot')) || clean.includes('plot')) {
    return 'OPEN_PLOT';
  }
  if (clean.includes('apartment') || clean.includes('flat')) {
    return 'APARTMENT';
  }
  if (clean.includes('house') || clean.includes('villa') || clean.includes('independent')) {
    return 'HOUSE';
  }
  if (clean.includes('commercial') || clean.includes('commeric')) {
    return 'COMMERCIAL';
  }
  if (clean.includes('agricultural') || clean.includes('farm') || clean.includes('land')) {
    return 'LAND';
  }
  if (clean.includes('other')) {
    return 'OTHER';
  }
  return '';
}

/**
 * Resolves standard user-facing category string from a PropertyType enum
 */
export function getCategoryFromPropertyType(propType) {
  if (!propType || propType === 'ALL' || propType === 'ANY') return 'All';
  const clean = String(propType).trim().toUpperCase();
  if (clean === 'OPEN_PLOT' || clean === 'PLOT') return 'Open Plot Ventures';
  if (clean === 'APARTMENT' || clean === 'FLAT') return 'Apartments/Flat';
  if (clean === 'HOUSE' || clean === 'VILLA') return 'Independent House/Villa';
  if (clean === 'COMMERCIAL') return 'Commerical Property';
  if (clean === 'LAND' || clean === 'AGRICULTURAL_LAND') return 'Agricultural Lands';
  if (clean === 'OTHER') return 'Others';
  return 'All';
}

export function getCategoryBadgeLabel(property) {
  if (!property) return 'Open Plot Ventures';

  const raw = property.category || property.propertyType || property.type || '';
  const rawClean = String(raw).trim();
  const str = rawClean.toUpperCase();

  // 1. Direct match with standard categories (case-insensitive)
  const exactMatch = STANDARD_CATEGORIES.find(c => c.toUpperCase() === str);
  if (exactMatch) return exactMatch;

  // Handle common spelling / formatting variations
  if (str === 'COMMERCIAL PROPERTY' || str === 'COMMERCIAL' || str === 'COMMERICAL PROPERTY' || str === 'COMMERICAL') {
    return 'Commerical Property';
  }
  if (str === 'APARTMENT' || str === 'APARTMENTS' || str === 'FLAT' || str === 'FLATS') {
    return 'Apartments/Flat';
  }
  if (str === 'HOUSE' || str === 'VILLA' || str === 'HOUSES' || str === 'VILLAS' || str === 'INDEPENDENT HOUSE' || str === 'HOUSES & VILLAS') {
    return 'Independent House/Villa';
  }
  if (str === 'AGRICULTURAL LAND' || str === 'FARMLAND' || str === 'FARM LAND' || str === 'AGRI LAND') {
    return 'Agricultural Lands';
  }
  if (str === 'AMARAVATHI LPS' || str === 'AMARAVATI LPS' || str.includes('AMARAVATHI LPS') || str.includes('AMARAVATI LPS') || str.includes('CRDA LPS')) {
    return 'Amaravathi LPS layout plots';
  }
  if (str === 'OPEN PLOT (CITY)' || str === 'CITY PLOT' || str === 'CITY PLOTS') {
    return 'Open Plot (City)';
  }

  // 2. Keyword matching in category, title, or property type
  const titleStr = String(property.title || '').toUpperCase();
  const descStr = String(property.description || '').toUpperCase();
  const combined = `${str} ${titleStr} ${descStr}`;

  if (combined.includes('AMARAVATHI') || combined.includes('AMARAVATI') || combined.includes('LPS') || combined.includes('CRDA')) {
    return 'Amaravathi LPS layout plots';
  }

  if (combined.includes('AGRICULTURAL') || combined.includes('FARMLAND') || combined.includes('FARM') || str === 'LAND') {
    return 'Agricultural Lands';
  }

  if (
    combined.includes('COMMERCIAL') ||
    combined.includes('COMMERIC') ||
    combined.includes('OFFICE') ||
    combined.includes('RETAIL') ||
    combined.includes('SHOP')
  ) {
    return 'Commerical Property';
  }

  if (
    combined.includes('APARTMENT') ||
    combined.includes('FLAT') ||
    combined.includes('PENTHOUSE')
  ) {
    return 'Apartments/Flat';
  }

  if (
    combined.includes('VILLA') ||
    combined.includes('HOUSE') ||
    combined.includes('INDEPENDENT') ||
    combined.includes('DUPLEX')
  ) {
    return 'Independent House/Villa';
  }

  if (
    (combined.includes('PLOT') || str === 'OPEN_PLOT') &&
    (combined.includes('CITY') || combined.includes('MUNICIPAL') || combined.includes('COLONY') || combined.includes('TOWN')) &&
    !combined.includes('VENTURE')
  ) {
    return 'Open Plot (City)';
  }

  if (
    combined.includes('VENTURE') ||
    combined.includes('LAYOUT') ||
    combined.includes('DTCP') ||
    combined.includes('HMDA') ||
    combined.includes('RERA') ||
    combined.includes('PLOT') ||
    str === 'OPEN_PLOT' ||
    str === 'OPEN PLOT' ||
    str === 'OPEN_PLOTS' ||
    str === 'OPEN PLOTS'
  ) {
    return 'Open Plot Ventures';
  }

  if (combined.includes('OTHER') || combined.includes('OTHERS') || combined.includes('WAREHOUSE')) {
    return 'Others';
  }

  // Fallback cleanly if readable string exists in property.category
  if (property.category && typeof property.category === 'string' && property.category.trim()) {
    return property.category.trim();
  }

  return 'Open Plot Ventures';
}

/**
 * Clean neutral SVG data URI placeholder when a property has zero uploaded photos.
 * Ensures default stock images (like Unsplash landscapes) are never used anywhere.
 */
export const NO_PHOTO_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgNDAwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImJnIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMGYxNzJhIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMWUyOTNiIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9InVybCgjYmcpIi8+PGNpcmNsZSBjeD0iMzAwIiBjeT0iMTcwIiByPSI1MiIgZmlsbD0iIzMzNDE1NSIgb3BhY2l0eT0iMC42Ii8+PHBhdGggZD0iTTI3MiAxNTJoMTRsNi0xMGgxNmw2IDEwaDE0YTEwIDEwIDAgMCAxIDEwIDEwdjMyYTEwIDEwIDAgMCAxLTEwIDEwaC01NmExMCAxMCAwIDAgMS0xMC0xMHYtMzJhMTAgMTAgMCAwIDEgMTAtMTB6bTI4IDQyYTE2IDE2IDAgMSAwIDAtMzIgMTYgMTYgMCAwIDAgMCAzMnoiIGZpbGw9IiM5NGEzYjgiLz48dGV4dCB4PSIzMDAiIHk9IjI2MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2NiZDVlMSIgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjcwMCIgbGV0dGVyLXNwYWNpbmc9IjAuNSI+Tm8gUGhvdG8gVXBsb2FkZWQ8L3RleHQ+PHRleHQgeD0iMzAwIiB5PSIyODUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2NDc0OGIiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSI1MDAiPkVhc2VMYW5kIFZlcmlmaWVkIFByb3BlcnR5PC90ZXh0Pjwvc3ZnPg==';

/**
 * Checks whether a given URL is a legacy default stock image (Unsplash landscape, etc.).
 * Guarantees that stock photos are never mistaken for genuine user-uploaded property photos.
 */
export function isDefaultStockImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('unsplash.com/photo-1500382017468') ||
    lower.includes('unsplash.com/photo-1592595896551') ||
    lower.includes('unsplash.com/photo-1545324418') ||
    lower.includes('unsplash.com/photo-1613977257363') ||
    lower.includes('unsplash.com/photo-1486406146926') ||
    lower.includes('unsplash.com/photo-1500937386664') ||
    lower.includes('unsplash.com/photo-1628744448840') ||
    lower.includes('unsplash.com/photo-1560448204') ||
    lower.includes('unsplash.com/photo-1522708323590') ||
    lower.includes('unsplash.com/photo-1600585154340')
  );
}

/**
 * Detects whether a media item is designated as the Cover Photo.
 */
export function isItemCoverPhoto(item) {
  if (!item) return false;
  if (typeof item === 'object') {
    if (item.isPrimary === true || item.isCover === true || item.primary === true || item.cover === true) {
      return true;
    }
    const tag = String(item.tag || '').toUpperCase();
    if (tag === 'COVER' || tag === 'PRIMARY') return true;
    const caption = String(item.caption || item.name || '').toUpperCase();
    if (caption.includes('(COVER') || caption.includes('COVER PHOTO') || caption.includes('PRIMARY PHOTO')) {
      return true;
    }
  }
  return false;
}

/**
 * Safely inspects whether an item or URL is a genuine photo (and NOT a video or document).
 */
export function isPhotoMedia(item) {
  if (!item) return false;
  let url = null;
  let mediaType = null;

  if (typeof item === 'string') {
    url = item.trim();
  } else if (typeof item === 'object') {
    url = item.publicUrl || item.url || item.mediaUrl || item.fileUrl || item.photoUrl || item.src || item.path || '';
    mediaType = item.mediaType || item.type;
    if (item.provider === 'youtube' || item.provider === 'gdrive' || item.videoId || item.fileId || item.embedUrl) {
      return false;
    }
    if (item.contentType && (item.contentType.startsWith('video/') || item.contentType.startsWith('application/'))) {
      return false;
    }
  }

  if (!url || typeof url !== 'string') return false;
  const lowerUrl = url.toLowerCase().trim();
  if (!lowerUrl) return false;

  if (
    mediaType === 'WALKTHROUGH_VIDEO' ||
    mediaType === 'DRONE_VIDEO' ||
    mediaType === 'VIDEO' ||
    mediaType === 'DOCUMENT' ||
    lowerUrl.includes('youtube.com') ||
    lowerUrl.includes('youtu.be') ||
    lowerUrl.includes('drive.google.com') ||
    lowerUrl.endsWith('.mp4') ||
    lowerUrl.endsWith('.webm') ||
    lowerUrl.endsWith('.mov') ||
    lowerUrl.endsWith('.avi') ||
    lowerUrl.endsWith('.mkv') ||
    lowerUrl.endsWith('.pdf') ||
    lowerUrl.endsWith('.doc') ||
    lowerUrl.endsWith('.docx')
  ) {
    return false;
  }

  return true;
}

/**
 * Helper to safely extract a valid photo URL from any item format.
 * Returns null if the item is empty, a video, a document, or a stock image.
 */
function extractValidPhotoUrl(item) {
  if (!item) return null;
  let url = null;
  if (typeof item === 'string') {
    url = item.trim();
  } else if (typeof item === 'object') {
    if (!isPhotoMedia(item)) return null;
    url = item.publicUrl || item.url || item.photoUrl || item.mediaUrl || item.fileUrl || item.src || item.path || '';
  }
  if (!url || typeof url !== 'string') return null;
  url = url.trim();
  if (!url || isDefaultStockImageUrl(url) || !isPhotoMedia(item)) return null;
  return url;
}

/**
 * Returns neutral SVG placeholder if no uploaded photos exist.
 * Stock images (Unsplash) are strictly never used as property fallbacks.
 */
export function getCategoryFallbackImage(property) {
  return NO_PHOTO_PLACEHOLDER;
}

/**
 * Safely extracts the COVER PHOTO or the FIRST UPLOADED PHOTO from the property.
 * Guarantees that:
 * 1. If a cover photo is marked (isPrimary, isCover, coverPhoto, coverImage), it is always used.
 * 2. If no cover photo is marked, the first genuine user-uploaded photo from media / photos / images is used.
 * 3. Default stock images are NEVER returned anywhere. If zero photos were uploaded, NO_PHOTO_PLACEHOLDER is returned.
 */
export function getPropertyCoverOrFirstImage(property) {
  if (!property) return NO_PHOTO_PLACEHOLDER;

  const mediaArrays = [
    property.media,
    property.photos,
    property.publicApprovedMedia,
    property.images
  ];

  // 1. Priority 1: Check for explicit Cover Photo in media arrays
  for (const arr of mediaArrays) {
    if (Array.isArray(arr) && arr.length > 0) {
      for (const item of arr) {
        if (isItemCoverPhoto(item)) {
          const u = extractValidPhotoUrl(item);
          if (u) return u;
        }
      }
    }
  }

  // Check top-level dedicated cover fields
  const coverCandidates = [
    property.coverPhoto,
    property.coverImage,
    property.primaryPhoto,
    property.primaryImageUrl,
    property.approvedThumbnail
  ];
  for (const field of coverCandidates) {
    const u = extractValidPhotoUrl(field);
    if (u) return u;
  }

  // 2. Priority 2: First Photo from user-uploaded images
  for (const arr of mediaArrays) {
    if (Array.isArray(arr) && arr.length > 0) {
      for (const item of arr) {
        const u = extractValidPhotoUrl(item);
        if (u) return u;
      }
    }
  }

  // Check top-level single image fields
  const singleImageCandidates = [
    property.thumbnailUrl,
    property.thumbnail,
    property.image,
    property.imageUrl,
    property.photoUrl
  ];
  for (const field of singleImageCandidates) {
    const u = extractValidPhotoUrl(field);
    if (u) return u;
  }

  // Check uploaded documents for valid images
  const docs = Array.isArray(property.documents)
    ? property.documents
    : (Array.isArray(property.propertyDocuments) ? property.propertyDocuments : []);
  for (const d of docs) {
    const u = extractValidPhotoUrl(d);
    if (u && /\.(jpg|jpeg|png|webp|svg)/i.test(u)) return u;
  }

  // 3. Fallback: No user photo uploaded -> return neutral placeholder, NEVER default stock image
  return NO_PHOTO_PLACEHOLDER;
}

/**
 * Safely extracts the FIRST genuine uploaded image (or Cover Photo) from any property payload.
 * Single entry point consumed by PropertyCard, PropertyDetailsView, UniversalMapEngine, UserDashboard, etc.
 */
export function getFirstUploadedImage(property) {
  return getPropertyCoverOrFirstImage(property);
}

/**
 * Safely extracts a DEDUPLICATED list of ONLY actual uploaded PHOTOS.
 * Prioritizes the Cover Photo at index 0, followed by remaining user-uploaded photos.
 * Dynamically filters out all videos, walkthroughs, drone footage, and documents.
 * Guarantees zero duplicate dummy images or fallback padding when real photos exist.
 */
export function getPropertyPhotosList(property) {
  if (!property) {
    return [{ url: NO_PHOTO_PLACEHOLDER, publicUrl: NO_PHOTO_PLACEHOLDER, mediaType: 'PHOTO', caption: 'No Photo Uploaded' }];
  }

  const title = property.title || 'Property Photo';
  const seenUrls = new Set();
  const photosList = [];

  const addPhotoItem = (item, isCover = false) => {
    if (!item) return;
    const url = extractValidPhotoUrl(item);
    if (!url) return;

    let caption = title;
    if (typeof item === 'object') {
      caption = item.caption || item.name || title;
    }

    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      const photoObj = {
        url,
        publicUrl: url,
        mediaType: 'PHOTO',
        caption: isCover ? (caption + ' (Cover Photo)') : caption,
        isPrimary: isCover || Boolean(item?.isPrimary || item?.isCover)
      };
      if (isCover) {
        photosList.unshift(photoObj);
      } else {
        photosList.push(photoObj);
      }
    }
  };

  const mediaArrays = [
    property.media,
    property.photos,
    property.publicApprovedMedia,
    property.images
  ];

  // 1. Process cover photos first so cover photo lands at index 0
  for (const arr of mediaArrays) {
    if (Array.isArray(arr) && arr.length > 0) {
      for (const item of arr) {
        if (isItemCoverPhoto(item)) {
          addPhotoItem(item, true);
        }
      }
    }
  }

  const coverCandidates = [
    property.coverPhoto,
    property.coverImage,
    property.primaryPhoto,
    property.primaryImageUrl,
    property.approvedThumbnail
  ];
  for (const field of coverCandidates) {
    if (field) addPhotoItem(field, true);
  }

  // 2. Process all remaining user-uploaded photos
  for (const arr of mediaArrays) {
    if (Array.isArray(arr) && arr.length > 0) {
      for (const item of arr) {
        addPhotoItem(item, false);
      }
    }
  }

  // 3. Process single image fields
  addPhotoItem(property.thumbnailUrl, false);
  addPhotoItem(property.thumbnail, false);
  addPhotoItem(property.image, false);
  addPhotoItem(property.imageUrl, false);
  addPhotoItem(property.photoUrl, false);

  // 4. Process documents if image files exist
  const docs = Array.isArray(property.documents)
    ? property.documents
    : (Array.isArray(property.propertyDocuments) ? property.propertyDocuments : []);
  for (const d of docs) {
    if (!d) continue;
    if (typeof d === 'string' && /\.(jpg|jpeg|png|webp|svg)/i.test(d)) addPhotoItem(d, false);
    else if (typeof d === 'object') {
      const u = d.publicUrl || d.url || d.fileUrl || d.path;
      if (u && typeof u === 'string' && /\.(jpg|jpeg|png|webp|svg)/i.test(u)) addPhotoItem(d, false);
    }
  }

  // If real photos exist, return ONLY those real photos! Zero dummy fallback padding!
  if (photosList.length > 0) {
    return photosList;
  }

  // If truly zero real photos exist, return neutral placeholder
  return [{ url: NO_PHOTO_PLACEHOLDER, publicUrl: NO_PHOTO_PLACEHOLDER, mediaType: 'PHOTO', caption: 'No Photo Uploaded' }];
}

/**
 * Safely extracts a DEDUPLICATED list of all uploaded property media.
 * Places Cover Photo at index 0.
 * Returns an array of normalized media objects: [{ url, publicUrl, mediaType, caption }]
 * Guarantees zero duplicate URLs in galleries across all property payload variants.
 */
export function getPropertyMediaList(property) {
  if (!property) {
    return [{ url: NO_PHOTO_PLACEHOLDER, publicUrl: NO_PHOTO_PLACEHOLDER, mediaType: 'PHOTO', caption: 'No Media Uploaded' }];
  }

  const title = property.title || 'Property Media';
  const seenUrls = new Set();
  const mediaList = [];

  const addMediaItem = (item, isCover = false) => {
    if (!item) return;
    let url = null;
    let caption = title;
    let mediaType = 'PHOTO';
    let embedUrl = null;

    if (typeof item === 'string') {
      url = item.trim();
    } else if (typeof item === 'object') {
      url = item.publicUrl || item.url || item.mediaUrl || item.fileUrl || item.photoUrl || item.src || item.path;
      caption = item.caption || item.name || title;
      mediaType = item.mediaType || item.type || (item.embedUrl ? 'WALKTHROUGH_VIDEO' : 'PHOTO');
      embedUrl = item.embedUrl || null;
    }

    if (!url || typeof url !== 'string') return;
    url = url.trim();
    if (!url || isDefaultStockImageUrl(url)) return;

    const lowerUrl = url.toLowerCase();
    if (
      mediaType === 'WALKTHROUGH_VIDEO' ||
      mediaType === 'DRONE_VIDEO' ||
      mediaType === 'VIDEO' ||
      lowerUrl.includes('youtube.com') ||
      lowerUrl.includes('youtu.be') ||
      lowerUrl.endsWith('.mp4') ||
      lowerUrl.endsWith('.webm') ||
      lowerUrl.endsWith('.mov')
    ) {
      if (mediaType === 'PHOTO') mediaType = 'WALKTHROUGH_VIDEO';
      if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
        const ytMatch = (embedUrl || url).match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
        if (ytMatch && ytMatch[1]) {
          embedUrl = 'https://www.youtube.com/embed/' + ytMatch[1] + '?rel=0';
        } else if (!embedUrl) {
          embedUrl = url;
        }
      } else if (lowerUrl.includes('drive.google.com')) {
        const driveMatch = (embedUrl || url).match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/i);
        if (driveMatch && (driveMatch[1] || driveMatch[2])) {
          embedUrl = 'https://drive.google.com/file/d/' + (driveMatch[1] || driveMatch[2]) + '/preview';
        }
      }
    }

    // Deduplicate by URL
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      const mediaItemObj = {
        url,
        publicUrl: url,
        embedUrl,
        mediaType,
        caption: isCover ? (caption + ' (Cover Photo)') : caption,
        isPrimary: isCover || Boolean(item?.isPrimary || item?.isCover)
      };
      if (isCover) {
        mediaList.unshift(mediaItemObj);
      } else {
        mediaList.push(mediaItemObj);
      }
    }
  };

  const arraysToProcess = [
    property.media,
    property.photos,
    property.publicApprovedMedia,
    property.images
  ];

  // 1. Process cover photos first so cover photo is at index 0
  for (const arr of arraysToProcess) {
    if (Array.isArray(arr) && arr.length > 0) {
      for (const item of arr) {
        if (isItemCoverPhoto(item)) {
          addMediaItem(item, true);
        }
      }
    }
  }

  const coverCandidates = [
    property.coverPhoto,
    property.coverImage,
    property.primaryPhoto,
    property.primaryImageUrl,
    property.approvedThumbnail
  ];
  for (const field of coverCandidates) {
    if (field) addMediaItem(field, true);
  }

  // 2. Process main media arrays in order of priority
  for (const arr of arraysToProcess) {
    if (Array.isArray(arr) && arr.length > 0) {
      for (const item of arr) {
        addMediaItem(item, false);
      }
    }
  }

  // 3. Process thumbnail / single image fields
  addMediaItem(property.thumbnailUrl, false);
  addMediaItem(property.thumbnail, false);
  addMediaItem(property.image, false);
  addMediaItem(property.imageUrl, false);
  addMediaItem(property.photoUrl, false);

  // 4. Process documents if image files exist
  const docs = Array.isArray(property.documents)
    ? property.documents
    : (Array.isArray(property.propertyDocuments) ? property.propertyDocuments : []);
  for (const d of docs) {
    if (!d) continue;
    if (typeof d === 'string' && /\.(jpg|jpeg|png|webp|svg)/i.test(d)) addMediaItem(d, false);
    else if (typeof d === 'object') {
      const u = d.publicUrl || d.url || d.fileUrl || d.path;
      if (u && typeof u === 'string' && /\.(jpg|jpeg|png|webp|svg)/i.test(u)) addMediaItem(d, false);
    }
  }

  // 5. Fallback if zero valid unique media found
  if (mediaList.length === 0) {
    return [{ url: NO_PHOTO_PLACEHOLDER, publicUrl: NO_PHOTO_PLACEHOLDER, mediaType: 'PHOTO', caption: 'No Media Uploaded' }];
  }

  return mediaList;
}

/**
 * Safely extracts a DEDUPLICATED list of ONLY VIDEOS (walkthroughs, drone, youtube, mp4).
 */
export function getPropertyVideosList(property) {
  if (!property) return [];
  const mediaList = getPropertyMediaList(property);
  return mediaList.filter(m => !isPhotoMedia(m));
}

/**
 * Resolves a thumbnail image URL for video items (YouTube poster, video poster, or property photo).
 */
export function getVideoThumbnailUrl(item, property) {
  const fallback = property ? getFirstUploadedImage(property) : null;
  if (!item) return fallback;

  const url = typeof item === 'string' ? item : (item.thumbnailUrl || item.thumbnail || item.poster || item.url || item.publicUrl || item.embedUrl || item.mediaUrl || item.src || '');
  if (!url) return fallback;

  // 1. YouTube thumbnail matching
  const ytMatch = String(url).match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return 'https://img.youtube.com/vi/' + ytMatch[1] + '/hqdefault.jpg';
  }

  // 2. Google Drive thumbnail
  const driveMatch = String(url).match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/i);
  if (driveMatch && (driveMatch[1] || driveMatch[2])) {
    return 'https://lh3.googleusercontent.com/u/0/d/' + (driveMatch[1] || driveMatch[2]);
  }

  if (typeof item === 'object') {
    if (item.thumbnailUrl) return item.thumbnailUrl;
    if (item.poster) return item.poster;
    if (item.thumbnail) return item.thumbnail;
  }

  return url || fallback;
}

