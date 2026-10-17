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

  const pending = property.pendingReauditData || property.pendingEdits || null;
  const isReaudit = Boolean((property.hasPendingEdits || pending) && pending);

  if (!isReaudit || !pending) {
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
  const extractPhotoUrls = (item) => {
    const raw = [
      ...(Array.isArray(item?.photos) ? item.photos : []),
      ...(Array.isArray(item?.media) ? item.media : []),
      ...(Array.isArray(item?.images) ? item.images : [])
    ];
    const urls = [];
    raw.forEach(m => {
      let u = '';
      if (typeof m === 'string') u = m.trim();
      else if (typeof m === 'object' && m) u = (m.url || m.publicUrl || m.path || '').trim();
      if (u && !urls.includes(u)) urls.push(u);
    });
    return urls;
  };

  const livePhotos = extractPhotoUrls(property);
  const pendingPhotos = extractPhotoUrls(pending);
  const newPhotos = pendingPhotos.filter(u => !livePhotos.includes(u));

  if (newPhotos.length > 0) {
    changedKeys.add('photos');
    diffs.photos = {
      changed: true,
      liveCount: livePhotos.length,
      proposedCount: pendingPhotos.length,
      newCount: newPhotos.length,
      newPhotos
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
  const extractDocKeys = (item) => {
    const raw = [
      ...(Array.isArray(item?.documents) ? item.documents : []),
      ...(Array.isArray(item?.propertyDocuments) ? item.propertyDocuments : [])
    ];
    const keys = [];
    raw.forEach(d => {
      let k = '';
      if (typeof d === 'string') k = d.trim();
      else if (typeof d === 'object' && d) k = (d.url || d.name || d.docId || '').trim();
      if (k && !keys.includes(k)) keys.push(k);
    });
    return keys;
  };

  const liveDocs = extractDocKeys(property);
  const pendingDocs = extractDocKeys(pending);
  const newDocs = pendingDocs.filter(k => !liveDocs.includes(k));

  if (newDocs.length > 0) {
    changedKeys.add('documents');
    diffs.documents = {
      changed: true,
      liveCount: liveDocs.length,
      proposedCount: pendingDocs.length,
      newCount: newDocs.length,
      newDocs
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
