import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1' || host === '[::1]') return true;
  // IPv4 checks
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 0) return true;
  }
  return false;
}

// In-memory admin session tokens (token -> expiry ms). Cleared on server restart.
const adminTokens = new Map<string, number>();
const ADMIN_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function issueAdminToken(): string {
  const token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  adminTokens.set(token, Date.now() + ADMIN_TOKEN_TTL_MS);
  return token;
}

function isAdminTokenValid(token: string | undefined | null): boolean {
  if (!token) return false;
  const expiry = adminTokens.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

function extractAdminToken(req: any): string | null {
  const auth = req.headers?.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  if (typeof req.headers?.['x-admin-token'] === 'string') {
    return req.headers['x-admin-token'];
  }
  if (req.body && typeof req.body._adminToken === 'string') {
    return req.body._adminToken;
  }
  return null;
}
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
  // Branding / customization
  appName?: string;
  appLogo?: string;
  appTagline?: string;
  primaryColor?: string;
  accentColor?: string;
}

const DEFAULT_CONFIG: SiteConfig = {
  playlistUrl: '',
  playlistName: 'OmniStream TV Global',
  epgUrl: '',
  autoRefreshMinutes: 60,
  adminPin: '1234',
  appName: 'OmniStream TV',
  appTagline: 'Live TV',
  primaryColor: '#e11d48',
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
    const token = issueAdminToken();
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, error: 'Incorrect Admin PIN' });
});

// API: Update website configuration
app.post('/api/config', (req: Request, res: Response) => {
  if (!isAdminTokenValid(extractAdminToken(req))) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  // Strip any auth token from persisted body
  if (req.body && typeof req.body === 'object') {
    delete req.body._adminToken;
  }
  const { playlistUrl, playlistName, epgUrl, autoRefreshMinutes, adminPin, customChannels, disabledChannelIds, appName, appLogo, appTagline, primaryColor, accentColor } = req.body;
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
    appName: typeof appName === 'string' ? appName.trim() : current.appName,
    appLogo: typeof appLogo === 'string' ? appLogo.trim() : current.appLogo,
    appTagline: typeof appTagline === 'string' ? appTagline.trim() : current.appTagline,
    primaryColor: typeof primaryColor === 'string' ? primaryColor.trim() : current.primaryColor,
    accentColor: typeof accentColor === 'string' ? accentColor.trim() : current.accentColor,
    lastUpdated: new Date().toISOString(),
  };

  const success = writeConfig(updated);
  if (success) {
    const { adminPin, ...safeUpdated } = updated;
    res.json({ success: true, config: { ...safeUpdated, hasPin: !!adminPin } });
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

  // SSRF protection: block requests to private/internal hosts
  try {
    const parsed = new URL(queryUrl);
    if (isPrivateHost(parsed.hostname)) {
      return res.status(400).json({ error: 'Fetching from private or internal hosts is not allowed' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
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

// API: Fetch EPG (XMLTV) via backend to bypass browser CORS
app.get('/api/fetch-epg', async (req: Request, res: Response) => {
  const config = readConfig();
  const queryUrl = (req.query.url as string) || config.epgUrl;

  if (!queryUrl) {
    return res.status(400).json({ error: 'No EPG URL provided or configured.' });
  }

  // SSRF protection: block requests to private/internal hosts
  try {
    const parsed = new URL(queryUrl);
    if (isPrivateHost(parsed.hostname)) {
      return res.status(400).json({ error: 'Fetching from private or internal hosts is not allowed' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const fetchRes = await fetch(queryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 VLC/3.0.18',
        'Accept': '*/*',
      },
    });

    if (!fetchRes.ok) {
      return res.status(fetchRes.status).json({
        error: `Remote EPG server responded with status HTTP ${fetchRes.status}`,
      });
    }

    const content = await fetchRes.text();
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.send(content);
  } catch (err: any) {
    console.error('Error fetching EPG:', err);
    res.status(502).json({ error: err.message || 'Failed to download EPG' });
  }
});

// API: Test external playlist URL
app.post('/api/test-playlist', async (req: Request, res: Response) => {
  if (!isAdminTokenValid(extractAdminToken(req))) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
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
