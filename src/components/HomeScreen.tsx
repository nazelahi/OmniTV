import React, { useState, useMemo, useEffect } from 'react';
import {
  Play,
  Tv,
  Sparkles,
  LayoutGrid,
  Grid3X3,
} from 'lucide-react';
import { Channel, EPGProgram } from '../types/playlist';
import { getCurrentAndNextProgram } from '../utils/epgGenerator';

interface HomeScreenProps {
  channels: Channel[];
  featuredChannel: Channel;
  onWatchChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
  onGoToEPG: () => void;
  groups: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange?: (query: string) => void;
  epgData?: Map<string, EPGProgram[]> | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  channels,
  featuredChannel,
  onWatchChannel,
  onToggleFavorite,
  onGoToEPG,
  groups,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  epgData,
}) => {
  const [density, setDensity] = useState<'compact' | 'normal'>('compact');

  // Favorites count
  const favoritesCount = useMemo(() => {
    return channels.filter((c) => c.isFavorite).length;
  }, [channels]);

  // YouTube Category filter chips
  const categoryChips = useMemo(() => {
    const list = ['All'];
    if (favoritesCount > 0) list.push('Favorites');
    groups.forEach((g) => {
      if (g !== 'Favorites' && !list.includes(g)) {
        list.push(g);
      }
    });
    return list;
  }, [groups, favoritesCount]);

  // Precompute current EPG program per channel to avoid regenerating schedules on every render
  const programsByChannel = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getCurrentAndNextProgram>>();
    channels.forEach((ch) => {
      map.set(ch.id, getCurrentAndNextProgram(ch, epgData));
    });
    return map;
  }, [channels, epgData]);

  // Filtered channels
  const filteredChannels = useMemo(() => {
    return channels.filter((ch) => {
      if (selectedCategory === 'Favorites') {
        if (!ch.isFavorite) return false;
      } else if (selectedCategory !== 'All') {
        if (ch.group.toLowerCase() !== selectedCategory.toLowerCase()) return false;
      }

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
  }, [channels, selectedCategory, searchQuery]);

  return (
    <div className="flex flex-col gap-5 select-none">
      {/* Mobile search bar */}
      <div className="md:hidden relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Search channels..."
          className="w-full bg-neutral-900 border border-neutral-700 rounded-full py-2 pl-4 pr-9 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange?.('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. YOUTUBE-STYLE TOP FILTER CHIPS BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-neutral-950/95 backdrop-blur-md -mx-4 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none border-b border-neutral-800/60">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {categoryChips.map((chip) => {
            const isActive = selectedCategory === chip;
            return (
              <button
                key={chip}
                onClick={() => onSelectCategory(chip)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? 'bg-rose-600 text-white font-bold shadow-md shadow-rose-950/50'
                    : 'bg-black/60 hover:bg-neutral-900 border border-rose-950/40 text-neutral-300'
                }`}
              >
                {chip === 'Favorites' ? (
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span>Favorites ({favoritesCount})</span>
                  </span>
                ) : (
                  chip
                )}
              </button>
            );
          })}
        </div>

        {/* Density Toggle (Compact vs Normal) */}
        <div className="hidden sm:flex items-center gap-1 p-0.5 rounded-lg bg-black/60 border border-rose-950/40 shrink-0">
          <button
            onClick={() => setDensity('compact')}
            title="Compact Cards (More Channels on Screen)"
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
              density === 'compact' ? 'bg-rose-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>Compact</span>
          </button>
          <button
            onClick={() => setDensity('normal')}
            title="Normal Cards"
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
              density === 'normal' ? 'bg-rose-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Standard</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. SLIM & CLEAN FEATURED HERO CARD (EPG SPOTLIGHT)
      ───────────────────────────────────────────────────────────── */}
      {!searchQuery && selectedCategory === 'All' && (
        <section className="rounded-2xl border border-rose-950/40 bg-neutral-950/40 backdrop-blur-md p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Featured Tonight
            </h3>
            <button
              onClick={onGoToEPG}
              className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors"
            >
              Full Guide →
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
            {channels.map((ch) => {
              const current = programsByChannel.get(ch.id)?.current ?? null;
              const upcoming = programsByChannel.get(ch.id)?.next ?? null;
              const prog = upcoming ?? current; // show upcoming program poster/title
              const poster = prog?.poster; // program poster only; no logo masquerading as a thumbnail
              return (
                <button
                  key={ch.id}
                  onClick={() => onWatchChannel(ch)}
                  className="shrink-0 snap-start w-64 sm:w-72 rounded-xl bg-neutral-900/60 border border-neutral-800/70 hover:border-rose-600/60 overflow-hidden transition-colors text-left flex flex-row"
                >
                  <div className="relative w-24 sm:w-28 shrink-0 aspect-video bg-neutral-950/60 flex items-center justify-center overflow-hidden">
                    {poster ? (
                      <img loading="lazy" decoding="async"
                        src={poster}
                        alt={prog?.title || ch.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Tv className="w-8 h-8 text-neutral-400" />
                    )}
                    <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/70 font-mono text-[8px] font-bold text-rose-400">
                      CH {ch.channelNumber.toString().padStart(2, '0')}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 p-2.5 flex flex-col gap-1 justify-center">
                    <p className="text-xs font-bold text-white truncate leading-tight">
                      {prog?.title || `${ch.name} — Live`}
                    </p>
                    <p className="text-[10px] text-neutral-400 truncate">{ch.name}</p>
                    {prog && (
                      <p className="text-[9px] text-neutral-500 font-mono">
                        {new Date(prog.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(prog.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. COMPACT YOUTUBE CHANNEL VIDEO GRID
      ───────────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-3 px-0.5">
          <span>{filteredChannels.length} Live Channels Available</span>
          <span className="font-mono text-[11px] text-neutral-500">CLICK TO WATCH</span>
        </div>

        {filteredChannels.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800 flex flex-col items-center justify-center">
            <Tv className="w-10 h-10 text-neutral-600 mb-2" />
            <h3 className="text-sm font-bold text-white">No channels found</h3>
            <p className="text-xs text-neutral-400 max-w-sm mt-1">
              Try searching with a different channel name, number, or category.
            </p>
          </div>
        ) : (
          <div
            className={`grid gap-x-3 gap-y-4 ${
              density === 'compact'
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                : 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
            }`}
          >
            {filteredChannels.map((ch) => {
              const prog = programsByChannel.get(ch.id)?.current ?? null;

              return (
                <div
                  key={ch.id}
                  onClick={() => onWatchChannel(ch)}
                  className="group flex flex-col cursor-pointer transition-transform"
                >
                  {/* 16:9 Thumbnail Frame with Prominent Channel Logo */}
                  <div className="relative aspect-video rounded-xl bg-gradient-to-b from-neutral-900/90 via-[#180407]/80 to-black/95 border border-rose-950/60 overflow-hidden shadow-xs group-hover:shadow-lg group-hover:shadow-rose-950/40 group-hover:border-rose-600/70 transition-all flex items-center justify-center p-3">
                    {/* Centered Large Channel Logo */}
                    {ch.logo ? (
                      <img loading="lazy" decoding="async"
                        src={ch.logo}
                        alt={ch.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const fallback = parent.querySelector('.text-fallback') as HTMLElement;
                            if (fallback) fallback.style.display = 'block';
                          }
                        }}
                        className="w-auto h-auto max-w-[80%] max-h-[72%] object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : null}

                    {/* Text Monogram fallback if logo is missing or errors */}
                    <span
                      className={`text-fallback font-black text-sm sm:text-base text-neutral-300 font-mono tracking-wider ${
                        ch.logo ? 'hidden' : 'block'
                      }`}
                    >
                      {ch.name.slice(0, 3).toUpperCase()}
                    </span>

                    {/* Top Left: Channel Number Pill */}
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.2 rounded bg-black/85 font-mono text-[9px] font-bold text-neutral-300">
                      CH {ch.channelNumber.toString().padStart(2, '0')}
                    </div>

                    {/* Favorite Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(ch.id);
                      }}
                      className={`absolute top-1.5 right-1.5 p-1 rounded-full bg-black/75 transition-colors ${
                        ch.isFavorite ? 'text-amber-400' : 'text-neutral-500 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 fill-current" />
                    </button>

                    {/* Hover Play Overlay */}
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-md">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </div>
                    </div>

                  </div>

                  {/* Compact Video Info Row */}
                  <div className="flex items-start gap-2 mt-2">
                    {/* Channel Avatar */}
                    <div className="w-7 h-7 rounded-full bg-neutral-900 border border-neutral-800 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                      {ch.logo ? (
                        <img loading="lazy" decoding="async"
                          src={ch.logo}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                          className="w-full h-full object-contain rounded-full"
                        />
                      ) : (
                        <span className="font-bold text-[9px] text-neutral-400">
                          {ch.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Title and Metadata */}
                    <div className="min-w-0 flex-1">
                      {/* Program Title */}
                      <h4 className="text-xs font-semibold text-white truncate leading-tight group-hover:text-rose-400 transition-colors">
                        {prog?.title || ch.name}
                      </h4>



                      {/* Category */}
                      <div className="text-[10px] text-neutral-500 truncate">
                        <span>{ch.group}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
