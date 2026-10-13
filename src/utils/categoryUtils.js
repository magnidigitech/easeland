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

export function getCategoryBadgeLabel(property) {
  if (!property) return 'Open Plot Ventures';

  const raw = property.category || property.propertyType || property.type || '';
  const rawClean = String(raw).trim();
  const str = rawClean.toUpperCase();

  // 1. Direct match with standard categories (case-insensitive)
  const exactMatch = STANDARD_CATEGORIES.find(c => c.toUpperCase() === str);
  if (exactMatch) return exactMatch;

  // Handle common spelling / formatting variations
  if (str === 'COMMERCIAL PROPERTY' || str === 'COMMERCIAL') {
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
  if (str === 'AMARAVATHI LPS' || str === 'AMARAVATI LPS' || str.includes('AMARAVATHI LPS') || str.includes('AMARAVATI LPS')) {
    return 'Amaravathi LPS layout plots';
  }
  if (str === 'OPEN PLOT' || str === 'OPEN PLOTS' || str === 'OPEN_PLOT' || str === 'OPEN_PLOTS') {
    return 'Open Plot Ventures';
  }

  // 2. Keyword matching in category, title, or property type
  const titleStr = String(property.title || '').toUpperCase();
  const combined = `${str} ${titleStr}`;

  if (combined.includes('AMARAVATHI') || combined.includes('AMARAVATI') || combined.includes('LPS')) {
    return 'Amaravathi LPS layout plots';
  }

  if (combined.includes('AGRICULTURAL') || combined.includes('FARMLAND') || combined.includes('FARM') || str === 'LAND') {
    return 'Agricultural Lands';
  }

  if (
    combined.includes('COMMERCIAL') ||
    combined.includes('OFFICE') ||
    combined.includes('RETAIL') ||
    combined.includes('WAREHOUSE') ||
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
    (combined.includes('CITY') || combined.includes('MUNICIPAL') || combined.includes('COLONY') || combined.includes('TOWN'))
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
    str === 'OPEN_PLOT'
  ) {
    return 'Open Plot Ventures';
  }

  if (combined.includes('OTHER') || combined.includes('OTHERS')) {
    return 'Others';
  }

  // Fallback cleanly if readable string exists in property.category
  if (property.category && typeof property.category === 'string' && property.category.trim()) {
    return property.category.trim();
  }

  return 'Open Plot Ventures';
}

/**
 * Extract distinct category-matched fallback image if no uploaded photos exist
 */
export function getCategoryFallbackImage(property) {
  const cat = getCategoryBadgeLabel(property);
  switch (cat) {
    case 'Open Plot Ventures':
    case 'Open Plots':
      return 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80';
    case 'Open Plot (City)':
      return 'https://images.unsplash.com/photo-1592595896551-12b371d546d5?auto=format&fit=crop&w=800&q=80';
    case 'Apartments/Flat':
    case 'Apartments':
      return 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';
    case 'Independent House/Villa':
    case 'Houses & Villas':
      return 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80';
    case 'Commerical Property':
    case 'Commercial Property':
    case 'Commercial':
      return 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80';
    case 'Agricultural Lands':
      return 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80';
    case 'Amaravathi LPS layout plots':
      return 'https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?auto=format&fit=crop&w=800&q=80';
    case 'Others':
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
          embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
        } else if (!embedUrl) {
          embedUrl = url;
        }
      } else if (lowerUrl.includes('drive.google.com')) {
        const driveMatch = (embedUrl || url).match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/i);
        if (driveMatch && (driveMatch[1] || driveMatch[2])) {
          embedUrl = `https://drive.google.com/file/d/${driveMatch[1] || driveMatch[2]}/preview`;
        }
      }
    }

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
    return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  }

  // 2. Google Drive thumbnail
  const driveMatch = String(url).match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/i);
  if (driveMatch && (driveMatch[1] || driveMatch[2])) {
    return `https://lh3.googleusercontent.com/u/0/d/${driveMatch[1] || driveMatch[2]}`;
  }

  if (typeof item === 'object') {
    if (item.thumbnailUrl) return item.thumbnailUrl;
    if (item.poster) return item.poster;
    if (item.thumbnail) return item.thumbnail;
  }

  return url || fallback;
}
