import { extractCoordinates, extractBoundaryPolygon } from '../services/locationProvider.js';
import { calculateApproximatePolygonAreaSqFt } from '../firebase/boundaryService.js';

/**
 * Format currency in Indian Rupees without using dollar signs
 */
export function formatInr(val) {
  if (val === undefined || val === null || val === '') return 'Price on Request';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return 'Rs. ' + num.toLocaleString('en-IN');
}

/**
 * Cleanly extract string value
 */
function cleanStr(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return val.name || val.title || val.label || val.value || '';
  return String(val).trim();
}

/**
 * Extract array of amenity names from array or comma-separated string
 */
export function normalizeAmenities(amenities) {
  if (!amenities) return [];
  if (Array.isArray(amenities)) {
    return amenities.map(a => cleanStr(a)).filter(Boolean);
  }
  if (typeof amenities === 'string') {
    return amenities.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Compute exhaustive field-by-field diff between live approved property and proposed re-audit data
 */
export function computeReauditDiff(property) {
  if (!property) {
    return {
      isReaudit: false,
      hasChanges: false,
      changedFieldCount: 0,
      changedKeys: new Set(),
      diffs: {}
    };
  }

  const pending = property.pendingReauditData || property.pendingEdits || {};
  const isReaudit = Boolean(property.hasPendingEdits || property.reAuditStatus === 'PENDING_VERIFICATION' || property.reAuditStatus === 'UNDER_REVIEW' || (pending && Object.keys(pending).length > 0));

  if (!isReaudit) {
    return {
      isReaudit: false,
      hasChanges: false,
      changedFieldCount: 0,
      changedKeys: new Set(),
      diffs: {}
    };
  }

  const changedKeys = new Set();
  const diffs = {};

  // 1. Title
  const liveTitle = cleanStr(property.title);
  const pendingTitle = cleanStr(pending.title);
  if (pendingTitle && pendingTitle !== liveTitle) {
    changedKeys.add('title');
    diffs.title = {
      changed: true,
      live: liveTitle || 'Untitled Property',
      proposed: pendingTitle
    };
  }

  // 2. Price
  const livePriceNum = Number(property.price);
  const pendingPriceNum = pending.price !== undefined ? Number(pending.price) : NaN;
  if (!isNaN(pendingPriceNum) && pendingPriceNum !== livePriceNum) {
    changedKeys.add('price');
    diffs.price = {
      changed: true,
      live: property.price,
      proposed: pending.price,
      liveDisplay: property.priceDisplay || formatInr(property.price),
      proposedDisplay: pending.priceDisplay || formatInr(pending.price)
    };
  }

  // 3. Area & Units
  const liveAreaNum = Number(property.area);
  const pendingAreaNum = pending.area !== undefined ? Number(pending.area) : NaN;
  const liveAreaUnit = cleanStr(property.areaUnit || property.specs?.areaUnit || 'sq ft');
  const pendingAreaUnit = cleanStr(pending.areaUnit || pending.specs?.areaUnit || liveAreaUnit);

  if ((!isNaN(pendingAreaNum) && pendingAreaNum !== liveAreaNum) || (pendingAreaUnit && pendingAreaUnit !== liveAreaUnit)) {
    changedKeys.add('area');
    diffs.area = {
      changed: true,
      live: property.area,
      proposed: !isNaN(pendingAreaNum) ? pending.area : property.area,
      liveUnit: liveAreaUnit,
      proposedUnit: pendingAreaUnit,
      liveDisplay: property.areaDisplay || (property.area + ' ' + liveAreaUnit),
      proposedDisplay: pending.areaDisplay || ((!isNaN(pendingAreaNum) ? pending.area : property.area) + ' ' + pendingAreaUnit)
    };
  }

  // 4. Category & Property Type
  const liveCat = cleanStr(property.category);
  const pendingCat = cleanStr(pending.category);
  if (pendingCat && pendingCat !== liveCat) {
    changedKeys.add('category');
    diffs.category = { changed: true, live: liveCat, proposed: pendingCat };
  }

  const liveType = cleanStr(property.propertyType);
  const pendingType = cleanStr(pending.propertyType);
  if (pendingType && pendingType !== liveType) {
    changedKeys.add('propertyType');
    diffs.propertyType = { changed: true, live: liveType, proposed: pendingType };
  }

  // 5. Purpose / Intent / Transaction Type
  const liveIntent = cleanStr(property.transactionType || property.intent || property.purpose || 'FOR SALE');
  const pendingIntent = cleanStr(pending.transactionType || pending.intent || pending.purpose);
  if (pendingIntent && pendingIntent !== liveIntent) {
    changedKeys.add('intent');
    diffs.intent = { changed: true, live: liveIntent, proposed: pendingIntent };
  }

  // 6. Facing & Dimensions
  const liveFacing = cleanStr(property.facing || property.specs?.facing);
  const pendingFacing = cleanStr(pending.facing || pending.specs?.facing);
  if (pendingFacing && pendingFacing !== liveFacing) {
    changedKeys.add('facing');
    diffs.facing = { changed: true, live: liveFacing, proposed: pendingFacing };
  }

  const liveDimensions = cleanStr(property.dimensions || property.specs?.dimensions);
  const pendingDimensions = cleanStr(pending.dimensions || pending.specs?.dimensions);
  if (pendingDimensions && pendingDimensions !== liveDimensions) {
    changedKeys.add('dimensions');
    diffs.dimensions = { changed: true, live: liveDimensions, proposed: pendingDimensions };
  }

  // 7. Survey & LP Numbers
  const liveSurvey = cleanStr(property.location?.surveyNo || property.surveyNo);
  const pendingSurvey = cleanStr(pending.location?.surveyNo || pending.surveyNo);
  if (pendingSurvey && pendingSurvey !== liveSurvey) {
    changedKeys.add('surveyNo');
    diffs.surveyNo = { changed: true, live: liveSurvey || 'N/A', proposed: pendingSurvey };
  }

  const liveLp = cleanStr(property.location?.lpNo || property.lpNo);
  const pendingLp = cleanStr(pending.location?.lpNo || pending.lpNo);
  if (pendingLp && pendingLp !== liveLp) {
    changedKeys.add('lpNo');
    diffs.lpNo = { changed: true, live: liveLp || 'N/A', proposed: pendingLp };
  }

  // 8. Furnishing & Specs
  const liveFurnishing = cleanStr(property.specs?.furnishing || property.furnishing);
  const pendingFurnishing = cleanStr(pending.specs?.furnishing || pending.furnishing);
  if (pendingFurnishing && pendingFurnishing !== liveFurnishing) {
    changedKeys.add('furnishing');
    diffs.furnishing = { changed: true, live: liveFurnishing || 'Not Specified', proposed: pendingFurnishing };
  }

  // 9. Description
  const liveDesc = cleanStr(property.description);
  const pendingDesc = cleanStr(pending.description);
  if (pendingDesc && pendingDesc !== liveDesc) {
    changedKeys.add('description');
    diffs.description = { changed: true, live: liveDesc, proposed: pendingDesc };
  }

  // 10. Amenities
  const liveAmenities = normalizeAmenities(property.amenities);
  const pendingAmenities = normalizeAmenities(pending.amenities);
  if (pending.amenities !== undefined) {
    const liveSet = new Set(liveAmenities.map(a => a.toLowerCase()));
    const pendingSet = new Set(pendingAmenities.map(a => a.toLowerCase()));

    const added = pendingAmenities.filter(a => !liveSet.has(a.toLowerCase()));
    const removed = liveAmenities.filter(a => !pendingSet.has(a.toLowerCase()));

    if (added.length > 0 || removed.length > 0) {
      changedKeys.add('amenities');
      diffs.amenities = {
        changed: true,
        live: liveAmenities,
        proposed: pendingAmenities,
        added,
        removed
      };
    }
  }

  // 11. Location & Address & Pin Coordinates
  const liveLoc = property.location || {};
  const pendingLoc = pending.location || {};

  const liveAddress = cleanStr(liveLoc.address || property.address);
  const pendingAddress = cleanStr(pendingLoc.address || pending.address);

  const liveCoords = extractCoordinates(property);
  const pendingCoords = extractCoordinates(pending);

  const addressDiff = Boolean(pendingAddress && pendingAddress !== liveAddress);
  const coordsDiff = Boolean(
    !isNaN(pendingCoords.lat) &&
    !isNaN(pendingCoords.lng) &&
    (isNaN(liveCoords.lat) ||
      Math.abs(pendingCoords.lat - liveCoords.lat) > 0.0001 ||
      Math.abs(pendingCoords.lng - liveCoords.lng) > 0.0001)
  );

  const localityDiff = Boolean(cleanStr(pendingLoc.locality) && cleanStr(pendingLoc.locality) !== cleanStr(liveLoc.locality));
  const cityDiff = Boolean(cleanStr(pendingLoc.city) && cleanStr(pendingLoc.city) !== cleanStr(liveLoc.city));
  const districtDiff = Boolean(cleanStr(pendingLoc.district) && cleanStr(pendingLoc.district) !== cleanStr(liveLoc.district));
  const stateDiff = Boolean(cleanStr(pendingLoc.state) && cleanStr(pendingLoc.state) !== cleanStr(liveLoc.state));
  const pincodeDiff = Boolean(cleanStr(pendingLoc.pincode) && cleanStr(pendingLoc.pincode) !== cleanStr(liveLoc.pincode));

  if (addressDiff || coordsDiff || localityDiff || cityDiff || districtDiff || stateDiff || pincodeDiff) {
    changedKeys.add('location');
    diffs.location = {
      changed: true,
      addressDiff,
      coordsDiff,
      liveAddress: liveAddress || 'Address not set',
      proposedAddress: pendingAddress || liveAddress,
      liveCoords,
      proposedCoords: !isNaN(pendingCoords.lat) ? pendingCoords : liveCoords,
      liveLoc,
      proposedLoc: pendingLoc
    };
  }

  // 12. Boundary Polygon
  const livePoly = extractBoundaryPolygon(property);
  const pendingPoly = extractBoundaryPolygon(pending);

  let boundaryDiff = false;
  if (pendingPoly.length > 0) {
    if (livePoly.length !== pendingPoly.length) {
      boundaryDiff = true;
    } else {
      for (let i = 0; i < pendingPoly.length; i++) {
        if (
          Math.abs(pendingPoly[i][0] - livePoly[i][0]) > 0.00005 ||
          Math.abs(pendingPoly[i][1] - livePoly[i][1]) > 0.00005
        ) {
          boundaryDiff = true;
          break;
        }
      }
    }
  }

  if (boundaryDiff) {
    changedKeys.add('boundary');
    const liveVertices = livePoly.map(pt => ({ lat: pt[0], lng: pt[1] }));
    const proposedVertices = pendingPoly.map(pt => ({ lat: pt[0], lng: pt[1] }));
    const liveArea = calculateApproximatePolygonAreaSqFt(liveVertices);
    const proposedArea = calculateApproximatePolygonAreaSqFt(proposedVertices);

    diffs.boundary = {
      changed: true,
      livePoly,
      proposedPoly: pendingPoly,
      liveVertexCount: livePoly.length,
      proposedVertexCount: pendingPoly.length,
      liveAreaSqFt: liveArea,
      proposedAreaSqFt: proposedArea,
      areaDeltaSqFt: proposedArea - liveArea
    };
  }

  // 13. Photos / Media
  const extractPhotoItems = (item) => {
    if (!item) return [];
    const raw = [
      ...(Array.isArray(item.photos) ? item.photos : []),
      ...(Array.isArray(item.media) ? item.media : []),
      ...(Array.isArray(item.images) ? item.images : [])
    ];
    const items = [];
    const seen = new Set();
    raw.forEach(m => {
      if (!m) return;
      if (typeof m === 'object') {
        const typeUpper = String(m.type || m.mediaType || m.documentType || '').toUpperCase();
        if (typeUpper.includes('VIDEO')) return;
        if (typeUpper.includes('DOCUMENT') || typeUpper.includes('DEED') || m.isDocument === true || m.docId) return;
        const u = cleanStr(m.publicUrl || m.url || m.mediaUrl || m.storagePath);
        if (!u) return;
        const low = u.toLowerCase();
        if (low.includes('youtube.com') || low.includes('youtu.be') || low.includes('drive.google.com') ||
            low.endsWith('.mp4') || low.endsWith('.webm') || low.endsWith('.mov') || low.endsWith('.avi') ||
            low.endsWith('.pdf') || low.endsWith('.doc') || low.endsWith('.docx')) {
          return;
        }
        if (!seen.has(low)) {
          seen.add(low);
          items.push({
            url: u,
            uploadedAt: m.uploadedAt ? new Date(m.uploadedAt).getTime() : 0,
            verificationStatus: m.verificationStatus
          });
        }
      } else if (typeof m === 'string') {
        const u = m.trim();
        const low = u.toLowerCase();
        if (low.includes('youtube.com') || low.includes('youtu.be') || low.includes('drive.google.com') ||
            low.endsWith('.mp4') || low.endsWith('.webm') || low.endsWith('.mov') || low.endsWith('.avi') ||
            low.endsWith('.pdf') || low.endsWith('.doc') || low.endsWith('.docx')) {
          return;
        }
        if (u && !seen.has(low)) {
          seen.add(low);
          items.push({ url: u, uploadedAt: 0, verificationStatus: null });
        }
      }
    });
    return items;
  };

  const livePhotoItems = extractPhotoItems(property);
  const pendingPhotoItems = pending ? extractPhotoItems(pending) : [];

  const livePhotoUrls = new Set(livePhotoItems.map(p => p.url.toLowerCase()));
  let newPhotoUrls = pendingPhotoItems.map(p => p.url).filter(u => !livePhotoUrls.has(u.toLowerCase()));

  // Fallback: If pendingPhotos and livePhotos both contain the new photos (e.g. state already synced into property),
  // identify photos uploaded during the re-audit edit session
  if (newPhotoUrls.length === 0 && property.reAuditRequestedAt) {
    const reAuditTime = new Date(property.reAuditRequestedAt).getTime();
    const editSessionStart = reAuditTime - (60 * 60 * 1000);
    const sessionPhotos = livePhotoItems.filter(p => p.uploadedAt >= editSessionStart);
    if (sessionPhotos.length > 0 && sessionPhotos.length < livePhotoItems.length) {
      newPhotoUrls = sessionPhotos.map(p => p.url);
    }
  }

  const pendingPhotoUrls = new Set(pendingPhotoItems.map(p => p.url.toLowerCase()));
  const removedPhotoUrls = pendingPhotoItems.length > 0 ? livePhotoItems.map(p => p.url).filter(u => !pendingPhotoUrls.has(u.toLowerCase())) : [];

  if (newPhotoUrls.length > 0 || removedPhotoUrls.length > 0) {
    changedKeys.add('photos');
    diffs.photos = {
      changed: true,
      liveCount: livePhotoItems.length,
      proposedCount: Math.max(pendingPhotoItems.length, livePhotoItems.length),
      newCount: newPhotoUrls.length,
      newPhotos: newPhotoUrls,
      removedCount: removedPhotoUrls.length,
      removedPhotos: removedPhotoUrls
    };
  }

  // 14. Videos
  const liveVideo = cleanStr(property.videoUrl || property.videoLink || property.embeddedVideoUrl);
  const pendingVideo = cleanStr(pending.videoUrl || pending.videoLink || pending.embeddedVideoUrl);
  if (pendingVideo && pendingVideo !== liveVideo) {
    changedKeys.add('videos');
    diffs.videos = {
      changed: true,
      live: liveVideo,
      proposed: pendingVideo
    };
  }

  // 15. Documents
  const extractDocItems = (item) => {
    if (!item) return [];
    const raw = [
      ...(Array.isArray(item.documents) ? item.documents : []),
      ...(Array.isArray(item.propertyDocuments) ? item.propertyDocuments : []),
      ...(Array.isArray(item.confidentialDocuments) ? item.confidentialDocuments : [])
    ];
    const items = [];
    const seen = new Set();
    raw.forEach(d => {
      if (!d) return;
      let k = '';
      let url = '';
      let name = '';
      if (typeof d === 'string') {
        k = d.trim().toLowerCase();
        url = d.trim();
        name = d.trim();
      } else if (typeof d === 'object') {
        url = cleanStr(d.url || d.publicUrl || d.path);
        name = cleanStr(d.name || d.fileName || d.documentName || d.title);
        k = (url || name || d.docId || '').toLowerCase();
      }
      if (k && !seen.has(k)) {
        seen.add(k);
        items.push({ key: k, url, name, uploadedAt: d.uploadedAt ? new Date(d.uploadedAt).getTime() : 0 });
      }
    });
    return items;
  };

  const liveDocItems = extractDocItems(property);
  const pendingDocItems = pending ? extractDocItems(pending) : [];
  const liveDocKeys = new Set(liveDocItems.map(d => d.key));
  let newDocs = pendingDocItems.filter(d => !liveDocKeys.has(d.key));

  if (newDocs.length === 0 && property.reAuditRequestedAt) {
    const reAuditTime = new Date(property.reAuditRequestedAt).getTime();
    const editSessionStart = reAuditTime - (60 * 60 * 1000);
    const sessionDocs = liveDocItems.filter(d => d.uploadedAt >= editSessionStart);
    if (sessionDocs.length > 0 && sessionDocs.length < liveDocItems.length) {
      newDocs = sessionDocs;
    }
  }

  if (newDocs.length > 0) {
    changedKeys.add('documents');
    diffs.documents = {
      changed: true,
      liveCount: liveDocItems.length,
      proposedCount: Math.max(pendingDocItems.length, liveDocItems.length),
      newCount: newDocs.length,
      newDocs: newDocs.map(d => d.name || d.url || d.key)
    };
  }

  return {
    isReaudit,
    hasChanges: changedKeys.size > 0,
    changedFieldCount: changedKeys.size,
    changedKeys,
    diffs
  };
}
