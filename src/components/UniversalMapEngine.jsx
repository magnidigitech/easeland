import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from '../utils/leafletGlobal';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  ShieldCheck, Heart, ChevronRight, ChevronLeft, X, Building, Layers, MapPin, Compass,
  Check, Car, Bus, Bike, Mountain, Bed, Bath, Sofa, Sparkles, CheckCircle2, Calendar, ExternalLink, Video
} from 'lucide-react';
import { deduplicateProperties, mockApi } from '../services/mockApi';
import { extractCoordinates, extractBoundaryPolygon, fetchGooglePlacesPredictions, fetchGooglePlaceDetails, searchLocationQuery } from '../services/locationProvider';
import {
  getCategoryBadgeLabel,
  getFirstUploadedImage,
  getCategoryFallbackImage,
  getPropertyMediaList,
  getPropertyPhotosList,
  getPropertyVideosList
} from '../utils/categoryUtils';
import { matchesSearchFilters, isPropertyDeleted, isPropertyPubliclyVisible } from '../utils/filterMatchingUtils.js';

// Helper: Create custom EaseLand circular cluster badge with property count
function createEaseLandClusterIcon(cluster) {
  const count = cluster.getChildCount();

  // Compact, refined badge dimensions to keep clusters clean and within territorial bounds
  let size = 26;
  let fontSize = 11.5;
  let strokeWidth = 1.5;

  if (count >= 100) {
    size = 38;
    fontSize = 13;
    strokeWidth = 2;
  } else if (count >= 50) {
    size = 34;
    fontSize = 12.5;
    strokeWidth = 2;
  } else if (count >= 10) {
    size = 30;
    fontSize = 12;
    strokeWidth = 2;
  }

  return L.divIcon({
    html: `
      <div class="easeland-cluster-badge-wrapper" style="
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div class="easeland-cluster-badge" style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border: ${strokeWidth}px solid #ffffff;
          box-shadow: 0 2px 8px rgba(11, 37, 69, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 800;
          font-size: ${fontSize}px;
          line-height: 1;
          letter-spacing: -0.2px;
          user-select: none;
          cursor: pointer;
        " title="${count} Verified Properties">
          <span>${count}</span>
        </div>
      </div>
    `,
    className: 'easeland-cluster-custom-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}


export default function UniversalMapEngine({
  properties = [],
  filters = {},
  setFilters,
  onSelectProperty,
  onWishlistToggle,
  isWishlisted,
  focusedProperty = null,
  hideSidePanel = false,
  onApplyFilters = null,
  isSidePanelOpen: controlledSidePanelOpen,
  setIsSidePanelOpen: setControlledSidePanelOpen
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const trafficLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const userLocationMarkerRef = useRef(null);
  const searchLocationMarkerRef = useRef(null);
  const searchRadiusCircleRef = useRef(null);

  // Guarantee ZERO duplicate listings in sidebar drawer or on map canvas, filtered by active search filters
  const displayProperties = useMemo(() => {
    const raw = deduplicateProperties(properties);
    const filtered = raw.filter(p => !isPropertyDeleted(p) && isPropertyPubliclyVisible(p) && matchesSearchFilters(p, filters));
    const hasDistanceSearch = filters?.radiusKm != null || filters?.referenceLat != null || filters?.nearbyPlace;
    if (hasDistanceSearch) {
      filtered.sort((a, b) => {
        if (a.distKm != null && b.distKm != null) {
          return a.distKm - b.distKm;
        }
        if (a.distKm != null) return -1;
        if (b.distKm != null) return 1;
        return 0;
      });
    }
    return filtered;
  }, [properties, filters]);

  const [internalSidePanelOpen, setInternalSidePanelOpen] = useState(!hideSidePanel);
  const isSidePanelOpen = controlledSidePanelOpen !== undefined ? controlledSidePanelOpen : internalSidePanelOpen;
  const setIsSidePanelOpen = setControlledSidePanelOpen || setInternalSidePanelOpen;
  const [selectedPropertyPreview, setSelectedPropertyPreview] = useState(null);
  const [previewMediaIndex, setPreviewMediaIndex] = useState(0);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  // Smooth pan to property with standard zoom (level 17) and open preview card
  const handleSelectPropertyForPreview = (prop) => {
    if (!prop) return;
    setSelectedPropertyPreview(prop);
    setPreviewMediaIndex(0);

    const coords = extractCoordinates(prop);
    const lat = coords?.lat;
    const lng = coords?.lng;

    if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
      if (mapInstanceRef.current) {
        // Standard Zoom (level 17): High resolution view of plot, boundary and street context without tile distortion
        mapInstanceRef.current.setView([lat, lng], 17, { animate: true });
      }
    }

    // On mobile screens (< 768px), collapse side panel drawer so the user immediately sees the map and details pop up card
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidePanelOpen(false);
    }
  };

  // Sync with focusedProperty if passed from parent
  useEffect(() => {
    if (focusedProperty) {
      handleSelectPropertyForPreview(focusedProperty);
    }
  }, [focusedProperty]);

  // Google Maps Layers State
  const [mapType, setMapType] = useState('satellite'); // 'satellite' by default, 'default' (roadmap)
  const [showLabels, setShowLabels] = useState(true); // Satellite labels toggle
  const [activeDetail, setActiveDetail] = useState(null); // null, 'terrain', 'traffic', 'transit', 'biking'
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [isLayerHovered, setIsLayerHovered] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(13);

  // Compute exact Google Maps Tile URL based on selected Map Type & Detail Layer
  const getGoogleTileUrl = () => {
    if (activeDetail === 'terrain') {
      return { url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', subdomains: '0123', maxZoom: 22, maxNativeZoom: 20 };
    }

    if (mapType === 'satellite') {
      if (showLabels) {
        return { url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', subdomains: '0123', maxZoom: 22, maxNativeZoom: 20 };
      } else {
        return { url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', subdomains: '0123', maxZoom: 22, maxNativeZoom: 20 };
      }
    }

    // Default Roadmap
    return { url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', subdomains: '0123', maxZoom: 22, maxNativeZoom: 20 };
  };

  // Helper to safely clamp zoom level between 1 (World) and 22 (Max Ultra-Close)
  const getClampedZoom = (rawZoom, fallback = 13) => {
    const parsed = Number(rawZoom);
    if (isNaN(parsed) || parsed <= 0) return fallback;
    return Math.min(22, Math.max(1, parsed));
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Prevent double init

    const siteConfig = mockApi.getSiteConfig();
    const defLat = siteConfig.mapsConfig?.defaultLat || 16.3124;
    const defLng = siteConfig.mapsConfig?.defaultLng || 80.4285;
    const initialZoom = getClampedZoom(siteConfig.mapsConfig?.defaultZoom, 13);

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      maxZoom: 22,
      attributionControl: false
    }).setView([defLat, defLng], initialZoom);

    // Initial Tile Layer (Google Roadmap)
    const initialConfig = getGoogleTileUrl();
    const tileLayer = L.tileLayer(initialConfig.url, {
      maxZoom: initialConfig.maxZoom,
      maxNativeZoom: initialConfig.maxNativeZoom,
      subdomains: initialConfig.subdomains
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Add Zoom Control top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Layer groups for markers & polygons (Smart Clustering for Markers)
    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      removeOutsideVisibleBounds: true,
      animate: true,
      animateAddingMarkers: false,
      maxClusterRadius: 40,
      disableClusteringAtZoom: 18,
      iconCreateFunction: createEaseLandClusterIcon
    });

    if (initialZoom >= 5) {
      clusterGroup.addTo(map);
    }
    markersLayerRef.current = clusterGroup;
    polygonLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Dynamically update zoom state & marker popup text on zoom in / out
    const handleZoomChange = () => {
      const activeZoom = map.getZoom();
      setCurrentZoom(activeZoom);

      // Numbers Visibility Threshold:
      // When zoomed out to global or continental scales (zoom < 5), hide numbers so they do not overflow out of India.
      // As soon as the user zooms into India (zoom >= 5), restore numbers visibility.
      if (markersLayerRef.current) {
        if (activeZoom < 5) {
          if (map.hasLayer(markersLayerRef.current)) {
            map.removeLayer(markersLayerRef.current);
          }
        } else {
          if (!map.hasLayer(markersLayerRef.current)) {
            map.addLayer(markersLayerRef.current);
          }
        }
      }

      if (userLocationMarkerRef.current) {
        const isAdjusted = filters?.locationAdjusted;
        const titleText = isAdjusted ? 'Adjusted Location' : 'YOUR CURRENT LOCATION';
        const bodyText = isAdjusted ? 'Exact Location Confirmed' : '📍 You Are Here';
        
        userLocationMarkerRef.current.setPopupContent(
          '<div style="font-family: \'Plus Jakarta Sans\', sans-serif; background: #ffffff; padding: 12px 14px; min-width: 200px; max-width: 270px; border-radius: 14px; text-align: center;">' +
            '<div style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; padding: 2.5px 8px; border-radius: 9999px; display: inline-block; letter-spacing: 0.5px; margin-bottom: 6px;">' +
              titleText +
            '</div>' +
            '<div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-top: 2px;">' +
              bodyText +
            '</div>' +
            '<div style="font-size: 10px; font-weight: 600; color: #64748b; margin-top: 5px;">Click pin anytime to zoom to MAX (Level 22)</div>' +
          '</div>'
        );
      }
    };

    map.on('zoomend', handleZoomChange);
    map.on('zoom', handleZoomChange);
    setCurrentZoom(initialZoom);

    // Listen for live site config updates (e.g. Admin changes center lat/lng or zoom)
    const handleConfigUpdated = (e) => {
      const cfg = e.detail || mockApi.getSiteConfig();
      if (mapInstanceRef.current && cfg.mapsConfig) {
        const newLat = cfg.mapsConfig.defaultLat || 16.3124;
        const newLng = cfg.mapsConfig.defaultLng || 80.4285;
        const newZoom = getClampedZoom(cfg.mapsConfig.defaultZoom, 13);
        mapInstanceRef.current.setView([newLat, newLng], newZoom, { animate: true });
      }
    };

    window.addEventListener('easeland-site-config-updated', handleConfigUpdated);

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.off('zoomend', handleZoomChange);
      map.off('zoom', handleZoomChange);
      window.removeEventListener('easeland-site-config-updated', handleConfigUpdated);
      if (markersLayerRef.current) {
        try { markersLayerRef.current.clearLayers(); } catch (e) {}
      }
      if (polygonLayerRef.current) {
        try { polygonLayerRef.current.clearLayers(); } catch (e) {}
      }
      if (searchRadiusCircleRef.current && mapInstanceRef.current) {
        try { mapInstanceRef.current.removeLayer(searchRadiusCircleRef.current); } catch (e) {}
        searchRadiusCircleRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [filters?.locationAdjusted]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        try { mapInstanceRef.current.invalidateSize(); } catch(e) {}
      }, 300);
    }
  }, [isSidePanelOpen]);

  // Center & 200% deep zoom in directly onto focusedProperty if redirected from PropertyDetailsView
  useEffect(() => {
    if (focusedProperty && mapInstanceRef.current) {
      const coords = extractCoordinates(focusedProperty);
      const formattedPoly = extractBoundaryPolygon(focusedProperty);

      if (!isNaN(coords.lat) && !isNaN(coords.lng)) {
        if (formattedPoly.length >= 3) {
          const polyBounds = L.latLngBounds(formattedPoly);
          mapInstanceRef.current.fitBounds(polyBounds, { padding: [40, 40], maxZoom: 20, animate: true });
        } else {
          mapInstanceRef.current.setView([coords.lat, coords.lng], 19, { animate: true });
        }

        setSelectedPropertyPreview(focusedProperty);
        setIsSidePanelOpen(true);
      }
    }
  }, [focusedProperty]);

  // 250% AUTO-ZOOM ON DETECT MY LOCATION
  useEffect(() => {
    if (filters?.userLat && filters?.userLng && mapInstanceRef.current) {
      const userLat = filters.userLat;
      const userLng = filters.userLng;
      const siteConfig = mockApi.getSiteConfig();
      // Deep Building & Plot Footprint Zoom Level 20 matching exact user screenshot
      const locZoom = getClampedZoom(siteConfig.mapsConfig?.locationZoom250, 20);

      // Perform 250% ultra-deep building footprint zoom into detected GPS position
      mapInstanceRef.current.setView([userLat, userLng], locZoom, { animate: true });

      if (userLocationMarkerRef.current) {
        mapInstanceRef.current.removeLayer(userLocationMarkerRef.current);
      }

      // Draggable Pulsing Blue GPS Target Marker
      const pulseIcon = L.divIcon({
        className: 'user-gps-location-pulse-marker',
        html: `
          <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: grab;">
            <div style="position: absolute; width: 36px; height: 36px; background: rgba(37, 99, 235, 0.35); border-radius: 50%; animation: pulse 1.8s infinite;"></div>
            <div style="position: absolute; width: 22px; height: 22px; background: rgba(37, 99, 235, 0.6); border-radius: 50%;"></div>
            <div style="width: 14px; height: 14px; background: #2563eb; border: 3.5px solid #ffffff; border-radius: 50%; box-shadow: 0 0 14px rgba(37, 99, 235, 1); z-index: 10;"></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([userLat, userLng], { icon: pulseIcon, draggable: true }).addTo(mapInstanceRef.current);
      
      const popupText = filters?.locationAdjusted 
        ? 'Exact Location Confirmed'
        : '📍 You Are Here';

      const userPopupHtml = '<div style="font-family: \'Plus Jakarta Sans\', sans-serif; background: #ffffff; padding: 12px 14px; min-width: 200px; max-width: 270px; border-radius: 14px; text-align: center;">' +
        '<div style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; padding: 2.5px 8px; border-radius: 9999px; display: inline-block; letter-spacing: 0.5px; margin-bottom: 6px;">' +
          (filters?.locationAdjusted ? 'Adjusted Location' : 'YOUR CURRENT LOCATION') +
        '</div>' +
        '<div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-top: 2px;">' +
          popupText +
        '</div>' +
        '</div>';

      marker.bindPopup(userPopupHtml, { offset: [0, -10] }).openPopup();

      // Click on location point -> Ultra-Deep MAX Zoom (Level 22)
      marker.on('click', () => {
        mapInstanceRef.current.setView([userLat, userLng], 22, { animate: true });
        marker.openPopup();
      });

      // Listen for marker drag event to update exact coordinates
      marker.on('dragend', (e) => {
        const targetLatLng = e.target.getLatLng();
        setFilters(prev => ({
          ...prev,
          userLat: targetLatLng.lat,
          userLng: targetLatLng.lng,
          locationAdjusted: true
        }));
        mapInstanceRef.current.setView([targetLatLng.lat, targetLatLng.lng], 22, { animate: true });
      });

      userLocationMarkerRef.current = marker;
    } else if (!filters?.userLat && userLocationMarkerRef.current && mapInstanceRef.current) {
      try {
        mapInstanceRef.current.removeLayer(userLocationMarkerRef.current);
      } catch (e) {}
      userLocationMarkerRef.current = null;
    }
  }, [filters?.userLat, filters?.userLng]);

  // Click map anywhere to reposition your location pin to exact building
  useEffect(() => {
    if (!mapInstanceRef.current || !filters?.userLat) return;

    const onMapClick = (e) => {
      const { lat, lng } = e.latlng;
      setFilters(prev => ({
        ...prev,
        userLat: lat,
        userLng: lng,
        locationAdjusted: true
      }));
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([lat, lng], 22, { animate: true });
      }
    };

    mapInstanceRef.current.on('click', onMapClick);
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('click', onMapClick);
      }
    };
  }, [filters?.userLat]);

  // Center, pan and place Search Target Pin when user searches any location
  useEffect(() => {
    const rawLat = filters?.searchLat ?? filters?.referenceLat;
    const rawLng = filters?.searchLng ?? filters?.referenceLng;
    const targetLat = rawLat != null ? Number(rawLat) : null;
    const targetLng = rawLng != null ? Number(rawLng) : null;

    if (targetLat != null && targetLng != null && !isNaN(targetLat) && !isNaN(targetLng) && targetLat !== 0 && targetLng !== 0 && mapInstanceRef.current) {
      // Clean up stale GPS location marker when a search location is selected
      if (userLocationMarkerRef.current && !filters?.userLat) {
        try { mapInstanceRef.current.removeLayer(userLocationMarkerRef.current); } catch (e) {}
        userLocationMarkerRef.current = null;
      }

      // Determine optimal zoom level:
      // Establishments, venues, buildings and addresses get deep footprint zoom (18); radius adapts smoothly
      const hasExplicitRadius = filters?.radiusKm != null && filters?.radiusKm !== '' && filters?.radiusKm !== 'any' && !isNaN(Number(filters.radiusKm)) && Number(filters.radiusKm) > 0;
      let zoomLevel = 18;
      if (hasExplicitRadius) {
        const r = Number(filters.radiusKm);
        if (r <= 2) zoomLevel = 16;
        else if (r <= 5) zoomLevel = 15;
        else if (r <= 10) zoomLevel = 14;
        else if (r <= 25) zoomLevel = 12;
        else zoomLevel = 10;
      }

      // Smoothly pan & zoom to the exact searched location if no explicit radius circle is active
      if (!hasExplicitRadius) {
        mapInstanceRef.current.setView([targetLat, targetLng], zoomLevel, { animate: true });
      }

      // Remove existing search location marker if present
      if (searchLocationMarkerRef.current) {
        try { mapInstanceRef.current.removeLayer(searchLocationMarkerRef.current); } catch (e) {}
      }

      const placeLabel = filters?.placeName || filters?.referencePlace || filters?.query || 'Searched Location';
      const addressLabel = filters?.formattedAddress || filters?.address || '';

      // High-visibility 3D Marker Pin (Refined, Compact 32x42px with 3D Depth, Gloss & Ground Shadow)
      const searchPinIcon = L.divIcon({
        className: 'search-location-target-pin',
        html: '<div style="position: relative; width: 32px; height: 42px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.32));">' +
          '<div style="position: absolute; bottom: -2px; width: 18px; height: 5px; background: radial-gradient(ellipse at center, rgba(15, 23, 42, 0.45) 0%, rgba(15, 23, 42, 0) 75%); border-radius: 50%;"></div>' +
          '<div style="position: absolute; bottom: -2px; width: 22px; height: 7px; border: 1.5px solid rgba(245, 158, 11, 0.6); border-radius: 50%; animation: pulse 2s infinite;"></div>' +
          '<svg width="30" height="38" viewBox="0 0 30 38" fill="none" style="z-index: 2; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);">' +
            '<defs>' +
              '<linearGradient id="pin3dGrad" x1="4" y1="2" x2="26" y2="36" gradientUnits="userSpaceOnUse">' +
                '<stop offset="0%" stop-color="#FDE047"/>' +
                '<stop offset="22%" stop-color="#F59E0B"/>' +
                '<stop offset="68%" stop-color="#D97706"/>' +
                '<stop offset="100%" stop-color="#78350F"/>' +
              '</linearGradient>' +
              '<linearGradient id="pin3dGloss" x1="10" y1="2" x2="18" y2="16" gradientUnits="userSpaceOnUse">' +
                '<stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/>' +
                '<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>' +
              '</linearGradient>' +
              '<radialGradient id="pin3dCore" cx="35%" cy="30%" r="65%">' +
                '<stop offset="0%" stop-color="#FFFFFF"/>' +
                '<stop offset="30%" stop-color="#0F172A"/>' +
                '<stop offset="100%" stop-color="#020617"/>' +
              '</radialGradient>' +
            '</defs>' +
            '<path d="M15 1C7.268 1 1 7.268 1 15C1 24.5 15 37 15 37C15 37 29 24.5 29 15C29 7.268 22.732 1 15 1Z" fill="url(#pin3dGrad)" stroke="#B45309" stroke-width="0.8"/>' +
            '<path d="M15 1C22.732 1 29 7.268 29 15C29 24.5 15 37 15 37C15 37 23 23 23 15C23 8 18 2 15 1Z" fill="#451A03" opacity="0.22"/>' +
            '<ellipse cx="11" cy="7.5" rx="7" ry="3.5" transform="rotate(-25 11 7.5)" fill="url(#pin3dGloss)"/>' +
            '<circle cx="15" cy="14" r="6.2" fill="#FFFFFF" opacity="0.95"/>' +
            '<circle cx="15" cy="14" r="5" fill="url(#pin3dCore)"/>' +
            '<circle cx="13.2" cy="12.2" r="1.3" fill="#FFFFFF" opacity="0.95"/>' +
          '</svg>' +
        '</div>',
        iconSize: [32, 42],
        iconAnchor: [16, 40],
        popupAnchor: [0, -40]
      });

      const marker = L.marker([targetLat, targetLng], { icon: searchPinIcon }).addTo(mapInstanceRef.current);

      // Clean Modern White Card UI
      const popupHtml = '<div style="font-family: \'Plus Jakarta Sans\', -apple-system, BlinkMacSystemFont, sans-serif; background: #ffffff; padding: 12px 14px; min-width: 200px; max-width: 290px; border-radius: 16px;">' +
        '<div style="display: flex; align-items: center; margin-bottom: 8px;">' +
          '<span style="display: inline-flex; align-items: center; gap: 4.5px; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; padding: 3px 8px; border-radius: 6px;">' +
            '<span style="width: 5px; height: 5px; border-radius: 50%; background: #d97706; display: inline-block;"></span>' +
            'SEARCHED LOCATION' +
          '</span>' +
        '</div>' +
        '<div style="font-size: 13.5px; font-weight: 800; color: #0f172a; line-height: 1.35; margin-bottom: 5px; letter-spacing: -0.15px;">' +
          placeLabel +
        '</div>' +
        (addressLabel && addressLabel !== placeLabel ? 
          '<div style="font-size: 11px; font-weight: 500; color: #475569; line-height: 1.45; margin-top: 6px; padding-top: 6px; border-top: 1px solid #f1f5f9;">' + 
            addressLabel + 
          '</div>' : '') +
      '</div>';

      marker.bindPopup(popupHtml, { offset: [0, -10] }).openPopup();

      searchLocationMarkerRef.current = marker;
    } else if (!filters?.searchLat && !filters?.referenceLat && searchLocationMarkerRef.current) {
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.removeLayer(searchLocationMarkerRef.current); } catch (e) {}
      }
      searchLocationMarkerRef.current = null;
    }
  }, [filters?.searchLat, filters?.searchLng, filters?.referenceLat, filters?.referenceLng, filters?.radiusKm]);

  // Render Visual Leaflet Search Radius Circle & Auto-Frame Bounds
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (searchRadiusCircleRef.current) {
      try {
        mapInstanceRef.current.removeLayer(searchRadiusCircleRef.current);
      } catch (e) {}
      searchRadiusCircleRef.current = null;
    }

    const rawLat = filters?.searchLat ?? filters?.referenceLat ?? filters?.userLat;
    const rawLng = filters?.searchLng ?? filters?.referenceLng ?? filters?.userLng;
    const centerLat = rawLat != null ? Number(rawLat) : null;
    const centerLng = rawLng != null ? Number(rawLng) : null;

    const hasCenter = centerLat != null && centerLng != null && !isNaN(centerLat) && !isNaN(centerLng) && (centerLat !== 0 || centerLng !== 0);
    const hasRadius = filters?.radiusKm != null && filters?.radiusKm !== '' && filters?.radiusKm !== 'any' && !isNaN(Number(filters.radiusKm)) && Number(filters.radiusKm) > 0;

    if (hasCenter && hasRadius) {
      const radiusKm = Number(filters.radiusKm);
      const radiusMeters = radiusKm * 1000;

      const circle = L.circle([centerLat, centerLng], {
        radius: radiusMeters,
        color: '#d97706',
        fillColor: '#f59e0b',
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '6, 6'
      }).addTo(mapInstanceRef.current);

      circle.bindTooltip('Search Radius: ' + radiusKm + ' km', {
        permanent: false,
        direction: 'top',
        className: 'easeland-radius-tooltip'
      });

      searchRadiusCircleRef.current = circle;

      // Auto-frame map bounds to encompass the entire radius circle cleanly with padding
      mapInstanceRef.current.fitBounds(circle.getBounds(), {
        padding: [45, 45],
        maxZoom: 17,
        animate: true
      });
    }
  }, [filters?.radiusKm, filters?.searchLat, filters?.searchLng, filters?.referenceLat, filters?.referenceLng, filters?.userLat, filters?.userLng]);

  // Fallback: If search query text is present but coordinates have not been resolved yet, resolve and pan map!
  useEffect(() => {
    const rawQuery = filters?.query || filters?.address;
    if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length < 2 || rawQuery.toLowerCase() === 'near me') return;
    if (filters?.searchLat || filters?.referenceLat || filters?.userLat) return;
    if (!mapInstanceRef.current) return;

    let isMounted = true;
    (async () => {
      try {
        const predictions = await fetchGooglePlacesPredictions(rawQuery.trim());
        if (!isMounted) return;
        if (Array.isArray(predictions) && predictions.length > 0 && predictions[0].placeId) {
          const details = await fetchGooglePlaceDetails(predictions[0].placeId, rawQuery.trim());
          if (!isMounted || !details || isNaN(details.lat) || isNaN(details.lng)) return;
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([details.lat, details.lng], 18, { animate: true });
          }
        } else {
          const geo = await searchLocationQuery(rawQuery.trim());
          if (!isMounted || !Array.isArray(geo) || geo.length === 0 || !geo[0].lat || !geo[0].lng) return;
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([geo[0].lat, geo[0].lng], 17, { animate: true });
          }
        }
      } catch (err) {
        console.warn('Map query geocode fallback error:', err);
      }
    })();

    return () => { isMounted = false; };
  }, [filters?.query, filters?.address, filters?.searchLat, filters?.referenceLat, filters?.userLat]);

  // Update Base Tile Layer when mapType, showLabels, or activeDetail changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const tileConfig = getGoogleTileUrl();

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const newTileLayer = L.tileLayer(tileConfig.url, {
      maxZoom: tileConfig.maxZoom,
      subdomains: tileConfig.subdomains
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newTileLayer;

    // Traffic Overlay Layer Toggle
    if (activeDetail === 'traffic') {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = L.tileLayer('https://mt{s}.google.com/vt/lyrs=h,traffic&x={x}&y={y}&z={z}', {
          subdomains: '0123',
          maxZoom: 20
        });
      }
      trafficLayerRef.current.addTo(mapInstanceRef.current);
    } else if (trafficLayerRef.current && mapInstanceRef.current.hasLayer(trafficLayerRef.current)) {
      mapInstanceRef.current.removeLayer(trafficLayerRef.current);
    }
  }, [mapType, showLabels, activeDetail]);

  // Recalculate map dimensions whenever side panel is toggled open/closed
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 300);
    }
  }, [isSidePanelOpen]);

  // Helper to compute boundary polygon styling based on transaction purpose (Sale vs Rent vs Lease)
  const getBoundaryStyle = (property) => {
    if (!property) return {
      color: '#d97706',
      fillColor: '#f59e0b',
      fillOpacity: 0.38,
      weight: 3.5,
      dashArray: '6, 6',
      typeLabel: 'For Sale',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300'
    };

    const rawPurpose = String(property?.purpose || property?.listingType || property?.type || '').toUpperCase().trim();
    const rawTitle = String(property?.title || '').toLowerCase();
    const rawPrice = String(property?.priceDisplay || '').toLowerCase();

    const isRent = rawPurpose === 'RENT' || rawPrice.includes('/month') || rawPrice.includes('/mo') || rawTitle.includes('for rent');
    const isLease = rawPurpose === 'LEASE' || rawTitle.includes('for lease') || (rawPrice.includes('/yr') && !rawPrice.includes('month'));

    if (isLease) {
      return {
        color: '#1d4ed8',     // Deep Royal Blue Border
        fillColor: '#3b82f6', // Vivid Royal Blue Fill
        fillOpacity: 0.38,
        weight: 3.5,
        dashArray: '5, 5',
        lineJoin: 'round',
        typeLabel: 'For Lease',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-300'
      };
    }

    if (isRent) {
      return {
        color: '#047857',     // Deep Emerald Green Border
        fillColor: '#10b981', // Vivid Emerald Fill
        fillOpacity: 0.38,
        weight: 3.5,
        dashArray: '8, 4',
        lineJoin: 'round',
        typeLabel: 'For Rent',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300'
      };
    }

    // Default: SALE (Brand Gold / Amber)
    return {
      color: '#d97706',     // Deep Gold / Amber Border
      fillColor: '#f59e0b', // Vivid Brand Gold Fill
      fillOpacity: 0.38,
      weight: 3.5,
      dashArray: '6, 6',
      lineJoin: 'round',
      typeLabel: 'For Sale',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300'
    };
  };

  // Helper to compute marker size & color gradient automatically based strictly on price (matching Map Price Legend)
  const getMarkerStyle = (property) => {
    const area = property.area || 1500;
    const size = Math.min(Math.max(Math.round(16 + (area / 800)), 16), 34);

    const price = Number(property.price) || 0;
    const boundaryStyle = getBoundaryStyle(property);

    let color = '#22c55e'; // Emerald green (Below 30 L / Affordable)
    let border = '#15803d';

    if (price > 15000000) { // Above 1.5 Cr (Luxury)
      color = '#0B2545'; // Dark Navy Blue
      border = '#F4C542';
    } else if (price > 6000000) { // 60 Lakhs - 1.5 Cr (Premium)
      color = '#F4C542'; // Gold/Amber
      border = '#B48B1B';
    } else if (price > 3000000) { // 30 Lakhs - 60 Lakhs (Mid-Range)
      color = '#7c3aed'; // Deep Violet / Purple
      border = '#5b21b6';
    } else { // Below 30 Lakhs (Affordable)
      color = '#22c55e'; // Emerald Green
      border = '#15803d';
    }

    return { size, color, border, boundaryStyle };
  };

  // Render Map Markers and Plot Boundary Polygons when properties update
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    markersLayerRef.current.clearLayers();
    if (polygonLayerRef.current) {
      polygonLayerRef.current.clearLayers();
    }

    if (displayProperties.length === 0) return;

    const bounds = [];
    const markersToAdd = [];

    displayProperties.forEach((prop) => {
      if (!prop) return;

      const formattedPoly = extractBoundaryPolygon(prop);
      const coords = extractCoordinates(prop);
      let lat = coords.lat;
      let lng = coords.lng;

      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

      bounds.push([lat, lng]);

      const { size, color, border } = getMarkerStyle(prop);
      const priceVal = Number(prop.price) || 0;
      const priceLabel = prop.priceDisplay || (priceVal >= 10000000 
        ? `Rs. ${(priceVal / 10000000).toFixed(2)} Cr` 
        : priceVal >= 100000 
          ? `Rs. ${(priceVal / 100000).toFixed(1)} L` 
          : `Rs. ${priceVal.toLocaleString()}`);

      // Custom HTML Price Color Marker Pin with Price Pill Badge (100% Fixed Icon Anchor, Zero Drift on Zoom)
      const totalWidth = 140;
      const dotSize = size;
      const badgeHeight = 24;
      const gap = 2;
      const totalHeight = badgeHeight + gap + dotSize;

      const customIcon = L.divIcon({
        className: 'custom-map-marker-container',
        html: `
          <div style="
            width: ${totalWidth}px;
            height: ${totalHeight}px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
            cursor: pointer;
            pointer-events: auto;
          ">
            <div style="
              background-color: ${color};
              color: ${priceVal > 6000000 && priceVal <= 15000000 ? '#0B2545' : '#ffffff'};
              border: 2px solid ${border};
              font-family: 'Plus Jakarta Sans', sans-serif;
              font-size: 11px;
              font-weight: 800;
              padding: 2.5px 8px;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.35);
              white-space: nowrap;
              letter-spacing: 0.2px;
              margin-bottom: ${gap}px;
            ">
              <span>${priceLabel}</span>
            </div>
            <svg width="28" height="34" viewBox="0 0 40 48" style="filter: drop-shadow(0px 3px 6px rgba(0,0,0,0.35)); flex-shrink: 0;" class="custom-map-marker">
              <path d="M 20 2 C 11.16 2 4 9.16 4 18 C 4 29 20 46 20 46 C 20 46 36 29 36 18 C 36 9.16 28.84 2 20 2 Z" fill="${color}" stroke="${border}" stroke-width="1.8"/>
              <circle cx="20" cy="17.5" r="7" fill="#ffffff"/>
            </svg>
          </div>
        `,
        iconSize: [totalWidth, totalHeight],
        iconAnchor: [totalWidth / 2, totalHeight],
        popupAnchor: [0, -totalHeight]
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      // Clean High-Contrast Hover/Click Popup Card (Modern White Card)
      const popupContent = 
        '<div style="font-family: \'Plus Jakarta Sans\', sans-serif; background: #ffffff; padding: 12px 14px; border-radius: 14px; min-width: 195px; max-width: 260px;">' +
          '<div style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; padding: 2.5px 7px; border-radius: 6px; display: inline-block; margin-bottom: 6px; letter-spacing: 0.5px;">' +
            (prop.verificationStatus || 'PLATFORM VERIFIED') +
          '</div>' +
          '<div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-bottom: 4px; line-height: 1.3;">' +
            (prop.title || 'Property') +
          '</div>' +
          '<div style="font-size: 14px; font-weight: 900; color: #059669; margin-bottom: 3px;">' +
            priceLabel +
          '</div>' +
          '<div style="font-size: 11px; font-weight: 600; color: #64748b;">' +
            'Area: ' + (prop.areaDisplay || (prop.area ? prop.area + ' sq ft' : '')) +
          '</div>' +
          (prop.distKm != null && prop.distKm < Infinity ? 
            '<div style="font-size: 11px; font-weight: 800; color: #b45309; margin-top: 4px; display: flex; align-items: center; gap: 4px;">' +
              '<span>📍 ' + prop.distKm + ' km away</span>' +
            '</div>' : '') +
        '</div>';

      marker.bindPopup(popupContent, { offset: [0, -45] });

      // Marker Click -> Standard Zoom (Level 17) + Open Preview Card Modal
      marker.on('click', () => {
        handleSelectPropertyForPreview(prop);
      });

      markersToAdd.push(marker);

      // Render Approved GeoJSON Boundary Polygon with Purpose-Differentiated Colors (Sale vs Rent vs Lease)
      if (formattedPoly.length >= 3) {
        const polyStyle = getBoundaryStyle(prop);
        const polygon = L.polygon(formattedPoly, {
          color: polyStyle.color,
          fillColor: polyStyle.fillColor,
          fillOpacity: polyStyle.fillOpacity,
          weight: polyStyle.weight,
          dashArray: polyStyle.dashArray,
          lineJoin: polyStyle.lineJoin || 'round'
        });
        polygon.bindTooltip(`Approved Plot Boundary [${polyStyle.typeLabel}] (${prop.title || 'Plot'})`, { sticky: true });
        polygon.on('click', () => {
          handleSelectPropertyForPreview(prop);
        });
        if (polygonLayerRef.current) {
          polygonLayerRef.current.addLayer(polygon);
        }
      }
    });

    if (markersToAdd.length > 0) {
      if (markersLayerRef.current && markersLayerRef.current.addLayers) {
        markersLayerRef.current.addLayers(markersToAdd);
      } else if (markersLayerRef.current) {
        markersToAdd.forEach(m => markersLayerRef.current.addLayer(m));
      }
    }

    // Numbers Visibility Threshold: Ensure cluster layer is mounted only when active zoom is within India (>= 5)
    if (mapInstanceRef.current && markersLayerRef.current) {
      const currentMapZoom = mapInstanceRef.current.getZoom();
      if (currentMapZoom < 5) {
        if (mapInstanceRef.current.hasLayer(markersLayerRef.current)) {
          mapInstanceRef.current.removeLayer(markersLayerRef.current);
        }
      } else {
        if (!mapInstanceRef.current.hasLayer(markersLayerRef.current)) {
          mapInstanceRef.current.addLayer(markersLayerRef.current);
        }
      }
    }

    const hasSearchCoords = (filters?.searchLat != null && filters?.searchLng != null) ||
                            (filters?.referenceLat != null && filters?.referenceLng != null) ||
                            Boolean(filters?.query && filters?.query.trim().length >= 2 && filters?.query.trim().toLowerCase() !== 'near me');

    if (!focusedProperty && !filters?.userLat && !hasSearchCoords && bounds.length > 0) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [displayProperties, filters?.userLat, filters?.searchLat, filters?.searchLng, filters?.referenceLat, filters?.referenceLng, filters?.query]);

  // Memoized photo list for pop-up preview card (strictly genuine photos, zero dummy fallback padding)
  const previewPhotos = useMemo(() => {
    if (!selectedPropertyPreview) return [];
    return getPropertyPhotosList(selectedPropertyPreview);
  }, [selectedPropertyPreview]);

  // Memoized video list for pop-up preview card
  const previewVideos = useMemo(() => {
    if (!selectedPropertyPreview) return [];
    return getPropertyVideosList(selectedPropertyPreview);
  }, [selectedPropertyPreview]);

  const activePhoto = previewPhotos[previewMediaIndex] || previewPhotos[0] || null;
  const activePhotoUrl = activePhoto?.url || activePhoto?.publicUrl || getFirstUploadedImage(selectedPropertyPreview);

  // Key specifications for pop-up preview card
  const previewSpecs = useMemo(() => {
    if (!selectedPropertyPreview) return [];
    const p = selectedPropertyPreview;
    const s = p.specifications || {};
    const chips = [];

    const bhk = s.bedrooms || p.bedrooms || p.bhk;
    if (bhk) chips.push({ label: 'Bedrooms', value: `${bhk} BHK`, icon: 'bed' });

    const baths = s.bathrooms || p.bathrooms;
    if (baths) chips.push({ label: 'Bathrooms', value: `${baths} Baths`, icon: 'bath' });

    const facing = s.facing || p.facing;
    if (facing) chips.push({ label: 'Facing', value: `${facing} Facing`, icon: 'compass' });

    const furnishing = s.furnishing || p.specs?.furnishing || p.furnishing;
    if (furnishing) chips.push({ label: 'Furnishing', value: furnishing, icon: 'sofa' });

    const road = s.approachRoadWidth || p.approachRoadWidth || p.roadWidth;
    if (road) chips.push({ label: 'Approach Road', value: `${road} ft Road`, icon: 'car' });

    const age = s.propertyAge || p.propertyAge;
    if (age) chips.push({ label: 'Property Age', value: age, icon: 'calendar' });

    const floor = s.floor !== undefined && s.floor !== '' ? s.floor : p.floor;
    const totalFloors = s.totalFloors !== undefined && s.totalFloors !== '' ? s.totalFloors : p.totalFloors;
    if (floor !== undefined && floor !== null && floor !== '') {
      chips.push({ label: 'Floor Level', value: `Floor ${floor}${totalFloors ? ` of ${totalFloors}` : ''}`, icon: 'layers' });
    }

    const parking = s.parkingType || p.parkingType || p.parking;
    if (parking) chips.push({ label: 'Parking', value: parking, icon: 'car' });

    const possession = s.possessionStatus || p.possessionStatus;
    if (possession) chips.push({ label: 'Possession', value: possession, icon: 'check' });

    const corner = s.cornerPlot || p.cornerPlot;
    if (corner) chips.push({ label: 'Plot Feature', value: 'Corner Plot', icon: 'building' });

    const boundary = s.boundaryWall || p.boundaryWall;
    if (boundary) chips.push({ label: 'Boundary', value: 'Compound Wall Built', icon: 'shield' });

    return chips;
  }, [selectedPropertyPreview]);

  // Normalized amenities for pop-up preview card
  const previewAmenities = useMemo(() => {
    if (!selectedPropertyPreview) return [];
    const p = selectedPropertyPreview;
    const s = p.specifications || {};
    const raw = p.amenities || s.amenities || [];
    const list = Array.isArray(raw)
      ? raw
      : (raw && typeof raw === 'object' ? Object.keys(raw).filter(k => raw[k]) : []);

    return list.map(item => {
      const match = CANONICAL_AMENITIES.find(a => a.id === item || a.label.toLowerCase() === String(item).toLowerCase());
      return match ? match.label : String(item).replace(/_/g, ' ');
    });
  }, [selectedPropertyPreview]);

  // Rate per unit calculation
  const ratePerSqFt = useMemo(() => {
    if (!selectedPropertyPreview) return null;
    const priceNum = Number(selectedPropertyPreview.price);
    const areaNum = Number(selectedPropertyPreview.area);
    const unit = selectedPropertyPreview.areaUnit || selectedPropertyPreview.specs?.areaUnit || 'sq ft';
    if (!isNaN(priceNum) && !isNaN(areaNum) && priceNum > 0 && areaNum > 0) {
      const rate = selectedPropertyPreview.pricePerUnit || Math.round(priceNum / areaNum);
      return `Rs. ${Number(rate).toLocaleString('en-IN')} / ${unit}`;
    }
    return null;
  }, [selectedPropertyPreview]);

  // Location hierarchy breakdown
  const locationDetails = useMemo(() => {
    if (!selectedPropertyPreview?.location) return null;
    const loc = selectedPropertyPreview.location;
    return {
      locality: loc.locality,
      city: loc.city,
      mandal: loc.mandal,
      district: loc.district,
      state: loc.state,
      pincode: loc.pincode,
      fullText: [loc.locality, loc.city, loc.state].filter(Boolean).join(', ') || 'India'
    };
  }, [selectedPropertyPreview]);

  // Description / overview
  const previewDescription = selectedPropertyPreview?.description ||
    selectedPropertyPreview?.details?.description ||
    selectedPropertyPreview?.aboutProperty ||
    null;

  return (
    <div className="relative w-full h-full bg-gray-100 flex flex-row overflow-hidden">
      
      {/* LEFT PROPERTY LIST CONTAINER (Fixed Width 380px/400px Collapsible Side Panel) */}
      {!hideSidePanel && (
        <div className={`w-full md:w-[380px] lg:w-[400px] flex-shrink-0 h-full bg-white border-r border-gray-200 flex flex-col z-[35] md:z-10 shadow-lg transition-all duration-300 ease-in-out ${
          isSidePanelOpen ? 'ml-0' : '-ml-[100%] md:-ml-[380px] lg:-ml-[400px]'
        }`}>
          
          {/* LIST HEADER WITH CLOSE TOGGLE BUTTON */}
          <div className="p-4 border-b border-gray-100 bg-brand-charcoal text-white flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-brand-yellow font-extrabold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Universal Map Discovery</span>
              </div>
              <h2 className="text-lg font-extrabold text-white">
                {filters?.cleared ? '0 Properties (Filters Cleared)' : `${displayProperties.length} Properties Found`}
              </h2>
            </div>

            <button
              onClick={() => setIsSidePanelOpen(false)}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="Collapse Side Panel"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* PROPERTY LIST CARDS */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4 pb-20">
            {filters?.cleared ? (
              <div className="text-center py-12 px-6 text-gray-500">
                <MapPin className="w-12 h-12 text-brand-yellow mx-auto mb-3" />
                <h3 className="text-base font-extrabold text-brand-charcoal">Filters Cleared</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  No properties are shown. Type an address, street, landmark, city, or select a filter above to discover verified properties.
                </p>
              </div>
            ) : displayProperties.length === 0 ? (
              <div className="text-center py-12 px-4 text-gray-500">
                <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-brand-charcoal">No verified properties match your search</h3>
                <p className="text-xs text-gray-400 mt-1">Try clearing filters or searching another address across India.</p>
                <button
                  onClick={() => setFilters({ cleared: false, category: 'All', purpose: 'buy', query: '' })}
                  className="mt-4 bg-brand-yellow text-brand-charcoal font-bold text-xs px-4 py-2 rounded-lg"
                >
                  Reset Search
                </button>
              </div>
            ) : (
              displayProperties.map((prop) => (
                <div
                  key={prop.id}
                  onClick={() => handleSelectPropertyForPreview(prop)}
                  className={`group bg-white rounded-2xl border transition-all cursor-pointer overflow-hidden flex flex-col mx-0.5 sm:mx-0 shadow-sm hover:shadow-md ${
                    selectedPropertyPreview?.id === prop.id
                      ? 'border-brand-yellow ring-2 ring-brand-yellow/30 shadow-lg'
                      : 'border-gray-200 hover:border-brand-yellow'
                  }`}
                >
                  <div className="relative h-44 bg-gray-100 overflow-hidden">
                    <img
                      src={getFirstUploadedImage(prop)}
                      alt={prop.title}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = getCategoryFallbackImage(prop);
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    <div className="absolute top-3 left-3 bg-slate-950 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md border border-amber-400/40">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-metallic-gold font-black">
                        {prop.verificationStatus || 'PLATFORM VERIFIED'}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 bg-slate-900/90 text-amber-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border border-amber-400/30 shadow-md backdrop-blur-sm">
                      {getCategoryBadgeLabel(prop)}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onWishlistToggle(prop.id);
                      }}
                      className={`absolute bottom-3 right-3 p-2 rounded-full shadow-md transition-colors ${
                        (typeof isWishlisted === 'function' ? isWishlisted(prop.id) : Boolean(isWishlisted))
                          ? 'bg-red-500 text-white'
                          : 'bg-white/80 text-gray-600 hover:bg-white'
                      }`}
                    >
                      <Heart className="w-4 h-4 fill-current" />
                    </button>
                  </div>

                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 font-bold mb-1">
                        <span>{prop.location?.locality || prop.location?.city || 'India'}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {prop.distKm != null && prop.distKm < Infinity && (
                            <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-extrabold text-[10px] border border-amber-200">
                              {prop.distKm} km away
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] border ${getBoundaryStyle(prop).badgeClass}`}>
                            {getBoundaryStyle(prop).typeLabel}
                          </span>
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-extrabold text-[10px] border border-emerald-200/60">
                            Direct Owner
                          </span>
                          <span className="text-sky-800 bg-sky-50 px-2 py-0.5 rounded font-extrabold text-[10px] border border-sky-200">
                            {getCategoryBadgeLabel(prop)}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-brand-charcoal line-clamp-1 group-hover:text-black mb-2">
                        {prop.title}
                      </h3>

                      <div className="flex items-baseline justify-between pt-2 border-t border-gray-100">
                        <div>
                          <span className="text-xs text-gray-400 font-medium block">Listed Price</span>
                          <span className="text-base font-extrabold text-emerald-700">
                            {prop.priceDisplay}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-gray-400 font-medium block">Property Area</span>
                          <span className="text-xs font-extrabold text-brand-charcoal">
                            {prop.areaDisplay || prop.area + ' sq ft'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPropertyForPreview(prop);
                        }}
                        className="w-full mt-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center gap-1.5 border border-slate-800 cursor-pointer group"
                      >
                        <span className="font-bold tracking-wide">View Property Details</span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* RIGHT LEAFLET MAP CONTAINER */}
      <div className="relative flex-1 min-w-0 h-full bg-gray-200">
        
        {/* FLOATING OPEN SIDE PANEL BUTTON WHEN COLLAPSED */}
        {!hideSidePanel && !isSidePanelOpen && (
          <button
            onClick={() => setIsSidePanelOpen(true)}
            className="absolute top-4 left-4 z-20 bg-brand-charcoal text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 hover:bg-brand-charcoalLight border border-white/10 transition-all transform hover:scale-105 select-none"
          >
            <ChevronRight className="w-4 h-4 text-brand-yellow" />
            <span>Show Property List ({displayProperties.length})</span>
          </button>
        )}



        {/* AUTHENTIC GOOGLE MAPS FLOATING BOTTOM-LEFT LAYER BAR (SPREADS ON HOVER) */}
        <div
          onMouseEnter={() => setIsLayerHovered(true)}
          onMouseLeave={() => setIsLayerHovered(false)}
          className="absolute bottom-6 left-6 z-20 flex items-center select-none group"
        >
          {/* MAIN THUMBNAIL TOGGLE BUTTON */}
          <div
            onClick={() => setMapType(prev => prev === 'default' ? 'satellite' : 'default')}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-white shadow-2xl cursor-pointer relative flex-shrink-0 transition-transform transform group-hover:scale-105"
          >
            <img
              src={
                mapType === 'satellite'
                  ? 'https://mt1.google.com/vt/lyrs=m&x=1468&y=948&z=11'
                  : 'https://mt1.google.com/vt/lyrs=y&x=1468&y=948&z=11'
              }
              alt="Map Type Toggle"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 inset-x-0 bg-brand-charcoal/80 backdrop-blur-md text-white text-[10px] font-extrabold py-0.5 text-center uppercase tracking-wider">
              {mapType === 'satellite' ? 'Map' : 'Satellite'}
            </div>
          </div>

          {/* QUICK DETAIL LAYER CHIPS - SPREADS HORIZONTALLY ONLY ON HOVER */}
          <div
            className={`ml-2 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-gray-200 flex items-center gap-1 transition-all duration-300 transform origin-left overflow-hidden ${
              isLayerHovered
                ? 'max-w-md opacity-100 scale-x-100 shadow-2xl translate-x-0 pointer-events-auto'
                : 'max-w-0 opacity-0 scale-x-0 -translate-x-4 pointer-events-none p-0 border-none'
            }`}
          >
            <button
              onClick={() => setActiveDetail(prev => prev === 'terrain' ? null : 'terrain')}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all ${
                activeDetail === 'terrain'
                  ? 'bg-brand-yellow text-brand-charcoal font-extrabold shadow'
                  : 'text-gray-600 hover:bg-gray-100 font-bold'
              }`}
            >
              <Mountain className="w-4 h-4 mb-0.5" />
              <span className="text-[10px]">Terrain</span>
            </button>

            <button
              onClick={() => setActiveDetail(prev => prev === 'traffic' ? null : 'traffic')}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all ${
                activeDetail === 'traffic'
                  ? 'bg-brand-yellow text-brand-charcoal font-extrabold shadow'
                  : 'text-gray-600 hover:bg-gray-100 font-bold'
              }`}
            >
              <Car className="w-4 h-4 mb-0.5" />
              <span className="text-[10px]">Traffic</span>
            </button>

            <button
              onClick={() => setActiveDetail(prev => prev === 'transit' ? null : 'transit')}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all ${
                activeDetail === 'transit'
                  ? 'bg-brand-yellow text-brand-charcoal font-extrabold shadow'
                  : 'text-gray-600 hover:bg-gray-100 font-bold'
              }`}
            >
              <Bus className="w-4 h-4 mb-0.5" />
              <span className="text-[10px]">Transit</span>
            </button>

            <button
              onClick={() => setActiveDetail(prev => prev === 'biking' ? null : 'biking')}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all ${
                activeDetail === 'biking'
                  ? 'bg-brand-yellow text-brand-charcoal font-extrabold shadow'
                  : 'text-gray-600 hover:bg-gray-100 font-bold'
              }`}
            >
              <Bike className="w-4 h-4 mb-0.5" />
              <span className="text-[10px]">Biking</span>
            </button>

            <button
              onClick={() => setMapModalOpen(true)}
              className="flex flex-col items-center justify-center w-14 h-14 rounded-xl text-gray-600 hover:bg-gray-100 font-bold transition-all"
            >
              <Layers className="w-4 h-4 mb-0.5 text-brand-charcoal" />
              <span className="text-[10px]">More</span>
            </button>
          </div>

        </div>

        {/* LEAFLET MAP CANVAS */}
        <div ref={mapContainerRef} className="w-full h-full z-0 min-h-[300px]"></div>

        {/* MAP PRICE LEGEND RIGHT EDGE SIDE STRIP TAB & SLIDE-OUT DRAWER */}
        <div className="absolute top-24 right-0 z-30 flex flex-col items-end select-none">
          {!isLegendOpen ? (
            <button
              onClick={() => setIsLegendOpen(true)}
              className="bg-slate-950/95 hover:bg-slate-900 text-amber-400 border-y border-l border-amber-400/50 shadow-2xl py-3 px-2.5 rounded-l-2xl flex items-center gap-1.5 text-xs font-black backdrop-blur-md transition-all transform hover:-translate-x-1 cursor-pointer group"
              title="Click to open Map Price Legend"
            >
              <Compass className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
              <span className="text-[10px] font-extrabold tracking-widest uppercase text-amber-300">
                Legend
              </span>
            </button>
          ) : (
            <div className="bg-slate-950/95 text-white p-4 rounded-l-3xl border-y border-l border-slate-700 shadow-2xl w-72 max-w-[calc(100vw-20px)] animate-in slide-in-from-right duration-300 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-xs font-black text-amber-400">
                  <Compass className="w-4 h-4 text-amber-400" />
                  <span>Map Price Legend</span>
                </div>
                <button
                  onClick={() => setIsLegendOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Close Map Legend"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs font-bold">
                {/* Item 1: Above 1.5 Cr */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#0B2545] border border-amber-400 shrink-0 shadow-sm"></span>
                    <span className="text-white font-extrabold">Above Rs. 1.5 Cr</span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-black">Luxury</span>
                </div>

                {/* Item 2: 60 L - 1.5 Cr */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#F4C542] border border-[#B48B1B] shrink-0 shadow-sm"></span>
                    <span className="text-white font-extrabold">Rs. 60 L – 1.5 Cr</span>
                  </div>
                  <span className="text-[10px] text-amber-300 font-black">Premium</span>
                </div>

                {/* Item 3: 30 L - 60 L */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#7c3aed] border border-[#5b21b6] shrink-0 shadow-sm"></span>
                    <span className="text-white font-extrabold">Rs. 30 L – 60 L</span>
                  </div>
                  <span className="text-[10px] text-purple-300 font-black">Mid-Range</span>
                </div>

                {/* Item 4: Below 30 L */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#22c55e] border border-[#15803d] shrink-0 shadow-sm"></span>
                    <span className="text-white font-extrabold">Below Rs. 30 L</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-black">Affordable</span>
                </div>

                {/* Item 5: Purpose Boundary Delineation */}
                <div className="pt-2.5 border-t border-slate-800 space-y-2">
                  <span className="text-[10px] text-slate-400 font-black uppercase block tracking-wider">Boundary Colors</span>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-2.5 rounded bg-amber-400/40 border border-dashed border-amber-400 shrink-0"></span>
                      <span className="text-white font-extrabold text-[11px]">For Sale Boundary</span>
                    </div>
                    <span className="text-[10px] text-amber-400 font-black">Gold / Amber</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-2.5 rounded bg-emerald-500/40 border border-dashed border-emerald-400 shrink-0"></span>
                      <span className="text-white font-extrabold text-[11px]">For Rent Boundary</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-black">Emerald Green</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-2.5 rounded bg-blue-500/40 border border-dashed border-blue-400 shrink-0"></span>
                      <span className="text-white font-extrabold text-[11px]">For Lease Boundary</span>
                    </div>
                    <span className="text-[10px] text-blue-400 font-black">Royal Blue</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PROPERTY PREVIEW DETAILS CARD OVERLAY ON MAP */}
        {selectedPropertyPreview && (
          <div className="absolute bottom-2 right-2 left-2 sm:left-auto sm:bottom-6 sm:right-6 z-30 w-auto sm:w-[420px] max-w-[460px] max-h-[calc(100%-24px)] sm:max-h-[calc(100%-48px)] flex flex-col bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* CARD HEADER (STICKY TOP) */}
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0 pr-2">
                <div className="flex items-center gap-1 bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>{selectedPropertyPreview.verificationStatus || 'PLATFORM VERIFIED'}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border shrink-0 ${getBoundaryStyle(selectedPropertyPreview).badgeClass}`}>
                  {getBoundaryStyle(selectedPropertyPreview).typeLabel}
                </span>
              </div>

              <button
                onClick={() => setSelectedPropertyPreview(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                title="Close Details Card"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SCROLLABLE CARD BODY */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
              
              {/* 1. PHOTO GALLERY CAROUSEL */}
              <div className="relative h-48 sm:h-52 w-full rounded-2xl overflow-hidden bg-slate-950 shrink-0 select-none shadow-inner">
                <img
                  src={activePhotoUrl}
                  alt={selectedPropertyPreview.title}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = getCategoryFallbackImage(selectedPropertyPreview);
                  }}
                  className="w-full h-full object-cover transition-opacity duration-200"
                />

                {/* Category Badge overlay on image */}
                <div className="absolute top-3 left-3 bg-slate-900/90 text-amber-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border border-amber-400/30 shadow-md backdrop-blur-sm">
                  {getCategoryBadgeLabel(selectedPropertyPreview)}
                </div>

                {/* Wishlist Button on image */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onWishlistToggle(selectedPropertyPreview.id);
                  }}
                  className={`absolute top-3 right-3 p-2 rounded-full shadow-md transition-colors ${
                    (typeof isWishlisted === 'function' ? isWishlisted(selectedPropertyPreview.id) : Boolean(isWishlisted))
                      ? 'bg-red-500 text-white'
                      : 'bg-white/90 text-gray-700 hover:bg-white'
                  }`}
                  title="Wishlist"
                >
                  <Heart className="w-4 h-4 fill-current" />
                </button>

                {/* Carousel Navigation Buttons (Strictly for genuine photos) */}
                {previewPhotos.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewMediaIndex(prev => (prev - 1 + previewPhotos.length) % previewPhotos.length);
                      }}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-950/75 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-sm transition-all border border-white/20 shadow-lg cursor-pointer"
                      title="Previous Photo"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewMediaIndex(prev => (prev + 1) % previewPhotos.length);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-950/75 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-sm transition-all border border-white/20 shadow-lg cursor-pointer"
                      title="Next Photo"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* Photo Counter Pill */}
                    <div className="absolute bottom-2.5 left-2.5 bg-slate-950/80 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full border border-white/10">
                      {previewMediaIndex + 1} / {previewPhotos.length} Photos
                    </div>
                  </>
                )}

                {previewPhotos.length === 1 && (
                  <div className="absolute bottom-2.5 left-2.5 bg-slate-950/80 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full border border-white/10">
                    1 Photo
                  </div>
                )}
              </div>

              {/* Videos Availability Notice (if property has walkthrough / drone videos) */}
              {previewVideos.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-200/90 rounded-xl px-3 py-2 flex items-center justify-between text-xs font-bold text-amber-900">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{previewVideos.length} {previewVideos.length === 1 ? 'Video' : 'Videos'} (Walkthrough / Drone)</span>
                  </div>
                  <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded">
                    Watch on Full Page
                  </span>
                </div>
              )}

              {/* 2. TITLE & LOCATION */}
              <div>
                <h3 className="text-base font-extrabold text-slate-900 line-clamp-2 leading-snug">
                  {selectedPropertyPreview.title}
                </h3>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="line-clamp-1">
                    {locationDetails?.fullText || 'India'}
                  </span>
                </div>
              </div>

              {/* 3. PRICE & AREA HIGHLIGHT BOX */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100/80 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Listed Price</span>
                  <span className="text-lg font-black text-emerald-700 block">
                    {selectedPropertyPreview.priceDisplay || (selectedPropertyPreview.price ? `Rs. ${Number(selectedPropertyPreview.price).toLocaleString('en-IN')}` : 'Price on Request')}
                  </span>
                  {ratePerSqFt && (
                    <span className="text-[10px] font-bold text-slate-500">
                      {ratePerSqFt}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Property Area</span>
                  <span className="text-sm font-black text-slate-800 block">
                    {selectedPropertyPreview.areaDisplay || (selectedPropertyPreview.area ? `${selectedPropertyPreview.area} sq ft` : 'N/A')}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 inline-block mt-0.5">
                    Direct Owner
                  </span>
                </div>
              </div>

              {/* 4. KEY SPECIFICATIONS */}
              {previewSpecs.length > 0 && (
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Key Specifications</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {previewSpecs.map((chip, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                          {chip.icon === 'bed' && <Bed className="w-3.5 h-3.5" />}
                          {chip.icon === 'bath' && <Bath className="w-3.5 h-3.5" />}
                          {chip.icon === 'compass' && <Compass className="w-3.5 h-3.5" />}
                          {chip.icon === 'sofa' && <Sofa className="w-3.5 h-3.5" />}
                          {chip.icon === 'car' && <Car className="w-3.5 h-3.5" />}
                          {chip.icon === 'calendar' && <Calendar className="w-3.5 h-3.5" />}
                          {chip.icon === 'layers' && <Layers className="w-3.5 h-3.5" />}
                          {chip.icon === 'check' && <Check className="w-3.5 h-3.5" />}
                          {chip.icon === 'building' && <Building className="w-3.5 h-3.5" />}
                          {chip.icon === 'shield' && <ShieldCheck className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 font-bold block truncate">{chip.label}</span>
                          <span className="text-xs font-extrabold text-slate-800 block truncate">{chip.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. AMENITIES */}
              {previewAmenities.length > 0 && (
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Amenities & Facilities</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {previewAmenities.map((amenityLabel, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-emerald-200/60"
                      >
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{amenityLabel}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. LOCATION & ADMINISTRATIVE HIERARCHY */}
              {locationDetails && (locationDetails.mandal || locationDetails.district || locationDetails.state || locationDetails.pincode) && (
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    <span>Location & Administration</span>
                  </h4>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs space-y-1.5">
                    {locationDetails.locality && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Locality:</span>
                        <span className="text-slate-800 font-extrabold">{locationDetails.locality}</span>
                      </div>
                    )}
                    {locationDetails.city && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">City / Town:</span>
                        <span className="text-slate-800 font-extrabold">{locationDetails.city}</span>
                      </div>
                    )}
                    {locationDetails.mandal && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Mandal / Taluk:</span>
                        <span className="text-slate-800 font-extrabold">{locationDetails.mandal}</span>
                      </div>
                    )}
                    {locationDetails.district && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">District:</span>
                        <span className="text-slate-800 font-extrabold">{locationDetails.district}</span>
                      </div>
                    )}
                    {locationDetails.state && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">State:</span>
                        <span className="text-slate-800 font-extrabold">{locationDetails.state}</span>
                      </div>
                    )}
                    {locationDetails.pincode && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">PIN Code:</span>
                        <span className="text-slate-800 font-extrabold">{locationDetails.pincode}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 7. PROPERTY OVERVIEW DESCRIPTION */}
              {previewDescription && (
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2">
                    Property Overview
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100 whitespace-pre-line">
                    {previewDescription}
                  </p>
                </div>
              )}

              {/* 8. TRUST & VERIFICATION GUARANTEE BANNER */}
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="text-[11px] text-amber-900 font-bold leading-snug">
                  100% Platform Verified Listing with authenticated property records and complete transaction support.
                </div>
              </div>

            </div>

            {/* CARD FOOTER (STICKY BOTTOM ACTION BUTTON) */}
            <div className="p-3.5 bg-white border-t border-slate-100 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
              <button
                onClick={() => onSelectProperty(selectedPropertyPreview)}
                className="w-full bg-brand-yellow hover:bg-brand-yellowHover text-slate-900 font-black text-xs py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>View Dedicated Property Page</span>
                <ChevronRight className="w-4 h-4 shrink-0 text-slate-900 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

          </div>
        )}

      </div>

      {/* FULL GOOGLE MAPS DETAILS & MAP TYPE MODAL */}
      {mapModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-gray-200 animate-in zoom-in-95">
            
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <h3 className="text-base font-extrabold text-brand-charcoal">Map details</h3>
              <button
                onClick={() => setMapModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-brand-charcoal rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MAP DETAILS SECTION */}
            <div className="mb-6">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setActiveDetail(prev => prev === 'transit' ? null : 'transit')}
                  className={`p-3 rounded-2xl border flex flex-col items-center transition-all ${
                    activeDetail === 'transit'
                      ? 'border-brand-yellow bg-brand-yellow/10 ring-2 ring-brand-yellow/30'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                    <Bus className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-brand-charcoal">Transit</span>
                </button>

                <button
                  onClick={() => setActiveDetail(prev => prev === 'traffic' ? null : 'traffic')}
                  className={`p-3 rounded-2xl border flex flex-col items-center transition-all ${
                    activeDetail === 'traffic'
                      ? 'border-brand-yellow bg-brand-yellow/10 ring-2 ring-brand-yellow/30'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-2">
                    <Car className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-brand-charcoal">Traffic</span>
                </button>

                <button
                  onClick={() => setActiveDetail(prev => prev === 'biking' ? null : 'biking')}
                  className={`p-3 rounded-2xl border flex flex-col items-center transition-all ${
                    activeDetail === 'biking'
                      ? 'border-brand-yellow bg-brand-yellow/10 ring-2 ring-brand-yellow/30'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                    <Bike className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-brand-charcoal">Biking</span>
                </button>

                <button
                  onClick={() => setActiveDetail(prev => prev === 'terrain' ? null : 'terrain')}
                  className={`p-3 rounded-2xl border flex flex-col items-center transition-all ${
                    activeDetail === 'terrain'
                      ? 'border-brand-yellow bg-brand-yellow/10 ring-2 ring-brand-yellow/30'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                    <Mountain className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-brand-charcoal">Terrain</span>
                </button>
              </div>
            </div>

            {/* MAP TYPE SECTION */}
            <div className="pt-5 border-t border-gray-100">
              <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-3">Map type</h4>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => setMapType('default')}
                  className={`p-3 rounded-2xl border flex flex-col items-center transition-all ${
                    mapType === 'default'
                      ? 'border-emerald-600 ring-2 ring-emerald-600/20 bg-emerald-50/50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-14 h-14 rounded-xl bg-gray-200 overflow-hidden mb-2">
                    <img
                      src="https://mt1.google.com/vt/lyrs=m&x=1468&y=948&z=11"
                      alt="Default Roadmap"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs font-extrabold text-brand-charcoal">Default</span>
                </button>

                <button
                  onClick={() => setMapType('satellite')}
                  className={`p-3 rounded-2xl border flex flex-col items-center transition-all ${
                    mapType === 'satellite'
                      ? 'border-emerald-600 ring-2 ring-emerald-600/20 bg-emerald-50/50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-14 h-14 rounded-xl bg-gray-200 overflow-hidden mb-2">
                    <img
                      src="https://mt1.google.com/vt/lyrs=y&x=1468&y=948&z=11"
                      alt="Satellite"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs font-extrabold text-brand-charcoal">Satellite</span>
                </button>
              </div>

              {/* LABELS TOGGLE CHECKBOX FOR SATELLITE */}
              {mapType === 'satellite' && (
                <label className="flex items-center gap-2 cursor-pointer pt-2 select-none">
                  <input
                    type="checkbox"
                    checked={showLabels}
                    onChange={(e) => setShowLabels(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-yellow focus:ring-brand-yellow border-gray-300"
                  />
                  <span className="text-xs font-bold text-brand-charcoal">Show Street & City Labels</span>
                </label>
              )}
            </div>

            <button
              onClick={() => setMapModalOpen(false)}
              className="w-full mt-6 bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs py-3 rounded-xl shadow"
            >
              Done
            </button>

          </div>
        </div>
      )}


    </div>
  );
}
