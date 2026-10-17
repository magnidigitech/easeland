import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Search, CheckCircle2, AlertCircle, RefreshCw, Compass, Building, Map, ChevronDown, Edit3, Layers, Target, Sparkles, Plus, X, Loader2 } from 'lucide-react';
import { GeoPoint } from 'firebase/firestore';
import {
  getCurrentDeviceLocation,
  reverseGeocodeLocation,
  searchLocationQuery,
  fetchGooglePlacesPredictions,
  fetchGooglePlaceDetails,
  loadGoogleMapsScript
} from '../services/locationProvider.js';
import { encodeGeohash } from '../utils/geohash.js';
import {
  getStatesList,
  getDistrictsList,
  getCitiesList,
  getMandalsList,
  getLocalitiesList
} from '../data/indiaLocationData.js';

export default function PropertyLocationStep({ locationData, onLocationConfirmed }) {
  const [lat, setLat] = useState(locationData?.geoPoint?.latitude || locationData?.lat || 20.5937);
  const [lng, setLng] = useState(locationData?.geoPoint?.longitude || locationData?.lng || 78.9629);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [mapStyle, setMapStyle] = useState('satellite');

  const [hierarchy, setHierarchy] = useState({
    country: locationData?.country || 'India',
    state: locationData?.state || '',
    district: locationData?.district || '',
    city: locationData?.city || '',
    mandal: locationData?.mandal || '',
    locality: locationData?.locality || '',
    subLocality: locationData?.subLocality || '',
    village: locationData?.village || '',
    road: locationData?.road || '',
    colony: locationData?.colony || '',
    landmark: locationData?.landmark || '',
    postalCode: locationData?.postalCode || '',
    address: locationData?.address || ''
  });

  // Track custom manual override input modes
  const [customMode, setCustomMode] = useState({
    state: false,
    district: false,
    city: false,
    mandal: false,
    locality: false
  });

  const [searchQuery, setSearchQuery] = useState(locationData?.address || '');
  const [predictions, setPredictions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedPlaceInfo, setSelectedPlaceInfo] = useState(
    locationData?.confirmed ? { name: locationData.locality || locationData.city, address: locationData.address } : null
  );
  const searchContainerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [isConfirmed, setIsConfirmed] = useState(!!locationData?.confirmed);

  // Dynamic lists from India Location dataset
  const statesList = getStatesList();
  const districtsList = getDistrictsList(hierarchy.state);
  const citiesList = getCitiesList(hierarchy.state, hierarchy.district);
  const mandalsList = getMandalsList(hierarchy.state, hierarchy.district, hierarchy.city);
  const localitiesList = getLocalitiesList(hierarchy.state, hierarchy.district, hierarchy.city, hierarchy.mandal);

  // Compute live geohash
  const geohash = encodeGeohash(lat, lng, 9);

  // Initialize Interactive Leaflet Mini Map Canvas
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
    });

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: (lat === 20.5937 && lng === 78.9629) ? 5 : 16,
      zoomControl: true,
      attributionControl: false
    });

    const tileUrl = mapStyle === 'satellite'
      ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
      : 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 21,
      subdomains: '0123'
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    const customMarkerIcon = L.divIcon({
      className: 'custom-location-pin',
      html: `
        <div style="
          width: 38px;
          height: 38px;
          background: #0f172a;
          border: 3px solid #f59e0b;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 14px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 12px;
            height: 12px;
            background: #f59e0b;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 38]
    });

    const marker = L.marker([lat, lng], {
      draggable: true,
      icon: customMarkerIcon
    }).addTo(map);

    marker.bindPopup('Drag pin or click map to set exact property location');

    const handlePinPositionChange = async (newLat, newLng) => {
      setLat(newLat);
      setLng(newLng);
      setIsConfirmed(false);
    };

    marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      handlePinPositionChange(pos.lat, pos.lng);
    });

    map.on('click', (e) => {
      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;
      marker.setLatLng([clickedLat, clickedLng]);
      handlePinPositionChange(clickedLat, clickedLng);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map view & marker when lat/lng state changes from external triggers
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([lat, lng], Math.max(mapInstanceRef.current.getZoom(), 15));
      markerRef.current.setLatLng([lat, lng]);
    }
  }, [lat, lng]);

  // Sync all location fields if locationData prop updates externally
  useEffect(() => {
    if (!locationData) return;
    const propLat = Number(locationData?.geoPoint?.latitude ?? locationData?.lat ?? locationData?.latitude);
    const propLng = Number(locationData?.geoPoint?.longitude ?? locationData?.lng ?? locationData?.longitude);
    if (!isNaN(propLat) && !isNaN(propLng) && (propLat !== 0 || propLng !== 0) && (propLat !== 20.5937 || propLng !== 78.9629)) {
      setLat(propLat);
      setLng(propLng);
    }
    setHierarchy({
      country: locationData.country || 'India',
      state: locationData.state || '',
      district: locationData.district || '',
      city: locationData.city || '',
      mandal: locationData.mandal || '',
      locality: locationData.locality || '',
      subLocality: locationData.subLocality || '',
      village: locationData.village || '',
      road: locationData.road || '',
      colony: locationData.colony || '',
      landmark: locationData.landmark || '',
      postalCode: locationData.postalCode || '',
      address: locationData.address || ''
    });
    if (locationData.address) {
      setSearchQuery(locationData.address);
    }
    const hasPin = !isNaN(propLat) && !isNaN(propLng) && (propLat !== 0 || propLng !== 0) && (propLat !== 20.5937 || propLng !== 78.9629);
    if (locationData.confirmed || hasPin) {
      setIsConfirmed(true);
      setSelectedPlaceInfo({
        name: locationData.locality || locationData.city || locationData.address || 'Selected Location',
        address: locationData.address || ((locationData.locality ? locationData.locality + ', ' : '') + (locationData.city || ''))
      });
    }
  }, [locationData]);

  // Dynamic Tile Layer style toggle
  const handleMapStyleToggle = () => {
    const nextStyle = mapStyle === 'roadmap' ? 'satellite' : 'roadmap';
    setMapStyle(nextStyle);
    if (tileLayerRef.current) {
      const url = nextStyle === 'satellite'
        ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      tileLayerRef.current.setUrl(url);
    }
  };

  // Handlers for cascaded dropdown selections
  const handleStateChange = (val) => {
    setIsConfirmed(false);
    if (val === '__CUSTOM__') {
      setCustomMode(prev => ({ ...prev, state: true }));
      setHierarchy(prev => ({ ...prev, state: '', district: '', city: '', mandal: '', locality: '' }));
    } else {
      setCustomMode(prev => ({ ...prev, state: false, district: false, city: false, mandal: false, locality: false }));
      setHierarchy(prev => ({
        ...prev,
        state: val,
        district: '',
        city: '',
        mandal: '',
        locality: ''
      }));
    }
  };

  const handleDistrictChange = (val) => {
    setIsConfirmed(false);
    if (val === '__CUSTOM__') {
      setCustomMode(prev => ({ ...prev, district: true }));
      setHierarchy(prev => ({ ...prev, district: '', city: '', mandal: '', locality: '' }));
    } else {
      setCustomMode(prev => ({ ...prev, district: false, city: false, mandal: false, locality: false }));
      setHierarchy(prev => ({
        ...prev,
        district: val,
        city: '',
        mandal: '',
        locality: ''
      }));
    }
  };

  const handleCityChange = (val) => {
    setIsConfirmed(false);
    if (val === '__CUSTOM__') {
      setCustomMode(prev => ({ ...prev, city: true }));
      setHierarchy(prev => ({ ...prev, city: '', mandal: '', locality: '' }));
    } else {
      setCustomMode(prev => ({ ...prev, city: false, mandal: false, locality: false }));
      setHierarchy(prev => ({
        ...prev,
        city: val,
        mandal: '',
        locality: ''
      }));
    }
  };

  const handleMandalChange = (val) => {
    setIsConfirmed(false);
    if (val === '__CUSTOM__') {
      setCustomMode(prev => ({ ...prev, mandal: true }));
      setHierarchy(prev => ({ ...prev, mandal: '', locality: '' }));
    } else {
      setCustomMode(prev => ({ ...prev, mandal: false, locality: false }));
      setHierarchy(prev => ({
        ...prev,
        mandal: val,
        locality: ''
      }));
    }
  };

  const handleLocalityChange = (val) => {
    setIsConfirmed(false);
    if (val === '__CUSTOM__') {
      setCustomMode(prev => ({ ...prev, locality: true }));
      setHierarchy(prev => ({ ...prev, locality: '' }));
    } else {
      setCustomMode(prev => ({ ...prev, locality: false }));
      setHierarchy(prev => ({ ...prev, locality: val }));
    }
  };

  // Preload Google Maps JS SDK on mount
  useEffect(() => {
    loadGoogleMapsScript().catch(err => {
      console.warn('Google Maps JS SDK script preload error:', err);
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
    setErrorMsg(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

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
        console.warn('Google Places predictions error:', err);
      } finally {
        setSearching(false);
      }
    }, 250);
  };

  // Select Place Suggestion & Deep Autofill Hierarchy
  const handleSelectPrediction = async (item) => {
    setDropdownOpen(false);
    setSearchQuery(item.mainText);
    setSearching(true);
    setErrorMsg(null);

    try {
      let placeDetails = null;
      if (item.lat && item.lng && item.hierarchy) {
        placeDetails = {
          lat: item.lat,
          lng: item.lng,
          displayName: item.description,
          hierarchy: item.hierarchy
        };
      } else {
        placeDetails = await fetchGooglePlaceDetails(item.placeId, item.mainText);
      }

      if (!placeDetails || isNaN(placeDetails.lat) || isNaN(placeDetails.lng)) {
        const fallbackResults = await searchLocationQuery(item.description || item.mainText);
        if (fallbackResults && fallbackResults[0]) {
          placeDetails = fallbackResults[0];
        }
      }

      if (placeDetails && !isNaN(placeDetails.lat) && !isNaN(placeDetails.lng)) {
        const nextLat = Number(placeDetails.lat);
        const nextLng = Number(placeDetails.lng);

        setLat(nextLat);
        setLng(nextLng);

        // Center Leaflet map and move pin marker
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([nextLat, nextLng], 17, { duration: 1.2 });
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([nextLat, nextLng]);
        }

        const h = placeDetails.hierarchy || {};
        const extractedState = h.state || '';
        const extractedDistrict = h.district || '';
        const extractedCity = h.city || '';
        const extractedMandal = h.mandal || '';
        const extractedLocality = h.locality || '';

        // Match against dynamic India Location Dataset
        const allStates = getStatesList();
        const matchedState = allStates.find(s => s.toLowerCase() === extractedState.toLowerCase()) || extractedState;

        const currentDistricts = getDistrictsList(matchedState);
        const matchedDistrict = currentDistricts.find(d =>
          d.toLowerCase() === extractedDistrict.toLowerCase() ||
          extractedDistrict.toLowerCase().includes(d.toLowerCase()) ||
          d.toLowerCase().includes(extractedDistrict.toLowerCase())
        ) || extractedDistrict;

        const currentCities = getCitiesList(matchedState, matchedDistrict);
        const matchedCity = currentCities.find(c =>
          c.toLowerCase() === extractedCity.toLowerCase() ||
          extractedCity.toLowerCase().includes(c.toLowerCase()) ||
          c.toLowerCase().includes(extractedCity.toLowerCase())
        ) || extractedCity;

        const currentMandals = getMandalsList(matchedState, matchedDistrict, matchedCity);
        const matchedMandal = currentMandals.find(m =>
          m.toLowerCase() === extractedMandal.toLowerCase() ||
          extractedMandal.toLowerCase().includes(m.toLowerCase())
        ) || extractedMandal;

        const currentLocalities = getLocalitiesList(matchedState, matchedDistrict, matchedCity, matchedMandal);
        const matchedLocality = currentLocalities.find(l =>
          l.toLowerCase() === extractedLocality.toLowerCase() ||
          extractedLocality.toLowerCase().includes(l.toLowerCase())
        ) || extractedLocality;

        // Custom mode auto-activation if non-empty and not present in static lists
        const needCustomState = extractedState && !allStates.includes(matchedState);
        const needCustomDistrict = extractedDistrict && !currentDistricts.includes(matchedDistrict);
        const needCustomCity = extractedCity && !currentCities.includes(matchedCity);
        const needCustomMandal = extractedMandal && !currentMandals.includes(matchedMandal);
        const needCustomLocality = extractedLocality && !currentLocalities.includes(matchedLocality);

        setCustomMode({
          state: !!needCustomState,
          district: !!needCustomDistrict,
          city: !!needCustomCity,
          mandal: !!needCustomMandal,
          locality: !!needCustomLocality
        });

        setHierarchy(prev => ({
          ...prev,
          country: h.country || 'India',
          state: matchedState || prev.state,
          district: matchedDistrict || prev.district,
          city: matchedCity || prev.city,
          mandal: matchedMandal || prev.mandal,
          locality: matchedLocality || prev.locality,
          subLocality: h.subLocality || prev.subLocality,
          village: h.village || prev.village,
          road: h.road || prev.road,
          colony: h.colony || prev.colony,
          landmark: h.landmark || prev.landmark,
          postalCode: h.postalCode || prev.postalCode,
          address: placeDetails.displayName || h.address || prev.address
        }));

        setSelectedPlaceInfo({
          name: item.mainText,
          address: placeDetails.displayName || item.secondaryText
        });
        setIsConfirmed(false); // Owner should review & confirm
      } else {
        setErrorMsg('Could not resolve precise coordinates for this place. Please refine search.');
      }
    } catch (err) {
      console.warn('Place selection error:', err);
      setErrorMsg('Failed to fetch place details: ' + err.message);
    } finally {
      setSearching(false);
    }
  };

  // Handle explicit form submission / Find button
  const handleSearchSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!searchQuery.trim()) return;

    if (predictions.length > 0) {
      handleSelectPrediction(predictions[0]);
      return;
    }

    setSearching(true);
    setErrorMsg(null);
    try {
      const results = await fetchGooglePlacesPredictions(searchQuery);
      if (results.length > 0) {
        setPredictions(results);
        setDropdownOpen(true);
      } else {
        const directGeocode = await searchLocationQuery(searchQuery);
        if (directGeocode.length > 0) {
          const r = directGeocode[0];
          handleSelectPrediction({
            placeId: `direct_${Date.now()}`,
            mainText: r.displayName.split(',')[0],
            secondaryText: r.displayName.split(',').slice(1).join(',').trim(),
            description: r.displayName,
            lat: r.lat,
            lng: r.lng,
            hierarchy: r
          });
        } else {
          setErrorMsg('No location matches found. Try entering a city or landmark.');
        }
      }
    } catch (err) {
      setErrorMsg('Search failed: ' + err.message);
    } finally {
      setSearching(false);
    }
  };

  // Use Current Location button trigger (Explicit one-time call)
  const handleUseCurrentLocation = async () => {
    setGeoLoading(true);
    setErrorMsg(null);
    try {
      const pos = await getCurrentDeviceLocation();
      setLat(pos.lat);
      setLng(pos.lng);

      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([pos.lat, pos.lng], 17, { duration: 1.2 });
      }
      if (markerRef.current) {
        markerRef.current.setLatLng([pos.lat, pos.lng]);
      }

      const res = await reverseGeocodeLocation(pos.lat, pos.lng);
      setHierarchy(prev => ({
        ...prev,
        ...res
      }));
      setSelectedPlaceInfo({
        name: res.locality || res.city || 'Current GPS Location',
        address: res.address || `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`
      });
      setIsConfirmed(false); // Must re-confirm
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setGeoLoading(false);
    }
  };

  // Confirm Final Location
  const handleConfirmLocation = () => {
    setIsConfirmed(true);
    const finalLocationObject = {
      ...hierarchy,
      geoPoint: new GeoPoint(lat, lng),
      geohash,
      lat,
      lng,
      confirmed: true
    };
    onLocationConfirmed(finalLocationObject);
  };

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-brand-charcoal">
            3. Dedicated Property Location
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Pan-India geographic resolution & spatial coordinate pinning.
          </p>
        </div>
        <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-brand-yellow text-brand-charcoal rounded-full">
          Mandatory Step
        </span>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* LOCATION (GOOGLE PLACES SEARCH) HEADER & SEARCH BAR */}
      <div className="space-y-2">
        <label className="block text-xs sm:text-sm font-extrabold text-brand-charcoal">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-red-500 text-sm">📍</span>
            <span>Location (Google Places Search)</span>
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
          {/* SEARCH INPUT WITH LIVE GOOGLE PLACES DROPDOWN */}
          <div ref={searchContainerRef} className="sm:col-span-8 relative">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
              <input
                type="text"
                placeholder="Search address, locality, business or landmark..."
                value={searchQuery}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => {
                  if (predictions.length > 0) setDropdownOpen(true);
                }}
                className="w-full pl-11 pr-24 py-3.5 bg-white border-2 border-blue-400 focus:border-blue-600 rounded-full sm:rounded-2xl text-xs sm:text-sm font-semibold shadow-sm focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all placeholder:text-gray-400"
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
                      setSelectedPlaceInfo(null);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-brand-charcoal hover:bg-black text-white text-[11px] font-bold rounded-lg transition-colors"
                >
                  Find
                </button>
              </div>
            </form>

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
                      {/* Left icon in blue rounded badge */}
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                        <MapPin className="w-4 h-4 text-blue-600" />
                      </div>

                      {/* Middle title and address */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-xs sm:text-sm font-bold text-gray-800 group-hover:text-blue-600 truncate transition-colors">
                          {item.mainText}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate mt-0.5">
                          {item.secondaryText || item.description}
                        </div>
                      </div>

                      {/* Right plus icon in blue circular badge */}
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-blue-500 bg-blue-50/80 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* METHOD B: USE CURRENT LOCATION BUTTON */}
          <div className="sm:col-span-4">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={geoLoading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-3.5 rounded-xl sm:rounded-2xl shadow-sm transition-all"
            >
              <Navigation className={`w-4 h-4 ${geoLoading ? 'animate-spin' : ''}`} />
              <span>{geoLoading ? 'Acquiring GPS...' : 'Use Current Device GPS'}</span>
            </button>
          </div>
        </div>

        {/* ACTIVE SELECTION CONFIRMATION BADGE */}
        {selectedPlaceInfo && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="truncate">
                <span className="font-extrabold">{selectedPlaceInfo.name}</span>
                {selectedPlaceInfo.address && (
                  <span className="text-blue-700 ml-1.5 font-medium truncate">
                    ({selectedPlaceInfo.address})
                  </span>
                )}
                <span className="ml-2 text-[10px] font-black uppercase tracking-wider bg-blue-200/70 text-blue-800 px-2 py-0.5 rounded-full">
                  Google Places Autofilled
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPlaceInfo(null)}
              className="text-blue-500 hover:text-blue-700 font-bold text-[11px] shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* PAN-INDIA DEPENDENT CASCADED HIERARCHY DROPDOWNS */}
      <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-200 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
            <Building className="w-4 h-4 text-brand-yellow" />
            <span>Pan-India Location Hierarchy (Cascaded Dropdowns)</span>
          </h4>
          <span className="text-[10px] text-gray-400 font-semibold">
            State &rarr; District &rarr; City &rarr; Mandal &rarr; Locality
          </span>
        </div>

        {/* ROW 1: STATE -> DISTRICT -> CITY/TOWN */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. STATE / UT DROPDOWN */}
          <div>
            <label className="block text-[11px] font-extrabold text-gray-600 mb-1">
              State / UT <span className="text-red-500">*</span>
            </label>
            {!customMode.state ? (
              <select
                value={hierarchy.state}
                onChange={(e) => handleStateChange(e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              >
                <option value="">Select State / UT...</option>
                {statesList.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
                <option value="__CUSTOM__">+ Enter Custom State...</option>
              </select>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Enter State Name"
                  value={hierarchy.state}
                  onChange={(e) => { setHierarchy({ ...hierarchy, state: e.target.value }); setIsConfirmed(false); }}
                  className="w-full p-2.5 bg-white border border-brand-yellow rounded-xl text-xs font-semibold focus:outline-none"
                />
                <button
                  type="button"
                  title="Switch to Dropdown"
                  onClick={() => setCustomMode(prev => ({ ...prev, state: false }))}
                  className="p-2 bg-gray-200 hover:bg-gray-300 rounded-xl text-gray-600"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 2. DISTRICT DROPDOWN */}
          <div>
            <label className="block text-[11px] font-extrabold text-gray-600 mb-1">
              District <span className="text-red-500">*</span>
            </label>
            {!customMode.district ? (
              <select
                value={hierarchy.district}
                disabled={!hierarchy.state}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">
                  {!hierarchy.state ? 'Select State first...' : 'Select District...'}
                </option>
                {districtsList.map(dst => (
                  <option key={dst} value={dst}>{dst}</option>
                ))}
                {hierarchy.state && <option value="__CUSTOM__">+ Enter Custom District...</option>}
              </select>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Enter District Name"
                  value={hierarchy.district}
                  onChange={(e) => { setHierarchy({ ...hierarchy, district: e.target.value }); setIsConfirmed(false); }}
                  className="w-full p-2.5 bg-white border border-brand-yellow rounded-xl text-xs font-semibold focus:outline-none"
                />
                <button
                  type="button"
                  title="Switch to Dropdown"
                  onClick={() => setCustomMode(prev => ({ ...prev, district: false }))}
                  className="p-2 bg-gray-200 hover:bg-gray-300 rounded-xl text-gray-600"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 3. CITY / TOWN DROPDOWN */}
          <div>
            <label className="block text-[11px] font-extrabold text-gray-600 mb-1">
              City / Town <span className="text-red-500">*</span>
            </label>
            {!customMode.city ? (
              <select
                value={hierarchy.city}
                disabled={!hierarchy.district}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">
                  {!hierarchy.district ? 'Select District first...' : 'Select City / Town...'}
                </option>
                {citiesList.map(cty => (
                  <option key={cty} value={cty}>{cty}</option>
                ))}
                {hierarchy.district && <option value="__CUSTOM__">+ Enter Custom City...</option>}
              </select>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Enter City / Town Name"
                  value={hierarchy.city}
                  onChange={(e) => { setHierarchy({ ...hierarchy, city: e.target.value }); setIsConfirmed(false); }}
                  className="w-full p-2.5 bg-white border border-brand-yellow rounded-xl text-xs font-semibold focus:outline-none"
                />
                <button
                  type="button"
                  title="Switch to Dropdown"
                  onClick={() => setCustomMode(prev => ({ ...prev, city: false }))}
                  className="p-2 bg-gray-200 hover:bg-gray-300 rounded-xl text-gray-600"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: MANDAL/TEHSIL -> LOCALITY/NEIGHBORHOOD -> PIN CODE */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 4. MANDAL / TEHSIL DROPDOWN */}
          <div>
            <label className="block text-[11px] font-extrabold text-gray-600 mb-1">
              Mandal / Tehsil
            </label>
            {!customMode.mandal ? (
              <select
                value={hierarchy.mandal}
                disabled={!hierarchy.city}
                onChange={(e) => handleMandalChange(e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">
                  {!hierarchy.city ? 'Select City first...' : 'Select Mandal / Tehsil...'}
                </option>
                {mandalsList.map(mdl => (
                  <option key={mdl} value={mdl}>{mdl}</option>
                ))}
                {hierarchy.city && <option value="__CUSTOM__">+ Enter Custom Mandal...</option>}
              </select>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Enter Mandal / Tehsil Name"
                  value={hierarchy.mandal}
                  onChange={(e) => { setHierarchy({ ...hierarchy, mandal: e.target.value }); setIsConfirmed(false); }}
                  className="w-full p-2.5 bg-white border border-brand-yellow rounded-xl text-xs font-semibold focus:outline-none"
                />
                <button
                  type="button"
                  title="Switch to Dropdown"
                  onClick={() => setCustomMode(prev => ({ ...prev, mandal: false }))}
                  className="p-2 bg-gray-200 hover:bg-gray-300 rounded-xl text-gray-600"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 5. LOCALITY / NEIGHBORHOOD DROPDOWN */}
          <div>
            <label className="block text-[11px] font-extrabold text-gray-600 mb-1">
              Locality / Neighborhood
            </label>
            {!customMode.locality ? (
              <select
                value={hierarchy.locality}
                disabled={!hierarchy.mandal && mandalsList.length > 0}
                onChange={(e) => handleLocalityChange(e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">
                  {!hierarchy.mandal && mandalsList.length > 0 ? 'Select Mandal first...' : 'Select Locality...'}
                </option>
                {localitiesList.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
                <option value="__CUSTOM__">+ Enter Custom Locality...</option>
              </select>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Enter Locality Name"
                  value={hierarchy.locality}
                  onChange={(e) => { setHierarchy({ ...hierarchy, locality: e.target.value }); setIsConfirmed(false); }}
                  className="w-full p-2.5 bg-white border border-brand-yellow rounded-xl text-xs font-semibold focus:outline-none"
                />
                <button
                  type="button"
                  title="Switch to Dropdown"
                  onClick={() => setCustomMode(prev => ({ ...prev, locality: false }))}
                  className="p-2 bg-gray-200 hover:bg-gray-300 rounded-xl text-gray-600"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 6. PIN CODE INPUT */}
          <div>
            <label className="block text-[11px] font-extrabold text-gray-600 mb-1">PIN Code</label>
            <input
              type="text"
              maxLength={6}
              placeholder="Enter 6-digit PIN code"
              value={hierarchy.postalCode}
              onChange={(e) => { setHierarchy({ ...hierarchy, postalCode: e.target.value.replace(/\D/g, '') }); setIsConfirmed(false); }}
              className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
            />
          </div>
        </div>

        {/* FULL POSTAL STREET ADDRESS */}
        <div>
          <label className="block text-[11px] font-extrabold text-gray-600 mb-1">Full Postal Street Address</label>
          <input
            type="text"
            placeholder="Plot No., Door No., Street Name, Colony / Landmark"
            value={hierarchy.address}
            onChange={(e) => { setHierarchy({ ...hierarchy, address: e.target.value }); setIsConfirmed(false); }}
            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
          />
        </div>
      </div>

      {/* METHOD C: INTERACTIVE MAP PIN SELECTOR & CONFIRMATION CARD */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-brand-yellow" />
            <h4 className="text-xs font-extrabold text-brand-charcoal uppercase tracking-wider">
              Spatial Coordinates & Geohash
            </h4>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleMapStyleToggle}
              className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-brand-navy" />
              <span>{mapStyle === 'roadmap' ? 'Satellite View' : 'Standard View'}</span>
            </button>
            <span className="text-[11px] font-bold text-gray-500 font-mono hidden sm:inline">
              Geohash: {geohash}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl text-xs font-mono border border-slate-200">
          <div><span className="text-slate-500 font-bold">Latitude:</span> {lat.toFixed(6)}</div>
          <div><span className="text-slate-500 font-bold">Longitude:</span> {lng.toFixed(6)}</div>
          <div><span className="text-slate-500 font-bold">Geohash:</span> {geohash}</div>
        </div>

        {/* INTERACTIVE LEAFLET MINI MAP CANVAS */}
        <div className="relative rounded-2xl overflow-hidden border-2 border-slate-300 shadow-md">
          <div ref={mapContainerRef} className="h-72 w-full z-10" />

          {/* Compact Hint Overlay Pill */}
          <div className="absolute top-3 right-3 z-20 pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur-md text-amber-400 text-[11px] font-bold px-3 py-1.5 rounded-full border border-slate-700/80 shadow-md flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
              <span>Click map or drag pin to set location</span>
            </div>
          </div>

          {/* Re-center button overlay */}
          <button
            type="button"
            onClick={() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.setView([lat, lng], 17);
              }
            }}
            className="absolute bottom-3 right-3 z-20 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl shadow-lg border border-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-brand-navy" />
            <span>Center on Pin</span>
          </button>
        </div>

        {/* LOCATION CONFIRMATION ACTION */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100">
          <div>
            <span className="block text-xs font-bold text-brand-charcoal">
              {hierarchy.locality ? `${hierarchy.locality}, ${hierarchy.city}` : hierarchy.city || 'Selected Location'}
            </span>
            <span className="block text-[11px] text-gray-500 font-medium">
              {hierarchy.state ? `${hierarchy.state}, India` : 'India'} {hierarchy.postalCode ? `— ${hierarchy.postalCode}` : ''}
            </span>
          </div>

          <button
            type="button"
            onClick={handleConfirmLocation}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
              isConfirmed
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal shadow-lg'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isConfirmed ? 'Location Confirmed ✓' : 'Confirm Location'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
