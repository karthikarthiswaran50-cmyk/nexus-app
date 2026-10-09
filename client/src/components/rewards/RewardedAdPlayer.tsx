import React, { useState, useEffect } from 'react';
import { X, Volume2, VolumeX, Sparkles, Award, ShieldCheck, CheckCircle2, Play } from 'lucide-react';
import { recordAdImpression } from '../../utils/adManager';

interface RewardedAdPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  onAdCompleted: () => void;
  coinsReward?: number;
  cashReward?: number;
}

// Engaging Sponsor Creatives
const SPONSOR_ADS = [
  {
    sponsor: 'Nexus Cloud Security',
    tagline: 'End-to-End Military-Grade Encryption for All Calls & Data',
    category: 'Technology & Privacy',
    cta: 'Learn More',
    bgColor: 'from-blue-950 via-slate-900 to-indigo-950',
    accentColor: '#38bdf8',
    iconEmoji: '🛡️',
    highlights: ['Zero-Knowledge Architecture', '99.99% Global Uptime', 'Verified by Independent Audits'],
    rating: '4.9 ★★★★★',
  },
  {
    sponsor: 'Royal Pay & UPI Instant',
    tagline: 'Zero Fee Merchant UPI Payments with Instant Cashbacks',
    category: 'Finance & Payments',
    cta: 'Explore Offers',
    bgColor: 'from-amber-950 via-dark-900 to-yellow-950',
    accentColor: '#f59e0b',
    iconEmoji: '⚡',
    highlights: ['Instant 1-Second Settlements', 'Accepted at 10M+ Stores', '100% RBI Compliant'],
    rating: '4.8 ★★★★★',
  },
  {
    sponsor: 'SmartShop India',
    tagline: 'Save Up to 60% on Electronics, Fashion & Daily Essentials',
    category: 'Shopping & Rewards',
    cta: 'Shop Deals',
    bgColor: 'from-emerald-950 via-zinc-900 to-teal-950',
    accentColor: '#10b981',
    iconEmoji: '🛍️',
    highlights: ['Free Express Delivery', 'Assured 7-Day Returns', 'Earn 5% Royal Cashback'],
    rating: '4.9 ★★★★★',
  },
];

export const RewardedAdPlayer: React.FC<RewardedAdPlayerProps> = ({
  isOpen,
  onClose,
  onAdCompleted,
  coinsReward = 50,
  cashReward = 0.50,
}) => {
  const AD_DURATION = 15; // 15 seconds rewarded video
  const [timeLeft, setTimeLeft] = useState(AD_DURATION);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedAd, setSelectedAd] = useState(SPONSOR_ADS[0]);

  useEffect(() => {
    if (isOpen) {
      recordAdImpression('rewarded_video');
      // Pick a random sponsor creative
      const randomAd = SPONSOR_ADS[Math.floor(Math.random() * SPONSOR_ADS.length)];
      setSelectedAd(randomAd);
      setTimeLeft(AD_DURATION);
      setIsCompleted(false);

      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsCompleted(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const progressPercent = ((AD_DURATION - timeLeft) / AD_DURATION) * 100;

  const handleClaim = () => {
    if (isCompleted) {
      onAdCompleted();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className={`relative w-full max-w-lg rounded-3xl overflow-hidden border border-gold-500/30 shadow-2xl bg-gradient-to-b ${selectedAd.bgColor} text-white flex flex-col`}>
        
        {/* Top Ad Navigation Bar */}
        <div className="px-4 py-3 bg-black/40 backdrop-blur-md flex items-center justify-between border-b border-white/10 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-gold-500/20 border border-gold-500/40 text-[10px] font-black uppercase tracking-wider text-amber-300">
              Sponsored Ad
            </span>
            <span className="text-xs text-dark-300 font-semibold">{selectedAd.category}</span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-dark-200 hover:text-white transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Countdown / Locked Indicator */}
            {!isCompleted ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono text-xs font-black shadow-inner">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Reward in {timeLeft}s</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Close ad"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 transition-all duration-1000 ease-linear shadow-sm shadow-amber-400/50"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Ad Video / Creative Canvas */}
        <div className="p-6 sm:p-8 flex flex-col items-center text-center space-y-6 relative overflow-hidden">
          
          {/* Ambient Glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ backgroundColor: selectedAd.accentColor }}
          />

          {/* Brand Icon & Rating */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-dark-900/80 border-2 border-gold-500/40 shadow-2xl flex items-center justify-center text-4xl sm:text-5xl mb-3 shadow-gold-500/20 animate-pulse">
              {selectedAd.iconEmoji}
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {selectedAd.sponsor}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-amber-300 font-bold">{selectedAd.rating}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Verified Sponsor
              </span>
            </div>
          </div>

          {/* Ad Pitch Message */}
          <p className="text-sm sm:text-base text-zinc-200 max-w-sm leading-relaxed font-medium z-10">
            {selectedAd.tagline}
          </p>

          {/* Feature Highlights Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 z-10 max-w-md">
            {selectedAd.highlights.map((h, i) => (
              <div
                key={i}
                className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-zinc-300 flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{h}</span>
              </div>
            ))}
          </div>

          {/* Non-Skip Guidance Banner */}
          {!isCompleted ? (
            <div className="w-full p-3 rounded-2xl bg-black/40 border border-white/10 text-xs text-zinc-300 flex items-center justify-center gap-2 z-10">
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Watch until countdown ends to receive <strong>+{coinsReward} Coins (₹{cashReward.toFixed(2)})</strong></span>
            </div>
          ) : (
            <div className="w-full p-4 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 flex flex-col items-center gap-1.5 z-10 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 text-sm sm:text-base font-black text-emerald-300">
                <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
                <span>Reward Successfully Unlocked!</span>
              </div>
              <p className="text-xs text-emerald-200/90 font-medium">
                +{coinsReward} Royal Coins (₹{cashReward.toFixed(2)}) ready to be credited to your wallet.
              </p>
            </div>
          )}
        </div>

        {/* Bottom CTA / Claim Bar */}
        <div className="p-4 sm:p-5 bg-black/50 backdrop-blur-md border-t border-white/10 flex items-center gap-3 z-10">
          <button
            type="button"
            onClick={() => window.open('https://nexusroyal.online', '_blank')}
            className="flex-1 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/10"
          >
            {selectedAd.cta} ↗
          </button>

          <button
            type="button"
            onClick={handleClaim}
            disabled={!isCompleted}
            className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
              isCompleted
                ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:from-amber-300 hover:to-yellow-200 text-dark-950 shadow-gold-500/30 scale-102 hover:scale-105 active:scale-95'
                : 'bg-dark-800 text-dark-500 cursor-not-allowed opacity-60 border border-white/5'
            }`}
          >
            {isCompleted ? (
              <>
                <Sparkles className="w-4 h-4 fill-dark-950" />
                <span>Claim +{coinsReward} Coins</span>
              </>
            ) : (
              <span>Wait {timeLeft}s to Claim</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
