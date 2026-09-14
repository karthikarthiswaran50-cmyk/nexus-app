import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { Conversation, User, Group } from '../../types';
import { Avatar } from '../common/Avatar';
import { PlanBadge } from '../common/Badge';
import { ChatRoom } from './ChatRoom';
import { StoriesBar } from '../stories/StoriesBar';
import { CreateGroupModal } from './CreateGroupModal';
import {
  Search,
  MessageSquare,
  Plus,
  Video,
  Phone,
  Users,
  Compass,
  Crown,
  UserPlus,
} from 'lucide-react';
import axios from 'axios';

interface ChatLayoutProps {
  onNavigateToDirectory: () => void;
  onNavigateToSubscription?: () => void;
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
  const { onlineUserIds, reachableUserIds, latestMessage } = useSocket();

  const [chatTab, setChatTab] = useState<'direct' | 'groups'>('direct');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(initialSelectedUser || null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    try {
      const res = await axios.get('/api/chat/conversations');
      setConversations(res.data.conversations);
      
      // If no initial user selected and conversations exist, default to first on desktop
      if (!selectedUser && !selectedGroup && !initialSelectedUser && res.data.conversations.length > 0 && window.innerWidth >= 1024) {
        setSelectedUser(res.data.conversations[0].other_user || null);
      }
    } catch (err) {
      console.error('Fetch conversations failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await axios.get('/api/groups');
      setGroups(res.data.groups || []);
    } catch (err) {
      console.error('Fetch groups failed:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchGroups();
  }, []);

  useEffect(() => {
    if (initialSelectedUser) {
      setSelectedUser(initialSelectedUser);
    }
  }, [initialSelectedUser]);

  // Update conversation list optimistically when a new message arrives
  useEffect(() => {
    if (!latestMessage) return;
    const now = latestMessage.created_at || new Date().toISOString();
    setConversations(prev => {
      const otherId = latestMessage.sender_id === user?.id
        ? latestMessage.receiver_id
        : latestMessage.sender_id;

      const existingIdx = prev.findIndex(c =>
        c.other_user?.id === otherId
      );

      if (existingIdx === -1) {
        // New conversation — do a full fetch to pick up the new entry
        fetchConversations();
        return prev;
      }

      // Update existing conversation in place and bubble it to the top
      const updated = [...prev];
      const conv = { ...updated[existingIdx] };
      conv.last_message = latestMessage;
      conv.last_message_at = now;
      if (latestMessage.sender_id !== user?.id) {
        conv.unread_count = (conv.unread_count || 0) + 1;
      }
      updated.splice(existingIdx, 1);
      updated.unshift(conv);
      return updated;
    });
  }, [latestMessage, user?.id]);

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
      
      {/* 👑 Left Sidebar: Conversations & Groups list (Royal Obsidian Glass) */}
      <div
        className={`lg:col-span-4 h-full flex flex-col bg-dark-900 border-0 sm:border border-gold-500/20 rounded-none sm:rounded-3xl overflow-hidden shadow-2xl royal-card ${
          selectedUser || selectedGroup ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-gold-500/15 bg-dark-900/95 backdrop-blur-2xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-gold-400 fill-gold-400" />
              <span className="gold-gradient-text">Messages</span>
            </h2>
            {chatTab === 'direct' ? (
              <button
                type="button"
                onClick={onNavigateToDirectory}
                className="p-2 px-3 rounded-xl bg-gold-500/15 hover:bg-gold-500/25 text-amber-200 border border-gold-500/30 transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95"
                title="Start New Chat"
              >
                <Plus className="w-4 h-4 text-gold-400 stroke-[2.5]" />
                <span>New Chat</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreateGroupOpen(true)}
                className="p-2 px-3 rounded-xl bg-gold-500/15 hover:bg-gold-500/25 text-amber-200 border border-gold-500/30 transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95"
                title="Create New Group"
              >
                <Plus className="w-4 h-4 text-gold-400 stroke-[2.5]" />
                <span>New Group</span>
              </button>
            )}
          </div>

          {/* Tab Switcher: Direct Chats vs Groups */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-dark-950/80 rounded-xl border border-gold-500/10 mb-3">
            <button
              type="button"
              onClick={() => setChatTab('direct')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                chatTab === 'direct'
                  ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-gold-400/40 shadow-sm'
                  : 'text-dark-400 hover:text-white hover:bg-dark-850'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Direct Chats</span>
            </button>
            <button
              type="button"
              onClick={() => setChatTab('groups')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                chatTab === 'groups'
                  ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-gold-400/40 shadow-sm'
                  : 'text-dark-400 hover:text-white hover:bg-dark-850'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Groups ({groups.length})</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gold-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={chatTab === 'direct' ? "Search chats or @handle..." : "Search groups..."}
              className="w-full pl-9 pr-4 py-2 bg-dark-850 border border-gold-500/15 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/50 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Stories & 24h Status Bar (Only on Direct Chats tab) */}
        {chatTab === 'direct' && <StoriesBar />}

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-dark-800/40">
          {chatTab === 'direct' ? (
            loading ? (
              <div className="p-8 text-center text-xs text-dark-500">Loading chats...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <Users className="w-7 h-7 text-dark-600 mx-auto" />
                <p className="text-xs text-dark-400">No active conversations found</p>
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onNavigateToDirectory}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-dark-950 text-xs font-black shadow-lg shadow-gold-500/25 hover:scale-105 transition-all flex items-center justify-center gap-2"
                  >
                    <Users className="w-3.5 h-3.5 text-dark-950" />
                    <span>Browse Members</span>
                  </button>
                </div>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const other = conv.other_user;
                if (!other) return null;

                const isOnline = onlineUserIds.has(other.id);
                const isReachable = reachableUserIds.has(other.id);
                const isSelected = selectedUser?.id === other.id;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(other);
                      setSelectedGroup(null);
                      // Clear unread badge immediately on selection
                      setConversations(prev => prev.map(c =>
                        c.id === conv.id ? { ...c, unread_count: 0 } : c
                      ));
                    }}
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
                      isReachable={isReachable}
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
            )
          ) : (
            /* Groups tab */
            groups.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <Users className="w-8 h-8 text-gold-500/60 mx-auto" />
                <p className="text-xs text-dark-300 font-bold">No groups created yet</p>
                <p className="text-[11px] text-dark-500">Create a group to chat with multiple members together</p>
                <button
                  type="button"
                  onClick={() => setIsCreateGroupOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-dark-950 text-xs font-black shadow-md hover:scale-105 transition-all inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Group</span>
                </button>
              </div>
            ) : (
              groups
                .filter(g => !searchQuery || g.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((g) => {
                  const isSelected = selectedGroup?.id === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroup(g);
                        setSelectedUser(null);
                      }}
                      className={`w-full p-3 rounded-2xl flex items-center gap-3 text-left transition-all group ${
                        isSelected
                          ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-transparent border border-gold-400/40 shadow-inner'
                          : 'hover:bg-dark-850/80 border border-transparent'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/20 border border-gold-500/30 flex items-center justify-center shrink-0 text-amber-300">
                        {g.avatar_url ? (
                          <img src={g.avatar_url} alt={g.name} className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                          <Users className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-sm font-extrabold text-white truncate group-hover:text-amber-200 transition-colors">
                            {g.name}
                          </p>
                          <span className="text-[10px] text-dark-400 shrink-0 font-mono">
                            {formatLastMessageTime(g.last_message_at || g.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-dark-400 truncate">
                            {g.description || `${g.member_count || 1} members`}
                          </p>
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-dark-800 text-gold-400 border border-gold-500/20 font-bold">
                            {g.member_count || 1} members
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
            )
          )}
        </div>
      </div>

      {/* 👑 Right Main Chat View (Full Screen on Mobile when selected) */}
      <div className={`lg:col-span-8 h-full ${selectedUser || selectedGroup ? 'block' : 'hidden lg:block'}`}>
        {selectedGroup ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 h-full min-h-0">
              <ChatRoom
                group={selectedGroup}
                onBack={() => setSelectedGroup(null)}
              />
            </div>
          </div>
        ) : selectedUser ? (
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
              Welcome to <span className="gold-gradient-text">Nexus</span>
            </h3>
            <p className="text-xs sm:text-sm text-dark-300 max-w-md mx-auto mb-6 leading-relaxed">
              Nexus is Free Forever ♾️. Select a member or group from the sidebar, or start a new conversation for ultra-fast messaging and HD WebRTC calls.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onNavigateToDirectory}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black text-xs shadow-xl shadow-gold-500/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                <Compass className="w-4 h-4 stroke-[2.5]" />
                <span>Explore Community</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCreateGroupOpen(true)}
                className="px-6 py-3 rounded-2xl bg-dark-800 hover:bg-dark-750 text-amber-300 border border-gold-500/30 font-black text-xs shadow-xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                <Users className="w-4 h-4 stroke-[2.5]" />
                <span>Create Group</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={(g) => {
          fetchGroups();
          setSelectedGroup(g);
          setSelectedUser(null);
          setChatTab('groups');
        }}
      />
    </div>
  );
};
