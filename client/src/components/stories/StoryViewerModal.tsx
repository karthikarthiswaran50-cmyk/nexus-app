import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Trash2, ShieldCheck, Send } from 'lucide-react';
import { UserStoryGroup } from '../../types';
import axios from 'axios';

interface StoryViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyGroups: UserStoryGroup[];
  initialUserIndex: number;
  currentUserId?: string;
  onStoryDeleted?: (storyId: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  isOpen,
  onClose,
  storyGroups,
  initialUserIndex,
  currentUserId,
  onStoryDeleted,
}) => {
  const [userIndex, setUserIndex] = useState(initialUserIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<any>(null);

  // Story Viewers Drawer state
  const [showViewers, setShowViewers] = useState(false);
  const [viewersList, setViewersList] = useState<any[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  // Quick reaction and reply state
  const [flyingEmoji, setFlyingEmoji] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySent, setReplySent] = useState(false);

  // Sync userIndex when viewer opens with a different user
  useEffect(() => {
    if (isOpen) {
      setUserIndex(initialUserIndex);
      setStoryIndex(0);
      setShowViewers(false);
      setFlyingEmoji(null);
      setReplyText('');
    }
  }, [isOpen, initialUserIndex]);

  const fetchViewers = async (storyId: string) => {
    setLoadingViewers(true);
    setIsPaused(true);
    try {
      const res = await axios.get(`/api/stories/${storyId}/viewers`);
      setViewersList(res.data.viewers || []);
      setShowViewers(true);
    } catch (err) {
      console.error('Failed to fetch viewers:', err);
    } finally {
      setLoadingViewers(false);
    }
  };

  const handleSendReaction = async (emoji: string) => {
    setFlyingEmoji(emoji);
    setTimeout(() => setFlyingEmoji(null), 1500);

    try {
      await axios.post('/api/chat/send', {
        receiver_id: currentGroup.user_id,
        content: `Reacted ${emoji} to your story!`,
        type: 'text',
      });
    } catch (e) {}
  };

  const handleSendStoryReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    const text = replyText.trim();
    setReplyText('');
    setReplySent(true);
    setTimeout(() => setReplySent(false), 2000);

    try {
      await axios.post('/api/chat/send', {
        receiver_id: currentGroup.user_id,
        content: `Story Reply: "${text}"`,
        type: 'text',
      });
    } catch (e) {}
  };

  const currentGroup = storyGroups[userIndex] || storyGroups[0];
  const currentStory = currentGroup?.stories?.[storyIndex];
  const isOwner = currentStory?.user_id === currentUserId;

  const handleNextStory = () => {
    if (!currentGroup?.stories) return;
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
    } else if (userIndex < storyGroups.length - 1) {
      setUserIndex(userIndex + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  };

  const handlePrevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
    } else if (userIndex > 0) {
      setUserIndex(userIndex - 1);
      const prevStories = storyGroups[userIndex - 1]?.stories;
      setStoryIndex(prevStories && prevStories.length > 0 ? prevStories.length - 1 : 0);
    }
  };

  const handleDelete = async () => {
    if (!currentStory || !isOwner) return;
    if (!window.confirm('Delete this story?')) return;

    try {
      await axios.delete(`/api/stories/${currentStory.id}`);
      onStoryDeleted?.(currentStory.id);
      handleNextStory();
    } catch (err) {
      console.error('Failed to delete story:', err);
    }
  };

  // Mark story as viewed
  useEffect(() => {
    if (isOpen && currentStory && !isOwner) {
      axios.post(`/api/stories/${currentStory.id}/view`).catch(() => {});
    }
  }, [isOpen, currentStory?.id, isOwner]);

  // Story Progress Timer (5 seconds per story)
  useEffect(() => {
    if (!isOpen || isPaused || !currentStory) return;

    setProgress(0);
    const stepMs = 50;
    const totalMs = 5000;
    const increment = (stepMs / totalMs) * 100;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNextStory();
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, userIndex, storyIndex, isPaused, currentStory?.id]);

  if (!isOpen || storyGroups.length === 0 || !currentStory) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl select-none font-['Plus_Jakarta_Sans',sans-serif]"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-black/40 hover:bg-black/80 text-white/80 hover:text-white transition-all backdrop-blur-sm"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Navigation Buttons for desktop */}
      {userIndex > 0 || storyIndex > 0 ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handlePrevStory(); }}
          className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      ) : null}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleNextStory(); }}
        className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Main Story Container */}
      <div className="relative w-full max-w-sm h-full max-h-[92vh] sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border border-white/10">
        
        {/* Background Visual */}
        <div
          className="absolute inset-0 z-0 flex items-center justify-center p-6 text-center"
          style={{ background: currentStory.background_color || '#0f172a' }}
        >
          {currentStory.media_url ? (
            <img
              src={currentStory.media_url}
              alt="Story"
              className="w-full h-full object-contain z-0"
            />
          ) : (
            <p className="text-xl sm:text-2xl font-black text-white leading-relaxed max-w-xs drop-shadow-md z-0">
              {currentStory.content}
            </p>
          )}

          {/* Caption over image */}
          {currentStory.media_url && currentStory.content && (
            <div className="absolute bottom-16 left-4 right-4 bg-black/60 backdrop-blur-md p-3.5 rounded-2xl text-white text-xs font-semibold text-center z-10 border border-white/10">
              {currentStory.content}
            </div>
          )}
        </div>

        {/* Top Header & Progress bars */}
        <div className="relative z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          {/* Multi-story progress bars */}
          <div className="flex items-center gap-1.5 mb-3">
            {currentGroup.stories.map((s, idx) => {
              let fillPercent = 0;
              if (idx < storyIndex) fillPercent = 100;
              else if (idx === storyIndex) fillPercent = progress;

              return (
                <div key={s.id} className="flex-1 h-1 bg-white/25 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-75"
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* User Profile info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={currentGroup.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={currentGroup.full_name}
                className="w-10 h-10 rounded-full object-cover border-2 border-amber-400 shadow-md"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-xs sm:text-sm drop-shadow">
                    {currentGroup.full_name || currentGroup.username}
                  </span>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                </div>
                <span className="text-[10px] text-white/70">
                  {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {isOwner && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/30 transition-all text-xs flex items-center gap-1"
                title="Delete Story"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tap areas for mobile touch */}
        <div className="absolute inset-0 z-10 flex">
          <div className="w-1/3 h-full" onClick={handlePrevStory} />
          <div className="w-2/3 h-full" onClick={handleNextStory} />
        </div>

        {/* Floating Flying Reaction Animation */}
        {flyingEmoji && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none animate-in zoom-in fade-in duration-300">
            <span className="text-7xl drop-shadow-2xl animate-bounce">{flyingEmoji}</span>
          </div>
        )}

        {/* Bottom Bar: Views count (for owner) or quick reactions & reply (for others) */}
        <div className="relative z-20 p-3.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex flex-col gap-2">
          {isOwner ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fetchViewers(currentStory.id);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 hover:bg-gold-500 hover:text-dark-950 backdrop-blur-md text-white text-xs font-black border border-white/15 mx-auto transition-all active:scale-95 shadow-lg group"
            >
              <Eye className="w-4 h-4 text-amber-400 group-hover:text-dark-950 transition-colors" />
              <span>{currentStory.views_count || 0} Views</span>
            </button>
          ) : (
            <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              {/* Quick Reactions Bar */}
              <div className="flex items-center justify-center gap-3">
                {['❤️', '🔥', '😂', '👏', '😮'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendReaction(emoji)}
                    className="p-1.5 rounded-full hover:scale-130 active:scale-90 transition-transform text-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm"
                    title={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Story Reply Input */}
              <form onSubmit={handleSendStoryReply} className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  placeholder={replySent ? 'Reply sent!' : `Reply to ${currentGroup.full_name}...`}
                  className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-xs text-white placeholder:text-white/60 focus:outline-none focus:border-gold-400 backdrop-blur-md"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="p-2 rounded-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-dark-950 font-bold transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* 👁️ Story Viewers Slide-up Drawer */}
        {showViewers && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 max-h-[70%] z-40 bg-dark-900/98 border-t border-gold-500/30 rounded-t-3xl p-4 flex flex-col backdrop-blur-2xl shadow-2xl animate-in slide-in-from-bottom duration-250"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-black text-white">Story Viewers ({viewersList.length})</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowViewers(false);
                  setIsPaused(false);
                }}
                className="p-1.5 rounded-full text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {loadingViewers ? (
                <div className="text-center py-8 text-xs text-dark-400">Loading viewers...</div>
              ) : viewersList.length === 0 ? (
                <div className="text-center py-8 text-xs text-dark-400">No views recorded yet.</div>
              ) : (
                viewersList.map((viewer) => (
                  <div key={viewer.id} className="flex items-center justify-between gap-3 p-2 rounded-2xl bg-dark-850/60 border border-white/5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={viewer.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${viewer.username}`}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover border border-gold-500/30"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{viewer.full_name}</p>
                        <p className="text-[10px] text-dark-400 truncate">@{viewer.username}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-amber-300/80 shrink-0">
                      {new Date(viewer.viewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
