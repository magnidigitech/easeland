/**
 * EaseLand Deep Link & SPA URL Route Parser
 * Determines target page, propertyId, filters, and dashboard tab from window.location
 * Supports direct links, pasted URLs in new tabs, and hash routes.
 */
import { urlParamsToSearchState } from '../firebase/searchUrl.js';

export function parseRouteFromUrl(customLocation = null) {
  if (typeof window === 'undefined' && !customLocation) {
    return { page: 'home', propId: null, filters: null, tab: 'overview' };
  }

  const loc = customLocation || window.location;
  let rawPath = loc.pathname || '/';

  // Support hash routes (e.g. #/properties, #/property/123) if pathname is root
  if ((!rawPath || rawPath === '/') && loc.hash && loc.hash.startsWith('#/')) {
    rawPath = loc.hash.replace(/^#/, '');
  }

  const cleanPath = rawPath.toLowerCase().replace(/\/$/, '') || '/';
  const search = loc.search || (loc.hash && loc.hash.includes('?') ? '?' + loc.hash.split('?')[1] : '');
  const urlParams = new URLSearchParams(search);
  const modeParam = urlParams.get('mode');

  // Clean up any legacy localStorage page persistence so stale pages never linger across closes
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('easeland_active_page');
    }
  } catch (e) {}

  if (cleanPath === '/admin' || modeParam === 'admin') {
    return { page: 'admin', propId: null, filters: null, tab: 'overview' };
  }

  const propertyMatch = rawPath.match(/\/(?:property|property-detail)\/([a-zA-Z0-9_.-]+)/i);
  if (propertyMatch && propertyMatch[1]) {
    return { page: 'property-detail', propId: propertyMatch[1], filters: null, tab: 'overview' };
  }

  if (cleanPath.startsWith('/properties') || cleanPath.startsWith('/map')) {
    const parsedFilters = urlParamsToSearchState(search);
    return { page: 'map', propId: null, filters: parsedFilters, tab: 'overview' };
  }

  if (cleanPath === '/crm' || modeParam === 'crm' || urlParams.get('view') === 'crm') {
    return { page: 'crm', propId: null, filters: null, tab: 'overview' };
  }

  if (cleanPath === '/buy') return { page: 'buy', propId: null, filters: null, tab: 'overview' };
  if (cleanPath === '/rent') return { page: 'rent', propId: null, filters: null, tab: 'overview' };
  if (cleanPath === '/sell') return { page: 'sell', propId: null, filters: null, tab: 'overview' };
  if (cleanPath === '/post-property') return { page: 'post-property', propId: null, filters: null, tab: 'overview' };

  if (cleanPath === '/dashboard') {
    const tabParam = urlParams.get('tab') || 'overview';
    return { page: 'dashboard', propId: null, filters: null, tab: tabParam };
  }

  if (cleanPath === '/wishlist') return { page: 'wishlist', propId: null, filters: null, tab: 'overview' };
  if (cleanPath === '/privacy-policy' || cleanPath === '/privacy') {
    return { page: 'privacy-policy', propId: null, filters: null, tab: 'overview' };
  }

  return { page: 'home', propId: null, filters: null, tab: 'overview' };
}
