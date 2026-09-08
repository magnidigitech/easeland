/**
 * EaseLand Property Specifications & Amenities Centralized Configuration (Block 10)
 * Pan-India, property-type-aware, 0 defaults, 0 preselected amenities.
 */

export const AreaUnit = {
  SQ_FT: 'sq ft',
  SQ_YDS: 'sq yds',
  ACRES: 'acres',
  CENTS: 'cents',
  GUNTAS: 'guntas'
};

export const FacingDirection = {
  EAST: 'East',
  NORTH: 'North',
  WEST: 'West',
  SOUTH: 'South',
  NORTH_EAST: 'North-East',
  SOUTH_EAST: 'South-East',
  NORTH_WEST: 'North-West',
  SOUTH_WEST: 'South-West'
};

export const FurnishingStatus = {
  UNFURNISHED: 'Unfurnished',
  SEMI_FURNISHED: 'Semi-Furnished',
  FULLY_FURNISHED: 'Fully Furnished'
};

export const PropertyAge = {
  UNDER_CONSTRUCTION: 'Under Construction',
  NEW_CONSTRUCTION: 'New (0-1 Years)',
  ONE_TO_FIVE_YEARS: '1-5 Years',
  FIVE_TO_TEN_YEARS: '5-10 Years',
  TEN_PLUS_YEARS: '10+ Years'
};

export const ParkingType = {
  COVERED_CAR: 'Covered Car Parking',
  OPEN_CAR: 'Open Car Parking',
  TWO_WHEELER: 'Two Wheeler Only',
  NONE: 'No Dedicated Parking'
};

export const TenantPreference = {
  FAMILY_AND_WORKING: 'Families & Working Professionals',
  BACHELORS_STUDENTS: 'Bachelors / Students',
  ANY_SUITABLE: 'Any Suitable Tenant'
};

/**
 * Normalized Canonical Amenities Registry
 */
export const CANONICAL_AMENITIES = [
  { id: 'SECURITY_24X7', label: '24/7 Security Guards', category: 'Security' },
  { id: 'CCTV_SURVEILLANCE', label: 'CCTV Camera Surveillance', category: 'Security' },
  { id: 'GATED_COMMUNITY', label: 'Gated Community Layout', category: 'Security' },
  { id: 'WATER_SUPPLY_24X7', label: '24/7 Municipal & Borewell Water', category: 'Utilities' },
  { id: 'POWER_BACKUP', label: '100% Generator Power Backup', category: 'Utilities' },
  { id: 'LIFT_ELEVATOR', label: 'High-Speed Elevators / Lifts', category: 'Building' },
  { id: 'COVERED_PARKING', label: 'Reserved Covered Car Parking', category: 'Building' },
  { id: 'CORNER_PLOT', label: 'Corner Plot (Dual Approach Road)', category: 'Plot' },
  { id: 'BOUNDARY_WALL', label: 'Compound / Boundary Wall Built', category: 'Plot' },
  { id: 'WIDE_APPROACH_ROAD', label: 'Wide Blacktop Approach Road', category: 'Plot' },
  { id: 'CLUBHOUSE', label: 'Residents Clubhouse & Event Hall', category: 'Lifestyle' },
  { id: 'GYMNASIUM', label: 'Equipped Fitness Gym', category: 'Lifestyle' },
  { id: 'SWIMMING_POOL', label: 'Swimming Pool', category: 'Lifestyle' },
  { id: 'CHILDREN_PLAY_AREA', label: 'Children’s Play Area & Park', category: 'Lifestyle' },
  { id: 'HIGH_SPEED_INTERNET', label: 'Fiber Broadband Internet Ready', category: 'Utilities' },
  { id: 'CENTRAL_AC', label: 'Central Air Conditioning', category: 'Commercial' },
  { id: 'FIRE_SAFETY_SYSTEM', label: 'Fire Hydrant & Safety System', category: 'Commercial' }
];

/**
 * Property-Type-Aware Specifications Config Evaluator
 */
export function getApplicableSpecificationFields(propertyType, purpose) {
  const isLandOrPlot = propertyType === 'OPEN_PLOT' || propertyType === 'LAND';
  const isResidentialStructure = propertyType === 'HOUSE' || propertyType === 'APARTMENT' || propertyType === 'VILLA' || propertyType === 'RENTAL';
  const isCommercial = propertyType === 'COMMERCIAL';
  const isRental = purpose === 'RENT' || purpose === 'LEASE' || propertyType === 'RENTAL';

  return {
    showFacing: true,
    showApproachRoadWidth: isLandOrPlot || propertyType === 'HOUSE' || isCommercial,
    showBedroomsBathrooms: isResidentialStructure,
    showBalconies: propertyType === 'APARTMENT' || propertyType === 'HOUSE' || propertyType === 'VILLA',
    showFurnishing: isResidentialStructure || isCommercial,
    showPropertyAge: !isLandOrPlot,
    showFloorDetails: propertyType === 'APARTMENT' || isCommercial,
    showTotalFloors: propertyType === 'HOUSE' || propertyType === 'VILLA' || propertyType === 'APARTMENT' || isCommercial,
    showParkingType: isResidentialStructure || isCommercial,
    showRentalFields: isRental,
    showPlotSpecifics: isLandOrPlot
  };
}
