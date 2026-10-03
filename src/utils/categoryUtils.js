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
