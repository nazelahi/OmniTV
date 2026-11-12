import React, { useState, useMemo, useEffect } from 'react';
import { Clock, Play, Sparkles, Tv, Info, Search, X, Settings, ExternalLink } from 'lucide-react';
import { Channel, EPGProgram } from '../types/playlist';
import { getChannelSchedule, withLiveTiming } from '../utils/epgGenerator';
import { getProgramPoster, generateDynamicPosterSvg } from '../utils/posterService';
import { searchChannels } from '../utils/channelSearch';
import { HighlightText } from './HighlightText';

interface EPGScheduleGuideProps {
  channels: Channel[];
  activeChannel: Channel;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
  epgUrl?: string;
  epgData?: Map<string, EPGProgram[]> | null;
  onOpenAdmin?: () => void;
}

export const EPGScheduleGuide: React.FC<EPGScheduleGuideProps> = ({
  channels,
  activeChannel,
  onSelectChannel,
  onToggleFavorite,
  epgUrl,
  epgData,
  onOpenAdmin,
}) => {
  const [selectedProgram, setSelectedProgram] = useState<{ program: EPGProgram; channel: Channel } | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [showSourceInfo, setShowSourceInfo] = useState<boolean>(false);
  const [nowTick, setNowTick] = useState<number>(() => Math.floor(Date.now() / 60000));

  useEffect(() => {
    const id = setInterval(() => {
      setNowTick(Math.floor(Date.now() / 60000));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const now = useMemo(() => new Date(), [nowTick]);

  // Time slot columns (showing 6 hours in 30-min steps)
  const timeSlots = useMemo(() => {
    const slots: Date[] = [];
    const base = new Date(now);
    base.setMinutes(base.getMinutes() < 30 ? 0 : 30, 0, 0);
    // 1 hour before now
    base.setHours(base.getHours() - 1);

    for (let i = 0; i < 12; i++) {
      slots.push(new Date(base.getTime() + i * 30 * 60 * 1000));
    }
    return slots;
  }, [now]);

  const schedulesByChannel = useMemo(() => {
    const map = new Map<string, EPGProgram[]>();
    const currentMs = now.getTime();
    channels.forEach((ch) => {
      const raw = getChannelSchedule(ch, now, epgData);
      map.set(
        ch.id,
        raw.map((prog) => withLiveTiming(prog, currentMs))
      );
    });
    return map;
  }, [channels, now, epgData]);

  // Filter & rank channels across names, #numbers, categories, countries, and scheduled programs
  const filteredChannels = useMemo(() => {
    const groupFiltered =
      selectedGroup === 'All'
        ? channels
        : channels.filter((ch) => ch.group === selectedGroup);

    if (!searchFilter.trim()) return groupFiltered;

    return searchChannels(groupFiltered, searchFilter, { schedulesByChannel }).map(
      (r) => r.channel
    );
  }, [channels, selectedGroup, searchFilter, schedulesByChannel]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => set.add(c.group));
    return ['All', ...Array.from(set)];
  }, [channels]);

  return (
    <div className="flex flex-col h-full bg-[#0a0204]/75 backdrop-blur-xl rounded-xl border border-rose-950/50 overflow-hidden shadow-xl shadow-rose-950/20">
      {/* Top Controls Header */}
      <div className="p-4 border-b border-neutral-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-500" />
            <span>Electronic Program Guide (EPG)</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Browse live broadcast schedules across all channels. Click any program to tune in.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search channel, #num, or show..."
              className="w-full pl-8 pr-7 py-1.5 bg-neutral-950/80 border border-neutral-700/60 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Group dropdown */}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="bg-neutral-950/80 border border-neutral-700/60 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-500"
          >
            {groups.map((g) => (
              <option key={g} value={g} className="bg-neutral-900">
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* EPG Source Status Bar */}
      <div className="px-4 py-2 bg-neutral-950/90 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-800/50 text-[11px] font-semibold text-rose-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            EPG Source:
          </span>
          <span className="text-[11px] text-neutral-300 font-mono truncate" title={epgUrl || 'Built-in Real-Time Clock Engine'}>
            {epgUrl ? (
              <span className="flex items-center gap-1.5 truncate">
                <span className="text-white font-semibold">{epgUrl}</span>
                <span className="text-neutral-500 text-[10px] shrink-0">(XMLTV Feed)</span>
              </span>
            ) : (
              <span className="text-neutral-400">
                Built-in Real-Time Clock Engine (synced to channel tvg-id & schedule)
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowSourceInfo(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/60 rounded-lg transition-colors"
          >
            <Info className="w-3 h-3 text-neutral-400" />
            <span>How Guide Works</span>
          </button>

          {onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 rounded-lg transition-colors font-medium"
            >
              <Settings className="w-3 h-3" />
              <span>Change Guide URL</span>
            </button>
          )}
        </div>
      </div>

      {/* Guide Matrix Table Container */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <div className="min-w-[720px] sm:min-w-[900px]">
          {/* Timeline Time Header */}
          <div className="flex border-b border-neutral-800 bg-neutral-950/95 sticky top-0 z-20">
            {/* Channel column header */}
            <div className="sticky left-0 z-30 w-36 sm:w-56 p-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider shrink-0 border-r border-neutral-800 bg-neutral-950">
              Channel
            </div>

            {/* Time columns */}
            <div className="flex-1 flex">
              {timeSlots.map((slot, i) => (
                <div
                  key={i}
                  className="w-44 p-3 text-xs font-mono font-medium text-neutral-300 border-r border-neutral-800/60 shrink-0 text-center"
                >
                  {slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              ))}
            </div>
          </div>

          {/* Channel Program Rows */}
          <div className="divide-y divide-neutral-800/60">
            {filteredChannels.map((channel) => {
              const isActive = channel.id === activeChannel.id;
              const schedule = schedulesByChannel.get(channel.id) || [];

              return (
                <div
                  key={channel.id}
                  className={`flex transition-colors ${
                    isActive ? 'bg-rose-950/20' : 'hover:bg-neutral-800/20'
                  }`}
                >
                  {/* Channel Card Sticky Left Column */}
                  <div
                    onClick={() => onSelectChannel(channel)}
                    className={`sticky left-0 z-10 w-36 sm:w-56 p-2 sm:p-3 flex items-center justify-between gap-2 sm:gap-3 shrink-0 border-r border-neutral-800 cursor-pointer ${
                      isActive ? 'bg-[#1c060c] ring-1 ring-inset ring-rose-500/40 text-white' : 'bg-[#0a0204]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-bold text-xs text-neutral-400 shrink-0">
                        {channel.channelNumber.toString().padStart(2, '0')}
                      </span>

                      <div className="w-8 h-8 rounded bg-neutral-900 border border-neutral-800 p-0.5 flex items-center justify-center shrink-0">
                        {channel.logo ? (
                          <img loading="lazy" decoding="async"
                            src={channel.logo}
                            alt={channel.name}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-neutral-400">
                            {channel.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <HighlightText
                          text={channel.name}
                          query={searchFilter}
                          className="text-xs font-bold text-white truncate block"
                        />
                        <HighlightText
                          text={channel.group}
                          query={searchFilter}
                          className="text-[10px] text-neutral-400 truncate block"
                        />
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(channel.id);
                      }}
                      className={`p-1 text-neutral-500 hover:text-amber-400 transition-colors ${
                        channel.isFavorite ? 'text-amber-400' : ''
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>

                  {/* Horizontal Program Blocks */}
                  <div className="flex-1 flex items-stretch p-1.5 gap-1.5 overflow-hidden">
                    {schedule.slice(0, 8).map((prog) => {
                      const isNow = prog.isLive;
                      // approximate width based on duration (30min = 176px approx)
                      const widthPx = Math.max(140, Math.round((prog.durationMinutes / 30) * 176));

                      return (
                        <div
                          key={prog.id}
                          style={{ width: `${widthPx}px` }}
                          onClick={() => {
                            onSelectChannel(channel);
                            setSelectedProgram({ program: prog, channel });
                          }}
                          className={`group/prog relative p-2.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between shrink-0 ${
                            isNow
                              ? 'bg-rose-950/30 border-rose-500/50 hover:border-rose-400 text-white'
                              : 'bg-neutral-950/50 border-neutral-800/80 hover:bg-neutral-800/60 hover:border-neutral-700 text-neutral-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-mono text-[10px] text-neutral-400">
                                {new Date(prog.startTime).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {isNow && (
                                <span className="px-1.5 py-0.2 bg-rose-600 text-white font-bold text-[9px] rounded uppercase tracking-wider">
                                  LIVE
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-semibold text-white line-clamp-1 group-hover/prog:text-rose-400 transition-colors">
                              {prog.title}
                            </h4>
                            <p className="text-[11px] text-neutral-400 line-clamp-2 mt-0.5 leading-tight">
                              {prog.description}
                            </p>
                          </div>

                          {/* Progress bar if live */}
                          {isNow && (
                            <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden mt-2">
                              <div
                                className="bg-rose-500 h-full rounded-full"
                                style={{ width: `${prog.progressPercent}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Program Details Modal */}
      {selectedProgram && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedProgram(null)}
              className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Dynamic Program Poster Banner */}
            {(() => {
              const poster = getProgramPoster(selectedProgram.program, selectedProgram.channel);
              return (
                <div className="relative aspect-video rounded-xl bg-neutral-950 overflow-hidden mb-4 border border-rose-950/60">
                  <img
                    src={poster}
                    alt={selectedProgram.program.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.src = generateDynamicPosterSvg(
                        selectedProgram.program.title,
                        selectedProgram.program.category,
                        selectedProgram.channel.name,
                        selectedProgram.channel.channelNumber
                      );
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                </div>
              );
            })()}

            <div className="flex items-center gap-3 mb-4">
              <span className="px-2.5 py-1 bg-rose-600 font-mono font-bold text-xs text-white rounded">
                CH {selectedProgram.channel.channelNumber.toString().padStart(2, '0')}
              </span>
              <span className="text-sm font-semibold text-neutral-300">
                {selectedProgram.channel.name}
              </span>
              {selectedProgram.program.isLive && (
                <span className="px-2 py-0.5 bg-rose-950 text-rose-400 border border-rose-800/40 text-[10px] font-bold rounded uppercase">
                  Currently Live
                </span>
              )}
            </div>

            <h3 className="text-lg font-bold text-white mb-2">{selectedProgram.program.title}</h3>

            <div className="flex items-center gap-3 text-xs text-neutral-400 mb-4">
              <span>{selectedProgram.program.category}</span>
              <span aria-hidden="true">·</span>
              <span>
                {new Date(selectedProgram.program.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                {new Date(selectedProgram.program.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span aria-hidden="true">·</span>
              <span>{selectedProgram.program.durationMinutes} min</span>
            </div>

            <p className="text-sm text-neutral-300 leading-relaxed mb-6">
              {selectedProgram.program.description}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedProgram(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onSelectChannel(selectedProgram.channel);
                  setSelectedProgram(null);
                }}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Watch Channel Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EPG Source & URL Information Modal */}
      {showSourceInfo && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowSourceInfo(false)}
              className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-500">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">How the TV Schedule Guide (EPG) Works</h3>
                <span className="text-[11px] text-neutral-400 font-mono">XMLTV & Real-Time Clock Engine</span>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-neutral-300 leading-relaxed my-4">
              <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800">
                <h4 className="font-bold text-white text-xs mb-1 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-rose-600 text-white font-mono text-[10px] flex items-center justify-center">1</span>
                  <span>From Your M3U Playlist Header</span>
                </h4>
                <p className="text-neutral-400 text-[11px]">
                  When you provide an M3U playlist URL, the parser automatically checks the first header line for <code className="text-rose-300 font-mono">x-tvg-url="..."</code> or <code className="text-rose-300 font-mono">url-tvg="..."</code>. If your IPTV provider included their XMLTV link there, it is loaded automatically.
                </p>
              </div>

              <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800">
                <h4 className="font-bold text-white text-xs mb-1 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-rose-600 text-white font-mono text-[10px] flex items-center justify-center">2</span>
                  <span>Direct XMLTV Guide URL (Admin Panel)</span>
                </h4>
                <p className="text-neutral-400 text-[11px]">
                  You can specify any custom XML or XMLTV guide URL directly in the <strong>Admin Panel</strong> under the <em>Primary Playlist URL</em> tab. OmniStream stores this setting and links programs by channel <code className="text-rose-300 font-mono">tvg-id</code>.
                </p>
              </div>

              <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800">
                <h4 className="font-bold text-white text-xs mb-1 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-rose-600 text-white font-mono text-[10px] flex items-center justify-center">3</span>
                  <span>Built-In Real-Time Clock Engine</span>
                </h4>
                <p className="text-neutral-400 text-[11px]">
                  When an external XML file is not provided or still loading, OmniStream uses a local clock-synchronized EPG engine. It calculates live program slots, genres, and exact elapsed percentage bars tied to the current real-world clock time so your schedule is never empty.
                </p>
              </div>

              {epgUrl && (
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">Current Active URL</span>
                  <p className="font-mono text-xs text-rose-300 break-all select-all">{epgUrl}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setShowSourceInfo(false)}
                className="px-4 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg"
              >
                Close
              </button>
              {onOpenAdmin && (
                <button
                  onClick={() => {
                    setShowSourceInfo(false);
                    onOpenAdmin();
                  }}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg"
                >
                  Configure in Admin Panel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
