/**
 * EaseLand Deterministic Natural Language Search Parser (Block 16)
 * Translates supported user intent into canonical search state without external AI dependencies.
 * Converts Indian currency (lakhs, crores), BHK bedrooms, property types, purpose, and radius/near intent.
 */

import { Purpose, PropertyType } from './schema.js';

/**
 * Parse an Indian currency text string e.g. "1.5 crore", "50 lakhs", "20 lac", "50k" into numeric INR.
 */
export function parseIndianPriceToNumber(amountStr, unitStr) {
  const num = parseFloat(amountStr);
  if (isNaN(num)) return null;

  const unit = unitStr.toLowerCase().trim();
  if (unit.startsWith('cr') || unit.startsWith('crore')) {
    return Math.round(num * 10000000);
  }
  if (unit.startsWith('lakh') || unit.startsWith('lac') || unit === 'l') {
    return Math.round(num * 100000);
  }
  if (unit === 'k' || unit.startsWith('thousand')) {
    return Math.round(num * 1000);
  }

  return Math.round(num);
}

/**
 * Main Deterministic Natural-Language Query Parser
 */
export function parseNaturalLanguageQuery(queryString = '') {
  if (!queryString || typeof queryString !== 'string') {
    return {
      query: '',
      purpose: 'ALL',
      propertyType: 'ALL',
      bedrooms: 'ANY',
      minPrice: '',
      maxPrice: '',
      locationQuery: '',
      referencePlace: '',
      radiusKm: null
    };
  }

  let text = queryString.trim().toLowerCase();

  let purpose = 'ALL';
  let propertyType = 'ALL';
  let bedrooms = 'ANY';
  let minPrice = '';
  let maxPrice = '';
  let referencePlace = '';
  let radiusKm = null;

  // 1. Transaction Purpose Intent
  if (/\b(for rent|to rent|renting|rental|lease)\b/.test(text)) {
    purpose = Purpose.RENT;
    text = text.replace(/\b(for rent|to rent|renting|rental|lease)\b/g, '');
  } else if (/\b(for sale|to buy|buying|buy|purchase|sale)\b/.test(text)) {
    purpose = Purpose.SALE;
    text = text.replace(/\b(for sale|to buy|buying|buy|purchase|sale)\b/g, '');
  }

  // 2. BHK Bedroom Intent
  const bhkMatch = text.match(/\b([1-4])\s*(?:\+)?\s*(?:bhk|bedroom|bedrooms)\b/);
  if (bhkMatch) {
    const num = parseInt(bhkMatch[1], 10);
    if (num >= 4 || text.includes('4+') || text.includes('4 +')) {
      bedrooms = '4+';
    } else {
      bedrooms = num;
    }
    text = text.replace(bhkMatch[0], '');
  }

  // 3. Property Type Intent
  if (/\b(open plot|plot|plots|layout plot)\b/.test(text)) {
    propertyType = PropertyType.OPEN_PLOT;
    text = text.replace(/\b(open plot|plot|plots|layout plot)\b/g, '');
  } else if (/\b(villa|villas|duplex villa)\b/.test(text)) {
    propertyType = PropertyType.VILLA;
    text = text.replace(/\b(villa|villas|duplex villa)\b/g, '');
  } else if (/\b(apartment|apartments|flat|flats)\b/.test(text)) {
    propertyType = PropertyType.APARTMENT;
    text = text.replace(/\b(apartment|apartments|flat|flats)\b/g, '');
  } else if (/\b(house|houses|home|independent house)\b/.test(text)) {
    propertyType = PropertyType.HOUSE;
    text = text.replace(/\b(house|houses|home|independent house)\b/g, '');
  } else if (/\b(commercial|shop|office|godown|warehouse)\b/.test(text)) {
    propertyType = PropertyType.COMMERCIAL;
    text = text.replace(/\b(commercial|shop|office|godown|warehouse)\b/g, '');
  } else if (/\b(land|agricultural land|farm land)\b/.test(text)) {
    propertyType = PropertyType.LAND;
    text = text.replace(/\b(land|agricultural land|farm land)\b/g, '');
  }

  // 4. Radius / Distance Intent e.g. "within 5 km of Vijayawada Airport"
  const radiusMatch = text.match(/\bwithin\s*(\d+(?:\.\d+)?)\s*(?:km|kilometer|kilometers)\s*(?:of|from)?\s*([^,]+)/);
  if (radiusMatch) {
    radiusKm = parseFloat(radiusMatch[1]);
    referencePlace = radiusMatch[2].trim();
    text = text.replace(radiusMatch[0], '');
  }

  // 5. Near Landmark Intent e.g. "near Inner Ring Road"
  const nearMatch = text.match(/\bnear\s*([^,]+)/);
  if (nearMatch && !referencePlace) {
    referencePlace = nearMatch[1].trim();
    text = text.replace(nearMatch[0], '');
  }

  // 6. Price Range / Max Price / Min Price Parsing
  // Range: "between 20 and 40 lakhs" / "20 to 40 lakhs"
  const rangeMatch = text.match(/\b(?:between|from)?\s*(\d+(?:\.\d+)?)\s*(?:and|to|-)\s*(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr)\b/);
  if (rangeMatch) {
    minPrice = parseIndianPriceToNumber(rangeMatch[1], rangeMatch[3]);
    maxPrice = parseIndianPriceToNumber(rangeMatch[2], rangeMatch[3]);
    text = text.replace(rangeMatch[0], '');
  } else {
    // Max price: "under 1.5 crore", "below 50 lakhs", "max 40l"
    const maxMatch = text.match(/\b(?:under|below|max|upto|within)\s*(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|l|k|thousand)\b/);
    if (maxMatch) {
      maxPrice = parseIndianPriceToNumber(maxMatch[1], maxMatch[2]);
      text = text.replace(maxMatch[0], '');
    }

    // Min price: "above 1 crore", "min 50 lakhs", "starting 20l"
    const minMatch = text.match(/\b(?:above|over|min|starting)\s*(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|l|k|thousand)\b/);
    if (minMatch) {
      minPrice = parseIndianPriceToNumber(minMatch[1], minMatch[2]);
      text = text.replace(minMatch[0], '');
    }
  }

  // Clean remaining text as location / keyword query
  const locationQuery = text
    .replace(/\b(in|at|near|around|of)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    originalQuery: queryString,
    query: locationQuery || queryString,
    purpose,
    propertyType,
    bedrooms,
    minPrice: minPrice || '',
    maxPrice: maxPrice || '',
    locationQuery,
    referencePlace,
    radiusKm
  };
}
