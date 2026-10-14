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
 * List of common real estate stopwords and non-locational filler terms
 */
export const REAL_ESTATE_STOPWORDS = new Set([
  'property', 'properties', 'realestate', 'real', 'estate', 'listing', 'listings', 'space', 'spaces',
  'project', 'projects', 'site', 'sites', 'layout', 'layouts', 'venture', 'ventures',
  'verified', 'platform', 'direct', 'owner', 'affordable', 'cheap', 'budget', 'luxury', 'premium',
  'best', 'good', 'top', 'new', 'latest', 'urgent', 'available', 'immediate',
  'under', 'below', 'above', 'over', 'upto', 'up', 'to', 'max', 'min', 'starting', 'starts', 'less', 'more', 'than',
  'price', 'cost', 'rs', 'inr', 'rupees', 'lakhs', 'lakh', 'lacs', 'lac', 'crores', 'crore', 'cr', 'thousand', 'k',
  'buy', 'buying', 'sale', 'sell', 'purchase', 'rent', 'renting', 'rental', 'lease',
  'bhk', 'bedroom', 'bedrooms',
  'in', 'at', 'near', 'around', 'of', 'for', 'from', 'between', 'and', 'with', 'within', 'by', 'on', 'the', 'a', 'an', 'is', 'all', 'any'
]);

/**
 * Main Deterministic Natural-Language Query Parser
 */
export function parseNaturalLanguageQuery(queryString = '') {
  if (!queryString || typeof queryString !== 'string') {
    return {
      originalQuery: '',
      query: '',
      purpose: 'ALL',
      propertyType: 'ALL',
      bedrooms: 'ANY',
      minPrice: '',
      maxPrice: '',
      locationQuery: '',
      cleanKeywords: '',
      isLocationSpecific: false,
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
  if (/\b(for rent|to rent|renting|rental|lease|for lease)\b/.test(text)) {
    purpose = Purpose.RENT;
    text = text.replace(/\b(for rent|to rent|renting|rental|lease|for lease)\b/g, ' ');
  } else if (/\b(for sale|to buy|buying|buy|purchase|sale)\b/.test(text)) {
    purpose = Purpose.SALE;
    text = text.replace(/\b(for sale|to buy|buying|buy|purchase|sale)\b/g, ' ');
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
    text = text.replace(bhkMatch[0], ' ');
  }

  // 3. Property Type Intent
  if (/\b(amaravathi lps|amaravati lps|lps plot|lps plots)\b/.test(text)) {
    propertyType = PropertyType.OPEN_PLOT;
    text = text.replace(/\b(amaravathi lps|amaravati lps|lps plot|lps plots)\b/g, ' ');
  } else if (/\b(open plot|open plots|plots?|layout plots?|ventures?)\b/.test(text)) {
    propertyType = PropertyType.OPEN_PLOT;
    text = text.replace(/\b(open plot|open plots|plots?|layout plots?|ventures?)\b/g, ' ');
  } else if (/\b(villas?|duplex villas?)\b/.test(text)) {
    propertyType = PropertyType.VILLA;
    text = text.replace(/\b(villas?|duplex villas?)\b/g, ' ');
  } else if (/\b(apartments?|flats?)\b/.test(text)) {
    propertyType = PropertyType.APARTMENT;
    text = text.replace(/\b(apartments?|flats?)\b/g, ' ');
  } else if (/\b(independent houses?|independent house\/villa|houses?|homes?)\b/.test(text)) {
    propertyType = PropertyType.HOUSE;
    text = text.replace(/\b(independent houses?|independent house\/villa|houses?|homes?)\b/g, ' ');
  } else if (/\b(commercial|commerical|shops?|offices?|godown|warehouse)\b/.test(text)) {
    propertyType = PropertyType.COMMERCIAL;
    text = text.replace(/\b(commercial|commerical|shops?|offices?|godown|warehouse)\b/g, ' ');
  } else if (/\b(agricultural lands?|farmlands?|farm lands?|lands?)\b/.test(text)) {
    propertyType = PropertyType.LAND;
    text = text.replace(/\b(agricultural lands?|farmlands?|farm lands?|lands?)\b/g, ' ');
  }

  // 4. Radius / Distance Intent e.g. "within 5 km of Vijayawada Airport"
  const radiusMatch = text.match(/\bwithin\s*(\d+(?:\.\d+)?)\s*(?:km|kilometer|kilometers)\s*(?:of|from)?\s*([^,]+)/);
  if (radiusMatch) {
    radiusKm = parseFloat(radiusMatch[1]);
    referencePlace = radiusMatch[2].trim();
    text = text.replace(radiusMatch[0], ' ');
  }

  // 5. Near Landmark Intent e.g. "near Inner Ring Road"
  const nearMatch = text.match(/\bnear\s*([^,]+)/);
  if (nearMatch && !referencePlace) {
    referencePlace = nearMatch[1].trim();
    text = text.replace(nearMatch[0], ' ');
  }

  // 6. Price Range / Max Price / Min Price Parsing
  // Range: "between 20 and 40 lakhs" / "20 to 40 lakhs" / "20-40 lakhs"
  const rangeMatch = text.match(/\b(?:between|from)?\s*(\d+(?:\.\d+)?)\s*(?:and|to|-)\s*(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr)\b/);
  if (rangeMatch) {
    minPrice = parseIndianPriceToNumber(rangeMatch[1], rangeMatch[3]);
    maxPrice = parseIndianPriceToNumber(rangeMatch[2], rangeMatch[3]);
    text = text.replace(rangeMatch[0], ' ');
  } else {
    // Max price: "under 1.5 crore", "below 50 lakhs", "upto 40l", "max 50 lakhs", "less than 50 lakhs", "budget 50 lakhs"
    const maxMatch = text.match(/\b(?:under|below|max|upto|up to|within|less than|budget)\s*(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|l|k|thousand)\b/);
    if (maxMatch) {
      maxPrice = parseIndianPriceToNumber(maxMatch[1], maxMatch[2]);
      text = text.replace(maxMatch[0], ' ');
    }

    // Min price: "above 1 crore", "min 50 lakhs", "starting 20l", "more than 30 lakhs"
    const minMatch = text.match(/\b(?:above|over|min|starting|more than)\s*(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|l|k|thousand)\b/);
    if (minMatch) {
      minPrice = parseIndianPriceToNumber(minMatch[1], minMatch[2]);
      text = text.replace(minMatch[0], ' ');
    }

    // Direct price mention without under/above: e.g. "properties 50 lakhs", "plots 20 lac"
    if (!maxPrice && !minPrice) {
      const directPriceMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr)\b/);
      if (directPriceMatch) {
        maxPrice = parseIndianPriceToNumber(directPriceMatch[1], directPriceMatch[2]);
        text = text.replace(directPriceMatch[0], ' ');
      }
    }
  }

  // 7. Strip generic real estate stopwords, prepositions, and symbols from leftover text
  const cleanTokens = text
    .split(/[\s,/\-]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0 && !REAL_ESTATE_STOPWORDS.has(t) && !/^\d+$/.test(t));

  const cleanKeywords = cleanTokens.join(' ');
  const locationQuery = cleanKeywords;
  const isLocationSpecific = Boolean(locationQuery && locationQuery.length >= 3);

  return {
    originalQuery: queryString,
    query: queryString.trim(), // PRESERVE full user query so it is never cutoff or truncated
    purpose,
    propertyType,
    bedrooms,
    minPrice: minPrice || '',
    maxPrice: maxPrice || '',
    locationQuery,
    cleanKeywords,
    isLocationSpecific,
    referencePlace,
    radiusKm
  };
}
