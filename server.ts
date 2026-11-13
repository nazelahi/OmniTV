import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns/promises';
import { gunzip } from 'zlib';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { requireAuth, optionalAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  getSiteConfigFromDb,
  saveSiteConfigToDb,
  persistSyncStatusInDb,
  createAdminSessionInDb,
  validateAdminSessionInDb,
  getUserDataFromDb,
  toggleUserFavoriteInDb,
  saveUserRecentsInDb,
  type StoredSiteConfig,
} from './src/db/store.ts';

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


// Admin session tokens (backed by PostgreSQL admin_sessions table + short memory cache)
const adminTokens = new Map<string, number>();
const ADMIN_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

async function issueAdminToken(userUid?: string | null): Promise<string> {
  const token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const expiresMs = Date.now() + ADMIN_TOKEN_TTL_MS;
  adminTokens.set(token, expiresMs);
  try {
    await createAdminSessionInDb(token, new Date(expiresMs), userUid);
  } catch (err) {
    console.error('Failed to persist admin session:', err);
  }
  return token;
}

async function isAdminTokenValid(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const expiry = adminTokens.get(token);
  if (expiry && Date.now() <= expiry) {
    return true;
  }
  if (expiry) {
    adminTokens.delete(token);
  }
  const validInDb = await validateAdminSessionInDb(token);
  if (validInDb) {
    adminTokens.set(token, Date.now() + 60 * 60 * 1000);
  }
  return validInDb;
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

const AUTHORIZED_ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || 'najalahi9@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return AUTHORIZED_ADMIN_EMAILS.has(email.trim().toLowerCase());
}

async function isAdminRequestAuthorized(req: AuthRequest): Promise<boolean> {
  if (
    req.user?.email &&
    req.user.email_verified !== false &&
    isAuthorizedAdminEmail(req.user.email)
  ) {
    return true;
  }
  return await isAdminTokenValid(extractAdminToken(req));
}
const DATA_DIR = path.resolve(__dirname, 'data');
const LEGACY_CONFIG_FILE = path.join(DATA_DIR, 'config.json');

type SiteConfig = StoredSiteConfig;

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

let legacySeedAttempted = false;

function readLegacyFileSeed(): Partial<SiteConfig> | null {
  try {
    if (fs.existsSync(LEGACY_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(LEGACY_CONFIG_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

async function readConfig(): Promise<SiteConfig> {
  try {
    const dbConfig = await getSiteConfigFromDb(DEFAULT_CONFIG);
    if (!legacySeedAttempted) {
      legacySeedAttempted = true;
      // If site_settings has not been populated yet, migrate legacy local file once if present
      const legacy = readLegacyFileSeed();
      if (legacy && dbConfig.lastUpdated === DEFAULT_CONFIG.lastUpdated) {
        const merged: SiteConfig = {
          ...DEFAULT_CONFIG,
          ...legacy,
          playlistUrl: legacy.playlistUrl?.trim() || DEFAULT_CONFIG.playlistUrl,
          playlistName: legacy.playlistName?.trim() || DEFAULT_CONFIG.playlistName,
        };
        return await saveSiteConfigToDb(merged);
      }
    }
    return dbConfig;
  } catch (err) {
    console.error('Falling back to default config due to read error:', err);
    return { ...DEFAULT_CONFIG };
  }
}

async function writeConfig(config: SiteConfig, updatedByUid?: string | null): Promise<SiteConfig> {
  return await saveSiteConfigToDb(config, updatedByUid);
}

/** Persist sync status without clobbering a config save that happened meanwhile. */
async function persistSyncStatus(
  expectedUrl: string,
  status: 'ok' | 'error',
  message: string,
  channelCount?: number
): Promise<void> {
  await persistSyncStatusInDb(DEFAULT_CONFIG, expectedUrl, status, message, channelCount);
}

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

// API: Lightweight health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// API: Get public website configuration (no admin metadata exposed)
app.get('/api/config', async (_req: Request, res: Response) => {
  try {
    const config = await readConfig();
    const {
      adminPin: _pin,
      lastSyncStatus: _syncStatus,
      lastSyncMessage: _syncMessage,
      cachedChannelCount: _cachedCount,
      ...publicConfig
    } = config;
    res.json(publicConfig);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load configuration' });
  }
});

// API: Get full configuration for authenticated Admin Console
app.get('/api/admin/config', optionalAuth, async (req: AuthRequest, res: Response) => {
  if (!(await isAdminRequestAuthorized(req))) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  try {
    const config = await readConfig();
    const { adminPin, ...safeConfig } = config;
    res.json({
      ...safeConfig,
      hasPin: !!adminPin,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load configuration' });
  }
});

// API: Exchange authorized Google Sign-In Firebase ID token for an Admin session
app.post('/api/admin/google-login', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.user?.email_verified === false || !isAuthorizedAdminEmail(req.user?.email)) {
    return res.status(403).json({
      success: false,
      error: 'This Google account is not authorized for admin access.',
    });
  }
  try {
    const token = await issueAdminToken(req.user!.uid);
    return res.json({ success: true, token });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to create admin session' });
  }
});

// API: Verify Admin PIN
app.post('/api/verify-pin', optionalAuth, async (req: AuthRequest, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (isPinRateLimited(ip)) {
    return res.status(429).json({
      success: false,
      error: 'Too many attempts. Please try again in a few minutes.',
    });
  }

  try {
    const rawPin = req.body && typeof req.body === 'object' ? req.body.pin : undefined;
    const submittedPin =
      typeof rawPin === 'string' || typeof rawPin === 'number' ? String(rawPin).trim() : '';
    const config = await readConfig();
    const expectedPin = typeof config.adminPin === 'string' ? config.adminPin.trim() : '';

    if (!expectedPin || expectedPin === submittedPin) {
      pinAttempts.delete(ip);
      const token = await issueAdminToken(req.user?.uid ?? null);
      return res.json({ success: true, token });
    }
    recordPinFailure(ip);
    return res.status(401).json({ success: false, error: 'Incorrect Admin PIN' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to verify PIN' });
  }
});

// API: Update website configuration
app.post('/api/config', optionalAuth, async (req: AuthRequest, res: Response) => {
  if (!(await isAdminRequestAuthorized(req))) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  if (req.body && typeof req.body === 'object') {
    delete req.body._adminToken;
  }
  const {
    playlistUrl,
    playlistName,
    epgUrl,
    autoRefreshMinutes,
    adminPin,
    customChannels,
    disabledChannelIds,
    appName,
    appLogo,
    appTagline,
    primaryColor,
    accentColor,
  } = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    const current = await readConfig();

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
      autoRefreshMinutes:
        typeof autoRefreshMinutes === 'number' ? autoRefreshMinutes : current.autoRefreshMinutes,
      adminPin:
        typeof adminPin === 'string' && adminPin.trim() ? adminPin.trim() : current.adminPin,
      customChannels: Array.isArray(customChannels) ? customChannels : current.customChannels,
      disabledChannelIds: Array.isArray(disabledChannelIds)
        ? disabledChannelIds
        : current.disabledChannelIds,
      appName: typeof appName === 'string' ? appName.trim() : current.appName,
      appLogo: typeof appLogo === 'string' ? appLogo.trim() : current.appLogo,
      appTagline: typeof appTagline === 'string' ? appTagline.trim() : current.appTagline,
      primaryColor: typeof primaryColor === 'string' ? primaryColor.trim() : current.primaryColor,
      accentColor: typeof accentColor === 'string' ? accentColor.trim() : current.accentColor,
      lastUpdated: new Date().toISOString(),
    };

    const saved = await writeConfig(updated, req.user?.uid ?? null);
    const { adminPin: _pin, ...safeUpdated } = saved;
    res.json({ success: true, config: { ...safeUpdated, hasPin: !!_pin } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to save configuration' });
  }
});

// API: Authenticated User Sync Endpoints (PostgreSQL backed, Firebase Auth protected)
// Note: Playlist management is admin-only; public users only sync favorites and watch history.
app.get('/api/user/sync', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await getUserDataFromDb(req.user!.uid);
    res.json({
      favoriteChannelIds: data.favoriteChannelIds,
      recentChannelIds: data.recentChannelIds,
      activeChannelId: data.activeChannelId,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load user data' });
  }
});

app.post('/api/user/favorites', requireAuth, async (req: AuthRequest, res: Response) => {
  const { channelId, isFavorite, channelName } = req.body && typeof req.body === 'object' ? req.body : {};
  if (!channelId || typeof channelId !== 'string') {
    return res.status(400).json({ error: 'channelId is required' });
  }
  try {
    await toggleUserFavoriteInDb(req.user!.uid, channelId, Boolean(isFavorite), channelName);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update favorite' });
  }
});

app.post('/api/user/playlists', requireAuth, (_req: AuthRequest, res: Response) => {
  return res.status(403).json({ error: 'Playlist updates are managed by the site administrator.' });
});

app.delete('/api/user/playlists/:id', requireAuth, (_req: AuthRequest, res: Response) => {
  return res.status(403).json({ error: 'Playlist updates are managed by the site administrator.' });
});

app.post('/api/user/recents', requireAuth, async (req: AuthRequest, res: Response) => {
  const { recentChannelIds, activeChannelId } = req.body && typeof req.body === 'object' ? req.body : {};
  if (!Array.isArray(recentChannelIds)) {
    return res.status(400).json({ error: 'recentChannelIds array is required' });
  }
  try {
    await saveUserRecentsInDb(
      req.user!.uid,
      recentChannelIds.filter((id) => typeof id === 'string').slice(0, 20),
      typeof activeChannelId === 'string' ? activeChannelId : undefined
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save watch history' });
  }
});

// API: Fetch admin-configured playlist via backend to bypass browser CORS
app.get('/api/fetch-playlist', optionalAuth, async (req: AuthRequest, res: Response) => {
  const config = await readConfig();
  const requestedUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  let queryUrl = config.playlistUrl;

  if (requestedUrl && requestedUrl !== config.playlistUrl) {
    if (!(await isAdminRequestAuthorized(req))) {
      return res.status(403).json({ error: 'Only the site administrator can load custom playlist URLs.' });
    }
    queryUrl = requestedUrl;
  }

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
      await persistSyncStatus(
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
      await persistSyncStatus(queryUrl, 'error', err.message || 'Network request failed');
    }
    res.status(502).json({ error: err.message || 'Failed to download playlist' });
  }
});

// API: Fetch EPG (XMLTV) via backend to bypass browser CORS
app.get('/api/fetch-epg', async (req: Request, res: Response) => {
  const config = await readConfig();
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
app.post('/api/test-playlist', optionalAuth, async (req: AuthRequest, res: Response) => {
  if (!(await isAdminRequestAuthorized(req))) {
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
  const distPath = path.resolve(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production';

  let useVite = !isProd;
  if (useVite) {
    try {
      await import.meta.resolve?.('vite');
    } catch {
      useVite = false;
    }
  }

  if (useVite) {
    let viteMiddleware: any = null;
    const viteReady = import('vite')
      .then(({ createServer: createViteServer }) =>
        createViteServer({
          server: {
            middlewareMode: true,
            port: Number(PORT),
            host: '0.0.0.0',
          },
          appType: 'spa',
        })
      )
      .then((vite) => {
        viteMiddleware = vite.middlewares;
      });

    app.use(async (req, res, next) => {
      if (!viteMiddleware) {
        await viteReady;
      }
      return viteMiddleware(req, res, next);
    });
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[OmniStream TV] Server running on port ${PORT} (${useVite ? 'development' : 'production'})`);
  });
}

startServer();
