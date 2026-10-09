import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Sparkles, ShieldCheck } from 'lucide-react';
import { getAdConfig, recordAdImpression, AdConfig } from '../../utils/adManager';

interface BannerAdProps {
  className?: string;
  onDismiss?: () => void;
}

const DEFAULT_BANNER_CREATIVES = [
  {
    title: '⚡ Royal Instant UPI Pay',
    tagline: 'Zero Transaction Fee UPI Merchant Payments with Guaranteed 5% Cashback',
    cta: 'Explore Offer',
    url: 'https://nexusroyal.online',
    bgColor: 'from-amber-950/40 via-yellow-950/30 to-amber-900/40',
    borderColor: 'border-amber-500/30',
    tagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    title: '🛡️ Nexus End-to-End Encryption',
    tagline: 'Protect your calls and chats with military-grade zero-knowledge encryption',
    cta: 'Learn More',
    url: 'https://nexusroyal.online',
    bgColor: 'from-blue-950/40 via-slate-900/30 to-indigo-950/40',
    borderColor: 'border-blue-500/30',
    tagColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  {
    title: '🛍️ SmartShop India Mega Deals',
    tagline: 'Exclusive electronics & daily deals with free express shipping across India',
    cta: 'Shop Now',
    url: 'https://nexusroyal.online',
    bgColor: 'from-emerald-950/40 via-teal-950/30 to-emerald-900/40',
    borderColor: 'border-emerald-500/30',
    tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
];

export const BannerAd: React.FC<BannerAdProps> = ({ className = '', onDismiss }) => {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [creative, setCreative] = useState(DEFAULT_BANNER_CREATIVES[0]);
  const adRef = useRef<HTMLDivElement>(null);
  const impressionLogged = useRef(false);

  useEffect(() => {
    let isMounted = true;
    getAdConfig().then((cfg) => {
      if (isMounted) {
        setConfig(cfg);
      }
    });

    const randomIndex = Math.floor(Math.random() * DEFAULT_BANNER_CREATIVES.length);
    setCreative(DEFAULT_BANNER_CREATIVES[randomIndex]);

    // Record ad impression once per mount
    if (!impressionLogged.current) {
      impressionLogged.current = true;
      recordAdImpression('banner');
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Check if ads or banner are disabled
  if (isDismissed || (config && (!config.enabled || !config.bannerEnabled))) {
    return null;
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    if (onDismiss) onDismiss();
  };

  // Google AdSense Banner rendering
  const isGoogleAdSense = config?.provider === 'google_adsense' && !!config?.publisherId && !!config?.bannerZoneId;

  return (
    <div
      ref={adRef}
      className={`relative w-full overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${className}`}
    >
      <div
        className={`relative w-full p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r ${creative.bgColor} backdrop-blur-xl border ${creative.borderColor} shadow-lg flex items-center justify-between gap-3 text-white`}
      >
        {/* Left Side: Sponsor info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10 shadow-inner">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black text-white truncate">
                {creative.title}
              </span>
              <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full border ${creative.tagColor}`}>
                Sponsored
              </span>
            </div>
            <p className="text-[11px] text-dark-300 truncate hidden sm:block">
              {creative.tagline}
            </p>
          </div>
        </div>

        {/* Right Side: CTA Button & Dismiss Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={creative.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-dark-950 text-xs font-black hover:opacity-90 transition-opacity flex items-center gap-1 shadow-md cursor-pointer"
          >
            <span>{creative.cta}</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="p-1 rounded-lg text-dark-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* If Google AdSense is configured, embed AdSense container */}
        {isGoogleAdSense && (
          <div className="absolute inset-0 z-10 bg-dark-950/90 rounded-2xl overflow-hidden flex items-center justify-center">
            <ins
              className="adsbygoogle"
              style={{ display: 'inline-block', width: '100%', height: '50px' }}
              data-ad-client={config.publisherId.startsWith('ca-pub-') ? config.publisherId : `ca-pub-${config.publisherId}`}
              data-ad-slot={config.bannerZoneId}
              data-ad-format="horizontal"
              data-full-width-responsive="true"
            />
          </div>
        )}
      </div>
    </div>
  );
};
