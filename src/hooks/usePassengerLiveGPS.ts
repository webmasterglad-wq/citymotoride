import { useState, useEffect, useRef, useCallback } from 'react';
import { LatLng, calculateHeading, calculateDistanceKm, findNearestLandmark } from '../utils/geoUtils';

export type GPSStatus = 'acquiring' | 'active' | 'simulated' | 'permission_denied' | 'outside_area' | 'error';

export interface PassengerLiveGPSState {
  coords: LatLng;
  hasDeviceFix: boolean;
  heading: number; // 0 - 359 degrees
  speed: number; // km/h
  accuracy: number; // meters
  status: GPSStatus;
  isSimulating: boolean;
  isOutsideServiceArea: boolean;
  isFollowMode: boolean;
  nearestLandmark: string;
  distanceToLandmarkKm: number;
  compassDirection: string;
  lastUpdated: number;
}

// Tricity Key Hubs for quick testing or outside-area repositioning
export const TRICITY_HUBS: Record<string, { name: string; coords: LatLng }> = {
  sector17: { name: 'Sector 17 Plaza, Chandigarh', coords: { lat: 30.7398, lng: 76.7827 } },
  mohali: { name: 'Phase 7 Market, Mohali', coords: { lat: 30.7088, lng: 76.7135 } },
  panchkula: { name: 'Sector 5 Urban Estate, Panchkula', coords: { lat: 30.6945, lng: 76.8520 } },
  zirakpur: { name: 'VIP Road Junction, Zirakpur', coords: { lat: 30.6420, lng: 76.8180 } },
  elante: { name: 'Elante Mall, Industrial Area Phase 1', coords: { lat: 30.7055, lng: 76.8013 } },
};

// Tricity Route Waypoints for realistic simulated movement
const SIMULATED_TRICITY_WAYPOINTS: LatLng[] = [
  { lat: 30.7398, lng: 76.7827 }, // Sector 17 Plaza, Chandigarh
  { lat: 30.7350, lng: 76.7780 }, // Jan Marg Chowk
  { lat: 30.7305, lng: 76.7725 }, // Sector 22 Market
  { lat: 30.7235, lng: 76.7661 }, // Sector 35 Aroma Chowk
  { lat: 30.7180, lng: 76.7489 }, // ISBT Sector 43
  { lat: 30.7100, lng: 76.7320 }, // Mohali Sector 51 / Phase 7 Border
  { lat: 30.7088, lng: 76.7135 }, // Phase 7 Market, Mohali
  { lat: 30.7020, lng: 76.6980 }, // QuarkCity IT SEZ
  { lat: 30.7160, lng: 76.7245 }, // Phase 3B2 Chowk
  { lat: 30.7055, lng: 76.8013 }, // Elante Mall
  { lat: 30.7289, lng: 76.8421 }, // IT Park Chandigarh
];

function getCompassDirection(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((deg % 360) / 45)) % 8;
  return directions[index];
}

export function usePassengerLiveGPS(initialCoords?: LatLng | null) {
  const [coords, setCoords] = useState<LatLng>(() => {
    return initialCoords || TRICITY_HUBS.sector17.coords; // Sector 17 Plaza Default
  });

  const [hasDeviceFix, setHasDeviceFix] = useState<boolean>(false);
  const [heading, setHeading] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(10); // ±10m
  const [status, setStatus] = useState<GPSStatus>('acquiring');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isFollowMode, setIsFollowMode] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const watchIdRef = useRef<number | null>(null);
  const simulationStepRef = useRef<number>(0);
  const simulationIntervalRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<LatLng>(coords);

  // Derive nearest landmark and check if within service bounds
  const landmarkInfo = findNearestLandmark(coords);
  const isOutsideServiceArea = landmarkInfo.isOutsideServiceArea;

  // 1. Device Orientation Listener (for real compass heading on mobile)
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // webkitCompassHeading for iOS Safari, alpha for Android/standard
      // @ts-expect-error webkitCompassHeading is iOS specific
      if (typeof e.webkitCompassHeading === 'number') {
        // @ts-expect-error webkitCompassHeading is iOS specific
        setHeading(Math.round(e.webkitCompassHeading));
      } else if (e.alpha !== null) {
        // 360 - alpha gives compass heading relative to North
        const compassHeading = Math.round(360 - e.alpha);
        setHeading((compassHeading + 360) % 360);
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, []);

  // 2. Real-time Geolocation Watcher
  const startRealGPS = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setStatus('error');
      return;
    }

    setStatus('acquiring');

    const handleSuccess = (pos: GeolocationPosition) => {
      const newCoords: LatLng = {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
      };

      // Compute directional heading if user moved significantly
      if (lastCoordsRef.current) {
        const distKm = calculateDistanceKm(lastCoordsRef.current, newCoords);
        if (distKm > 0.003) {
          const newBearing = calculateHeading(lastCoordsRef.current, newCoords);
          setHeading(Math.round(newBearing));
        }
      }

      setCoords(newCoords);
      lastCoordsRef.current = newCoords;
      setHasDeviceFix(true);
      setAccuracy(Math.round(pos.coords.accuracy || 8));

      if (pos.coords.heading !== null && !isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
        setHeading(Math.round(pos.coords.heading));
      }
      if (pos.coords.speed !== null && !isNaN(pos.coords.speed) && pos.coords.speed >= 0) {
        setSpeed(Math.round(pos.coords.speed * 3.6));
      } else {
        setSpeed(0);
      }

      const landmark = findNearestLandmark(newCoords);
      if (landmark.isOutsideServiceArea) {
        setStatus('outside_area');
      } else {
        setStatus('active');
      }

      setIsSimulating(false);
      setLastUpdated(Date.now());
    };

    // First attempt: Fast high-accuracy query with graceful fallback
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (err) => {
        console.info('High-accuracy GPS request timed out or unassisted, falling back to standard accuracy:', err.message);
        if (err.code === err.PERMISSION_DENIED) {
          setStatus('permission_denied');
          return;
        }

        // Second attempt: Standard accuracy (WiFi/cell/network)
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (lowErr) => {
            console.warn('Standard-accuracy Geolocation failed:', lowErr.message);
            if (lowErr.code === lowErr.PERMISSION_DENIED) {
              setStatus('permission_denied');
            } else {
              setStatus('error');
            }
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
    );

    // Continuous watchPosition for live location updates
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          handleSuccess(pos);
        },
        (watchErr) => {
          if (watchErr.code === watchErr.PERMISSION_DENIED) {
            setStatus('permission_denied');
          }
        },
        { enableHighAccuracy: false, maximumAge: 4000, timeout: 20000 }
      );
    } catch (e) {
      console.warn('Could not initialize watchPosition:', e);
    }
  }, []);

  // 3. Simulated Motion Interval (Only runs when explicitly activated by user)
  useEffect(() => {
    if (isSimulating) {
      setStatus('simulated');
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }

      simulationIntervalRef.current = window.setInterval(() => {
        simulationStepRef.current += 1;
        const totalWaypoints = SIMULATED_TRICITY_WAYPOINTS.length;
        const currIndex = Math.floor(simulationStepRef.current / 15) % totalWaypoints;
        const nextIndex = (currIndex + 1) % totalWaypoints;

        const p1 = SIMULATED_TRICITY_WAYPOINTS[currIndex];
        const p2 = SIMULATED_TRICITY_WAYPOINTS[nextIndex];
        const fraction = (simulationStepRef.current % 15) / 15;

        // Micro-jitter to mimic realistic GPS motion
        const jitterLat = (Math.sin(simulationStepRef.current * 0.7) * 0.00006);
        const jitterLng = (Math.cos(simulationStepRef.current * 0.7) * 0.00006);

        const simLat = p1.lat + (p2.lat - p1.lat) * fraction + jitterLat;
        const simLng = p1.lng + (p2.lng - p1.lng) * fraction + jitterLng;

        const newPoint: LatLng = {
          lat: Number(simLat.toFixed(6)),
          lng: Number(simLng.toFixed(6)),
        };

        const calculatedBearing = calculateHeading(p1, p2);
        setHeading(Math.round(calculatedBearing));
        setCoords(newPoint);
        setSpeed(18 + Math.round(Math.sin(simulationStepRef.current * 0.5) * 8)); // 10-26 km/h
        setAccuracy(6 + Math.round(Math.sin(simulationStepRef.current) * 3)); // 4-9 meters
        setLastUpdated(Date.now());
      }, 1200);
    } else {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
    }

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
    };
  }, [isSimulating]);

  // Initial GPS start
  useEffect(() => {
    startRealGPS();

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, [startRealGPS]);

  // Toggle between real GPS and test simulation
  const toggleSimulation = useCallback(() => {
    setIsSimulating((prev) => {
      const next = !prev;
      if (!next) {
        startRealGPS();
      } else {
        if (watchIdRef.current !== null && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        setStatus('simulated');
      }
      return next;
    });
  }, [startRealGPS]);

  // Quick teleportation to a designated Tricity service hub
  const teleportToTricity = useCallback((hubKey: keyof typeof TRICITY_HUBS = 'sector17') => {
    const target = TRICITY_HUBS[hubKey] || TRICITY_HUBS.sector17;
    setCoords(target.coords);
    lastCoordsRef.current = target.coords;
    setSpeed(0);
    setAccuracy(10);
    setStatus('active');
    setIsSimulating(false);
    setLastUpdated(Date.now());
  }, []);

  return {
    coords,
    hasDeviceFix,
    heading,
    speed,
    accuracy,
    status,
    isSimulating,
    isOutsideServiceArea,
    isFollowMode,
    setIsFollowMode,
    nearestLandmark: landmarkInfo.name,
    distanceToLandmarkKm: landmarkInfo.distanceKm,
    compassDirection: getCompassDirection(heading),
    lastUpdated,
    setCoords,
    startRealGPS,
    retryGPS: startRealGPS,
    toggleSimulation,
    teleportToTricity,
  };
}
