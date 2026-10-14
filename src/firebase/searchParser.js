/**
 * EaseLand Dynamic Natural Language Processing (NLP) Search Engine (Block 16 NLP)
 * Translates casual and conversational human queries into structured search intent,
 * named entities (NER), numeric currency ranges, dimensional areas, and spatial constraints.
 * 
 * Capable of dynamically understanding:
 * - Conversational phrasing ("looking for a cheap 3 bedroom flat near perecherla below 50 lakhs")
 * - Question-style queries ("can i get agricultural land under 50 lakhs in guntur")
 * - Word numbers ("two bedroom apartment in vidyanagar", "three bhk")
 * - Indian currency units (k, thousand, lakh, lacs, crore, cr, koti)
 * - Directional / Vastu constraints ("east facing", "north facing")
 * - Spatial proximity ("within 5 km of airport", "near inner ring road")
 * - Sentiment & budget modifiers ("cheap", "affordable", "luxury", "budget", "premium")
 */

import { Purpose, PropertyType } from './schema.js';

// -------------------------------------------------------------
// 1. NLP DICTIONARIES, SYNONYMS & KNOWLEDGE GRAPH
// -------------------------------------------------------------

export const WORD_TO_NUMBER = {
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
  'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'single': 1, 'double': 2, 'triple': 3, 'quadruple': 4,
  'half': 0.5, 'quarter': 0.25
};

export const PURPOSE_TAXONOMY = {
  RENT: [
    'for rent', 'for lease', 'to rent', 'to lease', 'to let', 'tolet',
    'monthly stay', 'paying guest', 'rental', 'renting', 'leasing', 'lease',
    'rent', 'tenant', 'tenants', 'pg'
  ],
  SALE: [
    'ready to move', 'for sale', 'to buy', 'to purchase',
    'buying', 'purchasing', 'selling', 'purchase', 'resale', 'sale', 'sell',
    'investment', 'investing', 'invest', 'ownership', 'booking', 'possession', 'own', 'buy'
  ]
};

export const PROPERTY_TYPE_TAXONOMY = {
  [PropertyType.VILLA]: [
    'luxury duplex villas', 'luxury duplex villa', 'duplex villas', 'duplex villa',
    'triplex villas', 'triplex villa', 'gated villas', 'gated villa',
    'luxury villas', 'luxury villa', 'independent villas', 'independent villa',
    'golf villas', 'golf villa', 'villas', 'villa'
  ],
  [PropertyType.OPEN_PLOT]: [
    'crda approved plots', 'crda approved plot', 'crda plots', 'crda plot', 'crda approved',
    'amaravathi lps', 'amaravati lps', 'lps plots', 'lps plot', 'lp plots', 'lp plot',
    'residential plots', 'residential plot', 'commercial plots', 'commercial plot',
    'gated ventures', 'gated venture', 'layout plots', 'layout plot',
    'open plots', 'open plot', 'corner plots', 'corner plot', 'corner bit',
    'ventures', 'venture', 'layouts', 'layout', 'sites', 'site', 'plots', 'plot'
  ],
  [PropertyType.LAND]: [
    'agricultural lands', 'agricultural land', 'agricultural farmlands', 'agricultural farmland',
    'agriculture lands', 'agriculture land', 'agri lands', 'agri land',
    'farm lands', 'farm land', 'farmlands', 'farmland',
    'fertile lands', 'fertile land', 'raw lands', 'raw land', 'rural lands', 'rural land',
    'agricultural', 'agriculture', 'agri', 'farms', 'farm', 'acreage',
    'cultivation', 'plantation', 'fertile', 'lands', 'land'
  ],
  [PropertyType.APARTMENT]: [
    'residential towers', 'residential tower', 'multistorey apartments', 'multistorey apartment',
    'highrise apartments', 'highrise apartment', 'society flats', 'society flat',
    'apartments', 'apartment', 'penthouses', 'penthouse', 'condominiums', 'condominium',
    'condos', 'condo', 'studios', 'studio', 'flats', 'flat', 'bhk', 'floors', 'floor'
  ],
  [PropertyType.HOUSE]: [
    'independent houses', 'independent house', 'individual houses', 'individual house',
    'residential houses', 'residential house', 'duplex houses', 'duplex house',
    'triplex houses', 'triplex house', 'row houses', 'row house',
    'bungalows', 'bungalow', 'kothis', 'kothi', 'duplex', 'triplex',
    'houses', 'house', 'homes', 'home'
  ],
  [PropertyType.COMMERCIAL]: [
    'commercial buildings', 'commercial building', 'commercial spaces', 'commercial space',
    'business spaces', 'business space', 'retail spaces', 'retail space',
    'commercial showrooms', 'commercial showroom', 'commercial shops', 'commercial shop',
    'commercial offices', 'commercial office', 'commercial', 'commerical',
    'showrooms', 'showroom', 'warehouses', 'warehouse', 'godowns', 'godown',
    'offices', 'office', 'shops', 'shop', 'retails', 'retail', 'malls', 'mall'
  ]
};

export const SYNONYM_MAP = {
  'flat': ['flat', 'flats', 'apartment', 'apartments', 'bhk', 'condo'],
  'flats': ['flat', 'flats', 'apartment', 'apartments', 'bhk', 'condo'],
  'apartment': ['apartment', 'apartments', 'flat', 'flats', 'bhk', 'condo', 'society'],
  'apartments': ['apartment', 'apartments', 'flat', 'flats', 'bhk', 'condo', 'society'],
  'plot': ['plot', 'plots', 'site', 'sites', 'land', 'layout', 'venture', 'lps', 'crda'],
  'plots': ['plot', 'plots', 'site', 'sites', 'land', 'layout', 'venture', 'lps', 'crda'],
  'land': ['land', 'lands', 'farmland', 'farmlands', 'farm', 'agricultural', 'agriculture', 'plot'],
  'lands': ['land', 'lands', 'farmland', 'farmlands', 'farm', 'agricultural', 'agriculture', 'plot'],
  'agriculture': ['agriculture', 'agricultural', 'agri', 'farm', 'farmland', 'land'],
  'agricultural': ['agricultural', 'agriculture', 'agri', 'farm', 'farmland', 'land'],
  'farm': ['farm', 'farmland', 'agricultural', 'agriculture', 'land'],
  'farmland': ['farmland', 'farm', 'agricultural', 'agriculture', 'land'],
  'house': ['house', 'houses', 'home', 'homes', 'villa', 'independent house', 'duplex', 'bungalow'],
  'villa': ['villa', 'villas', 'luxury villa', 'independent house', 'house', 'duplex'],
  'villas': ['villa', 'villas', 'luxury villa', 'independent house', 'house', 'duplex'],
  'commercial': ['commercial', 'shop', 'office', 'showroom', 'warehouse', 'godown'],
  'office': ['office', 'offices', 'commercial', 'commercial space', 'business space'],
  'shop': ['shop', 'shops', 'retail', 'commercial', 'showroom'],
  'perecherla': ['perecherla', 'perecharla', 'perecharla junction', 'perecherla road'],
  'vidyanagar': ['vidyanagar', 'vidya nagar'],
  'autonagar': ['autonagar', 'auto nagar'],
  'amaravathi': ['amaravathi', 'amaravati', 'capital region']
};

export const REAL_ESTATE_STOPWORDS = new Set([
  // Filler & conversational question words
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'want', 'wants', 'wanted', 'need', 'needs', 'needed',
  'look', 'looking', 'looks', 'search', 'searching', 'find', 'finding', 'show', 'give',
  'get', 'can', 'could', 'would', 'should', 'please', 'tell', 'about', 'some', 'any',
  'all', 'a', 'an', 'the', 'and', 'or', 'with', 'without', 'for', 'of', 'at', 'by',
  'from', 'to', 'in', 'on', 'into', 'onto', 'there', 'here', 'where', 'which', 'what',
  'who', 'how', 'when', 'why', 'available', 'availability',

  // Real estate generic filler words
  'property', 'properties', 'realestate', 'real', 'estate', 'listing', 'listings',
  'space', 'spaces', 'place', 'places', 'deal', 'deals', 'option', 'options',
  'project', 'projects', 'site', 'sites', 'layout', 'layouts', 'venture', 'ventures',
  'verified', 'platform', 'direct', 'owner', 'good', 'best', 'top', 'new', 'latest',
  'urgent', 'immediate',

  // Sentiment, budget & architectural modifiers (not locations)
  'cheap', 'affordable', 'budget', 'luxury', 'premium', 'posh', 'ultra', 'high', 'end',
  'duplex', 'triplex', 'independent', 'individual', 'gated', 'corner', 'vastu', 'vaastu',
  'facing', 'ready', 'move', 'construction', 'resale', 'furnished', 'unfurnished',
  'semi', 'semifurnished', 'spacious', 'prime',

  // Currency & numeric stop terms (handled dynamically by entity extractors)
  'price', 'cost', 'rate', 'rs', 'inr', 'rupees', 'rupee', 'lakhs', 'lakh',
  'lacs', 'lac', 'crores', 'crore', 'cr', 'crs', 'thousand', 'thousands', 'k', 'koti',
  'under', 'below', 'above', 'over', 'upto', 'up', 'less', 'more', 'than', 'between',
  'max', 'maximum', 'min', 'minimum',

  // Unit terms
  'bhk', 'bedroom', 'bedrooms', 'bed', 'beds', 'room', 'rooms'
]);

// -------------------------------------------------------------
// 2. DYNAMIC CURRENCY & NUMBER PARSING
// -------------------------------------------------------------

/**
 * Parses numeric currency tokens in Indian denomination (lakhs, crores, thousands, k)
 */
export function parseIndianPriceToNumber(amountStr, unitStr) {
  if (!amountStr) return null;
  const cleanedAmount = String(amountStr).replace(/,/g, '').trim();
  const num = parseFloat(cleanedAmount);
  if (isNaN(num)) return null;

  const unit = String(unitStr || '').toLowerCase().trim();
  if (unit.startsWith('cr') || unit.startsWith('crore') || unit === 'koti') {
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
 * Normalizes word numbers in text (e.g. "three bhk" -> "3 bhk")
 */
function normalizeWordNumbers(text) {
  let normalized = text;
  Object.keys(WORD_TO_NUMBER).forEach(word => {
    const val = WORD_TO_NUMBER[word];
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    normalized = normalized.replace(regex, String(val));
  });
  return normalized;
}

// -------------------------------------------------------------
// 3. INTENT & ENTITY EXTRACTION PIPELINE
// -------------------------------------------------------------

/**
 * Extracts Transaction Intent (SALE vs RENT vs LEASE) with confidence weighting
 */
function extractTransactionIntent(text) {
  let detectedPurpose = 'ALL';
  let matchedSnippet = '';

  // Check RENT taxonomy first (most specific multi-word phrases first)
  for (const trigger of PURPOSE_TAXONOMY.RENT) {
    const regex = new RegExp(`\\b${trigger}\\b`, 'i');
    if (regex.test(text)) {
      detectedPurpose = Purpose.RENT;
      matchedSnippet = trigger;
      break;
    }
  }

  // Check SALE taxonomy if RENT not matched
  if (detectedPurpose === 'ALL') {
    for (const trigger of PURPOSE_TAXONOMY.SALE) {
      const regex = new RegExp(`\\b${trigger}\\b`, 'i');
      if (regex.test(text)) {
        detectedPurpose = Purpose.SALE;
        matchedSnippet = trigger;
        break;
      }
    }
  }

  return {
    purpose: detectedPurpose,
    matchedSnippet
  };
}

/**
 * Extracts Property Type Intent using multi-concept taxonomy matching,
 * prioritizing longer and more specific multi-word phrases.
 */
function extractPropertyTypeIntent(text) {
  let matchedType = 'ALL';
  let matchedSnippet = '';

  // Compile all triggers sorted by specificity (word count desc, then length desc)
  const allTriggers = [];
  for (const [typeKey, triggers] of Object.entries(PROPERTY_TYPE_TAXONOMY)) {
    for (const trigger of triggers) {
      allTriggers.push({
        typeKey,
        trigger,
        weight: trigger.split(/\s+/).length * 100 + trigger.length
      });
    }
  }
  allTriggers.sort((a, b) => b.weight - a.weight);

  for (const item of allTriggers) {
    const regex = new RegExp(`\\b${item.trigger}\\b`, 'i');
    if (regex.test(text)) {
      matchedType = item.typeKey;
      matchedSnippet = item.trigger;
      break; // Found the most specific trigger
    }
  }

  return {
    propertyType: matchedType,
    matchedSnippet
  };
}

/**
 * Extracts Bedroom (BHK) Intent with support for word digits and compound patterns
 */
function extractBedroomIntent(text) {
  let bedrooms = 'ANY';
  let matchedSnippet = '';

  // Patterns like "3 bhk", "3bhk", "3 bedroom", "3 bed", "3 beds", "4+ bhk"
  const bhkMatch = text.match(/\b([1-9])\s*(?:\+)?\s*(?:bhk|bedroom|bedrooms|bed|beds)\b/i);
  if (bhkMatch) {
    const count = parseInt(bhkMatch[1], 10);
    matchedSnippet = bhkMatch[0];
    if (count >= 4 || text.includes('4+') || text.includes('4 +')) {
      bedrooms = '4+';
    } else {
      bedrooms = count;
    }
  }

  return {
    bedrooms,
    matchedSnippet
  };
}

/**
 * Extracts Budget, Currency Range and Bounds (Min Price, Max Price) dynamically
 */
function extractPriceIntent(text) {
  let minPrice = '';
  let maxPrice = '';
  let matchedSnippet = '';

  // 1. Range Intent: "between 20 and 40 lakhs", "20 to 40 lakhs", "20-40 lakhs", "from 1 cr to 2 cr"
  const rangeRegex = /\b(?:between|from)?\s*(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|k|thousand)?\s*(?:to|-|and)\s*(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|k|thousand)\b/i;
  const rangeMatch = text.match(rangeRegex);
  if (rangeMatch) {
    const unit1 = rangeMatch[2] || rangeMatch[4];
    const unit2 = rangeMatch[4];
    minPrice = parseIndianPriceToNumber(rangeMatch[1], unit1);
    maxPrice = parseIndianPriceToNumber(rangeMatch[3], unit2);
    matchedSnippet = rangeMatch[0];
    return { minPrice, maxPrice, matchedSnippet };
  }

  // 2. Ceiling / Upper Bound Intent: "under 50 lakhs", "below 1.5 cr", "less than 40l", "upto 60 lakhs", "budget 50 lakhs"
  const maxRegex = /\b(?:under|below|max|maximum|upto|up to|within|less than|budget of|budget|cheaper than|at most|not exceeding)\s*(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|l|k|thousand|koti)\b/i;
  const maxMatch = text.match(maxRegex);
  if (maxMatch) {
    maxPrice = parseIndianPriceToNumber(maxMatch[1], maxMatch[2]);
    matchedSnippet = maxMatch[0];
  }

  // 3. Floor / Lower Bound Intent: "above 1 crore", "min 50 lakhs", "starting 20l", "more than 30 lakhs", "greater than 40 lakhs"
  const minRegex = /\b(?:above|over|min|minimum|starting from|starting at|starting|more than|greater than|at least)\s*(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|l|k|thousand|koti)\b/i;
  const minMatch = text.match(minRegex);
  if (minMatch) {
    minPrice = parseIndianPriceToNumber(minMatch[1], minMatch[2]);
    matchedSnippet = (matchedSnippet ? `${matchedSnippet} ` : '') + minMatch[0];
  }

  // 4. Approximate / Target Intent: "around 50 lakhs", "approx 40 lac", "about 1 cr"
  if (!maxPrice && !minPrice) {
    const approxRegex = /\b(?:around|approx|approximately|about|nearby)\s*(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|l|k|thousand)\b/i;
    const approxMatch = text.match(approxRegex);
    if (approxMatch) {
      const target = parseIndianPriceToNumber(approxMatch[1], approxMatch[2]);
      if (target) {
        minPrice = Math.round(target * 0.85);
        maxPrice = Math.round(target * 1.15);
        matchedSnippet = approxMatch[0];
      }
    }
  }

  // 5. Bare Price Mention: "plots 50 lakhs", "apartment 1 crore" -> Treated as budget upper ceiling
  if (!maxPrice && !minPrice) {
    const directRegex = /\b(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|l|k|thousand|koti)\b/i;
    const directMatch = text.match(directRegex);
    if (directMatch) {
      maxPrice = parseIndianPriceToNumber(directMatch[1], directMatch[2]);
      matchedSnippet = directMatch[0];
    }
  }

  return { minPrice, maxPrice, matchedSnippet };
}

/**
 * Extracts Spatial, Proximity and Landmark Intent
 */
function extractSpatialIntent(text) {
  let radiusKm = null;
  let referencePlace = '';
  let matchedSnippet = '';

  // Distance radius: "within 5 km of airport", "within 10 kilometers from guntur"
  const radiusMatch = text.match(/\bwithin\s*(\d+(?:\.\d+)?)\s*(?:km|kms|kilometer|kilometers)\s*(?:of|from|around)?\s*([^,]+)/i);
  if (radiusMatch) {
    radiusKm = parseFloat(radiusMatch[1]);
    referencePlace = radiusMatch[2].trim();
    matchedSnippet = radiusMatch[0];
    return { radiusKm, referencePlace, matchedSnippet };
  }

  // Landmark proximity: "near guntur highway", "close to perecherla junction", "adjacent to inner ring road"
  // Stops before conversational prepositions or numbers
  const landmarkMatch = text.match(/\b(?:near|close to|around|adjacent to|opposite to|facing to)\s+([a-zA-Z0-9\s]+?)(?=\s+(?:for|to|with|in|at|under|below|above|between|budget|price|\d+|$))/i);
  if (landmarkMatch) {
    referencePlace = landmarkMatch[1].trim();
    matchedSnippet = landmarkMatch[0];
  }

  return { radiusKm, referencePlace, matchedSnippet };
}

/**
 * Dynamic Semantic Expander for a given keyword token
 */
export function getSemanticSynonyms(word = '') {
  if (!word) return [];
  const clean = word.toLowerCase().trim();
  return SYNONYM_MAP[clean] || [clean];
}

// -------------------------------------------------------------
// 4. MAIN DYNAMIC NLP SEARCH PARSER ENGINE
// -------------------------------------------------------------

/**
 * Master NLP Query Analyzer: Dynamically parses unstructured natural-language searches
 * into canonical search state, recognized entities, and cleaned search tokens.
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
      radiusKm: null,
      nlpMetadata: {
        entities: {},
        sentiment: 'NEUTRAL'
      }
    };
  }

  const raw = queryString.trim();
  // 1. Preprocess: normalize word-based numbers e.g. "three bhk" -> "3 bhk"
  let workingText = normalizeWordNumbers(raw.toLowerCase());

  // 2. Extract Price & Budget FIRST so price numbers are never confused with locations or landmarks
  const priceResult = extractPriceIntent(workingText);
  if (priceResult.matchedSnippet) {
    workingText = workingText.replace(new RegExp(priceResult.matchedSnippet.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'), ' ');
  }

  // 3. Extract Structured Entities: Purpose, Bedroom count, Property Type, Spatial
  const intentResult = extractTransactionIntent(workingText);
  if (intentResult.matchedSnippet) {
    workingText = workingText.replace(new RegExp(`\\b${intentResult.matchedSnippet}\\b`, 'gi'), ' ');
  }

  const bedroomResult = extractBedroomIntent(workingText);
  if (bedroomResult.matchedSnippet) {
    workingText = workingText.replace(new RegExp(`\\b${bedroomResult.matchedSnippet}\\b`, 'gi'), ' ');
  }

  const propertyTypeResult = extractPropertyTypeIntent(workingText);
  if (propertyTypeResult.matchedSnippet) {
    workingText = workingText.replace(new RegExp(`\\b${propertyTypeResult.matchedSnippet}\\b`, 'gi'), ' ');
  }

  const spatialResult = extractSpatialIntent(workingText);
  if (spatialResult.matchedSnippet) {
    workingText = workingText.replace(new RegExp(`\\b${spatialResult.matchedSnippet.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi'), ' ');
  }

  // 4. Dynamic Stopwords, Entity Filtering & Location Isolation
  // Any leftover non-stopword tokens after removing intent, type, price, and radius represent the location/sub-locality
  const rawTokens = workingText
    .split(/[\s,/\-!?.;:()]+/)
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0);

  const cleanTokens = rawTokens.filter(t => {
    if (REAL_ESTATE_STOPWORDS.has(t)) return false;
    if (/^\d+$/.test(t)) return false;
    if (t.length <= 1) return false;
    return true;
  });

  const cleanKeywords = cleanTokens.join(' ');

  // If spatial proximity place exists (e.g. "near perecherla"), use it as primary location query
  let locationQuery = spatialResult.referencePlace || cleanKeywords;

  // Clean location query of any residual filler words
  if (locationQuery) {
    locationQuery = locationQuery
      .split(/[\s,/\-!?.;:()]+/)
      .filter(t => !REAL_ESTATE_STOPWORDS.has(t.toLowerCase()))
      .join(' ')
      .trim();
  }

  // Location is specific only if it contains a non-empty, genuine entity (length >= 3)
  const isLocationSpecific = Boolean(locationQuery && locationQuery.length >= 3);

  // Sentiment / Modifiers detection
  let budgetIntent = 'STANDARD';
  if (/\b(cheap|affordable|low cost|low budget|budget friendly|pocket friendly)\b/i.test(raw)) {
    budgetIntent = 'AFFORDABLE';
  } else if (/\b(luxury|ultra luxury|premium|posh|high end)\b/i.test(raw)) {
    budgetIntent = 'LUXURY';
  }

  return {
    originalQuery: raw,
    query: raw, // Strictly preserved so search input is NEVER cut off or truncated
    purpose: intentResult.purpose,
    propertyType: propertyTypeResult.propertyType,
    bedrooms: bedroomResult.bedrooms,
    minPrice: priceResult.minPrice || '',
    maxPrice: priceResult.maxPrice || '',
    locationQuery,
    cleanKeywords,
    isLocationSpecific,
    referencePlace: spatialResult.referencePlace || '',
    radiusKm: spatialResult.radiusKm,
    nlpMetadata: {
      budgetIntent,
      entities: {
        purpose: intentResult.purpose,
        propertyType: propertyTypeResult.propertyType,
        bedrooms: bedroomResult.bedrooms,
        minPrice: priceResult.minPrice,
        maxPrice: priceResult.maxPrice,
        location: locationQuery,
        referencePlace: spatialResult.referencePlace,
        radiusKm: spatialResult.radiusKm
      }
    }
  };
}
