import React from 'react';
import {
  Home,
  Radio,
  Layers,
  Sparkles,
  History,
  Tv,
  Film,
  Flame,
  Globe,
  Compass,
  ChevronRight,
  X,
} from 'lucide-react';
import { Channel } from '../types/playlist';

interface SidebarProps {
  isCollapsed: boolean;
  isMobile?: boolean;
  currentView: 'home' | 'player' | 'epg';
  onViewChange: (view: 'home' | 'player' | 'epg') => void;
  onClose?: () => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  groups: string[];
  favoritesCount: number;
  onToggleRemote: () => void;
  isRemoteOpen: boolean;
  appName?: string;
  appLogo?: string;
  appTagline?: string;
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
  isMobile: isMobileProp,
  currentView,
  onViewChange,
  selectedCategory,
  onSelectCategory,
  groups,
  favoritesCount,
  onToggleRemote,
  isRemoteOpen,
  onClose,
  appName,
  appLogo,
  appTagline,
}) => {
  const [detectedMobile, setDetectedMobile] = React.useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  React.useEffect(() => {
    if (isMobileProp !== undefined || typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = () => setDetectedMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [isMobileProp]);

  const isMobile = isMobileProp ?? detectedMobile;

  const handleViewChange = (view: 'home' | 'player' | 'epg') => {
    onViewChange(view);
    if (isMobile) {
      onClose?.();
    }
  };

  const handleMobileAction = (action: () => void) => {
    action();
    if (isMobile) {
      onClose?.();
    }
  };

  // Collapsed Mini Rail (desktop only)
  if (isCollapsed && !isMobile) {
    return (
      <aside className="w-18 bg-[#0a0204]/70 backdrop-blur-xl border-r border-rose-950/40 shrink-0 hidden md:flex flex-col items-center py-3 space-y-4 select-none z-20">
        <button
          onClick={() => handleViewChange('home')}
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
          onClick={() => handleViewChange('player')}
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
          onClick={() => handleViewChange('epg')}
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
            handleViewChange('home');
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
      </aside>
    );
  }

  // Expanded Full YouTube Sidebar
  return (
    <>
      {/* Mobile backdrop */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        aria-hidden={isMobile && isCollapsed}
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-20 w-64 md:w-60 bg-[#0a0204]/98 md:bg-[#0a0204]/70 backdrop-blur-xl border-r border-rose-950/40 shrink-0 flex flex-col py-3 px-3 overflow-y-auto select-none space-y-4 transform transition-transform duration-200 md:transform-none ${
          isCollapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0'
        }`}
      >
        {/* Mobile Drawer Header */}
        <div className="flex items-center justify-between pb-2 border-b border-rose-950/40 md:hidden">
          <div className="flex items-center gap-2 px-1 min-w-0">
            {appLogo ? (
              <img src={appLogo} alt={appName || 'App'} className="w-7 h-5 object-contain shrink-0" />
            ) : (
              <div className="w-7 h-5 bg-rose-600 rounded-md flex items-center justify-center shadow-sm shrink-0">
                <div className="w-0 h-0 border-y-[4px] border-y-transparent border-l-[7px] border-l-white ml-0.5" />
              </div>
            )}
            <span className="text-sm font-black tracking-tight text-white truncate">{appName || 'OmniStream TV'}</span>
          </div>
          <button
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors shrink-0"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      {/* 1. Main Navigation Block */}
      <div className="space-y-1">
        <button
          onClick={() => handleViewChange('home')}
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
          onClick={() => handleViewChange('player')}
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
          onClick={() => handleViewChange('epg')}
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
            handleViewChange('home');
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
              handleViewChange('home');
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
                  handleViewChange('home');
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
          onClick={() => handleMobileAction(onToggleRemote)}
          className={`w-full flex items-center gap-4 px-3 py-2 rounded-xl text-sm transition-colors ${
            isRemoteOpen
              ? 'bg-rose-950/40 text-rose-400 font-semibold'
              : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <RemoteIcon className="w-4 h-4" />
          <span>Virtual TV Remote</span>
        </button>
      </div>

      <div className="pt-4 px-3 text-[11px] text-neutral-600 leading-normal">
        <p className="truncate">{appName || 'OmniStream TV'}</p>
        <p className="mt-1 truncate">{appTagline || 'Live TV Broadcast'}</p>
      </div>
    </aside>
    </>
  );
};
