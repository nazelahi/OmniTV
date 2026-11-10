import React from 'react';
import {
  ArrowLeft,
  Sparkles,
  Tv,
  Share2,
  Clock,
  Activity,
  History,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { Channel, StreamDiagnostics, EPGProgram } from '../types/playlist';
import { getCurrentAndNextProgram } from '../utils/epgGenerator';
import { VideoPlayer } from './VideoPlayer';
import { ChannelList } from './ChannelList';

interface WatchScreenProps {
  channel: Channel;
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
  onNextChannel: () => void;
  onPrevChannel: () => void;
  onToggleFavorite: (channelId: string) => void;
  onBackToHome: () => void;
  groups: string[];
  isTheaterMode: boolean;
  onToggleTheaterMode: () => void;
  onOpenDiagnostics: () => void;
  setStreamDiagnostics: (diag: StreamDiagnostics) => void;
  recentChannels: Channel[];
  epgData?: Map<string, EPGProgram[]> | null;
}

export const WatchScreen: React.FC<WatchScreenProps> = ({
  channel,
  channels,
  onSelectChannel,
  onNextChannel,
  onPrevChannel,
  onToggleFavorite,
  onBackToHome,
  groups,
  isTheaterMode,
  onToggleTheaterMode,
  onOpenDiagnostics,
  setStreamDiagnostics,
  recentChannels,
  epgData,
}) => {
  const { current: currentProgram, next: nextProgram } = getCurrentAndNextProgram(channel, epgData);

  return (
    <div className="flex flex-col gap-4 pb-12 select-none animate-in fade-in duration-200">
      {/* YouTube-style Top Navigation & Back Button */}
      <div className="flex items-center justify-between gap-4 py-1">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 px-3.5 py-2 bg-black/60 hover:bg-neutral-900 text-neutral-200 hover:text-white rounded-xl text-xs font-semibold border border-rose-950/50 transition-colors shadow-sm group"
        >
          <ArrowLeft className="w-4 h-4 text-rose-400 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Channels</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span className="font-mono text-neutral-500">
            CH {channel.channelNumber.toString().padStart(2, '0')}
          </span>
          <span className="text-white font-semibold truncate max-w-[200px] sm:max-w-xs">
            {channel.name}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-800/40 text-[10px] font-bold text-rose-400 uppercase">
            LIVE
          </span>
        </div>
      </div>

      {/* Main Grid: Cinema Player (Left) + Up Next Channel Switcher (Right) */}
      <div className={`grid gap-5 ${isTheaterMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'}`}>
        {/* Left Column: Player & Program Details */}
        <div className={`flex flex-col gap-4 ${isTheaterMode ? 'w-full' : 'lg:col-span-8 xl:col-span-8'}`}>
          {/* Main Video Player */}
          <div className="relative w-full rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl bg-black">
            <VideoPlayer
              channel={channel}
              onNextChannel={onNextChannel}
              onPrevChannel={onPrevChannel}
              onToggleFavorite={onToggleFavorite}
              isTheaterMode={isTheaterMode}
              onToggleTheaterMode={onToggleTheaterMode}
              onOpenDiagnostics={onOpenDiagnostics}
              setStreamDiagnostics={setStreamDiagnostics}
              epgData={epgData}
            />
          </div>

          {/* Under-Player Metadata & Channel Bar (like YouTube) */}
          <div className="bg-gradient-to-br from-neutral-900/80 via-[#160306]/75 to-black/85 border border-rose-950/60 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 backdrop-blur-md shadow-xl shadow-rose-950/20">
            {/* Channel info and quick actions */}
            <div className="flex flex-row items-center justify-between gap-3 pb-4 border-b border-neutral-800/70 flex-wrap">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-neutral-950 border border-neutral-800 p-1 flex items-center justify-center shrink-0 shadow-inner">
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
                    <Tv className="w-6 h-6 text-neutral-400" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-rose-600 text-white">
                      CH {channel.channelNumber.toString().padStart(2, '0')}
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-white truncate">
                      {channel.name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                    <span>{channel.group}</span>
                    {channel.country && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{channel.country}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 justify-end">
                <button
                  onClick={onPrevChannel}
                  title="Previous Channel"
                  className="flex items-center gap-1 px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-[11px] font-semibold transition-colors"
                >
                  <SkipBack className="w-3 h-3" />
                  <span>Prev</span>
                </button>

                <button
                  onClick={onNextChannel}
                  title="Next Channel"
                  className="flex items-center gap-1 px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-[11px] font-semibold transition-colors"
                >
                  <span>Next</span>
                  <SkipForward className="w-3 h-3" />
                </button>

                <button
                  onClick={() => onToggleFavorite(channel.id)}
                  title={channel.isFavorite ? 'Remove Favorite' : 'Save Favorite'}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    channel.isFavorite
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700/60 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                </button>

                <button
                  onClick={onOpenDiagnostics}
                  title="Stream Diagnostics"
                  className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 border border-neutral-700/60 hover:text-white transition-colors"
                >
                  <Activity className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Program Details from EPG Guide */}
            {currentProgram && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="font-bold text-rose-400 uppercase tracking-wider text-[11px]">
                      Live On Air
                    </span>
                    <span className="text-white font-bold">{currentProgram.title}</span>
                  </div>
                  <span className="font-mono text-neutral-400">
                    {new Date(currentProgram.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {new Date(currentProgram.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed">
                  {currentProgram.description}
                </p>


              </div>
            )}
          </div>

          {/* Recently Watched Quick Strip */}
          {recentChannels.length > 0 && (
            <div className="flex items-center gap-2 p-2.5 bg-neutral-900/50 backdrop-blur-sm rounded-xl border border-neutral-800/80 overflow-x-auto scrollbar-none">
              <span className="text-[11px] font-bold text-neutral-400 flex items-center gap-1.5 shrink-0 pl-1 uppercase tracking-wider">
                <History className="w-3.5 h-3.5 text-neutral-500" />
                Recent:
              </span>
              <div className="flex items-center gap-2">
                {recentChannels.map((rc) => {
                  const isCurrent = rc.id === channel.id;
                  return (
                    <button
                      key={rc.id}
                      onClick={() => onSelectChannel(rc)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                        isCurrent
                          ? 'bg-rose-950/60 border-rose-500/60 text-white font-semibold'
                          : 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-neutral-400">
                        CH {rc.channelNumber.toString().padStart(2, '0')}
                      </span>
                      <span className="truncate max-w-[120px]">{rc.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: YouTube-style "Channel Switcher / Up Next" Drawer */}
        <div className={`${isTheaterMode ? 'w-full h-[60vh]' : 'lg:col-span-4 xl:col-span-4 h-[400px] sm:h-[500px] lg:h-auto'}`}>
          <ChannelList
            channels={channels}
            activeChannel={channel}
            onSelectChannel={onSelectChannel}
            onToggleFavorite={onToggleFavorite}
            groups={groups}
            epgData={epgData}
          />
        </div>
      </div>
    </div>
  );
};
