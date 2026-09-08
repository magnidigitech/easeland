import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, ShieldCheck, LocateFixed, TrendingUp, Loader2 } from 'lucide-react';
import { mockApi } from '../services/mockApi';
import { parseNaturalLanguageQuery } from '../firebase/searchParser.js';

export default function HeroSearch({ onSearch, isCompact = false, initialState = null }) {
  const [purpose, setPurpose] = useState(initialState?.purpose === 'RENT' ? 'rent' : 'buy');
  const [query, setQuery] = useState(initialState?.query || initialState?.address || '');
  const [category, setCategory] = useState(initialState?.category || initialState?.propertyType || 'All');
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [siteConfig, setSiteConfig] = useState(mockApi.getSiteConfig());
  const inputRef = useRef(null);

  useEffect(() => {
    const handleConfigUpdated = (e) => setSiteConfig(e.detail || mockApi.getSiteConfig());
    window.addEventListener('easeland-site-config-updated', handleConfigUpdated);
    return () => window.removeEventListener('easeland-site-config-updated', handleConfigUpdated);
  }, []);

  // Initialize Google Places Autocomplete restricted to India
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places && inputRef.current) {
      try {
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'in' },
          fields: ['formatted_address', 'geometry', 'name', 'address_components']
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place && (place.formatted_address || place.name)) {
            const selectedText = place.formatted_address || place.name;
            setQuery(selectedText);
            triggerSearch(selectedText, purpose, category);
          }
        });
      } catch (err) {
        console.warn('Google Places Autocomplete initialization fallback active:', err);
      }
    }
  }, [purpose, category]);

  const triggerSearch = (textQuery, currentPurpose, currentCategory, extraData = {}) => {
    const parsedNL = parseNaturalLanguageQuery(textQuery);
    onSearch({
      query: textQuery,
      purpose: currentPurpose === 'buy' ? 'SALE' : (currentPurpose === 'rent' ? 'RENT' : currentPurpose),
      category: currentCategory,
      ...parsedNL,
      ...extraData
    });
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    triggerSearch(query, purpose, category);
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
      <form onSubmit={handleSearchSubmit} className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "3 BHK villa in Gachibowli"...'
            className="w-full pl-10 pr-9 py-2 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold text-white placeholder-gray-400 focus:outline-none focus:border-brand-yellow"
          />
          <button
            type="button"
            onClick={handleDetectCurrentLocation}
            disabled={isLocating}
            title="Detect My Current Location"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center hover:bg-blue-500/30"
          >
            {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
          </button>
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-brand-yellow"
        >
          <option value="All">All Categories</option>
          <option value="Open Plots">Open Plots</option>
          <option value="Houses">Houses & Villas</option>
          <option value="Apartments">Apartments</option>
          <option value="Commercial">Commercial</option>
          <option value="Rentals">Rentals</option>
        </select>

        <button
          type="submit"
          className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1 shrink-0 shadow-sm"
        >
          <Search className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Search</span>
        </button>
      </form>
    );
  }

  return (
    <div className="relative bg-metallic-dark text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden border-b border-slate-800">
      
      {/* Background Decorative Graphic */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
      
      <div className="max-w-5xl mx-auto text-center relative z-10">
        
        {/* Verification Tagline */}
        <div className="inline-flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-amber-400/30 text-xs font-semibold text-amber-400 mb-6 shadow-[0_0_15px_rgba(212,175,55,0.15)]">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>{siteConfig.homepage?.heroTagline || 'India-Wide Direct Property Marketplace — Powered by Google Maps Platform'}</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-100 leading-tight mb-4">
          {siteConfig.homepage?.heroTitlePrefix || 'Find, Explore & Verify Properties '} <br className="hidden sm:inline" />
          <span className="text-metallic-gold">{siteConfig.homepage?.heroTitleHighlight || 'Directly from Owners'}</span>
        </h1>
        
        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-8 font-medium">
          {siteConfig.homepage?.heroSubtitle || 'Zero agents. Zero commission. Explore land plots, houses, apartments, and commercial spaces on our interactive map across all of India.'}
        </p>

        {/* DEEP SEARCH CARD */}
        <div className="bg-metallic-card rounded-2xl p-4 sm:p-6 shadow-2xl text-slate-100 max-w-4xl mx-auto border border-slate-700/60 backdrop-blur-xl">
          
          {/* Purpose Tabs */}
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPurpose('buy')}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all border ${
                  purpose === 'buy'
                    ? 'bg-metallic-gold text-slate-950 border-amber-300 shadow-md'
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
                    ? 'bg-metallic-gold text-slate-950 border-amber-300 shadow-md'
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
            
            {/* Input with Map Pin Icon, Google Places Autocomplete, & Detect Current Location Button */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400/80 z-10" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Try "3 BHK villa in Gachibowli under 1.5 Cr"...'
                className="w-full pl-12 pr-12 py-3.5 bg-slate-950/90 border border-slate-700/80 rounded-xl text-sm font-semibold text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-slate-900 transition-all shadow-inner"
              />

              {/* DETECT MY CURRENT LOCATION CROSSHAIR BUTTON */}
              <button
                type="button"
                onClick={handleDetectCurrentLocation}
                disabled={isLocating}
                title="Detect My Current Location"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-sky-400 flex items-center justify-center transition-all shadow-sm group border border-slate-700"
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                ) : (
                  <LocateFixed className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                )}
              </button>
            </div>

            {/* Category Select Dropdown */}
            <div className="w-full sm:w-44">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full py-3.5 px-3 bg-slate-950/90 border border-slate-700/80 rounded-xl text-sm font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-slate-900"
              >
                <option value="All">All Categories</option>
                <option value="Open Plots">Open Plots</option>
                <option value="Houses">Houses & Villas</option>
                <option value="Apartments">Apartments</option>
                <option value="Commercial">Commercial</option>
                <option value="Rentals">Rentals</option>
              </select>
            </div>

            {/* Search Submit Button */}
            <button
              type="submit"
              className="w-full sm:w-auto bg-metallic-gold hover:bg-amber-400 text-slate-950 font-extrabold text-sm px-7 py-3.5 rounded-xl shadow-[0_4px_20px_rgba(212,175,55,0.3)] flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 border border-amber-300/40"
            >
              <Search className="w-4 h-4 stroke-[2.5]" />
              Search
            </button>
          </form>

          {/* POPULAR SEARCHES PILLS BAR */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-start sm:justify-center gap-2 text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1 text-slate-400 font-bold mr-1">
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
                className={`px-3.5 py-1.5 rounded-full border transition-all flex items-center gap-1.5 font-bold ${
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

