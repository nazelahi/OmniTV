import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  SkipBack,
  SkipForward,
  RotateCw,
  PictureInPicture,
  Activity,
  AlertCircle,
  Tv,
  Check,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Channel, AspectRatio, StreamDiagnostics } from '../types/playlist';
import { getCurrentAndNextProgram } from '../utils/epgGenerator';

interface VideoPlayerProps {
  channel: Channel;
  onNextChannel: () => void;
  onPrevChannel: () => void;
  onToggleFavorite: (channelId: string) => void;
  isTheaterMode: boolean;
  onToggleTheaterMode: () => void;
  onOpenDiagnostics: () => void;
  setStreamDiagnostics: (diag: StreamDiagnostics) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  onNextChannel,
  onPrevChannel,
  onToggleFavorite,
  isTheaterMode,
  onToggleTheaterMode,
  onOpenDiagnostics,
  setStreamDiagnostics,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.85);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showOSD, setShowOSD] = useState<boolean>(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [qualityLevels, setQualityLevels] = useState<{ id: number; height: number; bitrate: number }[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1); // -1 = auto
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [showAspectMenu, setShowAspectMenu] = useState<boolean>(false);
  const [currentResolution, setCurrentResolution] = useState<string>('Auto');

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const osdTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // EPG program info for current channel
  const { current: currentProgram, next: nextProgram } = getCurrentAndNextProgram(channel);

  // Show OSD banner on channel change
  const triggerOSD = useCallback(() => {
    setShowOSD(true);
    if (osdTimeoutRef.current) clearTimeout(osdTimeoutRef.current);
    osdTimeoutRef.current = setTimeout(() => {
      setShowOSD(false);
    }, 4000);
  }, []);

  // Reset controls timer
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showQualityMenu && !showAspectMenu) {
        setShowControls(false);
      }
    }, 3500);
  };

  // Setup HLS / Video playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsBuffering(true);
    setStreamError(null);
    setQualityLevels([]);
    setSelectedQuality(-1);
    setCurrentResolution('Auto');
    triggerOSD();

    // Destroy any existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const streamUrl = channel.url;
    const isHlsStream = streamUrl.includes('.m3u8') || streamUrl.includes('hls');

    if (isHlsStream && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxBufferLength: 30,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setIsBuffering(false);
        const levels = data.levels.map((lvl, idx) => ({
          id: idx,
          height: lvl.height || 0,
          bitrate: lvl.bitrate || 0,
        }));
        setQualityLevels(levels);

        video.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          // Autoplay blocked by browser policy; user interaction needed
          setIsPlaying(false);
        });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        const lvl = hls.levels[data.level];
        if (lvl) {
          const res = lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}k`;
          setCurrentResolution(res);
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover network error
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              // Cannot recover
              hls.destroy();
              setStreamError(`Stream playback error: ${data.details || 'Connection failed'}`);
              setIsBuffering(false);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') || !isHlsStream) {
      // Native HLS for Safari or direct MP4/WebM
      video.src = streamUrl;
      video.load();
      video.play().then(() => {
        setIsPlaying(true);
        setIsBuffering(false);
      }).catch(() => {
        setIsPlaying(false);
        setIsBuffering(false);
      });
    } else {
      setStreamError('HLS streaming is not supported on this browser.');
      setIsBuffering(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel, triggerOSD]);

  // Sync Diagnostics data
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      const hls = hlsRef.current;
      if (!video) return;

      let bufferedSeconds = 0;
      if (video.buffered.length > 0) {
        bufferedSeconds = Math.max(0, video.buffered.end(video.buffered.length - 1) - video.currentTime);
      }

      setStreamDiagnostics({
        url: channel.url,
        currentResolution: currentResolution,
        availableResolutions: qualityLevels.map((q) => `${q.height}p`),
        bufferedSeconds: parseFloat(bufferedSeconds.toFixed(1)),
        liveLatency: hls ? parseFloat(hls.latency.toFixed(1)) : 0,
        droppedFrames: video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality().droppedVideoFrames : 0,
        bandwidthKbps: hls && hls.bandwidthEstimate ? Math.round(hls.bandwidthEstimate / 1000) : 0,
        isHls: !!hls,
        status: streamError ? 'error' : isBuffering ? 'buffering' : isPlaying ? 'playing' : 'idle',
        errorMessage: streamError || undefined,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [channel, currentResolution, qualityLevels, streamError, isBuffering, isPlaying, setStreamDiagnostics]);

  // Video event handlers
  const handleWaiting = () => setIsBuffering(true);
  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);
  };
  const handlePause = () => setIsPlaying(false);
  const handleError = () => {
    setIsBuffering(false);
    setStreamError('Stream failed to load. The broadcast might be offline or blocked by CORS.');
  };

  // Play / Pause toggle
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Volume & Mute
  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    setVolume(newVol);
    video.volume = newVol;
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
      video.muted = false;
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    video.muted = nextMuted;
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Picture in Picture
  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch {
      // Ignore PiP errors
    }
  };

  // Reload current stream
  const handleReload = () => {
    setStreamError(null);
    setIsBuffering(true);
    const video = videoRef.current;
    if (hlsRef.current) {
      hlsRef.current.loadSource(channel.url);
      hlsRef.current.startLoad();
    } else if (video) {
      video.src = channel.url;
      video.load();
      video.play().catch(() => {});
    }
    triggerOSD();
  };

  // Quality switch
  const handleQualitySelect = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setSelectedQuality(levelIndex);
      if (levelIndex === -1) {
        setCurrentResolution('Auto');
      } else {
        const lvl = hlsRef.current.levels[levelIndex];
        if (lvl && lvl.height) {
          setCurrentResolution(`${lvl.height}p`);
        }
      }
    }
    setShowQualityMenu(false);
  };

  // Aspect ratio class
  const getAspectClass = () => {
    switch (aspectRatio) {
      case '4:3':
        return 'aspect-4/3 max-h-full object-contain';
      case 'fill':
        return 'w-full h-full object-cover';
      case 'fit':
        return 'w-full h-full object-contain';
      case '16:9':
      default:
        return 'w-full h-full object-contain';
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className={`relative w-full bg-black overflow-hidden select-none flex items-center justify-center rounded-xl border border-neutral-800/80 shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'h-screen rounded-none border-none' : isTheaterMode ? 'h-[75vh]' : 'h-[50vh] sm:h-[60vh] lg:h-[68vh]'
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        playsInline
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onPause={handlePause}
        onError={handleError}
        onClick={togglePlay}
        className={`transition-all duration-200 cursor-pointer ${getAspectClass()}`}
      />

      {/* Buffering Indicator */}
      {isBuffering && !streamError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none z-10">
          <div className="w-12 h-12 border-3 border-rose-500 border-t-transparent rounded-full animate-spin shadow-lg" />
          <span className="mt-3 text-xs font-semibold tracking-wider text-white uppercase drop-shadow">
            Tuning in {channel.name}...
          </span>
        </div>
      )}

      {/* Stream Error Overlay */}
      {streamError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/90 p-6 text-center z-20">
          <div className="w-14 h-14 rounded-full bg-rose-950/60 border border-rose-800/50 flex items-center justify-center text-rose-400 mb-4 shadow-xl">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Broadcast Unavailable</h3>
          <p className="text-xs text-neutral-400 max-w-md mb-6 leading-relaxed">
            {streamError}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleReload}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded-lg transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Stream</span>
            </button>
            <button
              onClick={onNextChannel}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Next Channel</span>
            </button>
          </div>
        </div>
      )}

      {/* TV OSD (On-Screen Display) Banner */}
      <div
        className={`absolute top-4 left-4 right-4 sm:left-6 sm:right-6 pointer-events-none transition-all duration-300 z-20 ${
          showOSD ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        <div className="max-w-2xl bg-neutral-950/85 backdrop-blur-md border border-neutral-700/60 rounded-xl p-3 sm:p-4 text-white shadow-2xl flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Channel Number Pill */}
            <div className="px-2.5 py-1 bg-rose-600 font-mono font-bold text-xs sm:text-sm rounded text-white shrink-0 tracking-wider">
              CH {channel.channelNumber.toString().padStart(2, '0')}
            </div>

            {/* Logo or Initial */}
            {channel.logo ? (
              <img
                src={channel.logo}
                alt={channel.name}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
                className="w-10 h-10 object-contain rounded bg-neutral-900 p-1 border border-neutral-800 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 font-bold text-sm shrink-0">
                {channel.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm sm:text-base text-white truncate drop-shadow">
                  {channel.name}
                </h4>
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-950 text-rose-400 border border-rose-800/40 uppercase">
                  LIVE
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5 truncate">
                <span>{channel.group}</span>
                {currentProgram && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-neutral-200 truncate">{currentProgram.title}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end shrink-0 text-right">
            <span className="font-mono text-xs font-semibold text-neutral-300">
              {currentResolution}
            </span>
            <span className="text-[11px] text-neutral-400">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Player Header Controls (Top Bar) */}
      <div
        className={`absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent transition-opacity duration-300 flex items-center justify-between z-15 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 text-white">
          <span className="text-xs font-semibold bg-neutral-900/80 px-2.5 py-1 rounded-md border border-neutral-700/60">
            CH {channel.channelNumber}
          </span>
          <span className="text-sm font-semibold text-neutral-200 truncate max-w-xs sm:max-w-md">
            {channel.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Favorite button */}
          <button
            onClick={() => onToggleFavorite(channel.id)}
            title={channel.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className={`p-2 rounded-lg backdrop-blur-md border transition-colors ${
              channel.isFavorite
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-neutral-900/80 text-neutral-400 border-neutral-700/50 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
          </button>

          {/* Diagnostics toggle */}
          <button
            onClick={onOpenDiagnostics}
            title="Stream Technical Diagnostics"
            className="p-2 rounded-lg bg-neutral-900/80 backdrop-blur-md border border-neutral-700/50 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* Theater mode toggle */}
          <button
            onClick={onToggleTheaterMode}
            title={isTheaterMode ? 'Exit Theater Mode' : 'Theater Mode'}
            className={`p-2 rounded-lg backdrop-blur-md border transition-colors hidden sm:inline-flex ${
              isTheaterMode
                ? 'bg-rose-600/30 text-rose-400 border-rose-500/40'
                : 'bg-neutral-900/80 text-neutral-300 border-neutral-700/50 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Tv className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Broadcast Controls (Bottom Bar) */}
      <div
        className={`absolute bottom-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 flex flex-col gap-2 z-15 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Live EPG Timeline Progress Bar on Player */}
        {currentProgram && (
          <div className="w-full flex items-center gap-3 text-[11px] text-neutral-300 px-1">
            <span className="font-semibold text-rose-500 flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              LIVE NOW:
            </span>
            <span className="truncate font-medium text-white">{currentProgram.title}</span>
            <div className="flex-1 bg-neutral-800/80 h-1.5 rounded-full overflow-hidden mx-2 hidden sm:block">
              <div
                className="bg-rose-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${currentProgram.progressPercent}%` }}
              />
            </div>
            <span className="font-mono text-neutral-400 shrink-0 hidden sm:inline">
              {currentProgram.progressPercent}%
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          {/* Left Actions: Prev Channel, Play/Pause, Next Channel, Volume */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Prev Channel */}
            <button
              onClick={onPrevChannel}
              title="Previous Channel (Down Arrow)"
              className="p-2 text-neutral-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
              className="p-2 sm:p-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg transition-colors shadow-md"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              )}
            </button>

            {/* Next Channel */}
            <button
              onClick={onNextChannel}
              title="Next Channel (Up Arrow)"
              className="p-2 text-neutral-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5 ml-1 group/vol">
              <button
                onClick={toggleMute}
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                className="p-2 text-neutral-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 sm:w-24 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-rose-500 hidden sm:block"
                title={`Volume ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
            </div>

            {/* Reconnect button */}
            <button
              onClick={handleReload}
              title="Reload Stream"
              className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors hidden sm:block"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Right Actions: Aspect Ratio, Quality, PiP, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Aspect Ratio Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowAspectMenu(!showAspectMenu);
                  setShowQualityMenu(false);
                }}
                className="px-2.5 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-neutral-700/50 transition-colors uppercase flex items-center gap-1"
                title="Aspect Ratio"
              >
                <span>{aspectRatio}</span>
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              </button>

              {showAspectMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-28 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl overflow-hidden py-1 z-30">
                  {(['16:9', '4:3', 'fill', 'fit'] as AspectRatio[]).map((ar) => (
                    <button
                      key={ar}
                      onClick={() => {
                        setAspectRatio(ar);
                        setShowAspectMenu(false);
                      }}
                      className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between hover:bg-neutral-800 transition-colors uppercase ${
                        aspectRatio === ar ? 'text-rose-400 font-bold bg-neutral-800/60' : 'text-neutral-300'
                      }`}
                    >
                      <span>{ar}</span>
                      {aspectRatio === ar && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Video Quality Selector */}
            {qualityLevels.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowQualityMenu(!showQualityMenu);
                    setShowAspectMenu(false);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-neutral-700/50 transition-colors flex items-center gap-1"
                  title="Stream Quality"
                >
                  <span className="font-mono">{currentResolution}</span>
                  <ChevronDown className="w-3 h-3 text-neutral-400" />
                </button>

                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-32 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl overflow-hidden py-1 z-30">
                    <button
                      onClick={() => handleQualitySelect(-1)}
                      className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between hover:bg-neutral-800 transition-colors ${
                        selectedQuality === -1 ? 'text-rose-400 font-bold bg-neutral-800/60' : 'text-neutral-300'
                      }`}
                    >
                      <span>Auto</span>
                      {selectedQuality === -1 && <Check className="w-3 h-3" />}
                    </button>

                    {qualityLevels.map((lvl) => (
                      <button
                        key={lvl.id}
                        onClick={() => handleQualitySelect(lvl.id)}
                        className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between hover:bg-neutral-800 transition-colors ${
                          selectedQuality === lvl.id ? 'text-rose-400 font-bold bg-neutral-800/60' : 'text-neutral-300'
                        }`}
                      >
                        <span className="font-mono">{lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}k`}</span>
                        {selectedQuality === lvl.id && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Picture in Picture */}
            <button
              onClick={togglePiP}
              title="Picture in Picture (P)"
              className="p-2 text-neutral-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors hidden sm:block"
            >
              <PictureInPicture className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
              className="p-2 text-neutral-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
