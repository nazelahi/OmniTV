import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Sparkles,
  LayoutGrid,
  List as ListIcon,
  Play,
  Film,
  Radio,
  Tv,
} from 'lucide-react';
import { Channel, EPGProgram } from '../types/playlist';
import { getCurrentAndNextProgram } from '../utils/epgGenerator';

interface ChannelListProps {
  channels: Channel[];
  activeChannel: Channel;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
  groups: string[];
  epgData?: Map<string, EPGProgram[]> | null;
}

export const ChannelList: React.FC<ChannelListProps> = ({
  channels,
  activeChannel,
  onSelectChannel,
  onToggleFavorite,
  groups,
  epgData,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>(activeChannel?.group || 'All');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  // Show related channels (same group) when the active channel changes
  useEffect(() => {
    if (activeChannel?.group) {
      setSelectedGroup(activeChannel.group);
    }
  }, [activeChannel?.id]);

  // Auto-scroll active channel into view on mount or change
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeChannel.id]);

  const programsByChannel = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getCurrentAndNextProgram>>();
    channels.forEach((ch) => {
      map.set(ch.id, getCurrentAndNextProgram(ch, epgData));
    });
    return map;
  }, [channels, epgData]);

  // Filter channels
  const filteredChannels = useMemo(() => {
    return channels.filter((ch) => {
      // Group filter
      if (selectedGroup === 'Favorites') {
        if (!ch.isFavorite) return false;
      } else if (selectedGroup !== 'All') {
        if (ch.group.toLowerCase() !== selectedGroup.toLowerCase()) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = ch.name.toLowerCase().includes(q);
        const matchesGroup = ch.group.toLowerCase().includes(q);
        const matchesNumber = ch.channelNumber.toString() === q;
        const matchesCountry = ch.country?.toLowerCase().includes(q);
        const progTitle = programsByChannel.get(ch.id)?.current?.title?.toLowerCase() || '';
        const matchesProgram = progTitle.includes(q);
        return matchesName || matchesGroup || matchesNumber || matchesCountry || matchesProgram;
      }

      return true;
    });
  }, [channels, selectedGroup, searchQuery, programsByChannel]);

  const favoritesCount = useMemo(() => {
    return channels.filter((ch) => ch.isFavorite).length;
  }, [channels]);

  // Category tabs list
  const categoryTabs = useMemo(() => {
    const list = ['All'];
    if (favoritesCount > 0 || selectedGroup === 'Favorites') list.push('Favorites');
    groups.forEach((g) => {
      if (g !== 'Favorites' && !list.includes(g)) {
        list.push(g);
      }
    });
    return list;
  }, [groups, favoritesCount, selectedGroup]);

  return (
    <div className="flex flex-col h-full bg-[#0a0204]/75 backdrop-blur-xl rounded-xl border border-rose-950/50 overflow-hidden shadow-xl shadow-rose-950/20">
      {/* Top Search & Filter Bar */}
      <div className="p-3.5 border-b border-rose-950/40 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, #number, or genre..."
              className="w-full pl-9 pr-8 py-2 bg-black/60 border border-rose-950/50 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center p-0.5 bg-neutral-950/80 rounded-lg border border-neutral-800 shrink-0">
            <button
              onClick={() => setViewMode('list')}
              title="List View"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-neutral-800 text-white shadow-xs' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-neutral-800 text-white shadow-xs' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Categories / Filter Segmented Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categoryTabs.map((category) => {
            const isActive = selectedGroup === category;
            return (
              <button
                key={category}
                onClick={() => setSelectedGroup(category)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'bg-rose-600 text-white shadow-sm shadow-rose-900/30'
                    : 'bg-neutral-950/60 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800/80'
                }`}
              >
                {category === 'Favorites' ? (
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Favorites ({favoritesCount})</span>
                  </span>
                ) : (
                  category
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Header Info Banner */}
      <div className="px-4 py-2 bg-neutral-950/40 border-b border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400">
        <span>
          Showing {filteredChannels.length} of {channels.length} channels
        </span>
        <span className="font-mono text-[11px] text-neutral-500">
          CH {activeChannel.channelNumber.toString().padStart(2, '0')} ACTIVE
        </span>
      </div>

      {/* Channel Items Scroll Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-6 text-neutral-400">
            <Tv className="w-10 h-10 text-neutral-600 mb-2" />
            <p className="text-sm font-semibold text-neutral-300">No channels found</p>
            <p className="text-xs text-neutral-500 mt-1">
              Try adjusting your search query or switching category filters.
            </p>
          </div>
        ) : viewMode === 'list' ? (
          filteredChannels.map((ch) => {
            const isActive = ch.id === activeChannel.id;
            const nowProg = programsByChannel.get(ch.id)?.current ?? null;

            return (
              <button
                key={ch.id}
                ref={isActive ? activeItemRef : null}
                onClick={() => onSelectChannel(ch)}
                className={`w-full group text-left p-2.5 rounded-xl border transition-all flex items-center gap-3 relative ${
                  isActive
                    ? 'bg-rose-950/40 border-rose-500/60 text-white shadow-md'
                    : 'bg-neutral-950/30 hover:bg-neutral-800/60 border-neutral-800/70 text-neutral-300 hover:border-neutral-700'
                }`}
              >
                {/* Channel Number */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-colors ${
                    isActive
                      ? 'bg-rose-600 text-white'
                      : 'bg-neutral-800/80 text-neutral-400 group-hover:text-white group-hover:bg-neutral-700'
                  }`}
                >
                  {ch.channelNumber.toString().padStart(2, '0')}
                </div>

                {/* Logo or monogram */}
                <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                  {ch.logo ? (
                    <img loading="lazy" decoding="async"
                      src={ch.logo}
                      alt={ch.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs font-bold text-neutral-400">
                      {ch.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Channel Details */}
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs sm:text-sm text-white truncate">
                      {ch.name}
                    </span>
                    {isActive && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <span className="w-1.5 h-3 bg-rose-500 animate-pulse rounded-full" />
                        <span className="w-1.5 h-4 bg-rose-500 animate-pulse delay-75 rounded-full" />
                        <span className="w-1.5 h-2 bg-rose-500 animate-pulse delay-150 rounded-full" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5 truncate">
                    <span className="text-neutral-500 font-medium">{ch.group}</span>
                    {nowProg && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate text-neutral-300">{nowProg.title}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Favorite Star Button */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(ch.id);
                  }}
                  title={ch.isFavorite ? 'Remove Favorite' : 'Add Favorite'}
                  className={`p-1.5 rounded-lg shrink-0 cursor-pointer transition-colors ${
                    ch.isFavorite
                      ? 'text-amber-400 hover:text-amber-300'
                      : 'text-neutral-600 hover:text-neutral-300'
                  }`}
                >
                  <Sparkles className="w-4 h-4 fill-current" />
                </div>
              </button>
            );
          })
        ) : (
          /* Grid View Mode */
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredChannels.map((ch) => {
              const isActive = ch.id === activeChannel.id;

              return (
                <button
                  key={ch.id}
                  onClick={() => onSelectChannel(ch)}
                  className={`group relative p-3 rounded-xl border flex flex-col items-center text-center transition-all ${
                    isActive
                      ? 'bg-rose-950/50 border-rose-500 text-white shadow-md'
                      : 'bg-neutral-950/40 hover:bg-neutral-800/60 border-neutral-800/80 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="absolute top-2 left-2 font-mono text-[10px] font-bold text-neutral-500">
                    {ch.channelNumber.toString().padStart(2, '0')}
                  </div>

                  {/* Favorite button */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(ch.id);
                    }}
                    className={`absolute top-2 right-2 cursor-pointer ${
                      ch.isFavorite ? 'text-amber-400' : 'text-neutral-600 group-hover:text-neutral-400'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 fill-current" />
                  </div>

                  <div className="w-full h-14 rounded-lg bg-neutral-900 border border-neutral-800 p-1.5 flex items-center justify-center my-1">
                    {ch.logo ? (
                      <img loading="lazy" decoding="async"
                        src={ch.logo}
                        alt={ch.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-sm font-bold text-neutral-400">
                        {ch.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <span className="font-semibold text-xs text-white truncate w-full mt-1">
                    {ch.name}
                  </span>
                  <span className="text-[10px] text-neutral-400 truncate w-full">
                    {ch.group}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
