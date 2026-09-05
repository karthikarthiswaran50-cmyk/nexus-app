import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Palette, Sparkles, Send, Loader2 } from 'lucide-react';
import axios from 'axios';
import { StoryItem } from '../../types';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated: (story: StoryItem) => void;
}

const BG_GRADIENTS = [
  '#0f172a',
  'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
  'linear-gradient(135deg, #0284c7 0%, #0f172a 100%)',
];

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({ isOpen, onClose, onStoryCreated }) => {
  if (!isOpen) return null;

  const [content, setContent] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_GRADIENTS[0]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !imageFile) return;

    setLoading(true);
    try {
      const formData = new FormData();
      if (content.trim()) formData.append('content', content.trim());
      formData.append('background_color', selectedBg);
      if (imageFile) {
        formData.append('media', imageFile);
      }

      const res = await axios.post('/api/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.story) {
        onStoryCreated(res.data.story);
        onClose();
      }
    } catch (err) {
      console.error('Failed to post story:', err);
      alert('Failed to share story. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-dark-900 border border-gold-500/25 rounded-3xl overflow-hidden shadow-2xl flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-dark-950/80">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-gold-400" />
            <h3 className="font-bold text-white text-sm">Add to Nexus Royal Story</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-dark-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Story Preview Canvas */}
        <div
          className="relative w-full aspect-[9/14] flex flex-col items-center justify-center p-6 text-center transition-all overflow-hidden"
          style={{ background: selectedBg }}
        >
          {imagePreview ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              <img
                src={imagePreview}
                alt="Story preview"
                className="max-h-[85%] max-w-full object-contain rounded-2xl shadow-xl"
              />
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white text-xs hover:bg-black/90"
              >
                <X className="w-4 h-4" />
              </button>
              {content && (
                <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md p-3 rounded-xl text-white text-xs font-semibold text-center">
                  {content}
                </div>
              )}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening? Type your story update..."
              maxLength={280}
              className="w-full bg-transparent text-white text-lg font-bold placeholder:text-white/40 text-center resize-none focus:outline-none"
              rows={4}
            />
          )}

          <div className="absolute top-3 left-3 text-[10px] text-white/60 bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-sm">
            Expires in 24 hours
          </div>
        </div>

        {/* Controls & Tools */}
        <div className="p-4 bg-dark-950 border-t border-white/10 space-y-3">
          {/* Background Pickers (if text mode) */}
          {!imagePreview && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <Palette className="w-4 h-4 text-gold-400 shrink-0" />
              {BG_GRADIENTS.map((bg, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedBg(bg)}
                  style={{ background: bg }}
                  className={`w-6 h-6 rounded-full border-2 shrink-0 transition-transform ${
                    selectedBg === bg ? 'border-white scale-125' : 'border-transparent'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Caption input if image is attached */}
          {imagePreview && (
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add a caption..."
              className="w-full px-3 py-2 bg-dark-850 border border-white/10 rounded-xl text-xs text-white placeholder:text-dark-400 focus:outline-none focus:border-gold-400"
            />
          )}

          <div className="flex items-center justify-between pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-all border border-white/5"
            >
              <ImageIcon className="w-4 h-4 text-gold-400" />
              <span>{imagePreview ? 'Change Photo' : 'Add Photo'}</span>
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || (!content.trim() && !imageFile)}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black text-xs shadow-lg shadow-gold-500/20 disabled:opacity-40 transition-all cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Share Story</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
