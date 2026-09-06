import React, { useState, useEffect } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { UserStoryGroup, StoryItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { CreateStoryModal } from './CreateStoryModal';
import { StoryViewerModal } from './StoryViewerModal';
import axios from 'axios';

export const StoriesBar: React.FC = () => {
  const { user } = useAuth();
  const [storyGroups, setStoryGroups] = useState<UserStoryGroup[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedUserIndex, setSelectedUserIndex] = useState(0);

  const fetchStories = async () => {
    try {
      const res = await axios.get('/api/stories');
      if (Array.isArray(res.data)) {
        setStoryGroups(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch stories:', err);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  const handleOpenStory = (index: number) => {
    setSelectedUserIndex(index);
    setViewerOpen(true);
  };

  const handleStoryCreated = (story: StoryItem) => {
    fetchStories();
  };

  const currentUserGroup = storyGroups.find((g) => g.user_id === user?.id);
  const otherGroups = storyGroups.filter((g) => g.user_id !== user?.id);

  return (
    <div className="p-3 border-b border-gold-500/15 bg-dark-950/60 backdrop-blur-md">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
        
        {/* 1. Add My Story Button */}
        <div className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group" onClick={() => setShowCreateModal(true)}>
          <div className="relative">
            <div className={`w-12 h-12 rounded-full p-0.5 ${
              currentUserGroup
                ? 'bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 p-[2px]'
                : 'border-2 border-dashed border-gold-500/40 hover:border-gold-400'
            }`}>
              <img
                src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt="My profile"
                className="w-11 h-11 rounded-full object-cover bg-dark-800"
              />
            </div>
            <button
              type="button"
              className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-dark-950 flex items-center justify-center shadow-lg border-2 border-dark-900 group-hover:scale-110 transition-transform"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
            </button>
          </div>
          <span className="text-[10px] font-bold text-amber-200/90 truncate max-w-[54px]">
            {currentUserGroup ? 'My Story' : 'Add Story'}
          </span>
        </div>

        {/* 2. Other Active Stories */}
        {otherGroups.map((group) => {
          const actualIndex = storyGroups.findIndex((g) => g.user_id === group.user_id);
          const hasUnseen = !group.all_viewed;

          return (
            <div
              key={group.user_id}
              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
              onClick={() => handleOpenStory(actualIndex)}
            >
              <div className={`w-12 h-12 rounded-full p-[2px] transition-transform group-hover:scale-105 ${
                hasUnseen
                  ? 'bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 animate-pulse'
                  : 'bg-dark-700 border border-white/10'
              }`}>
                <img
                  src={group.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                  alt={group.full_name}
                  className="w-11 h-11 rounded-full object-cover bg-dark-800 border-2 border-dark-900"
                />
              </div>
              <span className="text-[10px] font-medium text-dark-300 group-hover:text-white truncate max-w-[54px]">
                {group.username}
              </span>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <CreateStoryModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onStoryCreated={handleStoryCreated}
      />

      <StoryViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        storyGroups={storyGroups}
        initialUserIndex={selectedUserIndex}
        currentUserId={user?.id}
        onStoryDeleted={() => fetchStories()}
      />
    </div>
  );
};
