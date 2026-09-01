import React, { useState } from 'react';
import {
  Calculator,
  X,
  MapPin,
  Clock,
  Navigation,
  ShieldCheck,
  Zap,
  Flame,
  Info,
  ChevronRight,
  TrendingUp,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { FareBreakdown, DEFAULT_PRICING, calculateMotoFare } from '../utils/fareCalculator';
import { useTheme } from '../context/ThemeContext';
import { usePricing } from '../context/PricingContext';

interface FareCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  breakdown?: FareBreakdown;
  pickupLocation?: string;
  dropoffLocation?: string;
  initialDistanceKm?: number;
  initialEstimatedMins?: number;
  initialPickup?: string;
  initialDropoff?: string;
  initialTierId?: string;
  onApplyDistance?: (distanceKm: number, estimatedMins: number) => void;
  onApplySimulatedRoute?: (distanceKm: number, estimatedMins: number) => void;
}

export const FareCalculatorModal: React.FC<FareCalculatorModalProps> = ({
  isOpen,
  onClose,
  breakdown: propBreakdown,
  pickupLocation = '',
  dropoffLocation = '',
  initialDistanceKm,
  initialEstimatedMins,
  initialPickup = '',
  initialDropoff = '',
  initialTierId = 'moto_comfort',
  onApplyDistance,
  onApplySimulatedRoute,
}) => {
  const { isLight } = useTheme();
  const { calculateFare, pricing } = usePricing();

  const effectivePickup = pickupLocation || initialPickup || 'Pickup Location';
  const effectiveDropoff = dropoffLocation || initialDropoff || 'Drop-off Destination';
  const effectiveInitialDist = propBreakdown?.distanceKm ?? initialDistanceKm ?? 5.0;
  const effectiveInitialTier = propBreakdown?.tierId ?? initialTierId ?? 'moto_comfort';
  const effectiveInitialSurge = propBreakdown?.surgeMultiplier ?? 1.0;

  const [testDistance, setTestDistance] = useState<number>(effectiveInitialDist);
  const [testTier, setTestTier] = useState<string>(effectiveInitialTier);
  const [testSurge, setTestSurge] = useState<number>(effectiveInitialSurge);

  // Sync state whenever modal opens or props change
  React.useEffect(() => {
    if (isOpen) {
      setTestDistance(propBreakdown?.distanceKm ?? initialDistanceKm ?? 5.0);
      setTestTier(propBreakdown?.tierId ?? initialTierId ?? 'moto_comfort');
      setTestSurge(propBreakdown?.surgeMultiplier ?? 1.0);
    }
  }, [isOpen, propBreakdown, initialDistanceKm, initialTierId]);

  if (!isOpen) return null;

  const simulatedMins = Math.max(3, Math.round(testDistance * 2.2 + 3));
  const activeTierConfig = testTier === 'moto_delivery' ? pricing.tierPricing.moto_delivery : pricing.tierPricing.moto_comfort;

  const effectiveBreakdown: FareBreakdown = propBreakdown ?? calculateFare({
    distanceKm: testDistance,
    estimatedMins: simulatedMins,
    tierId: testTier,
    tierName: activeTierConfig.name,
    pickupLocation: effectivePickup,
    customSurgeMultiplier: testSurge,
  });

  const simBreakdown = calculateFare({
    distanceKm: testDistance,
    estimatedMins: simulatedMins,
    tierId: testTier,
    tierName: activeTierConfig.name,
    customSurgeMultiplier: testSurge,
  });

  const handleApply = () => {
    if (onApplyDistance) {
      onApplyDistance(testDistance, simulatedMins);
    }
    if (onApplySimulatedRoute) {
      onApplySimulatedRoute(testDistance, simulatedMins);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-200 ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0b0f19] border-slate-800 text-slate-100'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/90 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight">Distance Fare Calculator</h3>
              <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Transparent Tricity Moto Pricing Formula
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Active Trip Summary */}
          <div
            className={`p-3.5 rounded-2xl border space-y-2.5 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className={`font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Current Route</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-md font-black ${
                  effectiveBreakdown.isAccurateRoute
                    ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                    : 'bg-sky-500/20 text-sky-600 border border-sky-500/30'
                }`}
              >
                {effectiveBreakdown.isAccurateRoute ? 'Live Road Routing' : 'Geographic Grid'}
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold text-xs mt-0.5">●</span>
                <span className="truncate font-semibold">{effectivePickup}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-500 font-bold text-xs mt-0.5">■</span>
                <span className="truncate font-semibold">{effectiveDropoff}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Navigation className="w-3.5 h-3.5 text-sky-500" />
                <span>{effectiveBreakdown.distanceKm} km Distance</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>~{effectiveBreakdown.timeMinutes} mins ETA</span>
              </div>
            </div>
          </div>

          {/* Admin Dispatch Rates Sync Badge */}
          <div
            className={`p-2.5 rounded-xl border flex items-center justify-between text-[11px] ${
              isLight ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>{activeTierConfig.name} Rate Engine</span>
            </div>
            <span className="font-mono text-[10px] font-semibold">
              Base ₹{effectiveBreakdown.baseFare.toFixed(2)} · ₹{effectiveBreakdown.perKmRate.toFixed(2)}/km {pricing.surgeMultiplier > 1.0 ? `· ${pricing.surgeMultiplier}x Surge` : ''}
            </span>
          </div>

          {/* Detailed Mathematical Calculation Breakdown */}
          <div className="space-y-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Fare Line Items ({activeTierConfig.name} Formula)
            </span>

            <div
              className={`rounded-2xl border divide-y overflow-hidden text-xs ${
                isLight ? 'bg-white border-slate-200 divide-slate-100' : 'bg-slate-900/80 border-slate-800 divide-slate-800'
              }`}
            >
              {/* Base Fare */}
              <div className="p-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold block">Base Fare</span>
                  <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Includes first {effectiveBreakdown.baseIncludedKm} km
                  </span>
                </div>
                <span className="font-black">₹{effectiveBreakdown.baseFare.toFixed(2)}</span>
              </div>

              {/* Distance Rate */}
              <div className="p-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold block">Distance Charge</span>
                  <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {effectiveBreakdown.billableDistanceKm} km × ₹{effectiveBreakdown.perKmRate.toFixed(2)}/km
                  </span>
                </div>
                <span className="font-black text-sky-600">
                  +₹{effectiveBreakdown.distanceFare.toFixed(2)}
                </span>
              </div>

              {/* Time Rate */}
              <div className="p-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold block">Time & Traffic Rate</span>
                  <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {effectiveBreakdown.timeMinutes} mins × ₹{effectiveBreakdown.perMinuteRate.toFixed(2)}/min
                  </span>
                </div>
                <span className="font-black text-amber-600">
                  +₹{effectiveBreakdown.timeFare.toFixed(2)}
                </span>
              </div>

              {/* Zone Surge if > 1.0 */}
              {effectiveBreakdown.surgeMultiplier > 1.0 && (
                <div className="p-2.5 flex items-center justify-between bg-amber-500/10">
                  <div>
                    <span className="font-bold flex items-center gap-1 text-amber-700 dark:text-amber-300">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      Zone Peak Surge ({effectiveBreakdown.surgeMultiplier}x)
                    </span>
                    <span className="text-[10px] text-amber-600/80">
                      {effectiveBreakdown.zoneName} high demand
                    </span>
                  </div>
                  <span className="font-black text-amber-600">
                    +₹{effectiveBreakdown.surgeAmount.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Tier Multiplier */}
              {effectiveBreakdown.tierMultiplier !== 1.0 && (
                <div className="p-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold block">{effectiveBreakdown.tierName} Multiplier</span>
                    <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Vehicle category adjustment ({effectiveBreakdown.tierMultiplier}x)
                    </span>
                  </div>
                  <span className="font-black">
                    {effectiveBreakdown.tierMultiplier}x
                  </span>
                </div>
              )}

              {/* Total Final Fare */}
              <div
                className={`p-3 flex items-center justify-between ${
                  isLight ? 'bg-emerald-50 text-emerald-950 font-black' : 'bg-emerald-950/30 text-emerald-200 font-black'
                }`}
              >
                <div>
                  <span className="text-xs uppercase tracking-wider block">Calculated Total Fare</span>
                  <span className="text-[10px] font-normal opacity-80">
                    Guaranteed price before rider promo
                  </span>
                </div>
                <span className="text-base font-black text-emerald-600">
                  ₹{effectiveBreakdown.totalFare.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Live Distance Simulator Slider */}
          <div
            className={`p-3.5 rounded-2xl border space-y-3 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                Live Distance Simulator
              </span>
              <span className="font-black text-emerald-600 text-sm">
                ₹{simBreakdown.totalFare.toFixed(2)}
              </span>
            </div>

            {/* Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Adjust Distance:</span>
                <span className="font-mono font-bold text-sky-600">{testDistance.toFixed(1)} km (~{simulatedMins} min)</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="35"
                step="0.5"
                value={testDistance}
                onChange={(e) => setTestDistance(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span>0.5 km</span>
                <span>10 km</span>
                <span>20 km</span>
                <span>35 km</span>
              </div>
            </div>

            {/* Category Tier Pills for Simulator */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {[
                {
                  id: 'moto_comfort',
                  label: pricing.tierPricing.moto_comfort.name,
                  icon: pricing.tierPricing.moto_comfort.icon || '🛵',
                  rate: `₹${pricing.tierPricing.moto_comfort.baseFare} + ₹${pricing.tierPricing.moto_comfort.perKmRate}/km`,
                },
                {
                  id: 'moto_delivery',
                  label: pricing.tierPricing.moto_delivery.name,
                  icon: pricing.tierPricing.moto_delivery.icon || '📦',
                  rate: `₹${pricing.tierPricing.moto_delivery.baseFare} + ₹${pricing.tierPricing.moto_delivery.perKmRate}/km`,
                },
              ].map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setTestTier(tier.id)}
                  className={`py-2 px-2.5 rounded-xl text-left border transition-colors cursor-pointer ${
                    testTier === tier.id
                      ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-black shadow-xs'
                      : isLight
                      ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <span>{tier.icon}</span>
                    <span className="truncate font-bold">{tier.label}</span>
                  </div>
                  <div className="text-[9px] font-mono opacity-80 mt-0.5">{tier.rate}</div>
                </button>
              ))}
            </div>

            {(onApplyDistance || onApplySimulatedRoute) && (
              <button
                type="button"
                onClick={handleApply}
                className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isLight
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                    : 'bg-white hover:bg-slate-200 text-slate-950 shadow-md'
                }`}
              >
                <span>Apply {testDistance.toFixed(1)} km (₹{simBreakdown.totalFare.toFixed(2)})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`p-4 border-t flex items-center justify-between ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/90 border-slate-800'
          }`}
        >
          <div className="text-[10px] text-slate-500 space-y-0.5">
            <div>• {pricing.tierPricing.moto_comfort.name}: ₹{pricing.tierPricing.moto_comfort.baseFare} Base · ₹{pricing.tierPricing.moto_comfort.perKmRate}/km</div>
            <div>• {pricing.tierPricing.moto_delivery.name}: ₹{pricing.tierPricing.moto_delivery.baseFare} Base · ₹{pricing.tierPricing.moto_delivery.perKmRate}/km</div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
