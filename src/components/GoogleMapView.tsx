import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Navigation,
  Compass,
  Layers,
  Crosshair,
  MapPin,
  Sparkles,
  Zap,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Flame,
  Users,
  Clock,
  ArrowRight,
  Info,
} from 'lucide-react';
import { RideStatus } from '../types/ride';
import {
  LatLng,
  ServiceZone,
  SERVICE_ZONES,
  TRICITY_CENTROID,
  TRICITY_OUTER_PERIMETER,
  resolveLocationCoords,
  detectZoneForLocation,
  calculateHeading,
  interpolateCoords,
  generateNearbyBikes,
  GOOGLE_MAPS_DARK_STYLE,
  GOOGLE_MAPS_LIGHT_STYLE,
  calculateDistanceKm,
} from '../utils/geoUtils';
import { useTheme } from '../context/ThemeContext';

interface GoogleMapViewProps {
  pickupLocation: string;
  dropoffLocation: string;
  pickupCoords?: LatLng | null;
  dropoffCoords?: LatLng | null;
  status?: RideStatus;
  captainName?: string;
  captainVehicle?: string;
  distanceKm?: number;
  estimatedMins?: number;
  heightClass?: string;
  interactive?: boolean;
  onSwitchToVector?: () => void;
  onRouteCalculated?: (distanceKm: number, durationMins: number) => void;
  onSelectZoneLocation?: (pickup: string, dropoff: string) => void;
}

type MapTheme = 'light' | 'dark' | 'satellite' | 'standard';

/**
 * Inner Component for Directions Rendering and Route Calculation
 */
const DirectionsHandler: React.FC<{
  origin: LatLng;
  destination: LatLng;
  status?: RideStatus;
  onRouteCalculated?: (distKm: number, durMins: number) => void;
  onPathUpdated?: (path: LatLng[]) => void;
}> = ({ origin, destination, status, onRouteCalculated, onPathUpdated }) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!routesLib || !map) return;

    const renderer = new routesLib.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#00e599',
        strokeOpacity: 0.9,
        strokeWeight: 5,
      },
    });

    setDirectionsRenderer(renderer);

    return () => {
      renderer.setMap(null);
    };
  }, [routesLib, map]);

  useEffect(() => {
    if (!routesLib || !directionsRenderer || !origin || !destination) return;

    // Check if origin and destination are distinct
    const dist = calculateDistanceKm(origin, destination);
    if (dist < 0.1) return;

    const directionsService = new routesLib.DirectionsService();

    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (response, routeStatus) => {
        if (routeStatus === google.maps.DirectionsStatus.OK && response) {
          directionsRenderer.setDirections(response);

          const route = response.routes[0];
          if (route && route.legs[0]) {
            const leg = route.legs[0];
            const distKm = Number(((leg.distance?.value || 0) / 1000).toFixed(1));
            const durMins = Math.ceil((leg.duration?.value || 0) / 60);

            if (onRouteCalculated && distKm > 0) {
              onRouteCalculated(distKm, durMins);
            }

            if (route.overview_path && onPathUpdated) {
              const path = route.overview_path.map((p) => ({
                lat: p.lat(),
                lng: p.lng(),
              }));
              onPathUpdated(path);
            }
          }
        }
      }
    );
  }, [routesLib, directionsRenderer, origin.lat, origin.lng, destination.lat, destination.lng]);

  return null;
};

/**
 * Inner Component for Service Area Geofence Polygons
 */
const ServiceAreaPolygonsHandler: React.FC<{
  showZones: boolean;
  activeZoneId: string | null;
  onZoneClick: (zone: ServiceZone) => void;
}> = ({ showZones, activeZoneId, onZoneClick }) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const polygonsRef = useRef<google.maps.Polygon[]>([]);

  useEffect(() => {
    if (!mapsLib || !map) return;

    // Clear previous polygons
    polygonsRef.current.forEach((p) => p.setMap(null));
    polygonsRef.current = [];

    if (!showZones) return;

    // Render 6 Service Area Polygons
    Object.values(SERVICE_ZONES).forEach((zone) => {
      const isSelected = activeZoneId === zone.id;
      const polygon = new mapsLib.Polygon({
        paths: zone.polygon,
        strokeColor: zone.color,
        strokeOpacity: isSelected ? 0.95 : 0.65,
        strokeWeight: isSelected ? 3.5 : 2,
        fillColor: zone.color,
        fillOpacity: isSelected ? 0.28 : 0.12,
        map,
        clickable: true,
        zIndex: isSelected ? 10 : 5,
      });

      polygon.addListener('click', () => {
        onZoneClick(zone);
      });

      polygon.addListener('mouseover', () => {
        polygon.setOptions({
          fillOpacity: 0.35,
          strokeWeight: 3,
        });
      });

      polygon.addListener('mouseout', () => {
        if (activeZoneId !== zone.id) {
          polygon.setOptions({
            fillOpacity: 0.12,
            strokeWeight: 2,
          });
        }
      });

      polygonsRef.current.push(polygon);
    });

    return () => {
      polygonsRef.current.forEach((p) => p.setMap(null));
      polygonsRef.current = [];
    };
  }, [mapsLib, map, showZones, activeZoneId]);

  return null;
};

/**
 * Inner Component for Live Traffic Layer
 */
const TrafficHandler: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const [trafficLayer, setTrafficLayer] = useState<google.maps.TrafficLayer | null>(null);

  useEffect(() => {
    if (!mapsLib || !map) return;
    const layer = new google.maps.TrafficLayer();
    setTrafficLayer(layer);

    return () => {
      layer.setMap(null);
    };
  }, [mapsLib, map]);

  useEffect(() => {
    if (!trafficLayer || !map) return;
    trafficLayer.setMap(enabled ? map : null);
  }, [trafficLayer, map, enabled]);

  return null;
};

/**
 * Inner Component for Auto-Fitting Bounds
 */
const BoundsHandler: React.FC<{
  origin: LatLng;
  destination: LatLng;
  captainPos?: LatLng | null;
  selectedZoneCenter?: LatLng | null;
  triggerRecenter: number;
}> = ({ origin, destination, captainPos, selectedZoneCenter, triggerRecenter }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (selectedZoneCenter) {
      map.panTo(new google.maps.LatLng(selectedZoneCenter.lat, selectedZoneCenter.lng));
      map.setZoom(13);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(new google.maps.LatLng(origin.lat, origin.lng));
    bounds.extend(new google.maps.LatLng(destination.lat, destination.lng));

    if (captainPos) {
      bounds.extend(new google.maps.LatLng(captainPos.lat, captainPos.lng));
    }

    map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, [map, origin.lat, origin.lng, destination.lat, destination.lng, selectedZoneCenter, triggerRecenter]);

  return null;
};

/**
 * Main Google Map View Component
 */
export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  pickupLocation,
  dropoffLocation,
  pickupCoords,
  dropoffCoords,
  status = 'requested',
  captainName = 'Alex M.',
  captainVehicle = 'Honda CB300 · Black',
  distanceKm = 4.2,
  estimatedMins = 12,
  heightClass = 'h-72 sm:h-80',
  interactive = true,
  onSwitchToVector,
  onRouteCalculated,
  onSelectZoneLocation,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [customKey, setCustomKey] = useState<string>(() => {
    return (
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
      localStorage.getItem('motoride_gmaps_api_key') ||
      ''
    );
  });

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [mapTheme, setMapTheme] = useState<MapTheme>(isLight ? 'light' : 'dark');
  const [showTraffic, setShowTraffic] = useState(true);
  const [showServiceZones, setShowServiceZones] = useState(true);
  const [selectedZone, setSelectedZone] = useState<ServiceZone | null>(null);
  const [recenterCount, setRecenterCount] = useState(0);
  const [routePath, setRoutePath] = useState<LatLng[]>([]);
  const [selectedMarkerInfo, setSelectedMarkerInfo] = useState<string | null>(null);

  // Sync with global app theme
  useEffect(() => {
    setMapTheme(isLight ? 'light' : 'dark');
  }, [isLight]);

  // Resolved pickup & dropoff coordinates
  const origin = useMemo(() => {
    return pickupCoords || resolveLocationCoords(pickupLocation, TRICITY_CENTROID);
  }, [pickupCoords, pickupLocation]);

  const destination = useMemo(() => {
    return (
      dropoffCoords ||
      resolveLocationCoords(dropoffLocation, {
        lat: TRICITY_CENTROID.lat - 0.025,
        lng: TRICITY_CENTROID.lng + 0.035,
      })
    );
  }, [dropoffCoords, dropoffLocation]);

  // Detected origin zone for badge display
  const currentOriginZone = useMemo(() => {
    return detectZoneForLocation(pickupLocation || origin);
  }, [pickupLocation, origin]);

  // Simulated bike progress along route
  const [progress, setProgress] = useState(0.15);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === 'accepted') {
      setProgress(0.25);
    } else if (status === 'arrived') {
      setProgress(0.02);
    } else if (status === 'started') {
      timer = setInterval(() => {
        setProgress((prev) => (prev >= 0.95 ? 0.2 : prev + 0.03));
      }, 1500);
    } else if (status === 'completed') {
      setProgress(0.98);
    } else {
      setProgress(0.15);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status]);

  // Current Captain coordinates
  const captainPosition = useMemo(() => {
    if (routePath.length > 2 && status === 'started') {
      const idx = Math.min(
        routePath.length - 1,
        Math.floor(progress * (routePath.length - 1))
      );
      return routePath[idx];
    }
    return interpolateCoords(origin, destination, progress);
  }, [origin, destination, progress, routePath, status]);

  const captainHeading = useMemo(() => {
    return calculateHeading(captainPosition, destination);
  }, [captainPosition, destination]);

  // Nearby available roaming drivers in Tricity
  const nearbyBikes = useMemo(() => {
    return generateNearbyBikes(origin, 5);
  }, [origin.lat, origin.lng]);

  const mapTypeId = useMemo(() => {
    if (mapTheme === 'satellite') return 'satellite';
    if (mapTheme === 'terrain') return 'terrain';
    return 'roadmap';
  }, [mapTheme]);

  const handleSaveApiKey = (key: string) => {
    const trimmed = key.trim();
    setCustomKey(trimmed);
    localStorage.setItem('motoride_gmaps_api_key', trimmed);
    setShowKeyModal(false);
  };

  const handleZoneSelect = (zone: ServiceZone) => {
    setSelectedZone(zone);
    setRecenterCount((c) => c + 1);
  };

  const effectiveApiKey = customKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  return (
    <div
      id="google-map-wrapper"
      className={`relative w-full ${heightClass} ${
        isLight || mapTheme === 'light' || mapTheme === 'standard'
          ? 'bg-white border-slate-200 shadow-md ring-1 ring-slate-100'
          : 'bg-[#0c0f17] border-slate-800 shadow-2xl'
      } rounded-2xl overflow-hidden border select-none transition-colors duration-300`}
    >
      {effectiveApiKey ? (
        <APIProvider apiKey={effectiveApiKey} libraries={['places', 'routes', 'geometry', 'marker']}>
          <Map
            defaultCenter={TRICITY_CENTROID}
            defaultZoom={12}
            mapTypeId={mapTypeId}
            styles={
              mapTheme === 'dark'
                ? GOOGLE_MAPS_DARK_STYLE
                : mapTheme === 'light' || mapTheme === 'standard'
                ? GOOGLE_MAPS_LIGHT_STYLE
                : undefined
            }
            backgroundColor="#ffffff"
            disableDefaultUI={true}
            gestureHandling="greedy"
            className="w-full h-full"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          >
            {/* Directions & Route Polyline */}
            <DirectionsHandler
              origin={origin}
              destination={destination}
              status={status}
              onRouteCalculated={onRouteCalculated}
              onPathUpdated={setRoutePath}
            />

            {/* Service Area Geofence Polygons for Zirakpur, Chandigarh, Panchkula, Manimajra, Mohali, Kharar */}
            <ServiceAreaPolygonsHandler
              showZones={showServiceZones}
              activeZoneId={selectedZone?.id || null}
              onZoneClick={handleZoneSelect}
            />

            {/* Live Traffic Overlay */}
            <TrafficHandler enabled={showTraffic} />

            {/* Auto Fit Bounds / Pan to Selected Zone */}
            <BoundsHandler
              origin={origin}
              destination={destination}
              captainPos={status !== 'requested' ? captainPosition : null}
              selectedZoneCenter={selectedZone?.center || null}
              triggerRecenter={recenterCount}
            />

            {/* Service Zone Center Badges / Labels on Map */}
            {showServiceZones &&
              Object.values(SERVICE_ZONES).map((zone) => (
                <AdvancedMarker
                  key={`zone-marker-${zone.id}`}
                  position={zone.center}
                  title={`Service Area: ${zone.name}`}
                  onClick={() => handleZoneSelect(zone)}
                >
                  <div
                    className="flex flex-col items-center group cursor-pointer transition-transform hover:scale-110"
                    style={{ zIndex: 10 }}
                  >
                    <div
                      className="px-2 py-0.5 rounded-full text-[9px] font-black text-slate-950 flex items-center gap-1 shadow-md backdrop-blur-md border border-white/60"
                      style={{ backgroundColor: zone.color }}
                    >
                      <span>📍 {zone.name.split(' ')[0]}</span>
                      <span className="bg-slate-950/20 text-slate-950 px-1 rounded text-[8px] font-bold">
                        {zone.activeCaptains} 🏍️
                      </span>
                    </div>
                  </div>
                </AdvancedMarker>
              ))}

            {/* Pickup Marker */}
            <AdvancedMarker
              position={origin}
              title={`Pickup: ${pickupLocation}`}
              onClick={() => setSelectedMarkerInfo('pickup')}
            >
              <div className="flex flex-col items-center group cursor-pointer z-30">
                <div className={`${isLight ? 'bg-white/95 text-slate-900 border-slate-200 shadow-md' : 'bg-slate-950/95 text-white border-slate-700 shadow-xl'} text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap mb-1 flex items-center gap-1 backdrop-blur-md`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="max-w-[120px] truncate">{pickupLocation.split(',')[0]}</span>
                </div>
                <div className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/50 border-2 border-white ring-4 ring-emerald-500/20 font-black text-xs">
                  ●
                </div>
              </div>
            </AdvancedMarker>

            {/* Dropoff Marker */}
            <AdvancedMarker
              position={destination}
              title={`Destination: ${dropoffLocation}`}
              onClick={() => setSelectedMarkerInfo('dropoff')}
            >
              <div className="flex flex-col items-center group cursor-pointer z-30">
                <div className={`${isLight ? 'bg-white/95 text-slate-900 border-slate-200 shadow-md' : 'bg-slate-950/95 text-white border-slate-700 shadow-xl'} text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap mb-1 flex items-center gap-1 backdrop-blur-md`}>
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="max-w-[120px] truncate">{dropoffLocation.split(',')[0]}</span>
                </div>
                <div className="w-7 h-7 rounded-md bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/50 border-2 border-white ring-4 ring-rose-500/20">
                  <Navigation className="w-3.5 h-3.5" />
                </div>
              </div>
            </AdvancedMarker>

            {/* Active Captain Motorbike Pin */}
            {status !== 'requested' && status !== 'cancelled' && (
              <AdvancedMarker
                position={captainPosition}
                title={`Captain ${captainName} (${captainVehicle})`}
                onClick={() => setSelectedMarkerInfo('captain')}
              >
                <div className="relative flex flex-col items-center cursor-pointer z-40">
                  <div className={`${isLight ? 'bg-white/95 text-slate-900 border-amber-300' : 'bg-slate-950/95 text-amber-300 border-amber-400/40'} text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap mb-1 flex items-center gap-1 border backdrop-blur-md`}>
                    <span>🏍️ {captainName.split(' ')[0]}</span>
                    <span className="text-[9px] bg-amber-400/20 text-amber-800 dark:text-amber-200 px-1 rounded font-bold">
                      {status === 'accepted'
                        ? 'En Route'
                        : status === 'arrived'
                        ? 'Arrived'
                        : 'In Trip'}
                    </span>
                  </div>
                  <div
                    className="w-9 h-9 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xl shadow-amber-400/50 border-2 border-slate-950 ring-4 ring-amber-400/30 transition-transform duration-500"
                    style={{ transform: `rotate(${captainHeading}deg)` }}
                  >
                    <Compass className="w-5 h-5 text-slate-950" />
                  </div>
                </div>
              </AdvancedMarker>
            )}

            {/* Nearby Available Roaming Bikes */}
            {(status === 'requested' || status === 'completed' || status === 'cancelled') &&
              nearbyBikes.map((bike) => (
                <AdvancedMarker key={bike.id} position={bike.position} title={bike.name}>
                  <div
                    className={`w-7 h-7 rounded-full ${isLight ? 'bg-white border-emerald-500 shadow-md text-slate-900' : 'bg-slate-900/90 border-emerald-400/60 shadow-lg text-white'} border flex items-center justify-center text-[12px] transform transition-transform hover:scale-125 cursor-pointer`}
                    style={{ transform: `rotate(${bike.heading}deg)` }}
                    title={`Available: ${bike.name}`}
                  >
                    🏍️
                  </div>
                </AdvancedMarker>
              ))}

            {/* Info Windows */}
            {selectedMarkerInfo === 'pickup' && (
              <InfoWindow position={origin} onCloseClick={() => setSelectedMarkerInfo(null)}>
                <div className="p-2 text-slate-900 max-w-[210px]">
                  <h4 className="font-bold text-xs text-emerald-700 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Pickup Location
                  </h4>
                  <p className="text-[11px] font-medium text-slate-800 mt-1">{pickupLocation}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">Zone: {currentOriginZone.name}</p>
                </div>
              </InfoWindow>
            )}

            {selectedMarkerInfo === 'dropoff' && (
              <InfoWindow position={destination} onCloseClick={() => setSelectedMarkerInfo(null)}>
                <div className="p-2 text-slate-900 max-w-[210px]">
                  <h4 className="font-bold text-xs text-rose-700 flex items-center gap-1">
                    <Navigation className="w-3 h-3" /> Destination
                  </h4>
                  <p className="text-[11px] font-medium text-slate-800 mt-1">{dropoffLocation}</p>
                </div>
              </InfoWindow>
            )}

            {selectedMarkerInfo === 'captain' && (
              <InfoWindow position={captainPosition} onCloseClick={() => setSelectedMarkerInfo(null)}>
                <div className="p-2 text-slate-900 max-w-[220px]">
                  <h4 className="font-bold text-xs text-amber-700 flex items-center gap-1">
                    🏍️ {captainName}
                  </h4>
                  <p className="text-[11px] text-slate-600 font-semibold">{captainVehicle}</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Status: <span className="font-bold text-emerald-600 uppercase">{status}</span>
                  </p>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      ) : (
        /* Zero-API-Key State */
        <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center ${
          isLight ? 'bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-900' : 'bg-gradient-to-b from-slate-950 via-slate-900 to-[#0c0f17] text-white'
        }`}>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 shadow-lg shadow-emerald-500/10">
            <MapPin className="w-6 h-6 animate-bounce" />
          </div>
          <h3 className={`text-sm font-bold mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>Tricity Service Area Active</h3>
          <p className={`text-xs max-w-xs mb-3 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Covering <strong className="text-emerald-600 dark:text-emerald-400">Zirakpur, Chandigarh, Panchkula, Manimajra, Mohali & Kharar</strong>.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowKeyModal(true)}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Configure Google Maps Key
            </button>
            {onSwitchToVector && (
              <button
                type="button"
                onClick={onSwitchToVector}
                className={`px-3.5 py-1.5 font-bold rounded-xl text-xs border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                Open Vector HUD Map
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Floating HUD: Live ETA & Service Area Zone Indicator */}
      <div className={`absolute top-3 left-3 backdrop-blur-md px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs shadow-md z-20 ${
        isLight ? 'bg-white/95 border-slate-200 text-slate-900' : 'bg-slate-950/95 border-slate-800 text-slate-100'
      }`}>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-bold flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
            isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/20 text-emerald-300'
          }`}>
            TRICITY MOTO
          </span>
          <span className={`text-[11px] font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            {currentOriginZone ? currentOriginZone.name : 'Chandigarh'}
          </span>
        </span>
        <span className={isLight ? 'text-slate-300' : 'text-slate-600'}>|</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{distanceKm} km</span>
        <span className={isLight ? 'text-slate-500 font-medium' : 'text-slate-400 font-medium'}>({estimatedMins} min)</span>
      </div>

      {/* Service Zone Quick Filter Bar (Scrollable on small screens) */}
      <div className="absolute top-12 left-3 right-12 z-20 overflow-x-auto no-scrollbar py-1 flex items-center gap-1.5 pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            setSelectedZone(null);
            setRecenterCount((c) => c + 1);
          }}
          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap backdrop-blur-md border transition-all cursor-pointer ${
            !selectedZone
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
              : isLight
              ? 'bg-white/90 text-slate-700 border-slate-200 hover:bg-slate-50 shadow-sm'
              : 'bg-slate-950/80 text-slate-300 border-slate-700/80 hover:bg-slate-900'
          }`}
        >
          All 6 Zones
        </button>

        {Object.values(SERVICE_ZONES).map((zone) => {
          const isSelected = selectedZone?.id === zone.id;
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => handleZoneSelect(zone)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap backdrop-blur-md border transition-all flex items-center gap-1 cursor-pointer ${
                isSelected
                  ? 'text-slate-950 font-black shadow-md border-white/60'
                  : isLight
                  ? 'bg-white/90 text-slate-700 border-slate-200 hover:bg-slate-50 shadow-sm'
                  : 'bg-slate-950/80 text-slate-300 border-slate-700/80 hover:bg-slate-900 hover:text-white'
              }`}
              style={{
                backgroundColor: isSelected ? zone.color : undefined,
                borderColor: isSelected ? zone.color : undefined,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: isSelected ? '#000' : zone.color }}
              />
              <span>{zone.name.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Interactive Controls Overlay */}
      {interactive && (
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-20">
          {/* Service Area Geofence Layer Toggle */}
          <button
            type="button"
            onClick={() => setShowServiceZones(!showServiceZones)}
            title={showServiceZones ? 'Hide Service Area Polygons' : 'Show 6 Service Zones (Zirakpur, Chandigarh, Panchkula, etc.)'}
            className={`p-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border transition-all cursor-pointer ${
              showServiceZones
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-300 shadow-md shadow-emerald-500/20'
                : isLight
                ? 'bg-white/90 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
                : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </button>

          {/* Traffic Toggle */}
          <button
            type="button"
            onClick={() => setShowTraffic(!showTraffic)}
            title={showTraffic ? 'Hide Google Live Traffic' : 'Show Google Live Traffic'}
            className={`p-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border transition-all cursor-pointer ${
              showTraffic
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-600 dark:text-sky-300'
                : isLight
                ? 'bg-white/90 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
                : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          {/* Map Theme Toggle (Clean White Light / Dark / Satellite) */}
          <button
            type="button"
            onClick={() =>
              setMapTheme((prev) =>
                prev === 'light' ? 'satellite' : prev === 'satellite' ? 'dark' : 'light'
              )
            }
            className={`p-1.5 rounded-lg border backdrop-blur-md transition-colors cursor-pointer ${
              isLight
                ? 'bg-white/90 hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title={`Style: ${mapTheme.toUpperCase()} (Click to toggle White/Satellite/Dark)`}
          >
            <Compass className="w-3.5 h-3.5" />
          </button>

          {/* Recenter & Fit Route */}
          <button
            type="button"
            onClick={() => {
              setSelectedZone(null);
              setRecenterCount((c) => c + 1);
            }}
            className={`p-1.5 rounded-lg border backdrop-blur-md transition-colors cursor-pointer ${
              isLight
                ? 'bg-white/90 hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title="Recenter Map View"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>

          {/* API Key Modal Button */}
          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            className={`p-1.5 rounded-lg border backdrop-blur-md transition-colors cursor-pointer ${
              isLight
                ? 'bg-white/90 hover:bg-slate-100 text-amber-600 border-amber-300 shadow-sm'
                : 'bg-slate-900/80 hover:bg-slate-800 text-amber-300 border-amber-500/30'
            }`}
            title="Google Maps API Key Settings"
          >
            <KeyRound className="w-3.5 h-3.5" />
          </button>

          {/* Switch to Vector View */}
          {onSwitchToVector && (
            <button
              type="button"
              onClick={onSwitchToVector}
              className={`p-1.5 rounded-lg border backdrop-blur-md transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white/90 hover:bg-slate-100 text-sky-600 border-sky-300 shadow-sm'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-sky-400 border-sky-500/30'
              }`}
              title="Switch to Vector Simulation Map"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Selected Zone Detail Card Popup */}
      {selectedZone && (
        <div className={`absolute bottom-9 left-3 right-3 z-30 max-w-sm rounded-xl p-2.5 backdrop-blur-lg border shadow-xl animate-in fade-in slide-in-from-bottom-2 ${
          isLight ? 'bg-white/95 border-slate-200 text-slate-900' : 'bg-slate-950/95 border-slate-800 text-white'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: selectedZone.color }}
              />
              <div>
                <h4 className={`text-xs font-black flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <span>{selectedZone.name}</span>
                  <span className={`text-[10px] font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    ({selectedZone.hindiName} / {selectedZone.punjabiName})
                  </span>
                </h4>
                <p className={`text-[10px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{selectedZone.tagline}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedZone(null)}
              className={`${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'} text-xs cursor-pointer p-0.5`}
            >
              ✕
            </button>
          </div>

          <div className={`grid grid-cols-3 gap-2 mt-2 pt-2 border-t text-[10px] ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
            <div className={`p-1.5 rounded-lg border text-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
              <span className={`block text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Captains</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedZone.activeCaptains} Active</span>
            </div>
            <div className={`p-1.5 rounded-lg border text-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
              <span className={`block text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Avg Pickup</span>
              <span className="font-bold text-sky-600 dark:text-sky-400">2-4 Mins</span>
            </div>
            <div className={`p-1.5 rounded-lg border text-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
              <span className={`block text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Surge</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{selectedZone.surgeMultiplier}x</span>
            </div>
          </div>

          {onSelectZoneLocation && selectedZone.popularPickups.length > 0 && (
            <div className="mt-2 flex items-center justify-between gap-1 text-[10px]">
              <span className={`truncate text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Hub: {selectedZone.popularPickups[0].split(',')[0]}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (onSelectZoneLocation && selectedZone.popularPickups[0]) {
                    onSelectZoneLocation(
                      selectedZone.popularPickups[0],
                      selectedZone.popularDropoffs[0] || 'Sector 17 Plaza, Chandigarh'
                    );
                    setSelectedZone(null);
                  }
                }}
                className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-[9px] flex items-center gap-1 cursor-pointer transition-colors"
              >
                Set as Pickup <ArrowRight className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom Service Area Status Pill */}
      <div className={`absolute bottom-2 left-3 text-[10px] font-medium pointer-events-none z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-md backdrop-blur-sm border ${
        isLight ? 'bg-white/90 text-slate-700 border-slate-200 shadow-sm' : 'bg-slate-950/80 text-slate-300 border-slate-800'
      }`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>Service Area: <strong>Zirakpur · Chandigarh · Panchkula · Manimajra · Mohali · Kharar</strong></span>
      </div>

      {/* API Key Configuration Modal */}
      {showKeyModal && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-sm w-full p-4 shadow-2xl text-left ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h4 className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Google Maps API Key</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className={`${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'} text-xs cursor-pointer`}
              >
                ✕
              </button>
            </div>

            <p className={`text-[11px] mb-3 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Enter your Google Maps Platform API key to render real Google Maps, Directions, and Live Traffic for the Tricity service region.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveApiKey(formData.get('apiKey') as string);
              }}
              className="space-y-3"
            >
              <input
                name="apiKey"
                defaultValue={customKey}
                placeholder="AIzaSy..."
                className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    : 'bg-slate-950 border-slate-700 text-white placeholder-slate-500'
                }`}
              />

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Save & Apply Key
                </button>
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className={`px-3 py-2 font-bold rounded-xl text-xs transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </form>

            <div className={`mt-3 pt-2 border-t flex items-center justify-between text-[10px] ${
              isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
            }`}>
              <a
                href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                Get Free Maps Demo Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
