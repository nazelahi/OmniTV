import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  Globe,
  RefreshCw,
  Check,
  AlertCircle,
  ExternalLink,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Download,
  RotateCcw,
  Radio,
  Sliders,
  X,
  Loader2,
  Tv,
} from 'lucide-react';
import { Channel, SiteConfig } from '../types/playlist';
import { SAMPLE_PLAYLIST_PRESETS, DEFAULT_PLAYLIST_URL } from '../utils/defaultChannels';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: (config: SiteConfig) => void;
  onForceReloadChannels: () => Promise<boolean | void>;
  channels: Channel[];
}

interface TestResult {
  success: boolean;
  status?: number;
  statusText?: string;
  elapsedMs?: number;
  hasM3UHeader?: boolean;
  channelCount?: number;
  bytes?: number;
  samplePreview?: string;
  error?: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  onForceReloadChannels,
  channels,
}) => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return (
      sessionStorage.getItem('omnistream_admin_auth') === 'true' &&
      !!sessionStorage.getItem('omnistream_admin_token')
    );
  });
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'playlist' | 'channels' | 'settings' | 'branding'>('playlist');

  // Form state
  const [playlistUrl, setPlaylistUrl] = useState<string>('');
  const [playlistName, setPlaylistName] = useState<string>('OmniStream TV Global');
  const [epgUrl, setEpgUrl] = useState<string>('');
  const [autoRefreshMinutes, setAutoRefreshMinutes] = useState<number>(60);
  const [newAdminPin, setNewAdminPin] = useState<string>('');
  const [disabledChannelIds, setDisabledChannelIds] = useState<string[]>([]);
  const [customChannels, setCustomChannels] = useState<Channel[]>([]);

  // Testing & Saving state
  const [isTestingUrl, setIsTestingUrl] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Add Custom Channel form state
  const [showAddChannel, setShowAddChannel] = useState<boolean>(false);
  const [newChName, setNewChName] = useState<string>('');
  const [newChUrl, setNewChUrl] = useState<string>('');
  const [newChLogo, setNewChLogo] = useState<string>('');
  const [newChGroup, setNewChGroup] = useState<string>('Custom');
  const [newChNumber, setNewChNumber] = useState<number>(100);

  // Branding state
  const [appName, setAppName] = useState<string>('OmniStream TV');
  const [appLogo, setAppLogo] = useState<string>('');
  const [appTagline, setAppTagline] = useState<string>('Live TV');
  const [primaryColor, setPrimaryColor] = useState<string>('#e11d48');
  const [accentColor, setAccentColor] = useState<string>('');

  // Fetch current server config on open
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/config', { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SiteConfig | null) => {
        if (data) {
          setPlaylistUrl(data.playlistUrl || '');
          setPlaylistName(data.playlistName || 'OmniStream TV Global');
          setEpgUrl(data.epgUrl || '');
          setAutoRefreshMinutes(data.autoRefreshMinutes || 60);
          setDisabledChannelIds(data.disabledChannelIds || []);
          setCustomChannels(data.customChannels || []);
          setAppName(data.appName || 'OmniStream TV');
          setAppLogo(data.appLogo || '');
          setAppTagline(data.appTagline || 'Live TV');
          setPrimaryColor(data.primaryColor || '#e11d48');
          setAccentColor(data.accentColor || '');
        }
      })
      .catch((err) => {
        console.error('Failed to load server config:', err);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  // PIN Verification with transient retry & safe response parsing
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingPin(true);
    setPinError(null);

    const attemptVerify = async () => {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ pin: pinInput }),
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }
      return { res, data };
    };

    try {
      let result = await attemptVerify();
      // Retry once if proxy/dev server is briefly restarting (502/503/504 or non-JSON gateway page)
      if (!result.data && [502, 503, 504].includes(result.res.status)) {
        await new Promise((r) => setTimeout(r, 600));
        result = await attemptVerify();
      }

      const { res, data } = result;
      if (res.ok && data?.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem('omnistream_admin_auth', 'true');
        if (data.token) {
          sessionStorage.setItem('omnistream_admin_token', data.token);
        }
        setPinInput('');
      } else if (data?.error) {
        setPinError(data.error);
      } else if (!res.ok) {
        setPinError(`Server error (HTTP ${res.status}). Please try again.`);
      } else {
        setPinError('Unexpected server response. Please refresh and try again.');
      }
    } catch {
      // One automatic retry on transient network interruption (e.g., server restart)
      try {
        await new Promise((r) => setTimeout(r, 600));
        const { res, data } = await attemptVerify();
        if (res.ok && data?.success) {
          setIsAuthenticated(true);
          sessionStorage.setItem('omnistream_admin_auth', 'true');
          if (data.token) {
            sessionStorage.setItem('omnistream_admin_token', data.token);
          }
          setPinInput('');
          return;
        }
        setPinError(data?.error || (res.ok ? 'Incorrect Admin PIN' : `Server error (HTTP ${res.status}). Please try again.`));
      } catch {
        setPinError('Unable to reach server to verify PIN. Please check your connection or reload the page.');
      }
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Test Playlist URL via backend
  const handleTestUrl = async () => {
    const targetUrl = playlistUrl.trim() || DEFAULT_PLAYLIST_URL;

    setIsTestingUrl(true);
    setTestResult(null);

    try {
      const token = sessionStorage.getItem('omnistream_admin_token');
      const res = await fetch('/api/test-playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ url: targetUrl }),
      });

      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : { success: false, error: `HTTP ${res.status}` };
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'Failed to connect to test endpoint.',
      });
    } finally {
      setIsTestingUrl(false);
    }
  };

  // Save Configuration to Server
  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    const resolvedUrl = playlistUrl.trim() || DEFAULT_PLAYLIST_URL;
    const payload: Partial<SiteConfig> = {
      playlistUrl: resolvedUrl,
      playlistName: playlistName.trim() || (resolvedUrl === DEFAULT_PLAYLIST_URL ? 'BDIX IPTV' : 'OmniStream TV Global'),
      epgUrl: epgUrl.trim(),
      autoRefreshMinutes,
      disabledChannelIds,
      customChannels,
      appName: appName.trim() || 'OmniStream TV',
      appLogo: appLogo.trim(),
      appTagline: appTagline.trim(),
      primaryColor: primaryColor.trim() || '#e11d48',
      accentColor: accentColor.trim(),
    };

    if (newAdminPin.trim()) {
      payload.adminPin = newAdminPin.trim();
    }

    try {
      const token = sessionStorage.getItem('omnistream_admin_token');
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.status === 401) {
        // Session expired or server restarted: force re-authentication instead of
        // leaving the panel unlocked with a dead token.
        sessionStorage.removeItem('omnistream_admin_auth');
        sessionStorage.removeItem('omnistream_admin_token');
        setIsAuthenticated(false);
        setSaveError('Admin session expired. Please sign in again.');
        return;
      }
      if (res.ok && data.success) {
        setSaveSuccess('Configuration saved and published to the website!');
        onConfigSaved(data.config);

        // Immediately trigger refresh of channels across site
        const synced = await onForceReloadChannels();
        if (synced === false) {
          setSaveError('Settings saved, but the playlist could not be refreshed. Check the playlist URL.');
        } else {
          setSaveSuccess('Configuration saved and published to the website!');
        }
        setNewAdminPin('');

        setTimeout(() => {
          setSaveSuccess(null);
        }, 3000);
      } else {
        setSaveError(data.error || 'Failed to save configuration');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Error communicating with server');
    } finally {
      setIsSaving(false);
    }
  };

  // Force sync channels now
  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const ok = await onForceReloadChannels();
      if (ok === false) {
        setSaveError('Failed to reload playlist. Verify the playlist URL and server connectivity.');
      } else {
        setSaveSuccess('Playlist refetched and synced successfully!');
        setTimeout(() => setSaveSuccess(null), 3000);
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed to reload playlist');
    } finally {
      setIsSyncing(false);
    }
  };

  // Toggle channel visibility
  const toggleChannelVisibility = (channelId: string) => {
    setDisabledChannelIds((prev) => {
      if (prev.includes(channelId)) {
        return prev.filter((id) => id !== channelId);
      } else {
        return [...prev, channelId];
      }
    });
  };

  // Add custom channel
  const handleAddCustomChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChName.trim() || !newChUrl.trim()) return;

    const newChannel: Channel = {
      id: `custom-${Date.now().toString(36)}`,
      name: newChName.trim(),
      url: newChUrl.trim(),
      logo: newChLogo.trim() || undefined,
      group: newChGroup.trim() || 'Custom',
      channelNumber: newChNumber || channels.length + 1,
      isFavorite: true,
    };

    setCustomChannels((prev) => [...prev, newChannel]);
    setNewChName('');
    setNewChUrl('');
    setNewChLogo('');
    setShowAddChannel(false);
  };

  const handleRemoveCustomChannel = (id: string) => {
    setCustomChannels((prev) => prev.filter((c) => c.id !== id));
  };

  // Export JSON backup
  const handleExportBackup = () => {
    const backup = {
      playlistUrl,
      playlistName,
      epgUrl,
      autoRefreshMinutes,
      customChannels,
      disabledChannelIds,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omnistream_config_backup_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Website Admin Panel</h3>
                <span className="px-1.5 py-0.2 bg-neutral-800 border border-neutral-700 rounded text-[10px] font-mono font-semibold text-neutral-300">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Configure global live TV playlist URL, channels, and streaming options.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PIN Authentication Gate */}
        {!isAuthenticated ? (
          <div className="p-8 flex flex-col items-center justify-center text-center my-auto">
            <div className="w-14 h-14 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 mb-4 shadow-lg">
              <Key className="w-7 h-7 text-rose-500" />
            </div>
            <h4 className="text-lg font-bold text-white mb-1">Admin Authentication</h4>
            <p className="text-xs text-neutral-400 max-w-sm mb-6">
              Enter the admin passcode to modify global website playlist settings and channel configurations.
            </p>

            <form onSubmit={handleVerifyPin} className="w-full max-w-xs space-y-3">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter 4-digit PIN..."
                maxLength={8}
                autoFocus
                className="w-full text-center tracking-widest font-mono text-base px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
              />

              {pinError && (
                <div className="text-xs text-rose-400 flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifyingPin}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm shadow-rose-900/30 flex items-center justify-center gap-2"
              >
                {isVerifyingPin ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying PIN...</span>
                  </>
                ) : (
                  <span>Unlock Admin Panel</span>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Admin Workspace */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Admin Tabs */}
            <div className="flex border-b border-neutral-800 bg-neutral-950/60 px-3 sm:px-4 pt-2 gap-1.5 sm:gap-2 text-xs font-semibold overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveTab('playlist')}
                className={`flex items-center gap-1.5 sm:gap-2 pb-2.5 px-2.5 sm:px-3 border-b-2 shrink-0 whitespace-nowrap transition-colors ${
                  activeTab === 'playlist'
                    ? 'border-rose-500 text-white'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-rose-500" />
                <span>Primary Playlist URL</span>
              </button>

              <button
                onClick={() => setActiveTab('channels')}
                className={`flex items-center gap-1.5 sm:gap-2 pb-2.5 px-2.5 sm:px-3 border-b-2 shrink-0 whitespace-nowrap transition-colors ${
                  activeTab === 'channels'
                    ? 'border-rose-500 text-white'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-neutral-400" />
                <span>Channel Overrides ({channels.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('branding')}
                className={`flex items-center gap-1.5 sm:gap-2 pb-2.5 px-2.5 sm:px-3 border-b-2 shrink-0 whitespace-nowrap transition-colors ${
                  activeTab === 'branding'
                    ? 'border-rose-500 text-white'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-rose-500" />
                <span>Branding</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 sm:gap-2 pb-2.5 px-2.5 sm:px-3 border-b-2 shrink-0 whitespace-nowrap transition-colors ${
                  activeTab === 'settings'
                    ? 'border-rose-500 text-white'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-neutral-400" />
                <span>Security & Backup</span>
              </button>
            </div>

            {/* Notification Messages */}
            <div className="px-5 pt-3">
              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{saveSuccess}</span>
                </div>
              )}
              {saveError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}
            </div>

            {/* Tab 1: Primary Playlist URL Configuration */}
            {activeTab === 'playlist' && (
              <div className="p-5 flex-1 overflow-y-auto space-y-5">
                {/* Playlist URL Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-neutral-200">
                      Primary Live TV Playlist URL (.m3u / .m3u8)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setPlaylistUrl(DEFAULT_PLAYLIST_URL);
                        setPlaylistName('BDIX IPTV');
                        setTestResult(null);
                      }}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold transition-colors"
                    >
                      Use Default Playlist
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={playlistUrl}
                      onChange={(e) => setPlaylistUrl(e.target.value)}
                      placeholder={DEFAULT_PLAYLIST_URL}
                      className="flex-1 px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 font-mono"
                    />
                    <button
                      type="button"
                      disabled={isTestingUrl}
                      onClick={handleTestUrl}
                      className="px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-xl text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5"
                    >
                      {isTestingUrl ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Test Connection</span>
                    </button>
                  </div>
                </div>

                {/* Connection Test Diagnostic Card */}
                {testResult && (
                  <div
                    className={`p-4 rounded-xl border text-xs ${
                      testResult.success
                        ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                        : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 font-bold">
                        {testResult.success ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>Connection Verified (HTTP {testResult.status})</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-rose-400" />
                            <span>Connection Failed</span>
                          </>
                        )}
                      </div>
                      {testResult.elapsedMs && (
                        <span className="font-mono text-[11px] text-neutral-400">
                          {testResult.elapsedMs}ms latency
                        </span>
                      )}
                    </div>

                    {testResult.success ? (
                      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-neutral-800/60 font-mono text-center">
                        <div className="p-2 bg-neutral-950/60 rounded-lg">
                          <span className="text-[10px] text-neutral-400 block">Channels Found</span>
                          <span className="text-sm font-bold text-white">
                            {testResult.channelCount || 0}
                          </span>
                        </div>
                        <div className="p-2 bg-neutral-950/60 rounded-lg">
                          <span className="text-[10px] text-neutral-400 block">M3U Header</span>
                          <span className="text-sm font-bold text-white">
                            {testResult.hasM3UHeader ? 'Valid' : 'Custom'}
                          </span>
                        </div>
                        <div className="p-2 bg-neutral-950/60 rounded-lg">
                          <span className="text-[10px] text-neutral-400 block">Payload Size</span>
                          <span className="text-sm font-bold text-white">
                            {Math.round((testResult.bytes || 0) / 1024)} KB
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-rose-300 mt-1">{testResult.error}</p>
                    )}
                  </div>
                )}

                {/* EPG Schedule Guide URL Configuration */}
                <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-rose-500" />
                      <span>EPG TV Schedule Guide URL (XMLTV / .xml / .xml.gz)</span>
                    </label>
                    <span className="text-[11px] text-rose-400 font-mono">
                      {epgUrl ? 'Custom EPG Active' : 'Auto Clock Engine'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Specifies the XMLTV source for electronic program schedules and channel showtimes. If your M3U playlist contains an <code className="text-neutral-300 bg-neutral-900 px-1 py-0.5 rounded font-mono">x-tvg-url</code> or <code className="text-neutral-300 bg-neutral-900 px-1 py-0.5 rounded font-mono">url-tvg</code> header, it automatically links to your channels. You can also enter a direct XMLTV guide URL below:
                  </p>
                  <input
                    type="url"
                    value={epgUrl}
                    onChange={(e) => setEpgUrl(e.target.value)}
                    placeholder="https://iptv-org.github.io/epg/guides/en/guide.xml (or leave blank for Auto Engine)"
                    className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 font-mono"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-neutral-500 font-semibold mr-1">EPG Presets:</span>
                    <button
                      type="button"
                      onClick={() => setEpgUrl('https://iptv-org.github.io/epg/guides/en/guide.xml')}
                      className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-300 hover:text-white rounded-lg transition-colors font-mono"
                    >
                      iptv-org (Global English)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEpgUrl('https://iptv-org.github.io/epg/guides/us/tvguide.com.epg.xml')}
                      className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-300 hover:text-white rounded-lg transition-colors font-mono"
                    >
                      iptv-org (US TVGuide)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEpgUrl('')}
                      className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-400 hover:text-rose-400 rounded-lg transition-colors"
                    >
                      Clear (Use Built-in Engine)
                    </button>
                  </div>
                </div>

                {/* Website Display Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      Website Playlist Title
                    </label>
                    <input
                      type="text"
                      value={playlistName}
                      onChange={(e) => setPlaylistName(e.target.value)}
                      placeholder="e.g. OmniStream Global Live TV"
                      className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      Auto-Refresh Frequency
                    </label>
                    <select
                      value={autoRefreshMinutes}
                      onChange={(e) => setAutoRefreshMinutes(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value={30}>Every 30 Minutes</option>
                      <option value={60}>Every 1 Hour (Recommended)</option>
                      <option value={360}>Every 6 Hours</option>
                      <option value={720}>Every 12 Hours</option>
                      <option value={1440}>Every 24 Hours</option>
                      <option value={0}>Manual Only (No Auto-Refresh)</option>
                    </select>
                  </div>
                </div>

                {/* Popular Tested Preset URLs (1-Click Apply) */}
                <div className="pt-3 border-t border-neutral-800">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
                    Popular Free Open IPTV Presets (1-Click Fill)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SAMPLE_PLAYLIST_PRESETS.slice(1).map((preset) => (
                      <button
                        key={preset.title}
                        type="button"
                        onClick={() => {
                          setPlaylistUrl(preset.url);
                          setPlaylistName(preset.title);
                          setTestResult(null);
                        }}
                        className="text-left p-2.5 rounded-xl bg-neutral-950/60 hover:bg-neutral-800 border border-neutral-800 text-xs transition-colors flex items-center justify-between"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-white truncate">{preset.title}</p>
                          <p className="text-[11px] text-neutral-400 truncate">{preset.desc}</p>
                        </div>
                        <span className="text-[10px] text-rose-400 font-mono shrink-0">Apply</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Channel Overrides & Custom Channel Manager */}
            {activeTab === 'channels' && (
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Channels in Playlist ({channels.length})
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      Hide individual channels or inject custom streaming channels directly.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddChannel(!showAddChannel)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom Channel</span>
                  </button>
                </div>

                {/* Add Custom Channel Form */}
                {showAddChannel && (
                  <form
                    onSubmit={handleAddCustomChannel}
                    className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                      <span className="text-xs font-bold text-white">Add New Live Stream Channel</span>
                      <button
                        type="button"
                        onClick={() => setShowAddChannel(false)}
                        className="text-neutral-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-neutral-300 mb-1">
                          Channel Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={newChName}
                          onChange={(e) => setNewChName(e.target.value)}
                          placeholder="e.g. My Private Sports Feed"
                          className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-neutral-300 mb-1">
                          Category / Group
                        </label>
                        <input
                          type="text"
                          value={newChGroup}
                          onChange={(e) => setNewChGroup(e.target.value)}
                          placeholder="e.g. Sports, News, Movies"
                          className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] text-neutral-300 mb-1">
                          Stream URL (.m3u8, .mp4) *
                        </label>
                        <input
                          type="url"
                          required
                          value={newChUrl}
                          onChange={(e) => setNewChUrl(e.target.value)}
                          placeholder="https://.../stream.m3u8"
                          className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-neutral-300 mb-1">
                          Channel #
                        </label>
                        <input
                          type="number"
                          value={newChNumber}
                          onChange={(e) => setNewChNumber(parseInt(e.target.value, 10))}
                          className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddChannel(false)}
                        className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
                      >
                        Add Channel
                      </button>
                    </div>
                  </form>
                )}

                {/* Custom Channels List */}
                {customChannels.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block mb-2">
                      Custom Injected Channels ({customChannels.length})
                    </span>
                    <div className="space-y-1.5">
                      {customChannels.map((ch) => (
                        <div
                          key={ch.id}
                          className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-neutral-400 font-bold">
                              CH {ch.channelNumber}
                            </span>
                            <span className="font-semibold text-white truncate">{ch.name}</span>
                            <span className="text-neutral-500">({ch.group})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomChannel(ch.id)}
                            className="p-1 text-neutral-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Channel List Table with Visibility Toggles */}
                <div className="border border-neutral-800 rounded-xl overflow-hidden">
                  <div className="max-h-72 overflow-y-auto divide-y divide-neutral-800/60">
                    {channels.map((ch) => {
                      const isHidden = disabledChannelIds.includes(ch.id);
                      return (
                        <div
                          key={ch.id}
                          className={`p-2.5 flex items-center justify-between gap-3 text-xs ${
                            isHidden ? 'opacity-40 bg-neutral-950/40' : 'hover:bg-neutral-800/30'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-neutral-400 font-bold w-7 text-right">
                              {ch.channelNumber}
                            </span>
                            <div className="w-6 h-6 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
                              {ch.logo ? (
                                <img loading="lazy" decoding="async"
                                  src={ch.logo}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                  }}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <Tv className="w-3.5 h-3.5 text-neutral-500" />
                              )}
                            </div>
                            <span className="font-semibold text-neutral-200 truncate">
                              {ch.name}
                            </span>
                            <span className="text-[10px] text-neutral-500 shrink-0">
                              {ch.group}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleChannelVisibility(ch.id)}
                            title={isHidden ? 'Click to show channel' : 'Click to hide channel'}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isHidden
                                ? 'bg-neutral-800 text-neutral-400 border-neutral-700'
                                : 'bg-rose-950/40 text-rose-400 border-rose-800/40 hover:bg-rose-900/40'
                            }`}
                          >
                            {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Security & System Settings */}
            {activeTab === 'settings' && (
              <div className="p-5 flex-1 overflow-y-auto space-y-5">
                {/* Admin PIN change */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-rose-500" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Change Admin PIN Passcode
                    </h4>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Set a new 4 to 8 digit code for accessing this Admin Panel.
                  </p>
                  <div className="max-w-xs">
                    <input
                      type="password"
                      value={newAdminPin}
                      onChange={(e) => setNewAdminPin(e.target.value)}
                      placeholder="Enter new PIN..."
                      maxLength={8}
                      className="w-full px-3.5 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>

                {/* Backup & Export */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Export Configuration Backup</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Save current playlist URL, custom channels, and settings as JSON.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON</span>
                  </button>
                </div>

                {/* Force sync */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Force Remote Server Sync</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Invalidate cache and fetch fresh M3U stream links from remote host.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={handleForceSync}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    {isSyncing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Sync Now</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'branding' && (
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">App Name</h4>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="OmniStream TV"
                    className="w-full px-3.5 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white"
                  />
                </div>
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">App Tagline</h4>
                  <input
                    type="text"
                    value={appTagline}
                    onChange={(e) => setAppTagline(e.target.value)}
                    placeholder="Live TV"
                    className="w-full px-3.5 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white"
                  />
                </div>
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">App Logo URL</h4>
                  <input
                    type="url"
                    value={appLogo}
                    onChange={(e) => setAppLogo(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3.5 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white font-mono"
                  />
                  {appLogo && (
                    <img loading="lazy" decoding="async" src={appLogo} alt="logo preview" className="w-12 h-12 object-contain bg-neutral-900 rounded-lg p-1" />
                  )}
                </div>
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Primary Color</h4>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor || '#e11d48'}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#e11d48"
                      className="flex-1 px-3.5 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Accent Color</h4>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accentColor || '#f43f5e'}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      placeholder="#f43f5e (optional)"
                      className="flex-1 px-3.5 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer with Actions */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-950/70 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAuthenticated(false);
                    sessionStorage.removeItem('omnistream_admin_auth');
                    sessionStorage.removeItem('omnistream_admin_token');
                  }}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  Lock Panel
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveConfig}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded-xl transition-colors shadow-sm shadow-rose-900/40"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving & Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save & Publish to Website</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
