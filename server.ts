import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns/promises';
import { gunzip } from 'zlib';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const gunzipAsync = promisify(gunzip);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

function isPrivateHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '0.0.0.0' ||
    host === '::' ||
    host === '::1'
  ) {
    return true;
  }

  // IPv6 literals (resolved addresses or bracketed URL hosts)
  if (host.includes(':')) {
    if (host.startsWith('fe80') || host.startsWith('fc') || host.startsWith('fd')) return true;
    const mapped = host.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped) return isPrivateHost(mapped[1]);
    return false;
  }

  // IPv4 checks
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 0) return true;
  }
  return false;
}

const isIpLiteral = (host: string) =>
  /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[');

/** Validate a URL, including every resolved IP, before fetching it. */
async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }
  if (isPrivateHost(url.hostname)) {
    throw new Error('Fetching from private or internal hosts is not allowed');
  }
  if (!isIpLiteral(url.hostname)) {
    let addresses: { address: string }[];
    try {
      addresses = await dns.lookup(url.hostname, { all: true });
    } catch {
      throw new Error(`Could not resolve host: ${url.hostname}`);
    }
    if (addresses.length === 0) {
      throw new Error(`Could not resolve host: ${url.hostname}`);
    }
    if (addresses.some((a) => isPrivateHost(a.address))) {
      throw new Error('Fetching from private or internal hosts is not allowed');
    }
  }
}

/** fetch() that validates every redirect hop (prevents redirect-based SSRF). */
async function safeFetch(url: string, init?: RequestInit, maxRedirects = 5): Promise<globalThis.Response> {
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current.toString(), { ...init, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) return res;
      current = new URL(location, current);
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
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

// Simple in-memory throttling for PIN attempts (per IP)
const PIN_MAX_ATTEMPTS = 10;
const PIN_WINDOW_MS = 15 * 60 * 1000;
const pinAttempts = new Map<string, { count: number; resetAt: number }>();

function isPinRateLimited(ip: string): boolean {
  const entry = pinAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    pinAttempts.delete(ip);
    return false;
  }
  return entry.count >= PIN_MAX_ATTEMPTS;
}

function recordPinFailure(ip: string): void {
  const now = Date.now();
  const entry = pinAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    pinAttempts.set(ip, { count: 1, resetAt: now + PIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
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

const FALLBACK_DEFAULT_PLAYLIST_URL =
  'https://raw.githubusercontent.com/saeidrahmanbd/BDIX-IPTV/main/IPTV-Playlist.m3u';
const FALLBACK_DEFAULT_PLAYLIST_NAME = 'BDIX IPTV';

const DEFAULT_CONFIG: SiteConfig = {
  playlistUrl: process.env.DEFAULT_PLAYLIST_URL || FALLBACK_DEFAULT_PLAYLIST_URL,
  playlistName: process.env.DEFAULT_PLAYLIST_NAME || FALLBACK_DEFAULT_PLAYLIST_NAME,
  epgUrl: process.env.DEFAULT_EPG_URL || '',
  autoRefreshMinutes: Number(process.env.AUTO_REFRESH_MINUTES) || 60,
  adminPin: process.env.ADMIN_PIN || '1234',
  appName: process.env.APP_NAME || 'OmniStream TV',
  appTagline: process.env.APP_TAGLINE || 'Live TV',
  primaryColor: process.env.PRIMARY_COLOR || '#e11d48',
  customChannels: [],
  disabledChannelIds: [],
  lastUpdated: new Date().toISOString(),
  cachedChannelCount: 0,
};

function readConfig(): SiteConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const merged: SiteConfig = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      if (!merged.playlistUrl || !merged.playlistUrl.trim()) {
        merged.playlistUrl = DEFAULT_CONFIG.playlistUrl;
        if (!merged.playlistName || !merged.playlistName.trim()) {
          merged.playlistName = DEFAULT_CONFIG.playlistName;
        }
      }
      return merged;
    }
  } catch (err) {
    console.error('Error reading config file:', err);
  }
  return { ...DEFAULT_CONFIG };
}

function writeConfig(config: SiteConfig): boolean {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpFile = `${CONFIG_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(config, null, 2), 'utf-8');
    // Atomic replace so a crash mid-write cannot corrupt the config
    fs.renameSync(tmpFile, CONFIG_FILE);
    return true;
  } catch (err) {
    console.error('Error writing config file:', err);
    return false;
  }
}

/** Persist sync status without clobbering a config save that happened meanwhile. */
function persistSyncStatus(
  expectedUrl: string,
  status: 'ok' | 'error',
  message: string,
  channelCount?: number
): void {
  const latest = readConfig();
  // Only record status for the playlist that is still configured
  if (expectedUrl !== latest.playlistUrl) return;
  latest.lastSyncStatus = status;
  latest.lastSyncMessage = message;
  if (typeof channelCount === 'number') latest.cachedChannelCount = channelCount;
  writeConfig(latest);
}

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

// API: Lightweight health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

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
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (isPinRateLimited(ip)) {
    return res.status(429).json({
      success: false,
      error: 'Too many attempts. Please try again in a few minutes.',
    });
  }

  const rawPin = req.body && typeof req.body === 'object' ? req.body.pin : undefined;
  const submittedPin = typeof rawPin === 'string' || typeof rawPin === 'number' ? String(rawPin).trim() : '';
  const config = readConfig();
  const expectedPin = typeof config.adminPin === 'string' ? config.adminPin.trim() : '';

  if (!expectedPin || expectedPin === submittedPin) {
    pinAttempts.delete(ip);
    const token = issueAdminToken();
    return res.json({ success: true, token });
  }
  recordPinFailure(ip);
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
  const { playlistUrl, playlistName, epgUrl, autoRefreshMinutes, adminPin, customChannels, disabledChannelIds, appName, appLogo, appTagline, primaryColor, accentColor } = (req.body && typeof req.body === 'object' ? req.body : {});
  const current = readConfig();

  const nextPlaylistUrl =
    typeof playlistUrl === 'string'
      ? playlistUrl.trim() || DEFAULT_CONFIG.playlistUrl
      : current.playlistUrl || DEFAULT_CONFIG.playlistUrl;
  const nextPlaylistName =
    typeof playlistName === 'string'
      ? playlistName.trim() || DEFAULT_CONFIG.playlistName
      : current.playlistName || DEFAULT_CONFIG.playlistName;

  const updated: SiteConfig = {
    ...current,
    playlistUrl: nextPlaylistUrl,
    playlistName: nextPlaylistName,
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
    const fetchRes = await safeFetch(queryUrl, {
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
      persistSyncStatus(
        queryUrl,
        'ok',
        `Loaded ${channelCount} channels at ${new Date().toLocaleTimeString()}`,
        channelCount
      );
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch (err: any) {
    console.error('Error fetching playlist:', err);
    if (queryUrl === config.playlistUrl) {
      persistSyncStatus(queryUrl, 'error', err.message || 'Network request failed');
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
    const fetchRes = await safeFetch(queryUrl, {
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

    // XMLTV feeds are often served as .gz files without Content-Encoding.
    // Node's fetch only decompresses the latter, so detect the gzip magic bytes.
    const buffer = Buffer.from(await fetchRes.arrayBuffer());
    const content =
      buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b
        ? (await gunzipAsync(buffer)).toString('utf-8')
        : buffer.toString('utf-8');

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
  const { url } = (req.body && typeof req.body === 'object' ? req.body : {});
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Please provide a valid URL' });
  }

  try {
    const startTime = Date.now();
    const fetchRes = await safeFetch(url.trim(), {
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

// Always return JSON for unknown API routes and API errors
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

app.use('/api', (err: any, _req: Request, res: Response, _next: any) => {
  const status = typeof err?.status === 'number' ? err.status : 500;
  res.status(status).json({
    success: false,
    error: err?.message || 'Internal server error',
  });
});

// Mount Vite or static dist without blocking /api readiness
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    let viteMiddleware: any = null;
    const viteReady = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          port: Number(PORT),
          host: '0.0.0.0',
        },
        appType: 'spa',
      }).then((vite) => {
        viteMiddleware = vite.middlewares;
      })
    );

    app.use(async (req, res, next) => {
      if (!viteMiddleware) {
        await viteReady;
      }
      return viteMiddleware(req, res, next);
    });
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
