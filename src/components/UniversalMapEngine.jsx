import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Filter, ShieldCheck, Heart, ChevronRight, ChevronLeft, X, Building, Layers, MapPin, Navigation, Compass, Check, Car, Bus, Bike, Mountain } from 'lucide-react';
import DynamicFilterPanel from './DynamicFilterPanel';
import { deduplicateProperties, mockApi } from '../services/mockApi';
import { extractCoordinates, extractBoundaryPolygon } from '../services/locationProvider';

// Fix default Leaflet marker icon asset URLs in React Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function UniversalMapEngine({
  properties = [],
  filters = {},
  setFilters,
  onSelectProperty,
  onWishlistToggle,
  isWishlisted,
  focusedProperty = null,
  hideSidePanel = false
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const trafficLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const userLocationMarkerRef = useRef(null);

  // Guarantee ZERO duplicate listings in sidebar drawer or on map canvas
  const displayProperties = useMemo(() => deduplicateProperties(properties), [properties]);

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(!hideSidePanel);
  const [selectedPropertyPreview, setSelectedPropertyPreview] = useState(null);

  // Google Maps Layers State
  const [mapType, setMapType] = useState('default'); // 'default' (roadmap), 'satellite'
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

    // Layer groups for markers & polygons
    markersLayerRef.current = L.layerGroup().addTo(map);
    polygonLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Dynamically update zoom state & marker popup text on zoom in / out
    const handleZoomChange = () => {
      const activeZoom = map.getZoom();
      setCurrentZoom(activeZoom);

      if (userLocationMarkerRef.current) {
        const isAdjusted = filters?.locationAdjusted;
        const titleText = isAdjusted ? 'Adjusted Location' : 'YOUR CURRENT LOCATION';
        const bodyText = isAdjusted ? 'Exact Location Confirmed' : '📍 You Are Here';
        
        userLocationMarkerRef.current.setPopupContent(`
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; text-align: center; padding: 6px 8px;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #2563eb; letter-spacing: 0.5px;">${titleText}</div>
            <div style="font-size: 13px; font-weight: 800; color: #0b2545; margin-top: 2px;">${bodyText} (Zoom Level ${activeZoom})</div>
            <div style="font-size: 10px; font-weight: 600; color: #64748b; margin-top: 4px;">Click pin anytime to zoom to MAX (Level 22)</div>
          </div>
        `);
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
      
      const currentMapZoom = mapInstanceRef.current ? mapInstanceRef.current.getZoom() : locZoom;
      const popupText = filters?.locationAdjusted 
        ? `Exact Location Confirmed (Zoom Level ${currentMapZoom})`
        : `📍 You Are Here (Zoom Level ${currentMapZoom})`;

      marker.bindPopup(`
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; text-align: center; padding: 6px 8px;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #2563eb; letter-spacing: 0.5px;">${filters?.locationAdjusted ? 'Adjusted Location' : 'YOUR CURRENT LOCATION'}</div>
          <div style="font-size: 13px; font-weight: 800; color: #0b2545; margin-top: 2px;">${popupText}</div>
          <div style="font-size: 10px; font-weight: 600; color: #64748b; margin-top: 4px;">Click pin anytime to zoom to MAX (Level 22)</div>
        </div>
      `, { offset: [0, -10] }).openPopup();

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

      // Clean High-Contrast Hover/Click Popup Card
      const popupContent = `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 2px;">
          <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #F4C542; background: rgba(244, 197, 66, 0.15); border: 1px solid rgba(244, 197, 66, 0.4); padding: 2.5px 8px; border-radius: 6px; display: inline-block; margin-bottom: 6px; letter-spacing: 0.5px;">
            ${prop.verificationStatus || 'PLATFORM VERIFIED'}
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #ffffff; margin-bottom: 4px; line-height: 1.2;">
            ${prop.title || 'Property'}
          </div>
          <div style="font-size: 14px; font-weight: 900; color: #34d399; margin-bottom: 2px;">
            ${priceLabel}
          </div>
          <div style="font-size: 11px; font-weight: 600; color: #cbd5e1;">
            Area: ${prop.areaDisplay || (prop.area ? prop.area + ' sq ft' : '')}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { offset: [0, -45] });

      // Marker Click -> Ultra-Deep MAX Zoom (Level 22) + Open Preview Card Modal
      marker.on('click', () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 22, { animate: true });
        }
        setSelectedPropertyPreview(prop);
      });

      markersLayerRef.current.addLayer(marker);

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
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([lat, lng], 22, { animate: true });
          }
          setSelectedPropertyPreview(prop);
        });
        if (polygonLayerRef.current) {
          polygonLayerRef.current.addLayer(polygon);
        }
      }
    });

    if (!focusedProperty && !filters?.userLat && bounds.length > 0) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [displayProperties, filters?.userLat]);

  return (
    <div className="relative w-full h-full bg-gray-100 flex flex-row overflow-hidden">
      
      {/* LEFT PROPERTY LIST CONTAINER (Fixed Width 380px/400px Collapsible Side Panel) */}
      {!hideSidePanel && (
        <div className={`w-full md:w-[380px] lg:w-[400px] flex-shrink-0 h-full bg-white border-r border-gray-200 flex flex-col z-10 shadow-lg transition-all duration-300 ease-in-out ${
          isSidePanelOpen ? 'ml-0' : '-ml-[100%] md:-ml-[380px] lg:-ml-[400px]'
        }`}>
          
          {/* LIST HEADER WITH CLOSE TOGGLE BUTTON & ADDRESS SEARCH */}
          <div className="p-4 border-b border-gray-100 bg-brand-charcoal text-white flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-brand-yellow font-extrabold uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Universal Map Discovery</span>
                </div>
                <h2 className="text-lg font-extrabold text-white">
                  {filters?.cleared ? '0 Properties (Filters Cleared)' : `${displayProperties.length} Properties Found`}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterPanelOpen(true)}
                  className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow"
                >
                  <Filter className="w-3.5 h-3.5 stroke-[2.5]" />
                  Filters
                </button>

                <button
                  onClick={() => setIsSidePanelOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  title="Collapse Side Panel"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Deep Address & Locality Quick Search Input Bar with Detect Location Button */}
            <div className="relative">
              <MapPin className="w-4 h-4 text-brand-yellow absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder='Try searching "Hyderabad" or click detect location...'
                value={filters?.query || filters?.address || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters(prev => ({
                    ...prev,
                    cleared: false,
                    query: val,
                    address: val
                  }));
                }}
                className="w-full pl-9 pr-10 py-2 bg-white/10 border border-white/20 rounded-xl text-xs font-semibold text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-yellow"
              />
              <button
                type="button"
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const { latitude, longitude } = pos.coords;
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.setView([latitude, longitude], 20, { animate: true });
                        }
                        setFilters(prev => ({
                          ...prev,
                          cleared: false,
                          query: 'Near Me',
                          address: 'Near Me',
                          userLat: latitude,
                          userLng: longitude
                        }));
                      },
                      () => alert('Could not access device GPS. Displaying properties in current view.')
                    );
                  }
                }}
                title="Detect My Current Location"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 flex items-center justify-center transition-colors"
              >
                <Navigation className="w-3.5 h-3.5 text-blue-300" />
              </button>
            </div>
          </div>

          {/* PROPERTY LIST CARDS */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  onClick={() => setSelectedPropertyPreview(prop)}
                  className={`group bg-white rounded-xl border transition-all cursor-pointer overflow-hidden flex flex-col ${
                    selectedPropertyPreview?.id === prop.id
                      ? 'border-brand-yellow ring-2 ring-brand-yellow/30 shadow-lg'
                      : 'border-gray-200 hover:border-brand-yellow hover:shadow-md'
                  }`}
                >
                  <div className="relative h-44 bg-gray-100 overflow-hidden">
                    <img
                      src={prop.photos?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'}
                      alt={prop.title}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    <div className="absolute top-3 left-3 bg-slate-950 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md border border-amber-400/40">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-metallic-gold font-black">
                        {prop.verificationStatus || 'PLATFORM VERIFIED'}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 bg-slate-900 text-amber-400 text-[10px] font-bold px-2 py-1 rounded border border-slate-700 shadow-sm">
                      {prop.category}
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
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] border ${getBoundaryStyle(prop).badgeClass}`}>
                            {getBoundaryStyle(prop).typeLabel}
                          </span>
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-extrabold text-[10px]">
                            Direct Owner
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
                          onSelectProperty(prop);
                        }}
                        className="w-full mt-3 bg-brand-charcoal hover:bg-amber-400 font-extrabold text-xs py-2.5 rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-1.5 border border-transparent hover:border-amber-300 cursor-pointer"
                        style={{ color: '#ffffff' }}
                      >
                        <span className="font-black tracking-wide drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.85)]" style={{ color: '#ffffff' }}>View Property Details</span>
                        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: '#ffffff' }} />
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

        {/* LIVE REAL-TIME MAP ZOOM LEVEL BADGE */}
        <div className="absolute top-4 right-14 z-20 bg-brand-charcoal/90 backdrop-blur-md text-white border border-white/20 rounded-xl px-3.5 py-1.5 shadow-xl flex items-center gap-2 text-xs font-mono font-bold select-none">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Active Zoom: <strong className="text-brand-yellow text-sm font-black">{currentZoom}</strong> / 22</span>
        </div>

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

        {/* TOP-RIGHT CORNER MAP LEGEND CARD */}
        <div className="absolute top-4 right-16 z-30 bg-brand-charcoal/95 backdrop-blur-md text-white p-3 rounded-2xl border border-white/15 shadow-2xl w-60">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-brand-yellow">
              <Compass className="w-3.5 h-3.5" />
              <span>Map Price Legend</span>
            </div>
            <span className="text-[10px] text-gray-400 font-semibold uppercase">Color Guide</span>
          </div>

          <div className="space-y-2 text-xs font-semibold">
            {/* Item 1: Above 1.5 Cr */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#0B2545] border border-[#F4C542] shrink-0 shadow-sm"></span>
                <span className="text-gray-200">Above Rs. 1.5 Cr</span>
              </div>
              <span className="text-[10px] text-brand-yellow font-bold">Luxury</span>
            </div>

            {/* Item 2: 60 L - 1.5 Cr */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#F4C542] border border-[#B48B1B] shrink-0 shadow-sm"></span>
                <span className="text-gray-200">Rs. 60 L – 1.5 Cr</span>
              </div>
              <span className="text-[10px] text-amber-300 font-bold">Premium</span>
            </div>

            {/* Item 3: 30 L - 60 L */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#7c3aed] border border-[#5b21b6] shrink-0 shadow-sm"></span>
                <span className="text-gray-200">Rs. 30 L – 60 L</span>
              </div>
              <span className="text-[10px] text-purple-300 font-bold">Mid-Range</span>
            </div>

            {/* Item 4: Below 30 L */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#22c55e] border border-[#15803d] shrink-0 shadow-sm"></span>
                <span className="text-gray-200">Below Rs. 30 L</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold">Affordable</span>
            </div>

            {/* Item 5: Purpose Boundary Delineation */}
            <div className="pt-2 border-t border-white/10 space-y-1.5">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase block tracking-wider">Boundary Colors</span>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-2.5 rounded bg-[#f59e0b]/30 border border-dashed border-[#f59e0b] shrink-0"></span>
                  <span className="text-gray-200 text-[11px]">For Sale Boundary</span>
                </div>
                <span className="text-[10px] text-amber-400 font-extrabold">Gold / Amber</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-2.5 rounded bg-[#10b981]/30 border border-dashed border-[#10b981] shrink-0"></span>
                  <span className="text-gray-200 text-[11px]">For Rent Boundary</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-extrabold">Emerald Green</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-2.5 rounded bg-[#3b82f6]/30 border border-dashed border-[#3b82f6] shrink-0"></span>
                  <span className="text-gray-200 text-[11px]">For Lease Boundary</span>
                </div>
                <span className="text-[10px] text-blue-400 font-extrabold">Royal Blue</span>
              </div>
            </div>
          </div>
        </div>

        {/* PROPERTY PREVIEW CARD OVERLAY ON MAP MARKER CLICK */}
        {selectedPropertyPreview && (
          <div className="absolute bottom-6 right-6 z-30 w-80 bg-white rounded-2xl p-4 shadow-2xl border border-brand-bordergray animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold bg-brand-charcoal text-brand-yellow px-2 py-0.5 rounded uppercase">
                {selectedPropertyPreview.verificationStatus}
              </span>
              <button
                onClick={() => setSelectedPropertyPreview(null)}
                className="p-1 text-gray-400 hover:text-brand-charcoal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <img
              src={selectedPropertyPreview.photos?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'}
              alt={selectedPropertyPreview.title}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';
              }}
              className="w-full h-32 object-cover rounded-xl mb-3"
            />

            <h4 className="text-sm font-bold text-brand-charcoal line-clamp-1 mb-1">
              {selectedPropertyPreview.title}
            </h4>

            <p className="text-xs text-gray-500 font-medium mb-3">
              {[selectedPropertyPreview.location?.locality, selectedPropertyPreview.location?.city, selectedPropertyPreview.location?.state].filter(Boolean).join(', ') || 'India'}
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100 mb-3">
              <span className="text-sm font-extrabold text-emerald-700">
                {selectedPropertyPreview.priceDisplay}
              </span>
              <span className="text-xs font-bold text-gray-600">
                {selectedPropertyPreview.areaDisplay}
              </span>
            </div>

            <button
              onClick={() => onSelectProperty(selectedPropertyPreview)}
              className="w-full bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs py-2.5 rounded-xl shadow transition-all text-center"
            >
              View Dedicated Property Page
            </button>
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

      {/* DYNAMIC FILTER PANEL SLIDE OUT */}
      <DynamicFilterPanel
        isOpen={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onApplyFilters={() => {}}
        totalCount={properties.length}
      />

    </div>
  );
}
