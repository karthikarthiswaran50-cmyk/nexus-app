import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Crown,
  Users,
  BarChart3,
  Megaphone,
  UserX,
  UserCheck,
  Trash2,
  Search,
  RefreshCw,
  Send,
  Radio,
  Database,
  Server,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  PhoneCall,
  MessageSquare,
  Flame,
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';

interface AdminStats {
  totalUsers: number;
  bannedUsers: number;
  adminCount: number;
  totalMessages: number;
  totalCalls: number;
  totalStories: number;
  onlineUsers: number;
  serverUptimeSeconds: number;
  dbType: string;
}

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'overview' | 'users' | 'broadcast' | 'security';

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({ isOpen, onClose }) => {
  const { user: currentUser, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Stats State
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Users State
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Broadcast State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState<'info' | 'alert'>('info');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const [recentAnnouncements, setRecentAnnouncements] = useState<any[]>([]);

  // Passcode Claim State
  const [claimPasscode, setClaimPasscode] = useState('');
  const [claimingRole, setClaimingRole] = useState(false);
  const [claimMessage, setClaimMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Change Passcode State
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [savingPasscode, setSavingPasscode] = useState(false);
  const [passcodeSuccessMsg, setPasscodeSuccessMsg] = useState<string | null>(null);
  const [passcodeErrorMsg, setPasscodeErrorMsg] = useState<string | null>(null);

  // Fetch Stats
  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await axios.get('/api/admin/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch Users
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await axios.get('/api/admin/users');
      setUsersList(res.data.users || []);
    } catch (err) {
      console.error('Failed to load users list:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch Announcements
  const fetchAnnouncements = async () => {
    try {
      const res = await axios.get('/api/admin/announcements');
      setRecentAnnouncements(res.data.announcements || []);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (currentUser?.role === 'admin') {
        fetchStats();
        fetchUsers();
        fetchAnnouncements();
      }
    }
  }, [isOpen, currentUser?.role]);

  if (!isOpen) return null;

  // Toggle Ban User
  const handleToggleBan = async (user: User) => {
    const isBanning = !user.is_banned;
    const confirmMsg = isBanning
      ? `Are you sure you want to suspend @${user.username}? They will be logged out and cannot login.`
      : `Unban @${user.username} and restore access?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setActionLoadingId(user.id);
      await axios.post(`/api/admin/users/${user.id}/ban`);
      setUsersList((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_banned: isBanning ? 1 : 0 } : u))
      );
      if (stats) {
        setStats({
          ...stats,
          bannedUsers: isBanning ? stats.bannedUsers + 1 : Math.max(0, stats.bannedUsers - 1),
        });
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user ban status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Toggle Role
  const handleToggleRole = async (user: User) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const confirmMsg =
      newRole === 'admin'
        ? `Grant Royal Admin privileges to @${user.username}?`
        : `Demote @${user.username} to regular Member?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setActionLoadingId(user.id);
      await axios.post(`/api/admin/users/${user.id}/role`, { role: newRole });
      setUsersList((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      );
      if (stats) {
        setStats({
          ...stats,
          adminCount: newRole === 'admin' ? stats.adminCount + 1 : Math.max(1, stats.adminCount - 1),
        });
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user role.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete User
  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`⚠️ PERMANENT ACTION: Completely delete @${user.username} and all their messages/chats?`)) return;

    try {
      setActionLoadingId(user.id);
      await axios.delete(`/api/admin/users/${user.id}`);
      setUsersList((prev) => prev.filter((u) => u.id !== user.id));
      if (stats) {
        setStats({ ...stats, totalUsers: Math.max(0, stats.totalUsers - 1) });
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete user.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Broadcast Announcement
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    try {
      setSendingBroadcast(true);
      const res = await axios.post('/api/admin/broadcast', {
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        type: broadcastType,
      });

      setBroadcastSuccess(true);
      setBroadcastTitle('');
      setBroadcastMessage('');
      if (res.data?.announcement) {
        setRecentAnnouncements((prev) => [res.data.announcement, ...prev]);
      }
      setTimeout(() => setBroadcastSuccess(false), 4000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send broadcast announcement.');
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Claim Owner Passcode
  const handleClaimOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimPasscode.trim()) return;

    try {
      setClaimingRole(true);
      setClaimMessage(null);
      const res = await axios.post('/api/admin/claim', { passcode: claimPasscode.trim() });
      setClaimMessage({ type: 'success', text: res.data.message || 'Owner verified successfully!' });
      await refreshUser();
      fetchStats();
      fetchUsers();
    } catch (err: any) {
      setClaimMessage({
        type: 'error',
        text: err.response?.data?.error || 'Incorrect Master Passcode. Access denied.',
      });
    } finally {
      setClaimingRole(false);
    }
  };

  // Change Owner Passcode
  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeSuccessMsg(null);
    setPasscodeErrorMsg(null);

    if (!newPasscode.trim()) {
      setPasscodeErrorMsg('Please enter a new passcode.');
      return;
    }

    if (newPasscode.trim().length < 4) {
      setPasscodeErrorMsg('Passcode must be at least 4 characters long.');
      return;
    }

    if (newPasscode !== confirmPasscode) {
      setPasscodeErrorMsg('New passcodes do not match.');
      return;
    }

    try {
      setSavingPasscode(true);
      const res = await axios.post('/api/admin/change-passcode', {
        newPasscode: newPasscode.trim(),
      });
      setPasscodeSuccessMsg(res.data.message || 'Master Passcode updated successfully!');
      setNewPasscode('');
      setConfirmPasscode('');
    } catch (err: any) {
      setPasscodeErrorMsg(err.response?.data?.error || 'Failed to update passcode.');
    } finally {
      setSavingPasscode(false);
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-dark-950/85 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-4xl bg-dark-900 border border-gold-500/25 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] royal-card">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-dark-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-400 flex items-center justify-center text-dark-950 shadow-lg shadow-gold-500/30">
              <Shield className="w-5 h-5 fill-dark-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  <span className="gold-gradient-text">Royal Command Center</span>
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Owner Panel
                </span>
              </div>
              <p className="text-xs text-dark-400 mt-0.5">Manage users, live analytics, and system broadcasts</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-2.5 bg-dark-950/50 border-b border-white/5 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-600/20 text-amber-300 border border-gold-500/30 shadow-sm'
                : 'text-dark-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Overview & Stats</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-600/20 text-amber-300 border border-gold-500/30 shadow-sm'
                : 'text-dark-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users Management ({usersList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('broadcast')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'broadcast'
                ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-600/20 text-amber-300 border border-gold-500/30 shadow-sm'
                : 'text-dark-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>Global Broadcast</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'security'
                ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-600/20 text-amber-300 border border-gold-500/30 shadow-sm'
                : 'text-dark-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Owner Access</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Platform Health & Live Statistics</span>
                </h4>
                <button
                  type="button"
                  onClick={fetchStats}
                  disabled={loadingStats}
                  className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/30 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Grid Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-dark-950/70 border border-gold-500/15 space-y-1">
                  <div className="flex items-center justify-between text-dark-400 text-xs font-bold">
                    <span>Total Members</span>
                    <Users className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white">{stats?.totalUsers ?? '...'}</div>
                  <div className="text-[11px] text-dark-400">{stats?.adminCount ?? 0} Admins / Owners</div>
                </div>

                <div className="p-4 rounded-2xl bg-dark-950/70 border border-gold-500/15 space-y-1">
                  <div className="flex items-center justify-between text-dark-400 text-xs font-bold">
                    <span>Online Now</span>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-400">{stats?.onlineUsers ?? '...'}</div>
                  <div className="text-[11px] text-dark-400">Active Real-Time Sockets</div>
                </div>

                <div className="p-4 rounded-2xl bg-dark-950/70 border border-gold-500/15 space-y-1">
                  <div className="flex items-center justify-between text-dark-400 text-xs font-bold">
                    <span>Total Messages</span>
                    <MessageSquare className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white">{stats?.totalMessages ?? '...'}</div>
                  <div className="text-[11px] text-dark-400">Encrypted Chat Messages</div>
                </div>

                <div className="p-4 rounded-2xl bg-dark-950/70 border border-gold-500/15 space-y-1">
                  <div className="flex items-center justify-between text-dark-400 text-xs font-bold">
                    <span>Calls Connected</span>
                    <PhoneCall className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white">{stats?.totalCalls ?? '...'}</div>
                  <div className="text-[11px] text-dark-400">WebRTC Audio & Video</div>
                </div>
              </div>

              {/* Server & DB Status */}
              <div className="p-4 sm:p-5 rounded-2xl bg-dark-950/60 border border-white/10 space-y-3">
                <h5 className="text-xs font-black text-amber-300 uppercase tracking-wider">Infrastructure Status</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-dark-900 border border-white/5">
                    <Database className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-white font-bold">Primary Database Engine</div>
                      <div className="text-dark-400 text-[11px] mt-0.5">{stats?.dbType || 'PostgreSQL'}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-dark-900 border border-white/5">
                    <Server className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-white font-bold">Server Runtime Uptime</div>
                      <div className="text-dark-400 text-[11px] mt-0.5">
                        {stats?.serverUptimeSeconds ? formatUptime(stats.serverUptimeSeconds) : 'Active'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search member by name, username, email..."
                    className="w-full bg-dark-950 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-dark-500 focus:outline-none focus:border-gold-500/50"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={fetchUsers}
                  disabled={loadingUsers}
                  className="flex items-center justify-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2.5 rounded-xl border border-amber-500/30 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                  <span>Refresh Users</span>
                </button>
              </div>

              {/* Users List */}
              <div className="space-y-2.5">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-12 text-dark-400 text-xs">
                    {searchQuery ? 'No members found matching your search.' : 'No members registered yet.'}
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isBanned = Boolean(u.is_banned);
                    const isAdmin = u.role === 'admin';
                    const isSelf = u.id === currentUser?.id;

                    return (
                      <div
                        key={u.id}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isBanned
                            ? 'bg-rose-950/20 border-rose-500/20'
                            : 'bg-dark-950/60 border-white/5 hover:border-gold-500/20'
                        }`}
                      >
                        {/* User info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={u.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                            alt={u.full_name}
                            className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/10 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-white truncate">{u.full_name}</span>
                              <span className="text-xs text-amber-400 font-semibold">@{u.username}</span>

                              {isAdmin && (
                                <span className="flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                                  <Crown className="w-3 h-3" />
                                  Admin
                                </span>
                              )}

                              {isBanned && (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  Suspended
                                </span>
                              )}

                              {isSelf && (
                                <span className="text-[10px] text-dark-400 font-semibold px-2 py-0.5 rounded-full bg-white/5">
                                  (You)
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-dark-400 mt-1 flex-wrap">
                              <span>📧 {u.email}</span>
                              <span>•</span>
                              <span>Joined: {new Date(u.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        {!isSelf && (
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {/* Role Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleRole(u)}
                              disabled={actionLoadingId === u.id}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                isAdmin
                                  ? 'bg-white/5 hover:bg-white/10 text-dark-300 border-white/10'
                                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {isAdmin ? 'Demote' : 'Make Admin'}
                            </button>

                            {/* Ban Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleBan(u)}
                              disabled={actionLoadingId === u.id}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                isBanned
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {isBanned ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Unban</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Ban</span>
                                </>
                              )}
                            </button>

                            {/* Delete User */}
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              disabled={actionLoadingId === u.id}
                              className="p-1.5 rounded-xl text-dark-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all"
                              title="Delete user account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GLOBAL BROADCAST */}
          {activeTab === 'broadcast' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-gradient-to-tr from-amber-500/15 via-yellow-500/10 to-amber-600/15 border border-gold-500/25">
                <h4 className="text-sm font-black text-amber-300 flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  <span>Real-Time Global System Broadcast</span>
                </h4>
                <p className="text-xs text-dark-300 mt-1 leading-relaxed">
                  Broadcast important announcements, updates, or maintenance warnings. All active users currently using the app will instantly see this popup banner on their screen.
                </p>
              </div>

              {broadcastSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Announcement successfully broadcasted to all connected members!</span>
                </div>
              )}

              <form onSubmit={handleSendBroadcast} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-dark-300 mb-1.5">Announcement Title</label>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="e.g. Nexus Royal Maintenance / Feature Update"
                    required
                    className="w-full bg-dark-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-dark-500 focus:outline-none focus:border-gold-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-dark-300 mb-1.5">Message Content</label>
                  <textarea
                    rows={3}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Write the royal announcement message..."
                    required
                    className="w-full bg-dark-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-dark-500 focus:outline-none focus:border-gold-500/50 resize-none"
                  />
                </div>

                {/* Banner Style */}
                <div>
                  <label className="block text-xs font-bold text-dark-300 mb-2">Banner Appearance</label>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="type"
                        value="info"
                        checked={broadcastType === 'info'}
                        onChange={() => setBroadcastType('info')}
                        className="text-amber-400 focus:ring-amber-400"
                      />
                      <span className="text-amber-300 font-semibold">👑 Royal Gold (Standard)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="type"
                        value="alert"
                        checked={broadcastType === 'alert'}
                        onChange={() => setBroadcastType('alert')}
                        className="text-rose-400 focus:ring-rose-400"
                      />
                      <span className="text-rose-300 font-semibold">🚨 Urgent Alert (Red)</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sendingBroadcast}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-500 hover:from-amber-500 hover:to-yellow-400 text-dark-950 font-black text-xs shadow-lg shadow-gold-500/25 transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{sendingBroadcast ? 'Broadcasting...' : 'Broadcast Announcement to Everyone'}</span>
                </button>
              </form>

              {/* Past Announcements */}
              {recentAnnouncements.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <h5 className="text-xs font-black text-dark-400 uppercase tracking-wider">Recent Announcements</h5>
                  <div className="space-y-2">
                    {recentAnnouncements.slice(0, 5).map((a) => (
                      <div key={a.id} className="p-3 rounded-xl bg-dark-950/60 border border-white/5 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">{a.title}</span>
                          <span className="text-[10px] text-dark-400">{new Date(a.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-dark-300 leading-relaxed">{a.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: OWNER ACCESS & SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Verified Owner Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-dark-950/70 border border-gold-500/25 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
                      <Crown className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">Authorized Royal Platform Owner</h4>
                      <p className="text-xs text-amber-400 font-semibold mt-0.5">karthikarthiswaran50@gmail.com</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    VERIFIED OWNER
                  </span>
                </div>
                <p className="text-xs text-dark-300 leading-relaxed">
                  Your account is permanently authorized as the sole Royal Owner. You have exclusive rights to manage users, suspend abusive accounts, broadcast global announcements, and change platform master keys.
                </p>
              </div>

              {/* Change Master Passcode Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-dark-950/70 border border-white/10 space-y-4">
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>Change Master Owner Passcode</span>
                  </h4>
                  <p className="text-xs text-dark-400 mt-1">
                    Create a private custom master password known only to you.
                  </p>
                </div>

                {passcodeSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{passcodeSuccessMsg}</span>
                  </div>
                )}

                {passcodeErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{passcodeErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleChangePasscode} className="space-y-3.5 max-w-md">
                  <div>
                    <label className="block text-xs font-bold text-dark-300 mb-1">New Master Passcode</label>
                    <input
                      type="password"
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value)}
                      placeholder="Enter new secret passcode..."
                      required
                      className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-dark-500 focus:outline-none focus:border-gold-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-dark-300 mb-1">Confirm New Passcode</label>
                    <input
                      type="password"
                      value={confirmPasscode}
                      onChange={(e) => setConfirmPasscode(e.target.value)}
                      placeholder="Confirm new secret passcode..."
                      required
                      className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-dark-500 focus:outline-none focus:border-gold-500/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingPasscode}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-500 text-dark-950 font-black text-xs shadow-lg shadow-gold-500/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{savingPasscode ? 'Updating Passcode...' : 'Update Master Passcode'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
