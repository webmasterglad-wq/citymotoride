export interface LatLng {
  lat: number;
  lng: number;
}

export interface ServiceZone {
  id: string;
  name: string;
  hindiName: string;
  punjabiName: string;
  tagline: string;
  color: string;
  fillColor: string;
  borderColor: string;
  center: LatLng;
  zoom: number;
  activeCaptains: number;
  surgeMultiplier: number;
  popularPickups: string[];
  popularDropoffs: string[];
  polygon: LatLng[];
}

/**
 * Centroid Coordinates for Tricity & Surrounding Regions
 */
export const TRICITY_CENTROID: LatLng = { lat: 30.7180, lng: 76.7650 };

/**
 * 6 Primary Service Area Zones
 * Zirakpur, Chandigarh, Panchkula, Manimajra, Mohali, Kharar
 */
export const SERVICE_ZONES: Record<string, ServiceZone> = {
  chandigarh: {
    id: 'chandigarh',
    name: 'Chandigarh',
    hindiName: 'चंडीगढ़',
    punjabiName: 'ਚੰਡੀਗੜ੍ਹ',
    tagline: 'The City Beautiful · Sectors 1-63',
    color: '#10b981', // Emerald
    fillColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10b981',
    center: { lat: 30.7333, lng: 76.7794 },
    zoom: 13,
    activeCaptains: 142,
    surgeMultiplier: 1.0,
    popularPickups: [
      'Sector 17 Plaza, Chandigarh',
      'Sukhna Lake Promenade, Sector 1',
      'Sector 35 Market, Aroma Chowk',
      'Elante Mall, Industrial Area Phase 1',
      'ISBT Sector 43, Chandigarh',
      'PGIMER & Panjab University, Sector 12',
      'Sector 22 Shastri Market',
      'IT Park, DLF Cybercity Chandigarh',
    ],
    popularDropoffs: [
      'Elante Mall, Industrial Area Phase 1',
      'Sector 17 Plaza, Chandigarh',
      'Sukhna Lake Promenade, Sector 1',
      'Sector 35 Market, Aroma Chowk',
      'ISBT Sector 43, Chandigarh',
      'Chandigarh Railway Station, Daria',
    ],
    polygon: [
      { lat: 30.7680, lng: 76.7720 }, // Capitol Complex / Sec 1
      { lat: 30.7480, lng: 76.8180 }, // Sukhna Lake / IT Park border
      { lat: 30.7120, lng: 76.8150 }, // Industrial Area / Railway border
      { lat: 30.6980, lng: 76.7820 }, // Sec 48 / 49 border
      { lat: 30.7100, lng: 76.7320 }, // Sec 51 / Mohali border
      { lat: 30.7380, lng: 76.7450 }, // Sec 38 / 39
      { lat: 30.7620, lng: 76.7550 }, // Sec 12 PGI
    ],
  },

  mohali: {
    id: 'mohali',
    name: 'Mohali (SAS Nagar)',
    hindiName: 'मोहाली',
    punjabiName: 'ਮੋਹਾਲੀ',
    tagline: 'Tech & Sports Hub · Phases 1-11 & Aerocity',
    color: '#0ea5e9', // Sky Blue
    fillColor: 'rgba(14, 165, 233, 0.12)',
    borderColor: '#0ea5e9',
    center: { lat: 30.7046, lng: 76.7179 },
    zoom: 13,
    activeCaptains: 118,
    surgeMultiplier: 1.1,
    popularPickups: [
      'Phase 7 Market & Food Court, Mohali',
      'Phase 3B2 Chowk & Market, Mohali',
      'PCA International Cricket Stadium, Sector 63',
      'Bestech Square Mall, Sector 66',
      'QuarkCity IT SEZ, Industrial Area Phase 8',
      'Sector 70 Residential Complex, Mohali',
      'VR Punjab Mall (North Country), Kharar Road',
      'Chandigarh International Airport Road, Mohali',
    ],
    popularDropoffs: [
      'Bestech Square Mall, Sector 66',
      'Phase 7 Market & Food Court, Mohali',
      'Phase 3B2 Chowk & Market, Mohali',
      'QuarkCity IT SEZ, Industrial Area Phase 8',
      'Shaheed Bhagat Singh Int. Airport, Mohali',
      'PCA Stadium, Sector 63',
    ],
    polygon: [
      { lat: 30.7380, lng: 76.7450 }, // Phase 1 / Sec 39 border
      { lat: 30.7100, lng: 76.7320 }, // Sec 51 border
      { lat: 30.6850, lng: 76.7480 }, // Phase 11 / Sec 65
      { lat: 30.6480, lng: 76.7350 }, // Sector 82 / Aerocity
      { lat: 30.6550, lng: 76.6900 }, // Airport Road south
      { lat: 30.6950, lng: 76.6850 }, // Phase 8 / QuarkCity
      { lat: 30.7300, lng: 76.7020 }, // Phase 6 / Kharar border
    ],
  },

  panchkula: {
    id: 'panchkula',
    name: 'Panchkula',
    hindiName: 'पंचकूला',
    punjabiName: 'ਪੰਚਕੂਲਾ',
    tagline: 'Planned Foothill District · Sectors 1-28 & MDC',
    color: '#8b5cf6', // Violet
    fillColor: 'rgba(139, 92, 246, 0.12)',
    borderColor: '#8b5cf6',
    center: { lat: 30.6942, lng: 76.8606 },
    zoom: 13,
    activeCaptains: 84,
    surgeMultiplier: 1.0,
    popularPickups: [
      'Sector 5 Major Town Park & Market, Panchkula',
      'Mansa Devi Complex (MDC) Sector 4, Panchkula',
      'Sector 20 Market & HUDA Complex, Panchkula',
      'Amartex Chowk, Industrial Area Phase 1, Panchkula',
      'Sector 8 & 9 Gourmet Market, Panchkula',
      'Nada Sahib Gurudwara, Panchkula',
      'Sector 14 Govt College Road, Panchkula',
    ],
    popularDropoffs: [
      'Sector 5 Major Town Park & Market, Panchkula',
      'Sector 20 Market & HUDA Complex, Panchkula',
      'Mansa Devi Complex (MDC) Sector 4, Panchkula',
      'Amartex Chowk, Panchkula',
      'Command Hospital, Sector 6, Panchkula',
      'Nada Sahib Gurudwara, Panchkula',
    ],
    polygon: [
      { lat: 30.7350, lng: 76.8450 }, // MDC / Mansa Devi foothills
      { lat: 30.7250, lng: 76.8900 }, // Sec 3 / Ghaggar River
      { lat: 30.6800, lng: 76.8950 }, // Sec 25 / 26
      { lat: 30.6600, lng: 76.8600 }, // Sec 20 / Zirakpur border
      { lat: 30.6750, lng: 76.8320 }, // Industrial Area / Sec 19
      { lat: 30.7100, lng: 76.8380 }, // Housing Board border
    ],
  },

  zirakpur: {
    id: 'zirakpur',
    name: 'Zirakpur',
    hindiName: 'जीरकपुर',
    punjabiName: 'ਜ਼ੀਰਕਪੁਰ',
    tagline: 'Gateway Hub · VIP Road & Patiala Highway',
    color: '#f59e0b', // Amber
    fillColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#f59e0b',
    center: { lat: 30.6425, lng: 76.8173 },
    zoom: 13,
    activeCaptains: 96,
    surgeMultiplier: 1.15,
    popularPickups: [
      'VIP Road Shopping Plaza, Zirakpur',
      'Patiala Highway Chowk, Zirakpur',
      'Dhakoli Railway Crossing Road, Zirakpur',
      'Cosmo Mall & Ambala Highway, Zirakpur',
      'Maya Garden City, Nagla Road, Zirakpur',
      'Baltana Main Market & Chowk, Zirakpur',
      'Peer Muchalla Commercial Complex, Zirakpur',
      'Singhpura Chowk, Zirakpur',
    ],
    popularDropoffs: [
      'VIP Road Shopping Plaza, Zirakpur',
      'Cosmo Mall, Chandigarh-Ambala Highway',
      'Patiala Highway Chowk, Zirakpur',
      'Dhakoli Market, Zirakpur',
      'Elante Mall (via Tribune Flyover)',
      'Chandigarh Int. Airport Terminal',
    ],
    polygon: [
      { lat: 30.6650, lng: 76.8000 }, // Tribune / Airport road link
      { lat: 30.6600, lng: 76.8500 }, // Baltana / Panchkula Sec 19
      { lat: 30.6350, lng: 76.8600 }, // Peer Muchalla / Dhakoli
      { lat: 30.6150, lng: 76.8250 }, // Ambala Highway Toll
      { lat: 30.6200, lng: 76.7900 }, // High Ground / Patiala Highway
      { lat: 30.6500, lng: 76.7850 }, // Airport boundary
    ],
  },

  kharar: {
    id: 'kharar',
    name: 'Kharar',
    hindiName: 'खरड़',
    punjabiName: 'ਖਰੜ',
    tagline: 'Student & Expressway Corridor · Sunny Enclave & CU',
    color: '#ec4899', // Pink
    fillColor: 'rgba(236, 72, 153, 0.12)',
    borderColor: '#ec4899',
    center: { lat: 30.7499, lng: 76.6411 },
    zoom: 13,
    activeCaptains: 76,
    surgeMultiplier: 1.05,
    popularPickups: [
      'Kharar Bus Stand & Flyover, Kharar',
      'Sunny Enclave Main Market, Sector 125 Kharar',
      'Chandigarh University (CU) Main Gate, Gharuan-Kharar',
      'Landran Chowk & CGC Campus, Kharar-Banur Road',
      'Desu Majra Commercial Hub, Kharar',
      'Gillco Valley Township, Sector 127 Kharar',
      'Kharar Railway Station Road',
    ],
    popularDropoffs: [
      'Chandigarh University (CU) Main Gate',
      'Sunny Enclave Main Market, Kharar',
      'Kharar Bus Stand & Flyover',
      'Landran Chowk (CGC College)',
      'VR Punjab Mall, Mohali-Kharar Highway',
      'Phase 7 Market, Mohali',
    ],
    polygon: [
      { lat: 30.7850, lng: 76.6200 }, // North Sunny Enclave
      { lat: 30.7700, lng: 76.6750 }, // Toward Sec 127 / Gillco
      { lat: 30.7300, lng: 76.6850 }, // VR Punjab / Mohali Phase 6 border
      { lat: 30.6900, lng: 76.6600 }, // Landran Chowk CGC
      { lat: 30.7200, lng: 76.6000 }, // CU Gharuan corridor
      { lat: 30.7600, lng: 76.6100 }, // Kharar Bus Stand west
    ],
  },

  manimajra: {
    id: 'manimajra',
    name: 'Manimajra',
    hindiName: 'मणिमाजरा',
    punjabiName: 'ਮਣੀਮਾਜਰਾ',
    tagline: 'Historic Gateway & Auto Market · Modern Housing & IT Park',
    color: '#06b6d4', // Cyan
    fillColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: '#06b6d4',
    center: { lat: 30.7225, lng: 76.8378 },
    zoom: 14,
    activeCaptains: 62,
    surgeMultiplier: 1.0,
    popularPickups: [
      'Manimajra Motor Market, Main Road',
      'Modern Housing Complex (MHC), Manimajra',
      'Housing Board Chowk (Chandigarh-Panchkula Link)',
      'Fun Republic Mall & Multiplex, Manimajra',
      'Chandigarh IT Park Main Gate (Manimajra Border)',
      'Old Ropar Road & Shanti Nagar, Manimajra',
      'Subhash Nagar Market, Manimajra',
      'Mansadevi Railway Overbridge, Manimajra',
    ],
    popularDropoffs: [
      'Fun Republic Mall, Manimajra',
      'Housing Board Chowk, Manimajra',
      'Modern Housing Complex (MHC), Manimajra',
      'Chandigarh IT Park, Kishangarh Rd',
      'Sector 5 Town Park, Panchkula',
      'Sector 17 Plaza, Chandigarh',
    ],
    polygon: [
      { lat: 30.7380, lng: 76.8250 }, // Kishangarh / IT Park border
      { lat: 30.7350, lng: 76.8480 }, // MDC border
      { lat: 30.7150, lng: 76.8520 }, // Old Panchkula bridge
      { lat: 30.7080, lng: 76.8320 }, // Railway Colony / Sec 26 Ext
      { lat: 30.7200, lng: 76.8200 }, // Transport Chowk link
    ],
  },
};

/**
 * Unified Outer Geofence Perimeter surrounding all 6 service regions
 */
export const TRICITY_OUTER_PERIMETER: LatLng[] = [
  { lat: 30.7850, lng: 76.6200 }, // North Kharar
  { lat: 30.7800, lng: 76.7500 }, // North Chandigarh PGI
  { lat: 30.7680, lng: 76.7720 }, // Capitol Complex
  { lat: 30.7480, lng: 76.8180 }, // Sukhna Lake
  { lat: 30.7350, lng: 76.8900 }, // Mansa Devi / Panchkula Foothills
  { lat: 30.6800, lng: 76.8950 }, // East Panchkula Sec 26
  { lat: 30.6350, lng: 76.8600 }, // East Zirakpur Dhakoli
  { lat: 30.6150, lng: 76.8250 }, // South Zirakpur Ambala Toll
  { lat: 30.6200, lng: 76.7900 }, // South Zirakpur Patiala Hwy
  { lat: 30.6480, lng: 76.7350 }, // South Mohali Aerocity
  { lat: 30.6550, lng: 76.6900 }, // Airport Road South
  { lat: 30.6900, lng: 76.6600 }, // Landran Chowk
  { lat: 30.7200, lng: 76.6000 }, // CU Gharuan
];

/**
 * Pre-defined coordinates for popular local landmarks across all 6 service regions
 */
export const KNOWN_LOCATIONS: Record<string, LatLng> = {
  // === CHANDIGARH ===
  'Sector 17 Plaza, Chandigarh': { lat: 30.7398, lng: 76.7827 },
  'Sukhna Lake Promenade, Sector 1': { lat: 30.7421, lng: 76.8178 },
  'Sector 35 Market, Aroma Chowk': { lat: 30.7235, lng: 76.7661 },
  'Elante Mall, Industrial Area Phase 1': { lat: 30.7055, lng: 76.8013 },
  'ISBT Sector 43, Chandigarh': { lat: 30.7180, lng: 76.7489 },
  'PGIMER & Panjab University, Sector 12': { lat: 30.7645, lng: 76.7760 },
  'Sector 22 Shastri Market': { lat: 30.7305, lng: 76.7725 },
  'IT Park, DLF Cybercity Chandigarh': { lat: 30.7289, lng: 76.8421 },
  'Sector 8 Inner Market, Chandigarh': { lat: 30.7445, lng: 76.7950 },
  'Sector 26 Timber Market / Grain Market': { lat: 30.7260, lng: 76.8080 },
  'Chandigarh Railway Station, Daria': { lat: 30.7050, lng: 76.8280 },

  // === MOHALI ===
  'Phase 7 Market & Food Court, Mohali': { lat: 30.7088, lng: 76.7135 },
  'Phase 3B2 Chowk & Market, Mohali': { lat: 30.7160, lng: 76.7245 },
  'PCA International Cricket Stadium, Sector 63': { lat: 30.6908, lng: 76.7375 },
  'Bestech Square Mall, Sector 66': { lat: 30.6780, lng: 76.7325 },
  'QuarkCity IT SEZ, Industrial Area Phase 8': { lat: 30.7020, lng: 76.6980 },
  'Sector 70 Residential Complex, Mohali': { lat: 30.6985, lng: 76.7190 },
  'VR Punjab Mall (North Country), Kharar Road': { lat: 30.7345, lng: 76.6850 },
  'Chandigarh International Airport Road, Mohali': { lat: 30.6550, lng: 76.7450 },
  'Shaheed Bhagat Singh Int. Airport, Mohali': { lat: 30.6730, lng: 76.7885 },
  'Fortis Hospital, Sector 62 Mohali': { lat: 30.6970, lng: 76.7330 },

  // === PANCHKULA ===
  'Sector 5 Major Town Park & Market, Panchkula': { lat: 30.6935, lng: 76.8585 },
  'Mansa Devi Complex (MDC) Sector 4, Panchkula': { lat: 30.7280, lng: 76.8520 },
  'Sector 20 Market & HUDA Complex, Panchkula': { lat: 30.6690, lng: 76.8570 },
  'Amartex Chowk, Industrial Area Phase 1, Panchkula': { lat: 30.6865, lng: 76.8375 },
  'Sector 8 & 9 Gourmet Market, Panchkula': { lat: 30.7010, lng: 76.8540 },
  'Nada Sahib Gurudwara, Panchkula': { lat: 30.6880, lng: 76.8920 },
  'Sector 14 Govt College Road, Panchkula': { lat: 30.6840, lng: 76.8620 },
  'Command Hospital, Sector 6, Panchkula': { lat: 30.7040, lng: 76.8670 },

  // === ZIRAKPUR ===
  'VIP Road Shopping Plaza, Zirakpur': { lat: 30.6385, lng: 76.8210 },
  'Patiala Highway Chowk, Zirakpur': { lat: 30.6430, lng: 76.8095 },
  'Dhakoli Railway Crossing Road, Zirakpur': { lat: 30.6340, lng: 76.8520 },
  'Cosmo Mall & Ambala Highway, Zirakpur': { lat: 30.6275, lng: 76.8280 },
  'Maya Garden City, Nagla Road, Zirakpur': { lat: 30.6310, lng: 76.8150 },
  'Baltana Main Market & Chowk, Zirakpur': { lat: 30.6550, lng: 76.8390 },
  'Peer Muchalla Commercial Complex, Zirakpur': { lat: 30.6460, lng: 76.8610 },
  'Singhpura Chowk, Zirakpur': { lat: 30.6485, lng: 76.8180 },

  // === KHARAR ===
  'Kharar Bus Stand & Flyover, Kharar': { lat: 30.7485, lng: 76.6435 },
  'Sunny Enclave Main Market, Sector 125 Kharar': { lat: 30.7580, lng: 76.6620 },
  'Chandigarh University (CU) Main Gate, Gharuan-Kharar': { lat: 30.7700, lng: 76.5760 },
  'Landran Chowk & CGC Campus, Kharar-Banur Road': { lat: 30.6930, lng: 76.6655 },
  'Desu Majra Commercial Hub, Kharar': { lat: 30.7420, lng: 76.6690 },
  'Gillco Valley Township, Sector 127 Kharar': { lat: 30.7620, lng: 76.6740 },
  'Kharar Railway Station Road': { lat: 30.7380, lng: 76.6350 },

  // === MANIMAJRA ===
  'Manimajra Motor Market, Main Road': { lat: 30.7215, lng: 76.8395 },
  'Modern Housing Complex (MHC), Manimajra': { lat: 30.7285, lng: 76.8360 },
  'Housing Board Chowk (Chandigarh-Panchkula Link)': { lat: 30.7185, lng: 76.8310 },
  'Fun Republic Mall & Multiplex, Manimajra': { lat: 30.7205, lng: 76.8270 },
  'Chandigarh IT Park Main Gate (Manimajra Border)': { lat: 30.7270, lng: 76.8390 },
  'Old Ropar Road & Shanti Nagar, Manimajra': { lat: 30.7250, lng: 76.8440 },
  'Subhash Nagar Market, Manimajra': { lat: 30.7170, lng: 76.8420 },
};

/**
 * Resolves address string to LatLng coordinate.
 * Falls back to hashing algorithm inside Tricity bounds.
 */
export function resolveLocationCoords(
  address: string,
  fallbackOrigin: LatLng = TRICITY_CENTROID
): LatLng {
  if (!address) return fallbackOrigin;

  // Exact match
  if (KNOWN_LOCATIONS[address]) {
    return KNOWN_LOCATIONS[address];
  }

  // Partial match
  const lower = address.toLowerCase();
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return coords;
    }
  }

  // Check if matches any zone name
  for (const zone of Object.values(SERVICE_ZONES)) {
    if (lower.includes(zone.id) || lower.includes(zone.name.toLowerCase())) {
      return zone.center;
    }
  }

  // Deterministic pseudo-random offset based on address text hash around Tricity center
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash << 5) - hash + address.charCodeAt(i);
    hash |= 0;
  }

  const latOffset = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.05;
  const lngOffset = ((Math.abs(hash >> 3) % 1000) / 1000 - 0.5) * 0.05;

  return {
    lat: Number((fallbackOrigin.lat + latOffset).toFixed(6)),
    lng: Number((fallbackOrigin.lng + lngOffset).toFixed(6)),
  };
}

/**
 * Identifies which Service Zone a given address or coordinate belongs to.
 */
export function detectZoneForLocation(location: string | LatLng): ServiceZone {
  if (typeof location === 'string') {
    const lower = location.toLowerCase();
    if (lower.includes('zirakpur') || lower.includes('dhakoli') || lower.includes('vip road') || lower.includes('baltana')) {
      return SERVICE_ZONES.zirakpur;
    }
    if (lower.includes('mohali') || lower.includes('phase') || lower.includes('bestech') || lower.includes('aerocity') || lower.includes('pca stadium')) {
      return SERVICE_ZONES.mohali;
    }
    if (lower.includes('panchkula') || lower.includes('mansa devi') || lower.includes('mdc') || lower.includes('nada sahib')) {
      return SERVICE_ZONES.panchkula;
    }
    if (lower.includes('kharar') || lower.includes('sunny enclave') || lower.includes('chandigarh university') || lower.includes('landran') || lower.includes('cu')) {
      return SERVICE_ZONES.kharar;
    }
    if (lower.includes('manimajra') || lower.includes('motor market') || lower.includes('housing board') || lower.includes('fun republic') || lower.includes('mhc')) {
      return SERVICE_ZONES.manimajra;
    }
    return SERVICE_ZONES.chandigarh;
  }

  // Coordinate-based distance to zone center
  let nearestZone = SERVICE_ZONES.chandigarh;
  let minDistance = Infinity;

  for (const zone of Object.values(SERVICE_ZONES)) {
    const dist = calculateDistanceKm(location, zone.center);
    if (dist < minDistance) {
      minDistance = dist;
      nearestZone = zone;
    }
  }

  return nearestZone;
}

/**
 * Calculates great-circle distance in kilometers between two points (Haversine formula).
 */
export function calculateDistanceKm(from: LatLng, to: LatLng): number {
  const R = 6371; // Earth radius in km
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

/**
 * Computes heading (bearing in degrees 0-360) from point A to point B.
 */
export function calculateHeading(from: LatLng, to: LatLng): number {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Interpolates between two coordinates given a progress ratio (0 to 1).
 */
export function interpolateCoords(from: LatLng, to: LatLng, fraction: number): LatLng {
  const clamped = Math.max(0, Math.min(1, fraction));
  return {
    lat: from.lat + (to.lat - from.lat) * clamped,
    lng: from.lng + (to.lng - from.lng) * clamped,
  };
}

/**
 * Generates sample nearby idle moto drivers around a center point in the Tricity.
 */
export function generateNearbyBikes(center: LatLng, count = 5): Array<{ id: string; name: string; position: LatLng; heading: number }> {
  const names = ['Vikram R. (Splendor+)', 'Alex M. (Pulsar 150)', 'Gurpreet S. (Apache RTR)', 'Rahul K. (Activa 6G)', 'Carlos S. (FZ-S)'];
  const offsets = [
    { dLat: 0.0035, dLng: 0.0042, heading: 45 },
    { dLat: -0.0041, dLng: 0.0028, heading: 135 },
    { dLat: 0.0022, dLng: -0.0051, heading: 280 },
    { dLat: -0.0038, dLng: -0.0034, heading: 210 },
    { dLat: 0.0045, dLng: -0.0018, heading: 330 },
  ];

  return Array.from({ length: Math.min(count, offsets.length) }, (_, i) => ({
    id: `moto-tricity-${i + 1}`,
    name: names[i] || `Captain #${i + 1}`,
    position: {
      lat: center.lat + offsets[i].dLat,
      lng: center.lng + offsets[i].dLng,
    },
    heading: offsets[i].heading,
  }));
}

/**
 * Google Maps Custom Dark Mode Styling for modern ride-sharing UI.
 */
export const GOOGLE_MAPS_DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#131926' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#131926' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0f291e' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#34d399' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94a3b8' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f8fafc' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#082f49' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#082f49' }],
  },
];

/**
 * Google Maps Clean Pure White / Light Mode Styling with pristine white canvas,
 * soft subtle road outlines, gentle green parks, and serene water tones.
 */
export const GOOGLE_MAPS_LIGHT_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#0f172a' }, { weight: 'bold' }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#475569' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#ecfdf5' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#059669' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#f8fafc' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#e2e8f0' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#475569' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#f1f5f9' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#f8fafc' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#0284c7' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#e0f2fe' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#0284c7' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#ffffff' }],
  },
];

