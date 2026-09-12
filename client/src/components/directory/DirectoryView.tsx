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
  const [loading, setLoading] = useState(false);

  // Instagram-style: Debounced search by @username or name + initial members loading
  useEffect(() => {
    const q = searchQuery.trim();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const url = q ? `/api/users?q=${encodeURIComponent(q)}` : '/api/users';
        const res = await axios.get(url);
        setUsers(res.data.users || []);
      } catch (err) {
        console.error('Search users error:', err);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }, q ? 280 : 0);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredUsers = users.filter((u) => {
    if (tierFilter === 'pro' && u.plan_id !== 'pro' && u.plan_id !== 'vip') return false;
    if (tierFilter === 'vip' && u.plan_id !== 'vip') return false;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto p-3.5 sm:p-6 space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      
      {/* 👑 Royal Banner / Search Header */}
      <div className="bg-gradient-to-r from-dark-900 via-amber-950/30 to-dark-900 border border-gold-500/25 p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 royal-card">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-gold-500/20 text-gold-400 border border-gold-500/30">
              <Crown className="w-4 h-4 fill-gold-400" />
            </span>
            <span className="text-xs font-black gold-gradient-text uppercase tracking-widest">Nexus Royal Search</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Find Members by @Username
          </h1>
          <p className="text-xs sm:text-sm text-dark-300 mt-1 max-w-xl leading-relaxed">
            Search for your friends by their unique handle or name to start an encrypted chat, voice call, or 4K video session.
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
            All
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

      {/* Royal Search Bar */}
      <div className="relative">
        <Search className="w-5 h-5 text-gold-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          autoFocus
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by username or name (@karthi, alex, etc.)..."
          className="w-full pl-12 pr-10 py-3.5 bg-dark-900 border border-gold-500/30 rounded-2xl text-sm font-semibold text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 shadow-lg transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white text-xs flex items-center justify-center transition-all"
          >
            ✕
          </button>
        )}
      </div>

      {/* User Grid / States */}
      {loading ? (
        <div className="p-16 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-dark-400 font-bold">Loading Royal directory...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        /* No Results Found */
        <div className="p-12 sm:p-16 text-center bg-dark-900/60 border border-gold-500/15 rounded-3xl royal-card space-y-3 max-w-lg mx-auto">
          <Users className="w-12 h-12 text-dark-600 mx-auto" />
          <p className="text-base font-bold text-white">
            {searchQuery.trim() ? `No members found for "${searchQuery}"` : 'No members found'}
          </p>
          <p className="text-xs text-dark-400">
            {searchQuery.trim()
              ? 'Make sure the @username or name is spelled correctly.'
              : 'Registered members will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black gold-gradient-text uppercase tracking-widest">
              {searchQuery.trim() ? `Search Results (${filteredUsers.length})` : `Community Members (${filteredUsers.length})`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredUsers.map((member) => {
              const isOnline = onlineUserIds.has(member.id);
              const isReachable = reachableUserIds.has(member.id);
              const isSelf = member.id === currentUser?.id;

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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors">
                              {member.full_name}
                            </h3>
                            {isSelf && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                YOU
                              </span>
                            )}
                          </div>
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
                  {isSelf ? (
                    <div className="pt-3 border-t border-gold-500/15">
                      <button
                        type="button"
                        onClick={() => onViewProfile(member)}
                        className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-600/20 hover:bg-gold-500/30 text-amber-300 border border-gold-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        <Crown className="w-3.5 h-3.5 text-gold-400" />
                        <span>View / Edit Your Profile</span>
                      </button>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-gold-500/15 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => onStartChat(member)}
                        className="py-2 px-2 rounded-xl bg-dark-850 hover:bg-gold-500/15 text-dark-300 hover:text-amber-200 border border-gold-500/15 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        title="Send Direct Message"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => startCall(member, 'audio')}
                        className="py-2 px-2 rounded-xl bg-dark-850 hover:bg-emerald-500/15 text-dark-300 hover:text-emerald-300 border border-gold-500/15 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        title="Audio Call"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Call</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => startCall(member, 'video')}
                        className="py-2 px-2 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md shadow-gold-500/20 active:scale-95 cursor-pointer"
                        title="4K Video Call"
                      >
                        <Video className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Video</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
