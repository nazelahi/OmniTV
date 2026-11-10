import React from 'react';
import {
  Home,
  Radio,
  Layers,
  Sparkles,
  History,
  Shield,
  UploadCloud,
  Tv,
  Film,
  Flame,
  Globe,
  Compass,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { Channel } from '../types/playlist';

interface SidebarProps {
  isCollapsed: boolean;
  currentView: 'home' | 'player' | 'epg';
  onViewChange: (view: 'home' | 'player' | 'epg') => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  groups: string[];
  favoritesCount: number;
  onOpenPlaylistModal: () => void;
  onOpenAdmin: () => void;
  onToggleRemote: () => void;
  isRemoteOpen: boolean;
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

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  currentView,
  onViewChange,
  selectedCategory,
  onSelectCategory,
  groups,
  favoritesCount,
  onOpenPlaylistModal,
  onOpenAdmin,
  onToggleRemote,
  isRemoteOpen,
}) => {
  // Collapsed Mini Rail (like YouTube mini sidebar)
  if (isCollapsed) {
    return (
      <aside className="w-18 bg-[#0a0204]/70 backdrop-blur-xl border-r border-rose-950/40 shrink-0 hidden md:flex flex-col items-center py-3 space-y-4 select-none z-20">
        <button
          onClick={() => onViewChange('home')}
          title="Home"
          className={`flex flex-col items-center justify-center w-14 py-2.5 rounded-xl transition-colors ${
            currentView === 'home'
              ? 'bg-neutral-800/80 text-rose-500 font-semibold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Home className="w-5 h-5 mb-1" />
          <span className="text-[10px] tracking-tight">Home</span>
        </button>

        <button
          onClick={() => onViewChange('player')}
          title="Live Cinema"
          className={`flex flex-col items-center justify-center w-14 py-2.5 rounded-xl transition-colors ${
            currentView === 'player'
              ? 'bg-neutral-800/80 text-rose-500 font-semibold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Radio className="w-5 h-5 mb-1" />
          <span className="text-[10px] tracking-tight">Live TV</span>
        </button>

        <button
          onClick={() => onViewChange('epg')}
          title="TV Schedule Guide"
          className={`flex flex-col items-center justify-center w-14 py-2.5 rounded-xl transition-colors ${
            currentView === 'epg'
              ? 'bg-neutral-800/80 text-rose-500 font-semibold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Layers className="w-5 h-5 mb-1" />
          <span className="text-[10px] tracking-tight">Schedule</span>
        </button>

        <button
          onClick={() => {
            onViewChange('home');
            onSelectCategory('Favorites');
          }}
          title="Favorites"
          className={`flex flex-col items-center justify-center w-14 py-2.5 rounded-xl transition-colors ${
            selectedCategory === 'Favorites'
              ? 'bg-neutral-800/80 text-amber-400 font-semibold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Sparkles className="w-5 h-5 mb-1" />
          <span className="text-[10px] tracking-tight">Saved</span>
        </button>

        <div className="w-8 h-[1px] bg-neutral-800 my-1" />

        <button
          onClick={onToggleRemote}
          title="Virtual TV Remote"
          className={`flex flex-col items-center justify-center w-14 py-2.5 rounded-xl transition-colors ${
            isRemoteOpen
              ? 'bg-rose-950/60 text-rose-400'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <RemoteIcon className="w-5 h-5 mb-1" />
          <span className="text-[10px] tracking-tight">Remote</span>
        </button>

        <button
          onClick={onOpenAdmin}
          title="Admin Panel"
          className="flex flex-col items-center justify-center w-14 py-2.5 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-neutral-900 transition-colors"
        >
          <Shield className="w-5 h-5 mb-1" />
          <span className="text-[10px] tracking-tight">Admin</span>
        </button>
      </aside>
    );
  }

  // Expanded Full YouTube Sidebar
  return (
    <aside className="w-60 bg-[#0a0204]/70 backdrop-blur-xl border-r border-rose-950/40 shrink-0 hidden md:flex flex-col py-3 px-3 overflow-y-auto select-none z-20 space-y-4">
      {/* 1. Main Navigation Block */}
      <div className="space-y-1">
        <button
          onClick={() => onViewChange('home')}
          className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            currentView === 'home'
              ? 'bg-neutral-800 text-white font-semibold'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Home className={`w-5 h-5 ${currentView === 'home' ? 'text-rose-500' : 'text-neutral-400'}`} />
          <span>Home</span>
        </button>

        <button
          onClick={() => onViewChange('player')}
          className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            currentView === 'player'
              ? 'bg-neutral-800 text-white font-semibold'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Radio className={`w-5 h-5 ${currentView === 'player' ? 'text-rose-500' : 'text-neutral-400'}`} />
          <span>Watch Live TV</span>
        </button>

        <button
          onClick={() => onViewChange('epg')}
          className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            currentView === 'epg'
              ? 'bg-neutral-800 text-white font-semibold'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Layers className={`w-5 h-5 ${currentView === 'epg' ? 'text-rose-500' : 'text-neutral-400'}`} />
          <span>TV Schedule Guide</span>
        </button>

        <button
          onClick={() => {
            onViewChange('home');
            onSelectCategory('Favorites');
          }}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            selectedCategory === 'Favorites'
              ? 'bg-neutral-800 text-white font-semibold'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <div className="flex items-center gap-4">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>Favorites</span>
          </div>
          {favoritesCount > 0 && (
            <span className="font-mono text-xs text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded-full">
              {favoritesCount}
            </span>
          )}
        </button>
      </div>

      <div className="h-[1px] bg-neutral-800/80 mx-1" />

      {/* 2. Explore Live Categories (YouTube Explore Channels) */}
      <div>
        <div className="px-3 py-1 flex items-center justify-between text-xs font-bold text-neutral-400 uppercase tracking-wider">
          <span>Categories</span>
        </div>
        <div className="mt-1 space-y-0.5">
          <button
            onClick={() => {
              onViewChange('home');
              onSelectCategory('All');
            }}
            className={`w-full flex items-center gap-4 px-3 py-2 rounded-xl text-sm transition-colors ${
              selectedCategory === 'All' && currentView === 'home'
                ? 'bg-neutral-850 text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Compass className="w-4 h-4 text-neutral-400" />
            <span>All Categories</span>
          </button>

          {groups.filter((g) => g !== 'Favorites').map((group) => {
            const isSelected = selectedCategory === group && currentView === 'home';
            return (
              <button
                key={group}
                onClick={() => {
                  onViewChange('home');
                  onSelectCategory(group);
                }}
                className={`w-full flex items-center gap-4 px-3 py-2 rounded-xl text-sm transition-colors ${
                  isSelected
                    ? 'bg-neutral-850 text-white font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Tv className="w-4 h-4 text-neutral-500" />
                <span className="truncate">{group}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[1px] bg-neutral-800/80 mx-1" />

      {/* 3. Controls & Tools Block */}
      <div className="space-y-1">
        <div className="px-3 py-1 text-xs font-bold text-neutral-400 uppercase tracking-wider">
          <span>Tools & Controls</span>
        </div>

        <button
          onClick={onToggleRemote}
          className={`w-full flex items-center gap-4 px-3 py-2 rounded-xl text-sm transition-colors ${
            isRemoteOpen
              ? 'bg-rose-950/40 text-rose-400 font-semibold'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <RemoteIcon className="w-4 h-4" />
          <span>Virtual TV Remote</span>
        </button>

        <button
          onClick={onOpenPlaylistModal}
          className="w-full flex items-center gap-4 px-3 py-2 rounded-xl text-sm text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors"
        >
          <UploadCloud className="w-4 h-4 text-neutral-400" />
          <span>Load Playlist</span>
        </button>

        <button
          onClick={onOpenAdmin}
          className="w-full flex items-center gap-4 px-3 py-2 rounded-xl text-sm text-neutral-300 hover:text-rose-400 hover:bg-neutral-900 transition-colors"
        >
          <Shield className="w-4 h-4 text-rose-500" />
          <span>Admin Panel</span>
        </button>
      </div>

      <div className="pt-4 px-3 text-[11px] text-neutral-600 leading-normal">
        <p>OmniStream TV v2.0</p>
        <p className="mt-1">Continuous Live HLS Broadcast</p>
      </div>
    </aside>
  );
};
