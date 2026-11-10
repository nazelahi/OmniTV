import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface SiteConfig {
  playlistUrl: string;
  playlistName: string;
  epgUrl?: string;
  autoRefreshMinutes: number;
  adminPin: string;
  customChannels: any[];
  disabledChannelIds: string[];
  lastUpdated: string;
  lastSyncStatus?: 'ok' | 'error';
  lastSyncMessage?: string;
  cachedChannelCount?: number;
}

const DEFAULT_CONFIG: SiteConfig = {
  playlistUrl: '',
  playlistName: 'OmniStream TV Global',
  epgUrl: 'https://iptv-org.github.io/epg/guides/en/guide.xml',
  autoRefreshMinutes: 60,
  adminPin: '1234',
  customChannels: [],
  disabledChannelIds: [],
  lastUpdated: new Date().toISOString(),
  cachedChannelCount: 0,
};

function readConfig(): SiteConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error reading config file:', err);
  }
  return { ...DEFAULT_CONFIG };
}

function writeConfig(config: SiteConfig): boolean {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing config file:', err);
    return false;
  }
}

app.use(express.json({ limit: '10mb' }));

// API: Get current website configuration
app.get('/api/config', (req: Request, res: Response) => {
  const config = readConfig();
  // Don't leak the raw PIN in plain GET
  const { adminPin, ...safeConfig } = config;
  res.json({
    ...safeConfig,
    hasPin: !!adminPin,
  });
});

// API: Verify Admin PIN
app.post('/api/verify-pin', (req: Request, res: Response) => {
  const { pin } = req.body;
  const config = readConfig();
  if (config.adminPin === pin || !config.adminPin) {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, error: 'Incorrect Admin PIN' });
});

// API: Update website configuration
app.post('/api/config', (req: Request, res: Response) => {
  const { playlistUrl, playlistName, epgUrl, autoRefreshMinutes, adminPin, customChannels, disabledChannelIds } = req.body;
  const current = readConfig();

  const updated: SiteConfig = {
    ...current,
    playlistUrl: typeof playlistUrl === 'string' ? playlistUrl.trim() : current.playlistUrl,
    playlistName: typeof playlistName === 'string' ? playlistName.trim() : current.playlistName,
    epgUrl: typeof epgUrl === 'string' ? epgUrl.trim() : current.epgUrl,
    autoRefreshMinutes: typeof autoRefreshMinutes === 'number' ? autoRefreshMinutes : current.autoRefreshMinutes,
    adminPin: typeof adminPin === 'string' && adminPin.trim() ? adminPin.trim() : current.adminPin,
    customChannels: Array.isArray(customChannels) ? customChannels : current.customChannels,
    disabledChannelIds: Array.isArray(disabledChannelIds) ? disabledChannelIds : current.disabledChannelIds,
    lastUpdated: new Date().toISOString(),
  };

  const success = writeConfig(updated);
  if (success) {
    res.json({ success: true, config: updated });
  } else {
    res.status(500).json({ success: false, error: 'Failed to write configuration file' });
  }
});

// API: Fetch playlist via backend to bypass browser CORS
app.get('/api/fetch-playlist', async (req: Request, res: Response) => {
  const config = readConfig();
  const queryUrl = (req.query.url as string) || config.playlistUrl;

  if (!queryUrl) {
    return res.status(400).json({ error: 'No playlist URL provided or configured.' });
  }

  try {
    const fetchRes = await fetch(queryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 VLC/3.0.18',
        'Accept': '*/*',
      },
    });

    if (!fetchRes.ok) {
      return res.status(fetchRes.status).json({
        error: `Remote playlist server responded with status HTTP ${fetchRes.status}`,
      });
    }

    const content = await fetchRes.text();

    // Cache count in config
    const extinfMatches = content.match(/#EXTINF:/gi);
    const channelCount = extinfMatches ? extinfMatches.length : 0;
    
    if (queryUrl === config.playlistUrl) {
      config.cachedChannelCount = channelCount;
      config.lastSyncStatus = 'ok';
      config.lastSyncMessage = `Loaded ${channelCount} channels at ${new Date().toLocaleTimeString()}`;
      writeConfig(config);
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch (err: any) {
    console.error('Error fetching playlist:', err);
    if (queryUrl === config.playlistUrl) {
      config.lastSyncStatus = 'error';
      config.lastSyncMessage = err.message || 'Network request failed';
      writeConfig(config);
    }
    res.status(502).json({ error: err.message || 'Failed to download playlist' });
  }
});

// API: Test external playlist URL
app.post('/api/test-playlist', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Please provide a valid URL' });
  }

  try {
    const startTime = Date.now();
    const fetchRes = await fetch(url.trim(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 VLC/3.0.18',
        'Accept': '*/*',
      },
    });

    const elapsed = Date.now() - startTime;

    if (!fetchRes.ok) {
      return res.json({
        success: false,
        status: fetchRes.status,
        statusText: fetchRes.statusText,
        elapsedMs: elapsed,
        error: `Server responded with HTTP ${fetchRes.status}`,
      });
    }

    const text = await fetchRes.text();
    const extinfMatches = text.match(/#EXTINF:/gi);
    const channelCount = extinfMatches ? extinfMatches.length : 0;
    const hasM3U = text.includes('#EXTM3U');

    return res.json({
      success: true,
      status: 200,
      elapsedMs: elapsed,
      hasM3UHeader: hasM3U,
      channelCount,
      bytes: text.length,
      samplePreview: text.slice(0, 500),
    });
  } catch (err: any) {
    return res.json({
      success: false,
      error: err.message || 'Network error reaching remote server',
    });
  }
});

// Mount Vite or static dist
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        port: Number(PORT),
        host: '0.0.0.0',
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[OmniStream TV] Server running on port ${PORT} (${isDev ? 'development' : 'production'})`);
  });
}

startServer();
