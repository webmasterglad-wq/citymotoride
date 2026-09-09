import React, { useState, useEffect, useRef } from 'react';
import { Clock, Zap, AlertTriangle, Timer } from 'lucide-react';

export interface InDriveTimelineBarProps {
  /**
   * Total duration in seconds for the countdown window (default: 25s like inDrive)
   */
  totalDurationSeconds?: number;
  /**
   * When this window started (ISO timestamp or epoch ms). If older than total duration, will use mount time.
   */
  startedAt?: string | number;
  /**
   * Callback fired once when countdown reaches 0
   */
  onExpire?: () => void;
  /**
   * Theme mode
   */
  isLight?: boolean;
  /**
   * Custom label over the timeline
   */
  label?: string;
  /**
   * Variant for captain incoming request, passenger offer review, or radar search
   */
  variant?: 'captain_request' | 'passenger_offer' | 'search_radar';
  /**
   * Whether the timer is currently paused (e.g. while submitting an acceptance or counter)
   */
  isPaused?: boolean;
  /**
   * Compact rendering for nested cards
   */
  compact?: boolean;
  /**
   * Custom ID for automated testing
   */
  id?: string;
}

export const InDriveTimelineBar: React.FC<InDriveTimelineBarProps> = ({
  totalDurationSeconds = 25,
  startedAt,
  onExpire,
  isLight = false,
  label,
  variant = 'captain_request',
  isPaused = false,
  compact = false,
  id,
}) => {
  const totalMs = totalDurationSeconds * 1000;

  // Track initial start timestamp to ensure the user gets a reliable smooth countdown
  const startTimeRef = useRef<number>(Date.now());
  const hasExpiredRef = useRef<boolean>(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    let initialStart = Date.now();
    if (startedAt) {
      const parsed = typeof startedAt === 'number' ? startedAt : new Date(startedAt).getTime();
      if (!isNaN(parsed) && parsed > 0) {
        const elapsed = Date.now() - parsed;
        // If startedAt was within the duration window, respect elapsed time.
        // Otherwise start fresh so the user has a full window to act.
        if (elapsed >= 0 && elapsed < totalMs - 1000) {
          initialStart = parsed;
        }
      }
    }
    startTimeRef.current = initialStart;
    hasExpiredRef.current = false;
  }, [startedAt, totalMs]);

  const [remainingMs, setRemainingMs] = useState<number>(() => {
    const elapsed = Date.now() - startTimeRef.current;
    return Math.max(0, totalMs - elapsed);
  });

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      const left = Math.max(0, totalMs - elapsed);

      setRemainingMs(left);

      if (left <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        clearInterval(interval);
        if (onExpireRef.current) {
          onExpireRef.current();
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [totalMs, isPaused]);

  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const progressPercent = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  // Determine stage and colors based on remaining time percentage (inDrive style)
  // Stage 1 (>50%): Vivid Green (Emerald)
  // Stage 2 (20-50%): Warm Amber
  // Stage 3 (<20%): Urgent Red/Rose with pulse
  let colorTheme = {
    barGradient: 'from-emerald-500 via-teal-400 to-emerald-400',
    barBg: 'bg-emerald-500',
    textColor: 'text-emerald-500 dark:text-emerald-400',
    badgeBg: isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    glow: 'shadow-[0_0_10px_rgba(16,185,129,0.35)]',
    pulse: false,
    labelBadge: 'inDrive Fast Match',
  };

  if (progressPercent <= 20 || remainingSeconds <= 5) {
    colorTheme = {
      barGradient: 'from-rose-500 via-red-500 to-amber-500',
      barBg: 'bg-rose-500',
      textColor: 'text-rose-500 dark:text-rose-400',
      badgeBg: isLight ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      glow: 'shadow-[0_0_12px_rgba(239,68,68,0.55)]',
      pulse: true,
      labelBadge: 'Ending Soon',
    };
  } else if (progressPercent <= 50 || remainingSeconds <= 12) {
    colorTheme = {
      barGradient: 'from-amber-500 via-yellow-400 to-amber-400',
      barBg: 'bg-amber-500',
      textColor: 'text-amber-500 dark:text-amber-400',
      badgeBg: isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      glow: 'shadow-[0_0_10px_rgba(245,158,11,0.4)]',
      pulse: false,
      labelBadge: 'Offer Expiring',
    };
  }

  const defaultLabel =
    variant === 'captain_request'
      ? 'Time to accept or counter-offer'
      : variant === 'passenger_offer'
      ? "Captain's offer valid for"
      : 'Searching nearby captains';

  const displayLabel = label || defaultLabel;

  return (
    <div
      id={id || `indrive-timeline-bar-${variant}`}
      className={`w-full select-none transition-all ${
        compact ? 'space-y-1.5' : 'space-y-2'
      }`}
    >
      {/* Top Meta Row: Label & Remaining Seconds Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                colorTheme.pulse ? 'animate-ping bg-rose-400' : 'animate-ping bg-emerald-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                colorTheme.pulse ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            />
          </span>

          <span
            className={`font-bold tracking-tight truncate ${
              compact ? 'text-[10px]' : 'text-[11px]'
            } ${isLight ? 'text-slate-700' : 'text-slate-300'}`}
          >
            {displayLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Seconds Countdown Badge */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-black font-mono tracking-tight transition-colors ${
              colorTheme.badgeBg
            } ${colorTheme.pulse ? 'animate-pulse' : ''}`}
          >
            <Timer className="w-3 h-3 shrink-0" />
            <span>{remainingSeconds}s</span>
          </div>
        </div>
      </div>

      {/* Horizontal Animated Timeline Bar (inDrive Style) */}
      <div
        className={`w-full rounded-full overflow-hidden transition-colors ${
          compact ? 'h-1.5' : 'h-2'
        } ${isLight ? 'bg-slate-200/90' : 'bg-slate-800/90'} p-0.5 shadow-inner`}
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colorTheme.barGradient} ${colorTheme.glow} transition-[width] duration-150 ease-linear relative overflow-hidden`}
          style={{ width: `${progressPercent}%` }}
        >
          {/* Subtle animated highlight shimmer */}
          <div className="absolute inset-0 bg-white/20 opacity-40 animate-[pulse_2s_infinite]" />
        </div>
      </div>
    </div>
  );
};
