import React from 'react';
import { X, Filter, RotateCcw, Check, Navigation, AlertCircle } from 'lucide-react';
import { PropertyType, Purpose } from '../firebase/schema.js';

const FACING_OPTIONS = [
  { label: 'Any Direction', value: '' },
  { label: 'East', value: 'EAST' },
  { label: 'West', value: 'WEST' },
  { label: 'North', value: 'NORTH' },
  { label: 'South', value: 'SOUTH' },
  { label: 'North East', value: 'NORTH_EAST' },
  { label: 'North West', value: 'NORTH_WEST' },
  { label: 'South East', value: 'SOUTH_EAST' },
  { label: 'South West', value: 'SOUTH_WEST' }
];

const FURNISHING_OPTIONS = [
  { label: 'Any Furnishing', value: '' },
  { label: 'Unfurnished', value: 'UNFURNISHED' },
  { label: 'Semi Furnished', value: 'SEMI_FURNISHED' },
  { label: 'Fully Furnished', value: 'FULLY_FURNISHED' }
];

const CANONICAL_AMENITIES_LIST = [
  'Gated Community',
  '24/7 Security',
  'Water Supply',
  'Electricity Connection',
  'Clubhouse',
  'Swimming Pool',
  'Gym',
  'Park',
  'Power Backup',
  'Car Parking',
  'Lift'
];

export default function DynamicFilterPanel({
  isOpen,
  onClose,
  filters,
  setFilters,
  onApplyFilters,
  totalCount,
  sortCompatibility = null
}) {
  if (!isOpen) return null;

  const isPlotOrLand = ['OPEN_PLOT', 'LAND', 'AGRICULTURAL_LAND', 'COMMERCIAL_LAND'].includes(filters?.propertyType);

  const handleChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      cleared: false,
      [key]: value
    }));
  };

  const handleAmenityToggle = (amenity) => {
    setFilters(prev => {
      const current = prev.amenities || [];
      const updated = current.includes(amenity)
        ? current.filter(a => a !== amenity)
        : [...current, amenity];
      return {
        ...prev,
        cleared: false,
        amenities: updated
      };
    });
  };

  const handleReset = () => {
    setFilters({
      cleared: false,
      query: '',
      purpose: '',
      propertyType: '',
      state: '',
      district: '',
      city: '',
      locality: '',
      minPrice: '',
      maxPrice: '',
      minArea: '',
      maxArea: '',
      bedrooms: '',
      bathrooms: '',
      facing: '',
      furnishing: '',
      amenities: [],
      radiusKm: null,
      referencePlace: '',
      sortBy: 'newest'
    });
  };

  const removeFilter = (key, defaultValue = '') => {
    setFilters(prev => ({
      ...prev,
      [key]: defaultValue
    }));
  };

  // Active filter chips list
  const activeChips = [];
  if (filters.purpose && filters.purpose !== 'ALL' && filters.purpose !== 'ANY') activeChips.push({ label: `Purpose: ${filters.purpose}`, key: 'purpose', val: '' });
  if (filters.propertyType && filters.propertyType !== 'ALL' && filters.propertyType !== 'ANY') activeChips.push({ label: `Type: ${filters.propertyType.replace(/_/g, ' ')}`, key: 'propertyType', val: '' });
  if (filters.state) activeChips.push({ label: `State: ${filters.state}`, key: 'state', val: '' });
  if (filters.district) activeChips.push({ label: `District: ${filters.district}`, key: 'district', val: '' });
  if (filters.city) activeChips.push({ label: `City: ${filters.city}`, key: 'city', val: '' });
  if (filters.locality) activeChips.push({ label: `Locality: ${filters.locality}`, key: 'locality', val: '' });
  if (filters.minPrice) activeChips.push({ label: `Min Price: Rs. ${Number(filters.minPrice).toLocaleString('en-IN')}`, key: 'minPrice', val: '' });
  if (filters.maxPrice) activeChips.push({ label: `Max Price: Rs. ${Number(filters.maxPrice).toLocaleString('en-IN')}`, key: 'maxPrice', val: '' });
  if (filters.minAreaSqFt || filters.minArea) activeChips.push({ label: `Min Area: ${filters.minAreaSqFt || filters.minArea} sq ft`, key: 'minArea', val: '' });
  if (filters.maxAreaSqFt || filters.maxArea) activeChips.push({ label: `Max Area: ${filters.maxAreaSqFt || filters.maxArea} sq ft`, key: 'maxArea', val: '' });
  if (!isPlotOrLand && filters.bedrooms && filters.bedrooms !== 'ANY' && filters.bedrooms !== 'ALL') activeChips.push({ label: `BHK: ${filters.bedrooms}+`, key: 'bedrooms', val: '' });
  if (filters.facing && filters.facing !== 'ALL' && filters.facing !== 'ANY') activeChips.push({ label: `Facing: ${filters.facing}`, key: 'facing', val: '' });
  if (filters.furnishing && filters.furnishing !== 'ALL' && filters.furnishing !== 'ANY') activeChips.push({ label: `Furnishing: ${filters.furnishing}`, key: 'furnishing', val: '' });
  if (filters.radiusKm) activeChips.push({ label: `Radius: Within ${filters.radiusKm} km`, key: 'radiusKm', val: null });
  if (filters.amenities && filters.amenities.length > 0) {
    filters.amenities.forEach(a => {
      activeChips.push({
        label: `Amenity: ${a}`,
        customAction: () => handleAmenityToggle(a)
      });
    });
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white shadow-2xl border-l border-gray-200 flex flex-col transform transition-transform duration-300">

      {/* HEADER */}
      <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-brand-charcoal text-white">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-brand-yellow" />
          <h3 className="text-lg font-bold">Property Filters</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* SORT COMPATIBILITY USER NOTICE */}
      {sortCompatibility && !sortCompatibility.compatible && (
        <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2 text-xs text-amber-900 font-medium">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Sorting notice</p>
            <p className="mt-0.5">This sorting option isn't available with your current filters.</p>
          </div>
        </div>
      )}

      {/* ACTIVE CHIPS BAR */}
      {activeChips.length > 0 && (
        <div className="p-3 bg-amber-50 border-b border-amber-100 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
          {activeChips.map((chip, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-200 rounded-full text-[11px] font-semibold"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => chip.customAction ? chip.customAction() : removeFilter(chip.key, chip.val)}
                className="hover:text-red-700"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* FILTER BODY */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">

        {/* Transaction Purpose */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
            Purpose
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: 'All', val: '' },
              { label: 'Sale', val: Purpose.SALE },
              { label: 'Rent', val: Purpose.RENT },
              { label: 'Lease', val: Purpose.LEASE }
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleChange('purpose', item.val)}
                className={`py-2 rounded-lg text-xs font-bold border transition-colors ${(filters.purpose === item.val || (!filters.purpose && item.val === ''))
                    ? 'bg-brand-yellow border-brand-yellow text-brand-charcoal'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Property Type Select */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
            Property Type
          </label>
          <select
            value={filters.propertyType || ''}
            onChange={(e) => handleChange('propertyType', e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-brand-charcoal focus:ring-2 focus:ring-brand-yellow focus:outline-none"
          >
            <option value="">All Property Types</option>
            <option value={PropertyType.OPEN_PLOT}>Open Plot</option>
            <option value={PropertyType.HOUSE}>House / Independent House</option>
            <option value={PropertyType.APARTMENT}>Apartment / Flat</option>
            <option value={PropertyType.VILLA}>Villa</option>
            <option value={PropertyType.COMMERCIAL}>Commercial Property</option>
            <option value={PropertyType.LAND}>Agricultural Land</option>
            <option value={PropertyType.OTHER}>Other</option>
          </select>
        </div>

        {/* Radius Search Controls */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2 flex items-center justify-between">
            <span>Nearby Radius Search</span>
            {filters.radiusKm && (
              <span className="text-[10px] text-amber-700 font-bold">Within {filters.radiusKm} km</span>
            )}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Near place e.g. Guntur"
              value={filters.referencePlace || filters.city || ''}
              onChange={(e) => handleChange('referencePlace', e.target.value)}
              className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold"
            />
            <select
              value={filters.radiusKm || ''}
              onChange={(e) => handleChange('radiusKm', e.target.value ? Number(e.target.value) : null)}
              className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold"
            >
              <option value="">Any Distance</option>
              <option value="1">Within 1 km</option>
              <option value="5">Within 5 km</option>
              <option value="10">Within 10 km</option>
              <option value="25">Within 25 km</option>
              <option value="50">Within 50 km</option>
            </select>
          </div>
        </div>

        {/* Location Filters */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
            Location Search
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="City (e.g. Hyderabad)"
              value={filters.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
              className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold"
            />
            <input
              type="text"
              placeholder="Locality (e.g. Gachibowli)"
              value={filters.locality || ''}
              onChange={(e) => handleChange('locality', e.target.value)}
              className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
        </div>

        {/* Price Range */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
            Price Range (Rupees)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-gray-400 font-medium">Min Price (Rs.)</span>
              <input
                type="number"
                placeholder="e.g. 1000000"
                value={filters.minPrice || ''}
                onChange={(e) => handleChange('minPrice', e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-medium">Max Price (Rs.)</span>
              <input
                type="number"
                placeholder="e.g. 15000000"
                value={filters.maxPrice || ''}
                onChange={(e) => handleChange('maxPrice', e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Plot / Property Area */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
            Area (in Sq Ft)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min Area sq ft"
              value={filters.minArea || filters.minAreaSqFt || ''}
              onChange={(e) => handleChange('minArea', e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold"
            />
            <input
              type="number"
              placeholder="Max Area sq ft"
              value={filters.maxArea || filters.maxAreaSqFt || ''}
              onChange={(e) => handleChange('maxArea', e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
        </div>

        {/* Bedrooms / BHK (Property-type aware: hidden for Plot/Land) */}
        {!isPlotOrLand && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
              Bedrooms (BHK)
            </label>
            <div className="grid grid-cols-5 gap-1">
              {['', '1', '2', '3', '4'].map(bhk => (
                <button
                  key={bhk}
                  type="button"
                  onClick={() => handleChange('bedrooms', bhk)}
                  className={`py-2 rounded-lg text-xs font-bold border transition-colors ${(filters.bedrooms === bhk || (!filters.bedrooms && bhk === ''))
                      ? 'bg-brand-yellow border-brand-yellow text-brand-charcoal'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {bhk === '' ? 'Any' : `${bhk}+`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Facing Direction */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
            Facing Direction
          </label>
          <select
            value={filters.facing || ''}
            onChange={(e) => handleChange('facing', e.target.value)}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold"
          >
            {FACING_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Furnishing Status (Property-type aware: hidden for Plot/Land) */}
        {!isPlotOrLand && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
              Furnishing Status
            </label>
            <select
              value={filters.furnishing || ''}
              onChange={(e) => handleChange('furnishing', e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold"
            >
              {FURNISHING_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Amenities Selection */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
            Amenities
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
            {CANONICAL_AMENITIES_LIST.map(amenity => {
              const selected = (filters.amenities || []).includes(amenity);
              return (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => handleAmenityToggle(amenity)}
                  className={`p-2 rounded-lg text-[11px] font-semibold border flex items-center gap-1.5 transition-colors ${selected
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${selected ? 'bg-amber-600 border-amber-600 text-white' : 'border-gray-300 bg-white'
                    }`}>
                    {selected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className="truncate">{amenity}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* FOOTER ACTIONS */}
      <div className="p-5 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-brand-charcoal"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Clear All
        </button>

        <button
          onClick={() => {
            onApplyFilters();
            onClose();
          }}
          className="flex-1 bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-sm py-3 rounded-xl shadow-md transition-all text-center"
        >
          Apply Filters {totalCount != null ? `(${totalCount})` : ''}
        </button>
      </div>

    </div>
  );
}


