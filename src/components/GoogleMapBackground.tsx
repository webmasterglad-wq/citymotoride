import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Layers,
  Plus,
  Minus,
  Locate,
  Radio,
  Navigation,
} from 'lucide-react';
import { LatLng, resolveLocationCoords } from '../utils/geoUtils';
import { useTheme } from '../context/ThemeContext';
import { Ride } from '../types/ride';

interface GoogleMapBackgroundProps {
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupCoords?: LatLng | null;
  dropoffCoords?: LatLng | null;
  activeRide?: Ride | null;
  onSelectCoords?: (coords: LatLng, type: 'pickup' | 'dropoff') => void;
  className?: string;
  isSheetCollapsed?: boolean;
  // Passenger Real-Time Live Location Props
  passengerLiveLocation?: LatLng | null;
  passengerLiveHeading?: number;
  passengerLiveSpeed?: number;
  passengerLiveAccuracy?: number;
  passengerLiveStatus?: string;
  isSimulating?: boolean;
  onToggleSimulation?: () => void;
  onUseLiveLocationAsPickup?: (coords: LatLng, address: string) => void;
  onRetryGPS?: () => void;
  passengerAvatarUrl?: string;
  passengerName?: string;
  nearestLandmark?: string;
  compassDirection?: string;
}

type MapLayerType = 'streets' | 'satellite' | 'terrain';

// Regional Default Center
const DEFAULT_CENTER: LatLng = { lat: 30.7180, lng: 76.7650 };

export const GoogleMapBackground: React.FC<GoogleMapBackgroundProps> = ({
  pickupLocation,
  dropoffLocation,
  pickupCoords,
  dropoffCoords,
  activeRide,
  onSelectCoords,
  className = '',
  isSheetCollapsed = false,
  passengerLiveLocation,
  passengerLiveHeading = 0,
  passengerLiveSpeed = 0,
  passengerLiveAccuracy = 12,
  passengerLiveStatus = 'active',
  isSimulating = false,
  onToggleSimulation,
  onUseLiveLocationAsPickup,
  onRetryGPS,
  passengerAvatarUrl,
  passengerName = 'You',
  nearestLandmark,
  compassDirection = 'N',
}) => {
  const { isLight } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const trafficLayerRef = useRef<L.TileLayer | null>(null);

  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropoffMarkerRef = useRef<L.Marker | null>(null);
  const captainMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const nearbyCaptainsGroupRef = useRef<L.LayerGroup | null>(null);

  // Passenger Live GPS Refs
  const passengerLiveMarkerRef = useRef<L.Marker | null>(null);
  const passengerAccuracyCircleRef = useRef<L.Circle | null>(null);
  const hasCenteredOnLiveGpsRef = useRef<boolean>(false);

  const [mapLayer, setMapLayer] = useState<MapLayerType>('streets');
  const [showTraffic, setShowTraffic] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(13);

  // Resolved coordinates
  const resolvedPickup = useMemo(() => {
    if (pickupCoords && pickupCoords.lat && pickupCoords.lng) return pickupCoords;
    if (activeRide?.pickup_location) return resolveLocationCoords(activeRide.pickup_location);
    if (pickupLocation) return resolveLocationCoords(pickupLocation);
    return null;
  }, [pickupCoords, activeRide?.pickup_location, pickupLocation]);

  const resolvedDropoff = useMemo(() => {
    if (dropoffCoords && dropoffCoords.lat && dropoffCoords.lng) return dropoffCoords;
    if (activeRide?.dropoff_location) return resolveLocationCoords(activeRide.dropoff_location);
    if (dropoffLocation) return resolveLocationCoords(dropoffLocation);
    return null;
  }, [dropoffCoords, activeRide?.dropoff_location, dropoffLocation]);

  // Google Maps Tile URL based on selected layer type
  const getGoogleTileUrl = (type: MapLayerType) => {
    switch (type) {
      case 'satellite':
        // Hybrid: Satellite imagery + Google road/place labels
        return 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      case 'terrain':
        // Shaded terrain with roads
        return 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
      case 'streets':
      default:
        // Clean Google Road Map
        return 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialCenter = resolvedPickup || DEFAULT_CENTER;

    const map = L.map(mapContainerRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    // Base Google Maps Layer
    const baseTile = L.tileLayer(getGoogleTileUrl('streets'), {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
      attribution: 'Map data &copy; Google',
    }).addTo(map);

    tileLayerRef.current = baseTile;

    // Optional Google Traffic Layer
    const trafficTile = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
      opacity: 0.75,
    });
    trafficLayerRef.current = trafficTile;
    if (showTraffic) {
      trafficTile.addTo(map);
    }

    // Nearby Captains Group
    const nearbyGroup = L.layerGroup().addTo(map);
    nearbyCaptainsGroupRef.current = nearbyGroup;

    // Track zoom
    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    // Map Click
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onSelectCoords) {
        onSelectCoords({ lat: e.latlng.lat, lng: e.latlng.lng }, resolvedPickup ? 'dropoff' : 'pickup');
      }
    });

    mapInstanceRef.current = map;

    // Invalidate size on load
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Base Layer when mapLayer changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const newTile = L.tileLayer(getGoogleTileUrl(mapLayer), {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
      attribution: 'Map data &copy; Google',
    }).addTo(map);

    tileLayerRef.current = newTile;

    // Ensure traffic layer stays on top if enabled
    if (trafficLayerRef.current && showTraffic) {
      map.removeLayer(trafficLayerRef.current);
      trafficLayerRef.current.addTo(map);
    }
  }, [mapLayer]);

  // Toggle Traffic Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !trafficLayerRef.current) return;

    if (showTraffic) {
      if (!map.hasLayer(trafficLayerRef.current)) {
        trafficLayerRef.current.addTo(map);
      }
    } else {
      if (map.hasLayer(trafficLayerRef.current)) {
        map.removeLayer(trafficLayerRef.current);
      }
    }
  }, [showTraffic]);

  // Handle Sheet Collapse / Expand Resize
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setTimeout(() => {
      map.invalidateSize();
      fitMapBounds();
    }, 300);
  }, [isSheetCollapsed]);

  // Helper to Fit Bounds with dynamic bottom padding so markers stay above the bottom sheet
  const fitMapBounds = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const bottomPadding = isSheetCollapsed
      ? 100
      : Math.max(220, Math.round(window.innerHeight * 0.46));

    if (resolvedPickup && resolvedDropoff) {
      const bounds = L.latLngBounds(
        [resolvedPickup.lat, resolvedPickup.lng],
        [resolvedDropoff.lat, resolvedDropoff.lng]
      );
      map.fitBounds(bounds, {
        paddingTopLeft: [50, 50],
        paddingBottomRight: [50, bottomPadding],
        maxZoom: 15,
        animate: true,
      });
    } else if (resolvedPickup) {
      map.flyTo([resolvedPickup.lat, resolvedPickup.lng], 14, { animate: true });
    } else if (resolvedDropoff) {
      map.flyTo([resolvedDropoff.lat, resolvedDropoff.lng], 14, { animate: true });
    } else if (passengerLiveLocation) {
      map.flyTo([passengerLiveLocation.lat, passengerLiveLocation.lng], 15, { animate: true });
    }
  };

  // Render Simulated Nearby Captains (Moto Icons) around current center
  useEffect(() => {
    const group = nearbyCaptainsGroupRef.current;
    if (!group) return;

    group.clearLayers();

    // Center point
    const center = resolvedPickup || DEFAULT_CENTER;

    // Generate 4-5 nearby simulated moto drivers
    const nearbyOffsets = [
      { dLat: 0.004, dLng: 0.003, name: 'Captain Rahul', rating: '4.9★', vehicle: 'Honda Activa' },
      { dLat: -0.003, dLng: 0.005, name: 'Captain Vikram', rating: '5.0★', vehicle: 'Bajaj Pulsar' },
      { dLat: 0.002, dLng: -0.004, name: 'Captain Aman', rating: '4.8★', vehicle: 'Hero Splendor' },
      { dLat: -0.005, dLng: -0.002, name: 'Captain Gurpreet', rating: '4.9★', vehicle: 'TVS Jupiter' },
    ];

    nearbyOffsets.forEach((item, idx) => {
      const motoIcon = L.divIcon({
        className: 'custom-moto-marker',
        html: `
          <div class="relative group cursor-pointer">
            <div class="w-8 h-8 rounded-full bg-slate-950 border-2 border-amber-400 text-white flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
              <span class="text-sm">🏍️</span>
            </div>
            <div class="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border border-white"></div>
            <div class="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded whitespace-nowrap pointer-events-none shadow-md">
              ${item.name} · ${item.rating}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([center.lat + item.dLat, center.lng + item.dLng], { icon: motoIcon });
      group.addLayer(marker);
    });
  }, [resolvedPickup]);

  // Update Pickup & Dropoff Markers and Polyline Route
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Pickup Marker
    if (resolvedPickup) {
      const pickupIcon = L.divIcon({
        className: 'custom-pickup-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-10 h-10 rounded-full bg-emerald-500/30 animate-ping"></div>
            <div class="w-9 h-9 rounded-2xl bg-emerald-500 border-2 border-white text-slate-950 font-black text-sm flex items-center justify-center shadow-xl">
              A
            </div>
            <div class="absolute -bottom-1 w-2 h-2 bg-emerald-600 rotate-45"></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setLatLng([resolvedPickup.lat, resolvedPickup.lng]);
      } else {
        pickupMarkerRef.current = L.marker([resolvedPickup.lat, resolvedPickup.lng], { icon: pickupIcon })
          .bindPopup(`<strong>Pickup Location:</strong><br>${pickupLocation || 'Selected Pickup Point'}`)
          .addTo(map);
      }
    } else if (pickupMarkerRef.current) {
      map.removeLayer(pickupMarkerRef.current);
      pickupMarkerRef.current = null;
    }

    // 2. Dropoff Marker
    if (resolvedDropoff) {
      const dropoffIcon = L.divIcon({
        className: 'custom-dropoff-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-10 h-10 rounded-full bg-rose-500/30 animate-pulse"></div>
            <div class="w-9 h-9 rounded-2xl bg-rose-600 border-2 border-white text-white font-black text-sm flex items-center justify-center shadow-xl">
              B
            </div>
            <div class="absolute -bottom-1 w-2 h-2 bg-rose-700 rotate-45"></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.setLatLng([resolvedDropoff.lat, resolvedDropoff.lng]);
      } else {
        dropoffMarkerRef.current = L.marker([resolvedDropoff.lat, resolvedDropoff.lng], { icon: dropoffIcon })
          .bindPopup(`<strong>Dropoff Location:</strong><br>${dropoffLocation || 'Selected Dropoff Point'}`)
          .addTo(map);
      }
    } else if (dropoffMarkerRef.current) {
      map.removeLayer(dropoffMarkerRef.current);
      dropoffMarkerRef.current = null;
    }

    // 3. Active Captain Marker
    if (activeRide && ['accepted', 'arrived', 'started'].includes(activeRide.status) && resolvedPickup) {
      const captainLat = activeRide.status === 'arrived'
        ? resolvedPickup.lat
        : activeRide.status === 'started' && resolvedDropoff
        ? (resolvedPickup.lat + resolvedDropoff.lat) / 2
        : resolvedPickup.lat + 0.002;

      const captainLng = activeRide.status === 'arrived'
        ? resolvedPickup.lng
        : activeRide.status === 'started' && resolvedDropoff
        ? (resolvedPickup.lng + resolvedDropoff.lng) / 2
        : resolvedPickup.lng + 0.002;

      const liveCaptainIcon = L.divIcon({
        className: 'live-captain-marker',
        html: `
          <div class="relative flex flex-col items-center">
            <div class="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[9px] shadow uppercase mb-1">
              ${activeRide.status === 'arrived' ? 'Captain Here' : 'Captain Moto'}
            </div>
            <div class="w-10 h-10 rounded-2xl bg-amber-400 border-2 border-slate-950 text-slate-950 flex items-center justify-center text-lg shadow-2xl animate-bounce">
              🏍️
            </div>
          </div>
        `,
        iconSize: [40, 56],
        iconAnchor: [20, 56],
      });

      if (captainMarkerRef.current) {
        captainMarkerRef.current.setLatLng([captainLat, captainLng]);
      } else {
        captainMarkerRef.current = L.marker([captainLat, captainLng], { icon: liveCaptainIcon }).addTo(map);
      }
    } else if (captainMarkerRef.current) {
      map.removeLayer(captainMarkerRef.current);
      captainMarkerRef.current = null;
    }

    // 4. Route Polyline
    if (resolvedPickup && resolvedDropoff) {
      // Calculate realistic waypoint interpolation along roads
      const p1 = resolvedPickup;
      const p2 = resolvedDropoff;
      const midLat = (p1.lat + p2.lat) / 2 + 0.001;
      const midLng = (p1.lng + p2.lng) / 2 - 0.001;

      const routePoints: [number, number][] = [
        [p1.lat, p1.lng],
        [midLat, midLng],
        [p2.lat, p2.lng],
      ];

      if (routePolylineRef.current) {
        routePolylineRef.current.setLatLngs(routePoints);
      } else {
        const polyline = L.polyline(routePoints, {
          color: '#10b981', // Emerald
          weight: 6,
          opacity: 0.85,
          lineJoin: 'round',
          dashArray: '8, 8',
        }).addTo(map);
        routePolylineRef.current = polyline;
      }

      fitMapBounds();
    } else if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
  }, [resolvedPickup, resolvedDropoff, activeRide?.status]);

  // 5. Update Passenger Real-Time Live Location Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (passengerLiveLocation) {
      const lat = passengerLiveLocation.lat;
      const lng = passengerLiveLocation.lng;
      const accuracy = passengerLiveAccuracy || 12;

      // Subtle Accuracy Circle
      if (passengerAccuracyCircleRef.current) {
        passengerAccuracyCircleRef.current.setLatLng([lat, lng]);
        passengerAccuracyCircleRef.current.setRadius(Math.max(10, accuracy));
      } else {
        passengerAccuracyCircleRef.current = L.circle([lat, lng], {
          radius: Math.max(10, accuracy),
          color: '#3b82f6',
          weight: 1.5,
          opacity: 0.45,
          fillColor: '#3b82f6',
          fillOpacity: 0.08,
        }).addTo(map);
      }

      // Clean Standard Blue Live Location Marker with Pulse Radar and optional Avatar
      const userLocationIcon = L.divIcon({
        className: 'custom-live-passenger-marker',
        html: `
          <div class="relative flex items-center justify-center select-none cursor-pointer" style="width: 32px; height: 32px;">
            <!-- Outer Pulsing Radar Ring -->
            <div class="absolute inset-0 rounded-full bg-blue-500/35 animate-ping"></div>
            <!-- Middle Halo Ring -->
            <div class="absolute w-6 h-6 rounded-full bg-blue-500/20 border border-blue-400/40"></div>
            <!-- Core Pin / Avatar -->
            <div class="relative w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center overflow-hidden">
              ${
                passengerAvatarUrl
                  ? `<img src="${passengerAvatarUrl}" class="w-full h-full object-cover" />`
                  : `<div class="w-2 h-2 rounded-full bg-white"></div>`
              }
            </div>
            <!-- Heading Direction indicator if moving -->
            ${
              passengerLiveHeading !== undefined && passengerLiveHeading >= 0
                ? `<div class="absolute -top-1 w-2 h-2 border-t-2 border-r-2 border-blue-500 origin-bottom pointer-events-none" style="transform: rotate(${passengerLiveHeading}deg) translateY(-8px);"></div>`
                : ''
            }
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const popupContent = `
        <div class="p-1 min-w-[210px] font-sans text-slate-900">
          <div class="flex items-center justify-between gap-2 mb-1.5 border-b border-slate-100 pb-1">
            <div class="font-bold text-xs text-blue-600 flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span>📍 Your Real-Time GPS</span>
            </div>
            <span class="text-[9px] font-mono text-slate-400 font-semibold">±${accuracy}m</span>
          </div>
          <div class="text-[12px] text-slate-900 font-bold mb-0.5">
            ${nearestLandmark || 'Current GPS Location'}
          </div>
          <div class="text-[10px] text-slate-500 font-mono mb-2">
            ${lat.toFixed(5)}, ${lng.toFixed(5)}
          </div>
          <div class="flex items-center gap-1.5">
            <button
              class="flex-1 py-1.5 px-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] rounded-lg cursor-pointer shadow-xs transition-colors"
              onclick="window.dispatchEvent(new CustomEvent('motoride-set-live-pickup'))"
            >
              Set as Pickup
            </button>
            <button
              class="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-lg cursor-pointer border border-blue-200 transition-colors"
              onclick="window.dispatchEvent(new CustomEvent('motoride-center-on-gps'))"
            >
              Center
            </button>
          </div>
        </div>
      `;

      if (passengerLiveMarkerRef.current) {
        passengerLiveMarkerRef.current.setLatLng([lat, lng]);
        passengerLiveMarkerRef.current.setIcon(userLocationIcon);
        passengerLiveMarkerRef.current.setPopupContent(popupContent);
      } else {
        const marker = L.marker([lat, lng], { icon: userLocationIcon, zIndexOffset: 1000 }).addTo(map);
        marker.bindPopup(popupContent);
        // Bind permanent clean floating tooltip so location is immediately visible on map
        marker.bindTooltip(`
          <div class="px-2 py-0.5 text-[10px] font-black text-blue-700 bg-white/95 rounded-full shadow-md border border-blue-200/90 flex items-center gap-1 whitespace-nowrap pointer-events-none">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
            <span>${nearestLandmark ? nearestLandmark.split(',')[0] : 'You are here'}</span>
          </div>
        `, {
          permanent: true,
          direction: 'top',
          offset: [0, -16],
          className: 'live-location-tooltip',
        });
        passengerLiveMarkerRef.current = marker;
      }

      // Initial auto-center on passenger live GPS if no pickup already chosen
      if (!hasCenteredOnLiveGpsRef.current && !resolvedPickup) {
        hasCenteredOnLiveGpsRef.current = true;
        map.flyTo([lat, lng], 15, { duration: 1.0 });
      }
    } else {
      if (passengerAccuracyCircleRef.current) {
        map.removeLayer(passengerAccuracyCircleRef.current);
        passengerAccuracyCircleRef.current = null;
      }
      if (passengerLiveMarkerRef.current) {
        map.removeLayer(passengerLiveMarkerRef.current);
        passengerLiveMarkerRef.current = null;
      }
    }
  }, [
    passengerLiveLocation,
    passengerLiveAccuracy,
    passengerLiveHeading,
    passengerAvatarUrl,
    nearestLandmark,
    resolvedPickup,
  ]);

  // Center on Passenger Live GPS
  const handleCenterOnPassengerGPS = () => {
    const map = mapInstanceRef.current;
    if (!map || !passengerLiveLocation) return;
    map.flyTo([passengerLiveLocation.lat, passengerLiveLocation.lng], 16, {
      duration: 0.8,
    });
    if (passengerLiveMarkerRef.current) {
      passengerLiveMarkerRef.current.openPopup();
    }
  };

  // Listen to custom events from popup or external dashboard triggers
  useEffect(() => {
    const handleSetLivePickup = () => {
      if (passengerLiveLocation && onUseLiveLocationAsPickup) {
        const placeName = nearestLandmark || 'Current Location';
        onUseLiveLocationAsPickup(passengerLiveLocation, placeName);
      }
    };
    const handleCenterGPS = () => {
      handleCenterOnPassengerGPS();
    };

    window.addEventListener('motoride-set-live-pickup', handleSetLivePickup);
    window.addEventListener('motoride-center-on-gps', handleCenterGPS);

    return () => {
      window.removeEventListener('motoride-set-live-pickup', handleSetLivePickup);
      window.removeEventListener('motoride-center-on-gps', handleCenterGPS);
    };
  }, [passengerLiveLocation, nearestLandmark, onUseLiveLocationAsPickup]);

  // Zoom controls
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  return (
    <div
      id="google-map-background-container"
      className={`absolute inset-0 w-full h-full overflow-hidden select-none ${className}`}
    >
      {/* Full-bleed Leaflet Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0 cursor-grab active:cursor-grabbing" />

      {/* Floating Top Controls Bar on Map */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        {/* Left: Map Branding & Live Traffic Badge & My Location Pill */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div
            className={`px-3 py-1.5 rounded-2xl border shadow-lg backdrop-blur-md flex items-center gap-2 text-xs font-bold transition-all ${
              isLight
                ? 'bg-white/90 border-slate-200 text-slate-900 shadow-slate-200/50'
                : 'bg-slate-950/85 border-slate-800 text-slate-100 shadow-black/40'
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span>Google Maps</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 uppercase font-black tracking-wider">
              Live
            </span>
          </div>

          {/* Passenger Current GPS Location pill on map */}
          {passengerLiveLocation && (
            <button
              type="button"
              id="map-my-location-pill-btn"
              onClick={handleCenterOnPassengerGPS}
              className={`px-2.5 py-1.5 rounded-xl border shadow-md backdrop-blur-md flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                isLight
                  ? 'bg-white/90 hover:bg-white text-blue-600 border-blue-200 shadow-blue-500/10'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-blue-400 border-blue-900/60 shadow-black/40'
              }`}
              title="Click to center map on your real-time GPS location"
            >
              <Navigation className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20" />
              <span className="max-w-[130px] truncate hidden sm:inline">
                {nearestLandmark ? nearestLandmark.split(',')[0] : 'My Location'}
              </span>
              <span className="sm:hidden text-[11px]">GPS</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowTraffic((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-xl border shadow-md backdrop-blur-md flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors ${
              showTraffic
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                : isLight
                ? 'bg-white/90 text-slate-600 border-slate-200'
                : 'bg-slate-900/90 text-slate-400 border-slate-800'
            }`}
            title="Toggle Live Google Traffic Layer"
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Traffic</span>
          </button>
        </div>

        {/* Right: Map Type Selector & Recenter/Zoom Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Map Layer Switcher (Streets, Satellite, Terrain) */}
          <div
            className={`p-1 rounded-2xl border shadow-lg backdrop-blur-md flex items-center gap-1 text-xs ${
              isLight ? 'bg-white/90 border-slate-200' : 'bg-slate-950/85 border-slate-800'
            }`}
          >
            {(['streets', 'satellite', 'terrain'] as MapLayerType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMapLayer(type)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold capitalize transition-all cursor-pointer ${
                  mapLayer === type
                    ? 'bg-emerald-500 text-slate-950 shadow-sm font-black'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Dedicated Recenter on My Real-Time GPS Button */}
          {passengerLiveLocation && (
            <button
              type="button"
              id="map-locate-my-gps-btn"
              onClick={handleCenterOnPassengerGPS}
              className={`p-2 rounded-xl border shadow-md backdrop-blur-md text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                isLight
                  ? 'bg-white/90 hover:bg-blue-50 text-blue-600 border-blue-200 shadow-blue-500/10'
                  : 'bg-slate-950/85 hover:bg-blue-950/60 text-blue-400 border-blue-900/60 shadow-black/40'
              }`}
              title="Center Map on My Real-Time GPS Location"
            >
              <Navigation className="w-4 h-4 text-blue-500 fill-blue-500/20" />
            </button>
          )}

          {/* Recenter Bounds Button */}
          <button
            type="button"
            onClick={fitMapBounds}
            className={`p-2 rounded-xl border shadow-md backdrop-blur-md text-xs font-bold transition-all cursor-pointer active:scale-95 ${
              isLight
                ? 'bg-white/90 hover:bg-white text-slate-800 border-slate-200'
                : 'bg-slate-950/85 hover:bg-slate-900 text-slate-200 border-slate-800'
            }`}
            title="Recenter Map on Trip Route"
          >
            <Locate className="w-4 h-4 text-emerald-500" />
          </button>

          {/* Zoom In/Out Buttons */}
          <div
            className={`flex flex-col rounded-xl border shadow-md backdrop-blur-md overflow-hidden ${
              isLight ? 'bg-white/90 border-slate-200' : 'bg-slate-950/85 border-slate-800'
            }`}
          >
            <button
              type="button"
              onClick={handleZoomIn}
              className={`p-1.5 hover:bg-emerald-500 hover:text-slate-950 transition-colors cursor-pointer border-b ${
                isLight ? 'text-slate-700 border-slate-200' : 'text-slate-300 border-slate-800'
              }`}
              title="Zoom In"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className={`p-1.5 hover:bg-emerald-500 hover:text-slate-950 transition-colors cursor-pointer ${
                isLight ? 'text-slate-700' : 'text-slate-300'
              }`}
              title="Zoom Out"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Official Google Maps Watermark & Attribution Footer */}
      <div className="absolute bottom-2 left-3 z-10 pointer-events-none flex items-center gap-2">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-950/80 backdrop-blur-xs border border-slate-300/40 text-[10px] font-bold text-slate-700 dark:text-slate-300 shadow-xs">
          <span className="text-[#4285F4]">G</span>
          <span className="text-[#EA4335]">o</span>
          <span className="text-[#FBBC05]">o</span>
          <span className="text-[#4285F4]">g</span>
          <span className="text-[#34A853]">l</span>
          <span className="text-[#EA4335]">e</span>
          <span className="text-[9px] text-slate-400 ml-1 font-normal">Maps</span>
        </div>
        <span className="text-[9px] text-slate-500 dark:text-slate-400 font-sans hidden sm:inline">
          Map data ©{new Date().getFullYear()} Google
        </span>
      </div>
    </div>
  );
};
