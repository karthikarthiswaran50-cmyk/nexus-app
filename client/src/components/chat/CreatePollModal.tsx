import React, { useState } from 'react';
import { X, Plus, Trash2, BarChart2, HelpCircle } from 'lucide-react';
import { PollData } from '../../types';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pollData: PollData) => void;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleAddOption = () => {
    if (options.length >= 6) return;
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    const updated = options.filter((_, i) => i !== index);
    setOptions(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQ = question.trim();
    const cleanOpts = options.map((o) => o.trim()).filter(Boolean);

    if (!cleanQ) {
      setError('Please enter a poll question.');
      return;
    }

    if (cleanOpts.length < 2) {
      setError('Please provide at least 2 distinct options.');
      return;
    }

    const pollData: PollData = {
      question: cleanQ,
      options: cleanOpts.map((text, idx) => ({
        id: `opt_${Date.now()}_${idx}`,
        text,
        votes: [],
      })),
      totalVotes: 0,
    };

    onSubmit(pollData);
    setQuestion('');
    setOptions(['', '']);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-md bg-dark-900 border border-gold-500/30 rounded-3xl p-6 shadow-2xl royal-card animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gold-500/15 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-gold-500/30 flex items-center justify-center text-amber-300">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Create Group Poll</h3>
              <p className="text-xs text-dark-300">Ask a question and let members vote</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-dark-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-dark-200 mb-1.5 flex items-center gap-1.5">
              <span>Question</span>
              <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., What time is our group call?"
              maxLength={150}
              className="w-full px-4 py-2.5 bg-dark-850 border border-gold-500/20 rounded-xl text-xs text-white placeholder-dark-500 focus:outline-none focus:border-gold-400 transition-all"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-dark-200 flex items-center justify-between">
              <span>Options ({options.length}/6)</span>
            </label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  maxLength={60}
                  className="flex-1 px-3.5 py-2 bg-dark-850 border border-gold-500/20 rounded-xl text-xs text-white placeholder-dark-500 focus:outline-none focus:border-gold-400 transition-all"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all"
                    title="Remove option"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="w-full py-2 rounded-xl bg-dark-800/80 hover:bg-dark-800 border border-dashed border-gold-500/30 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Option</span>
              </button>
            )}
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-semibold text-center bg-rose-500/10 py-1.5 rounded-lg border border-rose-500/20 animate-in fade-in">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 text-xs font-black shadow-lg shadow-gold-500/20 transition-all active:scale-95"
            >
              Post Poll
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
