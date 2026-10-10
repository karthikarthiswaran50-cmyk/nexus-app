import React from 'react';
import { ArrowLeft, Shield, Sparkles, Phone, Video, Users, Lock, Heart, Award, Cpu, Globe2, Radio, CheckCircle2, MessageSquare } from 'lucide-react';

interface AboutUsViewProps {
  onBack?: () => void;
}

export const AboutUsView: React.FC<AboutUsViewProps> = ({ onBack }) => {
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
    <div className="min-h-screen bg-dark-950 text-dark-100 font-['Plus_Jakarta_Sans',sans-serif] selection:bg-gold-500/30 selection:text-gold-200">
      {/* Top Header */}
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
            <Sparkles className="w-5 h-5 text-gold-400" />
            <span className="text-sm font-black gold-gradient-text">ABOUT NEXUS ROYAL</span>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('contact')}
            className="text-xs font-bold text-amber-300 hover:text-white hidden sm:inline-block px-3 py-1.5 rounded-xl bg-gold-500/10 border border-gold-500/30 hover:bg-gold-500/20 transition-all cursor-pointer"
          >
            Contact Support
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-10 leading-relaxed">
        {/* Hero Section */}
        <div className="p-6 sm:p-10 rounded-3xl bg-dark-900 border border-gold-500/30 royal-card shadow-2xl relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 bg-gold-500/10 rounded-full blur-3xl" />
          <div className="flex items-center gap-2.5 mb-4">
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-gold-500/20 text-gold-300 border border-gold-500/30">
              Real-Time Communication Platform
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Web & Mobile PWA
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-3">
            Connecting People with Crystal-Clear Audio & Video
          </h1>
          <p className="text-xs sm:text-sm text-dark-300 max-w-2xl leading-normal">
            Nexus Royal is an independent real-time audio calling, video calling, and messaging web platform built to provide fast, reliable, and private communications directly inside modern web browsers and mobile devices.
          </p>

          <div className="mt-6 pt-6 border-t border-gold-500/15 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-3 rounded-2xl bg-dark-850/60 border border-gold-500/10">
              <div className="text-lg sm:text-xl font-black text-amber-300">WebRTC</div>
              <div className="text-[10px] text-dark-400 uppercase tracking-wider font-semibold mt-0.5">Peer-to-Peer Calling</div>
            </div>
            <div className="p-3 rounded-2xl bg-dark-850/60 border border-gold-500/10">
              <div className="text-lg sm:text-xl font-black text-amber-300">WebSocket</div>
              <div className="text-[10px] text-dark-400 uppercase tracking-wider font-semibold mt-0.5">Instant Messaging</div>
            </div>
            <div className="p-3 rounded-2xl bg-dark-850/60 border border-gold-500/10">
              <div className="text-lg sm:text-xl font-black text-amber-300">PWA</div>
              <div className="text-[10px] text-dark-400 uppercase tracking-wider font-semibold mt-0.5">Installable App</div>
            </div>
            <div className="p-3 rounded-2xl bg-dark-850/60 border border-gold-500/10">
              <div className="text-lg sm:text-xl font-black text-amber-300">Dual Sync</div>
              <div className="text-[10px] text-dark-400 uppercase tracking-wider font-semibold mt-0.5">SQLite & PostgreSQL</div>
            </div>
          </div>
        </div>

        {/* Our Mission */}
        <section className="p-6 sm:p-8 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400 shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Our Mission</h2>
          </div>
          <p className="text-xs sm:text-sm text-dark-200 leading-relaxed">
            Our mission is simple: to make private, high-fidelity real-time audio and video communications accessible to everyone around the world without heavy downloads, clunky setups, or commercial exploitation of personal data.
          </p>
          <p className="text-xs sm:text-sm text-dark-300 leading-relaxed">
            Whether speaking with family across borders, joining live group voice stages, or exchanging private messages, Nexus Royal delivers seamless performance across desktop computers, tablets, and smartphones.
          </p>
        </section>

        {/* Core Features */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">What Nexus Royal Delivers</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-5 rounded-2xl bg-dark-900/70 border border-gold-500/15 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Phone className="w-4 h-4 text-amber-400" />
                <span>HD Audio Calling</span>
              </div>
              <p className="text-dark-300 leading-relaxed">
                Peer-to-peer audio calls powered by WebRTC with adaptive bitrate adjustment and data-saving options for low-bandwidth mobile connections.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-dark-900/70 border border-gold-500/15 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Video className="w-4 h-4 text-amber-400" />
                <span>Ultra-Clear Video Calling</span>
              </div>
              <p className="text-dark-300 leading-relaxed">
                Direct camera streams with camera switching, mute/unmute controls, and real-time signaling via encrypted WebSocket connections.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-dark-900/70 border border-gold-500/15 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Radio className="w-4 h-4 text-amber-400" />
                <span>Live Audio Spaces & Voice Stages</span>
              </div>
              <p className="text-dark-300 leading-relaxed">
                Interactive group voice stages enabling moderators and listeners to hold live community audio discussions in real time.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-dark-900/70 border border-gold-500/15 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <span>Real-Time Messaging & Rich Media</span>
              </div>
              <p className="text-dark-300 leading-relaxed">
                Instant chat delivery, voice notes, video bubbles, emoji reactions, quoted replies, interactive polls, and disappearing messages.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-dark-900/70 border border-gold-500/15 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Privacy & Local Vault Lock</span>
              </div>
              <p className="text-dark-300 leading-relaxed">
                Granular privacy toggles for Last Seen, Online status, and call permissions, alongside local 4-digit PIN vault locking.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-dark-900/70 border border-gold-500/15 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Globe2 className="w-4 h-4 text-amber-400" />
                <span>Progressive Web App (PWA)</span>
              </div>
              <p className="text-dark-300 leading-relaxed">
                Installable on Android, Windows, macOS, and iOS as a standalone app with service worker offline caching and Web Push notifications.
              </p>
            </div>
          </div>
        </section>

        {/* Developer & Architecture Transparency */}
        <section className="p-6 sm:p-8 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Transparency & Technical Architecture</h2>
          </div>
          <div className="text-xs text-dark-300 space-y-2.5">
            <p>
              Nexus Royal is developed and maintained by <strong>Karthik Arthiswaran</strong>. The service operates with a focus on code efficiency, reliable state persistence, and responsive UI design.
            </p>
            <p>
              <strong>Frontend:</strong> React 18 with TypeScript, Vite, Tailwind CSS, Lucide icons, and modern Web APIs (WebRTC, MediaStream, WebAudio, Service Workers).
            </p>
            <p>
              <strong>Backend:</strong> Node.js with Express, TypeScript, Socket.io real-time signaling, SQLite in-memory cache, and persistent PostgreSQL storage.
            </p>
            <p>
              <strong>Official Website:</strong> <a href="https://nexusroyal.online" className="text-amber-300 underline">https://nexusroyal.online</a>
            </p>
            <p>
              <strong>Support Email:</strong> <a href="mailto:karthikarthiswaran50@gmail.com" className="text-amber-300 underline font-mono">karthikarthiswaran50@gmail.com</a>
            </p>
          </div>
        </section>

        {/* Quick Links Footer Navigation */}
        <div className="pt-6 border-t border-gold-500/15 flex flex-wrap gap-4 text-xs text-dark-300 justify-center">
          <button type="button" onClick={() => navigateTo('privacy')} className="hover:text-amber-300 underline cursor-pointer">
            Privacy Policy
          </button>
          <span>•</span>
          <button type="button" onClick={() => navigateTo('terms')} className="hover:text-amber-300 underline cursor-pointer">
            Terms & Conditions
          </button>
          <span>•</span>
          <button type="button" onClick={() => navigateTo('community-guidelines')} className="hover:text-amber-300 underline cursor-pointer">
            Community Guidelines
          </button>
          <span>•</span>
          <button type="button" onClick={() => navigateTo('contact')} className="hover:text-amber-300 underline cursor-pointer">
            Contact Us
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
