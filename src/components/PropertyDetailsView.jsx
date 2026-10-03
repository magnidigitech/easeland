import React, { useState, useEffect } from 'react';
import { ShieldCheck, Heart, MapPin, CheckCircle2, Video, Plane, Lock, ChevronLeft, Send, Sparkles, Phone, MessageCircle } from 'lucide-react';
import { mockApi } from '../services/mockApi';
import { getFirstUploadedImage, getCategoryFallbackImage, getPropertyMediaList, getVideoThumbnailUrl } from '../utils/categoryUtils.js';

export default function PropertyDetailsView({ property, onBack, isWishlisted, onWishlistToggle, activeRole, onViewOnMap }) {
  const mediaList = getPropertyMediaList(property);
  const [activeMedia, setActiveMedia] = useState(getFirstUploadedImage(property));
  const [activeMediaType, setActiveMediaType] = useState('image');
  const [googleNearbyPlaces, setGoogleNearbyPlaces] = useState([]);

  useEffect(() => {
    if (property) {
      setActiveMedia(getFirstUploadedImage(property));
    }
  }, [property]);

  // Direct Owner Enquiry Form State
  const [enquiryForm, setEnquiryForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: `Hello, I am interested in your property "${property?.title || 'Listing'}". Please get in touch for a site visit.`
  });

  const [enquirySubmitted, setEnquirySubmitted] = useState(false);

  if (!property) return null;

  const getEaselandWhatsAppUrl = () => {
    const phone = '916300691560';
    const msg = `Hi EaseLand Team, I am interested in property "${property?.title || 'Listing'}" (Ref: ${property?.referenceId || ''}) listed on EaseLand. Please assist me with property details and scheduling.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const formatPlaceCategory = (types, defaultLabel) => {
    if (defaultLabel) return defaultLabel;
    if (!Array.isArray(types)) return 'Landmark';
    if (types.some(t => t.includes('hospital') || t.includes('doctor') || t.includes('health') || t.includes('pharmacy'))) return 'Hospital & Health';
    if (types.some(t => t.includes('school') || t.includes('university') || t.includes('education') || t.includes('college'))) return 'School & Education';
    if (types.some(t => t.includes('transit') || t.includes('bus') || t.includes('train') || t.includes('subway'))) return 'Transit & Transport';
    if (types.some(t => t.includes('bank') || t.includes('atm') || t.includes('finance'))) return 'Bank & ATM';
    if (types.some(t => t.includes('shopping') || t.includes('store') || t.includes('supermarket') || t.includes('mall'))) return 'Shopping & Market';
    if (types.some(t => t.includes('park') || t.includes('gym') || t.includes('stadium'))) return 'Park & Recreation';
    return types[0]?.replace(/_/g, ' ') || 'Point of Interest';
  };

  const fetchRealNearbyPlacesFromGoogle = (gMaps, pyLocation, propObj) => {
    return new Promise((resolve) => {
      try {
        if (!gMaps || !gMaps.places) return resolve([]);
        const dummyElement = document.createElement('div');
        const service = new gMaps.places.PlacesService(dummyElement);

        const categoriesToSearch = [
          { type: 'hospital', label: 'Hospital & Health' },
          { type: 'school', label: 'School & College' },
          { type: 'bank', label: 'Bank & ATM' },
          { type: 'transit_station', label: 'Transit & Transport' },
          { type: 'supermarket', label: 'Shopping & Market' },
          { type: 'shopping_mall', label: 'Shopping & Market' },
          { type: 'point_of_interest', label: 'Landmark & Service' }
        ];

        const searchPromises = categoriesToSearch.map(cat => {
          return new Promise((resCat) => {
            service.nearbySearch(
              {
                location: pyLocation,
                radius: 8000,
                type: cat.type
              },
              (results, status) => {
                if (status === gMaps.places.PlacesServiceStatus.OK && Array.isArray(results)) {
                  resCat(results.map(r => ({ ...r, _categoryLabel: cat.label })));
                } else {
                  resCat([]);
                }
              }
            );
          });
        });

        Promise.all(searchPromises).then(allCategoryResults => {
          const flattened = allCategoryResults.flat().filter(p => p && p.name && p.geometry?.location);

          if (flattened.length === 0) {
            service.nearbySearch(
              {
                location: pyLocation,
                radius: 10000
              },
              (generalResults, generalStatus) => {
                if (generalStatus === gMaps.places.PlacesServiceStatus.OK && Array.isArray(generalResults)) {
                  const generalMapped = generalResults.slice(0, 6).map(place => {
                    const placeLoc = place.geometry.location;
                    const distMeters = (gMaps.geometry && gMaps.geometry.spherical)
                      ? gMaps.geometry.spherical.computeDistanceBetween(pyLocation, placeLoc)
                      : 0;
                    const distStr = distMeters > 0
                      ? (distMeters < 1000 ? `${Math.round(distMeters)} m` : `${(distMeters / 1000).toFixed(1)} km`)
                      : 'Nearby';
                    return {
                      name: place.name,
                      distance: distStr,
                      type: formatPlaceCategory(place.types, null),
                      rating: place.rating || null
                    };
                  });
                  return resolve(generalMapped);
                }
                resolve([]);
              }
            );
            return;
          }

          const processed = flattened.map(place => {
            const placeLoc = place.geometry.location;
            const distMeters = (gMaps.geometry && gMaps.geometry.spherical)
              ? gMaps.geometry.spherical.computeDistanceBetween(pyLocation, placeLoc)
              : 0;
            const distStr = distMeters > 0
              ? (distMeters < 1000 ? `${Math.round(distMeters)} m` : `${(distMeters / 1000).toFixed(1)} km`)
              : 'Nearby';
            return {
              name: place.name,
              distance: distStr,
              distMeters: distMeters,
              type: formatPlaceCategory(place.types, place._categoryLabel),
              rating: place.rating || null
            };
          }).sort((a, b) => a.distMeters - b.distMeters);

          const seenNames = new Set();
          const finalPlaces = [];
          for (const item of processed) {
            const key = item.name.toLowerCase().trim();
            if (!seenNames.has(key)) {
              seenNames.add(key);
              finalPlaces.push({
                name: item.name,
                distance: item.distance,
                type: item.type,
                rating: item.rating
              });
            }
            if (finalPlaces.length >= 6) break;
          }

          resolve(finalPlaces);
        }).catch(err => {
          console.warn('Google Places Promise.all error:', err);
          resolve([]);
        });
      } catch (e) {
        console.warn('Google Places fetch error:', e);
        resolve([]);
      }
    });
  };

  // Fetch real nearby places using Google Places Service automatically
  useEffect(() => {
    if (!property) return;
    if (window.google && window.google.maps && window.google.maps.places) {
      const lat = Number(property.location?.lat ?? property.lat ?? 16.3067);
      const lng = Number(property.location?.lng ?? property.lng ?? 80.4365);
      const pyLocation = new window.google.maps.LatLng(lat, lng);

      fetchRealNearbyPlacesFromGoogle(window.google.maps, pyLocation, property)
        .then(places => setGoogleNearbyPlaces(places))
        .catch(() => setGoogleNearbyPlaces([]));
    }
  }, [property]);

  const handleEnquirySubmit = (e) => {
    e.preventDefault();
    mockApi.createEnquiry({
      propertyId: property.id,
      propertyTitle: property.title,
      propertyPriceDisplay: property.priceDisplay,
      customerName: enquiryForm.name,
      customerEmail: enquiryForm.email,
      customerPhone: enquiryForm.phone,
      ownerId: property.owner?.id,
      ownerName: property.owner?.name,
      message: enquiryForm.message
    });
    setEnquirySubmitted(true);
  };

  const displayNearby = googleNearbyPlaces;

  return (
    <div className="min-h-screen bg-brand-offwhite pb-20">
      
      {/* TOP NAVIGATION BACK ANCHOR */}
      <div className="bg-brand-charcoal text-white py-4 px-4 sm:px-6 lg:px-8 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-300 hover:text-brand-yellow transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Map & Search Results</span>
          </button>

          {/* VERIFIED BADGE */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-slate-950 text-amber-400 border border-amber-400/50 shadow-md">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span className="text-metallic-gold font-black">
              {property.verificationStatus || 'PLATFORM VERIFIED'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* HEADER TITLE & ACTION BAR */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <span>{property.category}</span>
              <span>•</span>
              <span>{property.purpose === 'buy' ? 'For Sale' : 'For Rent'}</span>
              <span>•</span>
              <span className="text-brand-charcoal">{[property.location?.locality, property.location?.city].map(s => typeof s === 'string' ? s.trim() : '').filter(Boolean).join(', ') || property.location?.city || property.location?.state || 'India'}</span>
            </div>
            
            <h1 className="text-2xl sm:text-4xl font-extrabold text-brand-charcoal tracking-tight">
              {property.title}
            </h1>
            
            <p className="text-sm font-semibold text-gray-500 mt-1 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-brand-yellow shrink-0" />
              <span>{property.location?.address}</span>
            </p>
          </div>

          {/* PRICE, MAP & WISHLIST BUTTONS */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-brand-bordergray shadow-sm">
            <div>
              <span className="text-xs text-gray-400 font-medium block">Listed Price</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                {property.priceDisplay}
              </span>
            </div>

            {/* VIEW ON MAP BUTTON */}
            <button
              onClick={() => onViewOnMap && onViewOnMap(property)}
              className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-4 py-3 rounded-xl shadow flex items-center gap-2 transition-transform hover:scale-[1.02] cursor-pointer"
            >
              <MapPin className="w-4 h-4 fill-brand-charcoal/20" />
              <span>View Property on Map</span>
            </button>

            <button
              onClick={() => onWishlistToggle(property.id)}
              className={`p-3 rounded-xl border shadow-sm transition-colors ${
                (typeof isWishlisted === 'function' ? isWishlisted(property.id) : Boolean(isWishlisted))
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
              title="Save to Wishlist"
            >
              <Heart className={`w-6 h-6 ${(typeof isWishlisted === 'function' ? isWishlisted(property.id) : Boolean(isWishlisted)) ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* MEDIA GALLERY SECTION */}
        <div className="bg-white rounded-2xl p-4 border border-brand-bordergray shadow-sm mb-10 space-y-4">
          
          {/* MAIN FEATURED MEDIA CANVAS */}
          <div className="relative w-full h-[380px] sm:h-[500px] bg-brand-charcoal rounded-xl overflow-hidden flex items-center justify-center">
            {activeMediaType === 'image' && (
              <img
                src={activeMedia || getFirstUploadedImage(property)}
                alt={property.title}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = getCategoryFallbackImage(property);
                }}
                className="w-full h-full object-cover"
              />
            )}

            {activeMediaType === 'video' && (
              <video
                src={property.videoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            )}

            {activeMediaType === 'drone' && (
              <video
                src={property.droneVideoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            )}

            {/* VERIFICATION OVERLAY BADGE */}
            <div className="absolute top-4 left-4 bg-brand-charcoal/90 backdrop-blur-md text-brand-yellow text-xs font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow">
              <ShieldCheck className="w-4 h-4 text-brand-yellow" />
              <span>{property.verificationStatus}</span>
            </div>
          </div>

          {/* MEDIA THUMBNAILS & CONTROLS */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {mediaList.map((mItem, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveMedia(mItem.url);
                  setActiveMediaType('image');
                }}
                className={`relative w-24 h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                  activeMedia === mItem.url && activeMediaType === 'image'
                    ? 'border-brand-yellow ring-2 ring-brand-yellow/50'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={mItem.url}
                  alt={mItem.caption || ''}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = getCategoryFallbackImage(property);
                  }}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}

            {property.videoUrl && (
              <button
                onClick={() => setActiveMediaType('video')}
                className={`relative w-28 h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                  activeMediaType === 'video'
                    ? 'border-brand-yellow ring-2 ring-brand-yellow/50'
                    : 'border-transparent opacity-80 hover:opacity-100'
                }`}
              >
                <video
                  src={`${property.videoUrl}#t=0.1`}
                  preload="metadata"
                  muted
                  playsInline
                  className="w-full h-full object-cover pointer-events-none"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <img
                  src={getVideoThumbnailUrl(property.videoUrl, property)}
                  alt=""
                  className="w-full h-full object-cover opacity-80 absolute inset-0 -z-10"
                />
                <div className="absolute inset-0 bg-slate-950/40 flex flex-col items-center justify-center gap-1">
                  <div className="w-7 h-7 rounded-full bg-brand-yellow text-brand-charcoal flex items-center justify-center shadow-md">
                    <Video className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-white drop-shadow">Walkthrough</span>
                </div>
              </button>
            )}

            {property.droneVideoUrl && (
              <button
                onClick={() => setActiveMediaType('drone')}
                className={`relative w-28 h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                  activeMediaType === 'drone'
                    ? 'border-brand-yellow ring-2 ring-brand-yellow/50'
                    : 'border-transparent opacity-80 hover:opacity-100'
                }`}
              >
                <video
                  src={`${property.droneVideoUrl}#t=0.1`}
                  preload="metadata"
                  muted
                  playsInline
                  className="w-full h-full object-cover pointer-events-none"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <img
                  src={getVideoThumbnailUrl(property.droneVideoUrl, property)}
                  alt=""
                  className="w-full h-full object-cover opacity-80 absolute inset-0 -z-10"
                />
                <div className="absolute inset-0 bg-slate-950/40 flex flex-col items-center justify-center gap-1">
                  <div className="w-7 h-7 rounded-full bg-brand-yellow text-brand-charcoal flex items-center justify-center shadow-md">
                    <Plane className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-white drop-shadow">Drone View</span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* TWO COLUMN CONTENT LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT 2 COLUMNS: SPECIFICATIONS, AMENITIES, NEARBY, DESCRIPTION */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* PLATFORM VERIFICATION DETAILS TOOLTIP CARD */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-900 flex items-start gap-4">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold">Platform Verified Listing</h4>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  This property listing has been reviewed and verified by the EaseLand audit team. Verification indicates physical location inspection and review of owner details. It does not constitute a legal title warranty.
                </p>
                <span className="inline-block text-[11px] font-bold text-emerald-700 mt-2">
                  Verified Date: {property.verifiedDate || 'August 2026'}
                </span>
              </div>
            </div>

            {/* OVERVIEW SPECIFICATIONS */}
            <div className="bg-white rounded-2xl p-6 border border-brand-bordergray shadow-sm">
              <h3 className="text-lg font-bold text-brand-charcoal mb-4">Property Overview & Specs</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium block">Property Type</span>
                  <span className="text-sm font-bold text-brand-charcoal">{property.propertyType}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium block">Area / Size</span>
                  <span className="text-sm font-bold text-brand-charcoal">{property.areaDisplay || property.area + ' sq ft'}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium block">Facing Direction</span>
                  <span className="text-sm font-bold text-brand-charcoal">{property.facing || 'East'}</span>
                </div>

                {property.roadWidth && (
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-400 font-medium block">Road Width</span>
                    <span className="text-sm font-bold text-brand-charcoal">{property.roadWidth}</span>
                  </div>
                )}
                {property.bedrooms && (
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-400 font-medium block">Bedrooms</span>
                    <span className="text-sm font-bold text-brand-charcoal">{property.bedrooms} BHK</span>
                  </div>
                )}
                {property.bathrooms && (
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-400 font-medium block">Bathrooms</span>
                    <span className="text-sm font-bold text-brand-charcoal">{property.bathrooms} Baths</span>
                  </div>
                )}
              </div>
            </div>

            {/* AMENITIES */}
            <div className="bg-white rounded-2xl p-6 border border-brand-bordergray shadow-sm">
              <h3 className="text-lg font-bold text-brand-charcoal mb-4">Amenities & Features</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {property.amenities?.map((amenity, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-bold text-gray-700 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </div>


            {/* DESCRIPTION */}
            <div className="bg-white rounded-2xl p-6 border border-brand-bordergray shadow-sm">
              <h3 className="text-lg font-bold text-brand-charcoal mb-3">Property Description</h3>
              <p className="text-sm text-gray-700 font-medium leading-relaxed whitespace-pre-line">
                {property.description}
              </p>
            </div>

            {/* CONFIDENTIAL DOCUMENTS NOTICE */}
            <div className="bg-brand-charcoal text-white rounded-2xl p-6 border border-white/10 shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <Lock className="w-5 h-5 text-brand-yellow shrink-0" />
                <h4 className="text-base font-bold text-white">Confidential Document Policy</h4>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                All property ownership deeds, tax payment records, encumbrance certificates, and uploaded layout documents remain strictly confidential between the Property Owner and EaseLand Admin staff to prevent privacy misuse. Customers see verified boundary representations and audit badges only.
              </p>
            </div>

          </div>

          {/* RIGHT 1 COLUMN: DIRECT OWNER ENQUIRY FORM */}
          <div className="space-y-6">
            
            {/* EASELAND MEDIATION CONTACT CARD */}
            <div className="bg-white rounded-2xl p-6 border border-brand-bordergray shadow-lg sticky top-28 space-y-5">
              
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-brand-yellow text-brand-charcoal font-black text-lg flex items-center justify-center shadow-md shrink-0">
                  <ShieldCheck className="w-6 h-6 text-brand-charcoal" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Official EaseLand Support
                  </span>
                  <h4 className="text-base font-extrabold text-brand-charcoal mt-0.5">EaseLand Team</h4>
                  <span className="text-xs text-gray-500 font-semibold">Property & Customer Support</span>
                </div>
              </div>

              {/* CONTACT EASELAND OPTIONS */}
              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-extrabold text-brand-charcoal">
                  Interested in this Property? Contact EaseLand
                </h4>

                <div className="space-y-3">
                  <a
                    href={getEaselandWhatsAppUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm py-3.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all text-center"
                  >
                    <MessageCircle className="w-5 h-5 fill-current" />
                    <span>WhatsApp EaseLand (+91 6300691560)</span>
                  </a>

                  <a
                    href="tel:6300691560"
                    className="w-full bg-brand-charcoal hover:bg-black text-white font-extrabold text-sm py-3.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all text-center"
                  >
                    <Phone className="w-5 h-5 text-brand-yellow" />
                    <span>Call EaseLand (+91 6300691560)</span>
                  </a>
                </div>

                <p className="text-[10px] text-gray-500 text-center font-medium leading-normal">
                  EaseLand assists all buyer and owner connections for 100% verified, private, and secure property deals.
                </p>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
