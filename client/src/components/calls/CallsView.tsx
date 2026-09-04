import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { CallLog, User } from '../../types';
import { Avatar } from '../common/Avatar';
import { PlanBadge } from '../common/Badge';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  Crown,
} from 'lucide-react';
import axios from 'axios';

interface CallsViewProps {
  onStartChat: (user: User) => void;
  onViewProfile: (user: User) => void;
}

export const CallsView: React.FC<CallsViewProps> = ({ onStartChat, onViewProfile }) => {
  const { user } = useAuth();
  const { startCall, onlineUserIds } = useSocket();

  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCalls = async () => {
    try {
      const res = await axios.get('/api/calls/history');
      setCallLogs(res.data.callLogs);
    } catch (err) {
      console.error('Fetch calls error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const filteredLogs = callLogs.filter((log) => {
    const isCaller = log.caller_id === user?.id;
    const peer = isCaller ? log.receiver : log.caller;
    const peerName = peer?.full_name?.toLowerCase() || '';

    if (searchQuery && !peerName.includes(searchQuery.toLowerCase())) {
      return false;
    }

    if (filter === 'missed') {
      return log.status === 'missed' || log.status === 'rejected';
    }

    return true;
  });

  return (
    <div className="max-w-4xl mx-auto p-3.5 sm:p-6 space-y-6">
      
      {/* 👑 Royal Calls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-900 border border-gold-500/20 p-6 rounded-3xl shadow-xl royal-card">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-gold-400 fill-gold-400" />
            <span className="gold-gradient-text">Royal Call Logs</span>
          </h2>
          <p className="text-xs text-dark-300 mt-1">Review all your past 4K WebRTC video calls and encrypted voice sessions.</p>
        </div>

        {/* Filter Switcher */}
        <div className="flex items-center gap-2 bg-dark-950 p-1.5 rounded-2xl border border-gold-500/20 shadow-inner">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'all' ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-dark-950 shadow-md' : 'text-dark-400 hover:text-white'
            }`}
          >
            All Calls
          </button>
          <button
            type="button"
            onClick={() => setFilter('missed')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'missed' ? 'bg-rose-500 text-white shadow-md' : 'text-dark-400 hover:text-white'
            }`}
          >
            Missed
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
          placeholder="Search call logs by contact name..."
          className="w-full pl-11 pr-4 py-2.5 bg-dark-900 border border-gold-500/20 rounded-2xl text-xs sm:text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/50"
        />
      </div>

      {/* Call List */}
      <div className="bg-dark-900 border border-gold-500/20 rounded-3xl overflow-hidden shadow-xl royal-card">
        {loading ? (
          <div className="p-12 text-center text-xs text-dark-500">Loading call history...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-dark-400 space-y-2">
            <Phone className="w-8 h-8 mx-auto text-dark-600" />
            <p className="text-sm font-bold text-white">No call history recorded yet</p>
            <p className="text-xs text-dark-500">Make an audio or video call to a member to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-800/60">
            {filteredLogs.map((log) => {
              const isCaller = log.caller_id === user?.id;
              const peer = isCaller ? log.receiver : log.caller;
              if (!peer) return null;

              const isMissed = log.status === 'missed' || log.status === 'rejected';
              const isOnline = onlineUserIds.has(peer.id);

              return (
                <div
                  key={log.id}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-dark-850/60 transition-colors group"
                >
                  <div className="flex items-center gap-3.5">
                    <Avatar
                      src={peer.avatar_url}
                      name={peer.full_name}
                      size="md"
                      isOnline={isOnline}
                      showOnlineStatus
                      planId={peer.plan_id}
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold text-white group-hover:text-amber-200 transition-colors">
                          {peer.full_name}
                        </h4>
                        <PlanBadge planId={peer.plan_id} size="sm" />
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-dark-400">
                        {isMissed ? (
                          <span className="flex items-center gap-1 text-rose-400 font-bold">
                            <PhoneMissed className="w-3.5 h-3.5" /> Missed
                          </span>
                        ) : isCaller ? (
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <PhoneOutgoing className="w-3.5 h-3.5" /> Outgoing
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-cyan-400 font-medium">
                            <PhoneIncoming className="w-3.5 h-3.5" /> Incoming
                          </span>
                        )}

                        <span>•</span>
                        <span className="text-[11px] font-mono text-dark-400">{formatDate(log.started_at)}</span>

                        {log.duration > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-[11px] font-mono text-amber-200/80">{formatDuration(log.duration)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Direct Call Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startCall(peer, 'audio')}
                      className="p-2.5 rounded-xl bg-dark-850 hover:bg-emerald-500/15 text-dark-300 hover:text-emerald-300 border border-gold-500/15 transition-all shadow-xs"
                      title="Direct Audio Call"
                    >
                      <Phone className="w-4 h-4 text-emerald-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => startCall(peer, 'video')}
                      className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-dark-950 shadow-md shadow-gold-500/20 hover:scale-105 transition-all active:scale-95"
                      title="4K Video Call"
                    >
                      <Video className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
