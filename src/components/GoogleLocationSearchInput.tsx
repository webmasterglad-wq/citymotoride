import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  MapPin,
  Navigation,
  X,
  Compass,
  Building2,
  GraduationCap,
  Hospital,
  Plane,
  Train,
  ShoppingBag,
  Sparkles,
  Check,
  ChevronRight,
  Clock,
  Loader2,
} from 'lucide-react';
import { LatLng, KNOWN_LOCATIONS, resolveLocationCoords, calculateDistanceKm, detectZoneForLocation } from '../utils/geoUtils';
import { useTheme } from '../context/ThemeContext';

export interface LocationSearchResult {
  id: string;
  name: string;
  secondaryText: string;
  category: 'popular' | 'mall' | 'college' | 'hospital' | 'transit' | 'sector' | 'landmark';
  coords: LatLng;
  zoneName: string;
  distanceKm?: number;
}

interface GoogleLocationSearchInputProps {
  type: 'pickup' | 'dropoff';
  value: string;
  placeholder?: string;
  onChange: (value: string, coords?: LatLng) => void;
  referenceCoords?: LatLng | null;
  className?: string;
  required?: boolean;
}

// Extensive database of searchable places across the region
const EXTENDED_SEARCH_DATABASE: Omit<LocationSearchResult, 'distanceKm'>[] = [
  // === POPULAR HUBS & MALLS ===
  {
    id: 'elante-mall',
    name: 'Elante Mall',
    secondaryText: 'Industrial Area Phase 1, Chandigarh',
    category: 'mall',
    coords: { lat: 30.7055, lng: 76.8013 },
    zoneName: 'Chandigarh',
  },
  {
    id: 'sec-17-plaza',
    name: 'Sector 17 Plaza',
    secondaryText: 'City Center, Sector 17, Chandigarh',
    category: 'landmark',
    coords: { lat: 30.7398, lng: 76.7827 },
    zoneName: 'Chandigarh',
  },
  {
    id: 'sukhna-lake',
    name: 'Sukhna Lake Promenade',
    secondaryText: 'Sector 1, Rock Garden Road, Chandigarh',
    category: 'landmark',
    coords: { lat: 30.7421, lng: 76.8178 },
    zoneName: 'Chandigarh',
  },
  {
    id: 'bestech-mall',
    name: 'Bestech Square Mall',
    secondaryText: 'Sector 66, Airport Road, Mohali',
    category: 'mall',
    coords: { lat: 30.6780, lng: 76.7325 },
    zoneName: 'Mohali',
  },
  {
    id: 'vr-punjab',
    name: 'VR Punjab Mall (North Country)',
    secondaryText: 'Kharar-Mohali Highway, Sector 118',
    category: 'mall',
    coords: { lat: 30.7345, lng: 76.6850 },
    zoneName: 'Mohali',
  },
  {
    id: 'cosmo-mall',
    name: 'Cosmo Mall & Multiplex',
    secondaryText: 'Chandigarh-Ambala Highway, Zirakpur',
    category: 'mall',
    coords: { lat: 30.6275, lng: 76.8280 },
    zoneName: 'Zirakpur',
  },
  {
    id: 'fun-republic',
    name: 'Fun Republic Mall',
    secondaryText: 'Dhillon Complex, Manimajra',
    category: 'mall',
    coords: { lat: 30.7205, lng: 76.8270 },
    zoneName: 'Manimajra',
  },

  // === TECH PARKS & CORPORATE ===
  {
    id: 'it-park-dlf',
    name: 'DLF Cybercity / IT Park',
    secondaryText: 'Rajiv Gandhi Chandigarh Technology Park',
    category: 'landmark',
    coords: { lat: 30.7289, lng: 76.8421 },
    zoneName: 'Chandigarh',
  },
  {
    id: 'quark-city',
    name: 'QuarkCity IT SEZ',
    secondaryText: 'Industrial Area Phase 8, Mohali',
    category: 'landmark',
    coords: { lat: 30.7020, lng: 76.6980 },
    zoneName: 'Mohali',
  },

  // === TRANSIT & AIRPORTS ===
  {
    id: 'chd-airport',
    name: 'Shaheed Bhagat Singh Int. Airport (IXC)',
    secondaryText: 'Airport Road, Mohali / Chandigarh',
    category: 'transit',
    coords: { lat: 30.6730, lng: 76.7885 },
    zoneName: 'Mohali',
  },
  {
    id: 'isbt-43',
    name: 'ISBT Sector 43',
    secondaryText: 'Interstate Bus Terminal, Chandigarh',
    category: 'transit',
    coords: { lat: 30.7180, lng: 76.7489 },
    zoneName: 'Chandigarh',
  },
  {
    id: 'isbt-17',
    name: 'ISBT Sector 17',
    secondaryText: 'Local Bus Terminal, Chandigarh',
    category: 'transit',
    coords: { lat: 30.7410, lng: 76.7845 },
    zoneName: 'Chandigarh',
  },
  {
    id: 'chd-railway',
    name: 'Chandigarh Railway Station',
    secondaryText: 'Daria / Manimajra Border, Chandigarh',
    category: 'transit',
    coords: { lat: 30.7050, lng: 76.8280 },
    zoneName: 'Chandigarh',
  },
  {
    id: 'kharar-bus-stand',
    name: 'Kharar Bus Stand & Flyover',
    secondaryText: 'NH 205, Kharar Main Chowk',
    category: 'transit',
    coords: { lat: 30.7485, lng: 76.6435 },
    zoneName: 'Kharar',
  },

  // === UNIVERSITIES & COLLEGES ===
  {
    id: 'chandigarh-university',
    name: 'Chandigarh University (CU)',
    secondaryText: 'NH-95, Gharuan / Kharar Highway',
    category: 'college',
    coords: { lat: 30.7700, lng: 76.5760 },
    zoneName: 'Kharar',
  },
  {
    id: 'panjab-university',
    name: 'Panjab University (PU Campus)',
    secondaryText: 'Sector 14 & 25, Chandigarh',
    category: 'college',
    coords: { lat: 30.7595, lng: 76.7680 },
    zoneName: 'Chandigarh',
  },
  {
    id: 'cgc-landran',
    name: 'CGC Landran Campus',
    secondaryText: 'Landran Chowk, Kharar-Banur Highway',
    category: 'college',
    coords: { lat: 30.6930, lng: 76.6655 },
    zoneName: 'Kharar',
  },
  {
    id: 'pec-chd',
    name: 'Punjab Engineering College (PEC)',
    secondaryText: 'Sector 12, Chandigarh',
    category: 'college',
    coords: { lat: 30.7650, lng: 76.7860 },
    zoneName: 'Chandigarh',
  },
  {
    id: 'chitkara-uni',
    name: 'Chitkara University Campus',
    secondaryText: 'Chandigarh-Patiala Highway',
    category: 'college',
    coords: { lat: 30.5160, lng: 76.6590 },
    zoneName: 'Zirakpur',
  },

  // === HOSPITALS ===
  {
    id: 'pgi-chd',
    name: 'PGIMER Hospital & Research Institute',
    secondaryText: 'Madhya Marg, Sector 12, Chandigarh',
    category: 'hospital',
    coords: { lat: 30.7645, lng: 76.7760 },
    zoneName: 'Chandigarh',
  },
  {
    id: 'fortis-mohali',
    name: 'Fortis Multi-Speciality Hospital',
    secondaryText: 'Sector 62, Phase 8, Mohali',
    category: 'hospital',
    coords: { lat: 30.6970, lng: 76.7330 },
    zoneName: 'Mohali',
  },
  {
    id: 'max-hospital',
    name: 'Max Super Speciality Hospital',
    secondaryText: 'Near Civil Hospital, Phase 6, Mohali',
    category: 'hospital',
    coords: { lat: 30.7290, lng: 76.7110 },
    zoneName: 'Mohali',
  },
  {
    id: 'command-hosp',
    name: 'Western Command Hospital',
    secondaryText: 'Sector 6, Panchkula',
    category: 'hospital',
    coords: { lat: 30.7040, lng: 76.8670 },
    zoneName: 'Panchkula',
  },
  {
    id: 'gmch-32',
    name: 'Govt Medical College & Hosp (GMCH 32)',
    secondaryText: 'Sector 32B, Chandigarh',
    category: 'hospital',
    coords: { lat: 30.7110, lng: 76.7780 },
    zoneName: 'Chandigarh',
  },

  // === FAMOUS FOOD & SHOPPING MARKETS ===
  {
    id: 'sec-35-aroma',
    name: 'Sector 35 Market & Hotel Aroma',
    secondaryText: 'Himalaya Marg, Chandigarh',
    category: 'landmark',
    coords: { lat: 30.7235, lng: 76.7661 },
    zoneName: 'Chandigarh',
  },
  {
    id: 'sec-22-shastri',
    name: 'Sector 22 Shastri Market',
    secondaryText: 'Mobile & Fashion Hub, Chandigarh',
    category: 'landmark',
    coords: { lat: 30.7305, lng: 76.7725 },
    zoneName: 'Chandigarh',
  },
  {
    id: 'phase-7-market',
    name: 'Phase 7 Market & Food Street',
    secondaryText: 'SAS Nagar, Mohali',
    category: 'popular',
    coords: { lat: 30.7088, lng: 76.7135 },
    zoneName: 'Mohali',
  },
  {
    id: 'phase-3b2-market',
    name: 'Phase 3B2 Chowk & Market',
    secondaryText: 'Khao Gali, Mohali',
    category: 'popular',
    coords: { lat: 30.7160, lng: 76.7245 },
    zoneName: 'Mohali',
  },
  {
    id: 'vip-road-zirakpur',
    name: 'VIP Road Shopping Plaza',
    secondaryText: 'Zirakpur Hub, VIP Road',
    category: 'popular',
    coords: { lat: 30.6385, lng: 76.8210 },
    zoneName: 'Zirakpur',
  },
  {
    id: 'sec-5-panchkula',
    name: 'Sector 5 Major Town Park & Market',
    secondaryText: 'City Centre, Panchkula',
    category: 'popular',
    coords: { lat: 30.6935, lng: 76.8585 },
    zoneName: 'Panchkula',
  },
  {
    id: 'sec-20-panchkula',
    name: 'Sector 20 Market & HUDA Complex',
    secondaryText: 'Panchkula South',
    category: 'popular',
    coords: { lat: 30.6690, lng: 76.8570 },
    zoneName: 'Panchkula',
  },
  {
    id: 'sunny-enclave',
    name: 'Sunny Enclave Main Market',
    secondaryText: 'Sector 125, Kharar',
    category: 'popular',
    coords: { lat: 30.7580, lng: 76.6620 },
    zoneName: 'Kharar',
  },
  {
    id: 'manimajra-market',
    name: 'Manimajra Motor Market',
    secondaryText: 'Main Old Ropar Road, Manimajra',
    category: 'popular',
    coords: { lat: 30.7215, lng: 76.8395 },
    zoneName: 'Manimajra',
  },
  {
    id: 'mhc-manimajra',
    name: 'Modern Housing Complex (MHC)',
    secondaryText: 'Duplex & Category Houses, Manimajra',
    category: 'sector',
    coords: { lat: 30.7285, lng: 76.8360 },
    zoneName: 'Manimajra',
  },
  {
    id: 'pca-stadium',
    name: 'PCA Cricket Stadium',
    secondaryText: 'Sector 63, Mohali',
    category: 'landmark',
    coords: { lat: 30.6908, lng: 76.7375 },
    zoneName: 'Mohali',
  },
  {
    id: 'nada-sahib',
    name: 'Nada Sahib Gurudwara',
    secondaryText: 'Ghaggar River Bank, Panchkula',
    category: 'landmark',
    coords: { lat: 30.6880, lng: 76.8920 },
    zoneName: 'Panchkula',
  },
  {
    id: 'mansa-devi',
    name: 'Mata Mansa Devi Shrine & Complex',
    secondaryText: 'MDC Sector 4, Panchkula',
    category: 'landmark',
    coords: { lat: 30.7280, lng: 76.8520 },
    zoneName: 'Panchkula',
  },
];

export const GoogleLocationSearchInput: React.FC<GoogleLocationSearchInputProps> = ({
  type,
  value,
  placeholder,
  onChange,
  referenceCoords,
  className = '',
  required = false,
}) => {
  const { isLight } = useTheme();
  const [query, setQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isLocating, setIsLocating] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal state when external value changes
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fast, zero-lag local POI search filtering
  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ref = referenceCoords || { lat: 30.7333, lng: 76.7794 };

    const results = [...EXTENDED_SEARCH_DATABASE];

    return results
      .map((item) => ({
        ...item,
        distanceKm: Math.round(calculateDistanceKm(ref, item.coords) * 10) / 10,
      }))
      .filter((item) => {
        // Category filter
        if (activeCategory !== 'all') {
          if (activeCategory === 'mall' && item.category !== 'mall') return false;
          if (activeCategory === 'college' && item.category !== 'college') return false;
          if (activeCategory === 'hospital' && item.category !== 'hospital') return false;
          if (activeCategory === 'transit' && item.category !== 'transit') return false;
          if (activeCategory === 'popular' && item.category !== 'popular' && item.category !== 'landmark') return false;
        }

        // Text query filter
        if (!q) return true;
        return (
          item.name.toLowerCase().includes(q) ||
          item.secondaryText.toLowerCase().includes(q) ||
          item.zoneName.toLowerCase().includes(q)
        );
      })
      .slice(0, 7);
  }, [query, activeCategory, referenceCoords]);

  const handleSelectLocation = (result: LocationSearchResult) => {
    const fullAddress = `${result.name}, ${result.zoneName}`;
    setQuery(fullAddress);
    onChange(fullAddress, result.coords);
    setIsOpen(false);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const userCoords: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        // Find closest known landmark in our database
        let closestPlace = EXTENDED_SEARCH_DATABASE[0];
        let minDistance = Infinity;

        EXTENDED_SEARCH_DATABASE.forEach((p) => {
          const dist = calculateDistanceKm(userCoords, p.coords);
          if (dist < minDistance) {
            minDistance = dist;
            closestPlace = p;
          }
        });

        const address = minDistance < 1.5
          ? `Current Location (Near ${closestPlace.name})`
          : `Current GPS Location (${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)})`;

        setQuery(address);
        onChange(address, userCoords);
        setIsOpen(false);
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err.message);
        // Fallback to Sector 17 Plaza Chandigarh
        const fallback = EXTENDED_SEARCH_DATABASE[1];
        setQuery(fallback.name);
        onChange(fallback.name, fallback.coords);
        setIsOpen(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleClear = () => {
    setQuery('');
    onChange('', undefined);
    inputRef.current?.focus();
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < filteredResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : filteredResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < filteredResults.length) {
        handleSelectLocation(filteredResults[highlightIndex]);
      } else if (filteredResults.length > 0) {
        handleSelectLocation(filteredResults[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const getCategoryIcon = (category: LocationSearchResult['category']) => {
    switch (category) {
      case 'mall':
        return <ShoppingBag className="w-3.5 h-3.5 text-pink-500" />;
      case 'college':
        return <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />;
      case 'hospital':
        return <Hospital className="w-3.5 h-3.5 text-rose-500" />;
      case 'transit':
        return <Train className="w-3.5 h-3.5 text-amber-500" />;
      case 'popular':
        return <Sparkles className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <Building2 className="w-3.5 h-3.5 text-sky-500" />;
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Box */}
      <div className="relative flex items-center w-full">
        <input
          ref={inputRef}
          type="text"
          required={required}
          value={query || ''}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            onChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || (type === 'pickup' ? 'Search Google Maps for Pickup location...' : 'Search Google Maps for Destination...')}
          className={`w-full bg-transparent text-xs font-semibold focus:outline-none pr-14 ${
            isLight ? 'text-slate-900 placeholder-slate-400' : 'text-slate-100 placeholder-slate-500'
          }`}
        />

        {/* Action icons right side */}
        <div className="absolute right-0 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={handleClear}
              className={`p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${
                isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              type === 'pickup'
                ? 'text-emerald-600 hover:bg-emerald-500/10'
                : 'text-rose-500 hover:bg-rose-500/10'
            }`}
            title="Use current GPS location"
          >
            {isLocating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Navigation className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Google Search Dropdown Results Popover */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 top-full mt-2 rounded-2xl border shadow-2xl z-50 overflow-hidden backdrop-blur-xl transition-all animate-in fade-in duration-150 ${
            isLight
              ? 'bg-white/98 border-slate-200 text-slate-900 shadow-slate-300/60'
              : 'bg-slate-950/98 border-slate-800 text-slate-100 shadow-black/80'
          }`}
          style={{ minWidth: '280px' }}
        >
          {/* Google Search Header & Category Filter Tabs */}
          <div
            className={`p-2.5 border-b flex flex-col gap-2 ${
              isLight ? 'bg-slate-50/80 border-slate-100' : 'bg-slate-900/60 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                {/* Google Logo / Search Pin */}
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-blue-500">G</span>
                  <span className="font-extrabold text-red-500">o</span>
                  <span className="font-extrabold text-amber-500">o</span>
                  <span className="font-extrabold text-blue-500">g</span>
                  <span className="font-extrabold text-green-500">l</span>
                  <span className="font-extrabold text-red-500">e</span>
                </div>
                <span className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded font-bold ${
                  type === 'pickup'
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                }`}>
                  {type === 'pickup' ? 'Pickup Location' : 'Destination'}
                </span>
              </div>

              {/* Current GPS button */}
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className={`text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-emerald-50 text-emerald-700 border-slate-200 hover:border-emerald-300 shadow-xs'
                    : 'bg-slate-800 hover:bg-emerald-950/40 text-emerald-400 border-slate-700 hover:border-emerald-500/30'
                }`}
              >
                <Navigation className="w-2.5 h-2.5" />
                <span>GPS Location</span>
              </button>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'all', label: 'All Places' },
                { id: 'popular', label: '⭐ Popular' },
                { id: 'mall', label: '🛍️ Malls & IT' },
                { id: 'college', label: '🎓 Colleges' },
                { id: 'hospital', label: '🏥 Hospitals' },
                { id: 'transit', label: '🚆 Airport & Transit' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-2 py-0.5 rounded-md text-[9px] font-bold whitespace-nowrap transition-all cursor-pointer border ${
                    activeCategory === tab.id
                      ? isLight
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-emerald-500 text-slate-950 font-black border-emerald-400'
                      : isLight
                      ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 no-scrollbar">
            {filteredResults.length === 0 ? (
              <div className="p-4 text-center">
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  No places found for &quot;{query}&quot;
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const fallbackCoords = resolveLocationCoords(query);
                    onChange(query, fallbackCoords);
                    setIsOpen(false);
                  }}
                  className="mt-2 text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  Use &quot;{query}&quot; as custom pin
                </button>
              </div>
            ) : (
              filteredResults.map((result, idx) => {
                const isSelected = highlightIndex === idx;
                return (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => handleSelectLocation(result)}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`w-full text-left p-2.5 flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? isLight
                          ? 'bg-emerald-50 text-slate-900'
                          : 'bg-emerald-950/30 text-white'
                        : isLight
                        ? 'hover:bg-slate-50 text-slate-800'
                        : 'hover:bg-slate-900 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border ${
                          isLight
                            ? 'bg-white border-slate-200 shadow-xs'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        {getCategoryIcon(result.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs truncate">{result.name}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold shrink-0 ${
                              isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {result.zoneName}
                          </span>
                        </div>
                        <p
                          className={`text-[10px] truncate ${
                            isLight ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        >
                          {result.secondaryText}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {result.distanceKm !== undefined && (
                        <span
                          className={`text-[10px] font-mono font-bold ${
                            isLight ? 'text-emerald-700' : 'text-emerald-400'
                          }`}
                        >
                          {result.distanceKm} km
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Note */}
          <div
            className={`p-2 border-t flex items-center justify-between text-[10px] ${
              isLight ? 'bg-slate-50 text-slate-500 border-slate-100' : 'bg-slate-900/80 text-slate-400 border-slate-800'
            }`}
          >
            <span className="flex items-center gap-1 font-medium">
              <MapPin className="w-3 h-3 text-emerald-500" />
              <span>Select location to auto-calculate route & fare</span>
            </span>
            <span className="font-mono text-[9px] text-slate-400">Tricity Dispatch</span>
          </div>
        </div>
      )}
    </div>
  );
};
