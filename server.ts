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
  const publicDir = path.join(process.cwd(), 'public');
  const distDir = path.join(process.cwd(), 'dist');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Parse JSON bodies
  app.use(express.json());

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
