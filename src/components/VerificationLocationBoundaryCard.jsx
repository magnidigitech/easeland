import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Layers,
  Compass,
  ExternalLink,
  Copy,
  Check,
  Maximize2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { extractCoordinates, extractBoundaryPolygon } from '../services/locationProvider.js';
import { calculateApproximatePolygonAreaSqFt } from '../firebase/boundaryService.js';

// Fix Leaflet marker icons in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Calculate distance in meters between two lat/lng coordinates (Haversine formula)
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function VerificationLocationBoundaryCard({
  property,
  pendingReauditData = null,
  locationDiff = null,
  boundaryDiff = null
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef(null);
  const tileLayerRef = useRef(null);

  const [mapType, setMapType] = useState('satellite'); // 'satellite' | 'street'
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [showCoordinatesTable, setShowCoordinatesTable] = useState(false);

  if (!property) return null;

  const propId = property.id || property.propertyId || 'prop_audit';
  const pending = pendingReauditData || property.pendingReauditData || null;
  const isReaudit = Boolean(pending && (property.hasPendingEdits || pending));

  // 1. Resolve Location Details
  const liveLoc = property.location || {};
  const pendingLoc = pending?.location || {};

  const effectiveLoc = isReaudit && pendingLoc.address ? pendingLoc : liveLoc;

  const rawAddress = (isReaudit && pendingLoc.address) ? pendingLoc.address : (liveLoc.address || property.address || '');
  const locality = cleanVal(effectiveLoc.locality || property.locality);
  const city = cleanVal(effectiveLoc.city || property.city);
  const district = cleanVal(effectiveLoc.district || property.district);
  const state = cleanVal(effectiveLoc.state || property.state);
  const pincode = cleanVal(effectiveLoc.pincode || property.pincode);

  const surveyNo = cleanVal(effectiveLoc.surveyNo || property.surveyNo || liveLoc.surveyNo || 'N/A');
  const lpNo = cleanVal(effectiveLoc.lpNo || property.lpNo || liveLoc.lpNo || 'N/A');
  const facing = cleanVal(property.facing || property.specs?.facing || 'East');
  const dimensions = cleanVal(property.dimensions || property.specs?.dimensions || 'Standard Plot');

  // Proposed vs Live differences
  const isLocationModified = Boolean(locationDiff?.changed);
  const isBoundaryModified = Boolean(boundaryDiff?.changed);

  // 2. Extract Coordinates
  const liveCoords = extractCoordinates(property);
  const pendingCoords = pending ? extractCoordinates(pending) : { lat: NaN, lng: NaN };

  const hasLiveCoords = !isNaN(liveCoords.lat) && !isNaN(liveCoords.lng) && (liveCoords.lat !== 0 || liveCoords.lng !== 0);
  const hasPendingCoords = !isNaN(pendingCoords.lat) && !isNaN(pendingCoords.lng) && (pendingCoords.lat !== 0 || pendingCoords.lng !== 0);

  const activeCoords = (isReaudit && hasPendingCoords) ? pendingCoords : (hasLiveCoords ? liveCoords : { lat: 16.3067, lng: 80.4365 });

  const latDisplay = !isNaN(activeCoords.lat) ? Number(activeCoords.lat).toFixed(6) : 'N/A';
  const lngDisplay = !isNaN(activeCoords.lng) ? Number(activeCoords.lng).toFixed(6) : 'N/A';
  const googleMapsUrl = 'https://www.google.com/maps?q=' + latDisplay + ',' + lngDisplay;

  // 3. Extract Boundary Polygons
  const livePoly = extractBoundaryPolygon(property);
  const pendingPoly = pending ? extractBoundaryPolygon(pending) : [];

  const hasLivePoly = livePoly.length >= 3;
  const hasPendingPoly = pendingPoly.length >= 3;

  // Calculate Areas
  const liveVertices = livePoly.map(pt => ({ lat: pt[0], lng: pt[1] }));
  const proposedVertices = pendingPoly.map(pt => ({ lat: pt[0], lng: pt[1] }));

  const liveAreaSqFt = hasLivePoly ? calculateApproximatePolygonAreaSqFt(liveVertices) : 0;
  const proposedAreaSqFt = hasPendingPoly ? calculateApproximatePolygonAreaSqFt(proposedVertices) : 0;

  const activePoly = (isReaudit && hasPendingPoly) ? pendingPoly : livePoly;
  const activeAreaSqFt = (isReaudit && hasPendingPoly) ? proposedAreaSqFt : liveAreaSqFt;

  const activeAreaSqYds = Math.round(activeAreaSqFt / 9);
  const activeAreaAcres = (activeAreaSqFt / 43560).toFixed(3);
  const activeAreaCents = (activeAreaSqFt / 435.6).toFixed(2);

  const handleCopyCoordinates = () => {
    if (latDisplay !== 'N/A' && lngDisplay !== 'N/A') {
      const text = latDisplay + ', ' + lngDisplay;
      navigator.clipboard.writeText(text);
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 2000);
    }
  };

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up existing map instance if property changed
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const initialCenterLat = activeCoords.lat || 16.3067;
    const initialCenterLng = activeCoords.lng || 80.4365;

    const map = L.map(mapContainerRef.current, {
      center: [initialCenterLat, initialCenterLng],
      zoom: 17,
      zoomControl: true
    });

    mapInstanceRef.current = map;

    // Set Tile Layer
    const satTileUrl = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
    const streetTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const currentUrl = mapType === 'satellite' ? satTileUrl : streetTileUrl;
    const currentLayer = L.tileLayer(currentUrl, {
      subdomains: mapType === 'satellite' ? '0123' : 'abc',
      maxZoom: 21,
      maxNativeZoom: mapType === 'satellite' ? 20 : 19,
      attribution: mapType === 'satellite' ? 'Google Satellite Hybrid' : 'OpenStreetMap'
    }).addTo(map);

    tileLayerRef.current = currentLayer;

    // Layer Group for markers & polygons
    const layersGroup = L.layerGroup().addTo(map);
    layersGroupRef.current = layersGroup;

    const allLatLngs = [];

    // Case A: Re-verification with Modified Boundary -> Render BOTH Live (dashed blue) & Proposed (vibrant purple/emerald)
    if (isReaudit && isBoundaryModified && hasLivePoly && hasPendingPoly) {
      // 1. Live Approved Boundary (Dashed Blue)
      const liveLayer = L.polygon(livePoly, {
        color: '#2563EB',
        dashArray: '6, 6',
        weight: 3,
        fillColor: '#3B82F6',
        fillOpacity: 0.15
      }).addTo(layersGroup);
      liveLayer.bindPopup('<strong style="color: #1D4ED8;">Live Approved Boundary</strong><br/>' + livePoly.length + ' vertices • ' + liveAreaSqFt.toLocaleString('en-IN') + ' sq ft');

      // 2. Proposed Boundary (Solid Purple/Emerald with vertex markers)
      const proposedLayer = L.polygon(pendingPoly, {
        color: '#7C3AED',
        weight: 3.5,
        fillColor: '#8B5CF6',
        fillOpacity: 0.28
      }).addTo(layersGroup);
      proposedLayer.bindPopup('<strong style="color: #6D28D9;">Proposed New Boundary (Awaiting Verification)</strong><br/>' + pendingPoly.length + ' vertices • ' + proposedAreaSqFt.toLocaleString('en-IN') + ' sq ft');

      // Add vertex markers on proposed polygon
      pendingPoly.forEach((pt, idx) => {
        allLatLngs.push(pt);
        const markerIcon = L.divIcon({
          className: 'custom-vertex-marker',
          html: '<div style="background-color: #6D28D9; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">' + (idx + 1) + '</div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        L.marker(pt, { icon: markerIcon }).addTo(layersGroup).bindPopup('Proposed Vertex Point ' + (idx + 1) + '<br/>Lat: ' + pt[0].toFixed(6) + '<br/>Lng: ' + pt[1].toFixed(6));
      });

      livePoly.forEach(pt => allLatLngs.push(pt));
    } else if (activePoly.length >= 3) {
      // Case B: Standard Audit or Non-modified polygon -> Render single crisp boundary
      const polygonLayer = L.polygon(activePoly, {
        color: '#059669',
        weight: 3.5,
        fillColor: '#10B981',
        fillOpacity: 0.25
      }).addTo(layersGroup);

      polygonLayer.bindPopup('<strong style="color: #047857;">Verified Plot Boundary</strong><br/>' + activePoly.length + ' corner points • ' + activeAreaSqFt.toLocaleString('en-IN') + ' sq ft');

      activePoly.forEach((pt, idx) => {
        allLatLngs.push(pt);
        const markerIcon = L.divIcon({
          className: 'custom-vertex-marker',
          html: '<div style="background-color: #059669; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">' + (idx + 1) + '</div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        L.marker(pt, { icon: markerIcon }).addTo(layersGroup).bindPopup('Corner Vertex ' + (idx + 1) + '<br/>Lat: ' + pt[0].toFixed(6) + '<br/>Lng: ' + pt[1].toFixed(6));
      });
    }

    // Centroid / Property Pin
    if (activeCoords.lat && activeCoords.lng) {
      allLatLngs.push([activeCoords.lat, activeCoords.lng]);
      const pinIcon = L.divIcon({
        className: 'custom-pin-marker',
        html: '<div style="background-color: #DC2626; color: white; padding: 6px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;">📍</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      L.marker([activeCoords.lat, activeCoords.lng], { icon: pinIcon })
        .addTo(layersGroup)
        .bindPopup('<strong>' + (property.title || 'Property Location') + '</strong><br/>' + (rawAddress || 'Verified Pin'));
    }

    // Auto-fit bounds
    if (allLatLngs.length > 0) {
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });
    }

    // Ensure map tiles render crisply after DOM transition
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [propId, mapType, isReaudit, isBoundaryModified, activeCoords.lat, activeCoords.lng, livePoly.length, pendingPoly.length]);

  const handleResetMap = () => {
    if (!mapInstanceRef.current) return;
    const allLatLngs = [];
    if (activePoly.length > 0) activePoly.forEach(pt => allLatLngs.push(pt));
    if (livePoly.length > 0) livePoly.forEach(pt => allLatLngs.push(pt));
    if (activeCoords.lat && activeCoords.lng) allLatLngs.push([activeCoords.lat, activeCoords.lng]);

    if (allLatLngs.length > 0) {
      const bounds = L.latLngBounds(allLatLngs);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });
    } else {
      mapInstanceRef.current.setView([activeCoords.lat || 16.3067, activeCoords.lng || 80.4365], 17);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-slate-50 to-amber-50/40 p-3.5 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 text-amber-700 rounded-lg border border-amber-300">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <span>Location Coordinates & Plot Boundary Verification</span>
              {(isLocationModified || isBoundaryModified) && (
                <span className="text-[10px] font-black uppercase bg-purple-200 text-purple-950 px-2 py-0.5 rounded border border-purple-300 animate-pulse">
                  LOCATION / BOUNDARY MODIFIED
                </span>
              )}
            </h4>
            <p className="text-[11px] font-semibold text-slate-500">
              Interactive spatial canvas, cadastral land boundaries, and vertex corner inspection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activePoly.length >= 3 ? (
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Boundary Geo-Mapped ({activePoly.length} Vertices)</span>
            </span>
          ) : (
            <span className="bg-amber-100 text-amber-800 text-[11px] font-extrabold px-2.5 py-1 rounded-lg border border-amber-300 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              <span>Location Pin Only (Polygon Pending)</span>
            </span>
          )}
        </div>
      </div>

      {/* 4-COLUMN SUMMARY METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">

        {/* 1. STREET & ADMINISTRATIVE ADDRESS */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-300 space-y-1.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-600" />
                <span>Physical Address</span>
              </span>
              {locationDiff?.addressDiff && (
                <span className="text-[9px] font-black uppercase bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded border border-purple-300">
                  MODIFIED
                </span>
              )}
            </div>

            {locationDiff?.addressDiff ? (
              <div className="space-y-1 mt-1">
                <div className="text-[11px] text-slate-500 line-through">
                  Live: {locationDiff.liveAddress}
                </div>
                <div className="text-xs font-black text-purple-950">
                  Proposed: {locationDiff.proposedAddress}
                </div>
              </div>
            ) : (
              <div className="text-xs font-black text-slate-900 mt-1 line-clamp-2" title={rawAddress}>
                {rawAddress || 'Address details not set'}
              </div>
            )}
          </div>

          <div className="text-[11px] font-bold text-slate-600 border-t border-slate-200 pt-1.5">
            {locality && <span>{locality}, </span>}
            {city && <span>{city}, </span>}
            {district && <span>{district}, </span>}
            {state && <span>{state}</span>}
            {pincode && <span> - {pincode}</span>}
          </div>
        </div>

        {/* 2. GEOGRAPHIC COORDINATES */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-300 space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <Compass className="w-3 h-3 text-blue-600" />
                <span>Spatial Coordinates</span>
              </span>
              {locationDiff?.coordsDiff && (
                <span className="text-[9px] font-black uppercase bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded border border-purple-300">
                  MODIFIED
                </span>
              )}
            </div>

            <div className="mt-1 font-mono text-xs font-black text-slate-900">
              <div>LAT: {latDisplay}</div>
              <div>LNG: {lngDisplay}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-t border-slate-200 pt-1.5">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-extrabold flex items-center justify-center gap-1 shadow-sm transition-all"
            >
              <span>Google Maps</span>
              <ExternalLink className="w-3 h-3 text-blue-600" />
            </a>
            <button
              type="button"
              onClick={handleCopyCoordinates}
              className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] font-extrabold flex items-center gap-1 shadow-sm transition-all"
              title="Copy latitude and longitude coordinates"
            >
              {copiedCoords ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-600" />}
              <span>{copiedCoords ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* 3. CADASTRAL & SURVEY IDENTIFIERS */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-300 space-y-1.5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Cadastral Identifiers
            </span>
            <div className="mt-1 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">Survey No:</span>
                <span className="text-slate-900 font-black">{surveyNo}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">LP / Layout:</span>
                <span className="text-slate-900 font-black">{lpNo}</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] font-bold text-slate-600 border-t border-slate-200 pt-1.5 flex justify-between">
            <span>Facing: <strong className="text-slate-900">{facing}</strong></span>
            <span>Dim: <strong className="text-slate-900">{dimensions}</strong></span>
          </div>
        </div>

        {/* 4. PLOT BOUNDARY AREA & VERTICES */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-300 space-y-1.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Plot Geometry & Area
              </span>
              {isBoundaryModified && (
                <span className="text-[9px] font-black uppercase bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded border border-purple-300">
                  MODIFIED
                </span>
              )}
            </div>

            {activeAreaSqFt > 0 ? (
              <div className="mt-1">
                <div className="text-sm font-black text-emerald-700">
                  {activeAreaSqFt.toLocaleString('en-IN')} sq ft
                </div>
                <div className="text-[11px] font-extrabold text-slate-600">
                  ~ {activeAreaSqYds.toLocaleString('en-IN')} sq yds • {activeAreaAcres} acres
                </div>
              </div>
            ) : (
              <div className="mt-1 text-xs font-bold text-slate-500 italic">
                Boundary geometry not plotted
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-1.5 flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-600">Corners:</span>
            <span className="font-extrabold text-slate-900">
              {activePoly.length > 0 ? (activePoly.length + ' Vertices') : 'None'}
            </span>
          </div>
        </div>

      </div>

      {/* INTERACTIVE LEAFLET MAP CANVAS */}
      <div className="rounded-2xl border-2 border-slate-300 bg-slate-900 overflow-hidden shadow-md space-y-0">

        {/* MAP TOOLBAR */}
        <div className="p-2.5 bg-slate-950 text-white flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>Interactive Verification Map</span>
            </span>

            {/* Map Legend */}
            <div className="hidden sm:flex items-center gap-2.5 text-[11px] font-bold text-slate-300 ml-2 pl-3 border-l border-slate-800">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                <span>Pin Centroid</span>
              </span>
              {isReaudit && isBoundaryModified && hasLivePoly && hasPendingPoly ? (
                <>
                  <span className="flex items-center gap-1 text-blue-400">
                    <span className="w-3 h-0.5 border-t-2 border-dashed border-blue-400 inline-block"></span>
                    <span>Live Approved</span>
                  </span>
                  <span className="flex items-center gap-1 text-purple-400">
                    <span className="w-2.5 h-2.5 rounded bg-purple-500 inline-block"></span>
                    <span>Proposed New</span>
                  </span>
                </>
              ) : activePoly.length >= 3 ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span>
                  <span>Plot Boundary</span>
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tile Layer Toggle */}
            <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setMapType('satellite')}
                className={'px-2.5 py-1 text-[11px] font-extrabold rounded-md transition-all ' + (mapType === 'satellite' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-300 hover:text-white')}
              >
                🛰️ Satellite
              </button>
              <button
                type="button"
                onClick={() => setMapType('street')}
                className={'px-2.5 py-1 text-[11px] font-extrabold rounded-md transition-all ' + (mapType === 'street' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-300 hover:text-white')}
              >
                🗺️ Street
              </button>
            </div>

            {/* Reset View Button */}
            <button
              type="button"
              onClick={handleResetMap}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
              title="Reset zoom to fit boundary and coordinates"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset View</span>
            </button>
          </div>
        </div>

        {/* LEAFLET CANVAS CONTAINER */}
        <div className="relative w-full h-[360px] sm:h-[420px] bg-slate-900">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Floating Notice if no boundary exists */}
          {activePoly.length < 3 && (
            <div className="absolute top-3 left-3 right-3 sm:right-auto z-[500] bg-slate-900/90 backdrop-blur-md text-amber-300 text-xs font-bold px-3.5 py-2 rounded-xl border border-amber-500/40 shadow-lg flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Plot boundary polygon not drawn yet. Center pin indicates verified geographic location.</span>
            </div>
          )}

          {/* Re-audit comparison banner on map */}
          {isReaudit && isBoundaryModified && hasLivePoly && hasPendingPoly && (
            <div className="absolute bottom-3 left-3 z-[500] bg-purple-950/90 backdrop-blur-md text-purple-200 text-[11px] font-bold px-3.5 py-2 rounded-xl border border-purple-500/50 shadow-lg space-y-1">
              <div className="text-white font-black text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Boundary Modification Comparison</span>
              </div>
              <div>
                Live Approved: {livePoly.length} points • {liveAreaSqFt.toLocaleString('en-IN')} sq ft
              </div>
              <div className="text-purple-300 font-extrabold">
                Proposed New: {pendingPoly.length} points • {proposedAreaSqFt.toLocaleString('en-IN')} sq ft
                ({proposedAreaSqFt >= liveAreaSqFt ? '+' : ''}{(proposedAreaSqFt - liveAreaSqFt).toLocaleString('en-IN')} sq ft)
              </div>
            </div>
          )}
        </div>

        {/* MAP FOOTER / EXPANDABLE COORDINATES TABLE */}
        <div className="bg-slate-950 p-3 text-xs border-t border-slate-800 text-slate-300 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-400 text-[11px]">
              {activePoly.length >= 3 ? (
                <span>All {activePoly.length} boundary vertices verified against cadastral geometry.</span>
              ) : (
                <span>Coordinates pinpointed at {latDisplay}, {lngDisplay}</span>
              )}
            </span>

            {activePoly.length >= 3 && (
              <button
                type="button"
                onClick={() => setShowCoordinatesTable(!showCoordinatesTable)}
                className="text-amber-400 hover:text-amber-300 font-extrabold text-[11px] flex items-center gap-1 transition-colors"
              >
                <span>{showCoordinatesTable ? 'Hide Vertex Coordinates' : 'Inspect Vertex Coordinates (' + activePoly.length + ' points)'}</span>
                {showCoordinatesTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* TABLE OF VERTEX COORDINATES */}
          {showCoordinatesTable && activePoly.length >= 3 && (
            <div className="mt-2 bg-slate-900 rounded-xl p-3 border border-slate-800 overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                    <th className="py-1 px-2">Vertex #</th>
                    <th className="py-1 px-2">Latitude</th>
                    <th className="py-1 px-2">Longitude</th>
                    <th className="py-1 px-2">Segment Distance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {activePoly.map((pt, idx) => {
                    const nextPt = activePoly[(idx + 1) % activePoly.length];
                    const distMeters = haversineDistanceMeters(pt[0], pt[1], nextPt[0], nextPt[1]);
                    const distFeet = distMeters * 3.28084;

                    return (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-1 px-2 font-bold text-amber-400">Point {idx + 1}</td>
                        <td className="py-1 px-2 text-slate-200">{pt[0].toFixed(6)}</td>
                        <td className="py-1 px-2 text-slate-200">{pt[1].toFixed(6)}</td>
                        <td className="py-1 px-2 text-slate-400">
                          {distMeters.toFixed(1)} m ({distFeet.toFixed(0)} ft)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function cleanVal(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') return v.name || v.locality || v.city || '';
  return String(v).trim();
}
