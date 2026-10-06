import React, { useState, useEffect } from 'react';
import { X, Star, MessageSquare, ExternalLink, Trash2, Calendar, User as UserIcon } from 'lucide-react';
import { Message } from '../../types';
import axios from 'axios';
import { Avatar } from '../common/Avatar';

interface StarredMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJumpToMessage?: (message: Message) => void;
  onUnstar?: (messageId: string) => void;
}

export const StarredMessagesModal: React.FC<StarredMessagesModalProps> = ({
  isOpen,
  onClose,
  onJumpToMessage,
  onUnstar,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStarred = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/chat/starred');
      setMessages(res.data.starredMessages || []);
    } catch (err) {
      console.error('Fetch starred messages failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStarred();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRemoveStar = async (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await axios.post(`/api/chat/messages/${messageId}/star`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      onUnstar?.(messageId);
    } catch (err) {
      console.error('Unstar message failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-lg max-h-[85vh] bg-dark-900 border border-gold-500/30 rounded-3xl p-6 shadow-2xl royal-card flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gold-500/15 pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-gold-500/30 flex items-center justify-center text-amber-300">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Starred Messages</h3>
              <p className="text-xs text-dark-300">Your bookmarked and saved conversations</p>
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

        {/* Content list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
          {loading ? (
            <div className="py-16 text-center text-xs text-dark-400 animate-pulse">
              Loading starred messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-dark-850 border border-gold-500/20 flex items-center justify-center text-dark-500">
                <Star className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-white">No Starred Messages</p>
              <p className="text-xs text-dark-400 max-w-xs mx-auto">
                Hover or tap on any message in chat and click the Star icon to bookmark important messages here.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => {
                  onJumpToMessage?.(msg);
                  onClose();
                }}
                className="group relative bg-dark-850 hover:bg-dark-800 border border-gold-500/15 hover:border-gold-500/40 rounded-2xl p-4 transition-all cursor-pointer shadow-md flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={msg.sender?.avatar_url}
                      name={msg.sender?.full_name || 'Sender'}
                      size="xs"
                      planId={msg.sender?.plan_id}
                    />
                    <span className="text-xs font-bold text-amber-300">
                      {msg.sender?.full_name || 'Sender'}
                    </span>
                    <span className="text-[10px] text-dark-500">
                      {new Date(msg.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleRemoveStar(msg.id, e)}
                    className="p-1.5 rounded-lg bg-dark-900/80 hover:bg-rose-500/20 text-dark-400 hover:text-rose-400 transition-all opacity-80 group-hover:opacity-100"
                    title="Remove star"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 hover:fill-none hover:text-rose-400" />
                  </button>
                </div>

                <p className="text-xs text-dark-200 line-clamp-3 leading-relaxed break-words">
                  {msg.type === 'audio' ? '🎤 Voice Message' : msg.type === 'image' ? '📷 Photo Attachment' : msg.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
