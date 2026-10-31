import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, ShieldCheck, LocateFixed, TrendingUp, Loader2, Sparkles, Plus, X, Trash2 } from 'lucide-react';
import { mockApi } from '../services/mockApi';
import { parseNaturalLanguageQuery } from '../firebase/searchParser.js';
import { fetchGooglePlacesPredictions, fetchGooglePlaceDetails, searchLocationQuery } from '../services/locationProvider.js';
import { STANDARD_CATEGORIES, getPropertyTypeFromCategory } from '../utils/categoryUtils.js';

function normalizeCategoryValue(val, purpVal) {
  if (!val || val === 'All' || val === 'ALL') {
    return 'All';
  }
  const clean = String(val).trim();
  const lower = clean.toLowerCase();

  // Direct exact matches
  if (lower === 'open plot ventures') return 'Open Plot Ventures';
  if (lower === 'open plot (city)' || lower === 'open plot city') return 'Open Plot (City)';
  if (lower === 'apartments/flat' || lower === 'apartment/flat' || lower === 'apartments' || lower === 'apartment') return 'Apartments/Flat';
  if (lower === 'independent house/villa' || lower === 'independent house / villa' || lower === 'houses & villas' || lower === 'houses' || lower === 'villa') return 'Independent House/Villa';
  if (lower === 'commerical property' || lower === 'commercial property' || lower === 'commercial') return 'Commerical Property';
  if (lower === 'agricultural lands' || lower === 'agricultural land') return 'Agricultural Lands';
  if (lower.includes('amaravathi') || lower.includes('lps')) return 'Amaravathi LPS layout plots';
  if (lower === 'others' || lower === 'other') return 'Others';

  // Keyword inferences
  if (lower.includes('agricultural') || lower.includes('farmland') || lower.includes('farm')) return 'Agricultural Lands';
  if (lower.includes('commercial') || lower.includes('office') || lower.includes('shop')) return 'Commerical Property';
  if (lower.includes('apartment') || lower.includes('flat')) return 'Apartments/Flat';
  if (lower.includes('house') || lower.includes('villa') || lower.includes('independent')) return 'Independent House/Villa';
  if (lower.includes('city') && lower.includes('plot')) return 'Open Plot (City)';
  if (lower.includes('plot') || lower.includes('venture') || lower === 'open_plot' || lower === 'open_plots') return 'Open Plot Ventures';

  return 'All';
}

export default function HeroSearch({ onSearch, isCompact = false, initialState = null }) {

  const [purpose, setPurpose] = useState(() => {
    if (initialState?.purpose === 'RENT') return 'rent';
    if (initialState?.purpose === 'SALE') return 'buy';
    return isCompact ? '' : 'buy';
  });
  const [query, setQuery] = useState(initialState?.query || initialState?.address || '');
  const [category, setCategory] = useState(() => normalizeCategoryValue(initialState?.category, initialState?.purpose));
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [siteConfig, setSiteConfig] = useState(mockApi.getSiteConfig());
  const inputRef = useRef(null);

  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const searchContainerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    const handleConfigUpdated = (e) => setSiteConfig(e.detail || mockApi.getSiteConfig());
    window.addEventListener('easeland-site-config-updated', handleConfigUpdated);
    return () => window.removeEventListener('easeland-site-config-updated', handleConfigUpdated);
  }, []);

  // Synchronize state with initialState prop updates
  useEffect(() => {
    if (initialState) {
      if (initialState.query !== undefined) setQuery(initialState.query || '');
      if (initialState.purpose !== undefined) {
        if (initialState.purpose === 'RENT') setPurpose('rent');
        else if (initialState.purpose === 'SALE') setPurpose('buy');
        else setPurpose(isCompact ? '' : 'buy');
      }
      setCategory(normalizeCategoryValue(initialState.category || initialState.propertyType, initialState.purpose));
    }
  }, [initialState, isCompact]);

  // Handle clicking outside suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Live debounced Google Places Autocomplete input change
  const handleInputChange = (val) => {
    setQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!val || val.trim().length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setIsSuggesting(false);
      return;
    }

    setIsSuggesting(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await fetchGooglePlacesPredictions(val);
        setSuggestions(results);
        setSuggestionsOpen(results.length > 0);
      } catch (err) {
        console.warn('Hero places suggestions error:', err);
      } finally {
        setIsSuggesting(false);
      }
    }, 250);
  };

  const handleSelectSuggestion = async (item) => {
    const text = item.mainText || item.description;
    setQuery(text);
    setSuggestionsOpen(false);

    let extraData = {};
    if (item.placeId) {
      try {
        setIsSuggesting(true);
        const details = await fetchGooglePlaceDetails(item.placeId, text);
        if (details && !isNaN(details.lat) && !isNaN(details.lng)) {
          extraData = {
            searchLat: details.lat,
            searchLng: details.lng,
            referenceLat: details.lat,
            referenceLng: details.lng,
            referencePlace: details.name || text,
            placeName: details.name || text,
            formattedAddress: details.displayName || text,
            city: details.hierarchy?.city || '',
            district: details.hierarchy?.district || '',
            state: details.hierarchy?.state || '',
            locality: details.hierarchy?.locality || details.hierarchy?.subLocality || '',
            userLat: null,
            userLng: null
          };
        }
      } catch (err) {
        console.warn('Place details fetch failed:', err);
      } finally {
        setIsSuggesting(false);
      }
    }

    triggerSearch(text, purpose, category, extraData);
  };

  const triggerSearch = (textQuery, currentPurpose, currentCategory, extraData = {}) => {
    const parsedNL = parseNaturalLanguageQuery(textQuery);

    const resolvedCategory = (currentCategory && currentCategory !== 'All') ? currentCategory : 'All';

    // Purpose resolution:
    // 1. Natural language query takes top priority (e.g. user typed "for rent" or "for sale")
    // 2. Active tab from homepage if explicitly selected ('rent' -> 'RENT', 'buy' -> 'SALE')
    // 3. In compact mode, preserve existing initialState.purpose if set, else leave empty/ALL
    let resolvedPurpose = '';
    if (parsedNL.purpose && parsedNL.purpose !== 'ALL') {
      resolvedPurpose = parsedNL.purpose;
    } else if (currentPurpose === 'rent') {
      resolvedPurpose = 'RENT';
    } else if (currentPurpose === 'buy') {
      resolvedPurpose = 'SALE';
    } else if (initialState?.purpose && initialState.purpose !== 'ALL') {
      resolvedPurpose = initialState.purpose;
    }

    // PropertyType resolution:
    // If natural language specifically detected a propertyType, use it.
    // Otherwise, align propertyType directly with the selected category so they can never conflict.
    // If "All Categories" is selected, reset propertyType to 'ALL'.
    let resolvedPropertyType = 'ALL';
    if (parsedNL.propertyType && parsedNL.propertyType !== 'ALL') {
      resolvedPropertyType = parsedNL.propertyType;
    } else if (resolvedCategory && resolvedCategory !== 'All') {
      resolvedPropertyType = getPropertyTypeFromCategory(resolvedCategory) || 'ALL';
    } else {
      resolvedPropertyType = 'ALL';
    }

    onSearch({
      ...parsedNL,
      purpose: resolvedPurpose,
      propertyType: resolvedPropertyType,
      category: resolvedCategory,
      query: textQuery,
      address: textQuery,
      ...extraData
    });
  };

  const handleClearSearch = () => {
    setQuery('');
    setSuggestions([]);
    setSuggestionsOpen(false);
    setLocationStatus('');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (inputRef.current) inputRef.current.focus();

    triggerSearch('', purpose, category, {
      searchLat: null,
      searchLng: null,
      referenceLat: null,
      referenceLng: null,
      referencePlace: '',
      placeName: '',
      formattedAddress: '',
      city: '',
      district: '',
      state: '',
      locality: '',
      userLat: null,
      userLng: null,
      radiusKm: null
    });
  };

  const handleSearchSubmit = async (e) => {
    e?.preventDefault();
    setSuggestionsOpen(false);

    let extraData = {};
    const trimmed = query ? query.trim() : '';

    if (trimmed && trimmed.length >= 2 && trimmed.toLowerCase() !== 'near me') {
      try {
        setIsSuggesting(true);
        const predictions = await fetchGooglePlacesPredictions(trimmed);
        if (Array.isArray(predictions) && predictions.length > 0 && predictions[0].placeId) {
          const details = await fetchGooglePlaceDetails(predictions[0].placeId, trimmed);
          if (details && !isNaN(details.lat) && !isNaN(details.lng)) {
            extraData = {
              searchLat: details.lat,
              searchLng: details.lng,
              referenceLat: details.lat,
              referenceLng: details.lng,
              referencePlace: details.name || trimmed,
              placeName: details.name || trimmed,
              formattedAddress: details.displayName || trimmed,
              city: details.hierarchy?.city || '',
              district: details.hierarchy?.district || '',
              state: details.hierarchy?.state || '',
              locality: details.hierarchy?.locality || details.hierarchy?.subLocality || '',
              userLat: null,
              userLng: null
            };
          }
        } else {
          const geoResults = await searchLocationQuery(trimmed);
          if (Array.isArray(geoResults) && geoResults.length > 0 && geoResults[0].lat && geoResults[0].lng) {
            const g = geoResults[0];
            extraData = {
              searchLat: g.lat,
              searchLng: g.lng,
              referenceLat: g.lat,
              referenceLng: g.lng,
              referencePlace: g.displayName || trimmed,
              placeName: g.displayName || trimmed,
              formattedAddress: g.displayName || trimmed,
              city: g.city || '',
              district: g.district || '',
              state: g.state || '',
              locality: g.locality || '',
              userLat: null,
              userLng: null
            };
          }
        }
      } catch (err) {
        console.warn('Search geocode error:', err);
      } finally {
        setIsSuggesting(false);
      }
    }

    triggerSearch(query, purpose, category, extraData);
  };

  // Blazing-Fast Geolocation Detection Handler
  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationStatus('Detecting location...');

    const applyLocationSuccess = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      setIsLocating(false);
      setLocationStatus(`Location Fixed (${Math.round(accuracy || 20)}m)`);
      setQuery('Near Me');
      triggerSearch('Near Me', purpose, category, {
        userLat: latitude,
        userLng: longitude,
        accuracy,
        radiusKm: 25
      });
      setTimeout(() => setLocationStatus(''), 3000);
    };

    navigator.geolocation.getCurrentPosition(
      applyLocationSuccess,
      (err) => {
        console.warn('High accuracy GPS timeout or unavailable, trying Wi-Fi/IP location...', err.message);
        navigator.geolocation.getCurrentPosition(
          applyLocationSuccess,
          (fallbackErr) => {
            setIsLocating(false);
            setLocationStatus('');
            console.warn('Geolocation fallback failed:', fallbackErr.message);
            setQuery('Guntur, Andhra Pradesh');
            triggerSearch('Guntur, Andhra Pradesh', purpose, category);
            alert('Could not detect device GPS. Defaulted to region search.');
          },
          { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 10000 }
    );
  };

  const popularSearches = [
    { label: 'Near Me', isNearMe: true },
    { label: 'Hyderabad, Telangana' },
    { label: 'Bengaluru, Karnataka' },
    { label: 'Guntur, Andhra Pradesh' },
    { label: 'Nagpur, Maharashtra' }
  ];

  if (isCompact) {
    return (
      <form onSubmit={handleSearchSubmit} className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full min-w-0">
        <div ref={isCompact ? searchContainerRef : undefined} className="relative w-full sm:flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setSuggestionsOpen(true);
            }}
            placeholder="Search by locality, city, project name, or property type..."
            className="w-full pl-10 pr-16 py-2 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold text-white placeholder-gray-400 focus:outline-none focus:border-brand-yellow truncate"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
            {/* BIN ICON TO CLICK AND CLEAR THE SEARCH */}
            <button
              type="button"
              onClick={handleClearSearch}
              title="Clear search"
              className={'w-6 h-6 rounded-full flex items-center justify-center transition-all border group cursor-pointer ' + (
                query
                  ? 'bg-slate-700/80 hover:bg-rose-900/60 text-slate-300 hover:text-rose-400 border-slate-600 hover:border-rose-500/50'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-500 hover:text-slate-300 border-slate-700/80 hover:border-slate-600'
              )}
            >
              <Trash2 className="w-3 h-3 transition-transform group-hover:scale-110" />
            </button>
            <button
              type="button"
              onClick={handleDetectCurrentLocation}
              disabled={isLocating}
              title="Detect My Current Location"
              className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center hover:bg-blue-500/30 border border-blue-400/30"
            >
              {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* COMPACT GOOGLE PLACES (NEW) SUGGESTIONS DROPDOWN */}
          {isCompact && suggestionsOpen && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200/95 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-gray-100 text-slate-800 text-left">
              <div className="px-3.5 py-2 bg-slate-50 flex items-center justify-between border-b border-gray-100">
                <span className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase">
                  GOOGLE PLACES (NEW) SUGGESTIONS
                </span>
                <span className="text-[10px] font-black text-blue-600 tracking-wider uppercase flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  LIVE SEARCH
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                {suggestions.map((item, idx) => (
                  <button
                    key={item.placeId || idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    className="w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2.5 hover:bg-blue-50/70 transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="text-xs font-bold text-gray-800 group-hover:text-blue-600 truncate transition-colors">
                        {item.mainText}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate mt-0.5">
                        {item.secondaryText || item.description}
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-blue-500 bg-blue-50/80 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-between sm:justify-start">
          <select
            value={category}
            onChange={(e) => {
              const val = e.target.value;
              setCategory(val);
              triggerSearch(query, purpose, val);
            }}
            className="flex-1 sm:flex-none py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-amber-400 cursor-pointer min-w-0 max-w-[200px] sm:max-w-[170px] truncate"
          >
            <option value="All" className="bg-slate-900 text-white font-semibold">All Categories</option>
            {STANDARD_CATEGORIES.map(cat => (
              <option key={cat} value={cat} className="bg-slate-900 text-white font-semibold">{cat}</option>
            ))}
          </select>

          <button
            type="submit"
            className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1 shrink-0 shadow-sm"
          >
            <Search className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Search</span>
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="relative bg-metallic-dark text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden border-b border-slate-800">
      
      {/* Background Decorative Graphic */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>

      {/* Dynamic CMS Hero Background Image */}
      {(siteConfig?.homepage?.heroBackgroundImage || siteConfig?.media?.heroBannerUrl) && (
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-25 transition-opacity duration-700"
          style={{ backgroundImage: 'url(' + (siteConfig?.homepage?.heroBackgroundImage || siteConfig?.media?.heroBannerUrl) + ')' }}
        />
      )}
      
      <div className="max-w-5xl mx-auto text-center relative z-10">
        
        {/* Verification Tagline */}
        <div className="inline-flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-amber-400/30 text-xs font-semibold text-amber-400 mb-6 shadow-[0_0_15px_rgba(212,175,55,0.15)]">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>{siteConfig?.homepage?.heroTagline || 'India-Wide Direct Property Marketplace — Powered by Google Maps Platform'}</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-100 leading-tight mb-4">
          {siteConfig?.homepage?.heroTitlePrefix || 'Find, Explore & Verify Properties '} <br className="hidden sm:inline" />
          <span className="text-metallic-gold">{siteConfig?.homepage?.heroTitleHighlight || 'Directly from Owners'}</span>
        </h1>
        
        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-8 font-medium">
          {(() => {
            const sub = siteConfig?.homepage?.heroSubtitle;
            if (
              !sub ||
              sub.includes('Zero agents') ||
              sub.includes('Zero commission') ||
              sub.includes('Zero brokerage') ||
              sub.includes('zero broker') ||
              sub.includes('zero brokerage') ||
              sub.includes('Accurate plot boundaries')
            ) {
              return '100% verified listings. Zero boundary disputes & crystal-clear titles. Explore land plots, houses, apartments, and commercial spaces on our interactive map across all of India.';
            }
            return sub;
          })()}
        </p>

        {/* DEEP SEARCH CARD */}
        <div className="bg-slate-900/95 rounded-2xl p-4 sm:p-6 shadow-2xl text-white max-w-4xl mx-auto border border-slate-700/60 backdrop-blur-xl">
          
          {/* Purpose Tabs */}
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPurpose('buy')}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all border ${
                  purpose === 'buy'
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 border-transparent'
                }`}
              >
                Buy Property
              </button>
              
              <button
                type="button"
                onClick={() => setPurpose('rent')}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all border ${
                  purpose === 'rent'
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 border-transparent'
                }`}
              >
                Rent Property
              </button>
            </div>

            {locationStatus && (
              <span className="text-xs font-bold text-emerald-400 animate-pulse bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/40">
                {locationStatus}
              </span>
            )}
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
            
            {/* Input with Map Pin Icon, Google Places (New) Suggestions, & Detect Current Location Button */}
            <div ref={!isCompact ? searchContainerRef : undefined} className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400/80 z-10" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setSuggestionsOpen(true);
                }}
                placeholder="Search by locality, city, project name, or property type..."
                className="w-full pl-12 pr-24 py-3.5 bg-slate-950/90 border border-slate-700/80 rounded-xl text-sm font-semibold text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-slate-900 transition-all shadow-inner"
              />

              {/* ACTION BUTTONS: CLEAR SEARCH BIN & DETECT CURRENT LOCATION */}
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                {/* BIN ICON TO CLICK AND CLEAR THE SEARCH */}
                <button
                  type="button"
                  onClick={handleClearSearch}
                  title="Clear search"
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm border group cursor-pointer ${
                    query
                      ? 'bg-slate-800 hover:bg-rose-950/70 text-slate-400 hover:text-rose-400 border-slate-700 hover:border-rose-500/50'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-500 hover:text-slate-300 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                </button>

                {/* DETECT MY CURRENT LOCATION CROSSHAIR BUTTON */}
                <button
                  type="button"
                  onClick={handleDetectCurrentLocation}
                  disabled={isLocating}
                  title="Detect My Current Location"
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-sky-400 flex items-center justify-center transition-all shadow-sm group border border-slate-700"
                >
                  {isLocating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  ) : (
                    <LocateFixed className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                  )}
                </button>
              </div>

              {/* FULL GOOGLE PLACES (NEW) SUGGESTIONS FLOATING DROPDOWN */}
              {!isCompact && suggestionsOpen && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white text-slate-800 border border-gray-200/95 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-gray-100 text-left animate-in fade-in slide-in-from-top-1">
                  <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between border-b border-gray-100">
                    <span className="text-[11px] font-extrabold text-slate-500 tracking-wider uppercase">
                      GOOGLE PLACES (NEW) SUGGESTIONS
                    </span>
                    <span className="text-[11px] font-black text-blue-600 tracking-wider uppercase flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      LIVE SEARCH
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                    {suggestions.map((item, idx) => (
                      <button
                        key={item.placeId || idx}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-blue-50/70 transition-colors group cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                          <MapPin className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-xs sm:text-sm font-bold text-gray-800 group-hover:text-blue-600 truncate transition-colors">
                            {item.mainText}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate mt-0.5">
                            {item.secondaryText || item.description}
                          </div>
                        </div>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-blue-500 bg-blue-50/80 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Category Select Dropdown */}
            <div className="w-full sm:w-44">
              <select
                value={category}
                onChange={(e) => {
                  const val = e.target.value;
                  setCategory(val);
                  triggerSearch(query, purpose, val);
                }}
                className="w-full py-3.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                <option value="All" className="bg-slate-900 text-white font-bold">All Categories</option>
                {STANDARD_CATEGORIES.map(cat => (
                  <option key={cat} value={cat} className="bg-slate-900 text-white font-bold">{cat}</option>
                ))}
              </select>
            </div>

            {/* Search Submit Button */}
            <button
              type="submit"
              className="w-full sm:w-auto bg-brand-yellow hover:bg-brand-yellowHover text-slate-950 font-extrabold text-sm px-7 py-3.5 rounded-xl shadow-[0_4px_20px_rgba(234,179,8,0.25)] flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 border border-yellow-400/40"
            >
              <Search className="w-4 h-4 stroke-[2.5]" />
              Search
            </button>
          </form>

          {/* POPULAR SEARCHES PILLS BAR */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center overflow-x-auto no-scrollbar py-0.5 gap-2 -mx-2 px-2 sm:mx-0 sm:px-0 sm:flex-wrap sm:justify-center text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1 text-slate-400 font-bold mr-1 shrink-0 whitespace-nowrap">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              Popular Searches:
            </span>
            {popularSearches.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (item.isNearMe) {
                    handleDetectCurrentLocation();
                  } else {
                    setQuery(item.label);
                    triggerSearch(item.label, purpose, category);
                  }
                }}
                className={`px-3.5 py-1.5 rounded-full border transition-all flex items-center gap-1.5 font-bold shrink-0 whitespace-nowrap ${
                  item.isNearMe
                    ? 'bg-sky-950/80 text-sky-400 border-sky-600/50 hover:bg-sky-900 shadow-sm font-extrabold'
                    : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:border-amber-400/50 hover:text-amber-400'
                }`}
              >
                {item.isNearMe && <LocateFixed className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />}
                <span className={item.isNearMe ? 'text-sky-400 font-extrabold' : ''}>{item.label}</span>
              </button>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}

