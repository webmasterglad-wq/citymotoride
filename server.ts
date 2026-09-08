import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  const dataDir = path.join(process.cwd(), 'data', 'apk');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Parse JSON bodies
  app.use(express.json());

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 1. Get APK Info (metadata) - accessible by all browsers & devices
  app.get('/api/apk/info', (req, res) => {
    try {
      const apkPath = path.join(dataDir, 'motoride.apk');
      const metaPath = path.join(dataDir, 'metadata.json');

      if (!fs.existsSync(apkPath)) {
        if (fs.existsSync(metaPath)) {
          try {
            const raw = fs.readFileSync(metaPath, 'utf8');
            const meta = JSON.parse(raw);
            if (meta.downloadUrl) {
              return res.json({ hasApk: true, metadata: meta });
            }
          } catch {}
        }
        return res.json({ hasApk: false, metadata: null });
      }

      const stat = fs.statSync(apkPath);
      let metadata = {
        id: 'current_active_apk',
        fileName: 'MotoRide_Mobile_App.apk',
        fileSize: stat.size,
        mimeType: 'application/vnd.android.package-archive',
        uploadedAt: stat.mtime.toISOString(),
        version: '1.0.0',
        storageType: 'server',
        downloadUrl: '/api/apk/download',
      };

      if (fs.existsSync(metaPath)) {
        try {
          const customMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          metadata = {
            ...metadata,
            ...customMeta,
            fileSize: stat.size,
            downloadUrl: '/api/apk/download',
          };
        } catch {}
      }

      return res.json({ hasApk: true, metadata });
    } catch (err: any) {
      console.error('Error fetching APK info:', err);
      return res.status(500).json({ hasApk: false, error: err?.message || 'Server error' });
    }
  });

  // 2. Universal Direct APK Download - works on all desktop and mobile browsers
  app.get('/api/apk/download', (req, res) => {
    try {
      const apkPath = path.join(dataDir, 'motoride.apk');
      const metaPath = path.join(dataDir, 'metadata.json');

      if (!fs.existsSync(apkPath)) {
        if (fs.existsSync(metaPath)) {
          try {
            const raw = fs.readFileSync(metaPath, 'utf8');
            const meta = JSON.parse(raw);
            if (meta.downloadUrl && meta.downloadUrl !== '/api/apk/download') {
              return res.redirect(302, meta.downloadUrl);
            }
          } catch {}
        }
        return res.status(404).send('No APK file has been uploaded yet in the Admin Panel.');
      }

      let fileName = 'MotoRide_Mobile_App.apk';
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          if (meta.fileName) {
            fileName = meta.fileName.endsWith('.apk') ? meta.fileName : `${meta.fileName}.apk`;
          }
        } catch {}
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
        res.status(500).send('Failed to download APK.');
      }
    }
  });

  // 3. Upload APK from Admin Panel (streamed directly to disk)
  app.post('/api/apk/upload', (req, res) => {
    try {
      const queryFileName = (req.query.fileName as string) || 'MotoRide_Mobile_App.apk';
      const cleanFileName = queryFileName.endsWith('.apk') ? queryFileName : `${queryFileName}.apk`;
      const version = ((req.query.version as string) || '1.0.0').trim();

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
      const { downloadUrl, fileName = 'MotoRide_Mobile_App.apk', version = '1.0.0' } = req.body;
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
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
