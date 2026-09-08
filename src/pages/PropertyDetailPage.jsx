import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Heart,
  MapPin,
  CheckCircle2,
  Video,
  Plane,
  Lock,
  ChevronLeft,
  Send,
  ChevronRight,
  Eye,
  Share2,
  Info,
  Maximize2,
  Building2,
  Calendar,
  Sparkles
} from 'lucide-react';
import { getPublicPropertyById } from '../firebase/propertyService.js';
import { loadGoogleMapsScript } from '../services/locationProvider.js';
import { getApplicableSpecificationFields, CANONICAL_AMENITIES } from '../firebase/specificationsConfig.js';
import { createEnquiry } from '../firebase/enquiryService.js';
import { isPropertyWishlisted, addWishlistProperty, removeWishlistProperty } from '../firebase/wishlistService.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function PropertyDetailPage({ propertyId: propIdFromProps, onNavigateHome, onNavigateMap }) {
  // Extract propertyId from props or window URL (/property/:propertyId)
  const getPropertyIdFromUrl = () => {
    if (propIdFromProps) return propIdFromProps;
    const path = window.location.pathname;
    const match = path.match(/\/property\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const propertyId = getPropertyIdFromUrl();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [property, setProperty] = useState(null);

  // Gallery state
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Wishlist state
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // Enquiry Form State
  const [enquiryForm, setEnquiryForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [enquirySubmitting, setEnquirySubmitting] = useState(false);
  const [enquirySubmitted, setEnquirySubmitted] = useState(false);
  const [enquiryError, setEnquiryError] = useState(null);

  // Google Maps & Nearby State
  const mapContainerRef = useRef(null);
  const googleMapRef = useRef(null);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  // 1. Fetch Public Property Data
  useEffect(() => {
    let isMounted = true;
    if (!propertyId) {
      setErrorMsg('No property ID provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    getPublicPropertyById(propertyId)
      .then(res => {
        if (!isMounted) return;
        if (res.success && res.property) {
          setProperty(res.property);
          // Set dynamic SEO page title
          document.title = `${res.property.title} | EaseLand Direct Marketplace`;

          // Default enquiry message
          setEnquiryForm(prev => ({
            ...prev,
            name: user?.displayName || '',
            email: user?.email || '',
            message: `Hello, I am interested in your property "${res.property.title}" (Ref: ${res.property.referenceId}). Please get in touch with me for further details.`
          }));

          // Check wishlist status
          if (user?.uid) {
            isPropertyWishlisted(user.uid, res.property.propertyId).then(isSaved => {
              if (isMounted) setWishlisted(isSaved);
            });
          }
        } else {
          setErrorMsg(res.error || 'Property unavailable.');
        }
      })
      .catch(err => {
        if (isMounted) setErrorMsg('Failed to load property details.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [propertyId, user]);

  // 2. Initialize Native Google Maps JS SDK
  useEffect(() => {
    if (!property || !mapContainerRef.current) return;

    const lat = property.location?.geoPoint?.latitude || property.location?.lat || property.location?.latitude;
    const lng = property.location?.geoPoint?.longitude || property.location?.lng || property.location?.longitude;

    if (!lat || !lng) return;

    loadGoogleMapsScript()
      .then((gMaps) => {
        const mapPos = { lat: Number(lat), lng: Number(lng) };

        // Create native Google Map
        const map = new gMaps.Map(mapContainerRef.current, {
          center: mapPos,
          zoom: 16,
          mapTypeId: 'roadmap',
          fullscreenControl: true,
          streetViewControl: false,
          zoomControl: true
        });

        googleMapRef.current = map;

        // Add Property Location Marker
        new gMaps.Marker({
          position: mapPos,
          map: map,
          title: property.title,
          icon: {
            path: gMaps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#F4C542',
            fillOpacity: 1,
            strokeColor: '#171A1C',
            strokeWeight: 3
          }
        });

        // Add Approved Boundary Polygon (ONLY if boundaryStatus is APPROVED and polygon exists)
        if (
          property.boundary &&
          property.boundary.boundaryStatus === 'APPROVED' &&
          Array.isArray(property.boundary.approvedPolygon) &&
          property.boundary.approvedPolygon.length >= 3
        ) {
          const polyCoords = property.boundary.approvedPolygon.map(v => ({
            lat: Number(v.lat || v.latitude),
            lng: Number(v.lng || v.longitude)
          }));

          const polygon = new gMaps.Polygon({
            paths: polyCoords,
            strokeColor: '#10B981',
            strokeOpacity: 0.9,
            strokeWeight: 3,
            fillColor: '#10B981',
            fillOpacity: 0.25,
            map: map
          });

          // Fit bounds to polygon
          const bounds = new gMaps.LatLngBounds();
          polyCoords.forEach(c => bounds.extend(c));
          map.fitBounds(bounds);
        }

        // Fetch Google Places Nearby Infrastructure
        if (gMaps.places) {
          setNearbyLoading(true);
          const service = new gMaps.places.PlacesService(map);
          const pyLocation = new gMaps.LatLng(mapPos.lat, mapPos.lng);

          service.nearbySearch(
            {
              location: pyLocation,
              radius: 3500,
              type: ['hospital', 'school', 'transit_station', 'shopping_mall', 'bank']
            },
            (results, status) => {
              setNearbyLoading(false);
              if (status === gMaps.places.PlacesServiceStatus.OK && results) {
                const mapped = results.slice(0, 6).map(place => {
                  const placeLoc = place.geometry.location;
                  const distMeters = gMaps.geometry
                    ? gMaps.geometry.spherical.computeDistanceBetween(pyLocation, placeLoc)
                    : 0;
                  const distStr = distMeters < 1000 ? `${Math.round(distMeters)} m` : `${(distMeters / 1000).toFixed(1)} km`;
                  return {
                    name: place.name,
                    distance: distStr,
                    type: place.types?.[0]?.replace('_', ' ') || 'place',
                    rating: place.rating || null
                  };
                });
                setNearbyPlaces(mapped);
              }
            }
          );
        }
      })
      .catch(err => {
        console.warn('Google Maps JS SDK load error on detail page:', err);
      });
  }, [property]);

  // Wishlist handler with immediate double-click protection
  const handleWishlistToggle = async () => {
    if (wishlistLoading) return;
    if (!user) {
      alert('Please log in to save properties to your wishlist.');
      return;
    }
    setWishlistLoading(true);
    try {
      if (wishlisted) {
        const res = await removeWishlistProperty(user.uid, property.propertyId);
        if (res.success) setWishlisted(false);
      } else {
        const res = await addWishlistProperty(user.uid, property.propertyId);
        if (res.success) setWishlisted(true);
      }
    } finally {
      setWishlistLoading(false);
    }
  };

  // Enquiry submission handler with immediate double-click protection
  const handleEnquirySubmit = async (e) => {
    e.preventDefault();
    if (enquirySubmitting) return;

    setEnquiryError(null);

    if (!user || !user.uid) {
      setEnquiryError('Please log in to submit a property enquiry.');
      return;
    }

    if (!enquiryForm.name.trim() || !enquiryForm.phone.trim()) {
      setEnquiryError('Name and phone number are required.');
      return;
    }

    setEnquirySubmitting(true);

    try {
      const payload = {
        propertyId: property.propertyId,
        propertyTitle: property.title,
        propertyReferenceId: property.referenceId,
        customerId: user.uid,
        buyerId: user.uid,
        customerName: enquiryForm.name.trim(),
        customerPhone: enquiryForm.phone.trim(),
        customerEmail: enquiryForm.email.trim(),
        message: enquiryForm.message.trim()
      };

      const res = await createEnquiry(payload);
      if (res.success) {
        setEnquirySubmitted(true);
      } else {
        setEnquiryError(res.error || 'Failed to submit enquiry. Please try again.');
      }
    } finally {
      setEnquirySubmitting(false);
    }
  };


  // 3. Loading State Skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-offwhite py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 animate-pulse">
        <div className="h-6 w-64 bg-gray-200 rounded-md"></div>
        <div className="h-10 w-3/4 bg-gray-200 rounded-lg"></div>
        <div className="h-[450px] w-full bg-gray-200 rounded-2xl"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-40 bg-gray-200 rounded-2xl"></div>
            <div className="h-40 bg-gray-200 rounded-2xl"></div>
          </div>
          <div className="h-80 bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // 4. Property Unavailable / Error 404 / Connection Error States
  if (errorMsg || !property) {
    const isConnErr = errorMsg && (errorMsg.includes('Connection Error') || errorMsg.includes('database servers'));
    const isNotFound = errorMsg && (errorMsg.includes('does not exist') || errorMsg.includes('No property ID'));

    return (
      <div className="min-h-screen bg-brand-offwhite flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-brand-bordergray shadow-xl max-w-lg w-full text-center space-y-5">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${
            isConnErr ? 'bg-red-50 border border-red-200 text-red-600' :
            isNotFound ? 'bg-gray-100 border border-gray-300 text-gray-700' :
            'bg-amber-50 border border-amber-200 text-amber-600'
          }`}>
            <Info className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-extrabold text-brand-charcoal">
            {isConnErr ? 'Connection Error' :
             isNotFound ? 'Property Not Found (404)' :
             'This Property Is No Longer Available'}
          </h2>

          <p className="text-sm text-gray-500 font-medium leading-relaxed">
            {isConnErr ? 'Unable to reach EaseLand database servers. Please check your network connection and retry.' :
             isNotFound ? 'The requested property reference does not exist on our direct marketplace.' :
             'This property is no longer active on the public marketplace or may have been archived by the owner.'}
          </p>

          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            {isConnErr && (
              <button
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto bg-brand-charcoal hover:bg-brand-charcoalLight text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow-md transition-all"
              >
                Retry Connection
              </button>
            )}
            <button
              onClick={() => {
                if (onNavigateMap) onNavigateMap();
                else window.location.href = '/';
              }}
              className="w-full sm:w-auto bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-6 py-3 rounded-xl shadow-md transition-all"
            >
              Explore Live Properties on Map
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Media items (strictly APPROVED public media returned by service)
  const mediaList = Array.isArray(property.media) && property.media.length > 0 ? property.media : [];
  const activeMedia = mediaList[activeMediaIndex] || null;

  // Applicable specs
  const specFlags = getApplicableSpecificationFields(property.propertyType, property.purpose);

  // Address hierarchy for breadcrumb
  const loc = property.location || {};
  const breadcrumbParts = [
    { label: 'Home', action: () => (onNavigateHome ? onNavigateHome() : (window.location.href = '/')) },
    { label: 'Properties', action: () => (onNavigateMap ? onNavigateMap() : (window.location.href = '/')) },
    loc.state && { label: loc.state },
    (loc.city || loc.district) && { label: loc.city || loc.district },
    loc.locality && { label: loc.locality }
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-brand-offwhite pb-24">
      
      {/* TOP NAVIGATION BAR */}
      <div className="bg-brand-charcoal text-white py-3.5 px-4 sm:px-6 lg:px-8 border-b border-white/10 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              if (onNavigateMap) onNavigateMap();
              else window.history.back();
            }}
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-300 hover:text-brand-yellow transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Marketplace Search</span>
          </button>

          {/* VERIFIED BY EASELAND BADGE */}
          {property.isPlatformVerified && (
            <div className="flex items-center gap-2 bg-slate-950/90 backdrop-blur-md border border-amber-400/50 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-[0_2px_10px_rgba(212,175,55,0.2)]">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span className="bg-metallic-gold bg-clip-text text-transparent">
                Platform Verified
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* BREADCRUMB */}
        <nav className="flex items-center gap-2 text-xs text-gray-400 font-semibold mb-4 overflow-x-auto pb-1">
          {breadcrumbParts.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-300" />}
              {item.action ? (
                <button onClick={item.action} className="hover:text-brand-charcoal transition-colors shrink-0">
                  {item.label}
                </button>
              ) : (
                <span className={idx === breadcrumbParts.length - 1 ? 'text-brand-charcoal font-bold shrink-0' : 'shrink-0'}>
                  {item.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* PROPERTY HEADER & PRICE BAR */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <span className="bg-brand-charcoal text-brand-yellow px-2.5 py-0.5 rounded font-extrabold">
                {property.propertyType?.replace('_', ' ')}
              </span>
              <span>•</span>
              <span className="text-emerald-700 font-extrabold">
                {property.purpose === 'RENT' || property.purpose === 'LEASE' ? 'For Rent' : 'For Sale'}
              </span>
              <span>•</span>
              <span className="text-gray-600">Ref: {property.referenceId}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-brand-charcoal tracking-tight">
              {property.title}
            </h1>

            <p className="text-xs sm:text-sm font-semibold text-gray-500 mt-1.5 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-brand-yellow shrink-0" />
              <span>
                {[loc.locality, loc.city, loc.district, loc.state].filter(Boolean).join(', ') || loc.address}
              </span>
            </p>
          </div>

          {/* PRICE & WISHLIST BAR */}
          <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-brand-bordergray shadow-sm shrink-0">
            <div>
              <span className="text-[11px] text-gray-400 font-bold block uppercase tracking-wider">Listed Price</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                {property.priceDisplay}
              </span>
            </div>

            <button
              onClick={handleWishlistToggle}
              disabled={wishlistLoading}
              className={`p-3 rounded-xl border shadow-sm transition-all ${
                wishlisted
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
              title="Save to Wishlist"
            >
              <Heart className={`w-5 h-5 ${wishlisted ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* MEDIA GALLERY */}
        <div className="bg-white rounded-2xl p-4 border border-brand-bordergray shadow-sm mb-8 space-y-3">
          
          {/* MAIN MEDIA CANVAS */}
          <div className="relative w-full h-[360px] sm:h-[480px] bg-brand-charcoal rounded-xl overflow-hidden flex items-center justify-center">
            {activeMedia ? (
              activeMedia.mediaType === 'WALKTHROUGH_VIDEO' || activeMedia.mediaType === 'DRONE_VIDEO' ? (
                <video
                  src={activeMedia.url}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={activeMedia.url}
                  alt={activeMedia.caption || property.title}
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="text-center text-gray-400 space-y-2 p-8">
                <Building2 className="w-12 h-12 mx-auto stroke-1" />
                <p className="text-xs font-bold">No public photos available for this listing.</p>
              </div>
            )}

            {/* MEDIA COUNTER BADGE */}
            {mediaList.length > 0 && (
              <div className="absolute bottom-4 right-4 bg-brand-charcoal/85 backdrop-blur-md text-white text-xs font-extrabold px-3 py-1 rounded-lg border border-white/10 shadow">
                {activeMediaIndex + 1} / {mediaList.length}
              </div>
            )}

            {/* MEDIA TYPE LABEL */}
            {activeMedia && (
              <div className="absolute top-4 left-4 bg-brand-charcoal/85 backdrop-blur-md text-brand-yellow text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-lg flex items-center gap-1.5 shadow border border-white/10">
                {activeMedia.mediaType === 'DRONE_VIDEO' && <Plane className="w-3.5 h-3.5 text-brand-yellow" />}
                {activeMedia.mediaType === 'WALKTHROUGH_VIDEO' && <Video className="w-3.5 h-3.5 text-brand-yellow" />}
                <span>
                  {activeMedia.mediaType === 'DRONE_VIDEO'
                    ? 'Drone View'
                    : activeMedia.mediaType === 'WALKTHROUGH_VIDEO'
                    ? 'Property Walkthrough'
                    : 'Property Photo'}
                </span>
              </div>
            )}
          </div>

          {/* THUMBNAIL LIST */}
          {mediaList.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {mediaList.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveMediaIndex(idx)}
                  className={`relative w-24 h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                    activeMediaIndex === idx
                      ? 'border-brand-yellow ring-2 ring-brand-yellow/40'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  {item.mediaType === 'WALKTHROUGH_VIDEO' || item.mediaType === 'DRONE_VIDEO' ? (
                    <div className="w-full h-full bg-brand-charcoal text-white flex flex-col items-center justify-center gap-1">
                      {item.mediaType === 'DRONE_VIDEO' ? <Plane className="w-5 h-5 text-brand-yellow" /> : <Video className="w-5 h-5 text-brand-yellow" />}
                      <span className="text-[9px] font-extrabold uppercase">
                        {item.mediaType === 'DRONE_VIDEO' ? 'Drone' : 'Video'}
                      </span>
                    </div>
                  ) : (
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TWO COLUMN GRID CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT 2 COLUMNS: VERIFIED INFO, SPECS, AMENITIES, NEARBY, DESCRIPTION */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* EASELAND PLATFORM VERIFICATION NOTICE CARD */}
            {property.isPlatformVerified && (
              <div className="bg-slate-900 border border-amber-400/40 rounded-2xl p-5 text-slate-100 flex items-start gap-4 shadow-lg">
                <ShieldCheck className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wide bg-metallic-gold bg-clip-text text-transparent">
                    Platform Verified Listing
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed font-medium">
                    This property listing has been reviewed and verified by the EaseLand platform audit team. Verification indicates platform review and location confirmation. It does not constitute a legal title warranty or government approval.
                  </p>
                </div>
              </div>
            )}

            {/* KEY OVERVIEW & SPECIFICATIONS */}
            <div className="bg-white rounded-2xl p-6 border border-brand-bordergray shadow-sm">
              <h3 className="text-lg font-extrabold text-brand-charcoal mb-4">Property Specifications</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">Property Type</span>
                  <span className="text-sm font-extrabold text-brand-charcoal mt-0.5 block">{property.propertyType?.replace('_', ' ')}</span>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">Authoritative Area</span>
                  <span className="text-sm font-extrabold text-brand-charcoal mt-0.5 block">{property.areaDisplay || `${property.area} sq ft`}</span>
                </div>

                {property.specs?.facing && (
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">Facing Direction</span>
                    <span className="text-sm font-extrabold text-brand-charcoal mt-0.5 block">{property.specs.facing}</span>
                  </div>
                )}

                {specFlags.showApproachRoadWidth && property.specs?.approachRoadWidth && (
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">Approach Road Width</span>
                    <span className="text-sm font-extrabold text-brand-charcoal mt-0.5 block">{property.specs.approachRoadWidth}</span>
                  </div>
                )}

                {specFlags.showBedroomsBathrooms && property.specs?.bedrooms && (
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">Bedrooms</span>
                    <span className="text-sm font-extrabold text-brand-charcoal mt-0.5 block">{property.specs.bedrooms} BHK</span>
                  </div>
                )}

                {specFlags.showBedroomsBathrooms && property.specs?.bathrooms && (
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">Bathrooms</span>
                    <span className="text-sm font-extrabold text-brand-charcoal mt-0.5 block">{property.specs.bathrooms} Baths</span>
                  </div>
                )}

                {specFlags.showFurnishing && property.specs?.furnishing && (
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">Furnishing</span>
                    <span className="text-sm font-extrabold text-brand-charcoal mt-0.5 block">{property.specs.furnishing}</span>
                  </div>
                )}

                {specFlags.showParkingType && property.specs?.parking && (
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">Parking</span>
                    <span className="text-sm font-extrabold text-brand-charcoal mt-0.5 block">{property.specs.parking}</span>
                  </div>
                )}

                {specFlags.showPropertyAge && property.specs?.propertyAge && (
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">Property Age</span>
                    <span className="text-sm font-extrabold text-brand-charcoal mt-0.5 block">{property.specs.propertyAge}</span>
                  </div>
                )}
              </div>
            </div>

            {/* CANONICAL AMENITIES */}
            {Array.isArray(property.amenities) && property.amenities.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-brand-bordergray shadow-sm">
                <h3 className="text-lg font-extrabold text-brand-charcoal mb-4">Amenities & Features</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {property.amenities.map((amenityItem, idx) => {
                    const matched = CANONICAL_AMENITIES.find(c => c.id === amenityItem || c.label === amenityItem);
                    const displayLabel = matched ? matched.label : amenityItem;
                    return (
                      <div key={idx} className="flex items-center gap-2.5 text-xs font-bold text-gray-800 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{displayLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DESCRIPTION */}
            {property.description && (
              <div className="bg-white rounded-2xl p-6 border border-brand-bordergray shadow-sm">
                <h3 className="text-lg font-extrabold text-brand-charcoal mb-3">Property Description</h3>
                <p className={`text-sm text-gray-700 font-medium leading-relaxed whitespace-pre-line ${!descriptionExpanded ? 'line-clamp-4' : ''}`}>
                  {property.description}
                </p>
                {property.description.length > 220 && (
                  <button
                    onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                    className="mt-3 text-xs font-extrabold text-brand-charcoal hover:text-brand-yellowHover underline"
                  >
                    {descriptionExpanded ? 'Show Less' : 'Read Full Description'}
                  </button>
                )}
              </div>
            )}

            {/* GOOGLE MAP & APPROVED BOUNDARY */}
            <div className="bg-white rounded-2xl p-6 border border-brand-bordergray shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-brand-charcoal">Location & Map</h3>
                  <p className="text-xs text-gray-500 font-semibold mt-0.5">
                    Interactive map powered by Google Maps JS SDK.
                  </p>
                </div>
                {property.boundary && (
                  <span className="text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-200">
                    Approved Property Boundary
                  </span>
                )}
              </div>

              {/* MAP CANVAS */}
              <div
                ref={mapContainerRef}
                className="w-full h-80 sm:h-96 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden"
              ></div>

              <div className="text-[11px] text-gray-400 font-semibold">
                📍 Pin indicates property location. {property.boundary ? 'Green polygon represents platform-approved property boundary.' : 'Property boundary is not displayed.'}
              </div>
            </div>

            {/* WHAT'S NEARBY INFRASTRUCTURE */}
            <div className="bg-white rounded-2xl p-6 border border-brand-bordergray shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-brand-charcoal">What's Nearby</h3>
                <span className="text-[10px] font-extrabold uppercase bg-brand-charcoal text-brand-yellow px-2.5 py-1 rounded">
                  Google Places API
                </span>
              </div>

              {nearbyLoading ? (
                <div className="text-xs text-gray-400 font-bold py-4 animate-pulse">Calculating nearby hospitals, schools, and transit...</div>
              ) : nearbyPlaces.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {nearbyPlaces.map((place, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                      <div>
                        <span className="font-bold text-gray-800 block line-clamp-1">{place.name}</span>
                        <span className="text-[10px] text-gray-400 capitalize font-semibold">{place.type}</span>
                      </div>
                      <span className="font-extrabold text-brand-charcoal bg-white px-2.5 py-1 rounded-md border border-gray-200 shrink-0">
                        {place.distance}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 font-medium">
                  Nearby infrastructure data is available around property location coordinates via Google Maps.
                </p>
              )}
            </div>

            {/* CONFIDENTIAL DOCUMENTS PRIVACY NOTICE */}
            <div className="bg-brand-charcoal text-white rounded-2xl p-6 border border-white/10 shadow-md">
              <div className="flex items-center gap-3 mb-2">
                <Lock className="w-5 h-5 text-brand-yellow shrink-0" />
                <h4 className="text-base font-extrabold text-white">Confidential Property Document Policy</h4>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                All property ownership title deeds, tax payment records, encumbrance certificates, and uploaded layout documents remain strictly confidential between the Property Owner and EaseLand Admin staff to protect privacy. Customers interact with verified boundary representations and audit badges only.
              </p>
            </div>

          </div>

          {/* RIGHT COLUMN: DIRECT OWNER ENQUIRY CTA FORM */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-brand-bordergray shadow-lg sticky top-20 space-y-5">
              
              {/* OWNER SUMMARY */}
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-brand-yellow text-brand-charcoal font-black text-lg flex items-center justify-center shadow-sm">
                  {property.ownerPublicName?.charAt(0) || 'O'}
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    Direct Property Owner
                  </span>
                  <h4 className="text-base font-extrabold text-brand-charcoal mt-0.5">{property.ownerPublicName}</h4>
                  <span className="text-xs text-gray-400 font-semibold">Zero Broker Marketplace</span>
                </div>
              </div>

              {/* ENQUIRY FORM */}
              {enquirySubmitted ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center text-emerald-900 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h4 className="text-base font-extrabold">Enquiry Submitted!</h4>
                  <p className="text-xs text-emerald-800 font-semibold leading-relaxed">
                    Your interest has been delivered directly to {property.ownerPublicName}. The owner will contact you shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleEnquirySubmit} className="space-y-4">
                  <h4 className="text-sm font-extrabold text-brand-charcoal">
                    Interested in this Property? Contact Owner
                  </h4>

                  {enquiryError && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl font-bold">
                      {enquiryError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Suresh Kumar"
                      value={enquiryForm.name}
                      onChange={(e) => setEnquiryForm({ ...enquiryForm, name: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={enquiryForm.phone}
                      onChange={(e) => setEnquiryForm({ ...enquiryForm, phone: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="suresh@example.com"
                      value={enquiryForm.email}
                      onChange={(e) => setEnquiryForm({ ...enquiryForm, email: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Message to Owner</label>
                    <textarea
                      rows={3}
                      value={enquiryForm.message}
                      onChange={(e) => setEnquiryForm({ ...enquiryForm, message: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none resize-none"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={enquirySubmitting}
                    className="w-full bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-sm py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    {enquirySubmitting ? 'Sending Enquiry...' : 'Send Direct Enquiry'}
                  </button>

                  <p className="text-[10px] text-gray-400 text-center font-medium">
                    No agents or brokers. Your inquiry is delivered directly to the property owner.
                  </p>
                </form>
              )}

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
