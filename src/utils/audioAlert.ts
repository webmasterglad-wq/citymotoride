// Audio Alert Service for MotoRide Captain Dashboard
// Features:
// 1. Singleton Web Audio API with auto-unlocking on first user interaction
// 2. Harmonic sweet 4-tone melodic bell chime (C5 -> E5 -> G5 -> C6)
// 3. Fallback Synthesized Audio Buffer & HTML5 Audio
// 4. Cross-tab & In-Page synchronization via BroadcastChannel & CustomEvents

let sharedAudioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

// Attempt to get or initialize the shared AudioContext
export const getAudioContext = (): AudioContext | null => {
  try {
    if (!sharedAudioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        sharedAudioCtx = new AudioCtxClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (e) {
    console.warn('[Motoride Audio] Failed to initialize AudioContext:', e);
    return null;
  }
};

// Global unlock listener attached once to ensure browser autoplay policy is satisfied
export const setupAudioAutoplayUnlock = () => {
  if (typeof window === 'undefined') return;

  const unlockHandler = () => {
    try {
      const ctx = getAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().then(() => {
            isAudioUnlocked = true;
          }).catch(() => {});
        } else {
          isAudioUnlocked = true;
        }

        // Play silent 1-sample buffer to permanently unlock on iOS Safari / Chrome
        try {
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
        } catch {}
      }
    } catch {}

    // Remove listeners once activated
    window.removeEventListener('pointerdown', unlockHandler);
    window.removeEventListener('touchstart', unlockHandler);
    window.removeEventListener('click', unlockHandler);
    window.removeEventListener('keydown', unlockHandler);
  };

  window.addEventListener('pointerdown', unlockHandler, { once: true, passive: true });
  window.addEventListener('touchstart', unlockHandler, { once: true, passive: true });
  window.addEventListener('click', unlockHandler, { once: true, passive: true });
  window.addEventListener('keydown', unlockHandler, { once: true, passive: true });
};

// Initialize unlock listener immediately
if (typeof window !== 'undefined') {
  setupAudioAutoplayUnlock();
}

/**
 * Plays the Sweet 4-Tone Melodic Alert Tune (C5 -> E5 -> G5 -> C6)
 * @param force Force play even if muted check is bypassed
 */
export const playSweetAlertTune = async (force: boolean = false): Promise<boolean> => {
  try {
    // Check localStorage sound preference unless forced
    if (!force) {
      const savedPref = localStorage.getItem('motoride_captain_alert_sound');
      const isEnabled = savedPref !== null ? savedPref === 'true' : true;
      if (!isEnabled) {
        return false;
      }
    }

    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime + 0.02;

    // Sweet 4-note melodic sequence
    const notes = [
      { freq: 523.25, time: 0, dur: 0.14, gain: 0.30 },     // C5 (Bright chime entry)
      { freq: 659.25, time: 0.13, dur: 0.15, gain: 0.32 },  // E5 (Warm melodic step)
      { freq: 783.99, time: 0.27, dur: 0.16, gain: 0.35 },  // G5 (Ascending harmony)
      { freq: 1046.50, time: 0.42, dur: 0.45, gain: 0.38 }, // C6 (Crystal bell peak with soft resonance)
    ];

    notes.forEach((note) => {
      const startTime = now + note.time;
      const stopTime = startTime + note.dur;

      // Primary tone (warm sine)
      const oscPrimary = ctx.createOscillator();
      const gainPrimary = ctx.createGain();

      oscPrimary.type = 'sine';
      oscPrimary.frequency.setValueAtTime(note.freq, startTime);

      // Attack & Exponential Release
      gainPrimary.gain.setValueAtTime(0.0001, startTime);
      gainPrimary.gain.linearRampToValueAtTime(note.gain, startTime + 0.015);
      gainPrimary.gain.exponentialRampToValueAtTime(0.0001, stopTime);

      oscPrimary.connect(gainPrimary);
      gainPrimary.connect(ctx.destination);

      oscPrimary.start(startTime);
      oscPrimary.stop(stopTime);

      // Subtle Harmonic shimmer (2nd harmonic / octave higher for crispness)
      const oscHarmonic = ctx.createOscillator();
      const gainHarmonic = ctx.createGain();

      oscHarmonic.type = 'triangle';
      oscHarmonic.frequency.setValueAtTime(note.freq * 2, startTime);

      gainHarmonic.gain.setValueAtTime(0.0001, startTime);
      gainHarmonic.gain.linearRampToValueAtTime(note.gain * 0.15, startTime + 0.01);
      gainHarmonic.gain.exponentialRampToValueAtTime(0.0001, startTime + (note.dur * 0.7));

      oscHarmonic.connect(gainHarmonic);
      gainHarmonic.connect(ctx.destination);

      oscHarmonic.start(startTime);
      oscHarmonic.stop(startTime + (note.dur * 0.7));
    });

    return true;
  } catch (err) {
    console.warn('[Motoride Audio] Could not play alert tune:', err);
    return false;
  }
};

// Broadcast Channel & Custom Event helpers for multi-tab and dual-view simulator sync
const BROADCAST_CHANNEL_NAME = 'motoride_broadcast_channel';

export const notifyNewIncomingRide = (ride: any) => {
  if (typeof window === 'undefined') return;

  try {
    // 1. Dispatch in-window event (DualView and same page components)
    window.dispatchEvent(
      new CustomEvent('motoride:new_ride_broadcast', {
        detail: ride,
      })
    );

    // 2. Broadcast across tabs
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({ type: 'NEW_RIDE_BROADCAST', ride, timestamp: Date.now() });
      setTimeout(() => bc.close(), 1000);
    }

    // 3. LocalStorage event trigger (cross-tab fallback)
    localStorage.setItem(
      'motoride_last_broadcast_event',
      JSON.stringify({
        id: ride.id,
        service_type: ride.service_type,
        timestamp: Date.now(),
      })
    );
  } catch (e) {
    console.warn('[Motoride Audio] Broadcast error:', e);
  }
};

export const subscribeToIncomingRideBroadcasts = (onNewRide: (ride: any) => void) => {
  if (typeof window === 'undefined') return () => {};

  // Handle in-window custom events
  const handleCustomEvent = (e: any) => {
    if (e.detail) {
      onNewRide(e.detail);
    }
  };
  window.addEventListener('motoride:new_ride_broadcast', handleCustomEvent);

  // Handle cross-tab BroadcastChannel
  let bc: BroadcastChannel | null = null;
  if ('BroadcastChannel' in window) {
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data?.type === 'NEW_RIDE_BROADCAST' && event.data?.ride) {
          onNewRide(event.data.ride);
        }
      };
    } catch {}
  }

  // Handle localStorage storage events for cross-tab fallback
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === 'motoride_last_broadcast_event' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed?.id) {
          onNewRide(parsed);
        }
      } catch {}
    }
  };
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener('motoride:new_ride_broadcast', handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
  };
};
