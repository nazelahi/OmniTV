import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { Channel, Playlist, StreamDiagnostics, SiteConfig, EPGProgram } from './types/playlist';
import { DEFAULT_PLAYLIST, DEFAULT_CHANNELS, DEFAULT_PLAYLIST_URL } from './utils/defaultChannels';
import { parseM3U } from './utils/m3uParser';
import { parseXMLTV } from './utils/epgParser';
import { YouTubeTopBar } from './components/YouTubeTopBar';
import { Sidebar } from './components/Sidebar';
import { HomeScreen } from './components/HomeScreen';
import { WatchScreen } from './components/WatchScreen';
import { EPGScheduleGuide } from './components/EPGScheduleGuide';
import { VirtualRemote } from './components/VirtualRemote';
const DiagnosticsModal = lazy(() => import('./components/DiagnosticsModal').then((m) => ({ default: m.DiagnosticsModal })));
const KeyboardShortcutsHelp = lazy(() => import('./components/KeyboardShortcutsHelp').then((m) => ({ default: m.KeyboardShortcutsHelp })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel })));
import { RefreshCw, Home, Radio, Layers, Menu, Tv } from 'lucide-react';

const FAVORITES_STORAGE_KEY = 'omnistream_favorites';

export default function App() {
  const savedFavoriteIdsRef = useRef<Set<string>>(
    (() => {
      try {
        const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return new Set<string>(parsed.filter((id) => typeof id === 'string'));
          }
        }
      } catch {}
      return new Set<string>();
    })()
  );

  // Authoritative site playlist managed strictly by the Admin Console
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist>(DEFAULT_PLAYLIST);

  // Active channel
  const [activeChannelId, setActiveChannelId] = useState<string>(() => {
    try {
      const savedCh = localStorage.getItem('omnistream_active_channel_id');
      if (savedCh) return savedCh;
    } catch {}
    return currentPlaylist.channels[0]?.id || DEFAULT_CHANNELS[0].id;
  });

  const activeChannel = currentPlaylist.channels.find((c) => c.id === activeChannelId) || currentPlaylist.channels[0] || DEFAULT_CHANNELS[0];

  // Keep the latest active channel id available inside stable callbacks
  const activeChannelIdRef = useRef(activeChannelId);
  activeChannelIdRef.current = activeChannelId;

  // Recently watched channels (history)
  const [recentChannelIds, setRecentChannelIds] = useState<string[]>(() => {
    try {
      const savedRecents = localStorage.getItem('omnistream_recents');
      if (savedRecents) return JSON.parse(savedRecents);
    } catch {}
    return [DEFAULT_CHANNELS[0].id, DEFAULT_CHANNELS[1].id, DEFAULT_CHANNELS[4].id];
  });

  // YouTube View state: 'home' | 'player' | 'epg'
  const [currentView, setCurrentView] = useState<'home' | 'player' | 'epg'>('home');

  // Responsive mobile detection & YouTube Sidebar state
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const handleBreakpoint = (e: MediaQueryListEvent | MediaQueryList) => {
      const mobile = e.matches;
      setIsMobile(mobile);
      // Auto-collapse overlay drawer when entering mobile; expand rail cleanly on desktop
      setIsSidebarCollapsed(mobile);
    };
    handleBreakpoint(mql);
    mql.addEventListener('change', handleBreakpoint);
    return () => mql.removeEventListener('change', handleBreakpoint);
  }, []);

  useEffect(() => {
    if (!isMobile || isSidebarCollapsed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarCollapsed(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile, isSidebarCollapsed]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.location.pathname.startsWith('/admin') : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      setIsAdminRoute(window.location.pathname.startsWith('/admin'));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Modals & Panels
  const [isRemoteOpen, setIsRemoteOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);
  const [isSiteSyncing, setIsSiteSyncing] = useState<boolean>(false);

  // Site server configuration
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);

  // Apply branding (app name, colors) to the document
  useEffect(() => {
    const name = siteConfig?.appName || 'OmniStream TV';
    document.title = name;
    const root = document.documentElement;
    if (siteConfig?.primaryColor) {
      root.style.setProperty('--primary-color', siteConfig.primaryColor);
    }
    if (siteConfig?.accentColor) {
      root.style.setProperty('--accent-color', siteConfig.accentColor);
    }
  }, [siteConfig]);

  // Parsed EPG (XMLTV) data: channelId -> programs
  const [epgData, setEpgData] = useState<Map<string, EPGProgram[]> | null>(null);

  // Stream diagnostics telemetry state
  const [streamDiagnostics, setStreamDiagnostics] = useState<StreamDiagnostics>({
    url: activeChannel.url,
    currentResolution: 'Auto',
    availableResolutions: [],
    bufferedSeconds: 0,
    liveLatency: 0,
    droppedFrames: 0,
    bandwidthKbps: 0,
    isHls: true,
    status: 'idle',
  });

  // Remove any legacy user playlist overrides from localStorage so viewers always see Admin lineup
  useEffect(() => {
    try {
      localStorage.removeItem('omnistream_playlists');
      localStorage.removeItem('omnistream_active_playlist_id');
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('omnistream_active_channel_id', activeChannelId);
    } catch {}
  }, [activeChannelId]);

  useEffect(() => {
    try {
      localStorage.setItem('omnistream_recents', JSON.stringify(recentChannelIds));
    } catch {}
  }, [recentChannelIds]);

  // Channel selection handler
  const handleSelectChannel = useCallback((channel: Channel) => {
    setActiveChannelId(channel.id);
    setRecentChannelIds((prev) => {
      const filtered = prev.filter((id) => id !== channel.id);
      return [channel.id, ...filtered].slice(0, 8);
    });
  }, []);

  // Fetch authoritative Admin-configured playlist from server and apply to state
  const reloadFromRemoteUrl = useCallback(async (cfg?: SiteConfig): Promise<boolean> => {
    setIsSiteSyncing(true);
    try {
      let currentCfg = cfg;
      if (!currentCfg) {
        const cfgRes = await fetch('/api/config', { cache: 'no-store' });
        if (cfgRes.ok) {
          currentCfg = await cfgRes.json();
          setSiteConfig(currentCfg || null);
        }
      }

      const effectivePlaylistUrl = currentCfg?.playlistUrl?.trim() || DEFAULT_PLAYLIST_URL;
      const effectivePlaylistName = currentCfg?.playlistName?.trim() || DEFAULT_PLAYLIST.name;

      const playlistRes = await fetch('/api/fetch-playlist', { cache: 'no-store' });
      if (!playlistRes.ok) {
        throw new Error(`Server returned HTTP ${playlistRes.status}`);
      }

      const m3uText = await playlistRes.text();
      const parsed = parseM3U(m3uText, effectivePlaylistName, effectivePlaylistUrl);

      let combinedChannels = [...parsed.channels];
      if (Array.isArray(currentCfg?.customChannels) && currentCfg.customChannels.length > 0) {
        combinedChannels = [...currentCfg.customChannels, ...combinedChannels];
      }

      if (Array.isArray(currentCfg?.disabledChannelIds) && currentCfg.disabledChannelIds.length > 0) {
        const disabledSet = new Set(currentCfg.disabledChannelIds);
        combinedChannels = combinedChannels.filter((c) => !disabledSet.has(c.id));
      }

      combinedChannels = combinedChannels.map((ch, idx) => ({
        ...ch,
        channelNumber: ch.channelNumber || idx + 1,
      }));

      const groupsSet = new Set<string>();
      combinedChannels.forEach((c) => groupsSet.add(c.group));
      const groups = Array.from(groupsSet).sort();

      setCurrentPlaylist((prev) => {
        const favoriteIds = new Set([
          ...prev.channels.filter((c) => c.isFavorite).map((c) => c.id),
          ...Array.from(savedFavoriteIdsRef.current),
        ]);

        return {
          id: 'global-server-playlist',
          name: effectivePlaylistName,
          url: effectivePlaylistUrl,
          epgUrl: currentCfg?.epgUrl || parsed.epgUrl || undefined,
          channels: combinedChannels.map((ch) =>
            favoriteIds.has(ch.id) ? { ...ch, isFavorite: true } : ch
          ),
          groups: groups.length > 0 ? groups : ['General'],
          updatedAt: new Date().toISOString(),
          isCustom: false,
        };
      });

      if (combinedChannels.length > 0) {
        const exists = combinedChannels.some((c) => c.id === activeChannelIdRef.current);
        if (!exists) {
          handleSelectChannel(combinedChannels[0]);
        }
      }
      return true;
    } catch (err) {
      console.error('Failed to load global playlist from server:', err);
      return false;
    } finally {
      setIsSiteSyncing(false);
    }
  }, [handleSelectChannel]);

  // Initial load & optional periodic sync with Admin configuration
  useEffect(() => {
    fetch('/api/config', { cache: 'no-store' })
      .then((res) => res.json())
      .then((cfg: SiteConfig) => {
        setSiteConfig(cfg || null);
        reloadFromRemoteUrl(cfg);
      })
      .catch((err) => {
        console.warn('Backend config unavailable, loading default remote playlist:', err);
        reloadFromRemoteUrl({
          playlistUrl: DEFAULT_PLAYLIST_URL,
          playlistName: DEFAULT_PLAYLIST.name,
          autoRefreshMinutes: 60,
          customChannels: [],
          disabledChannelIds: [],
          lastUpdated: new Date().toISOString(),
        });
      });
  }, [reloadFromRemoteUrl]);

  useEffect(() => {
    const minutes = siteConfig?.autoRefreshMinutes ?? 0;
    if (!minutes || minutes <= 0) return;
    const interval = setInterval(() => {
      reloadFromRemoteUrl();
    }, minutes * 60 * 1000);
    return () => clearInterval(interval);
  }, [siteConfig?.autoRefreshMinutes, reloadFromRemoteUrl]);

  // Next / Prev Channel
  const handleNextChannel = useCallback(() => {
    const channels = currentPlaylist.channels;
    if (channels.length === 0) return;
    const currentIndex = channels.findIndex((c) => c.id === activeChannelId);
    const nextIndex = (currentIndex + 1) % channels.length;
    handleSelectChannel(channels[nextIndex]);
  }, [currentPlaylist.channels, activeChannelId, handleSelectChannel]);

  const handlePrevChannel = useCallback(() => {
    const channels = currentPlaylist.channels;
    if (channels.length === 0) return;
    const currentIndex = channels.findIndex((c) => c.id === activeChannelId);
    const prevIndex = (currentIndex - 1 + channels.length) % channels.length;
    handleSelectChannel(channels[prevIndex]);
  }, [currentPlaylist.channels, activeChannelId, handleSelectChannel]);

  // Select channel by numerical number
  const handleSelectChannelByNumber = useCallback((num: number) => {
    const channels = currentPlaylist.channels;
    const found = channels.find((c) => c.channelNumber === num);
    if (found) {
      handleSelectChannel(found);
    } else if (num >= 1 && num <= channels.length) {
      handleSelectChannel(channels[num - 1]);
    }
  }, [currentPlaylist.channels, handleSelectChannel]);

  // Toggle favorite (stored locally in visitor's browser without requiring login)
  const handleToggleFavorite = useCallback((channelId: string) => {
    setCurrentPlaylist((prev) => ({
      ...prev,
      channels: prev.channels.map((ch) => {
        if (ch.id !== channelId) return ch;
        const toggledNext = !ch.isFavorite;
        if (toggledNext) {
          savedFavoriteIdsRef.current.add(channelId);
        } else {
          savedFavoriteIdsRef.current.delete(channelId);
        }
        try {
          localStorage.setItem(
            FAVORITES_STORAGE_KEY,
            JSON.stringify(Array.from(savedFavoriteIdsRef.current))
          );
        } catch {}
        return { ...ch, isFavorite: toggledNext };
      }),
    }));
  }, []);

  // Physical Keyboard Shortcuts
  const numberBufferRef = useRef<string>('');
  const numberTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        numberBufferRef.current += e.key;
        if (numberTimerRef.current) clearTimeout(numberTimerRef.current);

        numberTimerRef.current = setTimeout(() => {
          const num = parseInt(numberBufferRef.current, 10);
          if (!isNaN(num)) {
            handleSelectChannelByNumber(num);
          }
          numberBufferRef.current = '';
        }, 1200);
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          handleNextChannel();
          break;
        case 'ArrowDown':
          e.preventDefault();
          handlePrevChannel();
          break;
        case 'h':
        case 'H':
          setCurrentView('home');
          break;
        case 'g':
        case 'G':
          setCurrentView((v) => (v === 'epg' ? 'home' : 'epg'));
          break;
        case 'r':
        case 'R':
          setIsRemoteOpen((r) => !r);
          break;
        case 't':
        case 'T':
          setIsTheaterMode((t) => !t);
          break;
        case 'd':
        case 'D':
          setIsDiagnosticsOpen((d) => !d);
          break;
        case 'Escape':
          setIsDiagnosticsOpen(false);
          setIsShortcutsOpen(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextChannel, handlePrevChannel, handleSelectChannelByNumber]);

  // Identity of the channel lineup, so EPG is only re-downloaded when channels change
  // (not when a favorite flag changes) — avoids multi-MB refetches.
  const channelSignature = useMemo(
    () => currentPlaylist.channels.map((c) => `${c.id}:${c.tvgId || ''}`).join('|'),
    [currentPlaylist.channels]
  );
  const channelsRef = useRef(currentPlaylist.channels);
  channelsRef.current = currentPlaylist.channels;

  // Fetch & parse XMLTV EPG when an EPG URL is available
  useEffect(() => {
    const epgUrl = siteConfig?.epgUrl || currentPlaylist.epgUrl;
    if (!epgUrl) {
      setEpgData(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/fetch-epg?url=${encodeURIComponent(epgUrl)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          if (!cancelled) setEpgData(new Map());
          return;
        }
        const text = await res.text();
        if (cancelled) return;
        const parsed = parseXMLTV(text, channelsRef.current);
        if (!cancelled) setEpgData(parsed);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn('Failed to load EPG:', err);
        if (!cancelled) setEpgData(new Map());
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [siteConfig?.epgUrl, currentPlaylist.epgUrl, channelSignature]);

  // Recent channels objects
  const recentChannels = useMemo(() => {
    return recentChannelIds
      .map((id) => currentPlaylist.channels.find((c) => c.id === id))
      .filter((c): c is Channel => !!c);
  }, [recentChannelIds, currentPlaylist.channels]);

  // Favorites count
  const favoritesCount = useMemo(() => {
    return currentPlaylist.channels.filter((c) => c.isFavorite).length;
  }, [currentPlaylist.channels]);

  if (isAdminRoute) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#070102]" />}>
        <AdminPanel
          mode="page"
          isOpen={true}
          onClose={() => {
            window.history.pushState({}, '', '/');
            setIsAdminRoute(false);
          }}
          onConfigSaved={(updatedCfg) => {
            setSiteConfig(updatedCfg);
          }}
          onForceReloadChannels={() => reloadFromRemoteUrl()}
          channels={currentPlaylist.channels}
        />
      </Suspense>
    );
  }

  return (
    <div className="h-screen bg-[radial-gradient(ellipse_120%_80%_at_50%_-15%,rgba(225,29,72,0.22),rgba(80,7,20,0.12)_45%,rgba(7,2,3,0.98)_85%)] bg-[#070102] text-neutral-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white overflow-hidden relative">
      {/* Red & Black Ambient Glow Cones */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[480px] bg-rose-600/15 rounded-full blur-[140px] -z-10" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-[550px] h-[450px] bg-rose-950/25 rounded-full blur-[140px] -z-10" />
      <div className="pointer-events-none fixed top-1/3 left-0 w-[450px] h-[450px] bg-rose-900/10 rounded-full blur-[130px] -z-10" />

      {/* 1. Full YouTube-style Top Bar */}
      <YouTubeTopBar
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        isSidebarOpen={!isSidebarCollapsed}
        searchQuery={searchQuery}
        onSearchChange={(q) => setSearchQuery(q)}
        onSubmitSearch={() => {
          if (currentView !== 'home') setCurrentView('home');
        }}
        channels={currentPlaylist.channels}
        groups={currentPlaylist.groups}
        epgData={epgData}
        onSelectChannel={(ch) => {
          handleSelectChannel(ch);
          setCurrentView('player');
        }}
        onSelectCategory={setSelectedCategory}
        onToggleRemote={() => setIsRemoteOpen((prev) => !prev)}
        isRemoteOpen={isRemoteOpen}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onGoHome={() => setCurrentView('home')}
        appName={siteConfig?.appName}
        appLogo={siteConfig?.appLogo}
      />

      {/* Synchronizing banner if active */}
      {isSiteSyncing && (
        <div className="bg-rose-950/80 border-b border-rose-800/60 py-1 px-4 text-center text-xs text-rose-200 flex items-center justify-center gap-2 shrink-0">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
          <span>Synchronizing live television playlist from server...</span>
        </div>
      )}

      {/* 2. YouTube-style Layout Body: Sidebar + Scrollable Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* YouTube Collapsible Left Sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          isMobile={isMobile}
          currentView={currentView}
          onViewChange={setCurrentView}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          groups={currentPlaylist.groups}
          favoritesCount={favoritesCount}
          onToggleRemote={() => setIsRemoteOpen((prev) => !prev)}
          isRemoteOpen={isRemoteOpen}
          onClose={() => setIsSidebarCollapsed(true)}
          appName={siteConfig?.appName}
          appLogo={siteConfig?.appLogo}
          appTagline={siteConfig?.appTagline}
        />

        {/* Main View Area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-0 pb-24 md:pb-6">
          <div className="max-w-[1700px] w-full mx-auto">
            {currentView === 'home' ? (
              <HomeScreen
                channels={currentPlaylist.channels}
                featuredChannel={activeChannel}
                onWatchChannel={(ch) => {
                  handleSelectChannel(ch);
                  setCurrentView('player');
                }}
                onToggleFavorite={handleToggleFavorite}
                onGoToEPG={() => setCurrentView('epg')}
                groups={currentPlaylist.groups}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                epgData={epgData}
              />
            ) : currentView === 'player' ? (
              <WatchScreen
                channel={activeChannel}
                channels={currentPlaylist.channels}
                onSelectChannel={handleSelectChannel}
                onNextChannel={handleNextChannel}
                onPrevChannel={handlePrevChannel}
                onToggleFavorite={handleToggleFavorite}
                onBackToHome={() => setCurrentView('home')}
                groups={currentPlaylist.groups}
                isTheaterMode={isTheaterMode}
                onToggleTheaterMode={() => setIsTheaterMode(!isTheaterMode)}
                onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
                setStreamDiagnostics={setStreamDiagnostics}
                recentChannels={recentChannels}
                epgData={epgData}
              />
            ) : (
              /* Fullscreen EPG Schedule Guide View */
              <div className="h-[calc(100dvh-135px)] md:h-[calc(100dvh-85px)]">
                <EPGScheduleGuide
                  channels={currentPlaylist.channels}
                  activeChannel={activeChannel}
                  onSelectChannel={(ch) => {
                    handleSelectChannel(ch);
                    setCurrentView('player');
                  }}
                  onToggleFavorite={handleToggleFavorite}
                  epgUrl={siteConfig?.epgUrl || currentPlaylist.epgUrl}
                  epgData={epgData}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Thumb-zone anchor) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0a0204]/95 backdrop-blur-2xl border-t border-rose-950/60 flex items-center justify-around px-2 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black">
        <button
          onClick={() => setCurrentView('home')}
          className={`min-h-[44px] min-w-[44px] relative flex flex-col items-center justify-center gap-0.5 px-2.5 rounded-xl transition-all ${
            currentView === 'home' ? 'text-rose-500 font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Home className={`w-5 h-5 ${currentView === 'home' ? 'fill-rose-500/20' : ''}`} />
          <span className="text-[10px] tracking-tight">Home</span>
          {currentView === 'home' && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-rose-500" />}
        </button>

        <button
          onClick={() => setCurrentView('player')}
          className={`min-h-[44px] min-w-[44px] relative flex flex-col items-center justify-center gap-0.5 px-2.5 rounded-xl transition-all ${
            currentView === 'player' ? 'text-rose-500 font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Radio className={`w-5 h-5 ${currentView === 'player' ? 'fill-rose-500/20' : ''}`} />
          <span className="text-[10px] tracking-tight">Live TV</span>
          {currentView === 'player' && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-rose-500" />}
        </button>

        <button
          onClick={() => setCurrentView('epg')}
          className={`min-h-[44px] min-w-[44px] relative flex flex-col items-center justify-center gap-0.5 px-2.5 rounded-xl transition-all ${
            currentView === 'epg' ? 'text-rose-500 font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Layers className={`w-5 h-5 ${currentView === 'epg' ? 'fill-rose-500/20' : ''}`} />
          <span className="text-[10px] tracking-tight">Guide</span>
          {currentView === 'epg' && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-rose-500" />}
        </button>

        <button
          onClick={() => setIsRemoteOpen((prev) => !prev)}
          className={`min-h-[44px] min-w-[44px] relative flex flex-col items-center justify-center gap-0.5 px-2.5 rounded-xl transition-all ${
            isRemoteOpen ? 'text-rose-500 font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Tv className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Remote</span>
          {isRemoteOpen && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-rose-500" />}
        </button>

        <button
          onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          aria-expanded={!isSidebarCollapsed}
          className={`min-h-[44px] min-w-[44px] relative flex flex-col items-center justify-center gap-0.5 px-2.5 rounded-xl transition-all ${
            !isSidebarCollapsed ? 'text-rose-500 font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Menu</span>
          {!isSidebarCollapsed && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-rose-500" />}
        </button>
      </nav>

      {/* Floating Virtual TV Remote Controller */}
      <VirtualRemote
        isOpen={isRemoteOpen}
        onClose={() => setIsRemoteOpen(false)}
        activeChannel={activeChannel}
        onNextChannel={handleNextChannel}
        onPrevChannel={handlePrevChannel}
        onSelectChannelByNumber={handleSelectChannelByNumber}
        onToggleGuide={() => setCurrentView((v) => (v === 'player' ? 'epg' : 'player'))}
        onTriggerOSD={() => {
          handleSelectChannel(activeChannel);
        }}
      />

      {/* Lazy-loaded modals */}
      <Suspense fallback={null}>
        {/* Stream Technical Diagnostics Modal */}
        <DiagnosticsModal
          isOpen={isDiagnosticsOpen}
          onClose={() => setIsDiagnosticsOpen(false)}
          diagnostics={streamDiagnostics}
          channel={activeChannel}
        />

        {/* Keyboard Shortcuts Help Modal */}
        <KeyboardShortcutsHelp
          isOpen={isShortcutsOpen}
          onClose={() => setIsShortcutsOpen(false)}
        />
      </Suspense>
    </div>
  );
}
