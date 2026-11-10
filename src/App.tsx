import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Channel, Playlist, StreamDiagnostics, SiteConfig } from './types/playlist';
import { DEFAULT_PLAYLIST, DEFAULT_CHANNELS } from './utils/defaultChannels';
import { parseM3U } from './utils/m3uParser';
import { YouTubeTopBar } from './components/YouTubeTopBar';
import { Sidebar } from './components/Sidebar';
import { HomeScreen } from './components/HomeScreen';
import { WatchScreen } from './components/WatchScreen';
import { EPGScheduleGuide } from './components/EPGScheduleGuide';
import { VirtualRemote } from './components/VirtualRemote';
import { PlaylistModal } from './components/PlaylistModal';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp';
import { AdminPanel } from './components/AdminPanel';
import { RefreshCw } from 'lucide-react';

export default function App() {
  // Load saved playlists or default
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem('omnistream_playlists');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [DEFAULT_PLAYLIST];
  });

  const [activePlaylistId, setActivePlaylistId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('omnistream_active_playlist_id');
      if (savedId) return savedId;
    } catch {}
    return DEFAULT_PLAYLIST.id;
  });

  // Current active playlist
  const currentPlaylist = playlists.find((p) => p.id === activePlaylistId) || playlists[0] || DEFAULT_PLAYLIST;

  // Active channel
  const [activeChannelId, setActiveChannelId] = useState<string>(() => {
    try {
      const savedCh = localStorage.getItem('omnistream_active_channel_id');
      if (savedCh) return savedCh;
    } catch {}
    return currentPlaylist.channels[0]?.id || DEFAULT_CHANNELS[0].id;
  });

  const activeChannel = currentPlaylist.channels.find((c) => c.id === activeChannelId) || currentPlaylist.channels[0] || DEFAULT_CHANNELS[0];

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

  // YouTube Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modals & Panels
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isRemoteOpen, setIsRemoteOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);
  const [isSiteSyncing, setIsSiteSyncing] = useState<boolean>(false);

  // Site server configuration
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);

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

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('omnistream_playlists', JSON.stringify(playlists));
    } catch {}
  }, [playlists]);

  useEffect(() => {
    try {
      localStorage.setItem('omnistream_active_playlist_id', activePlaylistId);
    } catch {}
  }, [activePlaylistId]);

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

  // Fetch playlist from server and apply to state
  const reloadFromRemoteUrl = useCallback(async (cfg?: SiteConfig) => {
    setIsSiteSyncing(true);
    try {
      let currentCfg = cfg;
      if (!currentCfg) {
        const cfgRes = await fetch('/api/config');
        if (cfgRes.ok) {
          currentCfg = await cfgRes.json();
          setSiteConfig(currentCfg || null);
        }
      }

      if (!currentCfg || !currentCfg.playlistUrl) {
        setIsSiteSyncing(false);
        return;
      }

      const playlistRes = await fetch(`/api/fetch-playlist?url=${encodeURIComponent(currentCfg.playlistUrl)}`);
      if (!playlistRes.ok) {
        throw new Error(`Server returned HTTP ${playlistRes.status}`);
      }

      const m3uText = await playlistRes.text();
      const parsed = parseM3U(m3uText, currentCfg.playlistName || 'OmniStream Live TV', currentCfg.playlistUrl);

      let combinedChannels = [...parsed.channels];
      if (Array.isArray(currentCfg.customChannels) && currentCfg.customChannels.length > 0) {
        combinedChannels = [...currentCfg.customChannels, ...combinedChannels];
      }

      if (Array.isArray(currentCfg.disabledChannelIds) && currentCfg.disabledChannelIds.length > 0) {
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

      const globalPlaylist: Playlist = {
        id: 'global-server-playlist',
        name: currentCfg.playlistName || 'Primary Live TV',
        url: currentCfg.playlistUrl,
        channels: combinedChannels,
        groups: groups.length > 0 ? groups : ['General'],
        updatedAt: new Date().toISOString(),
        isCustom: false,
      };

      setPlaylists((prev) => {
        const filtered = prev.filter((p) => p.id !== 'global-server-playlist');
        return [globalPlaylist, ...filtered];
      });

      setActivePlaylistId('global-server-playlist');

      if (combinedChannels.length > 0) {
        const exists = combinedChannels.some((c) => c.id === activeChannelId);
        if (!exists) {
          handleSelectChannel(combinedChannels[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load global playlist from server:', err);
    } finally {
      setIsSiteSyncing(false);
    }
  }, [activeChannelId, handleSelectChannel]);

  // Initial load: check server config
  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((cfg: SiteConfig) => {
        setSiteConfig(cfg || null);
        if (cfg && cfg.playlistUrl) {
          reloadFromRemoteUrl(cfg);
        }
      })
      .catch((err) => {
        console.warn('Backend server not reachable, using offline default playlist:', err);
      });
  }, [reloadFromRemoteUrl]);

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

  // Toggle favorite
  const handleToggleFavorite = useCallback((channelId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== activePlaylistId) return pl;
        return {
          ...pl,
          channels: pl.channels.map((ch) =>
            ch.id === channelId ? { ...ch, isFavorite: !ch.isFavorite } : ch
          ),
        };
      })
    );
  }, [activePlaylistId]);

  // Load new local playlist
  const handleLoadPlaylist = (newPlaylist: Playlist) => {
    setPlaylists((prev) => {
      const existingIdx = prev.findIndex((p) => p.id === newPlaylist.id);
      if (existingIdx !== -1) {
        const copy = [...prev];
        copy[existingIdx] = newPlaylist;
        return copy;
      }
      return [newPlaylist, ...prev];
    });

    setActivePlaylistId(newPlaylist.id);
    if (newPlaylist.channels.length > 0) {
      handleSelectChannel(newPlaylist.channels[0]);
    }
  };

  // Delete playlist
  const handleDeletePlaylist = (id: string) => {
    if (id === DEFAULT_PLAYLIST.id || id === 'global-server-playlist') return;
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (activePlaylistId === id) {
      setActivePlaylistId(DEFAULT_PLAYLIST.id);
      if (DEFAULT_PLAYLIST.channels.length > 0) {
        handleSelectChannel(DEFAULT_PLAYLIST.channels[0]);
      }
    }
  };

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
          setIsPlaylistModalOpen(false);
          setIsAdminOpen(false);
          setIsDiagnosticsOpen(false);
          setIsShortcutsOpen(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextChannel, handlePrevChannel, handleSelectChannelByNumber]);

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

  return (
    <div className="h-screen bg-[radial-gradient(ellipse_120%_80%_at_50%_-15%,rgba(225,29,72,0.22),rgba(80,7,20,0.12)_45%,rgba(7,2,3,0.98)_85%)] bg-[#070102] text-neutral-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white overflow-hidden relative">
      {/* Red & Black Ambient Glow Cones */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[480px] bg-rose-600/15 rounded-full blur-[140px] -z-10" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-[550px] h-[450px] bg-rose-950/25 rounded-full blur-[140px] -z-10" />
      <div className="pointer-events-none fixed top-1/3 left-0 w-[450px] h-[450px] bg-rose-900/10 rounded-full blur-[130px] -z-10" />

      {/* 1. Full YouTube-style Top Bar */}
      <YouTubeTopBar
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenPlaylistModal={() => setIsPlaylistModalOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onToggleRemote={() => setIsRemoteOpen((prev) => !prev)}
        isRemoteOpen={isRemoteOpen}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onGoHome={() => setCurrentView('home')}
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
          currentView={currentView}
          onViewChange={setCurrentView}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          groups={currentPlaylist.groups}
          favoritesCount={favoritesCount}
          onOpenPlaylistModal={() => setIsPlaylistModalOpen(true)}
          onOpenAdmin={() => setIsAdminOpen(true)}
          onToggleRemote={() => setIsRemoteOpen((prev) => !prev)}
          isRemoteOpen={isRemoteOpen}
        />

        {/* Main View Area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4">
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
              />
            ) : (
              /* Fullscreen EPG Schedule Guide View */
              <div className="h-[calc(100vh-100px)]">
                <EPGScheduleGuide
                  channels={currentPlaylist.channels}
                  activeChannel={activeChannel}
                  onSelectChannel={(ch) => {
                    handleSelectChannel(ch);
                    setCurrentView('player');
                  }}
                  onToggleFavorite={handleToggleFavorite}
                  epgUrl={siteConfig?.epgUrl || currentPlaylist.epgUrl}
                  onOpenAdmin={() => setIsAdminOpen(true)}
                />
              </div>
            )}
          </div>
        </main>
      </div>

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

      {/* Admin Panel Modal */}
      <AdminPanel
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onConfigSaved={(updatedCfg) => {
          setSiteConfig(updatedCfg);
        }}
        onForceReloadChannels={() => reloadFromRemoteUrl()}
        channels={currentPlaylist.channels}
      />

      {/* Playlist Import / Management Modal */}
      <PlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        onLoadPlaylist={handleLoadPlaylist}
        savedPlaylists={playlists}
        activePlaylistId={activePlaylistId}
        onDeletePlaylist={handleDeletePlaylist}
        currentPlaylist={currentPlaylist}
      />

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
    </div>
  );
}
