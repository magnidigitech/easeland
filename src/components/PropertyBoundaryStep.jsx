import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ShieldCheck, MapPin, Navigation, Upload, Trash2, Plus, CheckCircle2, AlertCircle, RefreshCw, Layers, Compass, Play, Pause, Square, FileText, Undo, Maximize2, Map as MapIcon, Edit3, PenTool, FileCode, Sparkles } from 'lucide-react';
import { BoundarySource, BoundaryStatus } from '../firebase/schema.js';
import { validateBoundaryPolygon, calculateApproximatePolygonAreaSqFt } from '../firebase/boundaryService.js';

// Fix Leaflet default icon URLs in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Perpendicular distance calculation for Ramer-Douglas-Peucker line simplification
function getSqSegDist(p, a, b) {
  let x = a.lng, y = a.lat, dx = b.lng - x, dy = b.lat - y;
  if (dx !== 0 || dy !== 0) {
    let t = ((p.lng - x) * dx + (p.lat - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b.lng;
      y = b.lat;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p.lng - x;
  dy = p.lat - y;
  return dx * dx + dy * dy;
}

function simplifyRDP(points, sqTolerance) {
  if (points.length <= 2) return points;
  let maxSqDist = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const sqDist = getSqSegDist(points[i], points[0], points[end]);
    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }
  if (maxSqDist > sqTolerance) {
    const rec1 = simplifyRDP(points.slice(0, index + 1), sqTolerance);
    const rec2 = simplifyRDP(points.slice(index), sqTolerance);
    return rec1.slice(0, rec1.length - 1).concat(rec2);
  }
  return [points[0], points[end]];
}

function simplifyPoints(points, tolerance = 0.000015) {
  if (points.length <= 3) return points;
  const sqTolerance = tolerance * tolerance;
  return simplifyRDP(points, sqTolerance);
}

export default function PropertyBoundaryStep({ propertyLocation, boundaryData, onSaveBoundary, onSkipBoundary }) {
  const [method, setMethod] = useState('DRAW'); // 'DRAW', 'GPS', 'MAP_DOC'
  const [drawMode, setDrawMode] = useState('click'); // 'click' (point-by-point) or 'freehand' (pencil trace for amoeba shapes)
  const [vertices, setVertices] = useState(boundaryData?.vertices || []);
  const [source, setSource] = useState(boundaryData?.source || BoundarySource.DRAWN_ON_MAP);
  const [docRefName, setDocRefName] = useState(boundaryData?.confidentialDocRef?.name || '');
  const [mapType, setMapType] = useState('satellite'); // 'satellite', 'street'

  // Freehand Pencil Trace Refs
  const isTracingRef = useRef(false);
  const tracePointsRef = useRef([]);
  const verticesRef = useRef(vertices);
  const lastTapTimeRef = useRef(0);
  const [pencilSubMode, setPencilSubMode] = useState('draw'); // 'draw' (Trace Line) or 'pan' (Pan & Position Map)
  const pencilSubModeRef = useRef(pencilSubMode);

  // Keep refs in sync with state
  useEffect(() => {
    verticesRef.current = vertices;
  }, [vertices]);

  useEffect(() => {
    pencilSubModeRef.current = pencilSubMode;
  }, [pencilSubMode]);

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
        zoomControl: false
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
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Remove previous listeners
    map.off('click');
    map.off('mousedown');
    map.off('mousemove');
    map.off('mouseup');

    if (drawMode === 'freehand') {
      if (pencilSubModeRef.current === 'pan') {
        map.dragging.enable();
        if (map.touchZoom) map.touchZoom.enable();
      } else {
        map.dragging.disable();
        if (map.touchZoom) map.touchZoom.disable();
      }

      const handleMouseDown = (e) => {
        // If in 'pan' mode, or multi-touch (2 fingers), or right click, DO NOT DRAW -> allow map pan!
        const isMultiTouch = e.originalEvent?.touches && e.originalEvent.touches.length > 1;
        const isRightClick = e.originalEvent?.button === 1 || e.originalEvent?.button === 2;
        const isPanMode = pencilSubModeRef.current === 'pan';

        if (isMultiTouch || isRightClick || isPanMode) {
          isTracingRef.current = false;
          map.dragging.enable();
          if (map.touchZoom) map.touchZoom.enable();
          return;
        }

        if (e.originalEvent && e.originalEvent.button !== undefined && e.originalEvent.button !== 0) return;
        if (e.originalEvent && e.originalEvent.stopPropagation) e.originalEvent.stopPropagation();

        isTracingRef.current = true;
        map.dragging.disable();

        const newPt = { lat: e.latlng.lat, lng: e.latlng.lng };
        // APPEND to existing vertices so zoom in/out or picking up finger NEVER clears previous points!
        const initial = [...verticesRef.current, newPt];
        tracePointsRef.current = initial;
        setVertices(initial);
      };

      const handleMouseMove = (e) => {
        if (!isTracingRef.current) return;
        if (pencilSubModeRef.current === 'pan') {
          isTracingRef.current = false;
          map.dragging.enable();
          return;
        }
        if (e.originalEvent && e.originalEvent.stopPropagation) {
          e.originalEvent.stopPropagation();
        }
        const pts = tracePointsRef.current;
        const last = pts[pts.length - 1];
        const dist = map.distance([last.lat, last.lng], [e.latlng.lat, e.latlng.lng]);
        if (dist > 2.0) { // Sample point every 2 meters for smooth curves
          const newPt = { lat: e.latlng.lat, lng: e.latlng.lng };
          pts.push(newPt);
          tracePointsRef.current = pts;
          setVertices([...pts]);
        }
      };

      const handleMouseUp = (e) => {
        if (isTracingRef.current) {
          if (e && e.originalEvent && e.originalEvent.stopPropagation) {
            e.originalEvent.stopPropagation();
          }
          isTracingRef.current = false;
          // Auto-smooth freehand trace into clean, draggable organic nodes upon release!
          if (tracePointsRef.current.length > 5) {
            const smoothed = simplifyPoints(tracePointsRef.current, 0.000015);
            setVertices(smoothed);
          }
        }
      };

      map.on('mousedown touchstart', handleMouseDown);
      map.on('mousemove touchmove', handleMouseMove);
      map.on('mouseup touchend', handleMouseUp);
    } else {
      map.dragging.enable();
      if (map.touchZoom) map.touchZoom.enable();

      map.on('click', (e) => {
        const newPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
        setVertices(prev => [...prev, newPoint]);
      });
    }

    // Invalidate map size to ensure tile rendering is 100% complete
    requestAnimationFrame(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
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
  }, [method, centerLat, centerLng, drawMode, pencilSubMode]);

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

  // Render Polygon Lines, Draggable Markers, and Mid-Point Splitter Handles whenever vertices array updates
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

    // Draw vertex interactive markers (Draggable pins with removal popups)
    vertices.forEach((v, idx) => {
      const customDivIcon = L.divIcon({
        className: 'custom-boundary-pin',
        html: `<div title="Drag to adjust vertex ${idx + 1}" style="background-color: #F59E0B; color: #1E293B; border: 2px solid #FFFFFF; font-weight: 900; font-size: 10px; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.4); cursor: move;">${idx + 1}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = L.marker([v.lat, v.lng], {
        icon: customDivIcon,
        draggable: true
      }).addTo(markersLayerGroupRef.current);

      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        setVertices(prev => {
          const next = [...prev];
          if (next[idx]) {
            next[idx] = { lat: newPos.lat, lng: newPos.lng };
          }
          return next;
        });
      });

      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; padding: 4px; text-align: center;">
          <div style="font-weight: 800; font-size: 11px; margin-bottom: 4px; color: #1E293B;">Node #${idx + 1}</div>
          <button id="del-node-${idx}" style="background: #EF4444; color: white; border: none; padding: 4px 10px; font-weight: 700; font-size: 10px; border-radius: 6px; cursor: pointer;">Remove Node</button>
        </div>
      `);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`del-node-${idx}`);
        if (btn) {
          btn.onclick = () => {
            setVertices(prev => prev.filter((_, i) => i !== idx));
          };
        }
      });
    });

    // Render Mid-point '+' splitters between consecutive vertices to insert new nodes easily
    if (vertices.length >= 2) {
      for (let i = 0; i < vertices.length; i++) {
        const current = vertices[i];
        const next = vertices[(i + 1) % vertices.length];
        
        // If drawing fewer than 3 points, don't close loop mid-point
        if (i === vertices.length - 1 && vertices.length < 3) break;

        const midLat = (current.lat + next.lat) / 2;
        const midLng = (current.lng + next.lng) / 2;

        const midIcon = L.divIcon({
          className: 'custom-midpoint-pin',
          html: `<div title="Click to add curve node here" style="background-color: #3B82F6; color: #FFFFFF; border: 1.5px solid #FFFFFF; font-weight: 900; font-size: 11px; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3); opacity: 0.85; cursor: pointer;">+</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        const midMarker = L.marker([midLat, midLng], { icon: midIcon }).addTo(markersLayerGroupRef.current);
        midMarker.on('click', () => {
          setVertices(prev => {
            const copy = [...prev];
            copy.splice(i + 1, 0, { lat: midLat, lng: midLng });
            return copy;
          });
        });
      }
    }

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

  // Handle Boundary File Import (GeoJSON, KML, GPX)
  const handleBoundaryFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        let parsedCoords = [];

        if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
          const json = JSON.parse(text);
          const feature = json.features?.[0] || json;
          const geom = feature.geometry || feature;
          let coords = geom.coordinates || [];
          if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
            coords = coords[0];
          }
          parsedCoords = coords.map(c => ({ lat: Number(c[1]), lng: Number(c[0]) })).filter(pt => !isNaN(pt.lat) && !isNaN(pt.lng));
        } else if (file.name.endsWith('.kml') || file.name.endsWith('.gpx') || file.name.endsWith('.xml')) {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'text/xml');
          const coordNodes = xmlDoc.getElementsByTagName('coordinates');
          if (coordNodes.length > 0) {
            const rawStr = coordNodes[0].textContent.trim();
            const pairs = rawStr.split(/\s+/);
            parsedCoords = pairs.map(p => {
              const parts = p.split(',');
              return { lat: parseFloat(parts[1]), lng: parseFloat(parts[0]) };
            }).filter(pt => !isNaN(pt.lat) && !isNaN(pt.lng));
          }
        }

        if (parsedCoords.length >= 3) {
          setVertices(parsedCoords);
          setSuccessMsg(`Successfully imported ${parsedCoords.length} boundary points from survey file "${file.name}".`);
          setTimeout(() => setSuccessMsg(null), 4000);
          if (mapInstanceRef.current) {
            const bounds = L.latLngBounds(parsedCoords.map(v => [v.lat, v.lng]));
            mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30] });
          }
        } else {
          setErrorMsg('Could not parse at least 3 valid polygon coordinates from file. Please ensure it is a valid GeoJSON or KML polygon file.');
        }
      } catch (err) {
        setErrorMsg('Error reading boundary file: ' + err.message);
      }
    };

    reader.readAsText(file);
  };

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

  const handlePresetAmoeba = () => {
    const numPoints = 8;
    const radiusLat = 0.00025; // ~28 meters
    const radiusLng = 0.00025 / Math.cos((centerLat * Math.PI) / 180);
    const newPoints = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i * 2 * Math.PI) / numPoints;
      // organic wavy shape ratio
      const organicFactor = 0.85 + Math.sin(i * 1.5) * 0.25;
      const lat = centerLat + Math.sin(angle) * radiusLat * organicFactor;
      const lng = centerLng + Math.cos(angle) * radiusLng * organicFactor;
      newPoints.push({ lat, lng });
    }
    setVertices(newPoints);
    if (mapInstanceRef.current) {
      const bounds = L.latLngBounds(newPoints.map(v => [v.lat, v.lng]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
    setSuccessMsg('Generated 8-node organic loop! Drag orange pins or click "+" handles to stretch out to your parcel.');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleSmoothCurve = () => {
    if (vertices.length <= 4) return;
    const smoothed = simplifyPoints(vertices, 0.00002);
    setVertices(smoothed);
    setSuccessMsg(`Smoothed curve down to ${smoothed.length} key nodes.`);
    setTimeout(() => setSuccessMsg(null), 3000);
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
            Capture parcel vertices for land/plot boundaries using the interactive satellite map, freehand pencil trace, or KML/GeoJSON survey files.
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

      {/* METHOD A: INTERACTIVE MAP POLYGON DRAWER */}
      <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-200 space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-brand-yellow" />
              <span>Draw & Capture Land Boundary</span>
            </h4>
            <span className="text-[11px] text-gray-500 font-medium block mt-0.5">
              Select your preferred drawing tool below for standard plots, amoeba-like irregular shapes, or survey files.
            </span>
          </div>

          {/* DRAWING TOOLKITS & TILE LAYER SWITCHER */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* DRAWING MODE TOGGLE */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
              <button
                type="button"
                onClick={() => setDrawMode('click')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                  drawMode === 'click' ? 'bg-brand-charcoal text-brand-yellow' : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Point-by-Point Polygon Mode"
              >
                <MapPin className="w-3 h-3" />
                <span>Points</span>
              </button>
              <button
                type="button"
                onClick={() => setDrawMode('freehand')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                  drawMode === 'freehand' ? 'bg-brand-charcoal text-brand-yellow' : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Freehand Pencil Mode for Amoeba / Irregular Shapes"
              >
                <Edit3 className="w-3 h-3" />
                <span>Amoeba Pencil</span>
              </button>
            </div>

            {/* PRESET AMOEBA RING GENERATOR */}
            <button
              type="button"
              onClick={handlePresetAmoeba}
              className="px-2.5 py-1.5 text-[11px] font-extrabold rounded-xl transition-all flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-sm shrink-0"
              title="Drop an editable 8-point organic loop around plot center"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Preset Amoeba Ring</span>
            </button>

            {/* GEOJSON / KML IMPORT BUTTON */}
            <label className="cursor-pointer px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors shadow-sm shrink-0">
              <Upload className="w-3.5 h-3.5 text-gray-600" />
              <span>Import KML / GeoJSON</span>
              <input
                type="file"
                accept=".kml,.geojson,.json,.gpx,.xml"
                onChange={handleBoundaryFileImport}
                className="hidden"
              />
            </label>

            {/* MAP TILE LAYER SWITCHER */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm shrink-0">
              <button
                type="button"
                onClick={() => setMapType('satellite')}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  mapType === 'satellite' ? 'bg-brand-charcoal text-brand-yellow' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Satellite
              </button>
              <button
                type="button"
                onClick={() => setMapType('street')}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  mapType === 'street' ? 'bg-brand-charcoal text-brand-yellow' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Street Map
              </button>
            </div>
          </div>
        </div>

        {/* INTERACTIVE LEAFLET MAP CANVAS CONTAINER */}
        <div className="rounded-2xl border-2 border-brand-charcoal overflow-hidden shadow-lg bg-slate-900">
          
          {/* MAP TOP INSTRUCTION HEADER */}
          <div className="bg-brand-charcoal text-white px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-bold border-b border-brand-yellow/30">
            <div className="flex items-center gap-2">
              {drawMode === 'freehand' ? (
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4 text-brand-yellow animate-pulse shrink-0" />
                    <span className="text-brand-yellow font-extrabold uppercase tracking-wide">Amoeba Pencil:</span>
                  </div>

                  {/* SUB-MODE TOGGLE: DRAW VS PAN MAP */}
                  <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-amber-400/30">
                    <button
                      type="button"
                      onClick={() => setPencilSubMode('draw')}
                      className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all flex items-center gap-1 ${
                        pencilSubMode === 'draw'
                          ? 'bg-brand-yellow text-brand-charcoal shadow-sm'
                          : 'text-gray-300 hover:text-white'
                      }`}
                      title="1 Finger / Drag to trace parcel boundary"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>✏️ Trace Line</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPencilSubMode('pan')}
                      className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all flex items-center gap-1 ${
                        pencilSubMode === 'pan'
                          ? 'bg-brand-yellow text-brand-charcoal shadow-sm'
                          : 'text-gray-300 hover:text-white'
                      }`}
                      title="Drag with finger/mouse to pan & position map freely"
                    >
                      <Compass className="w-3 h-3" />
                      <span>✋ Pan & Position Map</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <MapPin className="w-4 h-4 text-brand-yellow animate-bounce shrink-0" />
                  <span className="text-brand-yellow font-extrabold uppercase tracking-wide">Points Mode:</span>
                  <span className="text-gray-200 font-medium">Click map to drop pins, drag orange pins to reposition, or click '+' to split curves.</span>
                </>
              )}
            </div>

            {vertices.length > 0 && (
              <span className="text-[11px] font-mono font-extrabold text-amber-300 bg-black/50 px-3 py-1 rounded-full shrink-0 border border-amber-400/30">
                {vertices.length} {vertices.length === 1 ? 'Point' : 'Points'} Marked
              </span>
            )}
          </div>

          {/* MAP CANVAS */}
          <div className="relative">
            <div
              ref={mapContainerRef}
              className="h-96 w-full z-10 bg-slate-900"
            />

            {/* FLOATING MAP ZOOM IN / ZOOM OUT CONTROLS */}
            <div className="absolute top-3 left-3 z-20 flex flex-col bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => mapInstanceRef.current?.zoomIn()}
                className="w-8 h-8 flex items-center justify-center font-black text-gray-800 hover:bg-amber-100 text-base transition-colors"
                title="Zoom In Map"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => mapInstanceRef.current?.zoomOut()}
                className="w-8 h-8 flex items-center justify-center font-black text-gray-800 hover:bg-amber-100 text-base border-t border-gray-200 transition-colors"
                title="Zoom Out Map"
              >
                −
              </button>
            </div>

          {/* MAP ACTION CONTROLS FLOATING BAR */}
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-md p-1.5 rounded-xl shadow-xl border border-gray-200">
            {vertices.length > 4 && (
              <button
                type="button"
                onClick={handleSmoothCurve}
                title="Smooth out micro hand jitter into clean curve nodes"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors border border-indigo-200"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Smooth Jitter</span>
              </button>
            )}

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
