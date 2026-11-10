import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  Link as LinkIcon,
  FileText,
  Bookmark,
  Download,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  Tv,
} from 'lucide-react';
import { Playlist } from '../types/playlist';
import { parseM3U, generateM3U } from '../utils/m3uParser';
import { SAMPLE_PLAYLIST_PRESETS } from '../utils/defaultChannels';

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPlaylist: (playlist: Playlist) => void;
  savedPlaylists: Playlist[];
  activePlaylistId: string;
  onDeletePlaylist: (id: string) => void;
  currentPlaylist: Playlist;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  isOpen,
  onClose,
  onLoadPlaylist,
  savedPlaylists,
  activePlaylistId,
  onDeletePlaylist,
  currentPlaylist,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'file' | 'paste' | 'library'>('url');
  const [urlInput, setUrlInput] = useState<string>('');
  const [playlistNameInput, setPlaylistNameInput] = useState<string>('');
  const [pasteInput, setPasteInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle URL Load
  const handleLoadUrl = async (urlToFetch?: string, customName?: string) => {
    const targetUrl = (urlToFetch || urlInput).trim();
    if (!targetUrl) {
      setErrorMsg('Please enter a valid M3U or M3U8 URL.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // First attempt direct fetch
      let response: Response;
      try {
        response = await fetch(targetUrl);
        if (!response.ok) throw new Error('direct fetch failed');
      } catch (networkErr) {
        // If direct fetch is blocked by CORS, fall back to our own backend proxy
        // (avoids relying on a third-party CORS proxy service)
        response = await fetch(`/api/fetch-playlist?url=${encodeURIComponent(targetUrl)}`);
      }

      if (!response.ok) {
        throw new Error(`Failed to download playlist (HTTP ${response.status})`);
      }

      const content = await response.text();
      if (!content || (!content.includes('#EXTM3U') && !content.includes('http'))) {
        throw new Error('Downloaded file does not appear to be a valid M3U playlist format.');
      }

      const name = customName || playlistNameInput.trim() || targetUrl.split('/').pop()?.replace('.m3u', '').replace('.m3u8', '') || 'Web Playlist';
      const parsed = parseM3U(content, name, targetUrl);

      if (parsed.channels.length === 0) {
        throw new Error('No valid stream channels could be extracted from this playlist.');
      }

      onLoadPlaylist(parsed);
      setSuccessMsg(`Successfully loaded ${parsed.channels.length} channels!`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch playlist. Ensure URL is accessible and allows CORS.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) throw new Error('File content was empty');

        const name = playlistNameInput.trim() || file.name.replace(/\.[^/.]+$/, '');
        const parsed = parseM3U(content, name);

        if (parsed.channels.length === 0) {
          throw new Error('No channels found in this M3U file.');
        }

        onLoadPlaylist(parsed);
        setSuccessMsg(`Imported ${parsed.channels.length} channels from ${file.name}!`);
        setTimeout(() => {
          onClose();
        }, 1000);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to read M3U file.');
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg('Error reading file from disk.');
      setIsLoading(false);
    };

    reader.readAsText(file);
  };

  // Handle Raw Text Paste
  const handlePasteLoad = () => {
    if (!pasteInput.trim()) {
      setErrorMsg('Please paste your M3U playlist text content.');
      return;
    }

    try {
      const name = playlistNameInput.trim() || 'Pasted Playlist';
      const parsed = parseM3U(pasteInput, name);

      if (parsed.channels.length === 0) {
        throw new Error('No valid channel stream lines found in pasted text.');
      }

      onLoadPlaylist(parsed);
      setSuccessMsg(`Loaded ${parsed.channels.length} channels!`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse playlist.');
    }
  };

  // Export M3U file
  const handleExportM3U = () => {
    const m3uContent = generateM3U(currentPlaylist);
    const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPlaylist.name.toLowerCase().replace(/\s+/g, '_')}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Load Live TV Playlist</h3>
              <p className="text-xs text-neutral-400">
                Support for M3U and M3U8 playlists with auto-categorization.
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

        {/* Modal Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/50 px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('url')}
            className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'url'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Playlist URL</span>
          </button>

          <button
            onClick={() => setActiveTab('file')}
            className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'file'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>File Upload</span>
          </button>

          <button
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'paste'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Paste M3U</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'library'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved & Presets</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Notification Messages */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2.5">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: URL */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  M3U / M3U8 Playlist URL
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/playlist.m3u"
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Playlist Name (Optional)
                </label>
                <input
                  type="text"
                  value={playlistNameInput}
                  onChange={(e) => setPlaylistNameInput(e.target.value)}
                  placeholder="e.g. My Premium IPTV"
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                disabled={isLoading}
                onClick={() => handleLoadUrl()}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Fetching and parsing stream channels...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Load Playlist From URL</span>
                  </>
                )}
              </button>

              {/* Sample Quick Presets */}
              <div className="pt-2 border-t border-neutral-800">
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                  Sample Public Playlists (1-Click Load)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SAMPLE_PLAYLIST_PRESETS.slice(1).map((preset) => (
                    <button
                      key={preset.title}
                      onClick={() => {
                        setUrlInput(preset.url);
                        setPlaylistNameInput(preset.title);
                        handleLoadUrl(preset.url, preset.title);
                      }}
                      className="text-left p-2.5 rounded-lg bg-neutral-950/60 hover:bg-neutral-800 border border-neutral-800 text-xs transition-colors"
                    >
                      <p className="font-semibold text-white truncate">{preset.title}</p>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">{preset.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: File Upload */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".m3u,.m3u8,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-700 hover:border-rose-500 rounded-2xl p-8 text-center cursor-pointer bg-neutral-950/40 hover:bg-neutral-950/80 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 mx-auto mb-3">
                  <UploadCloud className="w-6 h-6 text-rose-500" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">
                  Click to browse or drop your .m3u / .m3u8 file
                </h4>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                  Supports standard IPTV formatting with EXTINF tags, channel logos, and group categories.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Playlist Label
                </label>
                <input
                  type="text"
                  value={playlistNameInput}
                  onChange={(e) => setPlaylistNameInput(e.target.value)}
                  placeholder="e.g. Local Channels M3U"
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          {/* TAB 3: Paste Text */}
          {activeTab === 'paste' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-neutral-300">
                Paste M3U content directly
              </label>
              <textarea
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                rows={8}
                placeholder={`#EXTM3U\n#EXTINF:-1 tvg-logo="https://..." group-title="News", Channel 1\nhttps://stream.example.com/live.m3u8`}
                className="w-full p-3 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-rose-500 font-mono"
              />

              <button
                onClick={handlePasteLoad}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Parse & Load Content
              </button>
            </div>
          )}

          {/* TAB 4: Saved & Presets */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-2">
                  Saved Playlists in Browser
                </span>

                <div className="space-y-2">
                  {savedPlaylists.map((pl) => {
                    const isActive = pl.id === activePlaylistId;
                    return (
                      <div
                        key={pl.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                          isActive
                            ? 'bg-rose-950/40 border-rose-500/60'
                            : 'bg-neutral-950/60 border-neutral-800'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white truncate">{pl.name}</span>
                            {isActive && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-600 text-white uppercase">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            {pl.channels.length} channels · {pl.groups.length} categories
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {!isActive && (
                            <button
                              onClick={() => {
                                onLoadPlaylist(pl);
                                onClose();
                              }}
                              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold"
                            >
                              Activate
                            </button>
                          )}
                          {pl.isCustom && (
                            <button
                              onClick={() => onDeletePlaylist(pl.id)}
                              title="Delete playlist"
                              className="p-1.5 text-neutral-500 hover:text-rose-400 rounded-lg hover:bg-neutral-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Export Active Playlist */}
              <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Export Active Playlist</p>
                  <p className="text-[11px] text-neutral-400">
                    Download {currentPlaylist.channels.length} channels as .m3u
                  </p>
                </div>
                <button
                  onClick={handleExportM3U}
                  className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .m3u</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
