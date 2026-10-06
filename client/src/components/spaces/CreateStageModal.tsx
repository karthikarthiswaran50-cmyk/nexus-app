import React, { useState } from 'react';
import { Radio, X, Sparkles, Mic } from 'lucide-react';

interface CreateStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string) => void;
  groupName?: string;
}

export const CreateStageModal: React.FC<CreateStageModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  groupName,
}) => {
  const [title, setTitle] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit(title.trim());
    setTitle('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-md bg-dark-900 border border-gold-500/30 rounded-3xl p-6 shadow-2xl royal-card animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gold-500/15 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-dark-950 shadow-lg shadow-gold-500/25">
              <Radio className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Start Live Voice Stage</h3>
              <p className="text-xs text-amber-300/80">
                {groupName ? `Broadcast to ${groupName}` : 'Live audio discussion space'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-dark-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-dark-300 mb-1.5">
              Stage Topic / Discussion Title
            </label>
            <input
              type="text"
              required
              autoFocus
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Royal Community Hangout & Ideas..."
              className="w-full px-4 py-3 bg-dark-850 border border-gold-500/25 rounded-2xl text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 transition-all shadow-inner"
            />
            <p className="text-[11px] text-dark-400 mt-1">
              Members will receive a live notification to tune in and listen.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-dark-850/60 border border-gold-500/15 flex items-center gap-2.5 text-xs text-dark-300">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Speakers can talk, while listeners can raise hands ✋ to request the mic.</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-dark-300 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black text-xs shadow-lg shadow-gold-500/25 transition-all active:scale-95 disabled:opacity-50"
            >
              Go Live Now 🎙️
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
