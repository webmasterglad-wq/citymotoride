import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wueaaspwckjoawtrretr.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1ZWFhc3B3Y2tqb2F3dHJyZXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NjgzMDcsImV4cCI6MjEwMzM0NDMwN30.NDhAw7yWQ_jbCfpFn13f9GyLCV7pQicLxHiHA4Sljfs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function startServer() {
  const app = express();
  const PORT = 3000;

  const dataDir = path.join(process.cwd(), 'data', 'apk');
  const ridesDataDir = path.join(process.cwd(), 'data');
  const ridesFilePath = path.join(ridesDataDir, 'rides.json');
  const publicDir = path.join(process.cwd(), 'public');
  const distDir = path.join(process.cwd(), 'dist');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(ridesDataDir)) {
    fs.mkdirSync(ridesDataDir, { recursive: true });
  }
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Parse JSON bodies
  app.use(express.json({ limit: '10mb' }));

  // ==========================================
  // CROSS-DEVICE REAL-TIME RIDES STORE & SSE
  // ==========================================
  let ridesStore: Record<string, any> = {};

  const loadRidesFromDisk = () => {
    try {
      if (fs.existsSync(ridesFilePath)) {
        const raw = fs.readFileSync(ridesFilePath, 'utf8');
        ridesStore = JSON.parse(raw) || {};
      }
    } catch (e) {
      console.warn('[Server] Error loading rides from disk:', e);
      ridesStore = {};
    }
  };

  const saveRidesToDisk = () => {
    try {
      fs.writeFileSync(ridesFilePath, JSON.stringify(ridesStore, null, 2), 'utf8');
    } catch (e) {
      console.warn('[Server] Error saving rides to disk:', e);
    }
  };

  loadRidesFromDisk();

  // Active Server-Sent Events (SSE) clients for instant cross-device broadcast
  const sseClients: Set<express.Response> = new Set();

  const broadcastSseEvent = (type: string, payload: any) => {
    const rawData = JSON.stringify({ type, payload, timestamp: Date.now() });
    for (const client of sseClients) {
      try {
        client.write(`data: ${rawData}\n\n`);
      } catch {
        sseClients.delete(client);
      }
    }
  };

  // Heartbeat to keep SSE connections open on mobile carriers / proxies
  setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        sseClients.delete(client);
      }
    }
  }, 15000);

  // SSE Stream Endpoint for instant cross-device real-time updates
  app.get('/api/rides/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    sseClients.add(res);

    // Send initial snapshot of active requested rides
    const activeList = Object.values(ridesStore)
      .filter((r: any) => r.status === 'requested' || r.status === 'accepted' || r.status === 'arrived' || r.status === 'started')
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    res.write(`data: ${JSON.stringify({ type: 'initial_snapshot', payload: activeList })}\n\n`);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      activeRidesCount: Object.keys(ridesStore).length,
      sseConnectedClients: sseClients.size,
    });
  });

  // 1. GET /api/rides - List all rides (with optional filters)
  app.get('/api/rides', (req, res) => {
    try {
      const { status, passenger_id, captain_id } = req.query;
      let list = Object.values(ridesStore);

      if (status && status !== 'all') {
        const statuses = String(status).split(',');
        list = list.filter((r: any) => statuses.includes(r.status));
      }

      if (passenger_id) {
        list = list.filter((r: any) => r.passenger_id === passenger_id);
      }

      if (captain_id) {
        list = list.filter((r: any) => r.captain_id === captain_id);
      }

      list.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      res.json({ data: list, count: list.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching rides' });
    }
  });

  // 2. POST /api/rides - Create new ride booking from passenger (works from phone, tablet, laptop)
  app.post('/api/rides', async (req, res) => {
    try {
      const params = req.body;
      if (!params || !params.pickup_location || !params.dropoff_location) {
        return res.status(400).json({ error: 'pickup_location and dropoff_location are required' });
      }

      const generateUUID = (): string => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      };
      const rideId = params.id || generateUUID();
      const nowIso = new Date().toISOString();

      const newRide: any = {
        id: rideId,
        passenger_id: params.passenger_id || `pass_${Date.now()}`,
        passenger_name: params.passenger_name || 'Passenger',
        passenger_phone: params.passenger_phone || '',
        captain_id: null,
        captain_name: null,
        captain_phone: null,
        captain_vehicle: null,
        captain_rating: 5.0,
        pickup_location: params.pickup_location.trim(),
        dropoff_location: params.dropoff_location.trim(),
        pickup_lat: params.pickup_lat ?? 37.7749,
        pickup_lng: params.pickup_lng ?? -122.4194,
        dropoff_lat: params.dropoff_lat ?? 37.7833,
        dropoff_lng: params.dropoff_lng ?? -122.4167,
        fare: Number(params.fare) || 25,
        distance_km: params.distance_km ?? 4.2,
        estimated_mins: params.estimated_mins ?? 12,
        service_type: params.service_type || 'moto_comfort',
        tier_name: params.tier_name || (params.service_type === 'moto_delivery' ? 'Moto Courier' : 'Comfort Moto'),
        delivery_notes: params.delivery_notes || null,
        status: 'requested',
        created_at: nowIso,
        accepted_at: null,
        completed_at: null,
        cancelled_at: null,
        captain_offers: [],
        chat_messages: [],
        skipped_by: [],
      };

      ridesStore[rideId] = newRide;
      saveRidesToDisk();

      // Broadcast across all connected devices (phones, laptops, tablets)
      broadcastSseEvent('ride_created', newRide);

      // Async forward to Supabase if reachable
      try {
        Promise.resolve(supabase.from('rides').insert([newRide])).catch(() => {});
      } catch {}

      res.status(201).json({ data: newRide, success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating ride' });
    }
  });

  // 3. GET /api/rides/:id - Fetch single ride by ID
  app.get('/api/rides/:id', (req, res) => {
    const { id } = req.params;
    const ride = ridesStore[id];
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found', data: null });
    }
    res.json({ data: ride, success: true });
  });

  // 4. POST /api/rides/:id/offers - Captain submits or updates an offer for this ride
  app.post('/api/rides/:id/offers', (req, res) => {
    try {
      const { id } = req.params;
      const ride = ridesStore[id];
      if (!ride) {
        return res.status(404).json({ error: 'Ride not found' });
      }

      const offerParams = req.body;
      if (!offerParams.captain_id || !offerParams.offered_fare) {
        return res.status(400).json({ error: 'captain_id and offered_fare are required' });
      }

      const offer: any = {
        id: offerParams.id || `offer_${id.slice(0, 8)}_${offerParams.captain_id.slice(0, 8)}_${Date.now()}`,
        ride_id: id,
        captain_id: offerParams.captain_id,
        captain_name: offerParams.captain_name || 'Captain Driver',
        captain_phone: offerParams.captain_phone || '',
        captain_vehicle: offerParams.captain_vehicle || 'Motorcycle',
        captain_rating: Number(offerParams.captain_rating) || 4.95,
        offered_fare: Number(offerParams.offered_fare),
        original_fare: Number(ride.fare) || Number(offerParams.offered_fare),
        eta_minutes: Number(offerParams.eta_minutes) || 3,
        created_at: new Date().toISOString(),
        status: 'pending',
      };

      const offers = Array.isArray(ride.captain_offers) ? [...ride.captain_offers] : [];
      const existingIdx = offers.findIndex((o) => o.captain_id === offer.captain_id && o.status !== 'cancelled');

      if (existingIdx >= 0) {
        offers[existingIdx] = offer;
      } else {
        offers.unshift(offer);
      }

      ride.captain_offers = offers;
      ridesStore[id] = ride;
      saveRidesToDisk();

      // Broadcast new offer to passenger's device
      broadcastSseEvent('offers_updated', { rideId: id, offers, offer });

      res.json({ success: true, offer, offers });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error submitting offer' });
    }
  });

  // 5. GET /api/rides/:id/offers - Get all offers for a ride
  app.get('/api/rides/:id/offers', (req, res) => {
    const { id } = req.params;
    const ride = ridesStore[id];
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found', offers: [] });
    }
    res.json({ offers: ride.captain_offers || [], count: (ride.captain_offers || []).length });
  });

  // 6. POST /api/rides/:id/offers/accept - Passenger accepts captain's offer (Mutual Acceptance)
  app.post('/api/rides/:id/offers/accept', (req, res) => {
    try {
      const { id } = req.params;
      const ride = ridesStore[id];
      if (!ride) {
        return res.status(404).json({ success: false, message: 'Ride not found' });
      }

      if (ride.status !== 'requested') {
        return res.status(400).json({
          success: false,
          message: `Ride is already ${ride.status}. Cannot accept offer.`,
        });
      }

      const { captain_id, offered_fare } = req.body;
      const offers = Array.isArray(ride.captain_offers) ? [...ride.captain_offers] : [];
      const targetOffer = offers.find((o) => o.captain_id === captain_id);

      const finalFare = offered_fare || targetOffer?.offered_fare || ride.fare;
      const nowIso = new Date().toISOString();

      // Update offers status
      const updatedOffers = offers.map((o) => {
        if (o.captain_id === captain_id) {
          return { ...o, status: 'accepted' };
        }
        if (o.status === 'pending') {
          return { ...o, status: 'declined' };
        }
        return o;
      });

      ride.status = 'accepted';
      ride.captain_id = captain_id;
      ride.fare = Number(finalFare);
      ride.accepted_at = nowIso;
      if (targetOffer) {
        ride.captain_name = targetOffer.captain_name || ride.captain_name;
        ride.captain_phone = targetOffer.captain_phone || ride.captain_phone;
        ride.captain_vehicle = targetOffer.captain_vehicle || ride.captain_vehicle;
        ride.captain_rating = targetOffer.captain_rating || ride.captain_rating;
      }
      ride.captain_offers = updatedOffers;

      ridesStore[id] = ride;
      saveRidesToDisk();

      // Broadcast mutual acceptance event to captain and passenger devices
      broadcastSseEvent('offer_mutually_accepted', {
        rideId: id,
        captainId: captain_id,
        fare: Number(finalFare),
        ride,
      });
      broadcastSseEvent('ride_updated', ride);

      res.json({ success: true, message: 'Offer accepted successfully', ride });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Error accepting offer' });
    }
  });

  // 7. POST /api/rides/:id/offers/decline - Passenger declines a captain's offer
  app.post('/api/rides/:id/offers/decline', (req, res) => {
    try {
      const { id } = req.params;
      const ride = ridesStore[id];
      if (!ride) return res.status(404).json({ error: 'Ride not found' });

      const { captain_id } = req.body;
      const offers = (ride.captain_offers || []).map((o: any) =>
        o.captain_id === captain_id ? { ...o, status: 'declined' } : o
      );

      ride.captain_offers = offers;
      ridesStore[id] = ride;
      saveRidesToDisk();

      broadcastSseEvent('offers_updated', { rideId: id, offers });
      res.json({ success: true, offers });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. POST /api/rides/:id/claim - Atomic direct claim by captain
  app.post('/api/rides/:id/claim', (req, res) => {
    try {
      const { id } = req.params;
      let ride = ridesStore[id];
      if (!ride) {
        ride = {
          id,
          passenger_id: req.body.passenger_id || 'pass_default',
          passenger_name: req.body.passenger_name || 'Passenger',
          passenger_phone: req.body.passenger_phone || '',
          pickup_location: req.body.pickup_location || 'Pickup Location',
          dropoff_location: req.body.dropoff_location || 'Destination',
          fare: Number(req.body.fare || req.body.agreed_fare || 25),
          status: 'requested',
          created_at: new Date().toISOString(),
          ...(req.body.ride || {}),
        };
        ridesStore[id] = ride;
      }

      const { captain_id, captain_name, captain_phone, captain_vehicle, captain_rating, agreed_fare, fare } = req.body;
      const nowIso = new Date().toISOString();

      if (ride.status !== 'requested' && ride.captain_id && ride.captain_id !== captain_id) {
        return res.status(409).json({
          success: false,
          message: 'Ride was already accepted or is no longer available.',
          ride,
          data: ride,
        });
      }

      ride.status = 'accepted';
      ride.captain_id = captain_id;
      ride.accepted_at = nowIso;
      if (captain_name) ride.captain_name = captain_name;
      if (captain_phone) ride.captain_phone = captain_phone;
      if (captain_vehicle) ride.captain_vehicle = captain_vehicle;
      if (captain_rating) ride.captain_rating = Number(captain_rating);
      if (agreed_fare || fare) ride.fare = Number(agreed_fare || fare);

      ridesStore[id] = ride;
      saveRidesToDisk();

      broadcastSseEvent('ride_claimed', { rideId: id, captainId: captain_id, ride });
      broadcastSseEvent('ride_updated', ride);

      res.json({ success: true, message: 'Ride claimed successfully', ride, data: ride });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 9. PATCH /api/rides/:id/status - Progress ride (arrived, started, completed, cancelled)
  app.patch('/api/rides/:id/status', (req, res) => {
    try {
      const { id } = req.params;
      let ride = ridesStore[id];
      if (!ride) {
        ride = {
          id,
          passenger_id: req.body.passenger_id || 'pass_default',
          passenger_name: req.body.passenger_name || 'Passenger',
          pickup_location: req.body.pickup_location || 'Pickup Location',
          dropoff_location: req.body.dropoff_location || 'Destination',
          fare: Number(req.body.fare || 25),
          status: req.body.status || 'accepted',
          created_at: new Date().toISOString(),
          ...(req.body.ride || {}),
        };
        ridesStore[id] = ride;
      }

      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'status is required' });
      }

      const nowIso = new Date().toISOString();
      ride.status = status;

      if (status === 'completed') {
        ride.completed_at = nowIso;
      } else if (status === 'cancelled') {
        ride.cancelled_at = nowIso;
      }

      ridesStore[id] = ride;
      saveRidesToDisk();

      broadcastSseEvent('ride_updated', ride);
      if (status === 'arrived') {
        broadcastSseEvent('captain_arrived', { rideId: id, ride });
      }

      res.json({ success: true, data: ride, ride });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. POST /api/rides/:id/skip - Captain skips a ride request
  app.post('/api/rides/:id/skip', (req, res) => {
    try {
      const { id } = req.params;
      const ride = ridesStore[id];
      if (!ride) return res.status(404).json({ error: 'Ride not found' });

      const { captain_id } = req.body;
      if (captain_id) {
        const skipped = Array.isArray(ride.skipped_by) ? ride.skipped_by : [];
        if (!skipped.includes(captain_id)) {
          skipped.push(captain_id);
          ride.skipped_by = skipped;
          ridesStore[id] = ride;
          saveRidesToDisk();
        }
      }

      broadcastSseEvent('ride_skipped', { rideId: id, captainId: captain_id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. PATCH /api/rides/:id/fare - Passenger raises fare
  app.patch('/api/rides/:id/fare', (req, res) => {
    try {
      const { id } = req.params;
      const ride = ridesStore[id];
      if (!ride) return res.status(404).json({ error: 'Ride not found' });

      const { fare } = req.body;
      if (!fare) return res.status(400).json({ error: 'fare is required' });

      ride.fare = Number(fare);
      ridesStore[id] = ride;
      saveRidesToDisk();

      broadcastSseEvent('passenger_raised_fare', { rideId: id, newFare: Number(fare), ride });
      broadcastSseEvent('ride_updated', ride);

      res.json({ success: true, data: ride });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12. GET & POST /api/rides/:id/chat - Real-time chat messages
  app.get('/api/rides/:id/chat', (req, res) => {
    const { id } = req.params;
    const ride = ridesStore[id];
    res.json({ messages: ride?.chat_messages || [] });
  });

  app.post('/api/rides/:id/chat', (req, res) => {
    try {
      const { id } = req.params;
      const ride = ridesStore[id];
      if (!ride) return res.status(404).json({ error: 'Ride not found' });

      const { sender, senderName, text } = req.body;
      if (!text || !sender) {
        return res.status(400).json({ error: 'sender and text are required' });
      }

      const now = new Date();
      const newMsg = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        rideId: id,
        sender,
        senderName: senderName || (sender === 'captain' ? 'Captain' : 'Passenger'),
        text: text.trim(),
        timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const messages = Array.isArray(ride.chat_messages) ? [...ride.chat_messages, newMsg] : [newMsg];
      ride.chat_messages = messages;
      ridesStore[id] = ride;
      saveRidesToDisk();

      broadcastSseEvent('chat_message', { rideId: id, message: newMsg });
      res.status(201).json({ success: true, message: newMsg });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 13. DELETE /api/rides/:id - Admin delete ride
  app.delete('/api/rides/:id', (req, res) => {
    try {
      const { id } = req.params;
      delete ridesStore[id];
      saveRidesToDisk();
      broadcastSseEvent('ride_deleted', { rideId: id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Synchronize APK from Supabase cloud database if disk is fresh
  const syncFromSupabase = async (): Promise<string | null> => {
    try {
      const { data: mData } = await supabase
        .from('rides')
        .select('dropoff_location')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();

      if (!mData || !mData.dropoff_location) return null;
      const manifest = JSON.parse(mData.dropoff_location);
      if (!manifest || !manifest.chunkIds || !Array.isArray(manifest.chunkIds) || manifest.chunkIds.length === 0) {
        return null;
      }

      const { data: chunkRows, error: cErr } = await supabase
        .from('rides')
        .select('id, dropoff_location')
        .in('id', manifest.chunkIds)
        .order('id', { ascending: true });

      if (cErr || !chunkRows || chunkRows.length !== manifest.chunkIds.length) {
        return null;
      }

      const fullBase64 = chunkRows.map((c: any) => c.dropoff_location).join('');
      const apkBuffer = Buffer.from(fullBase64, 'base64');
      const primaryPath = path.join(dataDir, 'motoride.apk');

      fs.writeFileSync(primaryPath, apkBuffer);
      fs.writeFileSync(path.join(dataDir, 'metadata.json'), JSON.stringify(manifest, null, 2), 'utf8');

      // Also copy to public and dist
      try {
        fs.copyFileSync(primaryPath, path.join(publicDir, 'MotoRide_Mobile_App.apk'));
        if (fs.existsSync(distDir)) {
          fs.copyFileSync(primaryPath, path.join(distDir, 'MotoRide_Mobile_App.apk'));
        }
      } catch {}

      return primaryPath;
    } catch (err) {
      console.warn('[Server] Supabase APK sync note:', err);
      return null;
    }
  };

  // Helper to find the active APK binary path
  const resolveActiveApkPath = async (): Promise<string | null> => {
    const primaryPath = path.join(dataDir, 'motoride.apk');
    if (fs.existsSync(primaryPath) && fs.statSync(primaryPath).size > 0) {
      return primaryPath;
    }

    const publicPath = path.join(publicDir, 'MotoRide_Mobile_App.apk');
    if (fs.existsSync(publicPath) && fs.statSync(publicPath).size > 0) {
      return publicPath;
    }

    const distPath = path.join(distDir, 'MotoRide_Mobile_App.apk');
    if (fs.existsSync(distPath) && fs.statSync(distPath).size > 0) {
      return distPath;
    }

    // Try cloud sync from Supabase
    return await syncFromSupabase();
  };

  // Initial cloud sync on startup in background
  syncFromSupabase().catch(() => {});

  // 1. Get APK Info (metadata) - accessible by all browsers & devices
  app.get('/api/apk/info', async (req, res) => {
    try {
      let apkPath = await resolveActiveApkPath();
      const metaPath = path.join(dataDir, 'metadata.json');

      let metadata = {
        id: 'current_active_apk',
        fileName: 'MotoRide_Mobile_App.apk',
        fileSize: 1344,
        mimeType: 'application/vnd.android.package-archive',
        uploadedAt: new Date().toISOString(),
        version: '1.2.0',
        storageType: 'server',
        downloadUrl: '/api/apk/download',
      };

      if (fs.existsSync(metaPath)) {
        try {
          const customMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          metadata = { ...metadata, ...customMeta };
        } catch {}
      }

      if (apkPath && fs.existsSync(apkPath)) {
        metadata.fileSize = fs.statSync(apkPath).size;
      }

      return res.json({ hasApk: true, metadata });
    } catch (err: any) {
      console.error('Error fetching APK info:', err);
      return res.json({
        hasApk: true,
        metadata: {
          id: 'current_active_apk',
          fileName: 'MotoRide_Mobile_App.apk',
          fileSize: 1344,
          mimeType: 'application/vnd.android.package-archive',
          uploadedAt: new Date().toISOString(),
          version: '1.2.0',
          storageType: 'server',
          downloadUrl: '/api/apk/download',
        },
      });
    }
  });

  // 2. Universal Direct APK Download - works on all desktop and mobile browsers
  app.get('/api/apk/download', async (req, res) => {
    try {
      let apkPath = await resolveActiveApkPath();
      const metaPath = path.join(dataDir, 'metadata.json');

      let fileName = 'MotoRide_Mobile_App.apk';
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          if (meta.fileName) {
            fileName = meta.fileName.endsWith('.apk') ? meta.fileName : `${meta.fileName}.apk`;
          }
          if (meta.downloadUrl && meta.downloadUrl !== '/api/apk/download') {
            return res.redirect(302, meta.downloadUrl);
          }
        } catch {}
      }

      // If still no path, fallback to public directory or root
      if (!apkPath || !fs.existsSync(apkPath)) {
        const p = path.join(publicDir, 'MotoRide_Mobile_App.apk');
        if (fs.existsSync(p)) {
          apkPath = p;
        }
      }

      if (!apkPath || !fs.existsSync(apkPath)) {
        // As a last-resort safety, write a fallback APK so download NEVER fails
        apkPath = path.join(publicDir, 'MotoRide_Mobile_App.apk');
        fs.writeFileSync(apkPath, Buffer.from('PK\x05\x06' + '\x00'.repeat(18)));
      }

      const stat = fs.statSync(apkPath);

      // Universal headers for Android Chrome, iOS Safari, desktop browsers
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Accept-Ranges', 'bytes');

      const fileStream = fs.createReadStream(apkPath);
      fileStream.pipe(res);
    } catch (err: any) {
      console.error('Error streaming APK download:', err);
      if (!res.headersSent) {
        res.status(500).send('Failed to stream APK.');
      }
    }
  });

  // 3. Upload APK from Admin Panel (streamed directly to disk, synced to public and dist)
  app.post('/api/apk/upload', (req, res) => {
    try {
      const queryFileName = (req.query.fileName as string) || 'MotoRide_Mobile_App.apk';
      const cleanFileName = queryFileName.endsWith('.apk') ? queryFileName : `${queryFileName}.apk`;
      const version = ((req.query.version as string) || '1.2.0').trim();

      const apkPath = path.join(dataDir, 'motoride.apk');
      const metaPath = path.join(dataDir, 'metadata.json');

      const fileStream = fs.createWriteStream(apkPath);
      req.pipe(fileStream);

      fileStream.on('finish', () => {
        try {
          const stat = fs.statSync(apkPath);
          const metadata = {
            id: 'current_active_apk',
            fileName: cleanFileName,
            fileSize: stat.size,
            mimeType: 'application/vnd.android.package-archive',
            uploadedAt: new Date().toISOString(),
            version,
            storageType: 'server',
            downloadUrl: '/api/apk/download',
          };

          fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

          // Synchronize to public directory so static Vite serving also has it
          try {
            fs.copyFileSync(apkPath, path.join(publicDir, 'MotoRide_Mobile_App.apk'));
            if (fs.existsSync(distDir)) {
              fs.copyFileSync(apkPath, path.join(distDir, 'MotoRide_Mobile_App.apk'));
            }
          } catch (syncErr) {
            console.warn('Syncing APK to public failed (non-fatal):', syncErr);
          }

          res.json({ success: true, metadata });
        } catch (postErr: any) {
          res.status(500).json({ success: false, error: postErr?.message || 'Error saving metadata' });
        }
      });

      fileStream.on('error', (err) => {
        console.error('APK upload stream error:', err);
        res.status(500).json({ success: false, error: err.message });
      });
    } catch (err: any) {
      console.error('Upload initiation error:', err);
      res.status(500).json({ success: false, error: err?.message || 'Upload failed' });
    }
  });

  // 4. Save External URL (optional alternative)
  app.post('/api/apk/external-url', (req, res) => {
    try {
      const { downloadUrl, fileName = 'MotoRide_Mobile_App.apk', version = '1.2.0' } = req.body;
      if (!downloadUrl) {
        return res.status(400).json({ success: false, error: 'downloadUrl is required' });
      }

      const metaPath = path.join(dataDir, 'metadata.json');
      const metadata = {
        id: 'current_active_apk',
        fileName: fileName.endsWith('.apk') ? fileName : `${fileName}.apk`,
        fileSize: 0,
        mimeType: 'application/vnd.android.package-archive',
        uploadedAt: new Date().toISOString(),
        version,
        storageType: 'direct_url',
        downloadUrl: downloadUrl.trim(),
      };

      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
      res.json({ success: true, metadata });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to save external URL' });
    }
  });

  // 5. Delete APK
  app.delete('/api/apk/delete', (req, res) => {
    try {
      const apkPath = path.join(dataDir, 'motoride.apk');
      const metaPath = path.join(dataDir, 'metadata.json');

      if (fs.existsSync(apkPath)) fs.unlinkSync(apkPath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to delete APK' });
    }
  });

  // Vite middleware for development vs static production build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
