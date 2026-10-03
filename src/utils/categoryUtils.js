/**
 * Normalizes and formats raw property category / type strings into clean human-readable Category Tags.
 * Supported standard category tags:
 * - Open Plots
 * - Houses & Villas
 * - Apartments
 * - Commercial
 * - Rentals
 */
export function getCategoryBadgeLabel(property) {
  if (!property) return 'Open Plots';

  const raw = property.category || property.propertyType || property.type || '';
  const str = String(raw).trim().toUpperCase();
  const purpose = String(property.purpose || '').trim().toUpperCase();

  if (purpose === 'RENT' || str.includes('RENT')) {
    return 'Rentals';
  }

  if (
    str.includes('PLOT') ||
    str.includes('LAND') ||
    str.includes('AGRICULTURAL') ||
    str === 'OPEN_PLOT' ||
    str === 'OPEN PLOT' ||
    str === 'FARMLAND'
  ) {
    return 'Open Plots';
  }

  if (
    str.includes('VILLA') ||
    str.includes('HOUSE') ||
    str.includes('INDEPENDENT') ||
    str === 'HOUSES & VILLAS'
  ) {
    return 'Houses & Villas';
  }

  if (
    str.includes('APARTMENT') ||
    str.includes('FLAT') ||
    str.includes('PENTHOUSE') ||
    str === 'APARTMENTS'
  ) {
    return 'Apartments';
  }

  if (
    str.includes('COMMERCIAL') ||
    str.includes('OFFICE') ||
    str.includes('RETAIL') ||
    str.includes('WAREHOUSE') ||
    str.includes('SHOP')
  ) {
    return 'Commercial';
  }

  // Fallback cleanly if readable string exists
  if (property.category && typeof property.category === 'string' && property.category.trim()) {
    return property.category.trim();
  }

  return 'Open Plots';
}

/**
 * Extract distinct category-matched fallback image if no uploaded photos exist
 */
export function getCategoryFallbackImage(property) {
  const cat = getCategoryBadgeLabel(property);
  switch (cat) {
    case 'Open Plots':
      return 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80';
    case 'Houses & Villas':
      return 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80';
    case 'Apartments':
      return 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';
    case 'Commercial':
      return 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80';
    case 'Rentals':
      return 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80';
    default:
      return 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80';
  }
}

/**
 * Safely extracts a DEDUPLICATED list of all uploaded property media.
 * Returns an array of normalized media objects: [{ url, publicUrl, mediaType, caption }]
 * Guarantees zero duplicate URLs in galleries across all property payload variants.
 */
export function getPropertyMediaList(property) {
  if (!property) {
    const fallback = getCategoryFallbackImage(null);
    return [{ url: fallback, publicUrl: fallback, mediaType: 'PHOTO', caption: 'Property Image' }];
  }

  const title = property.title || 'Property Image';
  const fallback = getCategoryFallbackImage(property);
  const seenUrls = new Set();
  const mediaList = [];

  const addMediaItem = (item) => {
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
    if (!url) return;

    // Deduplicate by URL
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      mediaList.push({
        url,
        publicUrl: url,
        embedUrl,
        mediaType,
        caption
      });
    }
  };

  // 1. Process main media arrays in order of priority
  const arraysToProcess = [
    property.photos,
    property.media,
    property.publicApprovedMedia,
    property.images
  ];

  for (const arr of arraysToProcess) {
    if (Array.isArray(arr) && arr.length > 0) {
      for (const item of arr) {
        addMediaItem(item);
      }
    }
  }

  // 2. Process thumbnail / single image fields (only added if URL wasn't in array)
  addMediaItem(property.approvedThumbnail);
  addMediaItem(property.image);
  addMediaItem(property.imageUrl);
  addMediaItem(property.coverImage);
  addMediaItem(property.photoUrl);

  // 3. Process documents if image files exist
  const docs = Array.isArray(property.documents)
    ? property.documents
    : (Array.isArray(property.propertyDocuments) ? property.propertyDocuments : []);
  for (const d of docs) {
    if (!d) continue;
    if (typeof d === 'string' && /\.(jpg|jpeg|png|webp|svg)/i.test(d)) addMediaItem(d);
    else if (typeof d === 'object') {
      const u = d.publicUrl || d.url || d.fileUrl || d.path;
      if (u && typeof u === 'string' && /\.(jpg|jpeg|png|webp|svg)/i.test(u)) addMediaItem(d);
    }
  }

  // 4. Fallback if zero valid unique media found
  if (mediaList.length === 0) {
    return [{ url: fallback, publicUrl: fallback, mediaType: 'PHOTO', caption: `${title} - Overview` }];
  }

  return mediaList;
}

/**
 * Safely extracts the FIRST uploaded image from any property payload.
 */
export function getFirstUploadedImage(property) {
  const list = getPropertyMediaList(property);
  return list[0]?.url || getCategoryFallbackImage(property);
}
