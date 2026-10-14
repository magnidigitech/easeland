import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Filter, RotateCcw, Check, Navigation, AlertCircle, MapPin, Search, Loader2 } from 'lucide-react';
import { PropertyType, Purpose } from '../firebase/schema.js';
import { resolvePlaceCoordinates, geocodePlaceWithHierarchy } from '../services/locationProvider.js';

export const AREA_UNIT_OPTIONS = [
  { label: 'Sq Ft', value: 'sq ft' },
  { label: 'Sq Yards', value: 'sq yds' },
  { label: 'Acres', value: 'acres' },
  { label: 'Cents', value: 'cents' },
  { label: 'Gunthas', value: 'guntas' },
  { label: 'Ankanams', value: 'ankanams' }
];

export function formatPriceInWords(val) {
  if (val === null || val === undefined || val === '') return '';
  const num = Number(val);
  if (isNaN(num) || num <= 0) return '';

  if (num >= 10000000) {
    const cr = num / 10000000;
    const formatted = cr % 1 === 0 ? String(cr) : cr.toFixed(2).replace(/0$/, '');
    return 'Rs. ' + formatted + ' Crore' + (cr > 1 ? 's' : '') + ' (' + num.toLocaleString('en-IN') + ')';
  }
  if (num >= 100000) {
    const lk = num / 100000;
    const formatted = lk % 1 === 0 ? String(lk) : lk.toFixed(2).replace(/0$/, '');
    return 'Rs. ' + formatted + ' Lakh' + (lk > 1 ? 's' : '') + ' (' + num.toLocaleString('en-IN') + ')';
  }
  if (num >= 1000) {
    const th = num / 1000;
    const formatted = th % 1 === 0 ? String(th) : th.toFixed(1).replace(/0$/, '');
    return 'Rs. ' + formatted + ' Thousand (' + num.toLocaleString('en-IN') + ')';
  }
  return 'Rs. ' + num.toLocaleString('en-IN');
}

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

  const [cityQuery, setCityQuery] = useState(filters?.city || '');
  const [localityQuery, setLocalityQuery] = useState(filters?.locality || '');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationResolutionStatus, setLocationResolutionStatus] = useState(null);

  useEffect(() => {
    setCityQuery(filters?.city || '');
  }, [filters?.city]);

  useEffect(() => {
    setLocalityQuery(filters?.locality || '');
  }, [filters?.locality]);

  const handleCityInputChange = (val) => {
    setCityQuery(val);
    setLocationResolutionStatus(null);
    setFilters(prev => ({
      ...prev,
      cleared: false,
      city: val
    }));
  };

  const handleLocalityInputChange = (val) => {
    setLocalityQuery(val);
    setLocationResolutionStatus(null);
    setFilters(prev => ({
      ...prev,
      cleared: false,
      locality: val
    }));
  };

  const handleClearCity = () => {
    setCityQuery('');
    setLocationResolutionStatus(null);
    setFilters(prev => ({
      ...prev,
      city: '',
      district: '',
      state: ''
    }));
  };

  const handleClearLocality = () => {
    setLocalityQuery('');
    setLocationResolutionStatus(null);
    setFilters(prev => ({
      ...prev,
      locality: '',
      referenceLat: null,
      referenceLng: null,
      referencePlace: null
    }));
  };

  const handleFetchGoogleLocation = async () => {
    const locPart = localityQuery.trim();
    const cityPart = cityQuery.trim();
    const queryParts = [locPart, cityPart].filter(Boolean);
    if (queryParts.length === 0) return;

    const queryStr = queryParts.join(', ');
    setIsFetchingLocation(true);
    setLocationResolutionStatus(null);

    try {
      const geoResult = await geocodePlaceWithHierarchy(queryStr);
      if (geoResult) {
        const resolvedLocality = geoResult.locality || locPart;
        const resolvedCity = geoResult.city || cityPart;
        const resolvedDistrict = geoResult.district || '';
        const resolvedState = geoResult.state || '';

        setFilters(prev => ({
          ...prev,
          cleared: false,
          locality: resolvedLocality,
          city: resolvedCity,
          district: resolvedDistrict,
          state: resolvedState,
          referenceLat: geoResult.lat,
          referenceLng: geoResult.lng,
          referencePlace: geoResult.displayName || queryStr
        }));

        setLocalityQuery(resolvedLocality);
        setCityQuery(resolvedCity);
        setLocationResolutionStatus({
          type: 'success',
          message: `${resolvedLocality} located in ${resolvedCity}${resolvedState ? ', ' + resolvedState : ''}`
        });
      } else {
        setLocationResolutionStatus({
          type: 'info',
          message: `Location active for "${queryStr}"`
        });
      }
    } catch (err) {
      console.warn('Google Maps location fetch error:', err);
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleChange = (key, value) => {
    let cleanVal = value;
    if (['minPrice', 'maxPrice', 'minArea', 'maxArea', 'minAreaSqFt', 'maxAreaSqFt'].includes(key)) {
      if (typeof cleanVal === 'string') {
        cleanVal = cleanVal.replace(/[^0-9.]/g, '');
      } else if (typeof cleanVal === 'number') {
        cleanVal = Math.max(0, cleanVal);
      }
    }
    setFilters(prev => ({
      ...prev,
      cleared: false,
      [key]: cleanVal
    }));
  };

  const handleAmenityToggle = (amenity) => {
    setFilters(prev => {
      const current = prev.amenities || [];
      const cleanTarget = String(amenity).toLowerCase().trim();
      const exists = current.some(a => String(a).toLowerCase().trim() === cleanTarget);
      const updated = exists
        ? current.filter(a => String(a).toLowerCase().trim() !== cleanTarget)
        : [...current, amenity];
      return {
        ...prev,
        cleared: false,
        amenities: updated
      };
    });
  };

  const handleReset = () => {
    setLocationResolutionStatus(null);
    setCityQuery('');
    setLocalityQuery('');
    setFilters({
      cleared: false,
      query: '',
      purpose: '',
      propertyType: '',
      category: 'All',
      state: '',
      district: '',
      city: '',
      locality: '',
      minPrice: '',
      maxPrice: '',
      minArea: '',
      maxArea: '',
      minAreaSqFt: '',
      maxAreaSqFt: '',
      areaUnit: 'sq ft',
      bedrooms: '',
      bathrooms: '',
      facing: '',
      furnishing: '',
      amenities: [],
      radiusKm: null,
      referencePlace: '',
      referenceLat: null,
      referenceLng: null,
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
  if (filters.category && filters.category !== 'All') activeChips.push({ label: `Category: ${filters.category}`, key: 'category', val: 'All' });
  if (filters.state) activeChips.push({ label: `State: ${filters.state}`, key: 'state', val: '' });
  if (filters.district) activeChips.push({ label: `District: ${filters.district}`, key: 'district', val: '' });
  if (filters.city) activeChips.push({ label: `City: ${filters.city}`, key: 'city', val: '' });
  if (filters.locality) activeChips.push({ label: `Locality: ${filters.locality}`, key: 'locality', val: '' });
  if (filters.minPrice !== null && filters.minPrice !== undefined && filters.minPrice !== '' && Number(filters.minPrice) >= 0) {
    activeChips.push({ label: `Min Price: Rs. ${Number(filters.minPrice).toLocaleString('en-IN')}`, key: 'minPrice', val: '' });
  }
  if (filters.maxPrice !== null && filters.maxPrice !== undefined && filters.maxPrice !== '' && Number(filters.maxPrice) >= 0) {
    activeChips.push({ label: `Max Price: Rs. ${Number(filters.maxPrice).toLocaleString('en-IN')}`, key: 'maxPrice', val: '' });
  }
  
  const currentAreaUnit = filters.areaUnit || 'sq ft';
  if (filters.minArea || filters.minAreaSqFt) activeChips.push({ label: `Min Area: ${filters.minArea || filters.minAreaSqFt} ${currentAreaUnit}`, key: 'minArea', val: '' });
  if (filters.maxArea || filters.maxAreaSqFt) activeChips.push({ label: `Max Area: ${filters.maxArea || filters.maxAreaSqFt} ${currentAreaUnit}`, key: 'maxArea', val: '' });
  if (!isPlotOrLand && filters.bedrooms && filters.bedrooms !== 'ANY' && filters.bedrooms !== 'ALL') activeChips.push({ label: `BHK: ${filters.bedrooms}+`, key: 'bedrooms', val: '' });
  if (filters.facing && filters.facing !== 'ALL' && filters.facing !== 'ANY') activeChips.push({ label: `Facing: ${filters.facing}`, key: 'facing', val: '' });
  if (filters.furnishing && filters.furnishing !== 'ALL' && filters.furnishing !== 'ANY') activeChips.push({ label: `Furnishing: ${filters.furnishing}`, key: 'furnishing', val: '' });
  if (filters.referencePlace) activeChips.push({ label: `Near: ${filters.referencePlace}`, key: 'referencePlace', val: '' });
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
    <>
      {/* Click-outside backdrop overlay strictly covering map canvas */}
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-[0.5px] z-30 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* FILTER SLIDE-OVER DRAWER (Contained within map canvas, strictly below Navbar & Search bar) */}
      <div className="absolute inset-y-0 right-0 z-40 w-full sm:w-96 bg-white shadow-2xl border-l border-gray-200 flex flex-col transform transition-transform duration-300 animate-in slide-in-from-right duration-200">

        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-gray-800 flex items-center justify-between bg-brand-charcoal text-white shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-brand-yellow" />
            <h3 className="text-base sm:text-lg font-bold tracking-tight">Property Filters</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Close filters"
          >
            <X className="w-5 h-5" />
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
            onChange={(e) => {
              const selectedType = e.target.value;
              setFilters(prev => ({
                ...prev,
                cleared: false,
                propertyType: selectedType,
                category: 'All'
              }));
            }}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-brand-charcoal focus:ring-2 focus:ring-brand-yellow focus:outline-none"
          >
            <option value="">All Property Types</option>
            <option value={PropertyType.OPEN_PLOT}>Open Plot Ventures / City</option>
            <option value={PropertyType.HOUSE}>Independent House / Villa</option>
            <option value={PropertyType.APARTMENT}>Apartments / Flat</option>
            <option value={PropertyType.VILLA}>Villa</option>
            <option value={PropertyType.COMMERCIAL}>Commercial Property</option>
            <option value={PropertyType.LAND}>Agricultural Lands</option>
            <option value={PropertyType.OTHER}>Others</option>
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
              placeholder="Enter Nearby Place"
              value={filters.referencePlace || ''}
              onChange={(e) => {
                const val = e.target.value;
                handleChange('referencePlace', val);
                const coords = resolvePlaceCoordinates(val);
                if (coords) {
                  setFilters(prev => ({
                    ...prev,
                    referencePlace: val,
                    referenceLat: coords.lat,
                    referenceLng: coords.lng
                  }));
                }
              }}
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
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              Location Search
            </label>
            {(filters.city || filters.locality || filters.referencePlace) && (
              <button
                type="button"
                onClick={() => {
                  handleClearCity();
                  handleClearLocality();
                }}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline"
              >
                Reset Location
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* CITY INPUT (CLEAN, NO POPUP SUGGESTIONS) */}
            <div className="relative">
              <input
                type="text"
                placeholder="Enter City"
                value={cityQuery}
                onChange={(e) => handleCityInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFetchGoogleLocation();
                  }
                }}
                className="w-full p-2.5 pr-7 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:bg-white"
              />
              {cityQuery && (
                <button
                  type="button"
                  onClick={handleClearCity}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                  title="Clear City"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* LOCALITY INPUT (CLEAN, NO POPUP SUGGESTIONS) */}
            <div className="relative">
              <input
                type="text"
                placeholder="Enter Locality"
                value={localityQuery}
                onChange={(e) => handleLocalityInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFetchGoogleLocation();
                  }
                }}
                className="w-full p-2.5 pr-7 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:bg-white"
              />
              {localityQuery && (
                <button
                  type="button"
                  onClick={handleClearLocality}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                  title="Clear Locality"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* FETCH / LOCATE BUTTON POWERED BY GOOGLE MAPS */}
          {(localityQuery.trim() || cityQuery.trim()) && (
            <button
              type="button"
              onClick={handleFetchGoogleLocation}
              disabled={isFetchingLocation}
              className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-60 cursor-pointer"
            >
              {isFetchingLocation ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Locating on Google Maps...</span>
                </>
              ) : (
                <>
                  <MapPin className="w-3.5 h-3.5 text-slate-950" />
                  <span>Locate & Center Map</span>
                </>
              )}
            </button>
          )}

          {/* Location Resolution Feedback & Active Status Pill */}
          {(filters.locality || filters.city) && (
            <div className="flex items-center justify-between p-2.5 bg-amber-50/90 border border-amber-200/90 rounded-xl text-xs text-amber-950">
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">
                  {filters.locality && (
                    <strong className="font-extrabold text-amber-900">{filters.locality}</strong>
                  )}
                  {filters.city && (
                    <span className="text-[11px] text-amber-800 ml-1">
                      {filters.locality ? 'in ' : ''}<strong>{filters.city}</strong>
                      {filters.state ? ' (' + filters.state + ')' : ''}
                    </span>
                  )}
                  {filters.referenceLat && filters.referenceLng && (
                    <span className="text-[10px] text-emerald-800 font-extrabold ml-1.5 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                      Google Maps Verified
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleClearCity();
                  handleClearLocality();
                }}
                className="text-amber-700 hover:text-amber-900 ml-1 p-0.5 rounded hover:bg-amber-100 shrink-0"
                title="Clear Location Filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Price Range with Interactive Price Dragger */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Price Range (Rupees)
            </label>
            {(filters.minPrice || filters.maxPrice) && (
              <button
                type="button"
                onClick={() => {
                  handleChange('minPrice', '');
                  handleChange('maxPrice', '');
                }}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline"
              >
                Reset Price
              </button>
            )}
          </div>

          {/* Interactive Dual Price Dragger Bar */}
          {(() => {
            const isRent = filters.purpose === Purpose.RENT;
            const priceSliderMax = isRent ? 200000 : 100000000;
            const priceSliderStep = isRent ? 5000 : 500000;
            const sliderMinVal = Math.max(0, Math.min(Number(filters.minPrice) || 0, priceSliderMax));
            const sliderMaxVal = filters.maxPrice ? Math.max(0, Math.min(Number(filters.maxPrice), priceSliderMax)) : priceSliderMax;
            const minPercent = Math.min(100, Math.max(0, (sliderMinVal / priceSliderMax) * 100));
            const maxPercent = Math.min(100, Math.max(0, (sliderMaxVal / priceSliderMax) * 100));

            return (
              <div className="bg-gray-50/90 p-3.5 rounded-xl border border-gray-200 mb-3 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-800">
                  <span className="truncate max-w-[45%]">
                    {filters.minPrice ? (formatPriceInWords(filters.minPrice) || `Rs. ${Number(filters.minPrice).toLocaleString('en-IN')}`) : 'Rs. 0'}
                  </span>
                  <span className="text-gray-400 font-bold shrink-0">to</span>
                  <span className="truncate max-w-[45%] text-right">
                    {filters.maxPrice ? (formatPriceInWords(filters.maxPrice) || `Rs. ${Number(filters.maxPrice).toLocaleString('en-IN')}`) : (isRent ? 'Rs. 2L+' : 'Rs. 10 Cr+')}
                  </span>
                </div>

                {/* Dragger Bar Track */}
                <div className="relative h-6 flex items-center select-none">
                  {/* Background Track */}
                  <div className="absolute inset-x-0 h-2 bg-gray-200 rounded-full"></div>
                  {/* Highlight Active Range Fill */}
                  <div
                    className="absolute h-2 bg-gradient-to-r from-brand-navy via-amber-400 to-brand-yellow rounded-full shadow-xs"
                    style={{
                      left: `${minPercent}%`,
                      width: `${Math.max(0, maxPercent - minPercent)}%`
                    }}
                  ></div>

                  {/* Min Price Dragger Thumb */}
                  <input
                    type="range"
                    min={0}
                    max={priceSliderMax}
                    step={priceSliderStep}
                    value={sliderMinVal}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(Number(e.target.value), sliderMaxVal));
                      handleChange('minPrice', val > 0 ? String(val) : '');
                    }}
                    className={`price-slider-input absolute inset-x-0 w-full h-2 cursor-pointer ${sliderMinVal > priceSliderMax * 0.7 ? 'z-20' : 'z-10'}`}
                    aria-label="Minimum Price Dragger"
                  />

                  {/* Max Price Dragger Thumb */}
                  <input
                    type="range"
                    min={0}
                    max={priceSliderMax}
                    step={priceSliderStep}
                    value={sliderMaxVal}
                    onChange={(e) => {
                      const val = Math.max(sliderMinVal, Number(e.target.value));
                      handleChange('maxPrice', val < priceSliderMax ? String(val) : '');
                    }}
                    className="price-slider-input absolute inset-x-0 w-full h-2 cursor-pointer z-15"
                    aria-label="Maximum Price Dragger"
                  />
                </div>

                {/* Slider Scale End Labels */}
                <div className="flex items-center justify-between text-[10px] text-gray-500 font-bold px-0.5">
                  <span>Rs. 0</span>
                  <span>{isRent ? 'Rs. 50k' : 'Rs. 50 Lakhs'}</span>
                  <span>{isRent ? 'Rs. 1 Lakh' : 'Rs. 1 Crore'}</span>
                  <span>{isRent ? 'Rs. 2L+' : 'Rs. 10 Cr+'}</span>
                </div>

                {/* Quick Budget Preset Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-200/60">
                  {(isRent
                    ? [
                        { label: 'Under 15k', min: '', max: '15000' },
                        { label: '15k - 30k', min: '15000', max: '30000' },
                        { label: '30k - 50k', min: '30000', max: '50000' },
                        { label: '50k - 1L', min: '50000', max: '100000' },
                        { label: '1L+', min: '100000', max: '' }
                      ]
                    : [
                        { label: '< 25L', min: '', max: '2500000' },
                        { label: '25L - 50L', min: '2500000', max: '5000000' },
                        { label: '50L - 1 Cr', min: '5000000', max: '10000000' },
                        { label: '1 - 2 Cr', min: '10000000', max: '20000000' },
                        { label: '2 - 5 Cr', min: '20000000', max: '50000000' },
                        { label: '5 Cr+', min: '50000000', max: '' }
                      ]
                  ).map((preset) => {
                    const isSelected = String(filters.minPrice || '') === String(preset.min) && String(filters.maxPrice || '') === String(preset.max);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          handleChange('minPrice', preset.min);
                          handleChange('maxPrice', preset.max);
                        }}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all border ${
                          isSelected
                            ? 'bg-brand-navy text-brand-yellow border-brand-navy shadow-xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Precision Numeric Inputs (No up/down stepper arrows, zero negative values) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-gray-500 font-bold block mb-1">Min Price (Rs.)</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={filters.minPrice || ''}
                onKeyDown={(e) => {
                  if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9]/g, '');
                  handleChange('minPrice', clean);
                }}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
              {filters.minPrice && formatPriceInWords(filters.minPrice) && (
                <div className="mt-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 leading-tight">
                  {formatPriceInWords(filters.minPrice)}
                </div>
              )}
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-bold block mb-1">Max Price (Rs.)</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Any"
                value={filters.maxPrice || ''}
                onKeyDown={(e) => {
                  if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9]/g, '');
                  handleChange('maxPrice', clean);
                }}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
              {filters.maxPrice && formatPriceInWords(filters.maxPrice) && (
                <div className="mt-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 leading-tight">
                  {formatPriceInWords(filters.maxPrice)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Plot / Property Area */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              Area
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500 font-bold uppercase">Unit:</span>
              <select
                value={filters.areaUnit || 'sq ft'}
                onChange={(e) => handleChange('areaUnit', e.target.value)}
                className="p-1 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-brand-charcoal focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              >
                {AREA_UNIT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-gray-400 font-medium">Min Area ({filters.areaUnit || 'sq ft'})</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={'Enter Min (' + (filters.areaUnit || 'sq ft') + ')'}
                value={filters.minArea || filters.minAreaSqFt || ''}
                onKeyDown={(e) => {
                  if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => handleChange('minArea', e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-medium">Max Area ({filters.areaUnit || 'sq ft'})</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={'Enter Max (' + (filters.areaUnit || 'sq ft') + ')'}
                value={filters.maxArea || filters.maxAreaSqFt || ''}
                onKeyDown={(e) => {
                  if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => handleChange('maxArea', e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
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
              const selected = (filters.amenities || []).some(a => String(a).toLowerCase().trim() === String(amenity).toLowerCase().trim());
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
  </>
  );
}


