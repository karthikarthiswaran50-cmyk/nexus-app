import React, { useState } from 'react';
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
} from 'lucide-react';
import axios from 'axios';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, logout } = useAuth();

  const [allowCallsFrom, setAllowCallsFrom] = useState(settings?.allow_calls_from || 'everyone');
  const [notificationSound, setNotificationSound] = useState(settings?.notification_sound ?? true);
  const [readReceipts, setReadReceipts] = useState(settings?.read_receipts ?? true);

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
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Header */}
      <div className="bg-dark-900 border border-dark-800 p-6 rounded-3xl shadow-xl flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-brand-400" />
            Account & App Settings
          </h2>
          <p className="text-xs text-dark-400 mt-1">Configure your privacy, notifications, and security preferences.</p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out</span>
        </button>
      </div>

      {settingsSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Preferences updated successfully!</span>
        </div>
      )}

      {/* 1. Privacy & Calling Permissions */}
      <div className="bg-dark-900 border border-dark-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Privacy & Call Permissions
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-dark-300 mb-2">Who can call you?</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'everyone', label: 'Everyone', desc: 'Any registered member' },
                { id: 'contacts', label: 'Contacts Only', desc: 'Users with chat history' },
                { id: 'subscribers', label: 'Subscribers Only', desc: 'Paid Pro & VIP members' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAllowCallsFrom(opt.id as any)}
                  className={`p-3.5 rounded-2xl text-left border transition-all ${
                    allowCallsFrom === opt.id
                      ? 'bg-brand-600/20 border-brand-500 text-white shadow-inner'
                      : 'bg-dark-800/80 border-dark-700/80 text-dark-300 hover:border-dark-600'
                  }`}
                >
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="text-[10px] text-dark-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-dark-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white">Read Receipts</p>
              <p className="text-[11px] text-dark-400">Show blue checkmarks when messages are seen</p>
            </div>
            <input
              type="checkbox"
              checked={readReceipts}
              onChange={(e) => setReadReceipts(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 bg-dark-800 border-dark-700"
            />
          </div>

          <div className="pt-4 border-t border-dark-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-brand-400" />
                Notification Sounds & Ringtones
              </p>
              <p className="text-[11px] text-dark-400">Play synthesized Web Audio chimes for calls and messages</p>
            </div>
            <input
              type="checkbox"
              checked={notificationSound}
              onChange={(e) => setNotificationSound(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 bg-dark-800 border-dark-700"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={savingSettings}
            className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/20 transition-all"
          >
            {savingSettings ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>

      {/* 2. Security & Password Change */}
      <form onSubmit={handlePasswordChange} className="bg-dark-900 border border-dark-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-brand-400" />
          Security & Password
        </h3>

        {pwError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{pwError}</span>
          </div>
        )}

        {pwSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{pwSuccess}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 chars"
              className="w-full px-3.5 py-2 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              className="w-full px-3.5 py-2 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={updatingPw}
            className="px-5 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 border border-dark-700 text-white font-semibold text-xs transition-all"
          >
            {updatingPw ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
};
