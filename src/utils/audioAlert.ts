// Audio Alert Service for MotoRide Captain Dashboard
// Features:
// 1. Dual-Engine Audio: Web Audio API (Chime Synthesizer) + HTML5 Audio WAV Fallback
// 2. Sweet 4-Tone Melodic Alert Tune: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
// 3. User-Gesture Auto-Unlocking across touch, click, pointer, keyboard
// 4. Cross-tab & Multi-view Synchronization via BroadcastChannel & CustomEvents

let sharedAudioCtx: AudioContext | null = null;
let cachedWavDataUrl: string | null = null;

/**
 * Generate a sweet 4-tone bell chime WAV base64 string
 * Used as high-reliability fallback for mobile Safari and strict autoplay policies
 */
export const generateSweetChimeWavUrl = (): string => {
  if (cachedWavDataUrl) return cachedWavDataUrl;

  try {
    const sampleRate = 22050;
    const duration = 1.0; // 1 second total
    const totalSamples = Math.floor(sampleRate * duration);
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = totalSamples * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF identifier
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // BitsPerSample
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // 4 Melodic Notes: C5, E5, G5, C6
    const notes = [
      { freq: 523.25, start: 0.00, dur: 0.18, vol: 0.7 },
      { freq: 659.25, start: 0.15, dur: 0.20, vol: 0.75 },
      { freq: 783.99, start: 0.30, dur: 0.22, vol: 0.8 },
      { freq: 1046.5, start: 0.48, dur: 0.48, vol: 0.9 },
    ];

    let offset = 44;
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;

      for (const note of notes) {
        if (t >= note.start && t < note.start + note.dur) {
          const noteT = t - note.start;
          const progress = noteT / note.dur;
          // Exponential decay envelope
          const env = Math.exp(-progress * 4.5) * note.vol;
          // Fundamental sine wave + subtle harmonic
          const fundamental = Math.sin(2 * Math.PI * note.freq * noteT);
          const overtone = 0.25 * Math.sin(4 * Math.PI * note.freq * noteT);
          sample += (fundamental + overtone) * env;
        }
      }

      // Clamp to 16-bit signed integer
      sample = Math.max(-1, Math.min(1, sample));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }

    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    cachedWavDataUrl = 'data:audio/wav;base64,' + btoa(binary);
    return cachedWavDataUrl;
  } catch (e) {
    console.warn('[Motoride Audio] WAV fallback generator error:', e);
    return '';
  }
};

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
    console.warn('[Motoride Audio] AudioContext init note:', e);
    return null;
  }
};

/**
 * Global unlock listener attached once to ensure browser autoplay policy is unlocked on user interaction
 */
export const unlockAudio = () => {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    // Also warm up fallback HTML5 audio
    const wavUrl = generateSweetChimeWavUrl();
    if (wavUrl) {
      const audio = new Audio(wavUrl);
      audio.volume = 0.01;
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
      }).catch(() => {});
    }
  } catch {}
};

export const setupAudioAutoplayUnlock = () => {
  if (typeof window === 'undefined') return;

  const unlockHandler = () => {
    unlockAudio();
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

// Initialize unlock listener immediately on load
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

    let playedWithWebAudio = false;
    const ctx = getAudioContext();

    if (ctx) {
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      if (ctx.state === 'running') {
        const now = ctx.currentTime + 0.01;

        // 4 Sweet Melodic Notes
        const notes = [
          { freq: 523.25, time: 0.00, dur: 0.16, gain: 0.35 }, // C5
          { freq: 659.25, time: 0.14, dur: 0.18, gain: 0.38 }, // E5
          { freq: 783.99, time: 0.28, dur: 0.20, gain: 0.40 }, // G5
          { freq: 1046.5, time: 0.44, dur: 0.48, gain: 0.45 }, // C6
        ];

        notes.forEach((note) => {
          const startTime = now + note.time;
          const stopTime = startTime + note.dur;

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(note.freq, startTime);

          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(note.gain, startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(stopTime);

          // Harmonic shimmer
          const oscH = ctx.createOscillator();
          const gainH = ctx.createGain();
          oscH.type = 'triangle';
          oscH.frequency.setValueAtTime(note.freq * 2, startTime);
          gainH.gain.setValueAtTime(0.0001, startTime);
          gainH.gain.linearRampToValueAtTime(note.gain * 0.18, startTime + 0.015);
          gainH.gain.exponentialRampToValueAtTime(0.0001, startTime + (note.dur * 0.7));

          oscH.connect(gainH);
          gainH.connect(ctx.destination);
          oscH.start(startTime);
          oscH.stop(startTime + (note.dur * 0.7));
        });

        playedWithWebAudio = true;
      }
    }

    // HTML5 Audio Fallback if Web Audio API was blocked or didn't play
    if (!playedWithWebAudio) {
      const wavUrl = generateSweetChimeWavUrl();
      if (wavUrl) {
        const audio = new Audio(wavUrl);
        audio.volume = 0.85;
        await audio.play().catch(() => {});
      }
    }

    return true;
  } catch (err) {
    console.warn('[Motoride Audio] Alert tune playback fallback note:', err);
    try {
      const wavUrl = generateSweetChimeWavUrl();
      if (wavUrl) {
        const audio = new Audio(wavUrl);
        audio.volume = 0.85;
        audio.play().catch(() => {});
      }
    } catch {}
    return false;
  }
};

// Broadcast Channel & Custom Event helpers for multi-tab and dual-view simulator sync
const BROADCAST_CHANNEL_NAME = 'motoride_broadcast_channel';

export const notifyNewIncomingRide = (ride: any) => {
  if (typeof window === 'undefined' || !ride) return;

  try {
    // 1. Dispatch in-window event (DualView and same page components)
    window.dispatchEvent(
      new CustomEvent('motoride:new_ride_broadcast', {
        detail: ride,
      })
    );

    // 2. Broadcast across tabs
    if ('BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.postMessage({ type: 'NEW_RIDE_BROADCAST', ride, timestamp: Date.now() });
        setTimeout(() => bc.close(), 1500);
      } catch {}
    }

    // 3. LocalStorage event trigger (cross-tab fallback)
    localStorage.setItem(
      'motoride_last_broadcast_event',
      JSON.stringify({
        id: ride.id,
        service_type: ride.service_type,
        pickup_location: ride.pickup_location,
        dropoff_location: ride.dropoff_location,
        fare: ride.fare,
        passenger_name: ride.passenger_name,
        timestamp: Date.now(),
      })
    );
  } catch (e) {
    console.warn('[Motoride Audio] Broadcast notification note:', e);
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

/**
 * Play a friendly, pleasant chime when the Captain arrives at pickup
 */
export const playCaptainArrivedChime = async (): Promise<boolean> => {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      if (ctx.state === 'running') {
        const now = ctx.currentTime + 0.02;
        // Two-tone bright arrival chime: G5 (784Hz) -> C6 (1046Hz) with harmonic resonance
        const notes = [
          { freq: 783.99, time: 0.00, dur: 0.22, gain: 0.45 },
          { freq: 1046.5, time: 0.20, dur: 0.45, gain: 0.50 },
        ];

        notes.forEach((n) => {
          const startTime = now + n.time;
          const stopTime = startTime + n.dur;

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(n.freq, startTime);

          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(n.gain, startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(stopTime);
        });
        return true;
      }
    }
    return false;
  } catch (err) {
    console.warn('[Motoride Audio] Arrival chime note:', err);
    return false;
  }
};

/**
 * Play a friendly, distinct two-tone chime when a new chat message arrives
 */
export const playMessageReceivedChime = async (): Promise<boolean> => {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      if (ctx.state === 'running') {
        const now = ctx.currentTime + 0.01;
        // Two-tone bright notification ping: E5 (659Hz) -> A5 (880Hz)
        const notes = [
          { freq: 659.25, time: 0.00, dur: 0.12, gain: 0.25 },
          { freq: 880.00, time: 0.10, dur: 0.25, gain: 0.30 },
        ];

        notes.forEach((n) => {
          const startTime = now + n.time;
          const stopTime = startTime + n.dur;

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(n.freq, startTime);

          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(n.gain, startTime + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(stopTime);
        });
        return true;
      }
    }
    return false;
  } catch (err) {
    return false;
  }
};

/**
 * Broadcast when captain clicks "I have arrived at pickup spot"
 */
export const notifyCaptainArrived = (ride: any) => {
  if (typeof window === 'undefined' || !ride) return;

  try {
    // 1. Dispatch custom event for same window (DualView simulator & active tabs)
    window.dispatchEvent(
      new CustomEvent('motoride:captain_arrived', {
        detail: ride,
      })
    );

    // 2. BroadcastChannel across browser tabs
    if ('BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.postMessage({ type: 'CAPTAIN_ARRIVED_BROADCAST', ride, timestamp: Date.now() });
        setTimeout(() => bc.close(), 1500);
      } catch {}
    }

    // 3. LocalStorage event trigger
    localStorage.setItem(
      'motoride_last_arrived_event',
      JSON.stringify({
        id: ride.id,
        captain_id: ride.captain_id,
        passenger_id: ride.passenger_id,
        pickup_location: ride.pickup_location,
        timestamp: Date.now(),
      })
    );
  } catch (e) {
    console.warn('[Motoride Audio] Captain arrived notification note:', e);
  }
};

/**
 * Subscribe to captain arrival announcements
 */
export const subscribeToCaptainArrivedBroadcasts = (onArrived: (ride: any) => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: any) => {
    if (e.detail) {
      onArrived(e.detail);
    }
  };
  window.addEventListener('motoride:captain_arrived', handleCustomEvent);

  let bc: BroadcastChannel | null = null;
  if ('BroadcastChannel' in window) {
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data?.type === 'CAPTAIN_ARRIVED_BROADCAST' && event.data?.ride) {
          onArrived(event.data.ride);
        }
      };
    } catch {}
  }

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === 'motoride_last_arrived_event' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed?.id) {
          onArrived(parsed);
        }
      } catch {}
    }
  };
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener('motoride:captain_arrived', handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
  };
};
