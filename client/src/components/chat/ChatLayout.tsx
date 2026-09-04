import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { Conversation, User } from '../../types';
import { Avatar } from '../common/Avatar';
import { PlanBadge } from '../common/Badge';
import { ChatRoom } from './ChatRoom';
import {
  Search,
  MessageSquare,
  Plus,
  Video,
  Phone,
  Sparkles,
  Users,
  Compass,
  Crown,
} from 'lucide-react';
import axios from 'axios';

interface ChatLayoutProps {
  onNavigateToDirectory: () => void;
  onNavigateToSubscription: () => void;
  onViewProfile: (user: User) => void;
  initialSelectedUser?: User | null;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({
  onNavigateToDirectory,
  onNavigateToSubscription,
  onViewProfile,
  initialSelectedUser,
}) => {
  const { user } = useAuth();
  const { onlineUserIds, latestMessage } = useSocket();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(initialSelectedUser || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    try {
      const res = await axios.get('/api/chat/conversations');
      setConversations(res.data.conversations);
      
      // If no initial user selected and conversations exist, default to first on desktop
      if (!selectedUser && !initialSelectedUser && res.data.conversations.length > 0 && window.innerWidth >= 1024) {
        setSelectedUser(res.data.conversations[0].other_user || null);
      }
    } catch (err) {
      console.error('Fetch conversations failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (initialSelectedUser) {
      setSelectedUser(initialSelectedUser);
    }
  }, [initialSelectedUser]);

  // Update conversations on new incoming message
  useEffect(() => {
    if (latestMessage) {
      fetchConversations();
    }
  }, [latestMessage]);

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true;
    const name = c.other_user?.full_name?.toLowerCase() || '';
    const username = c.other_user?.username?.toLowerCase() || '';
    return name.includes(searchQuery.toLowerCase()) || username.includes(searchQuery.toLowerCase());
  });

  const formatLastMessageTime = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] md:h-[calc(100dvh-5rem)] grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-4 p-0 sm:p-4 lg:p-6 overflow-hidden max-w-7xl mx-auto w-full font-['Plus_Jakarta_Sans',sans-serif]">
      
      {/* 👑 Left Sidebar: Conversations list (Royal Obsidian Glass) */}
      <div
        className={`lg:col-span-4 h-full flex flex-col bg-dark-900 border-0 sm:border border-gold-500/20 rounded-none sm:rounded-3xl overflow-hidden shadow-2xl royal-card ${
          selectedUser ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-gold-500/15 bg-dark-900/95 backdrop-blur-2xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-gold-400 fill-gold-400" />
              <span className="gold-gradient-text">Royal Messages</span>
            </h2>
            <button
              type="button"
              onClick={onNavigateToDirectory}
              className="p-2 px-3 rounded-xl bg-gold-500/15 hover:bg-gold-500/25 text-amber-200 border border-gold-500/30 transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Start New Royal Chat"
            >
              <Plus className="w-4 h-4 text-gold-400 stroke-[2.5]" />
              <span>New Chat</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gold-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats or @handle..."
              className="w-full pl-9 pr-4 py-2 bg-dark-850 border border-gold-500/15 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/50 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-dark-800/40">
          {loading ? (
            <div className="p-8 text-center text-xs text-dark-500">Loading chats...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <Users className="w-8 h-8 text-dark-600 mx-auto" />
              <p className="text-xs text-dark-400">No active conversations found</p>
              <button
                type="button"
                onClick={onNavigateToDirectory}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-dark-950 text-xs font-black shadow-lg shadow-gold-500/20 hover:scale-105 transition-all"
              >
                Browse Royal Directory
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const other = conv.other_user;
              if (!other) return null;

              const isOnline = onlineUserIds.has(other.id);
              const isSelected = selectedUser?.id === other.id;

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedUser(other)}
                  className={`w-full p-3 rounded-2xl flex items-center gap-3 text-left transition-all group ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-transparent border border-gold-400/40 shadow-inner'
                      : 'hover:bg-dark-850/80 border border-transparent'
                  }`}
                >
                  <Avatar
                    src={other.avatar_url}
                    name={other.full_name}
                    size="md"
                    isOnline={isOnline}
                    showOnlineStatus
                    planId={other.plan_id}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-extrabold text-white truncate group-hover:text-amber-200 transition-colors">
                        {other.full_name}
                      </p>
                      <span className="text-[10px] text-dark-400 shrink-0 font-mono">
                        {formatLastMessageTime(conv.last_message?.created_at || conv.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-dark-400 truncate">
                        {conv.last_message ? (
                          conv.last_message.type === 'audio' ? '🎤 Voice Note' : conv.last_message.content
                        ) : (
                          'Connected on Nexus'
                        )}
                      </p>
                      {conv.unread_count && conv.unread_count > 0 ? (
                        <span className="shrink-0 ml-2 px-2 py-0.5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-dark-950 text-[10px] font-black shadow-md shadow-gold-500/30">
                          {conv.unread_count}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 👑 Right Main Chat View (Full Royal Screen) */}
      <div className={`lg:col-span-8 h-full ${selectedUser ? 'block' : 'hidden lg:block'}`}>
        {selectedUser ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 h-full min-h-0">
              <ChatRoom
                otherUser={selectedUser}
                onBack={() => setSelectedUser(null)}
                onViewProfile={onViewProfile}
                onNavigateToSubscription={onNavigateToSubscription}
              />
            </div>
          </div>
        ) : (
          /* Empty / Welcome State Hero */
          <div className="h-full flex flex-col items-center justify-center p-8 bg-dark-900 border border-gold-500/20 rounded-3xl text-center shadow-2xl royal-card">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-dark-950 shadow-xl shadow-gold-500/30 mb-6 animate-pulse-subtle">
              <Crown className="w-8 h-8 fill-dark-950" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2">
              Welcome to <span className="gold-gradient-text">Nexus Royal</span>
            </h3>
            <p className="text-xs sm:text-sm text-dark-300 max-w-md mx-auto mb-6 leading-relaxed">
              Select a member from the sidebar or browse the Royal Directory to start ultra-fast messaging and 4K WebRTC video calls.
            </p>
            <button
              type="button"
              onClick={onNavigateToDirectory}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black text-xs shadow-xl shadow-gold-500/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
              <Compass className="w-4 h-4 stroke-[2.5]" />
              <span>Explore Royal Community</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
