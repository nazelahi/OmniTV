import React, { useState } from 'react';
import { X, Activity, Copy, Check, ShieldAlert, Cpu } from 'lucide-react';
import { StreamDiagnostics, Channel } from '../types/playlist';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: StreamDiagnostics;
  channel: Channel;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  diagnostics,
  channel,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const copyUrl = () => {
    navigator.clipboard.writeText(diagnostics.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full shadow-2xl p-6 text-white">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Stream Diagnostics</h3>
              <p className="text-xs text-neutral-400">Technical telemetry for current broadcast</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4 font-mono text-xs">
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
            <span className="text-[10px] text-neutral-500 uppercase block">Current Resolution</span>
            <span className="text-base font-bold text-rose-400 mt-0.5 block">
              {diagnostics.currentResolution || 'Auto / Adaptive'}
            </span>
          </div>

          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
            <span className="text-[10px] text-neutral-500 uppercase block">Forward Buffer</span>
            <span className="text-base font-bold text-white mt-0.5 block">
              {diagnostics.bufferedSeconds}s
            </span>
          </div>

          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
            <span className="text-[10px] text-neutral-500 uppercase block">Bitrate Bandwidth</span>
            <span className="text-base font-bold text-white mt-0.5 block">
              {diagnostics.bandwidthKbps > 0 ? `${diagnostics.bandwidthKbps} kbps` : 'Calculating...'}
            </span>
          </div>

          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
            <span className="text-[10px] text-neutral-500 uppercase block">Dropped Frames</span>
            <span className="text-base font-bold text-neutral-300 mt-0.5 block">
              {diagnostics.droppedFrames}
            </span>
          </div>
        </div>

        {/* Stream URL */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-neutral-300 mb-1">
            Raw Live Stream Source
          </label>
          <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-xl p-2.5">
            <span className="font-mono text-xs text-neutral-300 truncate flex-1 select-all">
              {diagnostics.url}
            </span>
            <button
              onClick={copyUrl}
              title="Copy stream URL"
              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg shrink-0 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* HLS & CORS Notice */}
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-400 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-neutral-300">Browser IPTV & CORS Considerations</p>
            <p className="text-[11px] mt-0.5 leading-relaxed">
              Standard web browsers require video streams to permit Cross-Origin Resource Sharing (CORS). Some commercial IPTV servers require dedicated hardware players or proxy servers if they block web origin requests.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
