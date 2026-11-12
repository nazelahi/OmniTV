import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Play,
  Tv,
  Sparkles,
  LayoutGrid,
  Grid3X3,
  ChevronLeft,
  ChevronRight,
  Clock,
  Radio,
} from 'lucide-react';
import { Channel, EPGProgram } from '../types/playlist';
import { getCurrentAndNextProgram } from '../utils/epgGenerator';
import { getProgramPoster, generateDynamicPosterSvg } from '../utils/posterService';
import { searchChannels } from '../utils/channelSearch';
import { HighlightText } from './HighlightText';

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
  const [nowTick, setNowTick] = useState<number>(() => Math.floor(Date.now() / 60000));
  const shelfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setNowTick(Math.floor(Date.now() / 60000));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const scrollShelf = (direction: 'left' | 'right') => {
    if (shelfRef.current) {
      const offset = direction === 'left' ? -380 : 380;
      shelfRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Favorites count
  const favoritesCount = useMemo(() => {
    return channels.filter((c) => c.isFavorite).length;
  }, [channels]);

  // YouTube Category filter chips
  const categoryChips = useMemo(() => {
    const list = ['All'];
    if (favoritesCount > 0 || selectedCategory === 'Favorites') list.push('Favorites');
    groups.forEach((g) => {
      if (g !== 'Favorites' && !list.includes(g)) {
        list.push(g);
      }
    });
    return list;
  }, [groups, favoritesCount, selectedCategory]);

  // Precompute current EPG program per channel to avoid regenerating schedules on every render
  const programsByChannel = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getCurrentAndNextProgram>>();
    channels.forEach((ch) => {
      map.set(ch.id, getCurrentAndNextProgram(ch, epgData));
    });
    return map;
  }, [channels, epgData, nowTick]);

  // Dynamically curated Featured Tonight lineup (round-robin across categories + real EPG/favorites first)
  const featuredLineup = useMemo(() => {
    if (channels.length === 0) return [];
    const byGroup = new Map<string, Channel[]>();
    const sorted = [...channels].sort((a, b) => {
      const aHasRealProg = epgData && (epgData.get(a.id)?.length || 0) > 0 ? 1 : 0;
      const bHasRealProg = epgData && (epgData.get(b.id)?.length || 0) > 0 ? 1 : 0;
      if (aHasRealProg !== bHasRealProg) return bHasRealProg - aHasRealProg;
      if (!!a.isFavorite !== !!b.isFavorite) return a.isFavorite ? -1 : 1;
      return a.channelNumber - b.channelNumber;
    });

    sorted.forEach((ch) => {
      const g = ch.group || 'General';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(ch);
    });

    const queues = Array.from(byGroup.values());
    const result: Channel[] = [];
    const seen = new Set<string>();
    const maxItems = Math.min(14, channels.length);

    while (result.length < maxItems) {
      let addedInRound = false;
      for (const q of queues) {
        if (q.length > 0 && result.length < maxItems) {
          const ch = q.shift()!;
          if (!seen.has(ch.id)) {
            seen.add(ch.id);
            result.push(ch);
            addedInRound = true;
          }
        }
      }
      if (!addedInRound) break;
    }
    return result;
  }, [channels, epgData]);

  // Filtered & relevance-ranked channels
  const { filteredChannels, totalUnfilteredMatches } = useMemo(() => {
    const categoryFiltered = channels.filter((ch) => {
      if (selectedCategory === 'Favorites') return !!ch.isFavorite;
      if (selectedCategory !== 'All') {
        return ch.group.toLowerCase() === selectedCategory.toLowerCase();
      }
      return true;
    });

    if (!searchQuery.trim()) {
      return {
        filteredChannels: categoryFiltered,
        totalUnfilteredMatches: categoryFiltered.length,
      };
    }

    const inCategoryMatches = searchChannels(categoryFiltered, searchQuery, {
      programsByChannel,
    }).map((r) => r.channel);

    const allCategoryCount =
      selectedCategory === 'All'
        ? inCategoryMatches.length
        : searchChannels(channels, searchQuery, { programsByChannel }).length;

    return {
      filteredChannels: inCategoryMatches,
      totalUnfilteredMatches: allCategoryCount,
    };
  }, [channels, selectedCategory, searchQuery, programsByChannel]);

  return (
    <div className="flex flex-col gap-4 select-none">
      {/* ─────────────────────────────────────────────────────────────
          1. YOUTUBE-STYLE TOP FILTER CHIPS BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-[#0a0204]/85 backdrop-blur-xl -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none border-b border-rose-950/40">
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
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/60 border border-rose-950/40 shrink-0">
          <button
            onClick={() => setDensity('compact')}
            title="Compact Cards (More Channels on Screen)"
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
              density === 'compact' ? 'bg-rose-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Compact</span>
          </button>
          <button
            onClick={() => setDensity('normal')}
            title="Standard Cards"
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
              density === 'normal' ? 'bg-rose-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Standard</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. HIGH-STYLE FEATURED TONIGHT SHOWCASE & PROGRAM GUIDE
      ───────────────────────────────────────────────────────────── */}
      {!searchQuery && selectedCategory === 'All' && (
        <section className="relative rounded-2xl border border-rose-950/60 bg-gradient-to-b from-neutral-950/90 via-[#120306]/80 to-black/95 backdrop-blur-xl p-3.5 sm:p-5 shadow-2xl shadow-rose-950/30 overflow-hidden">
          {/* Subtle ambient lighting */}
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-rose-900/10 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header */}
          <div className="relative z-1 flex items-center justify-between mb-4 pb-3 border-b border-rose-950/40">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Featured Tonight
              </h2>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/70 text-rose-300 border border-rose-800/40 uppercase tracking-wider">
                Prime Time Guide
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Carousel Left / Right Scroll Buttons */}
              <div className="hidden sm:flex items-center gap-1">
                <button
                  onClick={() => scrollShelf('left')}
                  className="p-1.5 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 border border-rose-950/40 text-neutral-300 hover:text-white transition-colors"
                  title="Previous programs"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollShelf('right')}
                  className="p-1.5 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 border border-rose-950/40 text-neutral-300 hover:text-white transition-colors"
                  title="More programs"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={onGoToEPG}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/30 hover:bg-rose-950/50 border border-rose-900/40 transition-colors"
              >
                <span>Full TV Guide</span>
                <span className="text-[10px]">→</span>
              </button>
            </div>
          </div>

          {/* Prime Time Spotlight Hero Banner */}
          {(() => {
            const spotlightCh = featuredChannel || channels[0];
            if (!spotlightCh) return null;
            const prog = programsByChannel.get(spotlightCh.id)?.current || programsByChannel.get(spotlightCh.id)?.next;
            const poster = getProgramPoster(prog, spotlightCh, 0);

            return (
              <div className="relative mb-5 rounded-xl border border-rose-900/50 bg-black/60 overflow-hidden group shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
                  {/* Poster Thumbnail Box */}
                  <div
                    className="md:col-span-7 relative aspect-video md:aspect-auto md:min-h-[220px] bg-neutral-950 overflow-hidden cursor-pointer"
                    onClick={() => onWatchChannel(spotlightCh)}
                  >
                    <img
                      src={poster}
                      alt={prog?.title || spotlightCh.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                      loading="eager"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.src = generateDynamicPosterSvg(
                          prog?.title || spotlightCh.name,
                          spotlightCh.group,
                          spotlightCh.name,
                          spotlightCh.channelNumber
                        );
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/90 via-black/40 to-transparent pointer-events-none" />

                    {/* Live Badge & Category */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 shadow-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {prog?.isLive ? 'LIVE NOW' : 'TONIGHT'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-neutral-200 border border-white/10 text-[10px] font-medium font-mono">
                        CH {spotlightCh.channelNumber.toString().padStart(2, '0')}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-rose-300 border border-rose-900/40 text-[10px] font-semibold">
                        {spotlightCh.group}
                      </span>
                    </div>

                    {/* Quick Play Overlay on Hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 backdrop-blur-[2px]">
                      <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-950/80 transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Spotlight Info & Guide Details */}
                  <div className="md:col-span-5 p-4 sm:p-5 flex flex-col justify-between bg-gradient-to-br from-neutral-950/95 via-[#160408]/90 to-neutral-950/95 border-t md:border-t-0 md:border-l border-rose-950/50">
                    <div>
                      {/* Channel Branding */}
                      <div className="flex items-center gap-2 mb-2">
                        {spotlightCh.logo ? (
                          <img
                            src={spotlightCh.logo}
                            alt={spotlightCh.name}
                            className="w-5 h-5 object-contain rounded bg-neutral-900/80 p-0.5 border border-white/10"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Tv className="w-4 h-4 text-rose-500" />
                        )}
                        <span className="text-xs font-bold text-neutral-300 tracking-wide uppercase">
                          {spotlightCh.name}
                        </span>
                      </div>

                      {/* Show Title */}
                      <h3
                        onClick={() => onWatchChannel(spotlightCh)}
                        className="text-base sm:text-lg font-black text-white hover:text-rose-300 transition-colors cursor-pointer leading-snug mb-2 line-clamp-2"
                      >
                        {prog?.title || `${spotlightCh.name} — Live`}
                      </h3>

                      {/* Show Description */}
                      <p className="text-xs text-neutral-400 line-clamp-2 sm:line-clamp-3 mb-3 leading-relaxed">
                        {prog?.description ||
                          `${spotlightCh.group}${spotlightCh.country ? ` · ${spotlightCh.country}` : ''}${spotlightCh.language ? ` · ${spotlightCh.language}` : ''} — Live on CH ${spotlightCh.channelNumber.toString().padStart(2, '0')}.`}
                      </p>

                      {/* Program Timeslot and Duration */}
                      {prog && (
                        <div className="flex items-center gap-2 text-[11px] text-neutral-300 font-mono mb-3">
                          <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>
                            {new Date(prog.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                            {new Date(prog.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-neutral-500">•</span>
                          <span className="text-neutral-400">{prog.durationMinutes} min</span>
                        </div>
                      )}

                      {/* Real-time Progress Bar */}
                      {prog && prog.isLive && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono mb-1">
                            <span className="text-rose-400 font-semibold">Broadcast in Progress</span>
                            <span>{prog.progressPercent}% Elapsed</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-neutral-900 overflow-hidden border border-rose-950/60">
                            <div
                              className="h-full bg-gradient-to-r from-rose-700 via-rose-500 to-amber-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.max(5, prog.progressPercent)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => onWatchChannel(spotlightCh)}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/60 transition-all transform active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Watch Live Now</span>
                      </button>
                      <button
                        onClick={onGoToEPG}
                        className="px-3.5 py-2.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-rose-950/50 text-xs font-semibold transition-colors"
                        title="View Full EPG Guide"
                      >
                        Schedule
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Tonight's Lineup Carousel Shelf */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-rose-500" />
                <span>Prime-Time Lineup & Posters</span>
              </span>
              <span className="text-[11px] text-neutral-500 font-mono">
                {featuredLineup.length} Channels Featured
              </span>
            </div>

            <div
              ref={shelfRef}
              className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x scroll-smooth"
            >
              {featuredLineup.map((ch, idx) => {
                const current = programsByChannel.get(ch.id)?.current ?? null;
                const upcoming = programsByChannel.get(ch.id)?.next ?? null;
                const prog = current ?? upcoming;
                const poster = getProgramPoster(prog, ch, idx);

                return (
                  <div
                    key={ch.id}
                    onClick={() => onWatchChannel(ch)}
                    className="shrink-0 snap-start w-60 sm:w-64 rounded-xl bg-gradient-to-b from-neutral-900/80 via-[#150407]/70 to-neutral-950/90 border border-neutral-800/80 hover:border-rose-600/70 p-2 overflow-hidden transition-all duration-200 text-left cursor-pointer group shadow-md hover:shadow-xl hover:shadow-rose-950/30 flex flex-col"
                  >
                    {/* 16:9 Program Poster Image Box */}
                    <div className="relative aspect-video rounded-lg bg-neutral-950 overflow-hidden mb-2.5 flex items-center justify-center">
                      <img
                        loading="lazy"
                        decoding="async"
                        src={poster}
                        alt={prog?.title || ch.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.src = generateDynamicPosterSvg(
                            prog?.title || ch.name,
                            ch.group,
                            ch.name,
                            ch.channelNumber
                          );
                        }}
                      />

                      {/* Poster Shadow Gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                      {/* Channel Badge Pill */}
                      <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md font-mono text-[9px] font-bold text-rose-400 border border-white/10">
                          CH {ch.channelNumber.toString().padStart(2, '0')}
                        </span>
                      </div>

                      {/* Live Badge or Category */}
                      <div className="absolute top-1.5 right-1.5">
                        {prog?.isLive ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold text-[9px] flex items-center gap-1 shadow">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            LIVE
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[9px] font-medium text-neutral-300 border border-white/10">
                            {ch.group}
                          </span>
                        )}
                      </div>

                      {/* Progress bar at bottom of poster if live */}
                      {prog?.isLive && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                          <div
                            className="h-full bg-rose-600 transition-all duration-300"
                            style={{ width: `${Math.max(5, prog.progressPercent)}%` }}
                          />
                        </div>
                      )}

                      {/* Hover Play Button */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[1px]">
                        <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Program Metadata Details */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        {/* Channel title & logo */}
                        <div className="flex items-center gap-1.5 mb-1">
                          {ch.logo && (
                            <img
                              src={ch.logo}
                              alt={ch.name}
                              className="w-3.5 h-3.5 object-contain rounded-xs shrink-0"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}
                          <span className="text-[11px] font-semibold text-neutral-400 truncate">
                            {ch.name}
                          </span>
                        </div>

                        {/* Program Title */}
                        <h4 className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors line-clamp-1 leading-snug">
                          {prog?.title || `${ch.name} Broadcast`}
                        </h4>
                      </div>

                      {/* Time slot */}
                      <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-rose-500/80" />
                          {prog ? (
                            <span>
                              {new Date(prog.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span>{ch.group}</span>
                          )}
                        </span>
                        <span className="text-neutral-500 text-[9px] group-hover:text-rose-400 transition-colors">
                          Watch →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. COMPACT YOUTUBE CHANNEL VIDEO GRID
      ───────────────────────────────────────────────────────────── */}
      <section>
        {searchQuery.trim() ? (
          <div className="mb-3 p-3 rounded-xl bg-rose-950/25 border border-rose-900/50 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-neutral-300">
                Showing <strong className="text-white">{filteredChannels.length}</strong> match
                {filteredChannels.length === 1 ? '' : 'es'} for{' '}
                <span className="text-rose-300 font-semibold">&ldquo;{searchQuery.trim()}&rdquo;</span>
                {selectedCategory !== 'All' && (
                  <span className="text-neutral-400"> in {selectedCategory}</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedCategory !== 'All' && totalUnfilteredMatches > filteredChannels.length && (
                <button
                  type="button"
                  onClick={() => onSelectCategory('All')}
                  className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/40 text-[11px] font-semibold transition-colors"
                >
                  Search all categories ({totalUnfilteredMatches})
                </button>
              )}
              {onSearchChange && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] font-medium transition-colors"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-3 px-0.5">
            <span>{filteredChannels.length} Live Channels Available</span>
            <span className="font-mono text-[11px] text-neutral-500">CLICK TO WATCH</span>
          </div>
        )}

        {filteredChannels.length === 0 ? (
          <div className="p-10 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800 flex flex-col items-center justify-center">
            <Tv className="w-10 h-10 text-neutral-600 mb-2" />
            <h3 className="text-sm font-bold text-white">No channels found</h3>
            <p className="text-xs text-neutral-400 max-w-md mt-1">
              {searchQuery.trim()
                ? selectedCategory !== 'All' && totalUnfilteredMatches > 0
                  ? `No matches in "${selectedCategory}", but ${totalUnfilteredMatches} channel${totalUnfilteredMatches === 1 ? '' : 's'} matched across other categories.`
                  : 'Try searching by channel name, #number (like #12), country, language, or live show title.'
                : 'No channels matched the selected category filter.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              {selectedCategory !== 'All' && (
                <button
                  type="button"
                  onClick={() => onSelectCategory('All')}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
                >
                  {totalUnfilteredMatches > 0
                    ? `Show ${totalUnfilteredMatches} matches in All Categories`
                    : 'Show All Categories'}
                </button>
              )}
              {searchQuery.trim() && onSearchChange && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors"
                >
                  Clear Search
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            className={`grid gap-x-3 gap-y-4 ${
              density === 'compact'
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
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
                      <h4 className="text-xs font-bold text-white truncate leading-tight group-hover:text-rose-400 transition-colors">
                        <HighlightText text={prog?.title || ch.name} query={searchQuery} />
                      </h4>

                      {/* Channel Name and Category (Clean unboxed metadata) */}
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 truncate mt-0.5">
                        <HighlightText
                          text={ch.name}
                          query={searchQuery}
                          className="font-medium text-neutral-300 truncate"
                        />
                        <span aria-hidden="true" className="text-neutral-600">·</span>
                        <HighlightText
                          text={ch.group}
                          query={searchQuery}
                          className="text-neutral-500 truncate"
                        />
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
