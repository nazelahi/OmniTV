import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  Power,
  Tv,
  Info,
  Maximize,
  Layers,
} from 'lucide-react';
import { Channel } from '../types/playlist';

interface VirtualRemoteProps {
  isOpen: boolean;
  onClose: () => void;
  activeChannel: Channel;
  onNextChannel: () => void;
  onPrevChannel: () => void;
  onSelectChannelByNumber: (num: number) => void;
  onToggleGuide: () => void;
  onTriggerOSD: () => void;
}

export const VirtualRemote: React.FC<VirtualRemoteProps> = ({
  isOpen,
  onClose,
  activeChannel,
  onNextChannel,
  onPrevChannel,
  onSelectChannelByNumber,
  onToggleGuide,
  onTriggerOSD,
}) => {
  const [typedBuffer, setTypedBuffer] = useState<string>('');
  const bufferTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleDigit = (digit: string) => {
    const nextBuf = typedBuffer + digit;
    setTypedBuffer(nextBuf);

    if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);

    bufferTimerRef.current = setTimeout(() => {
      const channelNum = parseInt(nextBuf, 10);
      if (!isNaN(channelNum)) {
        onSelectChannelByNumber(channelNum);
      }
      setTypedBuffer('');
    }, 1200);
  };

  const handleEnter = () => {
    if (typedBuffer) {
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
      const channelNum = parseInt(typedBuffer, 10);
      if (!isNaN(channelNum)) {
        onSelectChannelByNumber(channelNum);
      }
      setTypedBuffer('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-72 max-w-xs bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col gap-4 text-white select-none animate-in fade-in slide-in-from-bottom-6 duration-200">
      {/* Remote Top Bar */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-bold tracking-wider uppercase text-neutral-300">
            TV Remote
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mini LCD Display screen */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex flex-col items-center justify-center text-center font-mono shadow-inner">
        <span className="text-[10px] text-neutral-500 uppercase tracking-widest">
          {typedBuffer ? 'TUNING CHANNEL' : 'CURRENT CHANNEL'}
        </span>
        <span className="text-xl font-black text-rose-500 tracking-wider mt-0.5">
          CH {typedBuffer ? typedBuffer : activeChannel.channelNumber.toString().padStart(2, '0')}
        </span>
        <span className="text-[11px] text-neutral-300 truncate max-w-[200px] mt-0.5">
          {activeChannel.name}
        </span>
      </div>

      {/* D-Pad Navigation & Ch/Vol Rockers */}
      <div className="grid grid-cols-2 gap-3">
        {/* Channel Rocker */}
        <div className="bg-neutral-950/60 border border-neutral-800 rounded-2xl p-2 flex flex-col items-center justify-between gap-1 shadow-sm">
          <button
            onClick={onNextChannel}
            title="Next Channel (CH +)"
            className="w-full py-2 flex flex-col items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 active:bg-rose-600 rounded-lg transition-colors"
          >
            <ChevronUp className="w-5 h-5 text-rose-400" />
            <span className="text-[10px] font-bold mt-0.5">CH +</span>
          </button>
          <div className="w-6 h-[1px] bg-neutral-800" />
          <button
            onClick={onPrevChannel}
            title="Previous Channel (CH -)"
            className="w-full py-2 flex flex-col items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 active:bg-rose-600 rounded-lg transition-colors"
          >
            <span className="text-[10px] font-bold mb-0.5">CH -</span>
            <ChevronDown className="w-5 h-5 text-rose-400" />
          </button>
        </div>

        {/* Function Keys: Guide & Info */}
        <div className="flex flex-col gap-2 justify-between">
          <button
            onClick={onToggleGuide}
            className="flex-1 bg-neutral-800 hover:bg-neutral-700 active:bg-rose-600 border border-neutral-700/60 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-neutral-200 transition-colors shadow-sm"
          >
            <Layers className="w-4 h-4 text-rose-400" />
            <span>Guide</span>
          </button>

          <button
            onClick={onTriggerOSD}
            className="flex-1 bg-neutral-800 hover:bg-neutral-700 active:bg-rose-600 border border-neutral-700/60 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-neutral-200 transition-colors shadow-sm"
          >
            <Info className="w-4 h-4 text-rose-400" />
            <span>Info (OSD)</span>
          </button>
        </div>
      </div>

      {/* Numeric Keypad (1 - 9, 0, Enter) */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            onClick={() => handleDigit(digit)}
            className="h-11 bg-neutral-800/90 hover:bg-neutral-700 active:bg-rose-600 active:text-white rounded-xl border border-neutral-700/50 font-mono font-bold text-sm text-neutral-200 transition-all shadow-sm flex items-center justify-center"
          >
            {digit}
          </button>
        ))}
        <button
          onClick={() => setTypedBuffer('')}
          className="h-11 bg-neutral-800/50 hover:bg-neutral-700 active:bg-neutral-600 rounded-xl border border-neutral-700/40 text-xs font-medium text-neutral-400 transition-colors"
        >
          CLR
        </button>
        <button
          onClick={() => handleDigit('0')}
          className="h-11 bg-neutral-800/90 hover:bg-neutral-700 active:bg-rose-600 active:text-white rounded-xl border border-neutral-700/50 font-mono font-bold text-sm text-neutral-200 transition-all shadow-sm flex items-center justify-center"
        >
          0
        </button>
        <button
          onClick={handleEnter}
          className="h-11 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded-xl font-bold text-xs text-white transition-colors shadow-sm shadow-rose-900/40 flex items-center justify-center"
        >
          OK
        </button>
      </div>
    </div>
  );
};
