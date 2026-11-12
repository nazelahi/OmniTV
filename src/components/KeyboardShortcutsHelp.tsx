import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '/ or Ctrl+K', desc: 'Focus live channel & program search' },
    { key: '↓ / ↑', desc: 'Previous / Next Channel' },
    { key: '0 - 9', desc: 'Type channel number to switch directly' },
    { key: 'Space', desc: 'Play / Pause stream' },
    { key: 'M', desc: 'Mute / Unmute audio' },
    { key: 'F', desc: 'Toggle Fullscreen mode' },
    { key: 'T', desc: 'Toggle Theater wide mode' },
    { key: 'P', desc: 'Toggle Picture-in-Picture' },
    { key: 'H', desc: 'Return to Home Screen' },
    { key: 'G', desc: 'Toggle TV Schedule Guide (EPG)' },
    { key: 'R', desc: 'Toggle On-Screen Virtual TV Remote' },
    { key: 'D', desc: 'Toggle Stream Technical Diagnostics' },
    { key: 'Esc', desc: 'Close open dialogs & menus' },
  ];

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full shadow-2xl p-6 text-white">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Keyboard Remote Controls</h3>
              <p className="text-xs text-neutral-400">Control your TV experience with instant hotkeys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-neutral-800/80">
          {shortcuts.map((sc, i) => (
            <div key={i} className="py-2.5 flex items-center justify-between gap-3 text-xs">
              <span className="text-neutral-300">{sc.desc}</span>
              <kbd className="px-2.5 py-1 bg-neutral-950 border border-neutral-700 rounded-md font-mono text-xs font-semibold text-rose-400 shadow-xs">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white rounded-xl transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
