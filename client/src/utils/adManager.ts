import axios from 'axios';

export interface AdConfig {
  enabled: boolean;
  provider: 'monetag' | 'adsterra' | 'google_adsense' | 'custom' | string;
  publisherId: string;
  bannerZoneId: string;
  interstitialZoneId: string;
  rewardedZoneId: string;
  customScript: string;
  bannerEnabled: boolean;
  interstitialEnabled: boolean;
  adsenseClientId?: string;
  adsenseSlotId?: string;
  adsterraBannerZoneId?: string;
  adsenseEnabled?: boolean;
  adsterraEnabled?: boolean;
}

let cachedConfig: AdConfig | null = null;
let scriptInjected = false;
let adsenseInjected = false;

/**
 * Dynamically injects Google AdSense library if not already injected
 */
export function injectGoogleAdSense(clientId?: string): void {
  if (typeof window === 'undefined' || adsenseInjected) return;
  const targetClient = clientId || cachedConfig?.adsenseClientId || 'ca-pub-6502758117978252';
  const cleanId = targetClient.startsWith('ca-pub-') ? targetClient : `ca-pub-${targetClient}`;

  // Check if script tag already exists in DOM
  if (document.querySelector(`script[src*="pagead2.googlesyndication.com"]`)) {
    adsenseInjected = true;
    return;
  }

  try {
    const script = document.createElement('script');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cleanId}`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
    adsenseInjected = true;
  } catch (err) {
    console.warn('Could not inject AdSense script:', err);
  }
}

/**
 * Fetch ad configuration from server
 */
export async function getAdConfig(): Promise<AdConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await axios.get('/api/ads/config');
    cachedConfig = res.data;
    applyGlobalAdScripts(cachedConfig);
    return cachedConfig!;
  } catch (err) {
    console.warn('Failed to load ad configuration, using safe defaults:', err);
    return {
      enabled: true,
      provider: 'adsterra',
      publisherId: '',
      bannerZoneId: '',
      interstitialZoneId: '',
      rewardedZoneId: '',
      customScript: '',
      bannerEnabled: true,
      interstitialEnabled: true,
      adsenseClientId: 'ca-pub-6502758117978252',
      adsenseSlotId: '7182930415',
      adsterraBannerZoneId: '14/fdc62d798090ac18b8e831e601033773',
      adsenseEnabled: true,
      adsterraEnabled: true,
    };
  }
}

/**
 * Reset config cache so updates from admin panel apply immediately
 */
export function invalidateAdConfigCache() {
  cachedConfig = null;
}

/**
 * Dynamically injects external ad network SDK or custom header script
 */
export function applyGlobalAdScripts(config: AdConfig | null) {
  if (!config || !config.enabled) return;

  try {
    // 1. Google AdSense Script Injection (for compliant static banner areas)
    if (config.adsenseEnabled !== false && (config.adsenseClientId || config.provider === 'google_adsense')) {
      const pubId = config.adsenseClientId || config.publisherId || 'ca-pub-6502758117978252';
      injectGoogleAdSense(pubId);
    }

    // 2. Custom Script Injection (Adsterra Social Bar, Monetag, etc.)
    if (config.customScript && config.customScript.trim() && !scriptInjected) {
      const container = document.createElement('div');
      container.id = 'nexus-royal-custom-ad-tag';
      container.innerHTML = config.customScript;
      // Extract script tags inside and execute them
      const scripts = container.querySelectorAll('script');
      scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        document.head.appendChild(newScript);
      });
      scriptInjected = true;
    }
  } catch (e) {
    console.warn('Ad script injection error:', e);
  }
}

/**
 * Track an ad impression to backend for owner earnings calculation
 */
export async function recordAdImpression(adType: 'banner' | 'interstitial' | 'rewarded_video') {
  try {
    await axios.post('/api/ads/track-impression', { adType });
  } catch (err) {
    // Non-blocking telemetry
  }
}
