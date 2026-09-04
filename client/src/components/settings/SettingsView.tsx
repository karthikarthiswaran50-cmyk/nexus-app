import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Settings as SettingsIcon,
  Shield,
  Bell,
  Lock,
  Moon,
  Sun,
  Eye,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Crown,
} from 'lucide-react';
import axios from 'axios';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  showCallNotification,
  showMessageNotification,
} from '../../utils/notifications';
import { requestFcmToken } from '../../config/firebase';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, logout } = useAuth();

  const [allowCallsFrom, setAllowCallsFrom] = useState(settings?.allow_calls_from || 'everyone');
  const [notificationSound, setNotificationSound] = useState(settings?.notification_sound ?? true);
  const [readReceipts, setReadReceipts] = useState(settings?.read_receipts ?? true);

  // System push notification state
  const [notifPermission, setNotifPermission] = useState(getNotificationPermissionStatus());
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    setNotifPermission(getNotificationPermissionStatus());
  }, []);

  const handleEnableSystemNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(getNotificationPermissionStatus());
    if (granted) {
      try {
        const token = await requestFcmToken();
        if (token) {
          await axios.post('/api/users/fcm-token', { token });
        }
      } catch (e) {}
    }
  };

  const handleTestCallAlert = () => {
    showCallNotification('Nexus Royal Alert', 'video');
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleTestMessageAlert = () => {
    showMessageNotification('Nexus Royal Alert', '👑 Notifications and vibration are working perfectly!');
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
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

  const handleSavePreferences = async () => {
    setSavingSettings(true);
    try {
      await updateSettings({
        allow_calls_from: allowCallsFrom as any,
        notification_sound: notificationSound,
        read_receipts: readReceipts,
      });
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      alert('Failed to save settings.');
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
          </div>
        </div>

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

        {/* 🔔 System & Device Push Notifications Card */}
        <div className="bg-dark-900 border border-gold-500/15 rounded-3xl p-6 space-y-5 shadow-xl royal-card md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gold-500/15 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">System & Mobile Push Notifications</h3>
                <p className="text-[11px] text-dark-300">Lock screen ringing, call popups, and instant message vibrations</p>
              </div>
            </div>

            <span className={`self-start sm:self-auto px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
              notifPermission === 'granted'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : notifPermission === 'denied'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {notifPermission === 'granted' ? '✓ Alerts Active & Allowed' : notifPermission === 'denied' ? '⚠️ Blocked in Browser' : 'Action Required'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-xs text-dark-300 leading-relaxed max-w-xl">
              When notifications are enabled, Nexus rings your device with haptic vibration and displays native incoming call & chat message previews even when your screen is locked or your browser tab is in the background.
            </p>

            <div className="flex flex-wrap gap-2 items-center">
              {notifPermission !== 'granted' ? (
                <button
                  type="button"
                  onClick={handleEnableSystemNotifications}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black rounded-xl text-xs shadow-lg shadow-gold-500/25 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Enable Notifications on this Device</span>
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleTestCallAlert}
                    className="px-3.5 py-2 bg-dark-850 hover:bg-dark-800 border border-gold-500/30 hover:border-gold-400 text-amber-200 font-bold rounded-xl text-xs transition-all active:scale-95 shadow-sm"
                  >
                    📞 Test Call Alert
                  </button>
                  <button
                    type="button"
                    onClick={handleTestMessageAlert}
                    className="px-3.5 py-2 bg-dark-850 hover:bg-dark-800 border border-gold-500/30 hover:border-gold-400 text-amber-200 font-bold rounded-xl text-xs transition-all active:scale-95 shadow-sm"
                  >
                    💬 Test Message Alert
                  </button>
                </div>
              )}
            </div>
          </div>

          {testSent && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>✓ Test notification and vibration dispatched successfully! Check your device notification center.</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
