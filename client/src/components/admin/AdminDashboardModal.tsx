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
  Activity,
  Eye,
  Clock,
  ArrowRight,
  ExternalLink,
  FileText,
  Filter,
  Check,
  Image as ImageIcon,
  Mic,
  Volume2,
  Video,
  Play,
  Pause,
  Calendar,
  MessageCircle,
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';
import { Avatar } from '../common/Avatar';

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

export interface AdminConversation {
  id: string;
  user1: User;
  user2: User;
  last_message_at: string;
  created_at: string;
  total_messages: number;
  last_message: {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    type: string;
    media_url?: string;
    created_at: string;
  } | null;
}

export interface AdminMessageItem {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type: string;
  media_url?: string;
  is_read: boolean;
  reactions?: Record<string, string[]>;
  reply_to_id?: string;
  reply_to_content?: string;
  reply_to_sender?: string;
  is_deleted_for_all: boolean;
  created_at: string;
  sender?: User;
  receiver?: User;
}

export interface AdminActivityItem {
  id: string;
  user_id: string;
  user?: User;
  action: string;
  title: string;
  description: string;
  details?: any;
  created_at: string;
}

export interface UserInspectionData {
  user: User;
  stats: {
    messagesSent: number;
    messagesReceived: number;
    totalMessages: number;
    callsMade: number;
    callsReceived: number;
    totalCallDurationSeconds: number;
    storiesCreated: number;
    conversationsCount: number;
  };
  conversations: Array<{
    id: string;
    other_user: User;
    last_message_at: string;
    total_messages: number;
    last_message?: any;
  }>;
  recentMessages: AdminMessageItem[];
}

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'overview' | 'chats' | 'activities' | 'users' | 'broadcast' | 'security';

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

  // Chats State
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatSubView, setChatSubView] = useState<'conversations' | 'recent_messages'>('conversations');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<{ conversation: any; messages: AdminMessageItem[] } | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [recentMessages, setRecentMessages] = useState<AdminMessageItem[]>([]);
  const [loadingRecentMessages, setLoadingRecentMessages] = useState(false);

  // Activities State
  const [activities, setActivities] = useState<AdminActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activityActionFilter, setActivityActionFilter] = useState('all');
  const [activityUserFilter, setActivityUserFilter] = useState<string>('');

  // User Inspection State
  const [inspectingUserId, setInspectingUserId] = useState<string | null>(null);
  const [inspectionData, setInspectionData] = useState<UserInspectionData | null>(null);
  const [loadingInspection, setLoadingInspection] = useState(false);

  // Fetch Announcements
  const fetchAnnouncements = async () => {
    try {
      const res = await axios.get('/api/admin/announcements');
      setRecentAnnouncements(res.data.announcements || []);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    }
  };

  // Fetch Conversations
  const fetchConversations = async (query = '') => {
    try {
      setLoadingConversations(true);
      const res = await axios.get(`/api/admin/conversations?q=${encodeURIComponent(query)}`);
      setConversations(res.data.conversations || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Fetch Conversation Transcript
  const fetchConversationMessages = async (convId: string) => {
    try {
      setSelectedConvId(convId);
      setLoadingMessages(true);
      const res = await axios.get(`/api/admin/conversations/${convId}/messages`);
      setConversationDetail(res.data);
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
      alert('Failed to load conversation transcript.');
    } finally {
      setLoadingMessages(false);
    }
  };

  // Fetch Recent Messages across whole app
  const fetchRecentMessages = async (query = '') => {
    try {
      setLoadingRecentMessages(true);
      const res = await axios.get(`/api/admin/messages/recent?q=${encodeURIComponent(query)}`);
      setRecentMessages(res.data.messages || []);
    } catch (err) {
      console.error('Failed to load recent messages:', err);
    } finally {
      setLoadingRecentMessages(false);
    }
  };

  // Delete message as Admin
  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm('Permanently purge this message as Royal Admin?')) return;
    try {
      await axios.delete(`/api/admin/messages/${msgId}`);
      if (conversationDetail) {
        setConversationDetail({
          ...conversationDetail,
          messages: conversationDetail.messages.filter(m => m.id !== msgId),
        });
      }
      setRecentMessages(prev => prev.filter(m => m.id !== msgId));
      if (stats) {
        setStats({ ...stats, totalMessages: Math.max(0, stats.totalMessages - 1) });
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
      alert('Failed to delete message.');
    }
  };

  // Fetch Activities
  const fetchActivities = async (userFilter = activityUserFilter, actionFilter = activityActionFilter) => {
    try {
      setLoadingActivities(true);
      const params = new URLSearchParams();
      if (userFilter) params.set('userId', userFilter);
      if (actionFilter && actionFilter !== 'all') params.set('action', actionFilter);
      const res = await axios.get(`/api/admin/activities?${params.toString()}`);
      setActivities(res.data.activities || []);
    } catch (err) {
      console.error('Failed to load user activities:', err);
    } finally {
      setLoadingActivities(false);
    }
  };

  // Inspect User
  const handleInspectUser = async (userId: string) => {
    try {
      setInspectingUserId(userId);
      setLoadingInspection(true);
      const res = await axios.get(`/api/admin/users/${userId}/inspection`);
      setInspectionData(res.data);
    } catch (err) {
      console.error('Failed to inspect user:', err);
      alert('Failed to inspect user profile.');
    } finally {
      setLoadingInspection(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
      fetchUsers();
      fetchAnnouncements();
      if (activeTab === 'chats') {
        fetchConversations(chatSearchQuery);
        fetchRecentMessages(chatSearchQuery);
      } else if (activeTab === 'activities') {
        fetchActivities();
      }
      if (refreshUser) {
        refreshUser();
      }
    }
  }, [isOpen, activeTab]);

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
            onClick={() => {
              setActiveTab('chats');
              fetchConversations(chatSearchQuery);
              fetchRecentMessages(chatSearchQuery);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'chats'
                ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-600/20 text-amber-300 border border-gold-500/30 shadow-sm'
                : 'text-dark-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>User Chats & Messages</span>
            {stats && stats.totalMessages > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold">
                {stats.totalMessages}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('activities');
              fetchActivities();
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'activities'
                ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-600/20 text-amber-300 border border-gold-500/30 shadow-sm'
                : 'text-dark-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>User Activities</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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

          {/* TAB 2: USER CHATS & MESSAGES */}
          {activeTab === 'chats' && (
            <div className="space-y-4">
              {/* Header & Sub-View Switcher */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setChatSubView('conversations')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      chatSubView === 'conversations'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-sm'
                        : 'text-dark-400 hover:text-white border-white/5 bg-dark-950'
                    }`}
                  >
                    <span>All User Conversations ({conversations.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatSubView('recent_messages')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      chatSubView === 'recent_messages'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-sm'
                        : 'text-dark-400 hover:text-white border-white/5 bg-dark-950'
                    }`}
                  >
                    <span>Live Messages Feed ({recentMessages.length})</span>
                  </button>
                </div>

                {/* Search & Refresh */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-400" />
                    <input
                      type="text"
                      value={chatSearchQuery}
                      onChange={(e) => {
                        setChatSearchQuery(e.target.value);
                        fetchConversations(e.target.value);
                        fetchRecentMessages(e.target.value);
                      }}
                      placeholder="Search users or messages..."
                      className="w-full bg-dark-950 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-dark-500 focus:outline-none focus:border-gold-500/50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      fetchConversations(chatSearchQuery);
                      fetchRecentMessages(chatSearchQuery);
                    }}
                    disabled={loadingConversations || loadingRecentMessages}
                    className="p-2 rounded-xl text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
                    title="Refresh messages"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingConversations || loadingRecentMessages ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Sub-View 1: Conversations List */}
              {chatSubView === 'conversations' && (
                <div className="space-y-2.5">
                  {loadingConversations ? (
                    <div className="text-center py-12 text-dark-400 text-xs">
                      <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-amber-400" />
                      Loading conversations...
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-12 text-dark-400 text-xs bg-dark-950/40 rounded-2xl border border-white/5 p-6">
                      <MessageSquare className="w-8 h-8 text-dark-600 mx-auto mb-2" />
                      No chat conversations found matching your search.
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className="p-4 rounded-2xl bg-dark-950/70 border border-white/5 hover:border-gold-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* User 1 */}
                          <div className="flex items-center gap-2">
                            <Avatar
                              src={conv.user1?.avatar_url}
                              name={conv.user1?.full_name || ''}
                              size="sm"
                              planId={conv.user1?.plan_id}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate max-w-[110px] sm:max-w-[140px]">
                                {conv.user1?.full_name || `@${conv.user1?.username}`}
                              </p>
                              <p className="text-[10px] text-amber-400/80 font-mono truncate">@{conv.user1?.username}</p>
                            </div>
                          </div>

                          {/* Arrow / Exchange Badge */}
                          <div className="flex flex-col items-center px-1 shrink-0">
                            <div className="px-2 py-0.5 rounded-full bg-dark-850 border border-gold-500/20 text-[10px] font-black text-amber-300 flex items-center gap-1">
                              <span>⇄</span>
                              <span>{conv.total_messages} msgs</span>
                            </div>
                          </div>

                          {/* User 2 */}
                          <div className="flex items-center gap-2">
                            <Avatar
                              src={conv.user2?.avatar_url}
                              name={conv.user2?.full_name || ''}
                              size="sm"
                              planId={conv.user2?.plan_id}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate max-w-[110px] sm:max-w-[140px]">
                                {conv.user2?.full_name || `@${conv.user2?.username}`}
                              </p>
                              <p className="text-[10px] text-amber-400/80 font-mono truncate">@{conv.user2?.username}</p>
                            </div>
                          </div>
                        </div>

                        {/* Right Side: Last message snippet & Open transcript button */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 min-w-0 sm:max-w-xs">
                          <div className="text-left sm:text-right min-w-0">
                            <p className="text-[11px] text-dark-300 truncate max-w-[180px]">
                              {conv.last_message ? (
                                conv.last_message.type === 'audio' ? '🎤 Voice Note' :
                                conv.last_message.type === 'image' ? '📷 Shared Photo' :
                                conv.last_message.content
                              ) : 'No messages yet'}
                            </p>
                            <p className="text-[10px] text-dark-500 font-mono">
                              {conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => fetchConversationMessages(conv.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500 hover:to-yellow-400 text-amber-300 hover:text-dark-950 border border-amber-400/30 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Chat</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Sub-View 2: Live Global Messages Feed */}
              {chatSubView === 'recent_messages' && (
                <div className="space-y-2.5">
                  {loadingRecentMessages ? (
                    <div className="text-center py-12 text-dark-400 text-xs">
                      <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-amber-400" />
                      Loading messages feed...
                    </div>
                  ) : recentMessages.length === 0 ? (
                    <div className="text-center py-12 text-dark-400 text-xs bg-dark-950/40 rounded-2xl border border-white/5 p-6">
                      <MessageSquare className="w-8 h-8 text-dark-600 mx-auto mb-2" />
                      No messages found.
                    </div>
                  ) : (
                    recentMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-3.5 rounded-2xl bg-dark-950/70 border border-white/5 hover:border-gold-500/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {/* Sender & Receiver Info */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar src={msg.sender?.avatar_url} name={msg.sender?.full_name || ''} size="xs" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                              <span className="font-bold text-white">{msg.sender?.full_name || `@${msg.sender?.username}`}</span>
                              <span className="text-dark-400 text-[10px]">➔</span>
                              <span className="font-bold text-amber-300">{msg.receiver?.full_name || `@${msg.receiver?.username}`}</span>
                            </div>
                            <span className="text-[10px] text-dark-500 font-mono">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        {/* Message Content Preview */}
                        <div className="flex-1 min-w-0 px-2">
                          {msg.type === 'audio' && msg.media_url ? (
                            <div className="flex items-center gap-2 bg-dark-900 px-3 py-1.5 rounded-xl border border-white/10 max-w-sm">
                              <Mic className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <audio controls src={msg.media_url} className="h-7 w-full max-w-[200px]" />
                            </div>
                          ) : msg.type === 'image' && msg.media_url ? (
                            <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="inline-block">
                              <img src={msg.media_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10 hover:opacity-80" />
                            </a>
                          ) : (
                            <p className="text-xs text-dark-200 break-words bg-dark-900/60 p-2 rounded-xl border border-white/5">
                              {msg.is_deleted_for_all ? <span className="text-rose-400 italic">🚫 Message deleted</span> : msg.content}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => fetchConversationMessages(msg.conversation_id)}
                            className="p-1.5 rounded-xl text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 text-xs font-semibold flex items-center gap-1"
                            title="View full conversation"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Thread</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="p-1.5 rounded-xl text-dark-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all"
                            title="Delete message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: USER ACTIVITIES */}
          {activeTab === 'activities' && (
            <div className="space-y-4">
              {/* Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Action Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  {[
                    { id: 'all', label: 'All Activities' },
                    { id: 'chat_sent', label: '💬 Messages' },
                    { id: 'call', label: '📞 Calls' },
                    { id: 'login', label: '🔑 Logins' },
                    { id: 'story', label: '📖 Stories' },
                    { id: 'profile', label: '👤 Profiles' },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        setActivityActionFilter(chip.id);
                        fetchActivities(activityUserFilter, chip.id);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
                        activityActionFilter === chip.id
                          ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-600/20 text-amber-300 border-gold-500/40 shadow-sm'
                          : 'text-dark-400 hover:text-white border-white/5 bg-dark-950'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* User Filter & Refresh */}
                <div className="flex items-center gap-2">
                  <select
                    value={activityUserFilter}
                    onChange={(e) => {
                      setActivityUserFilter(e.target.value);
                      fetchActivities(e.target.value, activityActionFilter);
                    }}
                    className="bg-dark-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold-500/50"
                  >
                    <option value="">All Members</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} (@{u.username})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => fetchActivities(activityUserFilter, activityActionFilter)}
                    disabled={loadingActivities}
                    className="p-2 rounded-xl text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
                    title="Refresh activities"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingActivities ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Activity Feed List */}
              <div className="space-y-2.5">
                {loadingActivities ? (
                  <div className="text-center py-12 text-dark-400 text-xs">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-amber-400" />
                    Loading user activities...
                  </div>
                ) : activities.length === 0 ? (
                  <div className="text-center py-12 text-dark-400 text-xs bg-dark-950/40 rounded-2xl border border-white/5 p-6">
                    <Activity className="w-8 h-8 text-dark-600 mx-auto mb-2" />
                    No activities recorded for this filter.
                  </div>
                ) : (
                  activities.map((act) => (
                    <div
                      key={act.id}
                      className="p-3.5 sm:p-4 rounded-2xl bg-dark-950/70 border border-white/5 hover:border-gold-500/20 transition-all flex items-start gap-3.5 group"
                    >
                      {/* User Avatar */}
                      <div className="relative shrink-0">
                        <Avatar
                          src={act.user?.avatar_url}
                          name={act.user?.full_name || ''}
                          size="sm"
                          planId={act.user?.plan_id}
                        />
                      </div>

                      {/* Content Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white">{act.title}</span>
                            {act.user?.username && (
                              <span className="text-[10px] text-amber-400/80 font-mono">@{act.user.username}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-dark-400 font-mono shrink-0">
                            {new Date(act.created_at).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {act.description && (
                          <p className="text-xs text-dark-300 break-words mb-1">
                            {act.description}
                          </p>
                        )}

                        {/* Details Tags */}
                        <div className="flex items-center gap-2 flex-wrap text-[10px] text-dark-400 mt-1">
                          <span className="px-2 py-0.5 rounded-full bg-dark-850 border border-white/5 uppercase font-mono">
                            {act.action}
                          </span>
                          {act.user && (
                            <button
                              type="button"
                              onClick={() => handleInspectUser(act.user_id)}
                              className="text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer"
                            >
                              Inspect Profile ➔
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: USER MANAGEMENT */}
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
                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 flex-wrap">
                          {/* Quick Chats */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('chats');
                              setChatSearchQuery(u.username);
                              fetchConversations(u.username);
                              fetchRecentMessages(u.username);
                            }}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition-all"
                            title="View all chats of this user"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Chats</span>
                          </button>

                          {/* Quick Activity */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('activities');
                              setActivityUserFilter(u.id);
                              fetchActivities(u.id);
                            }}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 transition-all"
                            title="View activity timeline of this user"
                          >
                            <Activity className="w-3 h-3" />
                            <span>Activity</span>
                          </button>

                          {/* Quick Inspect */}
                          <button
                            type="button"
                            onClick={() => handleInspectUser(u.id)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-dark-200 border border-white/10 flex items-center gap-1 transition-all"
                            title="360 profile inspection"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Inspect</span>
                          </button>

                          {!isSelf && (
                            <>
                              {/* Role Toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleRole(u)}
                                disabled={actionLoadingId === u.id}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                  isAdmin
                                    ? 'bg-white/5 hover:bg-white/10 text-dark-300 border-white/10'
                                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {isAdmin ? 'Demote' : 'Admin'}
                              </button>

                              {/* Ban Toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleBan(u)}
                                disabled={actionLoadingId === u.id}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                  isBanned
                                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                    : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                                }`}
                              >
                                {isBanned ? (
                                  <>
                                    <UserCheck className="w-3 h-3" />
                                    <span>Unban</span>
                                  </>
                                ) : (
                                  <>
                                    <UserX className="w-3 h-3" />
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
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
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

        {/* ========================================================================= */}
        {/* MODAL 1: FULL CONVERSATION TRANSCRIPT INSPECTOR */}
        {/* ========================================================================= */}
        {conversationDetail && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-dark-950/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-dark-900 border border-gold-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh] royal-card">
              {/* Header */}
              <div className="p-4 border-b border-white/10 bg-dark-950/90 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center -space-x-3">
                    <Avatar src={conversationDetail.conversation?.user1?.avatar_url} name={conversationDetail.conversation?.user1?.full_name || ''} size="sm" />
                    <Avatar src={conversationDetail.conversation?.user2?.avatar_url} name={conversationDetail.conversation?.user2?.full_name || ''} size="sm" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-white truncate">
                      <span>{conversationDetail.conversation?.user1?.full_name || `@${conversationDetail.conversation?.user1?.username}`}</span>
                      <span className="text-amber-400">⇄</span>
                      <span>{conversationDetail.conversation?.user2?.full_name || `@${conversationDetail.conversation?.user2?.username}`}</span>
                    </div>
                    <p className="text-[10px] text-dark-400">
                      Total {conversationDetail.messages.length} messages • Chat ID: <span className="font-mono">{conversationDetail.conversation?.id}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setConversationDetail(null)}
                  className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-dark-950/50">
                {conversationDetail.messages.length === 0 ? (
                  <div className="text-center py-12 text-dark-500 text-xs">
                    No messages in this conversation.
                  </div>
                ) : (
                  conversationDetail.messages.map((m) => {
                    const isUser1 = m.sender_id === conversationDetail.conversation?.user1?.id;
                    const sender = isUser1 ? conversationDetail.conversation?.user1 : conversationDetail.conversation?.user2;

                    return (
                      <div
                        key={m.id}
                        className={`flex gap-2.5 max-w-[85%] ${isUser1 ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
                      >
                        <Avatar src={sender?.avatar_url} name={sender?.full_name || ''} size="xs" />
                        <div
                          className={`p-3 rounded-2xl border text-xs space-y-1 relative group ${
                            isUser1
                              ? 'bg-dark-900 border-gold-500/20 text-white rounded-tl-xs'
                              : 'bg-gradient-to-br from-amber-600/20 to-yellow-600/15 border-amber-400/30 text-white rounded-tr-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] text-amber-300/80 font-bold mb-0.5">
                            <span>{sender?.full_name || `@${sender?.username}`}</span>
                            <span className="text-dark-500 font-mono font-normal">
                              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Voice Note Player */}
                          {m.type === 'audio' && m.media_url ? (
                            <div className="flex items-center gap-2 bg-dark-950/80 p-2 rounded-xl border border-white/10">
                              <Mic className="w-4 h-4 text-amber-400 shrink-0" />
                              <audio controls src={m.media_url} className="h-7 w-48" />
                            </div>
                          ) : m.type === 'image' && m.media_url ? (
                            <div>
                              <a href={m.media_url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={m.media_url}
                                  alt="Shared"
                                  className="max-h-56 rounded-xl object-cover border border-white/10 hover:opacity-90"
                                />
                              </a>
                            </div>
                          ) : (
                            <p className="break-words whitespace-pre-wrap leading-relaxed text-dark-100">
                              {m.is_deleted_for_all ? (
                                <span className="text-rose-400 italic">🚫 This message was deleted</span>
                              ) : (
                                m.content
                              )}
                            </p>
                          )}

                          {/* Admin Quick Delete Action */}
                          <div className="pt-1 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(m.id)}
                              className="text-[10px] text-dark-500 hover:text-rose-400 flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
                              title="Delete message from system"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-white/10 bg-dark-950 flex items-center justify-between text-xs text-dark-400">
                <span>Total messages: {conversationDetail.messages.length}</span>
                <button
                  type="button"
                  onClick={() => setConversationDetail(null)}
                  className="px-4 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-white font-bold transition-colors"
                >
                  Close Transcript
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: USER 360 FULL PROFILE & ACTIVITY INSPECTION */}
        {/* ========================================================================= */}
        {inspectionData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-dark-950/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-dark-900 border border-gold-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] royal-card">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-white/10 bg-dark-950/90 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={inspectionData.user?.avatar_url}
                    name={inspectionData.user?.full_name || ''}
                    size="md"
                    planId={inspectionData.user?.plan_id}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-black text-white">{inspectionData.user?.full_name}</h4>
                      <span className="text-xs text-amber-400 font-mono">@{inspectionData.user?.username}</span>
                    </div>
                    <p className="text-xs text-dark-400">
                      📧 {inspectionData.user?.email || 'N/A'} • Joined: {new Date(inspectionData.user?.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectionData(null)}
                  className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 bg-dark-950/50">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-2xl bg-dark-900 border border-white/5 space-y-0.5">
                    <p className="text-[10px] text-dark-400 font-bold uppercase">Messages Sent</p>
                    <p className="text-base font-black text-amber-300">{inspectionData.stats?.messagesSent || 0}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-dark-900 border border-white/5 space-y-0.5">
                    <p className="text-[10px] text-dark-400 font-bold uppercase">Messages Received</p>
                    <p className="text-base font-black text-white">{inspectionData.stats?.messagesReceived || 0}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-dark-900 border border-white/5 space-y-0.5">
                    <p className="text-[10px] text-dark-400 font-bold uppercase">Calls Made</p>
                    <p className="text-base font-black text-emerald-400">{inspectionData.stats?.callsMade || 0}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-dark-900 border border-white/5 space-y-0.5">
                    <p className="text-[10px] text-dark-400 font-bold uppercase">Call Duration</p>
                    <p className="text-base font-black text-cyan-400">
                      {Math.floor((inspectionData.stats?.totalCallDurationSeconds || 0) / 60)}m {(inspectionData.stats?.totalCallDurationSeconds || 0) % 60}s
                    </p>
                  </div>
                </div>

                {/* User's Conversations */}
                <div className="space-y-2">
                  <h5 className="text-xs font-black text-white flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    <span>Conversations ({inspectionData.conversations?.length || 0})</span>
                  </h5>

                  {inspectionData.conversations?.length === 0 ? (
                    <p className="text-xs text-dark-500 italic p-3 bg-dark-900 rounded-xl">No conversations initiated yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {inspectionData.conversations?.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 rounded-xl bg-dark-900 border border-white/5 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar src={c.other_user?.avatar_url} name={c.other_user?.full_name || ''} size="xs" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {c.other_user?.full_name || `@${c.other_user?.username}`}
                              </p>
                              <p className="text-[10px] text-dark-400 truncate">
                                {c.last_message?.content || 'Conversation open'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-dark-850 text-amber-300 font-mono">
                              {c.total_messages} msgs
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setInspectionData(null);
                                fetchConversationMessages(c.id);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold transition-colors"
                            >
                              Open Chat
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* User's Recent Messages */}
                <div className="space-y-2">
                  <h5 className="text-xs font-black text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Recent Messages Exchanged ({inspectionData.recentMessages?.length || 0})</span>
                  </h5>

                  {inspectionData.recentMessages?.length === 0 ? (
                    <p className="text-xs text-dark-500 italic p-3 bg-dark-900 rounded-xl">No message history.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {inspectionData.recentMessages?.slice(0, 30).map((m) => {
                        const isSent = m.sender_id === inspectionData.user?.id;
                        return (
                          <div
                            key={m.id}
                            className="p-2.5 rounded-xl bg-dark-900/80 border border-white/5 text-xs flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded mr-1.5 ${isSent ? 'bg-amber-500/20 text-amber-300' : 'bg-cyan-500/20 text-cyan-300'}`}>
                                {isSent ? 'Sent' : 'Received'}
                              </span>
                              <span className="text-dark-200">
                                {m.type === 'audio' ? '🎤 Voice Note' : m.type === 'image' ? '📷 Photo' : m.content}
                              </span>
                            </div>
                            <span className="text-[10px] text-dark-500 font-mono shrink-0">
                              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-3.5 border-t border-white/10 bg-dark-950 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setInspectionData(null)}
                  className="px-4 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-white font-bold text-xs transition-colors"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
