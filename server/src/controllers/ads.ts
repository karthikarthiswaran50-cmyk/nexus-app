import { Request, Response } from 'express';
import { db, getSystemSetting, persistAdViewToPg } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

/**
 * 1. Public Ad Configuration for Web & Mobile Clients
 */
export async function getPublicAdConfig(req: Request, res: Response): Promise<void> {
  try {
    const config = {
      enabled: getSystemSetting('ad_monetization_enabled', 'true') === 'true',
      provider: getSystemSetting('ad_network_provider', 'adsterra'),
      publisherId: getSystemSetting('ad_publisher_id', '6109232'),
      bannerZoneId: getSystemSetting('ad_banner_zone_id', ''),
      interstitialZoneId: getSystemSetting('ad_interstitial_zone_id', ''),
      rewardedZoneId: getSystemSetting('ad_rewarded_zone_id', ''),
      customScript: getSystemSetting('ad_custom_script', '<script data-cfasync="false" src="https://bicea.org/14/fdc62d798090ac18b8e831e601033773"></script>'),
      bannerEnabled: getSystemSetting('ad_banner_enabled', 'true') === 'true',
      interstitialEnabled: getSystemSetting('ad_interstitial_enabled', 'true') === 'true',
    };

    res.json(config);
  } catch (error: any) {
    console.error('getPublicAdConfig error:', error);
    res.status(500).json({ error: 'Failed to retrieve ad config' });
  }
}

/**
 * 2. Track Banner or Interstitial Ad Impressions
 */
export async function trackAdImpression(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || 'guest';
    const { adType } = req.body;
    const cleanType = adType === 'interstitial' ? 'interstitial' : 'banner';

    const adViewId = 'ad_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO ad_views (id, user_id, ad_type, coins_awarded, cash_value_inr, ip_address, created_at)
      VALUES (?, ?, ?, 0, 0.10, ?, datetime('now'))
    `).run(adViewId, userId, cleanType, req.ip || '');

    persistAdViewToPg({
      id: adViewId,
      user_id: userId,
      ad_type: cleanType,
      coins_awarded: 0,
      cash_value_inr: 0.10,
      ip_address: req.ip || '',
      created_at: nowIso,
    });

    res.json({ success: true, id: adViewId });
  } catch (error: any) {
    console.error('trackAdImpression error:', error);
    res.status(500).json({ error: 'Failed to track impression' });
  }
}
