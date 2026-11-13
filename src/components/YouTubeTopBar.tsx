import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Menu,
  Search,
  X,
  HelpCircle,
  Clock,
  Play,
  ArrowRight,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Channel, EPGProgram } from '../types/playlist';
import { getCurrentAndNextProgram } from '../utils/epgGenerator';
import { searchChannels, ProgramPair } from '../utils/channelSearch';
import { HighlightText } from './HighlightText';

const RECENT_SEARCHES_KEY = 'omnistream_recent_searches';
const MAX_RECENT_SEARCHES = 6;

interface YouTubeTopBarProps {
  onToggleSidebar: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  appName?: string;
  appLogo?: string;
  onToggleRemote: () => void;
  isRemoteOpen: boolean;
  onOpenShortcuts: () => void;
  onGoHome: () => void;
  isSidebarOpen?: boolean;
  channels?: Channel[];
  groups?: string[];
  epgData?: Map<string, EPGProgram[]> | null;
  onSelectChannel?: (channel: Channel) => void;
  onSelectCategory?: (category: string) => void;
  onSubmitSearch?: () => void;
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
  onToggleRemote,
  isRemoteOpen,
  onOpenShortcuts,
  onGoHome,
  appName,
  appLogo,
  isSidebarOpen = false,
  channels = [],
  groups = [],
  epgData,
  onSelectChannel,
  onSelectCategory,
  onSubmitSearch,
}) => {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === 'string').slice(0, MAX_RECENT_SEARCHES);
      }
    } catch {}
    return [];
  });

  const desktopWrapperRef = useRef<HTMLDivElement>(null);
  const mobileWrapperRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const persistRecentSearch = (term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(
        0,
        MAX_RECENT_SEARCHES
      );
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const removeRecentSearch = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const next = prev.filter((item) => item !== term);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
  };

  // Global keyboard shortcut: '/' or Ctrl+K / Cmd+K opens/focuses search
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.innerWidth < 640) {
          setIsMobileSearchOpen(true);
          setIsDropdownOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 20);
        } else {
          desktopInputRef.current?.focus();
          desktopInputRef.current?.select();
          setIsDropdownOpen(true);
        }
        return;
      }

      if (!isTyping && e.key === '/') {
        e.preventDefault();
        if (window.innerWidth < 640) {
          setIsMobileSearchOpen(true);
          setIsDropdownOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 20);
        } else {
          desktopInputRef.current?.focus();
          setIsDropdownOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inDesktop = desktopWrapperRef.current?.contains(target);
      const inMobile = mobileWrapperRef.current?.contains(target);
      if (!inDesktop && !inMobile) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isDropdownOpen]);

  // Reset highlighted index when query changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

  // Build EPG program lookup only when dropdown is open and user is searching
  const programsByChannel = useMemo(() => {
    if (!isDropdownOpen || !searchQuery.trim() || channels.length === 0) return undefined;
    const map = new Map<string, ProgramPair>();
    channels.forEach((ch) => {
      const prog = getCurrentAndNextProgram(ch, epgData);
      map.set(ch.id, { current: prog.current, next: prog.next });
    });
    return map;
  }, [isDropdownOpen, searchQuery, channels, epgData]);

  const allMatches = useMemo(() => {
    if (!searchQuery.trim() || channels.length === 0) return [];
    return searchChannels(channels, searchQuery, { programsByChannel });
  }, [channels, searchQuery, programsByChannel]);

  const topResults = useMemo(() => allMatches.slice(0, 8), [allMatches]);

  const quickCategories = useMemo(
    () => groups.filter((g) => g && g !== 'All' && g !== 'Favorites').slice(0, 8),
    [groups]
  );

  const handleChooseChannel = (channel: Channel) => {
    if (searchQuery.trim()) {
      persistRecentSearch(searchQuery);
    }
    setIsDropdownOpen(false);
    setIsMobileSearchOpen(false);
    setHighlightedIndex(-1);
    onSelectChannel?.(channel);
  };

  const handleTriggerFullSearch = () => {
    if (searchQuery.trim()) {
      persistRecentSearch(searchQuery);
    }
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    onSubmitSearch?.();
    desktopInputRef.current?.blur();
    mobileInputRef.current?.blur();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (isDropdownOpen) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      } else if (searchQuery) {
        onSearchChange('');
      } else {
        setIsMobileSearchOpen(false);
        (e.target as HTMLInputElement).blur();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      if (topResults.length > 0) {
        e.preventDefault();
        setIsDropdownOpen(true);
        setHighlightedIndex((prev) => (prev + 1) % topResults.length);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      if (topResults.length > 0) {
        e.preventDefault();
        setIsDropdownOpen(true);
        setHighlightedIndex((prev) => (prev <= 0 ? topResults.length - 1 : prev - 1));
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && topResults[highlightedIndex]) {
        handleChooseChannel(topResults[highlightedIndex].channel);
      } else {
        handleTriggerFullSearch();
      }
    }
  };

  const renderSearchPopover = () => {
    if (!isDropdownOpen) return null;
    const hasQuery = searchQuery.trim().length > 0;

    return (
      <div
        role="listbox"
        aria-label="Search suggestions"
        className="absolute left-0 right-0 top-full mt-2 bg-[#0d0305]/98 backdrop-blur-2xl border border-rose-900/60 rounded-2xl shadow-2xl shadow-black/90 overflow-hidden z-50 max-h-[70vh] flex flex-col"
      >
        {!hasQuery ? (
          <div className="p-3 space-y-3 overflow-y-auto">
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-1 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-rose-500" />
                    Recent Searches
                  </span>
                  <button
                    type="button"
                    onClick={clearRecentSearches}
                    className="text-[10px] text-neutral-500 hover:text-rose-400 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                    Clear
                  </button>
                </div>
                <div className="space-y-0.5">
                  {recentSearches.map((term) => (
                    <div
                      key={term}
                      onClick={() => {
                        onSearchChange(term);
                        onSubmitSearch?.();
                        setIsDropdownOpen(false);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-rose-950/40 text-xs text-neutral-200 cursor-pointer group transition-colors"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Search className="w-3.5 h-3.5 text-neutral-500 group-hover:text-rose-400 shrink-0" />
                        <span className="truncate">{term}</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => removeRecentSearch(term, e)}
                        aria-label={`Remove ${term}`}
                        className="p-1 text-neutral-500 hover:text-white rounded opacity-70 group-hover:opacity-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {quickCategories.length > 0 && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-1 mb-2 block">
                  Quick Browse Categories
                </span>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {quickCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        onSelectCategory?.(cat);
                        onGoHome();
                        setIsDropdownOpen(false);
                        setIsMobileSearchOpen(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-neutral-900/90 hover:bg-rose-600/20 border border-neutral-800 hover:border-rose-600/50 text-[11px] font-medium text-neutral-300 hover:text-white transition-colors"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="px-2 pt-1.5 border-t border-neutral-800/80 text-[10px] text-neutral-500 flex items-center justify-between">
              <span>Tip: Search by name, #number (e.g. #12), country, or live show</span>
              <span className="hidden sm:inline font-mono text-neutral-400">↑↓ navigate · Enter</span>
            </div>
          </div>
        ) : topResults.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <p className="text-xs font-semibold text-neutral-200">
              No channels or shows matched &ldquo;{searchQuery.trim()}&rdquo;
            </p>
            <p className="text-[11px] text-neutral-400">
              Try a channel number (like #5), category (News, Sports), or shorter keyword.
            </p>
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="mt-1 px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-white font-medium transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <>
            <div className="px-3 py-1.5 bg-neutral-950/80 border-b border-rose-950/40 flex items-center justify-between text-[10px] text-neutral-400">
              <span>
                Top matches ({allMatches.length} total)
              </span>
              <span className="hidden sm:inline font-mono">Click or press Enter to tune</span>
            </div>
            <div className="overflow-y-auto divide-y divide-neutral-900/80">
              {topResults.map((res, idx) => {
                const { channel, matchReason, matchedProgramTitle } = res;
                const isSelected = idx === highlightedIndex;
                const liveTitle = matchedProgramTitle || programsByChannel?.get(channel.id)?.current?.title;

                return (
                  <button
                    key={channel.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleChooseChannel(channel)}
                    className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                      isSelected ? 'bg-rose-950/50' : 'hover:bg-neutral-900/80'
                    }`}
                  >
                    <div className="w-10 h-7 rounded-md bg-neutral-950 border border-neutral-800 flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                      {channel.logo ? (
                        <img
                          src={channel.logo}
                          alt={channel.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-neutral-400 font-mono">
                          {channel.name.slice(0, 3).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-bold text-rose-400 shrink-0">
                          CH {channel.channelNumber.toString().padStart(2, '0')}
                        </span>
                        <HighlightText
                          text={channel.name}
                          query={searchQuery}
                          className="text-xs font-bold text-white truncate"
                        />
                        {channel.isFavorite && (
                          <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 truncate">
                        {liveTitle ? (
                          <HighlightText
                            text={liveTitle}
                            query={searchQuery}
                            className="truncate text-neutral-300"
                          />
                        ) : (
                          <span className="truncate">{channel.group}</span>
                        )}
                        <span className="text-neutral-600">·</span>
                        <span className="text-neutral-500 truncate">{channel.group}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[9px] font-mono text-neutral-400">
                        {matchReason}
                      </span>
                      <span className="w-6 h-6 rounded-full bg-rose-600/20 text-rose-400 flex items-center justify-center">
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleTriggerFullSearch}
              className="px-3 py-2 bg-neutral-950/90 hover:bg-rose-950/40 border-t border-rose-950/50 text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1.5 transition-colors shrink-0"
            >
              <span>
                View all {allMatches.length} matching channel{allMatches.length === 1 ? '' : 's'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <header className="h-14 px-3 sm:px-4 bg-[#0a0204]/85 backdrop-blur-xl border-b border-rose-950/40 sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-4 select-none shadow-sm shadow-rose-950/30">
      {/* Mobile Search Overlay */}
      {isMobileSearchOpen ? (
        <div ref={mobileWrapperRef} className="relative flex sm:hidden items-center w-full gap-2 py-1">
          <div className="relative flex-1 flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3.5 text-neutral-400 pointer-events-none" />
            <input
              ref={mobileInputRef}
              type="text"
              autoFocus
              value={searchQuery}
              onFocus={() => setIsDropdownOpen(true)}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setIsDropdownOpen(true);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Search name, #number, genre, show..."
              className="w-full bg-neutral-900 border border-neutral-700 focus:border-rose-500 rounded-full py-2 pl-9 pr-9 text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  mobileInputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setIsMobileSearchOpen(false);
              setIsDropdownOpen(false);
            }}
            className="px-3 py-2 text-xs font-semibold text-neutral-300 hover:text-white"
          >
            Cancel
          </button>

          {renderSearchPopover()}
        </div>
      ) : (
        <>
          {/* 1. Left Zone: Hamburger Toggle & Brand Lockup */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              onClick={onToggleSidebar}
              title="Toggle sidebar menu"
              aria-label="Toggle navigation menu"
              aria-expanded={isSidebarOpen}
              className={`inline-flex p-2 rounded-full transition-colors ${
                isSidebarOpen
                  ? 'bg-rose-950/60 text-white md:bg-transparent md:text-neutral-300 md:hover:bg-neutral-800'
                  : 'hover:bg-neutral-800 text-neutral-300 hover:text-white'
              }`}
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
                <span className="text-base sm:text-lg font-black tracking-tighter text-white truncate max-w-[130px] sm:max-w-none">
                  {appName || 'OmniStream'}
                </span>
              </div>
            </button>
          </div>

          {/* 2. Center Zone: Desktop & Tablet Pill Search Bar */}
          <div ref={desktopWrapperRef} className="relative flex-1 max-w-xl hidden sm:flex items-center justify-center mx-2 sm:mx-4">
            <div className="flex items-center w-full max-w-lg">
              <div className="relative flex-1">
                <input
                  ref={desktopInputRef}
                  type="text"
                  value={searchQuery}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    onSearchChange(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Search channels, #number, live shows, sports..."
                  aria-label="Search live channels and programs"
                  className="w-full bg-neutral-900 border border-neutral-750 focus:border-rose-500 rounded-l-full py-2 pl-4 pr-12 text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      onSearchChange('');
                      desktopInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-neutral-500 bg-neutral-950 border border-neutral-800 rounded absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    /
                  </kbd>
                )}
              </div>
              <button
                type="button"
                onClick={handleTriggerFullSearch}
                title="Search channels (Enter)"
                aria-label="Submit search"
                className="px-5 py-2 bg-neutral-800 hover:bg-neutral-750 border border-l-0 border-neutral-750 rounded-r-full text-neutral-300 hover:text-white transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            {renderSearchPopover()}
          </div>

          {/* 3. Right Zone: Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Mobile Search Button */}
            <button
              onClick={() => {
                setIsMobileSearchOpen(true);
                setIsDropdownOpen(true);
              }}
              title="Search"
              aria-label="Search channels"
              className={`sm:hidden p-2 rounded-full border transition-colors ${
                searchQuery
                  ? 'bg-rose-950/70 text-rose-400 border-rose-600/60'
                  : 'bg-neutral-900 text-neutral-300 hover:text-white border-neutral-800'
              }`}
            >
              <Search className="w-4 h-4" />
            </button>

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
              onClick={onOpenShortcuts}
              title="Keyboard Shortcuts"
              className="hidden sm:inline-flex p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </header>
  );
};
