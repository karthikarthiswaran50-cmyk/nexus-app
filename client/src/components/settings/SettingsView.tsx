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
  LogOut,
  CheckCircle2,
  AlertCircle,
  Crown,
  BellRing,
  Smartphone,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
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

export const SettingsView: React.FC = () => {
  const { user, settings, updateSettings, logout } = useAuth();
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const [allowCallsFrom, setAllowCallsFrom] = useState(settings?.allow_calls_from || 'everyone');
  const [notificationSound, setNotificationSound] = useState(settings?.notification_sound ?? true);
  const [readReceipts, setReadReceipts] = useState(settings?.read_receipts ?? true);

  // System push notification state
  const [notifPermission, setNotifPermission] = useState(getNotificationPermissionStatus());
  const [pushSubCount, setPushSubCount] = useState<number | null>(null);
  const [activating, setActivating] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testResult, setTestResult] = useState<{ delivered: boolean } | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);

  // Fetch push subscription count from server
  const fetchPushSubStatus = async () => {
    try {
      const res = await axios.get('/api/notifications/subscriptions');
      setPushSubCount(res.data.webPushSubscriptions || 0);
    } catch (e) {
      setPushSubCount(null);
    }
  };

  useEffect(() => {
    setNotifPermission(getNotificationPermissionStatus());
    fetchPushSubStatus();
  }, []);

  // STEP 1+2: Request permission → Subscribe push → save to server
  const handleActivatePush = async () => {
    setActivating(true);
    setActivateError(null);
    try {
      let perm = Notification.permission;
      if (perm !== 'granted') {
        perm = await Notification.requestPermission();
      }
      if (perm !== 'granted') {
        setActivateError('❌ Permission denied in browser. Please allow notifications in your phone browser settings.');
        setActivating(false);
        return;
      }
      setNotifPermission('granted');

      // Force-register push subscription
      const ok = await subscribeToWebPush(true);
      if (!ok) {
        setActivateError('⚠️ Could not register push subscription. Try again or use a different browser (Chrome recommended).');
        setActivating(false);
        return;
      }

      // Register FCM token too
      try {
        const fcmToken = await requestFcmToken();
        if (fcmToken) {
          await axios.post('/api/users/fcm-token', { token: fcmToken });
        }
      } catch (e) {}

      // Verify push sub was saved
      await fetchPushSubStatus();
      setActivateError(null);
    } catch (err: any) {
      setActivateError('Error: ' + (err?.message || 'Unknown error'));
    } finally {
      setActivating(false);
    }
  };

  // STEP 3: Send actual push through server (tests end-to-end delivery)
  const handleTestServerPush = async (type: 'call' | 'message') => {
    setTestSent(true);
    setTestResult(null);
    try {
      const res = await axios.post('/api/notifications/test', { type });
      setTestResult({ delivered: res.data.delivered });
    } catch (e) {
      setTestResult({ delivered: false });
    }
    setTimeout(() => { setTestSent(false); setTestResult(null); }, 5000);
  };

  // In-app local alert test (to verify browser notification permission)
  const handleTestLocalAlert = () => {
    showCallNotification('Nexus Royal Alert', 'video');
  };



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
        allow_calls_from: allowCallsFrom as any,
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

  return (
    <div className="max-w-4xl mx-auto p-3.5 sm:p-6 space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      
      {/* 👑 Royal Settings Header */}
      <div className="bg-dark-900 border border-gold-500/20 p-6 rounded-3xl shadow-xl flex items-center justify-between royal-card">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-gold-400 fill-gold-400" />
            <span className="gold-gradient-text">Royal Security & Preferences</span>
          </h2>
          <p className="text-xs text-dark-300 mt-1">Configure your privacy, call permissions, and quantum encryption settings.</p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out</span>
        </button>
      </div>

      {settingsSuccess && (
        <div className="p-3.5 px-5 rounded-2xl bg-dark-900/95 border border-gold-500/40 text-amber-200 text-xs font-bold flex items-center gap-2 shadow-2xl backdrop-blur-xl animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-gold-400" />
          <span>Preferences updated successfully!</span>
        </div>
      )}

      {/* Preferences Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Privacy & Calling Permissions */}
        <div className="bg-dark-900 border border-gold-500/15 rounded-3xl p-6 space-y-5 shadow-xl royal-card">
          <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-gold-500/15 pb-3">
            <Shield className="w-4 h-4 text-gold-400" />
            <span>Calling Privacy Controls</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-dark-300 mb-2">Who can call you?</label>
              <select
                value={allowCallsFrom}
                onChange={(e) => setAllowCallsFrom(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-dark-850 border border-gold-500/20 rounded-xl text-xs text-white focus:outline-none focus:border-gold-400"
              >
                <option value="everyone">Everyone (Open Realm)</option>
                <option value="contacts">Contacts / Active Chats Only</option>
                <option value="subscribers">Subscribers Only</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs font-bold text-white">Incoming Call & Message Sounds</p>
                <p className="text-[11px] text-dark-400">Play audio ringtones on calls</p>
              </div>
              <input
                type="checkbox"
                checked={notificationSound}
                onChange={(e) => setNotificationSound(e.target.checked)}
                className="w-4 h-4 accent-gold-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs font-bold text-white">Read Receipts (Blue Ticks)</p>
                <p className="text-[11px] text-dark-400">Let senders see when you read messages</p>
              </div>
              <input
                type="checkbox"
                checked={readReceipts}
                onChange={(e) => setReadReceipts(e.target.checked)}
                className="w-4 h-4 accent-gold-500 rounded cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleSavePreferences}
              disabled={savingSettings}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black text-xs shadow-lg shadow-gold-500/25 transition-all active:scale-95"
            >
              {savingSettings ? 'Saving...' : 'Save Privacy Preferences'}
            </button>
            {settingsError && (
              <p className="text-xs text-rose-400 text-center font-semibold animate-in fade-in duration-200">{settingsError}</p>
            )}
          </div>
        </div>

        {/* 🔐 Royal Vault PIN Lock Card */}
        <div className="bg-dark-900 border border-gold-500/15 rounded-3xl p-6 space-y-5 shadow-xl royal-card">
          <h3 className="text-sm font-black text-white flex items-center justify-between border-b border-gold-500/15 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-gold-400" />
              <span>Royal Vault App Lock (PIN)</span>
            </div>
            {localStorage.getItem('nexus_app_pin') && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30">
                ACTIVE
              </span>
            )}
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Enable 4-Digit Security PIN</p>
                <p className="text-[11px] text-dark-400">Lock app with PIN whenever opened</p>
              </div>
              <input
                type="checkbox"
                checked={pinEnabled}
                onChange={(e) => setPinEnabled(e.target.checked)}
                className="w-4 h-4 accent-gold-500 rounded cursor-pointer"
              />
            </div>

            {pinEnabled && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-dark-300 mb-1.5">
                    {localStorage.getItem('nexus_app_pin') ? 'Update 4-Digit PIN' : 'Set New 4-Digit PIN'}
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 1234"
                    className="w-full px-4 py-2.5 bg-dark-850 border border-gold-500/20 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 font-mono tracking-widest text-center text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSavePin}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-dark-950 font-black text-xs shadow-md shadow-gold-500/20 transition-all active:scale-95"
                  >
                    Save PIN
                  </button>
                  {localStorage.getItem('nexus_app_pin') && (
                    <button
                      type="button"
                      onClick={handleLockNow}
                      className="px-3 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-amber-300 border border-gold-500/30 text-xs font-bold transition-all"
                    >
                      Lock Now
                    </button>
                  )}
                </div>
              </div>
            )}

            {pinMessage && (
              <p className={`text-xs text-center font-semibold animate-in fade-in duration-200 ${pinMessage.isError ? 'text-rose-400' : 'text-emerald-400'}`}>
                {pinMessage.text}
              </p>
            )}
          </div>
        </div>

        {/* 👑 Royal Owner & Admin Controls Card (Exclusive to karthikarthiswaran50) */}
        {(user?.role === 'admin' || user?.email?.toLowerCase().includes('karthikarthiswaran50') || user?.username?.toLowerCase() === 'karthikarthiswaran50' || user?.username?.toLowerCase() === 'dark') && (
          <div className="bg-dark-900 border border-gold-500/25 rounded-3xl p-6 space-y-4 shadow-xl royal-card">
            <h3 className="text-sm font-black text-white flex items-center justify-between border-b border-gold-500/15 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-gold-400" />
                <span>Royal Owner & Admin Controls</span>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30">
                👑 VERIFIED OWNER
              </span>
            </h3>

            <p className="text-xs text-dark-300 leading-relaxed">
              Manage registered members, suspend or ban accounts, broadcast global announcements, and review real-time infrastructure analytics.
            </p>

            <button
              type="button"
              onClick={() => setIsAdminModalOpen(true)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-500 hover:from-amber-500 hover:to-yellow-400 text-dark-950 font-black text-xs shadow-lg shadow-gold-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Shield className="w-4 h-4" />
              <span>Open Royal Command Center</span>
            </button>
          </div>
        )}

        {/* Change Password Card */}
        <div className="bg-dark-900 border border-gold-500/15 rounded-3xl p-6 space-y-5 shadow-xl royal-card">
          <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-gold-500/15 pb-3">
            <Lock className="w-4 h-4 text-gold-400" />
            <span>Update Vault Password</span>
          </h3>

          {pwError && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{pwError}</span>
            </div>
          )}

          {pwSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{pwSuccess}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-dark-300 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2 bg-dark-850 border border-gold-500/20 rounded-xl text-xs text-white focus:outline-none focus:border-gold-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-dark-300 mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2 bg-dark-850 border border-gold-500/20 rounded-xl text-xs text-white focus:outline-none focus:border-gold-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-dark-300 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2 bg-dark-850 border border-gold-500/20 rounded-xl text-xs text-white focus:outline-none focus:border-gold-400"
              />
            </div>

            <button
              type="submit"
              disabled={updatingPw}
              className="w-full py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-amber-200 border border-gold-500/30 hover:border-gold-400 font-bold text-xs transition-all active:scale-95"
            >
              {updatingPw ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* 🔔 Push Notification Activation Card */}
        <div className="bg-dark-900 border border-gold-500/15 rounded-3xl p-6 space-y-5 shadow-xl royal-card md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gold-500/15 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gold-500/15 border border-gold-500/35 flex items-center justify-center text-gold-400">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white">Background Push Notifications</h3>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    🤖 Robot Active
                  </span>
                </div>
                <p className="text-[11px] text-dark-300">Auto-Push Robot automatically syncs your device on app open</p>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                notifPermission === 'granted'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {notifPermission === 'granted' ? '✓ Permission OK' : '✗ No Permission'}
              </span>
              <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                (pushSubCount ?? 0) > 0
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {pushSubCount === null ? '⏳ Checking...' : (pushSubCount > 0 ? `✓ ${pushSubCount} Device Registered` : '✗ Not Registered')}
              </span>
            </div>
          </div>

          {/* 🤖 Auto-Push Robot Status Ribbon */}
          <div className="p-3.5 rounded-2xl bg-dark-850/80 border border-gold-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-base">🤖</span>
              <div>
                <p className="font-bold text-white text-xs">Auto-Push Robot is Running</p>
                <p className="text-[11px] text-dark-300">
                  App open ஆனதும் notification தானாகவே register ஆகிவிடும். Settings-ல் எதுவும் செய்யத் தேவையில்லை.
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Auto-Sync on Launch</span>
            </div>
          </div>

          {/* Step guide */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className={`p-3 rounded-2xl border ${notifPermission === 'granted' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gold-500/20 bg-dark-850/60'}`}>
              <div className="flex items-center gap-2 font-bold text-white mb-1">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${notifPermission === 'granted' ? 'bg-emerald-500 text-white' : 'bg-gold-500 text-dark-950'}`}>1</span>
                Browser Permission
              </div>
              <p className="text-dark-300 leading-relaxed">Allow notifications popup from Chrome/browser.</p>
              {notifPermission === 'granted' && <p className="text-emerald-400 font-bold mt-1">✓ Granted</p>}
            </div>

            <div className={`p-3 rounded-2xl border ${(pushSubCount ?? 0) > 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gold-500/20 bg-dark-850/60'}`}>
              <div className="flex items-center gap-2 font-bold text-white mb-1">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${(pushSubCount ?? 0) > 0 ? 'bg-emerald-500 text-white' : 'bg-gold-500 text-dark-950'}`}>2</span>
                Register This Device
              </div>
              <p className="text-dark-300 leading-relaxed">Register phone with server for background wake-up.</p>
              {(pushSubCount ?? 0) > 0 && <p className="text-emerald-400 font-bold mt-1">✓ Registered</p>}
            </div>

            <div className={`p-3 rounded-2xl border ${testResult?.delivered ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gold-500/20 bg-dark-850/60'}`}>
              <div className="flex items-center gap-2 font-bold text-white mb-1">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${testResult?.delivered ? 'bg-emerald-500 text-white' : 'bg-gold-500 text-dark-950'}`}>3</span>
                Test Push Delivery
              </div>
              <p className="text-dark-300 leading-relaxed">Send a real push from server to verify delivery.</p>
              {testResult?.delivered && <p className="text-emerald-400 font-bold mt-1">✓ Push Delivered!</p>}
              {testResult && !testResult.delivered && <p className="text-rose-400 font-bold mt-1">✗ Push failed</p>}
            </div>
          </div>

          {/* Error message */}
          {activateError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{activateError}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {/* Step 1+2: Activate push */}
            <button
              type="button"
              onClick={handleActivatePush}
              disabled={activating}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black rounded-xl text-xs shadow-lg shadow-gold-500/25 transition-all active:scale-95 disabled:opacity-60"
            >
              {activating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
              {activating ? 'Activating...' : (pushSubCount ?? 0) > 0 ? '🔄 Re-Register This Device' : '🔔 Activate Push Alerts'}
            </button>

            {/* Step 3: Server push test (only if registered) */}
            {(pushSubCount ?? 0) > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => handleTestServerPush('call')}
                  disabled={testSent}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-dark-850 hover:bg-dark-800 border border-gold-500/30 hover:border-gold-400 text-amber-200 font-bold rounded-xl text-xs transition-all active:scale-95 disabled:opacity-60"
                >
                  📞 Test Call Push
                </button>
                <button
                  type="button"
                  onClick={() => handleTestServerPush('message')}
                  disabled={testSent}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-dark-850 hover:bg-dark-800 border border-gold-500/30 hover:border-gold-400 text-amber-200 font-bold rounded-xl text-xs transition-all active:scale-95 disabled:opacity-60"
                >
                  💬 Test Msg Push
                </button>
                <button
                  type="button"
                  onClick={handleTestLocalAlert}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-dark-850 hover:bg-dark-800 border border-gold-500/30 hover:border-gold-400 text-amber-200 font-bold rounded-xl text-xs transition-all active:scale-95"
                >
                  🔔 In-App Test
                </button>
              </>
            )}

            {/* Refresh status */}
            <button
              type="button"
              onClick={fetchPushSubStatus}
              className="flex items-center gap-1.5 px-3 py-2 bg-dark-850 hover:bg-dark-800 border border-dark-700 text-dark-300 hover:text-white font-bold rounded-xl text-xs transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              Check Status
            </button>
          </div>

          {/* Instruction note */}
          {(pushSubCount ?? 0) === 0 && notifPermission !== 'denied' && (
            <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-amber-200 text-xs leading-relaxed">
              <strong>📱 Important:</strong> You must tap <strong>"🔔 Activate Push Alerts"</strong> on <strong>each phone/device</strong> that should receive background notifications. Do this on both your phone and the other person's phone.
            </div>
          )}

          {notifPermission === 'denied' && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed">
              <strong>⚠️ Blocked:</strong> Open Chrome Settings → Site Settings → Notifications → Find this site → Allow. Then come back and click Activate.
            </div>
          )}
        </div>

      </div>

      <AdminDashboardModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />

    </div>
  );
};
