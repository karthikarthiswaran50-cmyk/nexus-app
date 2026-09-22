import React from 'react';
import { Shield, ArrowLeft, FileText, CheckCircle2, AlertOctagon, UserX, Flag, Scale, Mail } from 'lucide-react';

interface TermsOfServiceViewProps {
  onBack?: () => void;
}

export const TermsOfServiceView: React.FC<TermsOfServiceViewProps> = ({ onBack }) => {
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
            <FileText className="w-5 h-5 text-gold-400" />
            <span className="text-sm font-black gold-gradient-text">TERMS & CONDITIONS</span>
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
              Google Play UGC Compliant
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-gold-500/20 text-gold-300 border border-gold-500/30">
              Free Forever ♾️
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            Nexus Terms of Service & Community Guidelines
          </h1>
          <p className="text-xs sm:text-sm text-dark-300 max-w-2xl leading-normal">
            Welcome to Nexus! These Terms and Conditions govern your access to and use of Nexus, including our real-time messaging, audio, and video calling services. By creating an account or using Nexus, you agree to be bound by these Terms.
          </p>
          <div className="mt-4 pt-4 border-t border-gold-500/15 flex flex-wrap gap-4 text-xs text-dark-400 font-medium">
            <span><strong>Service:</strong> Nexus (Nexus Royal)</span>
            <span><strong>Platform:</strong> Android, Mobile PWA & Web</span>
            <span><strong>Developer:</strong> Karthik Arthiswaran</span>
          </div>
        </div>

        {/* Section 1: Free Forever Commitment */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-gold-400" />
            1. Free Forever Platform Commitment
          </h2>
          <p className="text-xs text-dark-300">
            Nexus is provided completely free of charge. There are no subscription fees, paid paywalls, locked VIP tiers, in-app purchases, or advertisements. All core communication features — including Ultra-HD audio/video calling, private messaging, file sharing, and group chats — are unconditionally accessible to all registered members.
          </p>
        </section>

        {/* Section 2: Eligibility & Account Registration */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-gold-400" />
            2. Eligibility & Account Responsibilities
          </h2>
          <ul className="list-disc list-inside text-xs text-dark-300 space-y-2">
            <li>You must be at least 13 years old (or the legal age required in your country) to register an account and use Nexus.</li>
            <li>You agree to provide accurate registration information and keep your login credentials secure.</li>
            <li>You are solely responsible for all activities that occur under your account.</li>
            <li>You may not impersonate any individual, celebrity, business, or government official.</li>
          </ul>
        </section>

        {/* Section 3: User-Generated Content (UGC) & Zero Tolerance Policy */}
        <section className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-4">
          <div className="flex items-center gap-2 text-rose-300 font-black text-lg">
            <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0" />
            <h2>3. User-Generated Content (UGC) & Zero-Tolerance Abuse Policy</h2>
          </div>
          <p className="text-xs text-dark-200 leading-relaxed font-semibold">
            In compliance with Google Play Store's User Generated Content Policy, Nexus enforces a STRICT ZERO-TOLERANCE policy against objectionable content, abuse, and harassment.
          </p>

          <div className="p-4 rounded-xl bg-dark-900 border border-rose-500/20 space-y-3 text-xs">
            <p className="text-rose-300 font-bold">You may NOT post, share, transmit, or display any content that:</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-dark-300">
              <li className="flex items-center gap-2">❌ Hate speech, discrimination, or slurs</li>
              <li className="flex items-center gap-2">❌ Harassment, bullying, stalking, or threats</li>
              <li className="flex items-center gap-2">❌ Pornography, nudity, or sexually explicit media</li>
              <li className="flex items-center gap-2">❌ Child sexual abuse or exploitation (CSAM)</li>
              <li className="flex items-center gap-2">❌ Promotion of violence, terrorism, or self-harm</li>
              <li className="flex items-center gap-2">❌ Fraud, spam, malware, phishing, or scamming</li>
            </ul>
          </div>

          <p className="text-xs text-dark-300">
            Any user found violating these guidelines will have their account immediately suspended or permanently banned, and offending content will be purged without warning.
          </p>
        </section>

        {/* Section 4: In-App User Moderation & Reporting Tools */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Flag className="w-5 h-5 text-gold-400" />
            4. In-App User Protection & Safety Tools
          </h2>
          <p className="text-xs text-dark-300">
            Nexus empowers users with native safety tools to block and report inappropriate behavior instantly:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-dark-850/60 border border-white/5 space-y-1">
              <div className="flex items-center gap-2 text-white font-bold">
                <UserX className="w-4 h-4 text-rose-400" />
                <span>Instant User Blocking</span>
              </div>
              <p className="text-dark-400">You can block any user at any time from their profile or chat. Blocked users cannot message you, call you, or see your online presence.</p>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-850/60 border border-white/5 space-y-1">
              <div className="flex items-center gap-2 text-white font-bold">
                <Flag className="w-4 h-4 text-amber-400" />
                <span>Report User Mechanism</span>
              </div>
              <p className="text-dark-400">You can report abusive users with an explicit reason. Reports are dispatched immediately to our Admin Review Team and investigated within 24 hours.</p>
            </div>
          </div>
        </section>

        {/* Section 5: Intellectual Property */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-gold-400" />
            5. Intellectual Property
          </h2>
          <p className="text-xs text-dark-300">
            You retain ownership of the text, photos, and files you transmit through Nexus. By transmitting content, you grant Nexus a limited, non-exclusive license solely to deliver, store, and display your messages and media as necessary to operate the service. The Nexus brand, logos, user interface designs, and code are the exclusive intellectual property of the developer.
          </p>
        </section>

        {/* Section 6: Termination & Account Cancellation */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserX className="w-5 h-5 text-gold-400" />
            6. Termination of Service
          </h2>
          <p className="text-xs text-dark-300">
            You may stop using Nexus and permanently delete your account at any time via <strong>Settings → Account Actions → Delete Account Permanently</strong>. We reserve the right to suspend or terminate accounts that breach these Terms, engage in illegal conduct, or compromise platform integrity.
          </p>
        </section>

        {/* Section 7: Disclaimers & Limitation of Liability */}
        <section className="p-6 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-gold-400" />
            7. Disclaimers & Limitation of Liability
          </h2>
          <p className="text-xs text-dark-300 leading-relaxed">
            Nexus is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied. Nexus is not intended for emergency calls (e.g. 911/112) or mission-critical life-safety applications. To the maximum extent permitted by applicable law, the developer shall not be liable for any indirect, incidental, or consequential damages resulting from your use of the platform.
          </p>
        </section>

        {/* Section 8: Contact Information */}
        <section className="p-6 rounded-2xl bg-dark-900 border border-gold-500/30 text-center space-y-3">
          <h2 className="text-base font-bold text-white">Legal & Terms Inquiries</h2>
          <p className="text-xs text-dark-400 max-w-md mx-auto">
            For questions regarding these Terms & Conditions or to report copyright or policy violations:
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
export default TermsOfServiceView;
