import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Bell,
  Lock,
  Moon,
  Sun,
  Eye,
  EyeOff,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Crown,
  BellRing,
  Smartphone,
  RefreshCw,
  Wifi,
  WifiOff,
  Sparkles,
  UserX,
  Trash2,
  Users,
  Download,
  FileText,
  ExternalLink,
  Palette,
  Volume2,
  Play,
  Fingerprint,
  Zap,
  ChevronRight,
  ArrowLeft,
  QrCode,
  Laptop,
  Heart,
  MessageSquare,
  Key,
  Database,
  Radio,
  FileDown,
  Copy,
  Check,
  Sliders,
  HelpCircle,
  Share2,
  Camera,
  Info,
  X,
  HardDrive,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';
import { BlockedUser } from '../../types';
import axios from 'axios';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  subscribeToWebPush,
  showCallNotification,
  showMessageNotification,
} from '../../utils/notifications';
import { requestFcmToken } from '../../config/firebase';
import { AdminDashboardModal } from '../admin/AdminDashboardModal';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { InstallModal } from '../pwa/InstallModal';

export type SettingsSection =
  | 'main'
  | 'account'
  | 'linked_devices'
  | 'donate'
  | 'appearance'
  | 'chats'
  | 'stories'
  | 'notifications'
  | 'privacy'
  | 'data'
  | 'help';

export const SettingsView: React.FC = () => {
  const { user, settings, updateSettings, logout } = useAuth();
  const [currentSection, setCurrentSection] = useState<SettingsSection>('main');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);

  // 📲 PWA Standalone Install State
  const pwaState = usePWAInstall();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // ==========================================
  // 1. SIGNAL PRIVACY FLAGS & PREFERENCES
  // ==========================================
  const [screenSecurity, setScreenSecurity] = useState<boolean>(() => {
    return localStorage.getItem('nexus_signal_screen_security') === 'true';
  });
  const handleToggleScreenSecurity = (enabled: boolean) => {
    setScreenSecurity(enabled);
    localStorage.setItem('nexus_signal_screen_security', enabled ? 'true' : 'false');
  };

  const [incognitoKeyboard, setIncognitoKeyboard] = useState<boolean>(() => {
    return localStorage.getItem('nexus_signal_incognito_keyboard') === 'true';
  });
  const handleToggleIncognitoKeyboard = (enabled: boolean) => {
    setIncognitoKeyboard(enabled);
    localStorage.setItem('nexus_signal_incognito_keyboard', enabled ? 'true' : 'false');
  };

  const [alwaysRelayCalls, setAlwaysRelayCalls] = useState<boolean>(() => {
    return localStorage.getItem('nexus_signal_always_relay_calls') === 'true';
  });
  const handleToggleAlwaysRelayCalls = (enabled: boolean) => {
    setAlwaysRelayCalls(enabled);
    localStorage.setItem('nexus_signal_always_relay_calls', enabled ? 'true' : 'false');
  };

  const [notifPreviewType, setNotifPreviewType] = useState<string>(() => {
    return localStorage.getItem('nexus_signal_notif_preview') || 'all';
  });
  const handleSelectNotifPreview = (type: string) => {
    setNotifPreviewType(type);
    localStorage.setItem('nexus_signal_notif_preview', type);
  };

  const [disappearingDefaultTimer, setDisappearingDefaultTimer] = useState<string>(() => {
    return localStorage.getItem('nexus_signal_disappearing_default') || 'off';
  });
  const handleSelectDisappearingTimer = (timer: string) => {
    setDisappearingDefaultTimer(timer);
    localStorage.setItem('nexus_signal_disappearing_default', timer);
  };

  const [typingIndicators, setTypingIndicators] = useState<boolean>(() => {
    return localStorage.getItem('nexus_signal_typing_indicators') !== 'false';
  });
  const handleToggleTypingIndicators = (enabled: boolean) => {
    setTypingIndicators(enabled);
    localStorage.setItem('nexus_signal_typing_indicators', enabled ? 'true' : 'false');
  };

  const [enterIsSend, setEnterIsSend] = useState<boolean>(() => {
    return localStorage.getItem('nexus_signal_enter_is_send') === 'true';
  });
  const handleToggleEnterIsSend = (enabled: boolean) => {
    setEnterIsSend(enabled);
    localStorage.setItem('nexus_signal_enter_is_send', enabled ? 'true' : 'false');
  };

  const [sentMediaQuality, setSentMediaQuality] = useState<string>(() => {
    return localStorage.getItem('nexus_signal_sent_media_quality') || 'high';
  });
  const handleSelectSentMediaQuality = (quality: string) => {
    setSentMediaQuality(quality);
    localStorage.setItem('nexus_signal_sent_media_quality', quality);
  };

  const [proxyEnabled, setProxyEnabled] = useState<boolean>(() => {
    return localStorage.getItem('nexus_signal_proxy_enabled') === 'true';
  });
  const [proxyHost, setProxyHost] = useState<string>(() => {
    return localStorage.getItem('nexus_signal_proxy_host') || 'proxy.nexusroyal.online:443';
  });
  const handleToggleProxy = (enabled: boolean) => {
    setProxyEnabled(enabled);
    localStorage.setItem('nexus_signal_proxy_enabled', enabled ? 'true' : 'false');
  };
  const handleSaveProxyHost = (host: string) => {
    setProxyHost(host);
    localStorage.setItem('nexus_signal_proxy_host', host);
  };

  const [registrationLock, setRegistrationLock] = useState<boolean>(() => {
    return localStorage.getItem('nexus_signal_registration_lock') === 'true';
  });
  const handleToggleRegistrationLock = (enabled: boolean) => {
    setRegistrationLock(enabled);
    localStorage.setItem('nexus_signal_registration_lock', enabled ? 'true' : 'false');
  };

  const [screenLockTimeout, setScreenLockTimeout] = useState<string>(() => {
    return localStorage.getItem('nexus_signal_screen_lock_timeout') || 'immediately';
  });
  const handleSelectScreenLockTimeout = (val: string) => {
    setScreenLockTimeout(val);
    localStorage.setItem('nexus_signal_screen_lock_timeout', val);
  };

  // 💎 Luxury Themes state
  const [selectedTheme, setSelectedTheme] = useState<string>(() => {
    return localStorage.getItem('nexus_luxury_theme') || 'royal_gold';
  });
  const handleSelectTheme = (themeId: string) => {
    setSelectedTheme(themeId);
    localStorage.setItem('nexus_luxury_theme', themeId);
    document.documentElement.setAttribute('data-luxury-theme', themeId);
  };

  // 📶 Adaptive Low-Data Saver Mode
  const [lowDataMode, setLowDataMode] = useState<boolean>(() => {
    return localStorage.getItem('nexus_low_data_mode') === 'true';
  });
  const handleToggleLowDataMode = (enabled: boolean) => {
    setLowDataMode(enabled);
    localStorage.setItem('nexus_low_data_mode', enabled ? 'true' : 'false');
  };

  // 🔔 Custom Notification Chime Selector & Sound Preview
  const [chimeSound, setChimeSound] = useState<string>(() => {
    return localStorage.getItem('nexus_chime_sound') || 'royal_gold';
  });

  const playAudioTonePreview = (soundType: string) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (soundType === 'crystal') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (soundType === 'harp') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else {
        // Royal Gold
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      }
    } catch (e) {
      console.error('Audio tone preview error:', e);
    }
  };

  const handleSelectChime = (chime: string) => {
    setChimeSound(chime);
    localStorage.setItem('nexus_chime_sound', chime);
    playAudioTonePreview(chime);
  };

  // 🧬 Biometric Lock
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(() => {
    return localStorage.getItem('nexus_biometric_enabled') === 'true';
  });
  const handleToggleBiometric = (enabled: boolean) => {
    setBiometricEnabled(enabled);
    localStorage.setItem('nexus_biometric_enabled', enabled ? 'true' : 'false');
  };

  // Account Preferences from Server
  const [allowCallsFrom, setAllowCallsFrom] = useState<'everyone' | 'contacts' | 'nobody'>(
    (settings?.who_can_call_me || settings?.allow_calls_from || 'everyone') as any
  );
  const [whoCanSeeLastSeen, setWhoCanSeeLastSeen] = useState<'everyone' | 'nobody'>(
    settings?.who_can_see_last_seen || 'everyone'
  );
  const [whoCanSeeOnlineStatus, setWhoCanSeeOnlineStatus] = useState<'everyone' | 'nobody'>(
    settings?.who_can_see_online_status || 'everyone'
  );
  const [whoCanSeeProfilePhoto, setWhoCanSeeProfilePhoto] = useState<'everyone' | 'nobody'>(
    settings?.who_can_see_profile_photo || 'everyone'
  );
  const [notificationSound, setNotificationSound] = useState(settings?.notification_sound ?? true);
  const [readReceipts, setReadReceipts] = useState(settings?.read_receipts ?? true);

  // Blocked users & account actions
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [accountActionMsg, setAccountActionMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // System push notification state
  const [notifPermission, setNotifPermission] = useState(getNotificationPermissionStatus());
  const [pushSubCount, setPushSubCount] = useState<number | null>(null);
  const [activating, setActivating] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testResult, setTestResult] = useState<{ delivered: boolean } | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);

  // Password update form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [updatingPw, setUpdatingPw] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Royal Vault PIN Lock state
  const [pinEnabled, setPinEnabled] = useState(() => !!localStorage.getItem('nexus_app_pin'));
  const [pinInput, setPinInput] = useState('');
  const [pinMessage, setPinMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Storage Stats & Cache Cleaner
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheClearedSuccess, setCacheClearedSuccess] = useState(false);

  const fetchPushSubStatus = async () => {
    try {
      const res = await axios.get('/api/notifications/subscriptions');
      setPushSubCount(res.data.webPushSubscriptions || 0);
    } catch (e) {
      setPushSubCount(null);
    }
  };

  const fetchBlockedUsers = async () => {
    setLoadingBlocks(true);
    try {
      const res = await axios.get('/api/users/blocks/list');
      setBlockedUsers(res.data.blocks || []);
    } catch (e) {
      console.error('Fetch blocked users failed:', e);
    } finally {
      setLoadingBlocks(false);
    }
  };

  const handleUnblockUser = async (blockedUserId: string) => {
    try {
      await axios.delete(`/api/users/block/${blockedUserId}`);
      setBlockedUsers((prev) => prev.filter((b) => b.blocked_user_id !== blockedUserId));
    } catch (e) {
      console.error('Unblock user failed:', e);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Are you sure you want to log out from all devices? You will need to log back in.')) return;
    setLoggingOutAll(true);
    try {
      await axios.post('/api/users/logout-all');
      logout();
    } catch (e) {
      setAccountActionMsg({ text: 'Failed to log out all devices', isError: true });
      setTimeout(() => setAccountActionMsg(null), 3000);
      setLoggingOutAll(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      return;
    }
    setDeletingAccount(true);
    try {
      await axios.delete('/api/users/account');
      logout();
    } catch (e) {
      setAccountActionMsg({ text: 'Failed to delete account', isError: true });
      setTimeout(() => setAccountActionMsg(null), 3000);
      setDeletingAccount(false);
    }
  };

  const handleClearCache = () => {
    setClearingCache(true);
    setTimeout(() => {
      // Clear non-essential cached media items
      sessionStorage.clear();
      setClearingCache(false);
      setCacheClearedSuccess(true);
      setTimeout(() => setCacheClearedSuccess(false), 3000);
    }, 600);
  };

  const handleCopyUserHandle = () => {
    if (user?.username) {
      navigator.clipboard.writeText(`@${user.username}`);
      setCopiedHandle(true);
      setTimeout(() => setCopiedHandle(false), 2000);
    }
  };

  useEffect(() => {
    setNotifPermission(getNotificationPermissionStatus());
    fetchPushSubStatus();
    fetchBlockedUsers();
  }, []);

  const handleActivatePush = async () => {
    setActivating(true);
    setActivateError(null);
    try {
      let perm = Notification.permission;
      if (perm !== 'granted') {
        perm = await Notification.requestPermission();
      }
      if (perm !== 'granted') {
        setActivateError('❌ Permission denied in browser. Please allow notifications in phone settings.');
        setActivating(false);
        return;
      }
      setNotifPermission('granted');

      const ok = await subscribeToWebPush(true);
      if (!ok) {
        setActivateError('⚠️ Could not register push subscription. Chrome / Chromium browser recommended.');
        setActivating(false);
        return;
      }

      try {
        const fcmToken = await requestFcmToken();
        if (fcmToken) {
          await axios.post('/api/users/fcm-token', { token: fcmToken });
        }
      } catch (e) {}

      await fetchPushSubStatus();
      setActivateError(null);
    } catch (err: any) {
      setActivateError('Error: ' + (err?.message || 'Unknown error'));
    } finally {
      setActivating(false);
    }
  };

  const handleTestServerPush = async (type: 'call' | 'message') => {
    setTestSent(true);
    setTestResult(null);
    try {
      const res = await axios.post('/api/notifications/test', { type });
      setTestResult({ delivered: res.data.delivered });
    } catch (e) {
      setTestResult({ delivered: false });
    }
    setTimeout(() => {
      setTestSent(false);
      setTestResult(null);
    }, 5000);
  };

  const handleTestLocalAlert = () => {
    showCallNotification('Nexus Royal Alert', 'video');
  };

  const handleSavePin = () => {
    if (!pinEnabled) {
      localStorage.removeItem('nexus_app_pin');
      sessionStorage.removeItem('nexus_app_unlocked');
      setPinMessage({ text: 'PIN lock has been disabled' });
      setTimeout(() => setPinMessage(null), 3500);
      return;
    }

    if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
      setPinMessage({ text: 'PIN must be exactly 4 numbers (e.g. 1234)', isError: true });
      setTimeout(() => setPinMessage(null), 3500);
      return;
    }

    localStorage.setItem('nexus_app_pin', pinInput);
    sessionStorage.setItem('nexus_app_unlocked', 'true');
    setPinInput('');
    setPinMessage({ text: 'Royal 4-Digit PIN saved and active!' });
    setTimeout(() => setPinMessage(null), 3500);
  };

  const handleLockNow = () => {
    sessionStorage.removeItem('nexus_app_unlocked');
    window.dispatchEvent(new Event('nexus_lock_app'));
  };

  const handleSavePreferences = async () => {
    setSavingSettings(true);
    setSettingsError(null);
    try {
      await updateSettings({
        allow_calls_from: allowCallsFrom,
        who_can_call_me: allowCallsFrom,
        who_can_see_last_seen: whoCanSeeLastSeen,
        who_can_see_online_status: whoCanSeeOnlineStatus,
        who_can_see_profile_photo: whoCanSeeProfilePhoto,
        notification_sound: notificationSound,
        read_receipts: readReceipts,
      });
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      setSettingsError('Failed to save settings. Please try again.');
      setTimeout(() => setSettingsError(null), 4000);
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('Password must be at least 6 characters');
      return;
    }

    setPwError(null);
    setUpdatingPw(true);
    try {
      await axios.post('/api/auth/update-password', {
        currentPassword,
        newPassword,
      });
      setPwSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(null), 4000);
    } catch (err: any) {
      setPwError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setUpdatingPw(false);
    }
  };

  // =========================================================================
  // SIGNAL UI RENDERER: MASTER CATEGORY MENU OR DRILLDOWN SUB-PAGES
  // =========================================================================

  return (
    <div className="max-w-2xl mx-auto p-3 sm:p-5 font-['Plus_Jakarta_Sans',sans-serif] min-h-[90vh]">
      {/* ========================================================================= */}
      {/* 1. SIGNAL SETTINGS ROOT MENU */}
      {/* ========================================================================= */}
      {currentSection === 'main' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Header Title */}
          <div className="flex items-center justify-between pb-1">
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>Settings</span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                Signal Privacy
              </span>
            </h1>

            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-gold-500/30 text-amber-300 text-xs font-black flex items-center gap-1.5 hover:from-amber-500 hover:to-yellow-400 hover:text-dark-950 transition-all cursor-pointer shadow-sm"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Admin Panel</span>
              </button>
            )}
          </div>

          {/* Profile Card Header (Signal Style) */}
          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center justify-between gap-3 group">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative">
                <img
                  src={user?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username}`}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-gold-400/40 shadow-md"
                />
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-dark-900" />
              </div>

              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-extrabold text-white truncate">
                  {user?.full_name || user?.username}
                </h2>
                <div className="flex items-center gap-2 text-xs text-dark-300 font-mono mt-0.5">
                  <span className="text-amber-300 font-semibold select-all">@{user?.username}</span>
                  <span>•</span>
                  <span className="text-[11px] text-dark-400 truncate max-w-[120px] sm:max-w-none">
                    {user?.id}
                  </span>
                </div>
                <p className="text-[11px] text-dark-400 italic truncate mt-1">
                  {user?.status || 'Hey there! I am using Nexus.'}
                </p>
              </div>
            </div>

            {/* QR Code Quick Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="p-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-gold-300 border border-white/10 hover:border-gold-500/30 transition-all cursor-pointer"
                title="View QR Code & Handle"
              >
                <QrCode className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Signal Categorized Settings Groups */}
          <div className="space-y-3">
            {/* GROUP 1: ESSENTIALS */}
            <div className="bg-dark-900/90 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5 shadow-md">
              {/* 1. Account */}
              <button
                type="button"
                onClick={() => setCurrentSection('account')}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Account</h3>
                    <p className="text-xs text-dark-400">PIN, passwords, backups, delete account</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-dark-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 2. Linked Devices */}
              <button
                type="button"
                onClick={() => setCurrentSection('linked_devices')}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Linked Devices</h3>
                    <p className="text-xs text-dark-400">Active sessions, link Web / Desktop</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-dark-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 3. Donate / Royal Mission */}
              <button
                type="button"
                onClick={() => setCurrentSection('donate')}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Heart className="w-5 h-5 fill-amber-400/20" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>Donate to Nexus</span>
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                        Free Forever
                      </span>
                    </h3>
                    <p className="text-xs text-dark-400">Support non-profit private messaging</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-dark-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            {/* GROUP 2: PREFERENCES */}
            <div className="bg-dark-900/90 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5 shadow-md">
              {/* 4. Appearance */}
              <button
                type="button"
                onClick={() => setCurrentSection('appearance')}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Appearance</h3>
                    <p className="text-xs text-dark-400">Theme, luxury gold accents, font sizing</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-dark-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 5. Chats */}
              <button
                type="button"
                onClick={() => setCurrentSection('chats')}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Chats</h3>
                    <p className="text-xs text-dark-400">Wallpapers, enter sends, media auto-download</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-dark-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 6. Notifications */}
              <button
                type="button"
                onClick={() => setCurrentSection('notifications')}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Notifications</h3>
                    <p className="text-xs text-dark-400">Messages & call chimes, vibration, privacy previews</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-dark-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 7. Privacy (Signal Flagship) */}
              <button
                type="button"
                onClick={() => setCurrentSection('privacy')}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>Privacy</span>
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    </h3>
                    <p className="text-xs text-dark-400">Screen lock, relay calls, incognito, blocked list</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-dark-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 8. Data and Storage */}
              <button
                type="button"
                onClick={() => setCurrentSection('data')}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Data and Storage</h3>
                    <p className="text-xs text-dark-400">Manage storage, proxy bypass, low data saver</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-dark-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            {/* GROUP 3: HELP & SYSTEM */}
            <div className="bg-dark-900/90 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5 shadow-md">
              {/* 9. Help & About */}
              <button
                type="button"
                onClick={() => setCurrentSection('help')}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-500/15 text-slate-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Help & About</h3>
                    <p className="text-xs text-dark-400">Version 2.6.0, privacy policy, terms, support</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-dark-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>

          {/* Quick Sign Out Footer Button */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={logout}
              className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1.5 mx-auto py-2.5 px-4 rounded-xl hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out of NexusRoyal</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUB-SECTION: PRIVACY (SIGNAL FLAGSHIP PRIVACY CONTROLS) */}
      {/* ========================================================================= */}
      {currentSection === 'privacy' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Sub Header */}
          <div className="flex items-center gap-3 pb-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => setCurrentSection('main')}
              className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-black text-white">Privacy</h2>
              <p className="text-xs text-dark-400">Signal-grade security, anti-tracking & locks</p>
            </div>
          </div>

          {/* Group A: App Security */}
          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-4 shadow-md">
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>App Security</span>
            </h3>

            {/* Screen Security (Block screenshots / previews) */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Screen Security</p>
                <p className="text-xs text-dark-400">Block screenshots in app switcher and previews</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={screenSecurity}
                  onChange={(e) => handleToggleScreenSecurity(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* Incognito Keyboard */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
              <div>
                <p className="text-sm font-bold text-white">Incognito Keyboard</p>
                <p className="text-xs text-dark-400">Request keyboard to disable personalized learning</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={incognitoKeyboard}
                  onChange={(e) => handleToggleIncognitoKeyboard(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* Biometric Lock */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Fingerprint className="w-4 h-4 text-emerald-400" />
                  <span>Screen Lock (Biometric / Face ID)</span>
                </p>
                <p className="text-xs text-dark-400">Lock Nexus when app is in the background</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={biometricEnabled}
                  onChange={(e) => handleToggleBiometric(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Screen Lock Inactivity Timeout */}
            <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Screen Lock Timeout</p>
                <p className="text-xs text-dark-400">Time before requiring authentication</p>
              </div>
              <select
                value={screenLockTimeout}
                onChange={(e) => handleSelectScreenLockTimeout(e.target.value)}
                className="bg-dark-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="immediately">Immediately</option>
                <option value="1m">1 minute</option>
                <option value="5m">5 minutes</option>
                <option value="15m">15 minutes</option>
                <option value="1h">1 hour</option>
              </select>
            </div>
          </div>

          {/* Group B: Messaging Privacy */}
          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-4 shadow-md">
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Messaging Privacy</span>
            </h3>

            {/* Read Receipts */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Read Receipts</p>
                <p className="text-xs text-dark-400">If disabled, you won't see or send read receipts</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={readReceipts}
                  onChange={(e) => setReadReceipts(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* Typing Indicators */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
              <div>
                <p className="text-sm font-bold text-white">Typing Indicators</p>
                <p className="text-xs text-dark-400">If disabled, others won't see when you're typing</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={typingIndicators}
                  onChange={(e) => handleToggleTypingIndicators(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* Disappearing Messages Default Timer */}
            <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Disappearing Messages Timer</p>
                <p className="text-xs text-dark-400">Set default auto-deletion timer for new chats</p>
              </div>
              <select
                value={disappearingDefaultTimer}
                onChange={(e) => handleSelectDisappearingTimer(e.target.value)}
                className="bg-dark-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="off">Off</option>
                <option value="30s">30 seconds</option>
                <option value="5m">5 minutes</option>
                <option value="1h">1 hour</option>
                <option value="8h">8 hours</option>
                <option value="1d">1 day</option>
                <option value="1w">1 week</option>
                <option value="4w">4 weeks</option>
              </select>
            </div>
          </div>

          {/* Group C: Calling Privacy (Signal's IP Relay Feature) */}
          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-4 shadow-md">
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>Calling & Network Privacy</span>
            </h3>

            {/* Always Relay Calls */}
            <div className="flex items-start justify-between gap-3">
              <div className="pr-2">
                <p className="text-sm font-bold text-white">Always Relay Calls</p>
                <p className="text-xs text-dark-400 leading-relaxed mt-0.5">
                  Relay all voice & video calls through Nexus Royal servers to avoid revealing your IP address to your contacts.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={alwaysRelayCalls}
                  onChange={(e) => handleToggleAlwaysRelayCalls(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* Who can call me */}
            <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Who Can Call Me</p>
                <p className="text-xs text-dark-400">Limit incoming call requests</p>
              </div>
              <select
                value={allowCallsFrom}
                onChange={(e) => setAllowCallsFrom(e.target.value as any)}
                className="bg-dark-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="everyone">Everyone</option>
                <option value="contacts">My Contacts</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
          </div>

          {/* Group D: Status & Visibility */}
          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-4 shadow-md">
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              <span>Visibility & Profile</span>
            </h3>

            {/* Last Seen */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Last Seen Time</p>
                <p className="text-xs text-dark-400">Control who can see your timestamp</p>
              </div>
              <select
                value={whoCanSeeLastSeen}
                onChange={(e) => setWhoCanSeeLastSeen(e.target.value as any)}
                className="bg-dark-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="everyone">Everyone</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>

            {/* Online Status */}
            <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Online Status Indicator</p>
                <p className="text-xs text-dark-400">Display green active presence dot</p>
              </div>
              <select
                value={whoCanSeeOnlineStatus}
                onChange={(e) => setWhoCanSeeOnlineStatus(e.target.value as any)}
                className="bg-dark-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="everyone">Everyone</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>

            {/* Profile Photo */}
            <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Profile Photo</p>
                <p className="text-xs text-dark-400">Who can see your picture & avatar</p>
              </div>
              <select
                value={whoCanSeeProfilePhoto}
                onChange={(e) => setWhoCanSeeProfilePhoto(e.target.value as any)}
                className="bg-dark-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="everyone">Everyone</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
          </div>

          {/* Group E: Blocked Users List */}
          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-3 shadow-md">
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <UserX className="w-3.5 h-3.5" />
                <span>Blocked Contacts ({blockedUsers.length})</span>
              </span>
              <button
                type="button"
                onClick={fetchBlockedUsers}
                className="text-[10px] text-dark-400 hover:text-white"
              >
                Refresh
              </button>
            </h3>

            {loadingBlocks ? (
              <p className="text-xs text-dark-500 py-2">Loading blocked users...</p>
            ) : blockedUsers.length === 0 ? (
              <p className="text-xs text-dark-400 py-2">No blocked users.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {blockedUsers.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-dark-800 border border-white/5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {b.blocked_user?.full_name || `@${b.blocked_user?.username}`}
                      </p>
                      <p className="text-[10px] text-dark-400 font-mono">@{b.blocked_user?.username}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblockUser(b.blocked_user_id)}
                      className="px-2.5 py-1 text-xs font-bold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg border border-cyan-400/30 transition-all cursor-pointer"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save Button for Server Sync */}
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={savingSettings}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-dark-950 font-black text-sm shadow-lg shadow-cyan-500/20 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {savingSettings ? 'Saving Privacy...' : settingsSuccess ? '✓ Saved!' : 'Save Privacy Changes'}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUB-SECTION: ACCOUNT (PIN, PASSWORDS, REGISTRATION LOCK, DELETE) */}
      {/* ========================================================================= */}
      {currentSection === 'account' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => setCurrentSection('main')}
              className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-black text-white">Account</h2>
              <p className="text-xs text-dark-400">Credentials, PINs, and identity security</p>
            </div>
          </div>

          {/* User ID & Registration Details */}
          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-3 shadow-md">
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-400">Account Credentials</h3>
            
            <div className="flex items-center justify-between p-3 rounded-xl bg-dark-800 border border-white/5">
              <div>
                <p className="text-[10px] text-dark-400 font-bold uppercase">User ID</p>
                <p className="text-xs font-mono font-bold text-amber-300">{user?.id}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (user?.id) {
                    navigator.clipboard.writeText(user.id);
                    alert('User ID copied to clipboard!');
                  }
                }}
                className="p-2 rounded-lg bg-white/5 text-dark-300 hover:text-white cursor-pointer"
                title="Copy User ID"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-dark-800 border border-white/5">
              <div>
                <p className="text-[10px] text-dark-400 font-bold uppercase">Username Handle</p>
                <p className="text-xs font-mono font-bold text-white">@{user?.username}</p>
              </div>
              <button
                type="button"
                onClick={handleCopyUserHandle}
                className="p-2 rounded-lg bg-white/5 text-dark-300 hover:text-white cursor-pointer"
                title="Copy Handle"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-dark-800 border border-white/5">
              <div>
                <p className="text-[10px] text-dark-400 font-bold uppercase">Email Address</p>
                <p className="text-xs font-bold text-white">{user?.email || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Signal Registration Lock */}
          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>Registration Lock</span>
                </h3>
                <p className="text-xs text-dark-400 leading-relaxed mt-0.5">
                  Require your PIN or password to register this User ID again on any device. Protects your account from SIM swaps and takeovers.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={registrationLock}
                  onChange={(e) => handleToggleRegistrationLock(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
          </div>

          {/* 4-Digit Signal Vault PIN */}
          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-3 shadow-md">
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              <span>Signal PIN Vault</span>
            </h3>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">4-Digit Security PIN</p>
                <p className="text-xs text-dark-400">Protects your chats and unlocks private storage</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinEnabled}
                  onChange={(e) => setPinEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>

            {pinEnabled && (
              <div className="pt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="Enter 4-digit PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    className="px-3 py-2 bg-dark-800 border border-white/10 rounded-xl text-xs text-white placeholder-dark-500 focus:outline-none focus:border-blue-400 font-mono tracking-widest text-center w-36"
                  />
                  <button
                    type="button"
                    onClick={handleSavePin}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Save PIN
                  </button>
                  <button
                    type="button"
                    onClick={handleLockNow}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-dark-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Lock Now
                  </button>
                </div>
                {pinMessage && (
                  <p className={`text-xs ${pinMessage.isError ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {pinMessage.text}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Change Password Form */}
          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-3 shadow-md">
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Change Password</span>
            </h3>

            {pwError && <p className="text-xs text-rose-400">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-emerald-400">{pwSuccess}</p>}

            <form onSubmit={handlePasswordChange} className="space-y-2.5">
              <input
                type="password"
                placeholder="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-xl text-xs text-white placeholder-dark-500 focus:outline-none focus:border-blue-400"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="password"
                  placeholder="New Password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-xl text-xs text-white placeholder-dark-500 focus:outline-none focus:border-blue-400"
                />
                <input
                  type="password"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-xl text-xs text-white placeholder-dark-500 focus:outline-none focus:border-blue-400"
                />
              </div>
              <button
                type="submit"
                disabled={updatingPw}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {updatingPw ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Danger Zone: Log Out All & Delete Account */}
          <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Danger Zone</span>
            </h3>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Log Out All Other Devices</p>
                <p className="text-[11px] text-dark-400">Revoke access on all linked sessions</p>
              </div>
              <button
                type="button"
                onClick={handleLogoutAll}
                disabled={loggingOutAll}
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer"
              >
                {loggingOutAll ? 'Logging out...' : 'Log Out All'}
              </button>
            </div>

            <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-rose-400">Delete Account</p>
                <p className="text-[11px] text-dark-400">Permanently delete all profile data & chats</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SUB-SECTION: LINKED DEVICES (SIGNAL DESKTOP & WEB PAIRING) */}
      {/* ========================================================================= */}
      {currentSection === 'linked_devices' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => setCurrentSection('main')}
              className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-black text-white">Linked Devices</h2>
              <p className="text-xs text-dark-400">Manage connected desktop and web clients</p>
            </div>
          </div>

          <div className="bg-dark-900 border border-white/10 rounded-2xl p-5 text-center space-y-4 shadow-md">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
              <Laptop className="w-8 h-8" />
            </div>

            <div className="max-w-xs mx-auto">
              <h3 className="text-sm font-black text-white">Link Nexus Desktop or Web</h3>
              <p className="text-xs text-dark-400 mt-1">
                Scan the QR code displayed on your computer to securely link your device.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-xs font-black shadow-lg shadow-indigo-500/25 hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              <span>Link New Device</span>
            </button>
          </div>

          {/* Current Device Item */}
          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-3 shadow-md">
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400">This Device</h3>
            
            <div className="flex items-center justify-between p-3 rounded-xl bg-dark-800 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Active Session</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </p>
                  <p className="text-[10px] text-dark-400">PWA / Web Client • Current</p>
                </div>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10">
                Online
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SUB-SECTION: CHATS (WALLPAPERS, ENTER KEY, MEDIA DOWNLOAD, CLEAR) */}
      {/* ========================================================================= */}
      {currentSection === 'chats' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => setCurrentSection('main')}
              className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-black text-white">Chats</h2>
              <p className="text-xs text-dark-400">Wallpapers, inputs, and media handling</p>
            </div>
          </div>

          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-4 shadow-md">
            {/* Enter is Send */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">"Enter" Key Sends Message</p>
                <p className="text-xs text-dark-400">Pressing Enter will send instead of newline</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enterIsSend}
                  onChange={(e) => handleToggleEnterIsSend(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Media Auto-Download */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <p className="text-sm font-bold text-white">Media Auto-Download</p>
              <p className="text-xs text-dark-400">Automatically download photos and audio notes</p>
              
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-dark-800 border border-white/5 flex items-center justify-between">
                  <span className="text-xs text-white">When on Wi-Fi</span>
                  <span className="text-[10px] text-emerald-400 font-bold">All Media</span>
                </div>
                <div className="p-2.5 rounded-xl bg-dark-800 border border-white/5 flex items-center justify-between">
                  <span className="text-xs text-white">On Cellular</span>
                  <span className="text-[10px] text-amber-300 font-bold">Photos Only</span>
                </div>
              </div>
            </div>

            {/* Chat Wallpaper Theme */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <p className="text-sm font-bold text-white">Chat Wallpaper</p>
              <p className="text-xs text-dark-400">Background accent for messaging threads</p>
              
              <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1">
                {[
                  { id: 'dark', label: 'Dark Slate', color: '#13151b' },
                  { id: 'gold', label: 'Royal Gold', color: '#2a220b' },
                  { id: 'midnight', label: 'Midnight', color: '#09152b' },
                  { id: 'emerald', label: 'Forest', color: '#082618' },
                ].map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    style={{ backgroundColor: w.color }}
                    className="h-10 px-3.5 rounded-xl border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-105 transition-transform"
                  >
                    <span>{w.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SUB-SECTION: NOTIFICATIONS (SIGNAL SOUNDS & PRIVACY PREVIEWS) */}
      {/* ========================================================================= */}
      {currentSection === 'notifications' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => setCurrentSection('main')}
              className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-black text-white">Notifications</h2>
              <p className="text-xs text-dark-400">Tones, vibration, and preview privacy</p>
            </div>
          </div>

          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-4 shadow-md">
            {/* Chime Tones */}
            <div>
              <p className="text-sm font-bold text-white mb-1">Message & Call Chime</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'royal_gold', label: 'Royal Gold 🔔' },
                  { id: 'crystal', label: 'Crystal 💎' },
                  { id: 'harp', label: 'Harp 🎶' },
                ].map((tone) => (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => handleSelectChime(tone.id)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      chimeSound === tone.id
                        ? 'bg-rose-500/20 text-rose-300 border-rose-400/40 shadow-sm'
                        : 'bg-dark-800 text-dark-300 border-white/5 hover:text-white'
                    }`}
                  >
                    <span>{tone.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* In-chat sounds */}
            <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">In-Chat Sounds</p>
                <p className="text-xs text-dark-400">Play subtle sound when sending and receiving</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSound}
                  onChange={(e) => setNotificationSound(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
              </label>
            </div>

            {/* Signal Notification Privacy Preview */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <div>
                <p className="text-sm font-bold text-white">Show in Notification</p>
                <p className="text-xs text-dark-400">Signal-style lock screen privacy previews</p>
              </div>
              <select
                value={notifPreviewType}
                onChange={(e) => handleSelectNotifPreview(e.target.value)}
                className="w-full bg-dark-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400 cursor-pointer"
              >
                <option value="all">Name, content, and actions (Default)</option>
                <option value="name_only">Name only (Hide message text)</option>
                <option value="none">No name or content (Maximum Privacy)</option>
              </select>
            </div>

            {/* Push Diagnostics */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <p className="text-sm font-bold text-white">Push Diagnostics</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleActivatePush}
                  disabled={activating}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-bold hover:bg-rose-500/25 transition-all cursor-pointer"
                >
                  {activating ? 'Activating...' : 'Activate Web Push'}
                </button>
                <button
                  type="button"
                  onClick={() => handleTestServerPush('message')}
                  disabled={testSent}
                  className="px-3.5 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-white border border-white/10 text-xs font-bold transition-all cursor-pointer"
                >
                  {testSent ? 'Sending...' : 'Test Server Push'}
                </button>
                <button
                  type="button"
                  onClick={handleTestLocalAlert}
                  className="px-3.5 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-white border border-white/10 text-xs font-bold transition-all cursor-pointer"
                >
                  Test Local Chime
                </button>
              </div>
              {activateError && <p className="text-xs text-rose-400 pt-1">{activateError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. SUB-SECTION: DATA AND STORAGE (STORAGE, PROXY, LOW DATA SAVER) */}
      {/* ========================================================================= */}
      {currentSection === 'data' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => setCurrentSection('main')}
              className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-black text-white">Data and Storage</h2>
              <p className="text-xs text-dark-400">Cache storage, proxy bypass & compression</p>
            </div>
          </div>

          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-4 shadow-md">
            {/* Storage Manager */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-teal-400" />
                  <span>Manage Storage</span>
                </p>
                <p className="text-xs text-dark-400">Messages, media cache, and temporary buffers</p>
              </div>
              <button
                type="button"
                onClick={handleClearCache}
                disabled={clearingCache}
                className="px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold cursor-pointer"
              >
                {clearingCache ? 'Cleaning...' : cacheClearedSuccess ? '✓ Cleared' : 'Clear Cache'}
              </button>
            </div>

            {/* Sent Media Quality */}
            <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Sent Media Quality</p>
                <p className="text-xs text-dark-400">Faster sending vs original high fidelity</p>
              </div>
              <select
                value={sentMediaQuality}
                onChange={(e) => handleSelectSentMediaQuality(e.target.value)}
                className="bg-dark-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400 cursor-pointer"
              >
                <option value="high">High Quality (Original)</option>
                <option value="standard">Standard Compression</option>
              </select>
            </div>

            {/* Low Data Mode */}
            <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Low Data Saver Mode</p>
                <p className="text-xs text-dark-400">Reduce bandwidth consumption during calls & media</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={lowDataMode}
                  onChange={(e) => handleToggleLowDataMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
              </label>
            </div>

            {/* Signal Censorship Bypass Proxy */}
            <div className="pt-3 border-t border-white/5 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-teal-400" />
                    <span>Censorship Bypass Proxy</span>
                  </p>
                  <p className="text-xs text-dark-400 leading-relaxed mt-0.5">
                    Connect through a Signal-compatible TLS / HTTPS proxy if your local network blocks chat servers.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={proxyEnabled}
                    onChange={(e) => handleToggleProxy(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                </label>
              </div>

              {proxyEnabled && (
                <div className="pt-1">
                  <input
                    type="text"
                    value={proxyHost}
                    onChange={(e) => handleSaveProxyHost(e.target.value)}
                    placeholder="proxy.example.com:443"
                    className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-teal-400"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. SUB-SECTION: APPEARANCE (LUXURY GOLD ACCENTS & THEMES) */}
      {/* ========================================================================= */}
      {currentSection === 'appearance' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => setCurrentSection('main')}
              className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-black text-white">Appearance</h2>
              <p className="text-xs text-dark-400">Themes, luxury color accents, and styles</p>
            </div>
          </div>

          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-4 shadow-md">
            <div>
              <p className="text-sm font-bold text-white mb-1">Color Palette</p>
              <p className="text-xs text-dark-400 mb-3">Select your visual luxury aesthetic</p>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'royal_gold', label: 'Royal Gold 👑', gradient: 'from-amber-500 to-yellow-400' },
                  { id: 'emerald', label: 'Imperial Emerald 💎', gradient: 'from-emerald-500 to-teal-400' },
                  { id: 'sapphire', label: 'Midnight Sapphire 🌌', gradient: 'from-blue-600 to-indigo-500' },
                  { id: 'ruby', label: 'Velvet Ruby 🍷', gradient: 'from-rose-600 to-pink-500' },
                ].map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => handleSelectTheme(th.id)}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      selectedTheme === th.id
                        ? 'bg-dark-800 text-white border-gold-400 shadow-md ring-1 ring-gold-400/50'
                        : 'bg-dark-850 text-dark-300 border-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-r ${th.gradient} shrink-0`} />
                    <span className="truncate">{th.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {(pwaState.isInstallable || !pwaState.isStandalone) && (
              <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Install Standalone App</p>
                  <p className="text-xs text-dark-400">Install NexusRoyal directly onto home screen</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInstallModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-gold-500/20 text-amber-300 border border-gold-500/30 text-xs font-bold hover:bg-gold-500/30 transition-all cursor-pointer"
                >
                  Install App
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. SUB-SECTION: DONATE TO NEXUS (FREE FOREVER MISSION) */}
      {/* ========================================================================= */}
      {currentSection === 'donate' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => setCurrentSection('main')}
              className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-black text-white">Donate to NexusRoyal</h2>
              <p className="text-xs text-dark-400">100% Free Forever • Open Privacy Mission</p>
            </div>
          </div>

          <div className="bg-dark-900 border border-gold-500/25 rounded-2xl p-6 text-center space-y-4 shadow-xl royal-card">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 text-dark-950 flex items-center justify-center shadow-lg shadow-gold-500/25">
              <Crown className="w-8 h-8 fill-dark-950" />
            </div>

            <div className="max-w-sm mx-auto space-y-2">
              <h3 className="text-lg font-black text-white">
                <span className="gold-gradient-text">Nexus is 100% Free Forever</span>
              </h3>
              <p className="text-xs text-dark-300 leading-relaxed">
                Like Signal, Nexus is dedicated to open, private communication with zero ads, zero data selling, and zero paywalls.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-800 border border-gold-500/20 text-xs text-amber-200/90 font-bold">
              👑 Royal Lifetime Member: Active
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. SUB-SECTION: HELP & ABOUT */}
      {/* ========================================================================= */}
      {currentSection === 'help' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => setCurrentSection('main')}
              className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-black text-white">Help & About</h2>
              <p className="text-xs text-dark-400">Application info and official guidelines</p>
            </div>
          </div>

          <div className="bg-dark-900 border border-white/10 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-xs text-white font-bold">App Version</span>
              <span className="text-xs font-mono text-cyan-400 font-semibold">v2.6.0 (Signal Edition)</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-xs text-white font-bold">Encryption Protocol</span>
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>E2EE Active</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-y-2 py-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, '', '/about');
                  window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: 'about' }));
                }}
                className="text-xs text-amber-300 hover:underline cursor-pointer"
              >
                About Us
              </button>
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, '', '/contact');
                  window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: 'contact' }));
                }}
                className="text-xs text-amber-300 hover:underline cursor-pointer"
              >
                Contact Support
              </button>
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, '', '/community-guidelines');
                  window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: 'community-guidelines' }));
                }}
                className="text-xs text-amber-300 hover:underline cursor-pointer"
              >
                Guidelines
              </button>
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, '', '/terms');
                  window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: 'terms' }));
                }}
                className="text-xs text-cyan-400 hover:underline cursor-pointer"
              >
                Terms of Service
              </button>
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, '', '/privacy');
                  window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: 'privacy' }));
                }}
                className="text-xs text-cyan-400 hover:underline cursor-pointer"
              >
                Privacy Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS & OVERLAYS */}
      {/* ========================================================================= */}

      {/* Profile QR Code Modal (Signal Style) */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-dark-900 border border-gold-500/35 rounded-3xl p-6 text-center space-y-4 royal-card">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-dark-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 mx-auto rounded-full bg-dark-800 p-1 border border-gold-400/40">
              <img
                src={user?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username}`}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-white">{user?.full_name}</h3>
              <p className="text-xs text-amber-300 font-mono font-bold">@{user?.username}</p>
            </div>

            {/* Generated QR Matrix Preview */}
            <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl flex items-center justify-center shadow-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  `https://nexusroyal.online/#/user/${user?.username || user?.id}`
                )}`}
                alt="QR Code"
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-[11px] text-dark-400">
              Friends can scan this QR code or search <strong>@{user?.username}</strong> to start an encrypted chat.
            </p>

            <button
              type="button"
              onClick={handleCopyUserHandle}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-dark-950 font-black text-xs cursor-pointer shadow-md"
            >
              {copiedHandle ? '✓ Handle Copied!' : 'Copy Private Handle'}
            </button>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/90 backdrop-blur-md">
          <div className="bg-dark-900 border border-rose-500/30 p-6 rounded-3xl max-w-sm w-full space-y-4">
            <h3 className="text-base font-black text-rose-400">Delete Account Permanently</h3>
            <p className="text-xs text-dark-300">
              This action cannot be undone. Type <strong>delete</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'delete'"
              className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-xl text-xs text-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2 bg-dark-800 text-white rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 py-2 bg-rose-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
              >
                {deletingAccount ? 'Deleting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Royal Admin Dashboard Modal */}
      <AdminDashboardModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} />

      {/* PWA Standalone Install Modal */}
      <InstallModal isOpen={isInstallModalOpen} onClose={() => setIsInstallModalOpen(false)} pwaState={pwaState} />
    </div>
  );
};
