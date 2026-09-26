import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from '../components/Navbar';
import PropertyCard from '../components/PropertyCard';
import UniversalMapEngine from '../components/UniversalMapEngine';
import DynamicFilterPanel from '../components/DynamicFilterPanel';
import HeroSearch from '../components/HeroSearch';
import { mockApi, deduplicateProperties } from '../services/mockApi';
import { useAuth } from '../context/AuthContext';
import { searchPublicProperties, validateSortCompatibility } from '../firebase/searchService.js';
import { searchStateToUrlParams, urlParamsToSearchState } from '../firebase/searchUrl.js';
import { getUserWishlist, addWishlistProperty, removeWishlistProperty } from '../firebase/wishlistService.js';
import { searchLocationQuery } from '../services/locationProvider.js';
import {
  Search, Filter, SlidersHorizontal, ArrowUpDown, ChevronLeft, ChevronRight,
  MapPin, Map as MapIcon, List, RotateCcw, AlertCircle, Sparkles, Building, Loader2
} from 'lucide-react';

const PAGE_SIZE = 12;

export default function PropertiesSearchPage({
  onNavigateToProperty = () => { },
  onOpenAuthModal = () => { }
}) {
  const { user: authUser } = useAuth();
  const uid = authUser?.uid || null;

  // 1. Initialize search state from URL query parameters
  const [searchState, setSearchState] = useState(() => urlParamsToSearchState(window.location.search));

  // 2. Query Results & Pagination State
  const [properties, setProperties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDocStack, setLastDocStack] = useState([]);
  const [currentLastDoc, setCurrentLastDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [disclosureMsg, setDisclosureMsg] = useState(null);
  const [candidateLimitReached, setCandidateLimitReached] = useState(false);
  const [sortCheck, setSortCheck] = useState({ compatible: true });

  // 3. Wishlist State
  const [wishlistSet, setWishlistSet] = useState(new Set());
  const [wishlistNotice, setWishlistNotice] = useState(null);

  // 4. UI View Mode (Responsive Split vs Mobile Toggle)
  const [viewMode, setViewMode] = useState('split'); // 'split', 'list', 'map'
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [focusedProperty, setFocusedProperty] = useState(null);

  // Load User Wishlist for Authenticated Customer
  useEffect(() => {
    let isMounted = true;
    if (uid) {
      getUserWishlist(uid).then(res => {
        if (isMounted && res.success && Array.isArray(res.propertyIds)) {
          setWishlistSet(new Set(res.propertyIds));
        }
      });
    } else {
      setWishlistSet(new Set());
    }
    return () => { isMounted = false; };
  }, [uid]);

  // Execute Search Query: Query PostgreSQL Database API (/api/properties) + LocalStorage
  const executeSearch = useCallback(async (stateToUse, cursorDoc = null) => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Primary DB Source: Fetch from PostgreSQL database endpoint (/api/properties)
      let pgProperties = [];
      try {
        const res = await fetch('/api/properties');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.properties)) {
            pgProperties = json.properties;
          }
        }
      } catch (pgErr) {}

      // 2. Secondary Source: Fetch from searchService & mockApi / LocalStorage
      let fsProperties = [];
      try {
        const result = await searchPublicProperties({
          searchState: stateToUse,
          pageSize: PAGE_SIZE,
          lastDoc: cursorDoc
        });
        if (result.success && Array.isArray(result.properties)) {
          fsProperties = result.properties;
        }
      } catch (fsErr) {}

      const localData = mockApi.getPublicProperties(stateToUse) || [];

      // 3. Merge PostgreSQL + Firestore + LocalStorage properties
      const allCandidateProps = [...pgProperties, ...fsProperties, ...localData];
      const liveProperties = allCandidateProps.filter(p => {
        if (!p) return false;
        const st = String(p.status || p.listingStatus || '').toUpperCase();
        const lst = String(p.listingStatus || '').toUpperCase();
        const vst = String(p.verificationStatus || '').toUpperCase();
        const isLive = st === 'LIVE' || st === 'APPROVED_LIVE' || st === 'APPROVED' || st === 'PLATFORM VERIFIED' || st === 'VERIFIED' ||
                       lst === 'LIVE' || lst === 'APPROVED_LIVE' || lst === 'APPROVED' || lst === 'PLATFORM VERIFIED' || lst === 'VERIFIED' ||
                       vst === 'PLATFORM VERIFIED' || vst === 'VERIFIED' || vst === 'APPROVED' ||
                       p.isPlatformVerified === true || p.isPublished === true || p.published === true ||
                       (!p.status && !p.listingStatus && p.title);
        const isBlocked = st === 'REJECTED' || st === 'DRAFT' || lst === 'REJECTED' || lst === 'DRAFT' || st === 'CHANGES_REQUIRED';
        return isLive && !isBlocked;
      });

      const combined = deduplicateProperties(liveProperties);
      setProperties(combined);
      setHasMore(false);
    } catch (err) {
      const fallbackData = mockApi.getPublicProperties(stateToUse);
      setProperties(fallbackData || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Synchronize URL query parameters when searchState changes
  useEffect(() => {
    const targetPathWithQuery = searchStateToUrlParams(searchState);
    const currentPathWithQuery = window.location.pathname + window.location.search;

    if (targetPathWithQuery !== currentPathWithQuery) {
      window.history.pushState(null, '', targetPathWithQuery);
    }

    // Reset pagination to Page 1 when search filters change
    setLastDocStack([]);
    setCurrentPage(1);
    executeSearch(searchState, null);
  }, [searchState, executeSearch]);

  // Listen for browser Back/Forward navigation (PopState) and Admin Property Approvals
  useEffect(() => {
    const handlePopState = () => {
      const parsedState = urlParamsToSearchState(window.location.search);
      setSearchState(parsedState);
    };

    const handlePropertyApproved = () => {
      executeSearch(searchState, null);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('easeland-property-approved', handlePropertyApproved);
    window.addEventListener('easeland-property-status-updated', handlePropertyApproved);
    window.addEventListener('storage', handlePropertyApproved);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('easeland-property-approved', handlePropertyApproved);
      window.removeEventListener('easeland-property-status-updated', handlePropertyApproved);
      window.removeEventListener('storage', handlePropertyApproved);
    };
  }, [searchState, executeSearch]);

  // Pagination Next Page
  const handleNextPage = () => {
    if (!hasMore || !currentLastDoc) return;
    setLastDocStack(prev => [...prev, currentLastDoc]);
    setCurrentPage(prev => prev + 1);
    executeSearch(searchState, currentLastDoc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pagination Previous Page
  const handlePrevPage = () => {
    if (currentPage <= 1) return;
    const newStack = [...lastDocStack];
    newStack.pop();
    const prevDoc = newStack.length > 0 ? newStack[newStack.length - 1] : null;

    setLastDocStack(newStack);
    setCurrentPage(prev => Math.max(1, prev - 1));
    executeSearch(searchState, prevDoc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle Sort Change
  const handleSortChange = (newSort) => {
    const hasPriceRange = searchState.minPrice != null || searchState.maxPrice != null;
    const hasAreaRange = searchState.minAreaSqFt != null || searchState.maxAreaSqFt != null || searchState.minArea != null || searchState.maxArea != null;

    const check = validateSortCompatibility(newSort, hasPriceRange, hasAreaRange);

    if (!check.compatible) {
      setWishlistNotice(check.reason || "This sorting option isn't available with your current filters.");
      setTimeout(() => setWishlistNotice(null), 4000);
      return;
    }

    setSearchState(prev => ({
      ...prev,
      sortBy: newSort
    }));
  };

  // Handle Wishlist Toggle
  const handleWishlistToggle = async (propId, e) => {
    if (e) e.stopPropagation();

    if (!uid) {
      setWishlistNotice('Please sign in to save properties to your wishlist.');
      onOpenAuthModal();
      setTimeout(() => setWishlistNotice(null), 4000);
      return;
    }

    const isSaved = wishlistSet.has(propId);
    const newSet = new Set(wishlistSet);

    if (isSaved) {
      newSet.delete(propId);
      setWishlistSet(newSet);
      await removeWishlistProperty(uid, propId);
    } else {
      newSet.add(propId);
      setWishlistSet(newSet);
      await addWishlistProperty(uid, propId);
    }
  };

  // Handle Quick Search Submission from Header
  const handleQuickSearch = (newSearchState) => {
    setSearchState(prev => ({
      ...prev,
      ...newSearchState
    }));
  };

  // Active Filter Counter
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchState.purpose && searchState.purpose !== 'ALL' && searchState.purpose !== 'ANY') count++;
    if (searchState.propertyType && searchState.propertyType !== 'ALL' && searchState.propertyType !== 'ANY') count++;
    if (searchState.state) count++;
    if (searchState.district) count++;
    if (searchState.city) count++;
    if (searchState.locality) count++;
    if (searchState.minPrice) count++;
    if (searchState.maxPrice) count++;
    if (searchState.minAreaSqFt || searchState.minArea) count++;
    if (searchState.maxAreaSqFt || searchState.maxArea) count++;
    if (searchState.bedrooms && searchState.bedrooms !== 'ANY' && searchState.bedrooms !== 'ALL') count++;
    if (searchState.facing && searchState.facing !== 'ALL' && searchState.facing !== 'ANY') count++;
    if (searchState.furnishing && searchState.furnishing !== 'ALL' && searchState.furnishing !== 'ANY') count++;
    if (searchState.radiusKm) count++;
    if (searchState.amenities && searchState.amenities.length > 0) count += searchState.amenities.length;
    return count;
  }, [searchState]);

  return (
    <div className="h-[calc(100vh-64px)] w-full flex flex-col font-sans text-brand-charcoal overflow-hidden bg-brand-offwhite">

      {/* SEARCH HEADER & NAVIGATION BAR */}
      <div className="bg-brand-charcoal text-white border-b border-gray-800 shrink-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">

          {/* Quick Search Controls */}
          <div className="w-full md:w-auto flex items-center gap-2 flex-1 max-w-2xl">
            <HeroSearch
              initialState={searchState}
              onSearch={handleQuickSearch}
              isCompact={true}
            />
          </div>

          {/* Filter & View Mode Controls */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            <button
              onClick={() => setFilterPanelOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold border border-gray-700 transition-all"
            >
              <SlidersHorizontal className="w-4 h-4 text-brand-yellow" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 bg-brand-yellow text-brand-charcoal rounded-full text-[10px] font-extrabold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={searchState.sortBy || 'newest'}
                onChange={(e) => handleSortChange(e.target.value)}
                className="appearance-none bg-slate-900 text-white text-xs font-bold py-2 pl-3 pr-8 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="newest" className="bg-slate-900 text-white font-bold">Newest First</option>
                <option value="price_asc" className="bg-slate-900 text-white font-bold">Price: Low to High</option>
                <option value="price_desc" className="bg-slate-900 text-white font-bold">Price: High to Low</option>
                <option value="area_asc" className="bg-slate-900 text-white font-bold">Area: Small to Large</option>
                <option value="area_desc" className="bg-slate-900 text-white font-bold">Area: Large to Small</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Mobile View Switcher (List vs Map) */}
            <div className="flex md:hidden items-center bg-gray-800 p-0.5 rounded-xl border border-gray-700">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${viewMode === 'list' ? 'bg-brand-yellow text-brand-charcoal' : 'text-gray-400'
                  }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${viewMode === 'map' ? 'bg-brand-yellow text-brand-charcoal' : 'text-gray-400'
                  }`}
              >
                <MapIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* NOTIFICATION TOAST BANNER */}
      {wishlistNotice && (
        <div className="bg-amber-500 text-brand-charcoal px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-md shrink-0">
          <AlertCircle className="w-4 h-4" />
          <span>{wishlistNotice}</span>
        </div>
      )}

      {/* PROXIMITY DISCLOSURE MESSAGE BANNER */}
      {disclosureMsg && (
        <div className="bg-blue-50 text-blue-900 border-b border-blue-100 px-4 py-1.5 text-xs font-semibold text-center shrink-0">
          {disclosureMsg}
        </div>
      )}

      {/* MAIN CONTENT AREA: MAP IS THE MAIN VIEWPORT (100% SCREEN), PROPERTY LIST IN SIDEBAR */}
      <div className="flex-1 w-full relative overflow-hidden min-h-0">
        <UniversalMapEngine
          hideSidePanel={false}
          properties={properties}
          filters={searchState}
          setFilters={setSearchState}
          onSelectProperty={(p) => {
            const targetId = typeof p === 'string' ? p : (p?.propertyId || p?.id || p?.referenceId);
            onNavigateToProperty(targetId);
          }}
          onWishlistToggle={handleWishlistToggle}
          isWishlisted={(pId) => wishlistSet.has(pId)}
          focusedProperty={focusedProperty}
        />
      </div>

      {/* FILTER SLIDE-OVER PANEL */}
      <DynamicFilterPanel
        isOpen={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        filters={searchState}
        setFilters={setSearchState}
        onApplyFilters={() => executeSearch(searchState, null)}
        totalCount={properties.length}
        sortCompatibility={sortCheck}
      />

    </div>
  );
}
