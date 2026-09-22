import React, { useState } from 'react';
import { Trash2, ArrowLeft, Shield, AlertTriangle, CheckCircle2, Mail, Lock, Send, AlertOctagon } from 'lucide-react';
import axios from 'axios';

interface AccountDeletionViewProps {
  onBack?: () => void;
}

export const AccountDeletionView: React.FC<AccountDeletionViewProps> = ({ onBack }) => {
  const [emailInput, setEmailInput] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [foundUsername, setFoundUsername] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  const handleRequestDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setSubmitting(true);
    setResultMessage(null);

    try {
      const payload: any = { email: emailInput.trim() };
      if (requiresConfirmation) {
        payload.confirmation = confirmationCode.trim();
      }

      const res = await axios.post('/api/auth/request-data-deletion', payload);

      if (res.data?.requiresConfirmation) {
        setRequiresConfirmation(true);
        setFoundUsername(res.data.username || null);
        setResultMessage({ type: 'success', text: res.data.message });
      } else {
        setResultMessage({ type: 'success', text: res.data.message });
        setRequiresConfirmation(false);
        setEmailInput('');
        setConfirmationCode('');
      }
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to submit data deletion request. Please try again or email developer.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 text-dark-100 font-['Plus_Jakarta_Sans',sans-serif] selection:bg-rose-500/30 selection:text-rose-200">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-30 bg-dark-900/90 backdrop-blur-xl border-b border-rose-500/20 px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-xs font-bold text-dark-300 hover:text-white px-3 py-2 rounded-xl bg-dark-850 hover:bg-dark-800 border border-white/10 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Nexus</span>
          </button>
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-400" />
            <span className="text-sm font-black text-white">NEXUS DATA DELETION</span>
          </div>
          <span className="text-[11px] text-dark-400 font-mono hidden sm:inline-block">Google Play Compliant</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8 leading-relaxed">
        {/* Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-dark-900 border border-rose-500/30 royal-card shadow-2xl relative overflow-hidden">
          <div className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 bg-rose-500/10 rounded-full blur-3xl" />
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Account & Data Erasure
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Immediate & Permanent
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            Nexus Account & Data Deletion Portal
          </h1>
          <p className="text-xs sm:text-sm text-dark-300 max-w-2xl leading-normal">
            In accordance with the Google Play Developer Policy and global privacy regulations (GDPR & CCPA), you have the absolute right to permanently delete your Nexus account and all associated personal data at any time.
          </p>
        </div>

        {/* What Data is Deleted */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-rose-500/20 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-rose-400" />
            What Data is Permanently Deleted?
          </h2>
          <p className="text-xs text-dark-300">
            When your deletion request is processed, the following information is permanently purged from all production servers, databases, and persistent storage:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-dark-850/60 border border-white/5 space-y-1">
              <span className="font-bold text-rose-300">✓ Account Identity & Credentials</span>
              <p className="text-dark-400">Email address, display name, unique @username, password hashes, and bio.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-dark-850/60 border border-white/5 space-y-1">
              <span className="font-bold text-rose-300">✓ Chat Messages & Direct History</span>
              <p className="text-dark-400">All direct messages sent or received, text history, timestamps, and emoji reactions.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-dark-850/60 border border-white/5 space-y-1">
              <span className="font-bold text-rose-300">✓ Photos, Voice Notes & Media Files</span>
              <p className="text-dark-400">Uploaded profile photos, shared images, voice notes, and document attachments are erased from disk.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-dark-850/60 border border-white/5 space-y-1">
              <span className="font-bold text-rose-300">✓ Call Logs & Notification Tokens</span>
              <p className="text-dark-400">Call history records, Web Push subscriptions, and Firebase Cloud Messaging device tokens.</p>
            </div>
          </div>
        </section>

        {/* Method 1: In-App Deletion */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-gold-500/20 space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-gold-400" />
            Method 1: Instant In-App Deletion (Fastest)
          </h2>
          <p className="text-xs text-dark-300">
            If you currently have the app open or installed, you can delete your account instantly with zero waiting time:
          </p>
          <ol className="list-decimal list-inside text-xs text-dark-200 space-y-1.5 pl-1">
            <li>Open the Nexus application.</li>
            <li>Tap the <strong>Settings</strong> tab in the bottom navigation bar.</li>
            <li>Scroll to the <strong>Account & Sessions (Danger Zone)</strong> card.</li>
            <li>Tap <strong>Delete Account Permanently</strong>.</li>
            <li>Type <code className="text-rose-400 font-bold bg-dark-950 px-1.5 py-0.5 rounded">DELETE</code> and tap Confirm. Your account and data are erased immediately.</li>
          </ol>
        </section>

        {/* Method 2: Web Deletion Form (No App Required) */}
        <section className="p-6 rounded-2xl bg-dark-900 border border-rose-500/30 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-400" />
            Method 2: Submit Web Data Deletion Request (No App Required)
          </h2>
          <p className="text-xs text-dark-300">
            If you uninstalled Nexus or cannot access the app, enter your registered email address below to submit an automated deletion request:
          </p>

          <form onSubmit={handleRequestDeletion} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-bold text-dark-200 mb-1.5">
                Registered Email Address:
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-rose-400"
              />
            </div>

            {requiresConfirmation && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-rose-300 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Confirmation Required for @{foundUsername || 'Account'}</span>
                </div>
                <p className="text-[11px] text-dark-300 leading-normal">
                  To prevent accidental erasure, please type <span className="font-mono font-bold text-rose-400">DELETE</span> below to execute permanent data removal:
                </p>
                <input
                  type="text"
                  required
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full px-4 py-2 rounded-xl bg-dark-900 border border-rose-500/40 text-xs text-white placeholder:text-dark-600 focus:outline-none focus:border-rose-400 font-mono"
                />
              </div>
            )}

            {resultMessage && (
              <div className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                resultMessage.type === 'success'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              }`}>
                {resultMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                )}
                <span>{resultMessage.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <span>Processing...</span>
              ) : requiresConfirmation ? (
                <span>Execute Permanent Erasure</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Request Account Deletion</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Method 3: Direct Email */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-white/10 space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-gold-400" />
            Method 3: Direct Email to Data Controller
          </h2>
          <p className="text-xs text-dark-300 leading-relaxed">
            You can also submit a data erasure request by emailing our Data Controller directly from your registered email address at{' '}
            <a href="mailto:karthikarthiswaran50@gmail.com" className="text-gold-400 font-bold underline">karthikarthiswaran50@gmail.com</a>{' '}
            with the subject line <em>"Nexus Data Erasure Request"</em>. Manual requests are fulfilled within 48 hours.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-dark-950 px-4 py-6 text-center text-xs text-dark-500">
        <p>© {new Date().getFullYear()} Nexus Royal Platform. All rights reserved. Free Forever ♾️</p>
      </footer>
    </div>
  );
};
export default AccountDeletionView;
