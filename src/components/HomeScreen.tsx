import React, { useState, useMemo } from 'react';
import {
  Play,
  Tv,
  Clock,
  Sparkles,
  CheckCircle2,
  LayoutGrid,
  Grid3X3,
} from 'lucide-react';
import { Channel } from '../types/playlist';
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
}) => {
  const [density, setDensity] = useState<'compact' | 'normal'>('compact');

  // EPG programs for the featured hero channel
  const { current: currentProgram, next: nextProgram } = getCurrentAndNextProgram(featuredChannel);

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
        return matchesName || matchesGroup || matchesNumber || matchesCountry;
      }

      return true;
    });
  }, [channels, selectedCategory, searchQuery]);

  return (
    <div className="flex flex-col gap-5 select-none">
      {/* ─────────────────────────────────────────────────────────────
          1. YOUTUBE-STYLE TOP FILTER CHIPS BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="sticky top-14 z-10 bg-neutral-950/95 backdrop-blur-md -mx-4 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none border-b border-neutral-800/60">
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
        <section className="relative rounded-2xl bg-gradient-to-r from-rose-950/65 via-neutral-950/80 to-[#140205]/90 border border-rose-800/40 shadow-xl shadow-rose-950/30 overflow-hidden p-4 sm:p-5 backdrop-blur-md">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            {/* Banner Left Details */}
            <div className="lg:col-span-8 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[9px] uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  FEATURED LIVE
                </span>
                <span className="text-xs text-neutral-400 font-medium">
                  {featuredChannel.group}
                </span>
                {featuredChannel.country && (
                  <>
                    <span className="text-neutral-600">·</span>
                    <span className="text-xs text-neutral-400">{featuredChannel.country}</span>
                  </>
                )}
              </div>

              {/* Station Wordmark */}
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="font-mono text-[11px] font-bold text-neutral-300 bg-neutral-800 px-2 py-0.5 rounded">
                  CH {featuredChannel.channelNumber.toString().padStart(2, '0')}
                </span>
                <h3 className="text-xs font-semibold text-neutral-300">
                  {featuredChannel.name}
                </h3>
              </div>

              {/* Featured Show Title */}
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-snug mb-1.5">
                {currentProgram?.title || 'Continuous Global Live Broadcast'}
              </h2>

              <p className="text-xs text-neutral-300 line-clamp-1 max-w-2xl mb-3">
                {currentProgram?.description || 'Broadcasting in 1080p full high-definition streaming.'}
              </p>

              {/* EPG Progress Bar */}
              {currentProgram && (
                <div className="max-w-md mb-3.5">
                  <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono mb-1">
                    <span>
                      {new Date(currentProgram.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                      {new Date(currentProgram.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>{currentProgram.progressPercent}% elapsed</span>
                  </div>
                  <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${currentProgram.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Watch Now Button */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => onWatchChannel(featuredChannel)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs rounded-full transition-all shadow-md shadow-rose-900/30 hover:scale-105"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Watch Live</span>
                </button>

                <button
                  onClick={onGoToEPG}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-semibold text-xs rounded-full border border-neutral-700 transition-colors"
                >
                  <Clock className="w-3 h-3 text-neutral-400" />
                  <span>TV Guide</span>
                </button>
              </div>
            </div>

            {/* Banner Right Preview Thumbnail Card (Click to open) */}
            <div
              onClick={() => onWatchChannel(featuredChannel)}
              className="lg:col-span-4 group relative h-36 rounded-xl bg-neutral-950 border border-neutral-800 overflow-hidden cursor-pointer shadow-md flex items-center justify-center p-4 transition-all hover:border-neutral-700"
            >
              <div className="w-full h-full flex items-center justify-center">
                {featuredChannel.logo ? (
                  <img
                    src={featuredChannel.logo}
                    alt={featuredChannel.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                    className="max-w-[80%] max-h-[75%] object-contain drop-shadow-md"
                  />
                ) : (
                  <Tv className="w-10 h-10 text-neutral-400" />
                )}
              </div>

              {/* Play Overlay */}
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                <div className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
              </div>

              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[9px] font-bold text-rose-400">
                LIVE
              </div>
            </div>
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
              const { current: prog } = getCurrentAndNextProgram(ch);

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
                      <img
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

                    {/* Bottom Right: Red LIVE Badge */}
                    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.2 rounded bg-rose-600 text-white font-mono text-[9px] font-bold tracking-wider uppercase">
                      <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                      LIVE
                    </div>

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
                        <img
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
                        {prog?.title || `${ch.name} Live`}
                      </h4>

                      {/* Channel Name */}
                      <div className="flex items-center gap-1 text-[11px] text-neutral-400 truncate mt-0.5">
                        <span className="truncate hover:text-white">
                          {ch.name}
                        </span>
                        <CheckCircle2 className="w-3 h-3 text-neutral-500 shrink-0" />
                      </div>

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
