import React from 'react';
import { ShieldCheck, Heart, MapPin, Bed, Bath, Maximize2, Sparkles, Building, ArrowUpRight } from 'lucide-react';
import { Purpose, PropertyType } from '../firebase/schema.js';

/**
 * EaseLand Marketplace Property Card Component
 * Consumes safe public property model.
 * Exposes ONLY publicApprovedMedia, verified status, and non-confidential property details.
 */
export default function PropertyCard({
  property = {},
  onWishlistToggle = () => {},
  isWishlisted = false,
  onSelectProperty = () => {},
  className = ''
}) {
  if (!property || (!property.propertyId && !property.id)) return null;

  const propId = property.propertyId || property.id;
  const title = property.title || 'Untitled Property Listing';
  const priceDisplay = property.priceDisplay || (property.price ? `Rs. ${Number(property.price).toLocaleString('en-IN')}` : 'Price on Request');
  const areaDisplay = property.areaDisplay || (property.areaSqFt ? `${property.areaSqFt.toLocaleString('en-IN')} sq ft` : (property.area ? `${property.area} sq ft` : ''));
  
  const purpose = property.purpose || Purpose.SALE;
  const propertyType = property.propertyType || PropertyType.OPEN_PLOT;
  
  const locationText = [
    property.location?.locality,
    property.location?.city,
    property.location?.state
  ].filter(Boolean).join(', ') || property.location?.city || property.location?.state || 'Pan-India';

  const thumbnail = property.approvedThumbnail || property.media?.[0]?.publicUrl || property.media?.[0]?.url || null;

  const isPlotOrLand = ['OPEN_PLOT', 'LAND', 'AGRICULTURAL_LAND', 'COMMERCIAL_LAND'].includes(propertyType);
  const bedrooms = Number(property.bedroomsNum || property.bedrooms || property.specs?.bedrooms) || 0;
  const bathrooms = Number(property.bathroomsNum || property.bathrooms || property.specs?.bathrooms) || 0;

  const handleCardClick = (e) => {
    e.preventDefault();
    onSelectProperty(propId);
  };

  const handleWishlistClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onWishlistToggle(propId, e);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group bg-metallic-card rounded-2xl border border-slate-700/60 hover:border-amber-400/50 shadow-lg hover:shadow-[0_10px_30px_rgba(212,175,55,0.15)] transition-all duration-300 overflow-hidden flex flex-col cursor-pointer ${className}`}
    >
      {/* Image Container */}
      <div className="relative aspect-[16/10] w-full bg-slate-950 overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900 p-4">
            <Building className="w-10 h-10 mb-2 opacity-50 text-amber-400" />
            <span className="text-xs font-semibold text-slate-400">No Image Available</span>
          </div>
        )}

        {/* Top Overlay Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide bg-metallic-gold text-slate-950 rounded-lg shadow-md border border-amber-300/40">
              {purpose === 'RENT' ? 'FOR RENT' : purpose === 'LEASE' ? 'FOR LEASE' : 'FOR SALE'}
            </span>
            <span className="px-2.5 py-1 text-[11px] font-bold bg-slate-900 text-slate-200 rounded-lg shadow-sm border border-slate-700">
              {propertyType.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Wishlist Toggle Button */}
          <button
            type="button"
            onClick={handleWishlistClick}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${
              isWishlisted
                ? 'bg-rose-600 text-white scale-105 shadow-rose-900/50'
                : 'bg-slate-900 text-slate-300 hover:text-rose-400 hover:bg-slate-800 border border-slate-700'
            }`}
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Bottom Overlay Badges */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
          {property.isPlatformVerified && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-950 text-[11px] font-black tracking-widest uppercase rounded-lg shadow-[0_2px_10px_rgba(212,175,55,0.25)] border border-amber-400/50">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-metallic-gold font-black">
                Platform Verified
              </span>
            </span>
          )}

          {property.distKm != null && property.distKm < Infinity && (
            <span className="ml-auto px-2 py-0.5 bg-slate-900 text-slate-300 text-[10px] font-medium rounded-md border border-slate-700">
              {property.distKm} km away
            </span>
          )}
        </div>
      </div>

      {/* Content Container */}
      <div className="p-4 flex-1 flex flex-col justify-between bg-gradient-to-b from-slate-900/80 to-slate-950">
        <div>
          {/* Price Header */}
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <h3 className="text-xl font-extrabold text-metallic-gold group-hover:text-amber-300 transition-colors">
              {priceDisplay}
            </h3>
            {areaDisplay && (
              <span className="text-xs font-semibold text-slate-400">
                {areaDisplay}
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="text-sm font-bold text-slate-100 line-clamp-1 mb-2 group-hover:text-amber-400 transition-colors">
            {title}
          </h4>

          {/* Location */}
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-3">
            <MapPin className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
            <span className="truncate">{locationText}</span>
          </div>
        </div>

        {/* Specifications Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            {!isPlotOrLand && bedrooms > 0 && (
              <div className="flex items-center gap-1 font-semibold text-slate-300">
                <Bed className="w-3.5 h-3.5 text-slate-400" />
                <span>{bedrooms} BHK</span>
              </div>
            )}
            {!isPlotOrLand && bathrooms > 0 && (
              <div className="flex items-center gap-1 font-semibold text-slate-300">
                <Bath className="w-3.5 h-3.5 text-slate-400" />
                <span>{bathrooms} Bath</span>
              </div>
            )}
            {areaDisplay && (
              <div className="flex items-center gap-1 font-semibold text-slate-300">
                <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{areaDisplay}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-0.5 text-xs font-bold text-amber-400 group-hover:translate-x-0.5 transition-transform">
            <span>View</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
