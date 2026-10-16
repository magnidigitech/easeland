import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin, Layers, CheckCircle2, RotateCcw, AlertCircle, Search, Trash2, Undo2, MousePointerClick, Hexagon, ZoomIn, Sparkles, Plus, X, Loader2 } from 'lucide-react';
import {
  fetchGooglePlacesPredictions,
  fetchGooglePlaceDetails,
  loadGoogleMapsScript
} from '../services/locationProvider.js';

const MAP_STYLES = {
  googleRoadmap: {
    id: 'googleRoadmap',
    name: 'Google Maps (Standard)',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: '0123',
    maxZoom: 22,
    maxNativeZoom: 20
  },
  googleHybrid: {
    id: 'googleHybrid',
    name: 'Google Satellite Hybrid',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: '0123',
    maxZoom: 22,
    maxNativeZoom: 20
  },
  googleTerrain: {
    id: 'googleTerrain',
    name: 'Google Terrain',
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    subdomains: '0123',
    maxZoom: 22,
    maxNativeZoom: 20
  }
};

export default function OwnerLocationMarker({ initialLocation, initialBoundary, onLocationConfirm }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markerRef = useRef(null);
  const boundaryGroupRef = useRef(null);
  const addressInputRef = useRef(null);

  const [coords, setCoords] = useState(
    initialLocation?.lat && initialLocation?.lng
      ? { lat: initialLocation.lat, lng: initialLocation.lng }
      : { lat: 16.3124, lng: 80.4285 } // Default Guntur AP center
  );

  const [searchQuery, setSearchQuery] = useState(initialLocation?.formattedAddress || '');
  const [predictions, setPredictions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchContainerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  const [boundaryPoints, setBoundaryPoints] = useState(initialBoundary || []);
  const [isBoundaryMode, setIsBoundaryMode] = useState(false);
  const isBoundaryModeRef = useRef(isBoundaryMode);

  const [reverseGeocodedAddress, setReverseGeocodedAddress] = useState('');
  const [activeMapStyle, setActiveMapStyle] = useState('googleHybrid');
  const [stylePickerOpen, setStylePickerOpen] = useState(false);

  // Sync isBoundaryMode state with ref to avoid stale closures in Leaflet map click handlers
  useEffect(() => {
    isBoundaryModeRef.current = isBoundaryMode;
    if (mapContainerRef.current) {
      mapContainerRef.current.style.cursor = isBoundaryMode ? 'crosshair' : '';
    }
  }, [isBoundaryMode]);

  // Initialize Leaflet Map with Extended Zoom Range (Zoom Level 22)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      maxZoom: 22,
      attributionControl: false
    }).setView([coords.lat, coords.lng], 16);

    const styleConfig = MAP_STYLES.googleHybrid;
    const tileLayer = L.tileLayer(styleConfig.url, {
      maxZoom: styleConfig.maxZoom,
      maxNativeZoom: styleConfig.maxNativeZoom,
      subdomains: styleConfig.subdomains
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Boundary Drawing Layer Group
    boundaryGroupRef.current = L.layerGroup().addTo(map);

    // Main Location Marker
    const marker = L.marker([coords.lat, coords.lng], {
      draggable: true
    }).addTo(map);

    marker.bindPopup('Click map or drag pin to point exact property position');

    // MAP CLICK HANDLER (Ref-synced for instant boundary vertex drawing)
    map.on('click', (e) => {
      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;

      if (isBoundaryModeRef.current) {
        setBoundaryPoints((prev) => {
          // Check for duplicate vertex clicks in close proximity
          const isDuplicate = prev.some(
            (pt) => Math.abs(pt[0] - clickedLat) < 0.00001 && Math.abs(pt[1] - clickedLng) < 0.00001
          );
          if (isDuplicate) return prev;
          return [...prev, [clickedLat, clickedLng]];
        });
      } else {
        setCoords({ lat: clickedLat, lng: clickedLng });
      }
    });

    marker.on('dragend', () => {
      const position = marker.getLatLng();
      setCoords({ lat: position.lat, lng: position.lng });
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer when activeMapStyle changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const styleConfig = MAP_STYLES[activeMapStyle] || MAP_STYLES.googleRoadmap;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const newTileLayer = L.tileLayer(styleConfig.url, {
      maxZoom: styleConfig.maxZoom,
      maxNativeZoom: styleConfig.maxNativeZoom,
      subdomains: styleConfig.subdomains
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newTileLayer;
  }, [activeMapStyle]);

  // Update main pin marker position when coords change
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([coords.lat, coords.lng]);
      mapInstanceRef.current.panTo([coords.lat, coords.lng]);
    }
  }, [coords]);

  // RENDER REALTIME BOUNDARY VISUALIZATIONS & INTERACTIVE REMOVABLE / DRAGGABLE VERTICES
  useEffect(() => {
    if (!boundaryGroupRef.current) return;

    boundaryGroupRef.current.clearLayers();

    if (boundaryPoints.length === 0) return;

    // 2 Points -> Draw connecting polyline
    if (boundaryPoints.length === 2) {
      const polyline = L.polyline(boundaryPoints, {
        color: '#F4C542',
        weight: 3,
        dashArray: '6, 6'
      });
      boundaryGroupRef.current.addLayer(polyline);
    }

    // 3+ Points -> Draw closed land boundary polygon
    if (boundaryPoints.length >= 3) {
      const polygon = L.polygon(boundaryPoints, {
        color: '#F4C542',
        fillColor: '#F4C542',
        fillOpacity: 0.35,
        weight: 3,
        dashArray: '5, 5'
      });
      polygon.bindTooltip(`Plot Boundary (${boundaryPoints.length} Vertices) — Click any vertex marker to remove it`, { sticky: true });
      boundaryGroupRef.current.addLayer(polygon);
    }

    // Draw interactive, draggable, removable vertex markers for every corner point placed
    boundaryPoints.forEach((pt, index) => {
      const vertexHtml = `
        <div class="w-5 h-5 bg-brand-yellow border-2 border-brand-charcoal rounded-full shadow-lg flex items-center justify-center text-[10px] font-black text-brand-charcoal hover:bg-red-500 hover:text-white hover:border-white transition-all transform hover:scale-125 cursor-pointer" title="Click to remove corner ${index + 1}">
          ${index + 1}
        </div>
      `;

      const vertexIcon = L.divIcon({
        className: 'custom-vertex-marker',
        html: vertexHtml,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const vertexMarker = L.marker(pt, {
        icon: vertexIcon,
        draggable: true,
        zIndexOffset: 1000
      });

      vertexMarker.bindTooltip(`Corner ${index + 1}: Click to Remove | Drag to Adjust`, {
        permanent: false,
        direction: 'top'
      });

      // CLICK VERTEX MARKER TO REMOVE THAT WRONG SPOT VERTEX!
      vertexMarker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setBoundaryPoints((prev) => prev.filter((_, i) => i !== index));
      });

      // DRAG VERTEX MARKER TO FINE-TUNE CORNER LOCATION
      vertexMarker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        setBoundaryPoints((prev) => {
          const updated = [...prev];
          updated[index] = [newPos.lat, newPos.lng];
          return updated;
        });
      });

      boundaryGroupRef.current.addLayer(vertexMarker);
    });

  }, [boundaryPoints]);

  // Preload Google Maps JS SDK on mount
  useEffect(() => {
    loadGoogleMapsScript().catch(err => {
      console.warn('Google Maps JS SDK script preload error in OwnerLocationMarker:', err);
    });
  }, []);

  // Close suggestions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Debounced input change for Google Places Autocomplete predictions
  const handleQueryChange = (val) => {
    setSearchQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!val || val.trim().length < 2) {
      setPredictions([]);
      setDropdownOpen(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await fetchGooglePlacesPredictions(val);
        setPredictions(results);
        setDropdownOpen(results.length > 0);
      } catch (err) {
        console.warn('Google Places predictions error in OwnerLocationMarker:', err);
      } finally {
        setSearching(false);
      }
    }, 250);
  };

  // Select Place Suggestion & Deep Autofill Coordinates + Address
  const handleSelectPrediction = async (item) => {
    setDropdownOpen(false);
    setSearchQuery(item.mainText);
    setSearching(true);

    try {
      let placeDetails = null;
      if (item.lat && item.lng) {
        placeDetails = {
          lat: item.lat,
          lng: item.lng,
          displayName: item.description
        };
      } else {
        placeDetails = await fetchGooglePlaceDetails(item.placeId, item.mainText);
      }

      if (placeDetails && !isNaN(placeDetails.lat) && !isNaN(placeDetails.lng)) {
        const nextLat = Number(placeDetails.lat);
        const nextLng = Number(placeDetails.lng);

        setCoords({ lat: nextLat, lng: nextLng });
        setReverseGeocodedAddress(placeDetails.displayName || item.secondaryText || item.mainText);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([nextLat, nextLng], 18, { duration: 1.2 });
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([nextLat, nextLng]);
        }
      }
    } catch (err) {
      console.warn('Select prediction error in OwnerLocationMarker:', err);
    } finally {
      setSearching(false);
    }
  };

  // Browser HTML5 Geolocation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lng: longitude });
        setGpsLoading(false);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 18, { duration: 1.2 });
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        }
      },
      (err) => {
        console.warn('GPS location error:', err);
        setGpsError('Unable to retrieve GPS coordinates. Please search address or pick on map.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleUndoBoundary = () => {
    setBoundaryPoints(prev => prev.slice(0, -1));
  };

  const handleClearBoundary = () => {
    setBoundaryPoints([]);
  };

  const handleConfirm = () => {
    onLocationConfirm({
      location: coords,
      boundary: boundaryPoints,
      formattedAddress: reverseGeocodedAddress
    });
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Address Search Bar (Google Places) */}
      <div ref={searchContainerRef} className="relative">
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span className="text-red-500 text-sm">📍</span>
          <span>Location (Google Places Search)</span>
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
          <input
            ref={addressInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => {
              if (predictions.length > 0) setDropdownOpen(true);
            }}
            placeholder="Search address, locality, business or landmark..."
            className="w-full bg-white border-2 border-blue-400 focus:border-blue-600 rounded-full sm:rounded-2xl px-4 py-3 pl-11 pr-20 text-xs sm:text-sm font-semibold text-brand-charcoal focus:outline-none focus:ring-4 focus:ring-blue-100 shadow-sm transition-all"
          />

          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
            {searching && (
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin mr-1" />
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPredictions([]);
                  setDropdownOpen(false);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* GOOGLE PLACES (NEW) SUGGESTIONS FLOATING DROPDOWN */}
        {dropdownOpen && predictions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200/90 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-gray-100 animate-in fade-in slide-in-from-top-1">
            {/* HEADER BAR */}
            <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between border-b border-gray-100">
              <span className="text-[11px] font-extrabold text-slate-500 tracking-wider uppercase">
                GOOGLE PLACES (NEW) SUGGESTIONS
              </span>
              <span className="text-[11px] font-black text-blue-600 tracking-wider uppercase flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                LIVE SEARCH
              </span>
            </div>

            {/* PREDICTIONS LIST */}
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {predictions.map((item, idx) => (
                <button
                  key={item.placeId || idx}
                  type="button"
                  onClick={() => handleSelectPrediction(item)}
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

      <div className="flex items-center justify-center gap-4 text-xs font-extrabold text-gray-400 uppercase tracking-widest">
        <span className="h-px bg-gray-200 flex-1"></span>
        <span>OR</span>
        <span className="h-px bg-gray-200 flex-1"></span>
      </div>

      {/* 2. Use Current Location Button */}
      <button
        type="button"
        onClick={handleUseCurrentLocation}
        disabled={gpsLoading}
        className="w-full bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-sm py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
      >
        <Navigation className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
        <span>{gpsLoading ? 'Detecting GPS Location...' : 'Use Current Location'}</span>
      </button>

      {gpsError && (
        <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg flex items-center gap-2 border border-red-100">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 text-xs font-extrabold text-gray-400 uppercase tracking-widest">
        <span className="h-px bg-gray-200 flex-1"></span>
        <span>OR</span>
        <span className="h-px bg-gray-200 flex-1"></span>
      </div>

      {/* 3. Tap-to-Point Location & Boundary Drawing Canvas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <span>Select Location & Draw Boundary</span>
            <span className="text-[10px] bg-brand-yellow/30 text-brand-charcoal px-2 py-0.5 rounded-full font-black">
              Zoom Range: Level 22 Max
            </span>
          </label>

          {/* MAP STYLE SWITCHER */}
          <div className="relative z-20">
            <button
              type="button"
              onClick={() => setStylePickerOpen(!stylePickerOpen)}
              className="bg-white text-brand-charcoal hover:bg-gray-50 font-bold text-xs px-2.5 py-1 rounded-lg border border-gray-300 shadow-sm flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-brand-charcoal" />
              <span>{MAP_STYLES[activeMapStyle].name}</span>
            </button>

            {stylePickerOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-30">
                {Object.values(MAP_STYLES).map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => {
                      setActiveMapStyle(style.id);
                      setStylePickerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-bold transition-colors flex items-center justify-between ${
                      activeMapStyle === style.id
                        ? 'bg-brand-yellow/20 text-brand-charcoal'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{style.name}</span>
                    {activeMapStyle === style.id && (
                      <span className="w-2 h-2 rounded-full bg-brand-charcoal"></span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MAP CANVAS */}
        <div className="relative rounded-2xl overflow-hidden border-2 border-gray-200 shadow-inner h-96">
          
          <div ref={mapContainerRef} className="w-full h-full z-0"></div>

          {/* TOP INSTRUCTION BANNER WHEN IN BOUNDARY DRAWING MODE */}
          {isBoundaryMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-brand-charcoal/95 backdrop-blur-md text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl border border-brand-yellow/40 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <MousePointerClick className="w-4 h-4 text-brand-yellow animate-bounce" />
              <span>Click map to place corner | Click corner marker to remove | Drag to adjust</span>
            </div>
          )}

          {/* MODE TOGGLE & BOUNDARY CONTROLS BAR (BOTTOM LEFT) */}
          <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-md p-2 rounded-xl shadow-xl border border-gray-200 flex flex-wrap items-center gap-2 max-w-[calc(100%-24px)]">
            <button
              type="button"
              onClick={() => setIsBoundaryMode(false)}
              className={`px-3 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                !isBoundaryMode
                  ? 'bg-brand-charcoal text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-brand-yellow" />
              <span>Point Location Pin</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBoundaryMode(true)}
              className={`px-3 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                isBoundaryMode
                  ? 'bg-brand-yellow text-brand-charcoal shadow ring-2 ring-brand-yellow/50'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>Draw Land Boundary ({boundaryPoints.length} vertices)</span>
            </button>

            {/* UNDO & CLEAR ACTION BUTTONS WHEN BOUNDARY HAS POINTS */}
            {boundaryPoints.length > 0 && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
                <button
                  type="button"
                  onClick={handleUndoBoundary}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg flex items-center gap-1"
                  title="Undo Last Corner Point"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearBoundary}
                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-lg flex items-center gap-1"
                  title="Clear All Boundary Points"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRM LOCATION BUTTON */}
      <button
        type="button"
        onClick={handleConfirm}
        className="w-full bg-brand-charcoal hover:bg-brand-charcoalLight text-white font-extrabold text-sm py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2"
      >
        <CheckCircle2 className="w-5 h-5 text-brand-yellow" />
        <span>Confirm Property Location & Boundary ({boundaryPoints.length} Vertices Marked)</span>
      </button>

    </div>
  );
}
