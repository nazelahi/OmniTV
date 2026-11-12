import { Channel, EPGProgram } from '../types/playlist';

/**
 * Curated high-resolution broadcast imagery organized by genre/theme.
 * Used to dynamically assign unique, visually authentic posters to programs
 * based on channel, category, show title, and time slot without hardcoding a single static image.
 */

// Local high-fidelity AI Studio broadcast assets
const LOCAL_POSTER_NEWS = '/src/assets/images/poster_news_broadcast_1794490927954.jpg';
const LOCAL_POSTER_SPORTS = '/src/assets/images/poster_sports_motorsport_1794490928008.jpg';
const LOCAL_POSTER_SPACE = '/src/assets/images/poster_space_documentary_1794490928286.jpg';
const LOCAL_POSTER_CINEMA = '/src/assets/images/poster_cinema_feature_1794490929030.jpg';

// Varied broadcast-quality photography pools per genre
const POSTER_POOLS: Record<string, string[]> = {
  News: [
    LOCAL_POSTER_NEWS,
    'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1200&auto=format&fit=crop&q=80', // Live News Studio
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&auto=format&fit=crop&q=80', // Financial Markets & Wall St
    'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1200&auto=format&fit=crop&q=80', // Press Conference & Diplomatic Desk
    'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80', // Live Broadcast Camera Operator
    'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=1200&auto=format&fit=crop&q=80', // Newsroom monitors & graphics
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80', // Satellite Earth uplink
  ],
  Sports: [
    LOCAL_POSTER_SPORTS,
    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1200&auto=format&fit=crop&q=80', // GT Night Racing
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80', // Football Stadium Lights
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1200&auto=format&fit=crop&q=80', // Mountain Bike Downhill
    'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&auto=format&fit=crop&q=80', // Big Wave Surfing
    'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200&auto=format&fit=crop&q=80', // Arena Basketball
    'https://images.unsplash.com/photo-1528722828814-77b9b83aafb2?w=1200&auto=format&fit=crop&q=80', // Snowboarding Air
  ],
  'Science & Nature': [
    LOCAL_POSTER_SPACE,
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80', // Deep Space Galaxy
    'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=1200&auto=format&fit=crop&q=80', // Earth from Space
    'https://images.unsplash.com/photo-1517976487507-5b3b11929e06?w=1200&auto=format&fit=crop&q=80', // Rocket Launch
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&auto=format&fit=crop&q=80', // Marine Coral Reef
    'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=1200&auto=format&fit=crop&q=80', // Arctic Expedition
    'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=1200&auto=format&fit=crop&q=80', // Quantum Lab Optics
  ],
  'Movies & Cinema': [
    LOCAL_POSTER_CINEMA,
    'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200&auto=format&fit=crop&q=80', // Film Noir Street
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80', // Neon Cyberpunk
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&auto=format&fit=crop&q=80', // Cinema Projector Beam
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&auto=format&fit=crop&q=80', // Cinematic Landscape
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80', // Atmospheric Sci-Fi Set
  ],
  'Music & Radio': [
    LOCAL_POSTER_CINEMA,
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80', // Festival Main Stage
    'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&auto=format&fit=crop&q=80', // Recording Studio Desk
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80', // Acoustic Live Concert
    'https://images.unsplash.com/photo-1539185441755-769473a23570?w=1200&auto=format&fit=crop&q=80', // Vinyl Turntable
  ],
  General: [
    LOCAL_POSTER_NEWS,
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80', // Architecture & Travel
    'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?w=1200&auto=format&fit=crop&q=80', // Metropolis Skyline
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&auto=format&fit=crop&q=80', // Culinary Masters
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80', // Technology & Communications
  ],
};

/**
 * Deterministic fast string hash
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Resolves a dynamic program poster image URL.
 * 1. Checks if program has a real EPG poster from XMLTV (<icon src="...">).
 * 2. If not, deterministically picks a matching high-res broadcast image from
 *    the curated genre pools based on channel name, number, and program title.
 * 3. Never returns a single repeating static fallback.
 */
export function getProgramPoster(
  program?: EPGProgram | null,
  channel?: Channel | null,
  slotIndex = 0
): string {
  // 1. If real EPG feed provided a poster/icon, respect it!
  if (program?.poster && program.poster.trim().length > 0) {
    return program.poster;
  }

  // 2. Identify genre pool dynamically from group, channel name, and program title
  const contextText = `${channel?.group || ''} ${program?.category || ''} ${channel?.name || ''} ${program?.title || ''}`;
  let poolKey = 'General';
  if (/news|world|business|finance|bloomberg|cnn|bbc|dw|france\s*24|jazeera|euronews|cbs/i.test(contextText)) {
    poolKey = 'News';
  } else if (/sport|race|racing|football|soccer|nba|nfl|ufc|red\s*bull|espn|motorsport|extreme/i.test(contextText)) {
    poolKey = 'Sports';
  } else if (/space|science|nature|tech|doc|nasa|discovery|national|geo|wild|earth|cosmos|ocean/i.test(contextText)) {
    poolKey = 'Science & Nature';
  } else if (/movie|cinema|film|drama|thriller|action|comedy|classic|blender|sintel|plex/i.test(contextText)) {
    poolKey = 'Movies & Cinema';
  } else if (/music|radio|concert|dj|lofi|chill|jazz|rock|pop|fm/i.test(contextText)) {
    poolKey = 'Music & Radio';
  }

  const pool = POSTER_POOLS[poolKey] || POSTER_POOLS['General'];

  // 3. Compute unique seed from channel and program attributes
  const seedString = `${channel?.id || 'ch'}_${channel?.name || ''}_${channel?.channelNumber || 1}_${program?.title || 'prog'}_${slotIndex}`;
  const seed = hashString(seedString);

  return pool[seed % pool.length];
}

/**
 * Generates an SVG Data URI poster when network images fail or are blocked.
 * Incorporates channel identity, category, and broadcast styling with zero external dependencies.
 */
export function generateDynamicPosterSvg(
  title: string,
  category: string,
  channelName: string,
  channelNumber?: number,
  accentColor?: string
): string {
  const safeTitle = (title || 'Live Broadcast').replace(/[<>&"]/g, '');
  const safeChannel = (channelName || 'Live TV').replace(/[<>&"]/g, '');
  const safeCat = (category || 'Live TV').replace(/[<>&"]/g, '');
  const chNum = channelNumber ? `CH ${channelNumber.toString().padStart(2, '0')}` : 'LIVE';
  const resolvedAccent =
    accentColor ||
    (typeof document !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim()
      : '') ||
    '#e11d48';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="100%" height="100%">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#140205" />
        <stop offset="50%" stop-color="#0a0a0a" />
        <stop offset="100%" stop-color="#1f0408" />
      </linearGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${resolvedAccent}" />
        <stop offset="100%" stop-color="#f43f5e" />
      </linearGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="1280" height="720" fill="url(#bg)" />
    <rect width="1280" height="720" fill="url(#grid)" />
    <circle cx="1100" cy="180" r="300" fill="${resolvedAccent}" opacity="0.08" filter="blur(60px)" />
    <circle cx="200" cy="550" r="250" fill="${resolvedAccent}" opacity="0.06" filter="blur(50px)" />
    
    <!-- Top Bar -->
    <rect x="60" y="60" width="120" height="36" rx="6" fill="${resolvedAccent}" />
    <text x="120" y="84" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="800" font-size="16" text-anchor="middle" letter-spacing="2">${chNum}</text>
    <rect x="195" y="60" width="180" height="36" rx="6" fill="rgba(255,255,255,0.08)" />
    <text x="285" y="84" fill="#fda4af" font-family="system-ui, sans-serif" font-weight="600" font-size="14" text-anchor="middle">${safeCat.slice(0, 20)}</text>

    <!-- Center Content -->
    <text x="60" y="440" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="800" font-size="44" letter-spacing="-0.5">${safeTitle.slice(0, 36)}</text>
    <text x="60" y="500" fill="#a3a3a3" font-family="system-ui, sans-serif" font-weight="500" font-size="24">${safeChannel} · Live Broadcast</text>

    <!-- Bottom Accent Line -->
    <rect x="60" y="640" width="1160" height="4" rx="2" fill="url(#accent)" opacity="0.7" />
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
