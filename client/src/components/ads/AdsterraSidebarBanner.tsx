import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, X, Zap } from 'lucide-react';
import { getAdConfig, recordAdImpression, AdConfig } from '../../utils/adManager';

interface AdsterraSidebarBannerProps {
  className?: string;
  onDismiss?: () => void;
}

const ADSTERRA_FALLBACK_OFFERS = [
  {
    title: '👑 Nexus Royal VIP Pass',
    badge: 'Exclusive',
    description: 'Unlock 4K HD video streams, custom badges & zero latency calling.',
    cta: 'Get VIP',
    url: 'https://nexusroyal.online',
  },
  {
    title: '⚡ Cloud Connect Turbo',
    badge: 'Trending',
    description: 'Supercharge your connection with ultra-fast edge relays across India.',
    cta: 'Explore',
    url: 'https://nexusroyal.online',
  },
  {
    title: '🛡️ Private Stealth Mode',
    badge: 'Privacy',
    description: 'Mask your online status and call logs with 1-click ghost presence.',
    cta: 'Learn More',
    url: 'https://nexusroyal.online',
  },
];

export const AdsterraSidebarBanner: React.FC<AdsterraSidebarBannerProps> = ({
  className = '',
  onDismiss,
}) => {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [offerIndex, setOfferIndex] = useState(0);
  const adsterraContainerRef = useRef<HTMLDivElement | null>(null);
  const scriptAppendedRef = useRef(false);

  useEffect(() => {
    setOfferIndex(Math.floor(Math.random() * ADSTERRA_FALLBACK_OFFERS.length));

    let isMounted = true;
    getAdConfig().then((cfg) => {
      if (isMounted) {
        setConfig(cfg);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!config || scriptAppendedRef.current || !adsterraContainerRef.current) return;

    if (config.adsterraEnabled !== false && config.adsterraBannerZoneId) {
      try {
        scriptAppendedRef.current = true;
        // Inject Adsterra script container if zone id provided
        const zoneScript = document.createElement('script');
        zoneScript.type = 'text/javascript';
        zoneScript.src = `https://bicea.org/${config.adsterraBannerZoneId}`;
        zoneScript.async = true;
        zoneScript.setAttribute('data-cfasync', 'false');
        adsterraContainerRef.current.appendChild(zoneScript);
        recordAdImpression('banner');
      } catch (e) {
        // Fallback offer renders cleanly
      }
    }
  }, [config]);

  if (dismissed) return null;
  if (config && !config.enabled) return null;

  const offer = ADSTERRA_FALLBACK_OFFERS[offerIndex];

  return (
    <div
      data-ad-network="adsterra-sidebar"
      className={`relative mx-2 sm:mx-3 my-2 p-3 rounded-2xl bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950 border border-gold-500/20 shadow-xl overflow-hidden transition-all min-h-[96px] ${className}`}
    >
      {/* Decorative top ambient glow */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-16 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />

      {/* Header Label: Distinct from AdSense */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[9px] uppercase tracking-wider font-extrabold text-gold-400">
            Sponsored • Adsterra
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          aria-label="Dismiss sponsored content"
          className="text-dark-500 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Offer Content */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <h5 className="text-xs font-bold text-white truncate">
              {offer.title}
            </h5>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
              {offer.badge}
            </span>
          </div>
          <p className="text-[10px] text-dark-300 line-clamp-2 leading-relaxed">
            {offer.description}
          </p>
        </div>

        <a
          href={offer.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-dark-950 text-[10px] font-black shrink-0 flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <Zap className="w-2.5 h-2.5" />
          <span>{offer.cta}</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

      {/* Adsterra script container hook */}
      <div ref={adsterraContainerRef} id="adsterra-sidebar-slot" className="hidden" />
    </div>
  );
};
