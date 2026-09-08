import React from 'react';
import { Sliders, CheckCircle2, AlertCircle, Building, ShieldCheck, Tag, Info } from 'lucide-react';
import {
  AreaUnit,
  FacingDirection,
  FurnishingStatus,
  PropertyAge,
  ParkingType,
  TenantPreference,
  CANONICAL_AMENITIES,
  getApplicableSpecificationFields
} from '../firebase/specificationsConfig.js';

export default function PropertySpecificationsStep({
  propertyType = 'OPEN_PLOT',
  purpose = 'SALE',
  specsData = {},
  selectedAmenities = [],
  onChangeSpecs,
  onChangeAmenities
}) {
  const fieldsConfig = getApplicableSpecificationFields(propertyType, purpose);

  const handleFieldChange = (key, val) => {
    onChangeSpecs({
      ...specsData,
      [key]: val
    });
  };

  const handleAmenityToggle = (amenityId) => {
    if (selectedAmenities.includes(amenityId)) {
      onChangeAmenities(selectedAmenities.filter(id => id !== amenityId));
    } else {
      onChangeAmenities([...selectedAmenities, amenityId]);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-brand-charcoal flex items-center gap-2">
            <Sliders className="w-5 h-5 text-brand-yellow" />
            <span>Specifications & Amenities</span>
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Dynamically customized for <span className="font-extrabold text-brand-charcoal">{propertyType} ({purpose})</span>.
          </p>
        </div>
        <span className="text-[10px] font-mono uppercase bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg font-bold">
          Type Aware
        </span>
      </div>

      {/* SPECIFICATIONS GROUP */}
      <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-200 space-y-4">
        <h4 className="text-xs font-black uppercase tracking-wider text-gray-700">
          Property Specifications
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* AREA UNIT SELECTOR */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Measurement Area Unit</label>
            <select
              value={specsData.areaUnit || AreaUnit.SQ_FT}
              onChange={(e) => handleFieldChange('areaUnit', e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
            >
              {Object.values(AreaUnit).map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          {/* FACING DIRECTION */}
          {fieldsConfig.showFacing && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Facing Direction</label>
              <select
                value={specsData.facing || ''}
                onChange={(e) => handleFieldChange('facing', e.target.value)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
              >
                <option value="">-- Select Facing (Optional) --</option>
                {Object.values(FacingDirection).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}

          {/* APPROACH ROAD WIDTH */}
          {fieldsConfig.showApproachRoadWidth && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Approach Road Width</label>
              <input
                type="text"
                placeholder="e.g. 40 Feet Blacktop Road"
                value={specsData.roadWidth || ''}
                onChange={(e) => handleFieldChange('roadWidth', e.target.value)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
              />
            </div>
          )}

          {/* PROPERTY AGE */}
          {fieldsConfig.showPropertyAge && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Property Age / Status</label>
              <select
                value={specsData.propertyAge || ''}
                onChange={(e) => handleFieldChange('propertyAge', e.target.value)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
              >
                <option value="">-- Select Age Category (Optional) --</option>
                {Object.values(PropertyAge).map(age => (
                  <option key={age} value={age}>{age}</option>
                ))}
              </select>
            </div>
          )}

          {/* BEDROOMS COUNT */}
          {fieldsConfig.showBedroomsBathrooms && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Bedrooms (BHK)</label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 3"
                value={specsData.bedrooms ?? ''}
                onChange={(e) => handleFieldChange('bedrooms', e.target.value ? Math.max(0, parseInt(e.target.value)) : null)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
              />
            </div>
          )}

          {/* BATHROOMS COUNT */}
          {fieldsConfig.showBedroomsBathrooms && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Bathrooms</label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 3"
                value={specsData.bathrooms ?? ''}
                onChange={(e) => handleFieldChange('bathrooms', e.target.value ? Math.max(0, parseInt(e.target.value)) : null)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
              />
            </div>
          )}

          {/* BALCONIES COUNT */}
          {fieldsConfig.showBalconies && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Balconies</label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 2"
                value={specsData.balconies ?? ''}
                onChange={(e) => handleFieldChange('balconies', e.target.value ? Math.max(0, parseInt(e.target.value)) : null)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
              />
            </div>
          )}

          {/* FURNISHING STATUS */}
          {fieldsConfig.showFurnishing && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Furnishing Status</label>
              <select
                value={specsData.furnishing || ''}
                onChange={(e) => handleFieldChange('furnishing', e.target.value)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
              >
                <option value="">-- Select Furnishing (Optional) --</option>
                {Object.values(FurnishingStatus).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}

          {/* PARKING TYPE */}
          {fieldsConfig.showParkingType && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Parking Availability</label>
              <select
                value={specsData.parkingType || ''}
                onChange={(e) => handleFieldChange('parkingType', e.target.value)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
              >
                <option value="">-- Select Parking Type (Optional) --</option>
                {Object.values(ParkingType).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}

          {/* FLOOR NUMBER & TOTAL FLOORS */}
          {fieldsConfig.showFloorDetails && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Property Floor Number</label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 4"
                value={specsData.floorNumber ?? ''}
                onChange={(e) => handleFieldChange('floorNumber', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
              />
            </div>
          )}

          {fieldsConfig.showTotalFloors && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Total Building Floors</label>
              <input
                type="number"
                min={1}
                placeholder="e.g. 5"
                value={specsData.totalFloors ?? ''}
                onChange={(e) => handleFieldChange('totalFloors', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
              />
            </div>
          )}

        </div>

        {/* 3-STATE BOOLEAN CHARACTERISTICS (UNSET / TRUE / FALSE) */}
        <div className="pt-3 border-t border-gray-200/80 space-y-3">
          <span className="block text-xs font-black uppercase tracking-wider text-gray-600">
            Property Characteristics (3-State Explicit Values)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'gatedCommunity', label: 'Gated Community Layout' },
              { key: 'cornerPlot', label: 'Corner Plot Advantage' },
              { key: 'boundaryWall', label: 'Boundary Wall Built' },
              { key: 'waterAvailable', label: 'Water Connection Available' },
              { key: 'electricityAvailable', label: 'Electricity Connection Available' }
            ].map(item => {
              const currentVal = specsData[item.key]; // null / undefined (UNSET), true, false
              return (
                <div key={item.key} className="bg-white p-3 rounded-xl border border-gray-200 space-y-1.5">
                  <span className="block text-xs font-bold text-gray-700">{item.label}</span>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={item.key}
                        checked={currentVal === null || currentVal === undefined}
                        onChange={() => handleFieldChange(item.key, null)}
                        className="w-3.5 h-3.5 text-gray-400"
                      />
                      <span className="text-gray-500">Unset</span>
                    </label>

                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={item.key}
                        checked={currentVal === true}
                        onChange={() => handleFieldChange(item.key, true)}
                        className="w-3.5 h-3.5 text-emerald-600"
                      />
                      <span className="text-emerald-700 font-extrabold">Yes</span>
                    </label>

                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={item.key}
                        checked={currentVal === false}
                        onChange={() => handleFieldChange(item.key, false)}
                        className="w-3.5 h-3.5 text-red-500"
                      />
                      <span className="text-red-700 font-extrabold">No</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* NORMALIZED AMENITIES SELECTION */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-brand-charcoal flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-yellow" />
              <span>Select Amenities ({selectedAmenities.length} Selected)</span>
            </h4>
            <span className="text-[11px] text-gray-500 font-medium block mt-0.5">
              0 default selections. Toggle amenities explicitly provided by property owner.
            </span>
          </div>

          {selectedAmenities.length > 0 && (
            <button
              type="button"
              onClick={() => onChangeAmenities([])}
              className="text-xs font-bold text-red-600 hover:text-red-700"
            >
              Clear All
            </button>
          )}
        </div>

        {/* AMENITY BADGES GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {CANONICAL_AMENITIES.map(amenity => {
            const isSelected = selectedAmenities.includes(amenity.id);
            return (
              <button
                key={amenity.id}
                type="button"
                onClick={() => handleAmenityToggle(amenity.id)}
                className={`p-3 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-brand-charcoal text-brand-yellow border-brand-charcoal shadow-sm scale-[1.02]'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <span>{amenity.label}</span>
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                  isSelected ? 'bg-brand-yellow text-brand-charcoal border-brand-yellow font-black' : 'border-gray-300'
                }`}>
                  {isSelected ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
