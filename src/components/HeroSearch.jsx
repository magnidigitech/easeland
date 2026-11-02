import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, ShieldCheck, LocateFixed, TrendingUp, Loader2, Sparkles, Plus, X, Trash2, ArrowRight, Star, Award, CheckCircle2, ChevronRight, Layers } from 'lucide-react';
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

  const handleClearSearch = (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    setQuery('');
    setSuggestions([]);
    setSuggestionsOpen(false);
    setLocationStatus('');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (inputRef.current) inputRef.current.focus();

    // In compact mode (when hosted directly on the map/properties search page),
    // clearing the search query should update the active search filter so users see unfiltered results.
    // On the Homepage (!isCompact), clearing the search box must ONLY clear the input text
    // and NEVER trigger navigation / redirection to the map page.
    if (isCompact && typeof onSearch === 'function') {
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
    }
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
      setLocationStatus('Location Fixed (' + Math.round(accuracy || 20) + 'm)');
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

  // Hero Banner Version Switcher: defaults to 'new' (Glassmorphism + Neumorphism)
  // Preserves original hero banner completely intact & hidden as requested.
  const [heroVersion, setHeroVersion] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('easeland_hero_version') || 'new';
    }
    return 'new';
  });

  const toggleHeroVersion = (ver) => {
    setHeroVersion(ver);
    if (typeof window !== 'undefined') {
      localStorage.setItem('easeland_hero_version', ver);
    }
  };

  const getCleanHeroSubtitle = () => {
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
  };

  const getCleanHeroImage = () => {
    const raw = siteConfig?.homepage?.heroBackgroundImage || siteConfig?.media?.heroBannerUrl;
    const clean = (typeof raw === 'string') ? raw.trim() : '';
    return (!clean || clean.includes('photo-1500382017468-9049fed747ef')) ? '/easeland_hero_bg.jpg' : clean;
  };

  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  const heroScenes = [
    {
      id: '01',
      category: 'Open Plot Ventures',
      title: 'Verified Plots & Villas',
      image: '/images/heroes/buy_hero_transparent.png',
      badgeTop: '100% Physically Inspected',
      badgeBottom: 'Google Maps Boundary Verified',
      tag: 'RESIDENTIAL PLOTS & VILLAS'
    },
    {
      id: '02',
      category: 'Apartments/Flat',
      title: 'High-Rise Verified Flats',
      image: '/images/heroes/rent_hero_transparent.png',
      badgeTop: 'Zero Brokerage Living',
      badgeBottom: 'Pre-Vetted Gated Communities',
      tag: 'PRE-VETTED APARTMENTS'
    },
    {
      id: '03',
      category: 'Independent House/Villa',
      title: 'Direct-From-Owner Homes',
      image: '/images/heroes/sell_hero_transparent.png',
      badgeTop: 'For Sale By Owner',
      badgeBottom: 'Direct Negotiation Guaranteed',
      tag: 'DIRECT OWNER ESTATES'
    }
  ];

  return (
    <div className="relative">

      {/* FLOATING DEVELOPER/ADMIN VERSION SWITCHER (EASILY COMPARE OR RESTORE) */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-6 z-40 flex items-center gap-1.5 p-1 rounded-full bg-[#020718]/85 border border-white/20 backdrop-blur-md shadow-lg text-[10px] font-bold">
        <button
          type="button"
          onClick={() => toggleHeroVersion('new')}
          title="Switch to Brand-New Spatial Glass-Neumorphic Banner"
          className={'px-2.5 py-1 rounded-full transition-all cursor-pointer ' + (
            heroVersion === 'new'
              ? 'bg-[#FFE135] text-[#000080] font-black shadow-sm'
              : 'text-slate-300 hover:text-white'
          )}
        >
          ✨ Spatial Hero (New)
        </button>
        <button
          type="button"
          onClick={() => toggleHeroVersion('original')}
          title="Switch to Preserved Original Banner"
          className={'px-2.5 py-1 rounded-full transition-all cursor-pointer ' + (
            heroVersion === 'original'
              ? 'bg-slate-700 text-white font-black shadow-sm'
              : 'text-slate-400 hover:text-white'
          )}
        >
          🏛️ Original (Preserved)
        </button>
      </div>

      {/* =========================================================================
          VERSION 1: BRAND-NEW FRESH SPATIAL GLASS-NEUMORPHIC HERO BANNER
          Inspired by 3D spatial references:
          - Asymmetrical split layout with high-impact editorial typography
          - Interactive 3D floating land/villa island stage with scene switcher
          - Vertical slide indicators (01, 02, 03)
          - Floating full-width frosted glassmorphic metrics dock across bottom
          Colors: Navy Blue, Crisp White, Electric Brand Yellow
          ========================================================================= */}
      <div className={heroVersion === 'new' ? 'block' : 'hidden'}>
        <div className="relative bg-[#02071a] text-white pt-10 sm:pt-14 pb-14 sm:pb-16 px-4 sm:px-6 lg:px-10 overflow-hidden border-b border-white/10 min-h-[820px] lg:min-h-[780px] flex flex-col justify-between">

          {/* Deep Royal Midnight Navy Atmosphere with Celestial Mist */}
          <div
            className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-25 transition-opacity duration-700 mix-blend-luminosity scale-105"
            style={{ backgroundImage: 'url("' + getCleanHeroImage() + '")' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#02071a]/95 via-[#06143d]/90 to-[#02071a]/98 pointer-events-none" />

          {/* Optical Refraction Flares & Caustics behind the Frosted Glass */}
          <div
            className="absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full bg-gradient-to-br from-[#FFE135]/20 via-[#FACC15]/10 to-transparent blur-3xl pointer-events-none animate-pulse"
            style={{ animationDuration: '7s' }}
          />
          <div className="absolute -top-20 right-10 w-[36rem] h-[36rem] rounded-full bg-gradient-to-bl from-blue-600/30 via-[#000080]/45 to-transparent blur-3xl pointer-events-none" />
          <div className="absolute bottom-20 left-1/3 w-[30rem] h-[30rem] rounded-full bg-gradient-to-tr from-[#FFE135]/15 via-blue-500/15 to-transparent blur-3xl pointer-events-none" />

          {/* Precision Blueprint Grid Texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.035]"
            style={{
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.85) 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />

          {/* MAIN HERO STAGE GRID (ASYMMETRICAL SPATIAL SPLIT) */}
          <div className="max-w-7xl mx-auto w-full relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center my-auto pt-4 sm:pt-6">

            {/* LEFT COLUMN: EDITORIAL NARRATIVE & INTEGRATED GLASS SEARCH HUD */}
            <div className="lg:col-span-7 flex flex-col justify-center text-left">

              {/* NEUMORPHIC FROSTED GLASS CAPSULE BADGE */}
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full backdrop-blur-2xl bg-gradient-to-r from-white/[0.1] via-[#091b4a]/80 to-white/[0.06] border border-white/30 border-t-white/60 border-l-white/45 border-r-white/20 border-b-white/10 shadow-[0_6px_20px_rgba(0,0,128,0.3),inset_0_1px_1px_rgba(255,255,255,0.6)] mb-4 sm:mb-5 transition-all duration-300 hover:border-[#FFE135]/70 hover:shadow-[0_8px_25px_rgba(255,225,53,0.25)] group cursor-default w-fit">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFE135] animate-ping" />
                <span className="text-xs font-black text-[#FFE135] tracking-wider uppercase">
                  {siteConfig?.homepage?.heroTagline || "India's Direct Property Platform"}
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#FFE135] text-[#000080] shadow-sm">
                  100% VERIFIED
                </span>
              </div>

              {/* HERO MONUMENTAL HEADLINE */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.08] mb-4 text-left drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
                {siteConfig?.homepage?.heroTitlePrefix || 'Land & Living, '} <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-[#FFE135] via-[#FFF176] to-[#FACC15] bg-clip-text text-transparent drop-shadow-[0_4px_25px_rgba(255,225,53,0.35)]">
                  {siteConfig?.homepage?.heroTitleHighlight || 'Like Never Before.'}
                </span>
              </h1>

              {/* HIGH-VALUE VALUE PROPOSITION SUBTEXT */}
              <p className="text-sm sm:text-base text-slate-200/95 font-medium leading-relaxed max-w-xl mb-6 sm:mb-7 text-left drop-shadow-[0_1px_8px_rgba(0,0,0,0.7)]">
                {getCleanHeroSubtitle()}
              </p>

              {/* THE GLASS-NEUMORPHIC SEARCH COMMAND CONSOLE */}
              <div className="relative max-w-xl w-full rounded-3xl p-4 sm:p-5 backdrop-blur-2xl bg-gradient-to-b from-white/[0.12] via-[#071744]/80 to-[#02091e]/95 border border-white/30 border-t-white/60 border-l-white/45 border-r-white/20 border-b-white/10 shadow-[0_20px_50px_-10px_rgba(1,6,20,0.95),0_10px_30px_rgba(0,0,128,0.35),inset_0_1px_2px_rgba(255,255,255,0.4)]">

                {/* Specular Light Highlight Beam */}
                <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none" />

                {/* Purpose Tabs Switcher (Recessed Debossed Neumorphic Channel) */}
                <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
                  <div className="inline-flex items-center p-1 rounded-2xl bg-[#020617]/85 border border-white/15 shadow-[inset_0_2px_6px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,128,0.4)]">
                    <button
                      type="button"
                      onClick={() => setPurpose('buy')}
                      className={'px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ' + (
                        purpose === 'buy'
                          ? 'bg-gradient-to-r from-[#FFE135] via-[#FFF176] to-[#FACC15] text-[#000080] shadow-[0_4px_14px_rgba(255,225,53,0.4),inset_0_1px_1px_rgba(255,255,255,0.85)] border border-[#FFE135]'
                          : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
                      )}
                    >
                      Buy Property
                    </button>

                    <button
                      type="button"
                      onClick={() => setPurpose('rent')}
                      className={'px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ' + (
                        purpose === 'rent'
                          ? 'bg-gradient-to-r from-[#FFE135] via-[#FFF176] to-[#FACC15] text-[#000080] shadow-[0_4px_14px_rgba(255,225,53,0.4),inset_0_1px_1px_rgba(255,255,255,0.85)] border border-[#FFE135]'
                          : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
                      )}
                    >
                      Rent Property
                    </button>
                  </div>

                  {/* Location / Direct Deal Indicator */}
                  {locationStatus ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-500/40 backdrop-blur-md shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>{locationStatus}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FFE135] animate-pulse" />
                      <span>Direct Deals • 0% Brokerage</span>
                    </div>
                  )}
                </div>

                {/* Form Input Row */}
                <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-2.5">

                  {/* Debossed Neumorphic Input Well */}
                  <div ref={!isCompact && heroVersion === 'new' ? searchContainerRef : undefined} className="relative flex-1 w-full">
                    <div className="relative rounded-2xl bg-[#020617]/90 border border-white/20 shadow-[inset_0_3px_8px_rgba(0,0,0,0.7),inset_0_1px_3px_rgba(0,0,128,0.4),0_1px_1px_rgba(255,255,255,0.12)] transition-all focus-within:border-[#FFE135] focus-within:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5),0_0_20px_rgba(255,225,53,0.25)]">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFE135] z-10 pointer-events-none drop-shadow-[0_0_8px_rgba(255,225,53,0.4)] stroke-[2.5]" />

                      <input
                        ref={heroVersion === 'new' ? inputRef : undefined}
                        type="text"
                        value={query}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onFocus={() => {
                          if (suggestions.length > 0) setSuggestionsOpen(true);
                        }}
                        placeholder="Search locality, city, project name..."
                        className="w-full pl-10 pr-20 py-3 bg-transparent rounded-2xl text-xs sm:text-sm font-semibold text-white placeholder-slate-400 focus:outline-none"
                      />

                      {/* Action Buttons: Clear & Locate */}
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                        <button
                          type="button"
                          onClick={handleClearSearch}
                          title="Clear search"
                          className={'w-7 h-7 rounded-full flex items-center justify-center transition-all border group cursor-pointer ' + (
                            query
                              ? 'bg-[#0a1842] hover:bg-rose-950/80 text-slate-300 hover:text-rose-400 border-white/20 hover:border-rose-500/50 shadow-[0_2px_6px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.3)]'
                              : 'bg-[#061233]/70 hover:bg-[#0a1842] text-slate-500 hover:text-slate-300 border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
                          )}
                        >
                          <Trash2 className="w-3 h-3 transition-transform group-hover:scale-110" />
                        </button>

                        <button
                          type="button"
                          onClick={handleDetectCurrentLocation}
                          disabled={isLocating}
                          title="Detect My Current Location"
                          className="w-7 h-7 rounded-full bg-[#0a1842] hover:bg-[#0f2461] text-[#FFE135] hover:text-white flex items-center justify-center transition-all border border-white/20 shadow-[0_2px_6px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          {isLocating ? (
                            <Loader2 className="w-3 h-3 animate-spin text-[#FFE135]" />
                          ) : (
                            <LocateFixed className="w-3 h-3 stroke-[2.2]" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Live Google Places Suggestions Floating Tray */}
                    {!isCompact && heroVersion === 'new' && suggestionsOpen && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-[#040e28]/95 backdrop-blur-2xl border border-white/25 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.3)] text-white z-50 overflow-hidden divide-y divide-white/10 text-left animate-in fade-in slide-in-from-top-1">
                        <div className="px-3.5 py-2 bg-white/[0.04] flex items-center justify-between border-b border-white/10">
                          <span className="text-[10px] font-extrabold text-slate-300 tracking-wider uppercase">
                            GOOGLE PLACES (NEW) SUGGESTIONS
                          </span>
                          <span className="text-[10px] font-black text-[#FFE135] tracking-wider uppercase flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-[#FFE135]" />
                            LIVE SEARCH
                          </span>
                        </div>
                        <div className="max-h-60 overflow-y-auto divide-y divide-white/10">
                          {suggestions.map((item, idx) => (
                            <button
                              key={item.placeId || idx}
                              type="button"
                              onClick={() => handleSelectSuggestion(item)}
                              className="w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.08] transition-colors group cursor-pointer"
                            >
                              <div className="w-8 h-8 rounded-lg bg-[#FFE135]/15 text-[#FFE135] flex items-center justify-center shrink-0 border border-[#FFE135]/30 group-hover:bg-[#FFE135] group-hover:text-[#000080] transition-colors">
                                <MapPin className="w-3.5 h-3.5 stroke-[2.2]" />
                              </div>
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="text-xs font-bold text-white group-hover:text-[#FFE135] truncate transition-colors">
                                  {item.mainText}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                  {item.secondaryText || item.description}
                                </div>
                              </div>
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[#FFE135] bg-white/[0.06] border border-white/15 group-hover:bg-[#FFE135] group-hover:text-[#000080] group-hover:border-transparent transition-all shrink-0">
                                <Plus className="w-3 h-3 stroke-[2.5]" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category Selector Dropdown */}
                  <div className="w-full sm:w-36">
                    <div className="relative rounded-2xl bg-[#06153d]/90 backdrop-blur-xl border border-white/25 shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.3)] focus-within:border-[#FFE135]">
                      <select
                        value={category}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCategory(val);
                          triggerSearch(query, purpose, val);
                        }}
                        className="w-full py-3 px-3 bg-transparent rounded-2xl text-xs font-bold text-white focus:outline-none cursor-pointer appearance-none truncate"
                      >
                        <option value="All" className="bg-[#040d26] text-white font-bold">All Categories</option>
                        {STANDARD_CATEGORIES.map(cat => (
                          <option key={cat} value={cat} className="bg-[#040d26] text-white font-bold">{cat}</option>
                        ))}
                      </select>
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                        <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                      </div>
                    </div>
                  </div>

                  {/* Primary CTA Search Button */}
                  <button
                    type="submit"
                    className="w-full sm:w-auto bg-gradient-to-r from-[#FFE135] via-[#FFF066] to-[#FACC15] text-[#000080] font-black text-xs sm:text-sm px-6 py-3 rounded-2xl shadow-[0_8px_25px_rgba(255,225,53,0.45),0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.95)] border border-[#FFE135] flex items-center justify-center gap-1.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.35)] cursor-pointer shrink-0"
                  >
                    <span>Search</span>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.8]" />
                  </button>
                </form>

                {/* Popular Searches Pills */}
                <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center overflow-x-auto no-scrollbar py-0.5 gap-1.5 text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1 text-[11px] text-slate-300 font-bold mr-1 shrink-0 whitespace-nowrap">
                    <TrendingUp className="w-3 h-3 text-[#FFE135]" />
                    Popular:
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
                      className={'px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 text-[11px] font-bold shrink-0 whitespace-nowrap cursor-pointer ' + (
                        item.isNearMe
                          ? 'bg-[#0f2461]/90 text-sky-300 border-sky-400/50 hover:bg-[#153185] shadow-sm font-extrabold'
                          : 'bg-[#061438]/70 text-slate-200 border-white/15 hover:border-[#FFE135]/60 hover:text-[#FFE135] hover:bg-[#0a1c4a]'
                      )}
                    >
                      {item.isNearMe && <LocateFixed className="w-3 h-3 text-sky-300 stroke-[2.5]" />}
                      <span className={item.isNearMe ? 'text-sky-300 font-extrabold' : ''}>{item.label}</span>
                    </button>
                  ))}
                </div>

              </div>

            </div>

            {/* RIGHT COLUMN: 3D SPATIAL PROPERTY ISLAND STAGE & INTERACTIVE CAROUSEL */}
            <div className="lg:col-span-5 relative flex flex-col items-center justify-center pt-4 lg:pt-0">

              {/* 3D SCENE SELECTOR SEGMENTED GLASS PILL */}
              <div className="inline-flex p-1 rounded-2xl bg-[#020718]/85 backdrop-blur-xl border border-white/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] mb-3 text-[11px] font-bold z-20">
                {heroScenes.map((scene, idx) => (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => {
                      setActiveSceneIndex(idx);
                      setCategory(scene.category);
                    }}
                    className={'px-3 py-1.5 rounded-xl transition-all cursor-pointer font-extrabold ' + (
                      activeSceneIndex === idx
                        ? 'bg-[#FFE135] text-[#000080] shadow-[0_2px_8px_rgba(255,225,53,0.4),inset_0_1px_1px_rgba(255,255,255,0.7)]'
                        : 'text-slate-300 hover:text-white'
                    )}
                  >
                    <span>{scene.id} </span>
                    <span className="hidden sm:inline">{scene.title.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              {/* THE 3D SPATIAL FLOATING ISLAND STAGE */}
              <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-none flex items-center justify-center py-4">

                {/* Radiant Ambient Ground Caustic Flare under the Floating Island */}
                <div className="absolute bottom-2 w-72 sm:w-80 h-16 bg-gradient-to-r from-[#FFE135]/25 via-blue-500/25 to-[#FFE135]/20 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

                {/* Transparent 3D Isometric Property Visual Asset */}
                <div className="relative z-10 w-full flex items-center justify-center transition-all duration-700 transform">
                  <img
                    key={heroScenes[activeSceneIndex].id}
                    src={heroScenes[activeSceneIndex].image}
                    alt={heroScenes[activeSceneIndex].title}
                    className="w-full h-auto max-h-[350px] sm:max-h-[420px] object-contain drop-shadow-[0_25px_45px_rgba(0,0,0,0.9)] animate-gentle-float select-none transition-transform duration-500 hover:scale-105"
                    loading="eager"
                  />
                </div>

                {/* FLOATING SPATIAL HUD MICRO-BADGES */}
                {/* 1. Top Right Inspection Beacon */}
                <div className="absolute -top-2 right-0 sm:right-2 z-20 backdrop-blur-xl bg-[#03091e]/85 border border-white/20 border-t-white/45 px-3 py-1.5 rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[11px] font-black text-white tracking-wide">
                    {heroScenes[activeSceneIndex].badgeTop}
                  </span>
                </div>

                {/* 2. Bottom Left Boundary Surveyed Badge */}
                <div className="absolute -bottom-2 left-0 sm:left-2 z-20 backdrop-blur-xl bg-[#03091e]/85 border border-white/20 border-t-white/45 px-3 py-1.5 rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#FFE135]" />
                  <span className="text-[11px] font-bold text-slate-100 tracking-wide">
                    {heroScenes[activeSceneIndex].badgeBottom}
                  </span>
                </div>

                {/* 3. Deal Badge Top Left */}
                <div className="absolute top-1/3 -left-2 z-20 hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl backdrop-blur-md bg-[#FFE135]/95 text-[#000080] font-black text-[10px] shadow-lg border border-white/40">
                  <Sparkles className="w-3 h-3 stroke-[2.5]" />
                  <span>DIRECT OWNER DEAL</span>
                </div>

              </div>

            </div>

          </div>

          {/* VERTICAL SLIDER INDICATOR (INSPIRED BY REFERENCE 2 CLOUD GOLF) */}
          <div className="hidden xl:flex absolute right-4 top-1/2 -translate-y-1/2 flex-col items-center gap-3 p-2 rounded-full bg-[#020718]/70 backdrop-blur-xl border border-white/15 z-20 shadow-xl">
            {heroScenes.map((scene, idx) => (
              <button
                key={scene.id}
                type="button"
                onClick={() => {
                  setActiveSceneIndex(idx);
                  setCategory(scene.category);
                }}
                className={'flex flex-col items-center gap-1 text-[10px] font-black transition-all cursor-pointer ' + (
                  activeSceneIndex === idx
                    ? 'text-[#FFE135] scale-110'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <span>{scene.id}</span>
                <span className={'w-1.5 h-1.5 rounded-full transition-all ' + (
                  activeSceneIndex === idx ? 'bg-[#FFE135] h-4' : 'bg-slate-600'
                )} />
              </button>
            ))}
          </div>

          {/* BOTTOM HORIZON: FLOATING FULL-WIDTH GLASS-NEUMORPHIC METRICS DOCK (REFERENCE 2 INSPIRATION) */}
          <div className="max-w-7xl mx-auto w-full mt-8 sm:mt-10 z-10">
            <div className="rounded-2xl sm:rounded-3xl backdrop-blur-2xl bg-gradient-to-r from-white/[0.08] via-[#071744]/75 to-white/[0.08] border border-white/20 border-t-white/45 border-b-white/10 shadow-[0_15px_40px_rgba(0,0,128,0.25),inset_0_1px_1px_rgba(255,255,255,0.35)] p-4 sm:p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-white/10">

                {/* Metric 1 */}
                <div className="flex items-center gap-3.5 pt-2 md:pt-0 px-2 sm:px-4">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FFE135]/25 to-blue-500/20 border border-[#FFE135]/40 flex items-center justify-center text-[#FFE135] shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] shrink-0">
                    <MapPin className="w-5 h-5 stroke-[2.3]" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl sm:text-2xl font-black text-white tracking-tight">1,200+</div>
                    <div className="text-[11px] sm:text-xs font-semibold text-slate-300">Verified Land Plots</div>
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="flex items-center gap-3.5 pt-2 md:pt-0 px-2 sm:px-4">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500/25 to-[#FFE135]/20 border border-blue-400/40 flex items-center justify-center text-sky-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] shrink-0">
                    <ShieldCheck className="w-5 h-5 stroke-[2.3]" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl sm:text-2xl font-black text-white tracking-tight">100%</div>
                    <div className="text-[11px] sm:text-xs font-semibold text-slate-300">Direct Owner Deals</div>
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="flex items-center gap-3.5 pt-2 md:pt-0 px-2 sm:px-4">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FFE135]/25 to-emerald-500/20 border border-[#FFE135]/40 flex items-center justify-center text-[#FFE135] shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] shrink-0">
                    <Award className="w-5 h-5 stroke-[2.3]" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl sm:text-2xl font-black text-white tracking-tight">0</div>
                    <div className="text-[11px] sm:text-xs font-semibold text-slate-300">Boundary Disputes</div>
                  </div>
                </div>

                {/* Metric 4 */}
                <div className="flex items-center gap-3.5 pt-2 md:pt-0 px-2 sm:px-4">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400/25 to-[#FFE135]/20 border border-amber-300/40 flex items-center justify-center text-[#FFE135] shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] shrink-0">
                    <Star className="w-5 h-5 stroke-[2.3] fill-[#FFE135]" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl sm:text-2xl font-black text-white tracking-tight">4.9 ★</div>
                    <div className="text-[11px] sm:text-xs font-semibold text-slate-300">Owner Trust Score</div>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>



      {/* =========================================================================
          VERSION 2: ORIGINAL EXISTED HERO BANNER (PRESERVED INTACT & HIDDEN)
          As requested: DO NOT DELETE, JUST KEEP HIDDEN & SHOW NEWLY CREATED ONE.
          To restore: user can toggle to 'original' or change heroVersion default.
          ========================================================================= */}
      <div
        className={heroVersion === 'original' ? 'block' : 'hidden'}
        style={heroVersion === 'original' ? {} : { display: 'none' }}
        aria-hidden={heroVersion !== 'original'}
        data-hero-status="legacy-preserved"
      >
        <div className="relative bg-metallic-dark text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden border-b border-slate-800">
          
          {/* Dynamic CMS Hero Background Image */}
          {(() => {
            const raw = siteConfig?.homepage?.heroBackgroundImage || siteConfig?.media?.heroBannerUrl;
            const clean = (typeof raw === 'string') ? raw.trim() : '';
            const heroSrc = (!clean || clean.includes('photo-1500382017468-9049fed747ef')) ? '/easeland_hero_bg.jpg' : clean;
            return (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-95 transition-opacity duration-700"
                  style={{ backgroundImage: 'url("' + heroSrc + '")' }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/15 to-black/45 pointer-events-none" />
              </>
            );
          })()}
          
          <div className="max-w-5xl mx-auto text-center relative z-10">
            
            {/* Verification Tagline */}
            <div className="inline-flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-amber-400/30 text-xs font-semibold text-amber-400 mb-6 shadow-[0_0_15px_rgba(212,175,55,0.15)]">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>{siteConfig?.homepage?.heroTagline || 'India-Wide Direct Property Marketplace — Powered by Google Maps Platform'}</span>
            </div>

            {/* Hero Title */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
              {siteConfig?.homepage?.heroTitlePrefix || 'Find, Explore & Verify Properties '} <br className="hidden sm:inline" />
              <span className="text-metallic-gold drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{siteConfig?.homepage?.heroTitleHighlight || 'Directly from Owners'}</span>
            </h1>
            
            <p className="text-base sm:text-lg text-slate-100 max-w-2xl mx-auto mb-8 font-semibold drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">
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
                    className={'px-5 py-2 rounded-xl text-sm font-bold transition-all border ' + (
                      purpose === 'buy'
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-extrabold'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 border-transparent'
                    )}
                  >
                    Buy Property
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setPurpose('rent')}
                    className={'px-5 py-2 rounded-xl text-sm font-bold transition-all border ' + (
                      purpose === 'rent'
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-extrabold'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 border-transparent'
                    )}
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
                <div ref={!isCompact && heroVersion === 'original' ? searchContainerRef : undefined} className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400/80 z-10" />
                  <input
                    ref={heroVersion === 'original' ? inputRef : undefined}
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
                      className={'w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm border group cursor-pointer ' + (
                        query
                          ? 'bg-slate-800 hover:bg-rose-950/70 text-slate-400 hover:text-rose-400 border-slate-700 hover:border-rose-500/50'
                          : 'bg-slate-800/80 hover:bg-slate-800 text-slate-500 hover:text-slate-300 border-slate-700/80 hover:border-slate-600'
                      )}
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
                  {!isCompact && heroVersion === 'original' && suggestionsOpen && suggestions.length > 0 && (
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
                    className={'px-3.5 py-1.5 rounded-full border transition-all flex items-center gap-1.5 font-bold shrink-0 whitespace-nowrap ' + (
                      item.isNearMe
                        ? 'bg-sky-950/80 text-sky-400 border-sky-600/50 hover:bg-sky-900 shadow-sm font-extrabold'
                        : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:border-amber-400/50 hover:text-amber-400'
                    )}
                  >
                    {item.isNearMe && <LocateFixed className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />}
                    <span className={item.isNearMe ? 'text-sky-400 font-extrabold' : ''}>{item.label}</span>
                  </button>
                ))}
              </div>

            </div>

          </div>
        </div>
      </div>

    </div>
  );
}


