import React from 'react';
import { Shield, ArrowLeft, Lock, Trash2, Eye, Bell, Phone, Video, Mail, CheckCircle2, AlertTriangle } from 'lucide-react';

interface PrivacyPolicyViewProps {
  onBack?: () => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onBack }) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 text-dark-100 font-['Plus_Jakarta_Sans',sans-serif] selection:bg-gold-500/30 selection:text-gold-200">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-dark-900/90 backdrop-blur-xl border-b border-gold-500/20 px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-xs font-bold text-dark-300 hover:text-white px-3 py-2 rounded-xl bg-dark-850 hover:bg-dark-800 border border-gold-500/20 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Nexus</span>
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gold-400" />
            <span className="text-sm font-black gold-gradient-text">NEXUS PRIVACY POLICY</span>
          </div>
          <span className="text-[11px] text-dark-400 font-mono hidden sm:inline-block">Effective: Sept 2026</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8 leading-relaxed">
        {/* Hero Header */}
        <div className="p-6 sm:p-8 rounded-3xl bg-dark-900 border border-gold-500/30 royal-card shadow-2xl relative overflow-hidden">
          <div className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 bg-gold-500/10 rounded-full blur-3xl" />
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Google Play Verified
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-gold-500/20 text-gold-300 border border-gold-500/30">
              100% Free Forever
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            Nexus Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-dark-300 max-w-2xl leading-normal">
            Your privacy is fundamental to everything we build at Nexus. This document describes how our application collects, uses, protects, and handles your personal information in strict compliance with the Google Play Developer Policy, GDPR, and global data protection standards.
          </p>
          <div className="mt-4 pt-4 border-t border-gold-500/15 flex flex-wrap gap-4 text-xs text-dark-400 font-medium">
            <span><strong>App Name:</strong> Nexus (Nexus Royal)</span>
            <span><strong>Developer / Controller:</strong> Karthik Arthiswaran</span>
            <span><strong>Contact:</strong> karthikarthiswaran50@gmail.com</span>
          </div>
        </div>

        {/* Section 1: Summary / Core Privacy Shield */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-gold-400" />
            1. Core Privacy Principles ("Privacy Shield")
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-dark-200">
            <li className="p-3 rounded-xl bg-dark-850/60 border border-gold-500/10 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Hidden Community Directory:</strong> Users are NOT publicly browseable. Profiles only appear upon explicit username or name search queries.</span>
            </li>
            <li className="p-3 rounded-xl bg-dark-850/60 border border-gold-500/10 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Peer-to-Peer Calls:</strong> Audio and video calls stream directly peer-to-peer via WebRTC and are never recorded or stored on any server.</span>
            </li>
            <li className="p-3 rounded-xl bg-dark-850/60 border border-gold-500/10 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Granular Visibility Controls:</strong> You control who sees your Last Seen, Online Status, and Profile Picture.</span>
            </li>
            <li className="p-3 rounded-xl bg-dark-850/60 border border-gold-500/10 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>No Ads, No Selling Data:</strong> Nexus does not contain ads and does not sell, rent, or monetize your personal data.</span>
            </li>
          </ul>
        </section>

        {/* Section 2: Information We Collect */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-gold-400" />
            2. Information We Collect
          </h2>
          <p className="text-xs text-dark-300">
            We collect only the minimum information necessary to provide real-time messaging and peer-to-peer audio/video calling:
          </p>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-dark-850/50 border border-white/5 space-y-1">
              <span className="font-bold text-gold-300">A. Account Credentials</span>
              <p className="text-dark-300">When you register or sign in via Google, we collect your verified email address, chosen display name, username, and profile picture avatar. Passwords (when used) are cryptographically hashed using standard <code>bcrypt</code> encryption before storage; we never store plain-text passwords.</p>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-850/50 border border-white/5 space-y-1">
              <span className="font-bold text-gold-300">B. Communications & Chat Messages</span>
              <p className="text-dark-300">Text messages, media attachments (photos, audio notes, documents), emoji reactions, and timestamps are transmitted via encrypted WebSockets and stored in our secured database to enable conversation history across your devices.</p>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-850/50 border border-white/5 space-y-1">
              <span className="font-bold text-gold-300">C. Audio & Video Calling (WebRTC)</span>
              <p className="text-dark-300">Real-time calls utilize standard WebRTC signaling to establish peer-to-peer connections. Media streams (your voice and video) flow directly between call participants using DTLS-SRTP encryption. <strong>Nexus does not record, tap, intercept, or store your voice or video calls.</strong></p>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-850/50 border border-white/5 space-y-1">
              <span className="font-bold text-gold-300">D. Push Notification Tokens</span>
              <p className="text-dark-300">If you grant permission for notifications, we store a secure Firebase Cloud Messaging (FCM) or Web Push token so your device can receive background incoming call alerts and chat notifications when the app is closed.</p>
            </div>
          </div>
        </section>

        {/* Section 3: Android Device Permissions */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Phone className="w-5 h-5 text-gold-400" />
            3. Android Device Permissions Explained
          </h2>
          <p className="text-xs text-dark-300">
            Nexus explicitly asks for device permissions strictly on-demand when you trigger corresponding features. You can revoke any permission at any time in Android Settings:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-dark-850/60 border border-white/5">
              <div className="flex items-center gap-2 text-white font-bold mb-1">
                <Video className="w-4 h-4 text-amber-400" />
                <span>Camera (<code>android.permission.CAMERA</code>)</span>
              </div>
              <p className="text-dark-400">Used exclusively to transmit video during peer-to-peer video calls, record 24-hour stories, or take a profile avatar.</p>
            </div>

            <div className="p-3 rounded-xl bg-dark-850/60 border border-white/5">
              <div className="flex items-center gap-2 text-white font-bold mb-1">
                <Phone className="w-4 h-4 text-amber-400" />
                <span>Microphone (<code>android.permission.RECORD_AUDIO</code>)</span>
              </div>
              <p className="text-dark-400">Used exclusively during active voice/video calls and when you press the microphone button to send voice messages.</p>
            </div>

            <div className="p-3 rounded-xl bg-dark-850/60 border border-white/5">
              <div className="flex items-center gap-2 text-white font-bold mb-1">
                <Bell className="w-4 h-4 text-amber-400" />
                <span>Notifications (<code>android.permission.POST_NOTIFICATIONS</code>)</span>
              </div>
              <p className="text-dark-400">Used to deliver background incoming call alerts, vibration, and new message previews.</p>
            </div>

            <div className="p-3 rounded-xl bg-dark-850/60 border border-white/5">
              <div className="flex items-center gap-2 text-white font-bold mb-1">
                <Eye className="w-4 h-4 text-amber-400" />
                <span>Storage / Media Files</span>
              </div>
              <p className="text-dark-400">Used only when you explicitly select photos, videos, or documents to share in a conversation.</p>
            </div>
          </div>
        </section>

        {/* Section 4: Third-Party Service Providers */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-gold-400" />
            4. Third-Party Service Providers
          </h2>
          <p className="text-xs text-dark-300">
            We partner with industry-standard, SOC-2 compliant cloud infrastructure providers to guarantee high availability and security:
          </p>

          <ul className="space-y-2 text-xs text-dark-200">
            <li className="p-2.5 rounded-lg bg-dark-850/50 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span><strong>Google Firebase:</strong> Used for secure OAuth authentication and Firebase Cloud Messaging (FCM) push alerts.</span>
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:underline text-[11px]">Google Privacy Policy →</a>
            </li>
            <li className="p-2.5 rounded-lg bg-dark-850/50 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span><strong>Render.com & Supabase PostgreSQL:</strong> Used for encrypted database storage and web application hosting.</span>
              <span className="text-dark-400 text-[11px]">ISO 27001 / GDPR Compliant</span>
            </li>
            <li className="p-2.5 rounded-lg bg-dark-850/50 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span><strong>WebRTC STUN/TURN Relays:</strong> Used to negotiate NAT traversal for peer-to-peer audio/video connection establishment.</span>
              <span className="text-dark-400 text-[11px]">Transient packets only</span>
            </li>
          </ul>
        </section>

        {/* Section 5: Data Deletion & Account Erasure (Google Play Requirement) */}
        <section className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-4">
          <h2 className="text-lg font-bold text-rose-300 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-400" />
            5. User Data Deletion & Account Erasure Policy
          </h2>
          <p className="text-xs text-dark-200 leading-relaxed">
            In compliance with Google Play's Account Deletion Requirement, Nexus provides both in-app and web-based options to completely delete your account and all associated data:
          </p>

          <div className="p-4 rounded-xl bg-dark-900 border border-rose-500/20 space-y-3 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-white">How to delete your account inside the app:</span>
              <ol className="list-decimal list-inside text-dark-300 space-y-1 pl-1">
                <li>Open Nexus and navigate to <strong>Settings</strong>.</li>
                <li>Scroll down to the <strong>Account Actions (Danger Zone)</strong> section.</li>
                <li>Tap <strong>Delete Account Permanently</strong> and type <code>DELETE</code> to confirm.</li>
              </ol>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-1">
              <span className="font-bold text-white">Online Web Deletion Portal (No App Needed):</span>
              <p className="text-dark-300">
                You can request immediate data erasure online at any time via our public web deletion portal:{' '}
                <a
                  href="/delete-account"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, '', '/delete-account');
                    window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: 'delete-account' }));
                  }}
                  className="text-rose-400 font-bold underline cursor-pointer"
                >
                  https://nexusroyal.online/delete-account
                </a>.
              </p>
              <p className="text-dark-400 text-[11px] pt-1">
                You can also email our Data Controller directly at{' '}
                <a href="mailto:karthikarthiswaran50@gmail.com" className="text-rose-400 underline">karthikarthiswaran50@gmail.com</a>.
              </p>
            </div>

            <p className="text-[11px] text-rose-300 italic pt-1">
              Upon deletion, your profile, authentication records, conversation history, uploaded media, call records, and push tokens are permanently purged from all database tables and backups.
            </p>
          </div>
        </section>

        {/* Section 6: Children's Privacy */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            6. Children's Privacy (COPPA Compliance)
          </h2>
          <p className="text-xs text-dark-300">
            Nexus is not directed to children under the age of 13 (or under 16 in the European Economic Area). We do not knowingly collect personal identifiable information from children. If we discover that a child under the legal age has registered an account without parental consent, we immediately delete their account and associated data.
          </p>
        </section>

        {/* Section 7: Security & Encryption */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-gold-400" />
            7. Security Standards
          </h2>
          <p className="text-xs text-dark-300">
            We implement high-grade industry security measures including TLS 1.3 transport layer security for all network traffic, HTTP Strict Transport Security (HSTS), rate limiting against brute-force attacks, sandboxed static asset delivery, and encrypted WebRTC audio/video transmission.
          </p>
        </section>

        {/* Section 8: Contact & Data Protection Officer */}
        <section className="p-6 rounded-2xl bg-dark-900 border border-gold-500/30 text-center space-y-3">
          <h2 className="text-base font-bold text-white">Questions or Privacy Inquiries?</h2>
          <p className="text-xs text-dark-400 max-w-md mx-auto">
            If you have questions about this Privacy Policy, your personal data, or wish to exercise your data protection rights, please contact our Data Controller directly:
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-850 border border-gold-500/30 text-xs font-bold text-gold-300">
            <Mail className="w-4 h-4 text-gold-400" />
            <span>karthikarthiswaran50@gmail.com</span>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gold-500/10 bg-dark-950 px-4 py-6 text-center text-xs text-dark-500">
        <p>© {new Date().getFullYear()} Nexus Royal Platform. All rights reserved. Free Forever ♾️</p>
      </footer>
    </div>
  );
};
export default PrivacyPolicyView;
