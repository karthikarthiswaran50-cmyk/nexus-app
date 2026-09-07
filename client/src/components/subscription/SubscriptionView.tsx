import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Crown, Sparkles, ShieldCheck, Video, Phone, MessageSquare, Monitor, Check } from 'lucide-react';

export const SubscriptionView: React.FC = () => {
  const { user } = useAuth();

  const freeFeatures = [
    { title: 'Unlimited 1-on-1 HD Video Calling', desc: 'No time limits, 0-latency crystal clear WebRTC video', icon: Video },
    { title: 'High-Definition Voice Calling', desc: 'Direct encrypted audio with Opus noise suppression', icon: Phone },
    { title: 'Real-Time Instant Messaging', desc: 'Text, voice notes, photos & attachments with instant delivery', icon: MessageSquare },
    { title: 'Screen Sharing & Collaboration', desc: 'Share your screen during any call with zero extra cost', icon: Monitor },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300 font-['Plus_Jakarta_Sans',sans-serif] pb-12">
      
      {/* 👑 Royal Header Banner */}
      <div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden bg-gradient-to-br from-dark-900 via-dark-850 to-dark-900 border border-gold-500/30 shadow-2xl text-center royal-card">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 text-dark-950 shadow-xl shadow-gold-500/30 mb-6 animate-bounce">
          <Crown className="w-10 h-10 stroke-[2.5]" />
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-3">
          Nexus Royal is <span className="gold-gradient-text">100% Free</span>
        </h1>
        
        <p className="text-sm sm:text-base text-amber-200/90 max-w-xl mx-auto leading-relaxed font-medium">
          All premium features, HD video calling, audio calling, screen sharing, and messaging are completely unlocked for all members. No subscriptions or payments required!
        </p>

        <div className="mt-6 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold shadow-lg">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Lifetime Free Access Active for @{user?.username}</span>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {freeFeatures.map((feat, idx) => {
          const Icon = feat.icon;
          return (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-dark-900/90 border border-gold-500/20 shadow-xl flex items-start gap-4 royal-card transition-all hover:border-gold-400/50"
            >
              <div className="p-3 rounded-xl bg-gold-500/10 border border-gold-500/25 text-gold-400 shrink-0">
                <Icon className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>{feat.title}</span>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                </h3>
                <p className="text-xs text-dark-300 leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Royal Commitment Card */}
      <div className="p-6 rounded-2xl bg-dark-900/60 border border-gold-500/15 text-center space-y-2">
        <p className="text-xs text-dark-400 font-medium">
          Enjoy limitless communication with complete privacy and end-to-end WebRTC security on Nexus Royal.
        </p>
      </div>

    </div>
  );
};
