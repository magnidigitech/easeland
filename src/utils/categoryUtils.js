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
 * Safely extracts the FIRST uploaded image from any property payload.
 * Priority:
 * 1. Approved Thumbnail
 * 2. First photo object/string in photos array
 * 3. First media object/string in media array
 * 4. First image in documents array
 * 5. Distinct Category Fallback Image
 */
export function getFirstUploadedImage(property) {
  if (!property) {
    return getCategoryFallbackImage(null);
  }

  // 1. Direct approved thumbnail / image property
  if (typeof property.approvedThumbnail === 'string' && property.approvedThumbnail.trim()) {
    return property.approvedThumbnail.trim();
  }
  if (typeof property.image === 'string' && property.image.trim()) {
    return property.image.trim();
  }

  // 2. Photos array (Check all items for valid URL/string)
  if (Array.isArray(property.photos) && property.photos.length > 0) {
    for (const p of property.photos) {
      if (!p) continue;
      if (typeof p === 'string' && p.trim()) return p.trim();
      if (typeof p === 'object') {
        const u = p.publicUrl || p.url || p.fileUrl || p.path;
        if (u && typeof u === 'string' && u.trim()) return u.trim();
      }
    }
  }

  // 3. Media array (Check all items for valid URL/string)
  if (Array.isArray(property.media) && property.media.length > 0) {
    for (const m of property.media) {
      if (!m) continue;
      if (typeof m === 'string' && m.trim()) return m.trim();
      if (typeof m === 'object') {
        const u = m.publicUrl || m.url || m.fileUrl || m.path;
        if (u && typeof u === 'string' && u.trim()) return u.trim();
      }
    }
  }

  // 4. Documents / PropertyDocuments array
  const docs = Array.isArray(property.documents)
    ? property.documents
    : (Array.isArray(property.propertyDocuments) ? property.propertyDocuments : []);
  for (const d of docs) {
    if (!d) continue;
    if (typeof d === 'string' && d.trim() && /\.(jpg|jpeg|png|webp|svg)/i.test(d)) return d.trim();
    if (typeof d === 'object') {
      const u = d.publicUrl || d.url || d.fileUrl || d.path;
      if (u && typeof u === 'string' && /\.(jpg|jpeg|png|webp|svg)/i.test(u)) return u.trim();
    }
  }

  // 5. Distinct Category Fallback
  return getCategoryFallbackImage(property);
}
