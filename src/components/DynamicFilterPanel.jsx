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

  const isPlotOrLand = ['OPEN_PLOT', 'LAND', 'AGRICULTURAL_LAND', 'COMMERCIAL_LAND'].includes(filters.propertyType);

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

  // Active filter chips list - strictly excludes default wildcard values ('ALL', 'ANY')
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
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white shadow-2xl border-l border-slate-300 flex flex-col transform transition-transform duration-300">
      
      {/* HEADER */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950 text-white shadow-md">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-black text-white tracking-wide">Property Filters</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* SORT COMPATIBILITY USER NOTICE */}
      {sortCompatibility && !sortCompatibility.compatible && (
        <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-2 text-xs text-amber-900 font-bold">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold text-amber-950">Sorting Notice</p>
            <p className="mt-0.5 text-amber-900 font-medium">This sorting option isn't available with your current filters.</p>
          </div>
        </div>
      )}

      {/* ACTIVE CHIPS BAR */}
      {activeChips.length > 0 && (
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
          {activeChips.map((chip, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-metallic-gold text-slate-950 border border-amber-300 rounded-full text-[11px] font-black shadow-sm"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={() => chip.customAction ? chip.customAction() : removeFilter(chip.key, chip.val)}
                className="hover:text-red-900 p-0.5 rounded-full"
              >
                <X className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* FILTER BODY */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50 text-slate-900">

        {/* Transaction Purpose */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
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
                className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${
                  (filters.purpose === item.val || (!filters.purpose && item.val === ''))
                    ? 'bg-metallic-gold border-amber-300 text-slate-950 shadow-md'
                    : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Property Type Select */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
            Property Type
          </label>
          <select
            value={filters.propertyType || ''}
            onChange={(e) => handleChange('propertyType', e.target.value)}
            className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm font-extrabold text-slate-900 focus:ring-2 focus:ring-amber-400 focus:outline-none shadow-sm"
          >
            <option value="" className="bg-white text-slate-900 font-bold">All Property Types</option>
            <option value={PropertyType.OPEN_PLOT} className="bg-white text-slate-900 font-bold">Open Plot</option>
            <option value={PropertyType.HOUSE} className="bg-white text-slate-900 font-bold">House / Independent House</option>
            <option value={PropertyType.APARTMENT} className="bg-white text-slate-900 font-bold">Apartment / Flat</option>
            <option value={PropertyType.VILLA} className="bg-white text-slate-900 font-bold">Villa</option>
            <option value={PropertyType.COMMERCIAL} className="bg-white text-slate-900 font-bold">Commercial Property</option>
            <option value={PropertyType.RENTAL} className="bg-white text-slate-900 font-bold">Rental House / Apartment</option>
            <option value={PropertyType.LAND} className="bg-white text-slate-900 font-bold">Agricultural Land</option>
            <option value={PropertyType.OTHER} className="bg-white text-slate-900 font-bold">Other</option>
          </select>
        </div>

        {/* Radius Search Controls */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between">
            <span>Nearby Radius Search</span>
            {filters.radiusKm && (
              <span className="text-[11px] text-amber-700 font-black">Within {filters.radiusKm} km</span>
            )}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Near place e.g. Guntur"
              value={filters.referencePlace || filters.city || ''}
              onChange={(e) => handleChange('referencePlace', e.target.value)}
              className="p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-400 focus:outline-none shadow-sm"
            />
            <select
              value={filters.radiusKm || ''}
              onChange={(e) => handleChange('radiusKm', e.target.value ? Number(e.target.value) : null)}
              className="p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-400 focus:outline-none shadow-sm"
            >
              <option value="" className="bg-white text-slate-900 font-bold">Any Distance</option>
              <option value="1" className="bg-white text-slate-900 font-bold">Within 1 km</option>
              <option value="5" className="bg-white text-slate-900 font-bold">Within 5 km</option>
              <option value="10" className="bg-white text-slate-900 font-bold">Within 10 km</option>
              <option value="25" className="bg-white text-slate-900 font-bold">Within 25 km</option>
              <option value="50" className="bg-white text-slate-900 font-bold">Within 50 km</option>
            </select>
          </div>
        </div>

        {/* Location Filters */}
        <div className="space-y-2">
          <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
            Location Search
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="City (e.g. Hyderabad)"
              value={filters.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
              className="p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-400 focus:outline-none shadow-sm"
            />
            <input
              type="text"
              placeholder="Locality (e.g. Gachibowli)"
              value={filters.locality || ''}
              onChange={(e) => handleChange('locality', e.target.value)}
              className="p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-400 focus:outline-none shadow-sm"
            />
          </div>
        </div>

        {/* Price Range */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
            Price Range (Rupees)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-600 font-bold">Min Price (Rs.)</span>
              <input
                type="number"
                placeholder="e.g. 1000000"
                value={filters.minPrice || ''}
                onChange={(e) => handleChange('minPrice', e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-400 focus:outline-none shadow-sm"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-600 font-bold">Max Price (Rs.)</span>
              <input
                type="number"
                placeholder="e.g. 15000000"
                value={filters.maxPrice || ''}
                onChange={(e) => handleChange('maxPrice', e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-400 focus:outline-none shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Plot / Property Area */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
            Area (in Sq Ft)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min Area sq ft"
              value={filters.minArea || filters.minAreaSqFt || ''}
              onChange={(e) => handleChange('minArea', e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-400 focus:outline-none shadow-sm"
            />
            <input
              type="number"
              placeholder="Max Area sq ft"
              value={filters.maxArea || filters.maxAreaSqFt || ''}
              onChange={(e) => handleChange('maxArea', e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-400 focus:outline-none shadow-sm"
            />
          </div>
        </div>

        {/* Bedrooms / BHK */}
        {!isPlotOrLand && (
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
              Bedrooms (BHK)
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {['', '1', '2', '3', '4'].map(bhk => (
                <button
                  key={bhk}
                  type="button"
                  onClick={() => handleChange('bedrooms', bhk)}
                  className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${
                    (filters.bedrooms === bhk || (!filters.bedrooms && bhk === ''))
                      ? 'bg-metallic-gold border-amber-300 text-slate-950 shadow-md'
                      : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
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
          <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
            Facing Direction
          </label>
          <select
            value={filters.facing || ''}
            onChange={(e) => handleChange('facing', e.target.value)}
            className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-400 focus:outline-none shadow-sm"
          >
            {FACING_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-white text-slate-900 font-bold">{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Furnishing Status */}
        {!isPlotOrLand && (
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
              Furnishing Status
            </label>
            <select
              value={filters.furnishing || ''}
              onChange={(e) => handleChange('furnishing', e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-400 focus:outline-none shadow-sm"
            >
              {FURNISHING_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-white text-slate-900 font-bold">{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Amenities Selection */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
            Amenities
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
            {CANONICAL_AMENITIES_LIST.map(amenity => {
              const selected = (filters.amenities || []).includes(amenity);
              return (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => handleAmenityToggle(amenity)}
                  className={`p-2.5 rounded-xl text-xs font-extrabold border flex items-center gap-2 transition-all ${
                    selected
                      ? 'bg-amber-100 border-amber-400 text-slate-950 shadow-sm'
                      : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                    selected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-400 bg-white'
                  }`}>
                    {selected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="truncate">{amenity}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* FOOTER ACTIONS */}
      <div className="p-4 border-t border-slate-300 bg-slate-900 flex items-center justify-between gap-3 shadow-lg">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs font-extrabold text-slate-300 hover:text-white px-3 py-2 rounded-xl transition-colors"
        >
          <RotateCcw className="w-4 h-4 text-amber-400" />
          Clear All
        </button>

        <button
          onClick={() => {
            onApplyFilters();
            onClose();
          }}
          className="flex-1 bg-metallic-gold hover:bg-amber-400 text-slate-950 font-black text-sm py-3.5 rounded-xl shadow-lg border border-amber-300 transition-all text-center"
        >
          Apply Filters {totalCount != null ? `(${totalCount})` : ''}
        </button>
      </div>

    </div>
  );
}
