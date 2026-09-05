import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Trash2, ShieldCheck } from 'lucide-react';
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
  if (!isOpen || storyGroups.length === 0) return null;

  const [userIndex, setUserIndex] = useState(initialUserIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<any>(null);

  const currentGroup = storyGroups[userIndex] || storyGroups[0];
  const currentStory = currentGroup?.stories?.[storyIndex];
  const isOwner = currentStory?.user_id === currentUserId;

  // Mark story as viewed
  useEffect(() => {
    if (currentStory && !isOwner) {
      axios.post(`/api/stories/${currentStory.id}/view`).catch(() => {});
    }
  }, [currentStory?.id, isOwner]);

  // Story Progress Timer (5 seconds per story)
  useEffect(() => {
    if (isPaused || !currentStory) return;

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
  }, [userIndex, storyIndex, isPaused, currentStory?.id]);

  const handleNextStory = () => {
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
      setStoryIndex(storyGroups[userIndex - 1].stories.length - 1);
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
      alert('Failed to delete story');
    }
  };

  if (!currentStory) return null;

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

        {/* Bottom Bar: Views count (for owner) or message reply (for others) */}
        <div className="relative z-20 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between">
          {isOwner ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-white text-xs font-bold border border-white/10 mx-auto">
              <Eye className="w-4 h-4 text-amber-400" />
              <span>{currentStory.views_count || 0} Views</span>
            </div>
          ) : (
            <div className="text-[11px] text-white/60 text-center w-full">
              👑 Nexus Royal 24h Story
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
