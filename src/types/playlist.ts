export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group: string;
  channelNumber: number;
  tvgId?: string;
  tvgName?: string;
  isFavorite?: boolean;
  resolution?: string;
  country?: string;
  language?: string;
}

export interface Playlist {
  id: string;
  name: string;
  url?: string;
  epgUrl?: string;
  channels: Channel[];
  groups: string[];
  updatedAt: string;
  isCustom?: boolean;
}

export interface EPGProgram {
  id: string;
  channelId: string;
  title: string;
  description: string;
  category: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  durationMinutes: number;
  progressPercent: number; // 0 - 100
  isLive: boolean;
  poster?: string;
}

export interface StreamDiagnostics {
  url: string;
  currentResolution: string;
  availableResolutions: string[];
  bufferedSeconds: number;
  liveLatency: number;
  droppedFrames: number;
  bandwidthKbps: number;
  isHls: boolean;
  status: 'idle' | 'loading' | 'playing' | 'buffering' | 'error';
  errorMessage?: string;
}

export type AspectRatio = '16:9' | '4:3' | 'fill' | 'fit';

export interface SiteConfig {
  playlistUrl: string;
  playlistName: string;
  epgUrl?: string;
  autoRefreshMinutes: number;
  adminPin?: string;
  hasPin?: boolean;
  customChannels: Channel[];
  disabledChannelIds: string[];
  lastUpdated: string;
  lastSyncStatus?: 'ok' | 'error';
  lastSyncMessage?: string;
  cachedChannelCount?: number;
  // Branding
  appName?: string;
  appLogo?: string;
  appTagline?: string;
  primaryColor?: string;
  accentColor?: string;
}
