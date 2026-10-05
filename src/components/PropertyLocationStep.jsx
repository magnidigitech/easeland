import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Search, CheckCircle2, AlertCircle, RefreshCw, Compass, Building, Map, ChevronDown, Edit3, Layers, Target } from 'lucide-react';
import { GeoPoint } from 'firebase/firestore';
import { getCurrentDeviceLocation, reverseGeocodeLocation, searchLocationQuery } from '../services/locationProvider.js';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
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

  // Auto-center map on entered address changes
  useEffect(() => {
    const parts = [
      hierarchy.address,
      hierarchy.locality,
      hierarchy.mandal,
      hierarchy.city,
      hierarchy.district,
      hierarchy.state,
      'India'
    ].filter(Boolean);

    if (parts.length < 2) return;

    const queryStr = parts.join(', ');
    const timer = setTimeout(async () => {
      try {
        const results = await searchLocationQuery(queryStr);
        if (results && results.length > 0) {
          const top = results[0];
          setLat(top.lat);
          setLng(top.lng);
        }
      } catch (e) {}
    }, 800);

    return () => clearTimeout(timer);
  }, [hierarchy.state, hierarchy.district, hierarchy.city, hierarchy.mandal, hierarchy.locality, hierarchy.postalCode, hierarchy.address]);

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

  // Search location trigger
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setErrorMsg(null);
    const results = await searchLocationQuery(searchQuery);
    setSearching(false);
    setSearchResults(results);
    if (results.length === 0) {
      setErrorMsg('No location matches found. Try entering a city or pincode.');
    }
  };

  // Select Search Result
  const handleSelectSearchResult = (result) => {
    setLat(result.lat);
    setLng(result.lng);
    setHierarchy(prev => ({
      ...prev,
      country: result.country || 'India',
      state: result.state || prev.state,
      district: result.district || prev.district,
      city: result.city || prev.city,
      mandal: result.mandal || prev.mandal,
      locality: result.locality || prev.locality,
      postalCode: result.postalCode || prev.postalCode,
      address: result.displayName
    }));
    setSearchResults([]);
    setSearchQuery('');
    setIsConfirmed(false); // Must re-confirm
  };

  // Use Current Location button trigger (Explicit one-time call)
  const handleUseCurrentLocation = async () => {
    setGeoLoading(true);
    setErrorMsg(null);
    try {
      const pos = await getCurrentDeviceLocation();
      setLat(pos.lat);
      setLng(pos.lng);
      const res = await reverseGeocodeLocation(pos.lat, pos.lng);
      setHierarchy(prev => ({
        ...prev,
        ...res
      }));
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

      {/* LOCATION METHOD SELECTION BUTTONS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* METHOD A: SEARCH LOCATION */}
        <form onSubmit={handleSearch} className="relative">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search City, Locality or PIN code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-20 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
            />
            <button
              type="submit"
              disabled={searching}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-brand-charcoal hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* SEARCH SUGGESTIONS DROPDOWN */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto">
              {searchResults.map((res, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSearchResult(res)}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-brand-yellow/20 border-b border-gray-100 last:border-0 flex items-start gap-2 text-brand-charcoal"
                >
                  <MapPin className="w-4 h-4 text-brand-yellow shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{res.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </form>

        {/* METHOD B: USE CURRENT LOCATION */}
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={geoLoading}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-3 rounded-xl shadow-sm transition-all"
        >
          <Navigation className={`w-4 h-4 ${geoLoading ? 'animate-spin' : ''}`} />
          <span>{geoLoading ? 'Acquiring GPS Position...' : 'Use Current Device Location'}</span>
        </button>
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
              placeholder="e.g. 500081"
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
