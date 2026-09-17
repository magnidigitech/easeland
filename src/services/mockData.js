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
