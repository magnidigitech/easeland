import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ShieldCheck, MapPin, Navigation, Upload, Trash2, Plus, CheckCircle2, AlertCircle, RefreshCw, Layers, Compass, Play, Pause, Square, FileText, Undo, Maximize2, Map as MapIcon } from 'lucide-react';
import { BoundarySource, BoundaryStatus } from '../firebase/schema.js';
import { validateBoundaryPolygon, calculateApproximatePolygonAreaSqFt } from '../firebase/boundaryService.js';

// Fix Leaflet default icon URLs in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function PropertyBoundaryStep({ propertyLocation, boundaryData, onSaveBoundary, onSkipBoundary }) {
  const [method, setMethod] = useState('DRAW'); // 'DRAW', 'GPS', 'MAP_DOC'
  const [vertices, setVertices] = useState(boundaryData?.vertices || []);
  const [source, setSource] = useState(boundaryData?.source || BoundarySource.DRAWN_ON_MAP);
  const [docRefName, setDocRefName] = useState(boundaryData?.confidentialDocRef?.name || '');
  const [mapType, setMapType] = useState('satellite'); // 'satellite', 'street'

  // Map Leaflet Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const markersLayerGroupRef = useRef(null);

  // GPS Session State
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsPaused, setGpsPaused] = useState(false);
  const [gpsLog, setGpsLog] = useState([]);
  const watchIdRef = useRef(null);

  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Initial Center Coordinates derived from propertyLocation
  const centerLat = Number(propertyLocation?.geoPoint?.latitude || propertyLocation?.lat || propertyLocation?.latitude || 17.3850);
  const centerLng = Number(propertyLocation?.geoPoint?.longitude || propertyLocation?.lng || propertyLocation?.longitude || 78.4867);

  // Compute map-estimated area (approximate)
  const estimatedAreaSqFt = calculateApproximatePolygonAreaSqFt(vertices);

  // Initialize Leaflet Interactive Boundary Map Canvas
  useEffect(() => {
    if (method !== 'DRAW' || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 17,
        zoomControl: true
      });

      // Default Tile Layer: Google Satellite Hybrid
      const satelliteUrl = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      const tileLayer = L.tileLayer(satelliteUrl, {
        subdomains: '0123',
        maxZoom: 22,
        maxNativeZoom: 20,
        attribution: 'Google Maps Satellite'
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      markersLayerGroupRef.current = L.layerGroup().addTo(map);

      // Interactive Click Event to Drop Boundary Polygon Vertices
      map.on('click', (e) => {
        const newPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
        setVertices(prev => [...prev, newPoint]);
      });

      mapInstanceRef.current = map;
    }

    // Invalidate map size to render cleanly
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      if (mapInstanceRef.current && method !== 'DRAW') {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [method, centerLat, centerLng]);

  // Update Tile Layer when mapType changes (Satellite vs Street)
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    const tileUrl = mapType === 'satellite'
      ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
      : 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

    const newLayer = L.tileLayer(tileUrl, {
      subdomains: '0123',
      maxZoom: 22,
      maxNativeZoom: 20,
      attribution: mapType === 'satellite' ? 'Google Satellite' : 'Google Streets'
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [mapType]);

  // Render Polygon Lines and Marker Pins whenever vertices array updates
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear existing markers and polygon
    if (markersLayerGroupRef.current) {
      markersLayerGroupRef.current.clearLayers();
    }
    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
      polygonLayerRef.current = null;
    }

    if (vertices.length === 0) return;

    const latLngPoints = vertices.map(v => [v.lat, v.lng]);

    // Draw vertex numbered markers
    vertices.forEach((v, idx) => {
      const customDivIcon = L.divIcon({
        className: 'custom-boundary-pin',
        html: `<div style="background-color: #F59E0B; color: #1E293B; border: 2px solid #FFFFFF; font-weight: 900; font-size: 11px; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">${idx + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      L.marker([v.lat, v.lng], { icon: customDivIcon }).addTo(markersLayerGroupRef.current);
    });

    // Draw polygon line / area
    if (latLngPoints.length >= 2) {
      const polygon = L.polygon(latLngPoints, {
        color: '#F59E0B',
        fillColor: '#F59E0B',
        fillOpacity: 0.35,
        weight: 3,
        dashArray: latLngPoints.length < 3 ? '6, 6' : undefined
      }).addTo(map);

      polygonLayerRef.current = polygon;
    }
  }, [vertices]);

  // Add vertex manually (e.g. Map click or coordinate input)
  const handleAddVertex = (latVal, lngVal) => {
    setErrorMsg(null);
    const nLat = parseFloat(latVal);
    const nLng = parseFloat(lngVal);
    if (isNaN(nLat) || isNaN(nLng)) {
      setErrorMsg('Please enter valid numeric latitude and longitude coordinates.');
      return;
    }
    const newPoint = { lat: nLat, lng: nLng };
    setVertices(prev => [...prev, newPoint]);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo([nLat, nLng]);
    }
  };

  const handleUndoVertex = () => {
    setVertices(prev => prev.slice(0, -1));
  };

  const handleRemoveVertex = (index) => {
    setVertices(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearPolygon = () => {
    setVertices([]);
    setGpsLog([]);
    setErrorMsg(null);
  };

  const handleRecenterMap = () => {
    if (mapInstanceRef.current) {
      if (vertices.length >= 2) {
        const bounds = L.latLngBounds(vertices.map(v => [v.lat, v.lng]));
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
      } else {
        mapInstanceRef.current.setView([centerLat, centerLng], 17);
      }
    }
  };

  // GPS-Assisted Session Handlers
  const startGpsSession = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    setErrorMsg(null);
    setGpsActive(true);
    setGpsPaused(false);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newVertex = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsLog(prev => [...prev, newVertex]);
        setVertices(prev => [...prev, newVertex]);
      },
      (err) => {
        setErrorMsg(`GPS Capture Error: ${err.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  const pauseGpsSession = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsPaused(true);
  };

  const stopGpsSession = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsActive(false);
    setGpsPaused(false);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Save & Submit Boundary Submission
  const handleConfirmSubmission = () => {
    if (vertices.length > 0) {
      const validation = validateBoundaryPolygon(vertices);
      if (!validation.valid) {
        setErrorMsg(validation.error);
        return;
      }
    }

    const payload = {
      vertices,
      source: method === 'GPS' ? BoundarySource.GPS_ASSISTED : method === 'MAP_DOC' ? BoundarySource.UPLOADED_PLOT_MAP : BoundarySource.DRAWN_ON_MAP,
      confidentialDocRef: docRefName ? { name: docRefName, category: 'Plot Map' } : null,
      status: BoundaryStatus.PENDING_REVIEW,
      estimatedAreaSqFt
    };

    setSuccessMsg('Boundary submission saved for Admin review.');
    onSaveBoundary(payload);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="pb-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-brand-charcoal">
            Property Boundary Capture (Optional)
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Capture parcel vertices for land/plot boundaries using the interactive satellite map or GPS.
          </p>
        </div>

        <button
          type="button"
          onClick={onSkipBoundary}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors self-start sm:self-auto"
        >
          Skip Boundary for Now →
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* METHOD SELECTOR */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => { setMethod('DRAW'); setErrorMsg(null); }}
          className={`p-3 rounded-xl border text-xs font-bold transition-all ${
            method === 'DRAW'
              ? 'bg-brand-charcoal text-brand-yellow border-brand-charcoal shadow-sm'
              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
          }`}
        >
          A. Draw on Interactive Map
        </button>

        <button
          type="button"
          onClick={() => { setMethod('GPS'); setErrorMsg(null); }}
          className={`p-3 rounded-xl border text-xs font-bold transition-all ${
            method === 'GPS'
              ? 'bg-brand-charcoal text-brand-yellow border-brand-charcoal shadow-sm'
              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
          }`}
        >
          B. GPS-Assisted
        </button>

        <button
          type="button"
          onClick={() => { setMethod('MAP_DOC'); setErrorMsg(null); }}
          className={`p-3 rounded-xl border text-xs font-bold transition-all ${
            method === 'MAP_DOC'
              ? 'bg-brand-charcoal text-brand-yellow border-brand-charcoal shadow-sm'
              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
          }`}
        >
          C. Confidential Plot Map
        </button>
      </div>

      {/* METHOD A: INTERACTIVE MAP POLYGON DRAWER */}
      {method === 'DRAW' && (
        <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-200 space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-brand-yellow" />
                <span>Interactive Visual Map Drawer</span>
              </h4>
              <span className="text-[11px] text-gray-500 font-medium block mt-0.5">
                Click anywhere on the map tiles below to drop plot boundary points & draw land polygon.
              </span>
            </div>

            {/* MAP TILE LAYER SWITCHER */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm shrink-0">
              <button
                type="button"
                onClick={() => setMapType('satellite')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  mapType === 'satellite' ? 'bg-brand-charcoal text-brand-yellow' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Satellite
              </button>
              <button
                type="button"
                onClick={() => setMapType('street')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  mapType === 'street' ? 'bg-brand-charcoal text-brand-yellow' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Street Map
              </button>
            </div>
          </div>

          {/* INTERACTIVE LEAFLET MAP CANVAS */}
          <div className="relative rounded-2xl border-2 border-brand-charcoal/20 overflow-hidden shadow-lg">
            <div ref={mapContainerRef} className="h-96 w-full z-10 bg-slate-900" />

            {/* MAP FLOATING INSTRUCTION BADGE */}
            <div className="absolute top-3 left-3 z-20 bg-black/80 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 border border-white/10">
              <MapPin className="w-3.5 h-3.5 text-brand-yellow animate-bounce" />
              <span>Click on map to drop boundary points</span>
            </div>

            {/* MAP ACTION CONTROLS FLOATING BAR */}
            <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-md p-1.5 rounded-xl shadow-xl border border-gray-200">
              {vertices.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleUndoVertex}
                    title="Undo Last Point"
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg transition-colors"
                  >
                    <Undo className="w-3.5 h-3.5" />
                    <span>Undo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearPolygon}
                    title="Clear Polygon"
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleRecenterMap}
                title="Recenter Map Bounds"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-charcoal text-brand-yellow text-xs font-bold rounded-lg hover:bg-black transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Fit Bounds</span>
              </button>
            </div>
          </div>

          {/* POLYGON SUMMARY BAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-brand-charcoal">
                Polygon Status:
              </span>
              <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                vertices.length >= 3 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {vertices.length === 0 ? 'No Points Marked' : vertices.length < 3 ? `${vertices.length} / 3 Points (Min 3 required)` : `${vertices.length} Points Closed Polygon ✓`}
              </span>
            </div>

            {estimatedAreaSqFt > 0 && (
              <span className="text-xs font-extrabold text-emerald-700 font-mono">
                Map Area (approx): {estimatedAreaSqFt.toLocaleString()} sq ft
              </span>
            )}
          </div>

          {/* OPTIONAL MANUAL LAT/LNG COORDINATE INPUT ACCORDION */}
          <details className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
            <summary className="text-xs font-extrabold text-gray-700 cursor-pointer select-none flex items-center justify-between">
              <span>+ Advanced Option: Enter Lat / Lng Coordinates Manually</span>
            </summary>
            
            <div className="pt-2 flex items-center gap-2">
              <input
                type="number"
                step="any"
                id="vLatInput"
                placeholder="Latitude (e.g. 17.3850)"
                className="w-1/2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
              />
              <input
                type="number"
                step="any"
                id="vLngInput"
                placeholder="Longitude (e.g. 78.4867)"
                className="w-1/2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
              />
              <button
                type="button"
                onClick={() => {
                  const latEl = document.getElementById('vLatInput');
                  const lngEl = document.getElementById('vLngInput');
                  handleAddVertex(latEl.value, lngEl.value);
                  latEl.value = '';
                  lngEl.value = '';
                }}
                className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1 shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </details>

        </div>
      )}

      {/* METHOD B: GPS-ASSISTED CAPTURE */}
      {method === 'GPS' && (
        <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-200 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-medium space-y-1">
            <span className="font-extrabold block">GPS Accuracy Warning:</span>
            <span>GPS-assisted boundary is an approximate owner-provided boundary. Walk around your property boundary to log GPS vertices automatically.</span>
          </div>

          <div className="flex items-center gap-3">
            {!gpsActive ? (
              <button
                type="button"
                onClick={startGpsSession}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start GPS Boundary Session</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={gpsPaused ? startGpsSession : pauseGpsSession}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>{gpsPaused ? 'Resume Session' : 'Pause Session'}</span>
                </button>

                <button
                  type="button"
                  onClick={stopGpsSession}
                  className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop GPS Session</span>
                </button>
              </>
            )}
          </div>

          {gpsLog.length > 0 && (
            <div className="text-xs font-mono font-semibold text-gray-600">
              Captured GPS Vertices: {gpsLog.length} points
            </div>
          )}
        </div>
      )}

      {/* METHOD C: CONFIDENTIAL PLOT MAP REFERENCE */}
      {method === 'MAP_DOC' && (
        <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-200 space-y-3">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-700">
            Confidential Plot Map Document Reference
          </label>
          <input
            type="text"
            placeholder="e.g. Approved Layout Map / FMB Sketch Document Name"
            value={docRefName}
            onChange={(e) => setDocRefName(e.target.value)}
            className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
          />
          <span className="text-[11px] text-gray-500 block font-medium">
            Original plot map documents are confidential and accessible ONLY by Authorized EaseLand Admins.
          </span>
        </div>
      )}

      {/* CONFIRMATION BUTTON */}
      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
        <button
          type="button"
          onClick={onSkipBoundary}
          className="text-xs font-bold text-gray-500 hover:text-gray-700"
        >
          Skip for Now
        </button>

        <button
          type="button"
          onClick={handleConfirmSubmission}
          className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-6 py-3 rounded-xl shadow-md flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Save Boundary Submission</span>
        </button>
      </div>

    </div>
  );
}
