// EaseLand Comprehensive Mock Dataset — Pan-India Real Estate Listings

export const INITIAL_PROPERTIES = [
  {
    id: 'prop-101',
    title: 'Gated Community Residential Plot in Vidyanagar',
    propertyType: 'Open Plot',
    category: 'Open Plots',
    purpose: 'buy',
    price: 3200000, // Rs. 32 Lakhs
    priceDisplay: 'Rs. 32 Lakhs',
    area: 1800, // sq ft
    areaDisplay: '1,800 sq ft (40 x 45 ft)',
    facing: 'East',
    roadWidth: '40 Feet',
    cornerPlot: false,
    gatedCommunity: true,
    waterAvailable: true,
    electricityAvailable: true,
    boundaryWall: true,
    status: 'APPROVED_LIVE',
    verificationStatus: 'Platform Verified',
    verifiedDate: '2026-08-15',
    verificationNotes: 'Physical site inspection verified by EaseLand Field Specialist.',
    owner: {
      id: 'usr-1',
      name: 'Ryuu',
      phone: '+91 98765 43210',
      email: 'ryuu@easeland.in',
      verified: true
    },
    location: {
      country: 'India',
      state: 'Andhra Pradesh',
      district: 'Guntur',
      city: 'Guntur',
      mandal: 'Guntur East Mandal',
      locality: 'Vidyanagar',
      subLocality: 'Sector 3',
      village: 'Nallapadu Village',
      road: '10th Lane Main Road',
      colony: 'Vidyanagar Municipal Layout',
      landmark: 'Near Municipal Park',
      doorNo: 'Plot No. 114',
      address: 'Plot No. 114, Sector 3, Vidyanagar 10th Lane, Guntur East Mandal, Guntur, AP - 522007, India',
      lat: 16.3124,
      lng: 80.4285
    },
    // Approved GeoJSON Boundary for public map polygon display
    boundary: [
      [16.3126, 80.4283],
      [16.3126, 80.4287],
      [16.3122, 80.4287],
      [16.3122, 80.4283]
    ],
    boundaryStatus: 'APPROVED',
    photos: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1628624747186-a941c476b7ef?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1592595896551-12b371d546d5?auto=format&fit=crop&w=800&q=80'
    ],
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    droneVideoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    documents: [
      { id: 'doc-1', name: 'Sale Deed (Form 32)', type: 'PDF', status: 'Verified', confidential: true },
      { id: 'doc-2', name: 'Encumbrance Certificate (EC 15 Yrs)', type: 'PDF', status: 'Verified', confidential: true },
      { id: 'doc-3', name: 'Municipal Layout Approval Layout Plan', type: 'PDF', status: 'Verified', confidential: true }
    ],
    amenities: ['Gated Community', '40ft Blacktop Road', 'Underground Drainage', 'Street Lights', '24/7 Water Pipeline', 'Security Guard Gate'],
    nearbyPlaces: [
      { name: 'Vidyanagar Main Road', distance: '150 m', icon: 'road' },
      { name: 'St. Joseph High School', distance: '850 m', icon: 'school' },
      { name: 'Ramesh Multi-specialty Hospital', distance: '1.4 km', icon: 'hospital' },
      { name: 'More Supermarket', distance: '600 m', icon: 'shopping' },
      { name: 'Guntur Junction Railway Station', distance: '4.2 km', icon: 'train' }
    ],
    description: 'Prime East-facing residential plot in Vidyanagar 10th Lane. Clear title with DTCP approved layout, 40-foot wide blacktop roads, underground electricity and drainage already setup. Direct owner sale with zero brokerage.'
  },

  {
    id: 'prop-102',
    title: 'Corner Open Plot near Inner Ring Road',
    propertyType: 'Open Plot',
    category: 'Open Plots',
    purpose: 'buy',
    price: 7500000, // Rs. 75 Lakhs
    priceDisplay: 'Rs. 75 Lakhs',
    area: 3200, // sq ft
    areaDisplay: '3,200 sq ft (50 x 64 ft)',
    facing: 'North-East',
    roadWidth: '60 Feet',
    cornerPlot: true,
    gatedCommunity: false,
    waterAvailable: true,
    electricityAvailable: true,
    boundaryWall: true,
    status: 'APPROVED_LIVE',
    verificationStatus: 'Platform Verified',
    verifiedDate: '2026-08-20',
    verificationNotes: 'Encumbrance Certificate and physical layout boundary verified.',
    owner: {
      id: 'usr-3',
      name: 'Krishna Sai',
      phone: '+91 63006 91560',
      email: 'krishnasai4222@gmail.com',
      verified: true
    },
    location: {
      country: 'India',
      state: 'Andhra Pradesh',
      district: 'Guntur',
      city: 'Guntur',
      mandal: 'Guntur West Mandal',
      locality: 'Inner Ring Road',
      subLocality: 'Gorantla Junction',
      village: 'Gorantla Village',
      road: '100ft Inner Ring Road Bypass',
      colony: 'Gorantla Ring Layout',
      landmark: 'Opposite Shell Petrol Bunk',
      doorNo: 'Plot No. 45',
      address: 'Plot No. 45, 100ft Inner Ring Road Bypass, Gorantla Junction, Guntur West Mandal, Guntur, AP - 522034, India',
      lat: 16.3351,
      lng: 80.4492
    },
    boundary: [
      [16.3353, 80.4490],
      [16.3353, 80.4495],
      [16.3349, 80.4495],
      [16.3349, 80.4490]
    ],
    boundaryStatus: 'APPROVED',
    photos: [
      'https://images.unsplash.com/photo-1628624747186-a941c476b7ef?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'
    ],
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    droneVideoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    documents: [
      { id: 'doc-4', name: 'Registered Sale Deed', type: 'PDF', status: 'Verified', confidential: true },
      { id: 'doc-5', name: 'Pahani & Land Revenue Receipt', type: 'PDF', status: 'Verified', confidential: true }
    ],
    amenities: ['100ft Main Road Facing', 'Corner Plot Advantage', 'Commercial Viability', 'Water Connection', 'Three-phase Electricity'],
    nearbyPlaces: [
      { name: '100ft Inner Ring Road', distance: '20 m', icon: 'road' },
      { name: 'Shell Petrol Station', distance: '100 m', icon: 'fuel' },
      { name: 'KIMS Saveera Hospital', distance: '2.1 km', icon: 'hospital' },
      { name: 'Amaravati Highway Junction', distance: '3.0 km', icon: 'highway' }
    ],
    description: 'High visibility North-East facing corner plot adjacent to 100ft Inner Ring Road. Excellent potential for both commercial development or luxury standalone villa. Direct owner listing.'
  },

  {
    id: 'prop-103',
    title: 'Luxury 3 BHK Villa House in Brodipet',
    propertyType: 'House',
    category: 'Houses',
    purpose: 'buy',
    price: 9500000, // Rs. 95 Lakhs
    priceDisplay: 'Rs. 95 Lakhs',
    area: 2200, // sq ft
    areaDisplay: '2,200 sq ft built-up (2,000 sq ft plot)',
    bedrooms: 3,
    bathrooms: 3,
    floors: 2,
    facing: 'East',
    parking: 'Covered Car Parking',
    furnishing: 'Semi-Furnished',
    propertyAge: '2 Years Old',
    status: 'APPROVED_LIVE',
    verificationStatus: 'Platform Verified',
    verifiedDate: '2026-08-18',
    verificationNotes: 'Building approval plan & tax payment receipts verified.',
    owner: {
      id: 'usr-1',
      name: 'Ryuu',
      phone: '+91 98765 43210',
      email: 'ryuu@easeland.in',
      verified: true
    },
    location: {
      country: 'India',
      state: 'Andhra Pradesh',
      district: 'Guntur',
      city: 'Guntur',
      mandal: 'Guntur Central Mandal',
      locality: 'Brodipet',
      subLocality: '4th Line Corner',
      village: 'Brodipet Ward',
      road: '4th Line Main',
      colony: 'Brodipet Residency Enclave',
      landmark: 'Near Shankar Vilas Centre',
      doorNo: 'Door No. 4-12-89',
      address: 'Door No. 4-12-89, 4th Line Main, Brodipet, Guntur Central Mandal, Guntur, AP - 522002, India',
      lat: 16.3012,
      lng: 80.4367
    },
    photos: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80'
    ],
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    documents: [
      { id: 'doc-6', name: 'Building Permit Plan (Guntur Municipal)', type: 'PDF', status: 'Verified', confidential: true },
      { id: 'doc-7', name: 'Property Tax Receipt 2025-26', type: 'PDF', status: 'Verified', confidential: true }
    ],
    amenities: ['Teakwood Main Door', 'Modular Kitchen', 'Solar Water Heater', 'CCTV Security', 'Borewell & Municipal Water', 'Inverter Power Backup'],
    nearbyPlaces: [
      { name: 'Shankar Vilas Center', distance: '400 m', icon: 'shopping' },
      { name: 'Government General Hospital', distance: '1.2 km', icon: 'hospital' },
      { name: 'Hindu College', distance: '900 m', icon: 'school' }
    ],
    description: 'Beautiful G+1 independent house with teakwood interior work, spacious living room, modular kitchen, and private terrace garden in prime Brodipet.'
  },

  {
    id: 'prop-104',
    title: '3 BHK Modern Apartment in Whitefield',
    propertyType: 'Apartment',
    category: 'Apartments',
    purpose: 'buy',
    price: 12500000, // Rs. 1.25 Crores
    priceDisplay: 'Rs. 1.25 Crores',
    area: 1650,
    areaDisplay: '1,650 sq ft super built-up',
    bedrooms: 3,
    bathrooms: 3,
    floor: '4th of 12 Floors',
    facing: 'North',
    parking: '2 Covered Car Spaces',
    furnishing: 'Fully Furnished',
    propertyAge: '1 Year Old',
    status: 'APPROVED_LIVE',
    verificationStatus: 'Platform Verified',
    verifiedDate: '2026-08-22',
    verificationNotes: 'BBMP Khata A certified property documents checked.',
    owner: {
      id: 'usr-4',
      name: 'KrishnaSai Kannasani',
      phone: '+91 95022 64269',
      email: 'krishnasai8999@gmail.com',
      verified: true
    },
    location: {
      country: 'India',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      city: 'Bengaluru',
      mandal: 'Bengaluru East Taluk',
      locality: 'Whitefield',
      subLocality: 'ITPL Main Road',
      village: 'Pattandur Agrahara Village',
      road: 'ECC Road',
      colony: 'Oakwood Enclave',
      landmark: 'Near Pattandur Agrahara Metro Station',
      doorNo: 'Flat 402',
      address: 'Flat 402, Oakwood Towers, ECC Road, Whitefield, Bengaluru East Taluk, Bengaluru, KA - 560066, India',
      lat: 12.9698,
      lng: 77.7499
    },
    photos: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'
    ],
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    documents: [
      { id: 'doc-8', name: 'BBMP A Khata Certificate', type: 'PDF', status: 'Verified', confidential: true },
      { id: 'doc-9', name: 'Occupancy Certificate (OC)', type: 'PDF', status: 'Verified', confidential: true }
    ],
    amenities: ['Clubhouse & Pool', 'Gym & Squash Court', '24/7 Power Backup', 'EV Charging Station', 'Gated Security', 'Landscaped Gardens'],
    nearbyPlaces: [
      { name: 'Pattandur Agrahara Metro', distance: '350 m', icon: 'train' },
      { name: 'ITPL Tech Park', distance: '1.1 km', icon: 'office' },
      { name: 'Manipal Hospital Whitefield', distance: '1.8 km', icon: 'hospital' }
    ],
    description: 'High-floor 3 BHK apartment in premium high-rise community with Italian marble flooring, zero wastage layout, and close proximity to IT parks.'
  },

  {
    id: 'prop-105',
    title: 'Spacious 2 BHK Rental Apartment in Indiranagar',
    propertyType: 'Rental Apartment',
    category: 'Rentals',
    purpose: 'rent',
    price: 38000, // Rs. 38,000 / month
    priceDisplay: 'Rs. 38,000 / month',
    deposit: 'Rs. 2.0 Lakhs Deposit',
    area: 1200,
    areaDisplay: '1,200 sq ft',
    bedrooms: 2,
    bathrooms: 2,
    floor: '2nd Floor',
    facing: 'East',
    parking: '1 Reserved Car Slot',
    furnishing: 'Fully Furnished',
    tenantPreference: 'Families / Working Professionals',
    status: 'APPROVED_LIVE',
    verificationStatus: 'Platform Verified',
    verifiedDate: '2026-08-25',
    verificationNotes: 'Property ownership verified directly with owner.',
    owner: {
      id: 'usr-1',
      name: 'Ryuu',
      phone: '+91 98765 43210',
      email: 'ryuu@easeland.in',
      verified: true
    },
    location: {
      country: 'India',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      city: 'Bengaluru',
      mandal: 'Bengaluru North Taluk',
      locality: 'Indiranagar',
      subLocality: '100ft Road Block 2',
      village: 'Halasuru Village',
      road: '12th Main Road',
      colony: 'Sunshine Colony',
      landmark: 'Near Toit Microbrewery',
      doorNo: 'Flat 2B',
      address: 'Flat 2B, Sunshine Residency, 12th Main, Indiranagar, Bengaluru North Taluk, Bengaluru, KA - 560038, India',
      lat: 12.9784,
      lng: 77.6408
    },
    photos: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80'
    ],
    documents: [
      { id: 'doc-10', name: 'Property Title Proof', type: 'PDF', status: 'Verified', confidential: true }
    ],
    amenities: ['High Speed Fiber Wi-Fi Ready', 'AC in Bedrooms', 'Washing Machine', 'Refrigerator', 'Lift & Power Backup', 'Balcony Garden'],
    nearbyPlaces: [
      { name: '100ft Road Metro Station', distance: '400 m', icon: 'train' },
      { name: 'Indiranagar Club', distance: '600 m', icon: 'park' }
    ],
    description: 'Elegantly furnished 2 BHK apartment in prime Indiranagar. Features double balconies, wooden wardrobes, modern kitchen appliances, and quiet tree-lined street location.'
  },

  {
    id: 'prop-106',
    title: 'Prime Gachibowli Open Plot for Villa',
    propertyType: 'Open Plot',
    category: 'Open Plots',
    purpose: 'buy',
    price: 18000000, // Rs. 1.80 Crores
    priceDisplay: 'Rs. 1.80 Crores',
    area: 2400, // sq ft (300 sq yds)
    areaDisplay: '2,400 sq ft (300 sq yards)',
    facing: 'North',
    roadWidth: '50 Feet',
    cornerPlot: false,
    gatedCommunity: true,
    waterAvailable: true,
    electricityAvailable: true,
    boundaryWall: true,
    status: 'APPROVED_LIVE',
    verificationStatus: 'Platform Verified',
    verifiedDate: '2026-08-28',
    verificationNotes: 'HMDA Approved layout plot verified.',
    owner: {
      id: 'usr-1',
      name: 'Ryuu',
      phone: '+91 98765 43210',
      email: 'ryuu@easeland.in',
      verified: true
    },
    location: {
      country: 'India',
      state: 'Telangana',
      district: 'Ranga Reddy',
      city: 'Hyderabad',
      mandal: 'Serilingampally Mandal',
      locality: 'Gachibowli',
      subLocality: 'Financial District Sector 2',
      village: 'Gachibowli Village',
      road: 'Wipro Circle Road',
      colony: 'HMDA Financial Layout',
      landmark: 'Near Continental Hospital',
      doorNo: 'Plot No. 88',
      address: 'Plot No. 88, HMDA Layout, Wipro Circle Road, Gachibowli, Serilingampally Mandal, Hyderabad, TS - 500032, India',
      lat: 17.4401,
      lng: 78.3489
    },
    boundary: [
      [17.4403, 78.3487],
      [17.4403, 78.3491],
      [17.4399, 78.3491],
      [17.4399, 78.3487]
    ],
    boundaryStatus: 'APPROVED',
    photos: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80'
    ],
    documents: [
      { id: 'doc-11', name: 'HMDA Layout Clearance Certificate', type: 'PDF', status: 'Verified', confidential: true }
    ],
    amenities: ['HMDA Approved', 'Underground Cabling', 'Clubhouse Membership', 'Avenue Plantation', '24/7 Gated Security'],
    nearbyPlaces: [
      { name: 'Wipro Circle', distance: '800 m', icon: 'office' },
      { name: 'Continental Hospital', distance: '1.2 km', icon: 'hospital' }
    ],
    description: '300 sq yard HMDA approved plot in gated enclave in Financial District Gachibowli. Ideal for luxury custom villa construction.'
  }
];

export const INITIAL_ENQUIRIES = [];

export const INITIAL_DEALS = [];

export const INITIAL_FOLLOW_UPS = [];
