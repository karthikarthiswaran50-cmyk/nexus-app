import React from 'react';
import { ArrowLeft, ShieldAlert, Flag, UserX, AlertTriangle, CheckCircle2, Ban, Mail, Phone, Video, MessageSquare } from 'lucide-react';

interface CommunityGuidelinesViewProps {
  onBack?: () => void;
}

export const CommunityGuidelinesView: React.FC<CommunityGuidelinesViewProps> = ({ onBack }) => {
  const verifiedSupportEmail = 'karthikarthiswaran50@gmail.com';

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  const navigateTo = (route: string) => {
    window.history.pushState({}, '', `/${route}`);
    window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: route }));
  };

  return (
    <div className="min-h-screen bg-dark-950 text-dark-100 font-['Plus_Jakarta_Sans',sans-serif] selection:bg-rose-500/30 selection:text-rose-200">
      {/* Header */}
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
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span className="text-sm font-black text-white">COMMUNITY GUIDELINES</span>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('contact')}
            className="text-xs font-bold text-rose-300 hover:text-white hidden sm:inline-block px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-all cursor-pointer"
          >
            Report Abuse
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8 leading-relaxed">
        {/* Hero Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-dark-900 border border-rose-500/30 royal-card shadow-2xl relative overflow-hidden">
          <div className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 bg-rose-500/10 rounded-full blur-3xl" />
          <div className="flex items-center gap-2.5 mb-3">
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Safety & Standards
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Zero Tolerance for Abuse
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            Nexus Royal Community Guidelines & Safety Standards
          </h1>
          <p className="text-xs sm:text-sm text-dark-300 max-w-2xl leading-normal">
            Nexus Royal is committed to creating a respectful, safe, and positive communication space. We maintain strict zero-tolerance enforcement against harassment, hate speech, illegal acts, and abusive behavior.
          </p>
        </div>

        {/* Section 1: Prohibited Conduct */}
        <section className="p-6 sm:p-8 rounded-2xl bg-dark-900/80 border border-rose-500/20 space-y-4">
          <div className="flex items-center gap-2.5 text-rose-300 font-bold text-base">
            <Ban className="w-5 h-5 text-rose-400" />
            <h2>1. Strictly Prohibited Behaviors</h2>
          </div>
          <p className="text-xs text-dark-300">
            The following actions are strictly prohibited on Nexus Royal and will result in immediate suspension or permanent device/account ban:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-dark-850/60 border border-rose-500/10 space-y-1">
              <strong className="text-white block font-bold">Harassment & Bullying</strong>
              <p className="text-dark-300">Targeted insults, persistent unwanted contact, stalking, intimidation, or threats of violence toward any user.</p>
            </div>
            <div className="p-4 rounded-xl bg-dark-850/60 border border-rose-500/10 space-y-1">
              <strong className="text-white block font-bold">Explicit or Non-Consensual Media</strong>
              <p className="text-dark-300">Sharing sexually explicit imagery, non-consensual sexual content, or violent depictions.</p>
            </div>
            <div className="p-4 rounded-xl bg-dark-850/60 border border-rose-500/10 space-y-1">
              <strong className="text-white block font-bold">Scams, Fraud & Phishing</strong>
              <p className="text-dark-300">Financial extortion, cryptocurrency scams, impersonation for deceptive purposes, or phishing for passwords/OTP.</p>
            </div>
            <div className="p-4 rounded-xl bg-dark-850/60 border border-rose-500/10 space-y-1">
              <strong className="text-white block font-bold">Spam & Commercial Bots</strong>
              <p className="text-dark-300">Automated spam scripts, bulk unsolicited marketing, or malicious URL flooding in public voice spaces or chats.</p>
            </div>
            <div className="p-4 rounded-xl bg-dark-850/60 border border-rose-500/10 space-y-1">
              <strong className="text-white block font-bold">Child Safety (CSAM/CSAE)</strong>
              <p className="text-dark-300">Zero tolerance for any content or solicitation related to child sexual abuse or exploitation. Law enforcement will be immediately notified.</p>
            </div>
            <div className="p-4 rounded-xl bg-dark-850/60 border border-rose-500/10 space-y-1">
              <strong className="text-white block font-bold">Hate Speech & Discrimination</strong>
              <p className="text-dark-300">Attacking individuals or groups based on race, ethnicity, religion, disability, gender, gender identity, or sexual orientation.</p>
            </div>
          </div>
        </section>

        {/* Section 2: How to Report Abuse */}
        <section className="p-6 sm:p-8 rounded-2xl bg-dark-900/80 border border-gold-500/20 space-y-4">
          <div className="flex items-center gap-2.5 text-amber-300 font-bold text-base">
            <Flag className="w-5 h-5 text-amber-400" />
            <h2>2. How to Report Abuse or Violations</h2>
          </div>
          <p className="text-xs text-dark-300 leading-relaxed">
            Nexus provides multiple built-in reporting pathways to ensure prompt moderation:
          </p>

          <div className="space-y-3 text-xs text-dark-200">
            <div className="p-4 rounded-xl bg-dark-850/60 border border-gold-500/10 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</div>
              <div>
                <strong className="text-white block mb-0.5">In-Chat User Report Button</strong>
                <p className="text-dark-300">
                  Inside any chat room, tap the three dots (<strong className="text-white">⋮</strong>) in the top-right header, select <strong className="text-amber-300">"Report User"</strong>, choose the violation category, and submit. The report goes directly to the admin moderation queue.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-dark-850/60 border border-gold-500/10 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</div>
              <div>
                <strong className="text-white block mb-0.5">Block User Instantly</strong>
                <p className="text-dark-300">
                  Tap the three dots (<strong className="text-white">⋮</strong>) and choose <strong className="text-rose-400">"Block User"</strong>. Blocked users can no longer message you, call you, or see your online activity.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-dark-850/60 border border-gold-500/10 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</div>
              <div>
                <strong className="text-white block mb-0.5">Online Contact Form & Email Support</strong>
                <p className="text-dark-300">
                  You can submit abuse reports via our{' '}
                  <button
                    type="button"
                    onClick={() => navigateTo('contact')}
                    className="text-amber-300 underline font-semibold cursor-pointer"
                  >
                    Contact Support Form
                  </button>{' '}
                  (select "Report Abuse / Harassment") or email{' '}
                  <a href={`mailto:${verifiedSupportEmail}`} className="text-amber-300 underline font-mono">
                    {verifiedSupportEmail}
                  </a>{' '}
                  with the username, timestamp, and details.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Enforcement & Penalties */}
        <section className="p-6 sm:p-8 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-4">
          <div className="flex items-center gap-2.5 text-white font-bold text-base">
            <UserX className="w-5 h-5 text-gold-400" />
            <h2>3. Investigation & Moderation Actions</h2>
          </div>
          <p className="text-xs text-dark-300 leading-relaxed">
            Every user report is reviewed by platform administrators. Actions taken include:
          </p>
          <ul className="list-disc list-inside text-xs text-dark-300 space-y-1.5 ml-2">
            <li><strong>Content Removal:</strong> Deletion of abusive messages or media.</li>
            <li><strong>Formal Warning:</strong> Notice sent to offending accounts for minor violations.</li>
            <li><strong>Account Suspension:</strong> Immediate suspension of accounts found violating our guidelines.</li>
            <li><strong>Permanent Ban:</strong> Irreversible banning of accounts and devices for serious or repeated offenses.</li>
            <li><strong>Law Enforcement Escalation:</strong> Reporting severe criminal acts or child exploitation to appropriate authorities.</li>
          </ul>
        </section>

        {/* Footer Navigation */}
        <div className="pt-6 border-t border-gold-500/15 flex flex-wrap gap-4 text-xs text-dark-300 justify-center">
          <button type="button" onClick={() => navigateTo('about')} className="hover:text-amber-300 underline cursor-pointer">
            About Us
          </button>
          <span>•</span>
          <button type="button" onClick={() => navigateTo('contact')} className="hover:text-amber-300 underline cursor-pointer">
            Contact Support
          </button>
          <span>•</span>
          <button type="button" onClick={() => navigateTo('privacy')} className="hover:text-amber-300 underline cursor-pointer">
            Privacy Policy
          </button>
          <span>•</span>
          <button type="button" onClick={() => navigateTo('terms')} className="hover:text-amber-300 underline cursor-pointer">
            Terms & Conditions
          </button>
          <span>•</span>
          <button type="button" onClick={() => navigateTo('delete-account')} className="hover:text-rose-400 underline cursor-pointer">
            Account Deletion
          </button>
        </div>
      </main>
    </div>
  );
};
