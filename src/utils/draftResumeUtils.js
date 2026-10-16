/**
 * Helper to determine the exact step where an owner left off on a draft.
 * Ensures resuming drops the user directly into the unfinished step instead
 * of resetting to Step 1 and forcing an extra click on "Edit Title & Price".
 */
export function determineResumeStep(property) {
  if (!property) return 1;
  const p = property.rawProperty || property;

  // 1. If explicit lastStep >= 2 was stored, use it directly
  const explicitStep = Number(p.lastStep || property.lastStep || p.step || property.step);
  if (explicitStep && explicitStep >= 2 && explicitStep <= 8) {
    return explicitStep;
  }

  // 2. If it is an approved or published LIVE listing without an explicit draft step, start at Step 1
  const isLive = p.status === 'LIVE' || p.status === 'APPROVED' || p.listingStatus === 'LIVE' || p.isPublished || p.isPlatformVerified;
  if (isLive && !explicitStep) {
    return 1;
  }

  // 3. For drafts, infer where the user left off based on completed steps:
  // Step 1: Type & Purpose is guaranteed for any saved draft.
  // Step 2: Title, Price / PricePerUnit, Area, Description
  const hasTitle = Boolean(
    p.title &&
    p.title.trim() !== '' &&
    p.title !== 'Untitled Property Listing' &&
    p.title !== 'Untitled Property'
  );
  const hasPrice = Number(p.price) > 0 || Number(p.pricePerUnit) > 0;
  const hasArea = Number(p.area) > 0;
  const hasDesc = Boolean(p.description && p.description.trim().length >= 3);
  const isStep2Complete = hasTitle && hasPrice && hasArea && hasDesc;

  if (!isStep2Complete) {
    return 2;
  }

  // Step 3: Location
  const hasLocation = Boolean(
    p.location &&
    (p.location.geoPoint || p.location.coordinates || p.location.lat || p.location.latitude) &&
    (p.location.confirmed || p.location.address || p.location.locality || p.location.city)
  );
  if (!hasLocation) {
    return 3;
  }

  // Step 4: Specs & Amenities
  const hasSpecs = Boolean(
    (p.specs && Object.keys(p.specs).some(k => k !== 'areaUnit' && Boolean(p.specs[k]))) ||
    (Array.isArray(p.amenities) && p.amenities.length > 0)
  );
  if (!hasSpecs) {
    return 4;
  }

  // Step 5: Media & Photos
  const hasMedia = Boolean(
    (Array.isArray(p.media) && p.media.length > 0) ||
    (Array.isArray(p.photos) && p.photos.length > 0) ||
    p.videoUrl ||
    p.videoLink
  );
  if (!hasMedia) {
    return 5;
  }

  // Step 6: Documents
  const hasDocs = Boolean(Array.isArray(p.documents) && p.documents.length > 0);
  if (!hasDocs) {
    return 6;
  }

  // Step 7: Boundary
  const hasBoundary = Boolean(p.boundary || p.ownerSubmittedBoundary);
  if (!hasBoundary) {
    return 7;
  }

  return 8;
}
