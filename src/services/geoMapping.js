/**
 * EaseLand Authoritative Geo-Mapping & Local SEO Architecture
 * Provides structured entity taxonomy for Guntur, Amaravati, Andhra Pradesh, Telangana, and Pan-India.
 */

export const GEOGRAPHIC_HUBS = [
  {
    id: 'guntur',
    name: 'Guntur Central & Capital Region',
    shortName: 'Guntur',
    state: 'Andhra Pradesh',
    badge: 'HQ & High Demand',
    lat: 16.3124,
    lng: 80.4285,
    zoom: 14,
    popularLocalities: ['Brodipet', 'Arundelpet', 'Lakshmipuram', 'Korritepadu', 'Vidyanagar', 'Kaza Corridor'],
    categories: ['Open Plot Ventures', 'Open Plot (City)', 'Independent House/Villa', 'Apartments/Flat']
  },
  {
    id: 'amaravati',
    name: 'Amaravati Capital City',
    shortName: 'Amaravati',
    state: 'Andhra Pradesh',
    badge: 'CRDA LPS Layouts',
    lat: 16.5131,
    lng: 80.5159,
    zoom: 13,
    popularLocalities: ['Velagapudi', 'Mandadam', 'Thullur', 'Nelapadu', 'Seed Access Corridor'],
    categories: ['Amaravathi LPS layout plots', 'Open Plot Ventures', 'Agricultural Lands']
  },
  {
    id: 'vijayawada',
    name: 'Vijayawada Commercial Belt',
    shortName: 'Vijayawada',
    state: 'Andhra Pradesh',
    badge: 'Prime Commercial & Flats',
    lat: 16.5062,
    lng: 80.6480,
    zoom: 13,
    popularLocalities: ['Benz Circle', 'MG Road', 'Poranki', 'Kanuru', 'Mangalagiri Corridor'],
    categories: ['Apartments/Flat', 'Commerical Property', 'Open Plot Ventures']
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad IT & Growth Corridor',
    shortName: 'Hyderabad',
    state: 'Telangana',
    badge: 'TG RERA High-Growth',
    lat: 17.3850,
    lng: 78.4867,
    zoom: 12,
    popularLocalities: ['Gachibowli', 'Hitec City', 'Madhapur', 'Tellapur', 'Mokila Corridor'],
    categories: ['Apartments/Flat', 'Open Plot Ventures', 'Independent House/Villa']
  },
  {
    id: 'visakhapatnam',
    name: 'Visakhapatnam Coastal Metro',
    shortName: 'Visakhapatnam',
    state: 'Andhra Pradesh',
    badge: 'Coastal Investment',
    lat: 17.6868,
    lng: 83.2185,
    zoom: 12,
    popularLocalities: ['Madhurawada', 'Rushikonda', 'Yendada', 'Bhimili Highway'],
    categories: ['Apartments/Flat', 'Open Plot Ventures', 'Independent House/Villa']
  }
];

export const REGIONAL_STATES = [
  {
    name: 'Andhra Pradesh',
    code: 'AP',
    focalCities: ['Guntur', 'Amaravati', 'Vijayawada', 'Visakhapatnam', 'Tirupati']
  },
  {
    name: 'Telangana',
    code: 'TG',
    focalCities: ['Hyderabad', 'Warangal', 'Karimnagar', 'Khammam']
  },
  {
    name: 'Pan-India',
    code: 'IN',
    focalCities: ['Bengaluru', 'Chennai', 'Mumbai', 'Pune', 'Delhi NCR']
  }
];

/**
 * Returns canonical title and description based on city or state filter without looking spammy
 */
export function getGeoSeoMetadata(cityFilter, categoryFilter) {
  if (cityFilter) {
    const cName = String(cityFilter).trim();
    return {
      title: 'Verified Properties in ' + cName + ' | EaseLand Direct Deal Facilitation',
      description: 'Explore verified land plots, houses, and apartments in ' + cName + '. Certified satellite boundaries, physical title audits, and assisted deal closing support.'
    };
  }

  if (categoryFilter) {
    const catName = String(categoryFilter).trim();
    return {
      title: catName + ' Across Guntur, AP, Telangana & India | EaseLand',
      description: 'Find 100% verified ' + catName + ' with physical site inspection, satellite boundary mapping, and direct buyer-owner deal facilitation.'
    };
  }

  return {
    title: 'EaseLand — Verified Property Discovery & Direct Deal Facilitation',
    description: 'India premier verified property discovery and direct deal facilitation platform. Explore residential plots, villas, flats, and farmlands across Guntur, Andhra Pradesh, Telangana, and Pan-India.'
  };
}
