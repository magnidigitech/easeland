import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Search, CheckCircle2, AlertCircle, RefreshCw, Compass, Building, Map, ChevronDown, Edit3, Layers, Target, Sparkles, Plus, X, Loader2 } from 'lucide-react';
import { GeoPoint } from 'firebase/firestore';
import {
  getCurrentDeviceLocation,
  getCachedDeviceLocation,
  cacheDeviceLocation,
  reverseGeocodeLocation,
  searchLocationQuery,
  fetchGooglePlacesPredictions,
  fetchGooglePlaceDetails,
  loadGoogleMapsScript
} from '../services/locationProvider.js';
import { encodeGeohash } from '../utils/geohash.js';
import { isLocationLinkOrCoordinates, resolveLocationLink, parseLocationInput } from '../utils/locationLinkParser.js';
import {
  getStatesList,
  getDistrictsList,
  getCitiesList,
  getMandalsList,
  getLocalitiesList
} from '../data/indiaLocationData.js';

export default function PropertyLocationStep({ locationData, onLocationConfirmed }) {
  // Helper to determine if coordinates are an explicit property location (not the India center placeholder)
  const isCustomCoordinates = (cLat, cLng) => {
    const nLat = Number(cLat);
    const nLng = Number(cLng);
    if (isNaN(nLat) || isNaN(nLng) || (nLat === 0 && nLng === 0)) return false;
    return Math.abs(nLat - 20.5937) > 0.001 || Math.abs(nLng - 78.9629) > 0.001;
  };

  const hasPresetPropertyLocation = Boolean(
    locationData?.confirmed ||
    isCustomCoordinates(locationData?.geoPoint?.latitude ?? locationData?.lat, locationData?.geoPoint?.longitude ?? locationData?.lng) ||
    Boolean(locationData?.address && locationData?.address.trim())
  );

  const cachedDevice = !hasPresetPropertyLocation ? getCachedDeviceLocation() : null;

  const initialLat = hasPresetPropertyLocation
    ? Number(locationData?.geoPoint?.latitude || locationData?.lat || 20.5937)
    : (cachedDevice?.lat || 20.5937);

  const initialLng = hasPresetPropertyLocation
    ? Number(locationData?.geoPoint?.longitude || locationData?.lng || 78.9629)
    : (cachedDevice?.lng || 78.9629);

  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);

  // Distinguish whether coordinates represent current device location or mapped property location
  const [isPropertyLocationSet, setIsPropertyLocationSet] = useState(hasPresetPropertyLocation);
  const [isAutoAcquiringDevice, setIsAutoAcquiringDevice] = useState(!hasPresetPropertyLocation && !cachedDevice);
  const [deviceLocationAcquired, setDeviceLocationAcquired] = useState(Boolean(cachedDevice));

  // Mutable ref to prevent asynchronous device location responses from overwriting user property choices
  const isPropertyLocationSetRef = useRef(hasPresetPropertyLocation);

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

  const [addressResolving, setAddressResolving] = useState(false);
  const [addressResolveSuccess, setAddressResolveSuccess] = useState(false);
  const addressDebounceTimerRef = useRef(null);

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
      isPropertyLocationSetRef.current = true;
      setIsPropertyLocationSet(true);
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

  // On mount: Automatically acquire user device location if property location is not yet set
  useEffect(() => {
    if (isPropertyLocationSetRef.current) return;

    let isMounted = true;
    setIsAutoAcquiringDevice(true);

    getCurrentDeviceLocation({ enableHighAccuracy: true })
      .then(async (pos) => {
        if (!isMounted || isPropertyLocationSetRef.current) return;

        setLat(pos.lat);
        setLng(pos.lng);
        setDeviceLocationAcquired(true);
        setIsAutoAcquiringDevice(false);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([pos.lat, pos.lng], 16, { duration: 1.2 });
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([pos.lat, pos.lng]);
        }

        // Reverse geocode to populate state/district/mandal/locality dropdowns as starting point if blank
        try {
          const res = await reverseGeocodeLocation(pos.lat, pos.lng);
          if (!isMounted || isPropertyLocationSetRef.current) return;
          setHierarchy(prev => ({
            ...prev,
            country: prev.country || res.country || 'India',
            state: prev.state || res.state || '',
            district: prev.district || res.district || '',
            city: prev.city || res.city || '',
            mandal: prev.mandal || res.mandal || '',
            locality: prev.locality || res.locality || '',
            postalCode: prev.postalCode || res.postalCode || '',
            address: prev.address || res.address || ''
          }));
        } catch (revErr) {
          console.warn('Reverse geocode on auto device location notice:', revErr);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setIsAutoAcquiringDevice(false);
        console.warn('Auto device location acquisition notice:', err.message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync all location fields if locationData prop updates externally
  useEffect(() => {
    if (!locationData) return;
    const propLat = Number(locationData?.geoPoint?.latitude ?? locationData?.lat ?? locationData?.latitude);
    const propLng = Number(locationData?.geoPoint?.longitude ?? locationData?.lng ?? locationData?.longitude);
    const hasPin = !isNaN(propLat) && !isNaN(propLng) && (propLat !== 0 || propLng !== 0) && (Math.abs(propLat - 20.5937) > 0.001 || Math.abs(propLng - 78.9629) > 0.001);
    if (hasPin) {
      setLat(propLat);
      setLng(propLng);
      isPropertyLocationSetRef.current = true;
      setIsPropertyLocationSet(true);
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
    if (locationData.confirmed || hasPin) {
      isPropertyLocationSetRef.current = true;
      setIsPropertyLocationSet(true);
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
    isPropertyLocationSetRef.current = true;
    setIsPropertyLocationSet(true);
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
    isPropertyLocationSetRef.current = true;
    setIsPropertyLocationSet(true);
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
    isPropertyLocationSetRef.current = true;
    setIsPropertyLocationSet(true);
    setIsConfirmed(false);
    if (val === '__CUSTOM__') {
      setCustomMode(prev => ({ ...prev, city: true }));
      setHierarchy(prev => ({ ...prev, city: '', locality: '' }));
    } else {
      setCustomMode(prev => ({ ...prev, city: false, locality: false }));
      setHierarchy(prev => ({
        ...prev,
        city: val,
        locality: ''
      }));
    }
  };

  const handleMandalChange = (val) => {
    isPropertyLocationSetRef.current = true;
    setIsPropertyLocationSet(true);
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
    isPropertyLocationSetRef.current = true;
    setIsPropertyLocationSet(true);
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
      if (addressDebounceTimerRef.current) clearTimeout(addressDebounceTimerRef.current);
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
    isPropertyLocationSetRef.current = true;
    setIsPropertyLocationSet(true);
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

  // Handle paste events to immediately resolve pasted Google Maps location links or GPS coordinates
  const handlePasteLocation = async (e) => {
    const text = e.clipboardData?.getData('text');
    if (text && isLocationLinkOrCoordinates(text.trim())) {
      e.preventDefault();
      const clean = text.trim();
      setSearchQuery(clean);
      setSearching(true);
      setErrorMsg(null);
      setDropdownOpen(false);
      try {
        const resolved = await resolveLocationLink(clean);
        if (resolved && resolved.lat != null && resolved.lng != null) {
          handleSelectPrediction({
            placeId: `direct_${Date.now()}`,
            mainText: resolved.placeName || `${resolved.lat.toFixed(6)}, ${resolved.lng.toFixed(6)}`,
            secondaryText: resolved.formattedAddress,
            description: resolved.formattedAddress,
            lat: resolved.lat,
            lng: resolved.lng,
            hierarchy: resolved.hierarchy
          });
          return;
        }
      } catch (err) {
        console.warn('Paste location link error:', err);
        setErrorMsg('Failed to resolve location link: ' + err.message);
      } finally {
        setSearching(false);
      }
    }
  };

  // Handle explicit form submission / Find button
  const handleSearchSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!searchQuery.trim()) return;

    if (isLocationLinkOrCoordinates(searchQuery.trim())) {
      setSearching(true);
      setErrorMsg(null);
      setDropdownOpen(false);
      try {
        const resolved = await resolveLocationLink(searchQuery.trim());
        if (resolved && resolved.lat != null && resolved.lng != null) {
          handleSelectPrediction({
            placeId: `direct_${Date.now()}`,
            mainText: resolved.placeName || `${resolved.lat.toFixed(6)}, ${resolved.lng.toFixed(6)}`,
            secondaryText: resolved.formattedAddress,
            description: resolved.formattedAddress,
            lat: resolved.lat,
            lng: resolved.lng,
            hierarchy: resolved.hierarchy
          });
          return;
        }
      } catch (err) {
        console.warn('Resolve location link error:', err);
      } finally {
        setSearching(false);
      }
    }

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
    isPropertyLocationSetRef.current = true;
    setIsPropertyLocationSet(true);
    setGeoLoading(true);
    setErrorMsg(null);
    try {
      const pos = await getCurrentDeviceLocation({ enableHighAccuracy: true });
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

  // Auto-resolve Full Postal Street Address: Geocode, populate cascaded dropdowns, and map property pin below
  const resolveFullPostalAddress = async (rawAddress) => {
    if (!rawAddress || typeof rawAddress !== 'string') return;
    const cleanAddress = rawAddress.trim();
    if (cleanAddress.length < 4) return;

    setAddressResolving(true);
    setAddressResolveSuccess(false);

    try {
      let placeDetails = null;

      // 1. Check if user pasted/typed a location link or raw coordinates into the address field
      if (isLocationLinkOrCoordinates(cleanAddress)) {
        const resolvedLink = await resolveLocationLink(cleanAddress);
        if (resolvedLink && resolvedLink.lat != null && resolvedLink.lng != null) {
          placeDetails = {
            lat: resolvedLink.lat,
            lng: resolvedLink.lng,
            displayName: resolvedLink.formattedAddress || cleanAddress,
            hierarchy: resolvedLink.hierarchy || {}
          };
        }
      }

      // 2. Direct Google Geocoding search on the address
      if (!placeDetails) {
        const directResults = await searchLocationQuery(cleanAddress);
        if (directResults && directResults.length > 0) {
          placeDetails = {
            lat: directResults[0].lat,
            lng: directResults[0].lng,
            displayName: directResults[0].displayName,
            hierarchy: directResults[0]
          };
        }
      }

      // 3. Fallback: Google Places Autocomplete Predictions
      if (!placeDetails) {
        const predictions = await fetchGooglePlacesPredictions(cleanAddress);
        if (predictions && predictions.length > 0) {
          const topPred = predictions[0];
          const details = await fetchGooglePlaceDetails(topPred.placeId, topPred.mainText);
          if (details && !isNaN(details.lat) && !isNaN(details.lng)) {
            placeDetails = details;
          }
        }
      }

      // 4. Fallback for detailed door/plot numbers: if address has commas (e.g. "D.No 4-5-29, Chandramouli Nagar, Guntur, AP"),
      // strip the first segment (door/plot number) and geocode the locality/city part
      if (!placeDetails && cleanAddress.includes(',')) {
        const segments = cleanAddress.split(',').map(s => s.trim()).filter(Boolean);
        if (segments.length > 1) {
          const broaderQuery = segments.slice(1).join(', ');
          const broaderResults = await searchLocationQuery(broaderQuery);
          if (broaderResults && broaderResults.length > 0) {
            placeDetails = {
              lat: broaderResults[0].lat,
              lng: broaderResults[0].lng,
              displayName: broaderResults[0].displayName,
              hierarchy: broaderResults[0]
            };
          }
        }
      }

      if (placeDetails && !isNaN(placeDetails.lat) && !isNaN(placeDetails.lng)) {
        const nextLat = Number(placeDetails.lat);
        const nextLng = Number(placeDetails.lng);

        // Mark property location as set and pin on map below
        isPropertyLocationSetRef.current = true;
        setIsPropertyLocationSet(true);
        setLat(nextLat);
        setLng(nextLng);

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
        const extractedPostalCode = h.postalCode || '';

        // Match against master dynamic India location dataset
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

        setCustomMode(prev => ({
          ...prev,
          state: !!needCustomState,
          district: !!needCustomDistrict,
          city: !!needCustomCity,
          mandal: !!needCustomMandal,
          locality: !!needCustomLocality
        }));

        setHierarchy(prev => ({
          ...prev,
          country: h.country || prev.country || 'India',
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
          postalCode: extractedPostalCode || prev.postalCode,
          address: cleanAddress // Preserve user's typed street address
        }));

        setSelectedPlaceInfo({
          name: matchedLocality || matchedCity || matchedDistrict || cleanAddress.split(',')[0],
          address: placeDetails.displayName || cleanAddress
        });

        setAddressResolveSuccess(true);
        setTimeout(() => setAddressResolveSuccess(false), 4000);
        setIsConfirmed(false);
      }
    } catch (err) {
      console.warn('Address auto-resolution error:', err);
    } finally {
      setAddressResolving(false);
    }
  };

  // Confirm Final Location
  const handleConfirmLocation = () => {
    isPropertyLocationSetRef.current = true;
    setIsPropertyLocationSet(true);
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
                onPaste={handlePasteLocation}
                placeholder="Search address, locality, landmark, or paste Google Maps link..."
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
                      <div className={'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ' + (item.isLocationLink ? 'bg-amber-100 text-amber-700 group-hover:bg-amber-200' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100')}>
                        <MapPin className={'w-4 h-4 ' + (item.isLocationLink ? 'text-amber-700' : 'text-blue-600')} />
                      </div>

                      {/* Middle title and address */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-xs sm:text-sm font-bold text-gray-800 group-hover:text-blue-600 truncate transition-colors">
                          {item.mainText} {item.isLocationLink && <span className="text-[9.5px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full ml-1.5">Google Maps Pin</span>}
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
                disabled={!hierarchy.district}
                onChange={(e) => handleMandalChange(e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">
                  {!hierarchy.district ? 'Select District first...' : 'Select Mandal / Tehsil...'}
                </option>
                {mandalsList.map(mdl => (
                  <option key={mdl} value={mdl}>{mdl}</option>
                ))}
                {hierarchy.district && <option value="__CUSTOM__">+ Enter Custom Mandal...</option>}
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

        {/* FULL POSTAL STREET ADDRESS WITH AUTO-FILL DROPDOWNS & MAP TRIGGER */}
        <div className="space-y-1.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <label className="block text-[11px] font-extrabold text-gray-700 flex items-center gap-1.5">
              <span>Full Postal Street Address</span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-600" />
                <span>Auto-fills Dropdowns & Maps Property Pin</span>
              </span>
            </label>
            {addressResolving && (
              <span className="text-[11px] font-bold text-blue-600 flex items-center gap-1 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                <span>Resolving address & filling dropdowns...</span>
              </span>
            )}
            {addressResolveSuccess && !addressResolving && (
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Dropdowns filled & property mapped below ✓</span>
              </span>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Plot No., Door No., Street Name, Colony, Landmark, City, State, PIN..."
              value={hierarchy.address}
              onChange={(e) => {
                const val = e.target.value;
                setHierarchy(prev => ({ ...prev, address: val }));
                setIsConfirmed(false);
                if (addressDebounceTimerRef.current) {
                  clearTimeout(addressDebounceTimerRef.current);
                }
                if (val.trim().length >= 5) {
                  addressDebounceTimerRef.current = setTimeout(() => {
                    resolveFullPostalAddress(val);
                  }, 700);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (addressDebounceTimerRef.current) clearTimeout(addressDebounceTimerRef.current);
                  resolveFullPostalAddress(hierarchy.address);
                }
              }}
              onBlur={() => {
                if (hierarchy.address && hierarchy.address.trim().length >= 5) {
                  resolveFullPostalAddress(hierarchy.address);
                }
              }}
              onPaste={(e) => {
                const pastedText = e.clipboardData?.getData('text');
                if (pastedText && pastedText.trim().length >= 4) {
                  setTimeout(() => {
                    resolveFullPostalAddress(pastedText.trim());
                  }, 50);
                }
              }}
              className={`w-full p-3 pr-28 bg-white border-2 rounded-xl text-xs font-semibold transition-all focus:outline-none ${
                addressResolveSuccess
                  ? 'border-emerald-400 ring-2 ring-emerald-100'
                  : addressResolving
                  ? 'border-blue-400 ring-2 ring-blue-100'
                  : 'border-gray-200 focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow/30'
              }`}
            />

            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {addressResolving && (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin mr-1" />
              )}
              <button
                type="button"
                onClick={() => resolveFullPostalAddress(hierarchy.address)}
                disabled={addressResolving || !hierarchy.address || hierarchy.address.trim().length < 4}
                className="px-2.5 py-1.5 bg-brand-charcoal hover:bg-black disabled:bg-gray-200 disabled:text-gray-400 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                title="Auto-fill all dropdowns and map property coordinates from this address"
              >
                <Sparkles className="w-3 h-3 text-brand-yellow" />
                <span>Auto-Fill</span>
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 font-medium">
            💡 Enter or paste your full address here. Dropdowns (State, District, City, Mandal, Locality) will automatically populate and the property location pin will be mapped on the map below.
          </p>
        </div>
      </div>

      {/* METHOD C: INTERACTIVE MAP PIN SELECTOR & CONFIRMATION CARD */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Compass className="w-5 h-5 text-brand-yellow shrink-0" />
            <h4 className="text-xs font-extrabold text-brand-charcoal uppercase tracking-wider">
              Spatial Coordinates & Geohash
            </h4>
            {isPropertyLocationSet ? (
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-600" />
                <span>Property Location Pinned</span>
              </span>
            ) : isAutoAcquiringDevice && !deviceLocationAcquired ? (
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                <span>Acquiring Device GPS...</span>
              </span>
            ) : (
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                <Navigation className="w-3 h-3 text-blue-600" />
                <span>Current Device Location (Auto-detected)</span>
              </span>
            )}
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

        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl text-xs font-mono border transition-colors ${
          isPropertyLocationSet
            ? 'bg-slate-50 border-slate-200 text-slate-800'
            : 'bg-blue-50/70 border-blue-200 text-blue-950'
        }`}>
          <div className="flex items-center justify-between sm:justify-start gap-1.5">
            <span className={isPropertyLocationSet ? 'text-slate-500 font-bold' : 'text-blue-700 font-bold'}>Latitude:</span>
            <span className="font-semibold">
              {isAutoAcquiringDevice && !deviceLocationAcquired ? 'Detecting...' : lat.toFixed(6)}
            </span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-1.5">
            <span className={isPropertyLocationSet ? 'text-slate-500 font-bold' : 'text-blue-700 font-bold'}>Longitude:</span>
            <span className="font-semibold">
              {isAutoAcquiringDevice && !deviceLocationAcquired ? 'Detecting...' : lng.toFixed(6)}
            </span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-1.5">
            <span className={isPropertyLocationSet ? 'text-slate-500 font-bold' : 'text-blue-700 font-bold'}>Geohash:</span>
            <span className="font-semibold">
              {isAutoAcquiringDevice && !deviceLocationAcquired ? 'Detecting...' : geohash}
            </span>
            <span className={`text-[9px] font-sans font-black uppercase px-1.5 py-0.5 rounded ml-auto sm:ml-1 ${
              isPropertyLocationSet ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {isPropertyLocationSet ? 'Property' : 'Device'}
            </span>
          </div>
        </div>

        {/* INTERACTIVE LEAFLET MINI MAP CANVAS */}
        <div className="relative rounded-2xl overflow-hidden border-2 border-slate-300 shadow-md">
          <div ref={mapContainerRef} className="h-72 w-full z-10 zoomable-map" data-allow-zoom="true" />

          {/* Compact Hint Overlay Pill */}
          <div className="absolute top-3 right-3 z-20 pointer-events-none">
            <div className={`backdrop-blur-md text-[11px] font-bold px-3 py-1.5 rounded-full border shadow-md flex items-center gap-1.5 ${
              isPropertyLocationSet
                ? 'bg-slate-900/90 text-emerald-400 border-slate-700/80'
                : 'bg-slate-900/90 text-amber-400 border-slate-700/80'
            }`}>
              {isPropertyLocationSet ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Property location mapped — Click map or drag pin to adjust</span>
                </>
              ) : (
                <>
                  <Target className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                  <span>Showing device location — Click map or drag pin to map property location</span>
                </>
              )}
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
