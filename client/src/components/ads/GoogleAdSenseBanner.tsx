import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ExternalLink, X, ShieldCheck } from 'lucide-react';
import { getAdConfig, injectGoogleAdSense, recordAdImpression, AdConfig } from '../../utils/adManager';

interface GoogleAdSenseBannerProps {
  slotName?: string;
  slotId?: string;
  className?: string;
  onDismiss?: () => void;
}

const DEFAULT_SPONSORED_CREATIVES = [
  {
    title: '⚡ Royal Instant UPI Pay',
    tagline: 'Zero Transaction Fee UPI Merchant Payments with Guaranteed 5% Cashback',
    cta: 'Explore Offer',
    url: 'https://nexusroyal.online',
    gradient: 'from-amber-950/40 via-yellow-950/30 to-amber-900/40',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    title: '🛡️ Nexus End-to-End Encryption',
    tagline: 'Protect your calls and chats with military-grade zero-knowledge encryption',
    cta: 'Learn More',
    url: 'https://nexusroyal.online',
    gradient: 'from-blue-950/40 via-slate-900/30 to-indigo-950/40',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  {
    title: '🛍️ SmartShop India Mega Deals',
    tagline: 'Exclusive electronics & daily deals with free express shipping across India',
    cta: 'Shop Now',
    url: 'https://nexusroyal.online',
    gradient: 'from-emerald-950/40 via-teal-950/30 to-emerald-900/40',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
];

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

export const GoogleAdSenseBanner: React.FC<GoogleAdSenseBannerProps> = ({
  slotName = 'general',
  slotId,
  className = '',
  onDismiss,
}) => {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [adFilled, setAdFilled] = useState(false);
  const [creativeIndex, setCreativeIndex] = useState(0);
  const adInsRef = useRef<HTMLModElement | null>(null);
  const pushAttemptedRef = useRef(false);

  useEffect(() => {
    // Pick deterministic or random fallback creative
    const idx = Math.floor(Math.random() * DEFAULT_SPONSORED_CREATIVES.length);
    setCreativeIndex(idx);

    let isMounted = true;
    getAdConfig().then((cfg) => {
      if (isMounted) {
        setConfig(cfg);
        if (cfg.adsenseEnabled !== false) {
          injectGoogleAdSense(cfg.adsenseClientId);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!config || pushAttemptedRef.current || !adInsRef.current) return;

    if (config.adsenseEnabled !== false) {
      try {
        pushAttemptedRef.current = true;
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        recordAdImpression('banner');
      } catch (e) {
        // Fallback creative remains visible seamlessly
      }
    }
  }, [config]);

  // Observer to detect when Google AdSense fills the slot with real iframe
  useEffect(() => {
    if (!adInsRef.current) return;

    const checkFilled = () => {
      if (adInsRef.current) {
        const status = adInsRef.current.getAttribute('data-ad-status');
        const hasIframe = adInsRef.current.querySelector('iframe') !== null;
        if (status === 'filled' || hasIframe) {
          setAdFilled(true);
        }
      }
    };

    const observer = new MutationObserver(checkFilled);
    observer.observe(adInsRef.current, { attributes: true, childList: true, subtree: true });

    // Check periodically for 4 seconds after mount
    const interval = setInterval(checkFilled, 1000);
    const timeout = setTimeout(() => clearInterval(interval), 4000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  if (dismissed) return null;
  if (config && !config.enabled) return null;

  const creative = DEFAULT_SPONSORED_CREATIVES[creativeIndex];
  const clientId = config?.adsenseClientId || 'ca-pub-1878140842080937';
  const effectiveSlot = slotId || config?.adsenseSlotId || '7182930415';

  return (
    <div
      data-ad-placement={`adsense-${slotName}`}
      className={`relative w-full rounded-2xl border ${creative.border} bg-gradient-to-r ${creative.gradient} backdrop-blur-xl p-2.5 sm:p-3 overflow-hidden shadow-lg transition-all min-h-[92px] flex flex-col justify-center ${className}`}
    >
      {/* Policy Compliance Label */}
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-widest font-black text-dark-400 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-gold-400" />
            Advertisement
          </span>
          <span className="text-[9px] text-dark-500 font-mono">• Google AdSense</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          aria-label="Close advertisement"
          className="text-dark-500 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Main Banner Unit */}
      <div className="relative min-h-[52px] flex items-center justify-between">
        {/* Live AdSense Unit */}
        <div className={`w-full overflow-hidden flex items-center justify-center ${adFilled ? 'block' : 'hidden'}`}>
          <ins
            ref={adInsRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', minHeight: '52px' }}
            data-ad-client={clientId.startsWith('ca-pub-') ? clientId : `ca-pub-${clientId}`}
            data-ad-slot={effectiveSlot}
            data-ad-format="horizontal"
            data-full-width-responsive="true"
          />
        </div>

        {/* Fallback Sponsored Creative (visible when AdSense is loading, pending, or unfilled) */}
        {!adFilled && (
          <div className="flex items-center justify-between gap-3 w-full">
            {/* Left Side: Graphic icon & creative content */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/20 border border-gold-500/30 flex items-center justify-center shrink-0 text-amber-300 shadow-sm">
                <ShieldCheck className="w-5 h-5 text-gold-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${creative.badge}`}>
                    Sponsored
                  </span>
                  <h4 className="text-xs sm:text-sm font-extrabold text-white truncate">
                    {creative.title}
                  </h4>
                </div>
                <p className="text-[11px] text-dark-300 line-clamp-1 mt-0.5">
                  {creative.tagline}
                </p>
              </div>
            </div>

            {/* Right Side: CTA Button */}
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={creative.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-dark-950 text-xs font-black transition-all flex items-center gap-1 shadow-md cursor-pointer active:scale-95"
              >
                <span>{creative.cta}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
