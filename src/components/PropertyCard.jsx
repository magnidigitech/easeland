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
      className={`group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col cursor-pointer ${className}`}
    >
      {/* Image Container */}
      <div className="relative aspect-[16/10] w-full bg-brand-softgray overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100 p-4">
            <Building className="w-10 h-10 mb-2 opacity-50 text-brand-charcoal" />
            <span className="text-xs font-semibold text-gray-500">No Image Available</span>
          </div>
        )}

        {/* Top Overlay Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide bg-brand-charcoal text-brand-yellow rounded-lg shadow-md">
              {purpose === 'RENT' ? 'FOR RENT' : purpose === 'LEASE' ? 'FOR LEASE' : 'FOR SALE'}
            </span>
            <span className="px-2.5 py-1 text-[11px] font-bold bg-white/95 text-brand-charcoal backdrop-blur-md rounded-lg shadow-sm border border-gray-200">
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
                ? 'bg-red-500 text-white scale-105'
                : 'bg-white/90 text-gray-600 hover:text-red-500 hover:bg-white border border-gray-200'
            }`}
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Bottom Overlay Badges */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
          {property.isPlatformVerified && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-lg shadow-md">
              <ShieldCheck className="w-3.5 h-3.5" />
              Platform Verified
            </span>
          )}

          {property.distKm != null && property.distKm < Infinity && (
            <span className="ml-auto px-2 py-0.5 bg-brand-charcoal/80 backdrop-blur-md text-white text-[10px] font-medium rounded-md">
              {property.distKm} km away
            </span>
          )}
        </div>
      </div>

      {/* Content Container */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Price Header */}
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <h3 className="text-xl font-extrabold text-brand-charcoal group-hover:text-amber-600 transition-colors">
              {priceDisplay}
            </h3>
            {areaDisplay && (
              <span className="text-xs font-semibold text-gray-500">
                {areaDisplay}
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="text-sm font-bold text-gray-800 line-clamp-1 mb-2 group-hover:text-brand-charcoal">
            {title}
          </h4>

          {/* Location */}
          <div className="flex items-center gap-1 text-xs text-gray-600 mb-3">
            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="truncate">{locationText}</span>
          </div>
        </div>

        {/* Specifications Footer */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-3">
            {!isPlotOrLand && bedrooms > 0 && (
              <div className="flex items-center gap-1 font-semibold">
                <Bed className="w-3.5 h-3.5 text-gray-500" />
                <span>{bedrooms} BHK</span>
              </div>
            )}
            {!isPlotOrLand && bathrooms > 0 && (
              <div className="flex items-center gap-1 font-semibold">
                <Bath className="w-3.5 h-3.5 text-gray-500" />
                <span>{bathrooms} Bath</span>
              </div>
            )}
            {areaDisplay && (
              <div className="flex items-center gap-1 font-semibold">
                <Maximize2 className="w-3.5 h-3.5 text-gray-500" />
                <span>{areaDisplay}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-0.5 text-xs font-bold text-brand-charcoal group-hover:translate-x-0.5 transition-transform">
            <span>View</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
