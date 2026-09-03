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
} from 'lucide-react';
import axios from 'axios';

interface DirectoryViewProps {
  onStartChat: (user: User) => void;
  onViewProfile: (user: User) => void;
}

export const DirectoryView: React.FC<DirectoryViewProps> = ({ onStartChat, onViewProfile }) => {
  const { user: currentUser } = useAuth();
  const { startCall, onlineUserIds } = useSocket();

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
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-dark-900 via-brand-950/40 to-dark-900 border border-dark-800 p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30">
              <Users className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Member Network</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Connect & Call with Members
          </h1>
          <p className="text-xs sm:text-sm text-dark-300 mt-1 max-w-xl">
            Explore active creators, developers, designers and team members. Initiate instant 1-on-1 audio/video calls or real-time messaging.
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-2 bg-dark-900/90 p-1.5 rounded-2xl border border-dark-700/80 shadow-inner">
          <button
            type="button"
            onClick={() => setTierFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              tierFilter === 'all' ? 'bg-brand-600 text-white shadow-md' : 'text-dark-400 hover:text-white'
            }`}
          >
            All Members
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('pro')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              tierFilter === 'pro' ? 'bg-indigo-600 text-white shadow-md' : 'text-dark-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3 text-brand-300" />
            Pro
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('vip')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              tierFilter === 'vip' ? 'bg-amber-600 text-white shadow-md' : 'text-dark-400 hover:text-white'
            }`}
          >
            <Crown className="w-3 h-3 text-amber-300" />
            VIP
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-dark-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, skill, username, or country..."
          className="w-full pl-11 pr-4 py-3 bg-dark-900 border border-dark-800 rounded-2xl text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
        />
      </div>

      {/* User Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-dark-500">Loading directory...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-16 text-center bg-dark-900 border border-dark-800 rounded-2xl">
          <Users className="w-10 h-10 text-dark-600 mx-auto mb-3" />
          <p className="text-base font-bold text-white">No members found</p>
          <p className="text-xs text-dark-400 mt-1">Try adjusting your search terms or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredUsers.map((member) => {
            const isOnline = onlineUserIds.has(member.id);

            return (
              <div
                key={member.id}
                className="bg-dark-900 border border-dark-800/90 rounded-2xl p-5 shadow-lg hover:border-dark-700 hover:shadow-2xl transition-all flex flex-col justify-between group"
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
                        showOnlineStatus
                        planId={member.plan_id}
                      />
                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-brand-400 transition-colors">
                          {member.full_name}
                        </h3>
                        <p className="text-xs text-dark-400">@{member.username}</p>
                      </div>
                    </div>
                    <PlanBadge planId={member.plan_id} size="sm" />
                  </div>

                  {/* Bio */}
                  <p className="text-xs text-dark-300 line-clamp-2 leading-relaxed mb-4">
                    {member.bio || 'Member on Nexus Platform.'}
                  </p>

                  {/* Status / Location */}
                  <div className="space-y-1.5 mb-6 text-[11px] text-dark-400">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                      <span className="truncate italic">{member.status || 'Active'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-dark-500">
                      <Globe className="w-3 h-3" />
                      <span>{member.country || 'Global'}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Controls */}
                <div className="pt-3 border-t border-dark-800/80 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onStartChat(member)}
                    className="py-2 px-2 rounded-xl bg-dark-800 hover:bg-brand-600/20 text-dark-300 hover:text-brand-300 border border-dark-700/80 hover:border-brand-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    title="Send Direct Message"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startCall(member, 'audio')}
                    className="py-2 px-2 rounded-xl bg-dark-800 hover:bg-emerald-500/20 text-dark-300 hover:text-emerald-300 border border-dark-700/80 hover:border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    title="Start Audio Call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Audio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startCall(member, 'video')}
                    className="py-2 px-2 rounded-xl bg-dark-800 hover:bg-brand-500/20 text-dark-300 hover:text-brand-300 border border-dark-700/80 hover:border-brand-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    title="Start Video Call"
                  >
                    <Video className="w-3.5 h-3.5" />
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
