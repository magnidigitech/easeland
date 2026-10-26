import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Search,
  Sparkles,
  Building,
  Navigation,
  Compass,
  Landmark,
  X,
  Loader2,
  Check,
  Flame,
  CornerDownLeft
} from 'lucide-react';
import { searchIndiaLocations } from '../../services/locationAutofillService.js';

/**
 * Type-specific badge styling and labels
 */
const TYPE_CONFIG = {
  LISTED_VENTURE: {
    label: 'Verified Venture',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    icon: Sparkles
  },
  VILLAGE: {
    label: 'Village / GP',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    icon: MapPin
  },
  MANDAL: {
    label: 'Mandal / Tehsil',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    icon: Compass
  },
  CITY: {
    label: 'City / Town',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
    icon: Building
  },
  DISTRICT: {
    label: 'District',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
    icon: Navigation
  },
  AREA: {
    label: 'Area / Colony',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-300',
    icon: MapPin
  },
  LANDMARK: {
    label: 'Landmark',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
    icon: Landmark
  },
  STATE: {
    label: 'State / UT',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    icon: Navigation
  },
  LOCALITY: {
    label: 'Locality',
    badgeClass: 'bg-teal-100 text-teal-900 border-teal-300',
    icon: MapPin
  }
};

/**
 * Popular Capital Regions & Priority Hubs for 1-Tap Autofill
 */
const POPULAR_CAPITAL_HUBS = [
  { id: 'pop_amaravati', title: 'Amaravati Capital Region', subtitle: 'Capital Seed Zone, Andhra Pradesh', type: 'MANDAL', district: 'Guntur', state: 'Andhra Pradesh' },
  { id: 'pop_mangalagiri', title: 'Mangalagiri', subtitle: 'AIIMS & IT Growth Corridor, Guntur, AP', type: 'MANDAL', district: 'Guntur', state: 'Andhra Pradesh' },
  { id: 'pop_vijayawada', title: 'Vijayawada', subtitle: 'NTR District Commercial Center, Andhra Pradesh', type: 'CITY', district: 'NTR', state: 'Andhra Pradesh' },
  { id: 'pop_guntur', title: 'Guntur City', subtitle: 'Guntur District Headquarter, Andhra Pradesh', type: 'CITY', district: 'Guntur', state: 'Andhra Pradesh' },
  { id: 'pop_visakhapatnam', title: 'Visakhapatnam', subtitle: 'Smart City & Coastal Metro, Andhra Pradesh', type: 'CITY', district: 'Visakhapatnam', state: 'Andhra Pradesh' },
  { id: 'pop_hyderabad', title: 'Hyderabad (Hitec City / Madhapur)', subtitle: 'Cyberabad Tech Corridor, Telangana', type: 'AREA', district: 'Rangareddy', state: 'Telangana' },
  { id: 'pop_tirupati', title: 'Tirupati', subtitle: 'Pilgrim City & Electronic Zone, Andhra Pradesh', type: 'CITY', district: 'Tirupati', state: 'Andhra Pradesh' }
];

/**
 * Substring highlight helper for intuitive visual matching
 */
function renderHighlightedText(text, query) {
  if (!query || !text) return text;
  const qClean = query.trim().toLowerCase();
  const textLower = text.toLowerCase();
  const idx = textLower.indexOf(qClean);
  if (idx === -1) return text;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + qClean.length);
  const after = text.slice(idx + qClean.length);

  return (
    <span>
      {before}
      <span className="text-amber-700 bg-amber-100/90 font-black px-0.5 rounded-xs underline decoration-amber-400">
        {match}
      </span>
      {after}
    </span>
  );
}

/**
 * 10/10 Gold-Standard Dynamic Pan-India Location Autofill Component
 */
export default function DynamicLocationAutofill({
  value = '',
  onChange,
  onSelect,
  placeholder = 'Search village, mandal, city, area or landmark throughout India...',
  id = 'dynamic-location-autofill',
  name = 'location',
  required = false,
  className = '',
  disabled = false,
  availableProperties = [],
  filterState = '',
  filterDistrict = ''
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isPopularMode, setIsPopularMode] = useState(false);

  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Sync external value
  useEffect(() => {
    if (value !== undefined && value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value]);

  // Click outside listener to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Handle Input Change
  const handleInputChange = (e) => {
    const text = e.target.value;
    setInputValue(text);
    if (onChange) onChange(text);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!text || text.trim().length === 0) {
      setSuggestions(POPULAR_CAPITAL_HUBS);
      setIsPopularMode(true);
      setIsOpen(true);
      setIsLoading(false);
      return;
    }

    if (text.trim().length === 1) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsPopularMode(false);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchIndiaLocations(text, {
          availableProperties,
          state: filterState,
          district: filterDistrict,
          limit: 10
        });
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setSelectedIndex(-1);
      } catch (err) {
        console.warn('Location autofill lookup error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);
  };

  // Handle Input Focus - Show popular hubs if empty
  const handleFocus = () => {
    if (!inputValue || inputValue.trim().length === 0) {
      setSuggestions(POPULAR_CAPITAL_HUBS);
      setIsPopularMode(true);
      setIsOpen(true);
    } else if (suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  const handleSelect = (item) => {
    setInputValue(item.title);
    setIsOpen(false);
    setSuggestions([]);

    if (onChange) onChange(item.title);
    if (onSelect) onSelect(item);
  };

  const handleClear = () => {
    setInputValue('');
    setSuggestions(POPULAR_CAPITAL_HUBS);
    setIsPopularMode(true);
    setIsOpen(true);
    if (onChange) onChange('');
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* INPUT FIELD CONTAINER */}
      <div className="relative flex items-center group">
        <MapPin className="w-4 h-4 text-slate-400 group-focus-within:text-amber-500 absolute left-3 pointer-events-none shrink-0 transition-colors" />

        <input
          id={id}
          name={name}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
          className={
            'w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal shadow-xs ' +
            className
          }
        />

        {/* LOADING INDICATOR OR CLEAR BUTTON */}
        <div className="absolute right-3 flex items-center gap-1">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
          ) : inputValue ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-0.5 rounded-full hover:bg-slate-200"
              title="Clear location"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* FLOATING DROPDOWN SUGGESTIONS POPOVER */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl max-h-80 overflow-y-auto custom-scrollbar animate-fade-in divide-y divide-slate-100 ring-1 ring-slate-900/5">

          {/* DROPDOWN HEADER */}
          <div className="p-2.5 bg-slate-900 text-white rounded-t-2xl flex items-center justify-between text-[10px] font-black uppercase tracking-wider sticky top-0 z-10 shadow-xs">
            <span className="flex items-center gap-1.5">
              {isPopularMode ? (
                <>
                  <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  Popular Andhra Pradesh & India Growth Hubs
                </>
              ) : (
                <>
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  Live Pan-India Location Matches ({suggestions.length})
                </>
              )}
            </span>
            <span className="text-slate-400 font-semibold normal-case text-[9px]">
              Villages • Mandals • Landmarks • Cities
            </span>
          </div>

          {/* SUGGESTIONS LIST */}
          <div className="p-1.5 space-y-1">
            {suggestions.map((item, idx) => {
              const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.LOCALITY;
              const IconComponent = config.icon;
              const isSelected = selectedIndex === idx;

              return (
                <button
                  key={item.id || idx}
                  type="button"
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={
                    'w-full text-left p-2.5 rounded-xl transition-all flex items-start justify-between gap-3 cursor-pointer group ' +
                    (isSelected
                      ? 'bg-amber-50 text-slate-950 ring-1 ring-amber-300 shadow-xs'
                      : 'hover:bg-slate-50 text-slate-800'
                    )
                  }
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className={
                        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-transform group-hover:scale-105 ' +
                        (item.isPlatformListing
                          ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                          : 'bg-slate-100 text-slate-600')
                      }
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-xs text-slate-900 line-clamp-1">
                          {renderHighlightedText(item.title, isPopularMode ? '' : inputValue)}
                        </span>
                        <span
                          className={
                            'text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ' +
                            config.badgeClass
                          }
                        >
                          {config.label}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                        {item.subtitle || item.fullAddress}
                      </p>

                      {/* Coordinates or Postal Code badge if available */}
                      {(item.lat && item.lng) && (
                        <div className="text-[9px] text-slate-400 font-mono flex items-center gap-2 mt-1">
                          <span>Coordinates: {Number(item.lat).toFixed(3)}N, {Number(item.lng).toFixed(3)}E</span>
                          {item.state && <span>• {item.state}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 mt-1.5">
                    {isSelected ? (
                      <Check className="w-4 h-4 text-amber-500" />
                    ) : (
                      <CornerDownLeft className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-500 transition-colors" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* KEYBOARD SHORTCUTS FOOTER */}
          <div className="p-2 bg-slate-50 text-slate-400 text-[10px] font-semibold flex items-center justify-between border-t border-slate-100 rounded-b-2xl">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono text-slate-600 shadow-2xs">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono text-slate-600 shadow-2xs">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono text-slate-600 shadow-2xs">ENTER</kbd>
              <span>to select</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono text-slate-600 shadow-2xs">ESC</kbd>
              <span>to dismiss</span>
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
