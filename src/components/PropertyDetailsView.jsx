import React, { useState, useEffect } from 'react';
import { ShieldCheck, Heart, MapPin, CheckCircle2, Video, Plane, Lock, ChevronLeft, Send, Sparkles } from 'lucide-react';
import { mockApi } from '../services/mockApi';

export default function PropertyDetailsView({ property, onBack, isWishlisted, onWishlistToggle, activeRole, onViewOnMap }) {
  if (!property) return null;

  const [activeMedia, setActiveMedia] = useState(property.photos?.[0] || '');
  const [activeMediaType, setActiveMediaType] = useState('image');
  const [googleNearbyPlaces, setGoogleNearbyPlaces] = useState([]);

  // Direct Owner Enquiry Form State
  const [enquiryForm, setEnquiryForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: `Hello, I am interested in your property "${property.title}". Please get in touch for a site visit.`
  });

  const [enquirySubmitted, setEnquirySubmitted] = useState(false);

  // Fetch real nearby places using Google Places Service if available
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places && property.location?.lat) {
      try {
        const dummyElement = document.createElement('div');
        const service = new window.google.maps.places.PlacesService(dummyElement);
        const propLocation = new window.google.maps.LatLng(property.location.lat, property.location.lng);

        service.nearbySearch(
          {
            location: propLocation,
            radius: 3000,
            type: ['hospital', 'school', 'transit_station', 'shopping_mall', 'bank']
          },
          (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
              const mapped = results.slice(0, 6).map((place) => {
                // Calculate distance in km
                const placeLoc = place.geometry.location;
                const distMeters = window.google.maps.geometry.spherical.computeDistanceBetween(propLocation, placeLoc);
                const distStr = distMeters < 1000 ? `${Math.round(distMeters)} m` : `${(distMeters / 1000).toFixed(1)} km`;

                return {
                  name: place.name,
                  distance: distStr,
                  type: place.types?.[0]?.replace('_', ' ') || 'landmark'
                };
              });
              setGoogleNearbyPlaces(mapped);
            }
          }
        );
      } catch (err) {
        console.warn('Google Places Nearby Search fallback:', err);
      }
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

  const displayNearby = googleNearbyPlaces.length > 0 ? googleNearbyPlaces : property.nearbyPlaces || [];

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
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-slate-950/90 text-amber-400 border border-amber-400/50 shadow-md backdrop-blur-md">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span className="bg-metallic-gold bg-clip-text text-transparent">
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
              <span className="text-brand-charcoal">{property.location?.locality}, {property.location?.city}</span>
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
                src={activeMedia || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'}
                alt={property.title}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80';
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
            {property.photos?.map((photo, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveMedia(photo);
                  setActiveMediaType('image');
                }}
                className={`relative w-24 h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                  activeMedia === photo && activeMediaType === 'image'
                    ? 'border-brand-yellow ring-2 ring-brand-yellow/50'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={photo || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80'}
                  alt=""
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80';
                  }}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}

            {property.videoUrl && (
              <button
                onClick={() => setActiveMediaType('video')}
                className={`w-28 h-20 rounded-lg bg-brand-charcoal text-white shrink-0 flex flex-col items-center justify-center gap-1 border-2 transition-all ${
                  activeMediaType === 'video' ? 'border-brand-yellow' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <Video className="w-5 h-5 text-brand-yellow" />
                <span className="text-[10px] font-bold">Walkthrough</span>
              </button>
            )}

            {property.droneVideoUrl && (
              <button
                onClick={() => setActiveMediaType('drone')}
                className={`w-28 h-20 rounded-lg bg-brand-charcoal text-white shrink-0 flex flex-col items-center justify-center gap-1 border-2 transition-all ${
                  activeMediaType === 'drone' ? 'border-brand-yellow' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <Plane className="w-5 h-5 text-brand-yellow" />
                <span className="text-[10px] font-bold">Drone View</span>
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

            {/* WHAT'S NEARBY WITH GOOGLE PLACES NEARBY SEARCH INTEGRATION */}
            <div className="bg-white rounded-2xl p-6 border border-brand-bordergray shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-brand-charcoal">What's Nearby & Infrastructure</h3>
                <span className="text-[10px] font-extrabold uppercase bg-brand-charcoal text-brand-yellow px-2.5 py-1 rounded">
                  Google Places API Verified
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium mb-4">
                Real-time calculated proximity to nearby hospitals, schools, transit, and shopping around property coordinates.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayNearby.map((place, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                    <div>
                      <span className="font-bold text-gray-800 block line-clamp-1">{place.name}</span>
                      {place.type && <span className="text-[10px] text-gray-400 capitalize">{place.type}</span>}
                    </div>
                    <span className="font-extrabold text-brand-charcoal bg-white px-2.5 py-1 rounded-md border border-gray-200 shrink-0">
                      {place.distance}
                    </span>
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
            
            {/* DIRECT OWNER CONTACT CARD */}
            <div className="bg-white rounded-2xl p-6 border border-brand-bordergray shadow-lg sticky top-24">
              
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100 mb-5">
                <div className="w-12 h-12 rounded-xl bg-brand-yellow text-brand-charcoal font-black text-lg flex items-center justify-center">
                  {property.owner?.name?.charAt(0) || 'O'}
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    Verified Owner Listing
                  </span>
                  <h4 className="text-base font-bold text-brand-charcoal">{property.owner?.name}</h4>
                  <span className="text-xs text-gray-400 font-medium">Direct Property Owner</span>
                </div>
              </div>

              {enquirySubmitted ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center text-emerald-900 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h4 className="text-base font-bold">Enquiry Sent to Owner!</h4>
                  <p className="text-xs text-emerald-800">
                    Your interest has been logged directly with {property.owner?.name}. EaseLand Admin has also updated your lead CRM record.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleEnquirySubmit} className="space-y-4">
                  <h4 className="text-sm font-bold text-brand-charcoal">
                    Interested in this Property? Contact Owner
                  </h4>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Your Full Name</label>
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
                    <label className="block text-xs font-bold text-gray-600 mb-1">Phone Number</label>
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
                      required
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
                    className="w-full bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-sm py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
                  >
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    Send Direct Enquiry
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
