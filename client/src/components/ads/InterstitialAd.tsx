import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Sparkles, ShieldCheck, Play, ArrowRight } from 'lucide-react';
import { getAdConfig, recordAdImpression, AdConfig } from '../../utils/adManager';

interface InterstitialAdProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

const INTERSTITIAL_CREATIVES = [
  {
    sponsor: 'Royal Gold Savings & Digital Vault',
    headline: 'Invest in 24K Pure Digital Gold starting from just ₹10',
    description: '100% insured, vaulted with SEBI-regulated custodians, and zero storage fees forever.',
    cta: 'Start Gold Savings',
    url: 'https://nexusroyal.online',
    bgColor: 'from-amber-950 via-dark-900 to-yellow-950',
    accentColor: '#f59e0b',
    iconEmoji: '🏆',
    features: ['Instant Buy & Sell 24/7', 'Doorstep Physical Gold Delivery', 'Bank-Grade Security'],
  },
  {
    sponsor: 'Nexus Cloud VPN & Secure Shield',
    headline: 'Ultra-Fast Private Browsing with Zero Data Logging',
    description: 'Keep your internet provider and trackers away from your private personal messages and calls.',
    cta: 'Get 30-Day Free Trial',
    url: 'https://nexusroyal.online',
    bgColor: 'from-blue-950 via-slate-900 to-indigo-950',
    accentColor: '#38bdf8',
    iconEmoji: '🛡️',
    features: ['10 Gbps WireGuard Servers', 'No DNS Leaks Guaranteed', 'One-Click Connect'],
  },
];

export const InterstitialAd: React.FC<InterstitialAdProps> = ({ isOpen, onClose, title = 'Sponsored Message' }) => {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [canSkip, setCanSkip] = useState(false);
  const [creative, setCreative] = useState(INTERSTITIAL_CREATIVES[0]);
  const impressionLogged = useRef(false);

  useEffect(() => {
    if (isOpen) {
      getAdConfig().then((cfg) => setConfig(cfg));
      const randomIndex = Math.floor(Math.random() * INTERSTITIAL_CREATIVES.length);
      setCreative(INTERSTITIAL_CREATIVES[randomIndex]);
      setCountdown(5);
      setCanSkip(false);

      if (!impressionLogged.current) {
        impressionLogged.current = true;
        recordAdImpression('interstitial');
      }

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanSkip(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(timer);
        impressionLogged.current = false;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // If ads or interstitials are disabled
  if (config && (!config.enabled || !config.interstitialEnabled)) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div
        className={`relative w-full max-w-md rounded-3xl overflow-hidden border border-gold-500/30 shadow-2xl bg-gradient-to-b ${creative.bgColor} text-white flex flex-col p-6 sm:p-7 space-y-6`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{creative.iconEmoji}</span>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                {title}
              </span>
              <span className="text-xs font-bold text-dark-300">NexusRoyal Partner</span>
            </div>
          </div>

          {/* Countdown / Skip Button */}
          {canSkip ? (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-black text-white flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
            >
              <span>Continue</span>
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="px-3 py-1 rounded-full bg-black/40 border border-white/10 text-xs font-mono font-bold text-amber-300">
              Skip in {countdown}s
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
              {creative.sponsor}
            </h3>
            <p className="text-sm font-semibold text-amber-200">
              {creative.headline}
            </p>
          </div>

          <p className="text-xs text-dark-300 leading-relaxed">
            {creative.description}
          </p>

          {/* Highlights */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            {creative.features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-dark-200">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex items-center gap-3">
          <a
            href={creative.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-dark-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg hover:brightness-105 transition-all cursor-pointer"
          >
            <span>{creative.cta}</span>
            <ExternalLink className="w-4 h-4" />
          </a>

          {canSkip && (
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer border border-white/10"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
