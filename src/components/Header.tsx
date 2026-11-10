import React from 'react';
import { Tv, Radio, UploadCloud, HelpCircle, Layers, Shield, Home } from 'lucide-react';

const RemoteIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <circle cx="12" cy="14" r="2" />
    <line x1="12" y1="6" x2="12.01" y2="6" />
    <line x1="10" y1="10" x2="14" y2="10" />
    <line x1="10" y1="18" x2="14" y2="18" />
  </svg>
);

interface HeaderProps {
  currentView: 'home' | 'player' | 'epg';
  onViewChange: (view: 'home' | 'player' | 'epg') => void;
  onOpenPlaylistModal: () => void;
  onOpenAdmin: () => void;
  onToggleRemote: () => void;
  isRemoteOpen: boolean;
  onOpenShortcuts: () => void;
  activePlaylistName: string;
  totalChannels: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  onOpenPlaylistModal,
  onOpenAdmin,
  onToggleRemote,
  isRemoteOpen,
  onOpenShortcuts,
  activePlaylistName,
  totalChannels,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800/80 sticky top-0 z-30 select-none">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-sm">
          <Tv className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onViewChange('home');
            }}
            className="text-base sm:text-lg font-bold tracking-tight text-white hover:text-neutral-200 transition-colors whitespace-nowrap"
          >
            OmniStream TV
          </a>
          <span className="text-[11px] text-neutral-400 hidden sm:inline whitespace-nowrap">
            {activePlaylistName} · {totalChannels} Channels
          </span>
        </div>
      </div>

      {/* Zone 2: 4-5 clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-300">
        <button
          onClick={() => onViewChange('home')}
          className={`flex items-center gap-2 hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            currentView === 'home' ? 'text-white border-b-2 border-rose-500 font-semibold' : 'text-neutral-400'
          }`}
        >
          <Home className="w-4 h-4 text-rose-500" />
          <span>Home</span>
        </button>

        <button
          onClick={() => onViewChange('player')}
          className={`flex items-center gap-2 hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            currentView === 'player' ? 'text-white border-b-2 border-rose-500 font-semibold' : 'text-neutral-400'
          }`}
        >
          <Radio className="w-4 h-4 text-neutral-400" />
          <span>Cinema Player</span>
        </button>

        <button
          onClick={() => onViewChange('epg')}
          className={`flex items-center gap-2 hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            currentView === 'epg' ? 'text-white border-b-2 border-rose-500 font-semibold' : 'text-neutral-400'
          }`}
        >
          <Layers className="w-4 h-4 text-neutral-400" />
          <span>TV Schedule Guide</span>
        </button>

        <button
          onClick={onToggleRemote}
          className={`flex items-center gap-2 hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            isRemoteOpen ? 'text-rose-400 font-semibold' : 'text-neutral-400'
          }`}
        >
          <RemoteIcon className="w-4 h-4" />
          <span>Virtual Remote</span>
        </button>

        <button
          onClick={onOpenShortcuts}
          className="flex items-center gap-2 hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 text-neutral-400"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Shortcuts</span>
        </button>

        <button
          onClick={onOpenAdmin}
          className="flex items-center gap-2 hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 text-neutral-400 hover:text-rose-400"
        >
          <Shield className="w-4 h-4 text-rose-500" />
          <span>Admin Panel</span>
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onOpenAdmin}
          title="Open Admin Panel"
          className="p-2 rounded-lg border bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700 hover:text-rose-400 transition-colors md:hidden"
        >
          <Shield className="w-4 h-4 text-rose-500" />
        </button>

        <button
          onClick={onToggleRemote}
          title="Toggle Virtual TV Remote"
          className={`md:hidden p-2 rounded-lg border transition-colors ${
            isRemoteOpen
              ? 'bg-rose-600/20 text-rose-400 border-rose-500/40'
              : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
          }`}
        >
          <RemoteIcon className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenPlaylistModal}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded-lg transition-colors whitespace-nowrap shadow-sm shadow-rose-900/30"
        >
          <UploadCloud className="w-4 h-4 shrink-0" />
          <span>Load Playlist</span>
        </button>
      </div>
    </header>
  );
};
