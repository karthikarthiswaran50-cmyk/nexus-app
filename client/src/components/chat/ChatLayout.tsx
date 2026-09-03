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
      
      // If no initial user selected and conversations exist, default to first or keep empty
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
    <div className="h-[calc(100dvh-4rem)] md:h-[calc(100dvh-5rem)] grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-4 p-0 sm:p-4 lg:p-6 overflow-hidden max-w-7xl mx-auto w-full">
      
      {/* Left Sidebar: Conversations list */}
      <div
        className={`lg:col-span-4 h-full flex flex-col bg-dark-900 border-0 sm:border border-dark-800 rounded-none sm:rounded-2xl overflow-hidden shadow-xl ${
          selectedUser ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-dark-800 bg-dark-900/90 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-400" />
              Messages
            </h2>
            <button
              type="button"
              onClick={onNavigateToDirectory}
              className="p-2 rounded-xl bg-brand-600/20 hover:bg-brand-600 text-brand-400 hover:text-white border border-brand-500/30 transition-all text-xs font-semibold flex items-center gap-1.5"
              title="Start New Chat"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats or username..."
              className="w-full pl-9 pr-4 py-2 bg-dark-800 border border-dark-700/80 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500 transition-all"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-dark-800/40">
          {loading ? (
            <div className="p-8 text-center text-xs text-dark-500">Loading chats...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-8 h-8 text-dark-600 mx-auto mb-2" />
              <p className="text-xs text-dark-400 mb-3">No conversations found</p>
              <button
                type="button"
                onClick={onNavigateToDirectory}
                className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-500 transition-all"
              >
                Browse Members Directory
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
                  className={`w-full p-3 rounded-xl flex items-center gap-3 text-left transition-all group ${
                    isSelected
                      ? 'bg-brand-600/20 border border-brand-500/40 shadow-inner'
                      : 'hover:bg-dark-800/80 border border-transparent'
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
                      <p className="text-sm font-semibold text-white truncate">{other.full_name}</p>
                      <span className="text-[10px] text-dark-400 shrink-0">
                        {formatLastMessageTime(conv.last_message?.created_at || conv.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-dark-400 truncate">
                        {conv.last_message ? conv.last_message.content : 'Started a conversation'}
                      </p>
                      {conv.unread_count && conv.unread_count > 0 ? (
                        <span className="shrink-0 ml-2 px-1.5 py-0.5 rounded-full bg-brand-500 text-white text-[10px] font-bold">
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

      {/* Right Main Chat View */}
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
          <div className="h-full flex flex-col items-center justify-center p-8 bg-dark-900 border border-dark-800 rounded-2xl text-center shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-accent-violet flex items-center justify-center text-white shadow-xl shadow-brand-500/20 mb-6 animate-pulse-subtle">
              <Video className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              Welcome to Nexus Platform
            </h2>
            <p className="text-sm text-dark-400 max-w-md mb-8 leading-relaxed">
              Select a conversation from the sidebar or find members in the directory to start real-time messaging, audio calls, and HD video calls.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
              <button
                type="button"
                onClick={onNavigateToDirectory}
                className="p-4 rounded-xl bg-dark-800 hover:bg-dark-700 border border-dark-700 hover:border-brand-500/40 text-left transition-all group"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <Compass className="w-5 h-5 text-brand-400 group-hover:scale-110 transition-transform" />
                  <h4 className="text-sm font-semibold text-white">Find Members</h4>
                </div>
                <p className="text-xs text-dark-400">Discover active creators, developers & team members.</p>
              </button>

              <button
                type="button"
                onClick={onNavigateToSubscription}
                className="p-4 rounded-xl bg-dark-800 hover:bg-dark-700 border border-dark-700 hover:border-amber-500/40 text-left transition-all group"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <Sparkles className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                  <h4 className="text-sm font-semibold text-white">Unlock Pro Tier</h4>
                </div>
                <p className="text-xs text-dark-400">Get unlimited HD video calling, screen sharing, & badges.</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
