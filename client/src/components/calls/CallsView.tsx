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
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-900 border border-dark-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Phone className="w-5 h-5 text-emerald-400" />
            Call History
          </h2>
          <p className="text-xs text-dark-400 mt-1">Review all your past high-definition audio and video calls.</p>
        </div>

        {/* Filter Switcher */}
        <div className="flex items-center gap-2 bg-dark-800 p-1 rounded-xl border border-dark-700/80">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'all' ? 'bg-brand-600 text-white shadow-sm' : 'text-dark-400 hover:text-white'
            }`}
          >
            All Calls ({callLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('missed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'missed' ? 'bg-rose-600 text-white shadow-sm' : 'text-dark-400 hover:text-white'
            }`}
          >
            Missed / Declined
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-dark-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by contact name..."
          className="w-full pl-10 pr-4 py-2.5 bg-dark-900 border border-dark-800 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500"
        />
      </div>

      {/* Call Logs List */}
      <div className="bg-dark-900 border border-dark-800 rounded-2xl overflow-hidden shadow-xl divide-y divide-dark-800/60">
        {loading ? (
          <div className="p-12 text-center text-xs text-dark-500">Loading call history...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <Phone className="w-8 h-8 text-dark-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-dark-300">No calls in this view</p>
            <p className="text-xs text-dark-500 mt-1">Start an audio or video call with any contact from messages or directory.</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isCaller = log.caller_id === user?.id;
            const peer = isCaller ? log.receiver : log.caller;
            if (!peer) return null;

            const isMissed = log.status === 'missed' || log.status === 'rejected';
            const isOnline = onlineUserIds.has(peer.id);

            return (
              <div
                key={log.id}
                className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-dark-800/40 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <Avatar
                    src={peer.avatar_url}
                    name={peer.full_name}
                    size="md"
                    isOnline={isOnline}
                    showOnlineStatus
                    planId={peer.plan_id}
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white truncate">{peer.full_name}</p>
                      <PlanBadge planId={peer.plan_id} size="sm" />
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs">
                      {/* Call Status Icon */}
                      {isCaller ? (
                        <span className="text-brand-400 flex items-center gap-1">
                          <PhoneOutgoing className="w-3 h-3" /> Outgoing {log.call_type}
                        </span>
                      ) : isMissed ? (
                        <span className="text-rose-400 flex items-center gap-1 font-medium">
                          <PhoneMissed className="w-3 h-3" /> Missed {log.call_type}
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <PhoneIncoming className="w-3 h-3" /> Incoming {log.call_type}
                        </span>
                      )}

                      <span className="text-dark-600">•</span>
                      <span className="text-dark-400">{formatDate(log.started_at)}</span>

                      {log.duration > 0 && (
                        <>
                          <span className="text-dark-600">•</span>
                          <span className="text-dark-300 font-mono text-[11px]">{formatDuration(log.duration)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Call Back Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startCall(peer, 'audio')}
                    className="p-2.5 rounded-xl bg-dark-800 hover:bg-emerald-500/20 text-dark-300 hover:text-emerald-400 border border-dark-700/80 hover:border-emerald-500/40 transition-all shadow-sm"
                    title={`Call ${peer.full_name}`}
                  >
                    <Phone className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => startCall(peer, 'video')}
                    className="p-2.5 rounded-xl bg-dark-800 hover:bg-brand-500/20 text-dark-300 hover:text-brand-400 border border-dark-700/80 hover:border-brand-500/40 transition-all shadow-sm"
                    title={`Video call ${peer.full_name}`}
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
