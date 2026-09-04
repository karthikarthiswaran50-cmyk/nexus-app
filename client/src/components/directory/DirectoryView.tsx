import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { User, SubscriptionPlanId } from '../../types';
import { Avatar } from '../common/Avatar';
import { PlanBadge } from '../common/Badge';
import {
  Search,
  MessageSquare,
  Phone,
  Video,
  Users,
  Sparkles,
  Crown,
  Globe,
  Check,
  Gem,
} from 'lucide-react';
import axios from 'axios';

interface DirectoryViewProps {
  onStartChat: (user: User) => void;
  onViewProfile: (user: User) => void;
}

export const DirectoryView: React.FC<DirectoryViewProps> = ({ onStartChat, onViewProfile }) => {
  const { user: currentUser } = useAuth();
  const { startCall, onlineUserIds, reachableUserIds } = useSocket();

  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'pro' | 'vip'>('all');
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users');
      setUsers(res.data.users);
    } catch (err) {
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter((u) => {
    if (u.id === currentUser?.id) return false;

    const matchesSearch =
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.country?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (tierFilter === 'pro' && u.plan_id !== 'pro' && u.plan_id !== 'vip') return false;
    if (tierFilter === 'vip' && u.plan_id !== 'vip') return false;

    return true;
  });

  return (
    <div className="max-w-6xl mx-auto p-3.5 sm:p-6 space-y-6">
      
      {/* 👑 Royal Banner / Hero */}
      <div className="bg-gradient-to-r from-dark-900 via-amber-950/30 to-dark-900 border border-gold-500/25 p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 royal-card">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-gold-500/20 text-gold-400 border border-gold-500/30">
              <Crown className="w-4 h-4 fill-gold-400" />
            </span>
            <span className="text-xs font-black gold-gradient-text uppercase tracking-widest">Royal Member Realm</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Connect & Call with Imperial Members
          </h1>
          <p className="text-xs sm:text-sm text-dark-300 mt-1 max-w-xl leading-relaxed">
            Discover verified creators, founders, and VIPs. Initiate instant 4K WebRTC video calls, voice conversations, or encrypted chats.
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-2 bg-dark-950/90 p-1.5 rounded-2xl border border-gold-500/20 shadow-inner">
          <button
            type="button"
            onClick={() => setTierFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tierFilter === 'all' ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-dark-950 shadow-md' : 'text-dark-400 hover:text-white'
            }`}
          >
            All Members
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('pro')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              tierFilter === 'pro' ? 'bg-brand-600 text-white shadow-md' : 'text-dark-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Pro</span>
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('vip')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              tierFilter === 'vip' ? 'bg-gradient-to-r from-amber-600 to-yellow-500 text-dark-950 shadow-md' : 'text-dark-400 hover:text-white'
            }`}
          >
            <Crown className="w-3 h-3 fill-current" />
            <span>VIP</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-gold-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search members by name, skill, handle, or country..."
          className="w-full pl-11 pr-4 py-3 bg-dark-900 border border-gold-500/20 rounded-2xl text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/50 shadow-sm"
        />
      </div>

      {/* User Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-dark-500">Loading Royal Directory...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-16 text-center bg-dark-900 border border-gold-500/20 rounded-2xl royal-card">
          <Users className="w-10 h-10 text-dark-600 mx-auto mb-3" />
          <p className="text-base font-bold text-white">No members found</p>
          <p className="text-xs text-dark-400 mt-1">Try adjusting your search terms or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredUsers.map((member) => {
            const isOnline = onlineUserIds.has(member.id);
            const isReachable = reachableUserIds.has(member.id);

            return (
              <div
                key={member.id}
                className="bg-dark-900 border border-gold-500/20 rounded-2xl p-5 shadow-lg hover:border-gold-400/50 hover:shadow-2xl hover:scale-[1.01] transition-all flex flex-col justify-between group royal-card"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={member.avatar_url}
                        name={member.full_name}
                        size="lg"
                        isOnline={isOnline}
                        isReachable={isReachable}
                        showOnlineStatus
                        planId={member.plan_id}
                      />
                      <div>
                        <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors">
                          {member.full_name}
                        </h3>
                        <p className="text-xs text-dark-400 font-mono">@{member.username}</p>
                      </div>
                    </div>
                    <PlanBadge planId={member.plan_id} size="sm" />
                  </div>

                  {/* Bio */}
                  <p className="text-xs text-dark-300 line-clamp-2 leading-relaxed mb-4">
                    {member.bio || 'Verified member on Nexus Royal.'}
                  </p>

                  {/* Status / Location / Presence */}
                  <div className="space-y-1.5 mb-6 text-[11px] text-dark-400">
                    <div className="flex items-center gap-1.5">
                      {isOnline ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse" />
                          <span className="text-emerald-400 font-bold">Active Now</span>
                        </>
                      ) : isReachable ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                          <span className="text-amber-300 font-bold">Available on Mobile</span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-dark-600" />
                          <span className="truncate text-dark-400">{member.status || 'Offline'}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-dark-500">
                      <Globe className="w-3 h-3 text-gold-400" />
                      <span>{member.country || 'Global'}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Controls */}
                <div className="pt-3 border-t border-gold-500/15 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onStartChat(member)}
                    className="py-2 px-2 rounded-xl bg-dark-850 hover:bg-gold-500/15 text-dark-300 hover:text-amber-200 border border-gold-500/15 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    title="Send Direct Message"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startCall(member, 'audio')}
                    className="py-2 px-2 rounded-xl bg-dark-850 hover:bg-emerald-500/15 text-dark-300 hover:text-emerald-300 border border-gold-500/15 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    title="Audio Call"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Call</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startCall(member, 'video')}
                    className="py-2 px-2 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md shadow-gold-500/20 active:scale-95"
                    title="4K Video Call"
                  >
                    <Video className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Video</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
