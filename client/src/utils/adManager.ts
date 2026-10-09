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
}

let cachedConfig: AdConfig | null = null;
let scriptInjected = false;

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
      provider: 'monetag',
      publisherId: '',
      bannerZoneId: '',
      interstitialZoneId: '',
      rewardedZoneId: '',
      customScript: '',
      bannerEnabled: true,
      interstitialEnabled: true,
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
  if (!config || !config.enabled || scriptInjected) return;

  try {
    // 1. Google AdSense Script Injection
    if (config.provider === 'google_adsense' && config.publisherId) {
      const pubId = config.publisherId.startsWith('ca-pub-')
        ? config.publisherId
        : `ca-pub-${config.publisherId}`;
      const script = document.createElement('script');
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pubId}`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
      scriptInjected = true;
    }

    // 2. Custom Script Injection (Monetag MultiTag, Adsterra Social Bar, etc.)
    if (config.customScript && config.customScript.trim()) {
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
