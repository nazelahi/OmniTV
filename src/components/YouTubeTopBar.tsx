import React from 'react';
import {
  Menu,
  Search,
  X,
  UploadCloud,
  Shield,
  HelpCircle,
  Tv,
  Radio,
} from 'lucide-react';

interface YouTubeTopBarProps {
  onToggleSidebar: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  appName?: string;
  appLogo?: string;
  onOpenPlaylistModal: () => void;
  onOpenAdmin: () => void;
  onToggleRemote: () => void;
  isRemoteOpen: boolean;
  onOpenShortcuts: () => void;
  onGoHome: () => void;
}

const RemoteIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <circle cx="12" cy="14" r="2" />
    <line x1="12" y1="6" x2="12.01" y2="6" />
    <line x1="10" y1="10" x2="14" y2="10" />
    <line x1="10" y1="18" x2="14" y2="18" />
  </svg>
);

export const YouTubeTopBar: React.FC<YouTubeTopBarProps> = ({
  onToggleSidebar,
  searchQuery,
  onSearchChange,
  onOpenPlaylistModal,
  onOpenAdmin,
  onToggleRemote,
  isRemoteOpen,
  onOpenShortcuts,
  onGoHome,
  appName,
  appLogo,
}) => {
  return (
    <header className="h-14 px-4 bg-[#0a0204]/75 backdrop-blur-xl border-b border-rose-950/40 sticky top-0 z-30 flex items-center justify-between gap-4 select-none shadow-sm shadow-rose-950/30">
      {/* 1. Left Zone: Hamburger Toggle & YouTube-style Brand Lockup */}
      <div className="flex items-center gap-4 shrink-0">
        <button
          onClick={onToggleSidebar}
          title="Guide menu"
          className="hidden md:inline-flex p-2 rounded-full hover:bg-neutral-850 text-neutral-300 hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={onGoHome}
          className="flex items-center gap-1.5 group cursor-pointer focus:outline-none"
        >
          {/* App Logo or default play icon */}
          {appLogo ? (
            <img loading="lazy" decoding="async" src={appLogo} alt={appName || 'App'} className="w-8 h-6 object-contain" />
          ) : (
            <div className="w-8 h-6 bg-rose-600 rounded-lg flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-white ml-0.5" />
            </div>
          )}

          <div className="flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-black tracking-tighter text-white">
              {appName || 'OmniStream'}
            </span>
          </div>
        </button>
      </div>

      {/* 2. Center Zone: Authentic YouTube Pill Search Bar */}
      <div className="flex-1 max-w-xl hidden sm:flex items-center justify-center mx-4">
        <div className="flex items-center w-full max-w-lg">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search live channels, sports, news, cinema..."
              className="w-full bg-neutral-900 border border-neutral-750 focus:border-rose-500 rounded-l-full py-2 pl-4 pr-9 text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => {}}
            title="Search"
            className="px-5 py-2 bg-neutral-800 hover:bg-neutral-750 border border-l-0 border-neutral-750 rounded-r-full text-neutral-300 hover:text-white transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Right Zone: Action Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <button
          onClick={onToggleRemote}
          title="Virtual TV Remote"
          className={`p-2 rounded-full border transition-colors ${
            isRemoteOpen
              ? 'bg-rose-950/60 text-rose-400 border-rose-600/50'
              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800 hover:text-white'
          }`}
        >
          <RemoteIcon className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenPlaylistModal}
          title="Load Playlist URL or File"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-800 rounded-full transition-colors"
        >
          <UploadCloud className="w-3.5 h-3.5 text-rose-500" />
          <span className="hidden md:inline">Playlist</span>
        </button>

        <button
          onClick={onOpenAdmin}
          title="Admin Panel"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-800 rounded-full transition-colors"
        >
          <Shield className="w-3.5 h-3.5 text-rose-500" />
          <span className="hidden md:inline">Admin</span>
        </button>

        <button
          onClick={onOpenShortcuts}
          title="Keyboard Shortcuts"
          className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
