import { Response } from 'express';
import { db, persistWalletToPg, persistAdViewToPg, persistPayoutToPg, recordActivity, pgPool } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getUserWithPlan } from './auth.js';

// Configuration
export const REWARDS_CONFIG = {
  COINS_PER_AD: 50,              // 50 Royal Coins per rewarded ad
  CASH_VALUE_PER_AD: 0.50,       // ₹0.50 per ad
  DAILY_AD_LIMIT: 20,            // 20 ads maximum per day (₹10/day max potential)
  MIN_PAYOUT_INR: 10.0,          // ₹10 minimum payout (1,000 Coins)
  AD_COOLDOWN_SECONDS: 15,       // 15 seconds cooldown between ads
  COINS_TO_INR_RATE: 100,        // 100 Coins = ₹1.00 INR
  STREAK_BONUSES: [20, 40, 60, 80, 100, 150, 250], // Daily login streak rewards
};

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Helper to ensure a user has a wallet in SQLite and return it
 */
export function getOrCreateWallet(userId: string) {
  const today = getTodayString();
  let wallet = db.prepare('SELECT * FROM user_wallets WHERE user_id = ?').get(userId) as any;

  if (!wallet) {
    // Welcome Bonus: 100 Coins (₹1.00) on first launch
    db.prepare(`
      INSERT OR IGNORE INTO user_wallets (user_id, coins_balance, cash_earned_inr, ads_watched_total, ads_watched_today, last_ad_date, streak_days, last_streak_date, updated_at)
      VALUES (?, 100, 1.0, 0, 0, ?, 1, '', datetime('now'))
    `).run(userId, today);

    wallet = db.prepare('SELECT * FROM user_wallets WHERE user_id = ?').get(userId) as any;

    if (wallet) {
      persistWalletToPg(wallet);
    }
  }

  // Daily reset check
  if (wallet && wallet.last_ad_date !== today) {
    db.prepare(`
      UPDATE user_wallets 
      SET ads_watched_today = 0, last_ad_date = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(today, userId);
    wallet.ads_watched_today = 0;
    wallet.last_ad_date = today;
  }

  return wallet;
}

// ----------------------------------------------------
// 1. Get User Rewards Wallet & Config
// ----------------------------------------------------
export async function getWallet(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const today = getTodayString();
    const wallet = getOrCreateWallet(userId);

    const canClaimStreak = wallet.last_streak_date !== today;

    // Fetch user's recent payout requests
    const payouts = db.prepare(`
      SELECT * FROM payout_requests
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 15
    `).all(userId);

    // Fetch recent ad views
    const recentAds = db.prepare(`
      SELECT * FROM ad_views
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(userId);

    res.json({
      wallet: {
        user_id: wallet.user_id,
        coins_balance: Number(wallet.coins_balance || 0),
        cash_earned_inr: Number(wallet.cash_earned_inr || 0),
        ads_watched_total: Number(wallet.ads_watched_total || 0),
        ads_watched_today: Number(wallet.ads_watched_today || 0),
        streak_days: Number(wallet.streak_days || 1),
        last_ad_watched_at: wallet.last_ad_watched_at,
        can_claim_streak: canClaimStreak,
      },
      config: REWARDS_CONFIG,
      payouts,
      recentAds,
    });
  } catch (error: any) {
    console.error('getWallet error:', error);
    res.status(500).json({ error: 'Failed to retrieve rewards wallet' });
  }
}

// ----------------------------------------------------
// 2. Complete Rewarded Ad View & Award Coins
// ----------------------------------------------------
export async function completeAdWatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const today = getTodayString();
    const wallet = getOrCreateWallet(userId);

    // Check Daily Limit
    if (wallet.ads_watched_today >= REWARDS_CONFIG.DAILY_AD_LIMIT) {
      res.status(400).json({
        error: `Daily limit reached (${REWARDS_CONFIG.DAILY_AD_LIMIT}/${REWARDS_CONFIG.DAILY_AD_LIMIT} ads). Please return tomorrow for more rewards!`,
      });
      return;
    }

    // Cooldown verification (minimum 10 seconds since last ad)
    if (wallet.last_ad_watched_at) {
      const lastWatchedTime = new Date(wallet.last_ad_watched_at).getTime();
      const diffSeconds = (Date.now() - lastWatchedTime) / 1000;
      if (diffSeconds < 10) {
        res.status(429).json({
          error: 'Please wait a few seconds before watching another rewarded ad.',
        });
        return;
      }
    }

    const coinsAwarded = REWARDS_CONFIG.COINS_PER_AD;
    const cashAwarded = REWARDS_CONFIG.CASH_VALUE_PER_AD;

    const newCoins = Number(wallet.coins_balance || 0) + coinsAwarded;
    const newCash = Number((Number(wallet.cash_earned_inr || 0) + cashAwarded).toFixed(2));
    const newToday = Number(wallet.ads_watched_today || 0) + 1;
    const newTotal = Number(wallet.ads_watched_total || 0) + 1;
    const nowIso = new Date().toISOString();

    // Update SQLite Wallet
    db.prepare(`
      UPDATE user_wallets
      SET coins_balance = ?, cash_earned_inr = ?, ads_watched_today = ?, ads_watched_total = ?, last_ad_date = ?, last_ad_watched_at = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(newCoins, newCash, newToday, newTotal, today, nowIso, userId);

    // Record Ad View Entry
    const adViewId = 'ad_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    db.prepare(`
      INSERT INTO ad_views (id, user_id, ad_type, coins_awarded, cash_value_inr, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(adViewId, userId, 'rewarded_video', coinsAwarded, cashAwarded, req.ip || '');

    // Dual-persist to PostgreSQL
    const updatedWallet = {
      user_id: userId,
      coins_balance: newCoins,
      cash_earned_inr: newCash,
      ads_watched_total: newTotal,
      ads_watched_today: newToday,
      last_ad_date: today,
      last_ad_watched_at: nowIso,
      streak_days: wallet.streak_days || 1,
      last_streak_date: wallet.last_streak_date || '',
    };
    persistWalletToPg(updatedWallet);
    persistAdViewToPg({
      id: adViewId,
      user_id: userId,
      ad_type: 'rewarded_video',
      coins_awarded: coinsAwarded,
      cash_value_inr: cashAwarded,
      ip_address: req.ip || '',
      created_at: nowIso,
    });

    recordActivity(userId, 'watched_ad_reward', {
      coinsAwarded,
      cashAwarded,
      totalCoins: newCoins,
    });

    res.json({
      success: true,
      message: `🎉 Reward claimed! +${coinsAwarded} Coins (₹${cashAwarded.toFixed(2)}) added to your wallet.`,
      reward: {
        coinsAwarded,
        cashAwarded,
      },
      wallet: {
        coins_balance: newCoins,
        cash_earned_inr: newCash,
        ads_watched_today: newToday,
        ads_watched_total: newTotal,
        remaining_today: Math.max(0, REWARDS_CONFIG.DAILY_AD_LIMIT - newToday),
      },
    });
  } catch (error: any) {
    console.error('completeAdWatch error:', error);
    res.status(500).json({ error: 'Failed to process ad reward' });
  }
}

// ----------------------------------------------------
// 3. Claim Daily Streak Bonus
// ----------------------------------------------------
export async function claimDailyStreak(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const today = getTodayString();
    const yesterday = getYesterdayString();
    const wallet = getOrCreateWallet(userId);

    if (wallet.last_streak_date === today) {
      res.status(400).json({ error: 'You have already claimed today\'s daily login streak bonus!' });
      return;
    }

    let newStreak = 1;
    if (wallet.last_streak_date === yesterday) {
      newStreak = ((Number(wallet.streak_days || 1) % 7) + 1);
    }

    const bonusCoins = REWARDS_CONFIG.STREAK_BONUSES[newStreak - 1] || 50;
    const cashValue = Number((bonusCoins / REWARDS_CONFIG.COINS_TO_INR_RATE).toFixed(2));

    const newCoins = Number(wallet.coins_balance || 0) + bonusCoins;
    const newCash = Number((Number(wallet.cash_earned_inr || 0) + cashValue).toFixed(2));

    db.prepare(`
      UPDATE user_wallets
      SET coins_balance = ?, cash_earned_inr = ?, streak_days = ?, last_streak_date = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(newCoins, newCash, newStreak, today, userId);

    persistWalletToPg({
      user_id: userId,
      coins_balance: newCoins,
      cash_earned_inr: newCash,
      ads_watched_total: wallet.ads_watched_total || 0,
      ads_watched_today: wallet.ads_watched_today || 0,
      last_ad_date: wallet.last_ad_date || today,
      streak_days: newStreak,
      last_streak_date: today,
    });

    recordActivity(userId, 'claimed_daily_streak', {
      streakDays: newStreak,
      bonusCoins,
    });

    res.json({
      success: true,
      message: `🔥 Day ${newStreak} Streak Claimed! +${bonusCoins} Coins added to your wallet!`,
      bonusCoins,
      streakDays: newStreak,
      wallet: {
        coins_balance: newCoins,
        cash_earned_inr: newCash,
        streak_days: newStreak,
        can_claim_streak: false,
      },
    });
  } catch (error: any) {
    console.error('claimDailyStreak error:', error);
    res.status(500).json({ error: 'Failed to claim streak bonus' });
  }
}

// ----------------------------------------------------
// 4. Request Instant UPI Cashout / Payout
// ----------------------------------------------------
export async function requestPayout(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { amountInr, upiId, accountHolderName } = req.body;

    const numAmount = Number(amountInr);
    if (isNaN(numAmount) || numAmount < REWARDS_CONFIG.MIN_PAYOUT_INR) {
      res.status(400).json({
        error: `Minimum withdrawal amount is ₹${REWARDS_CONFIG.MIN_PAYOUT_INR.toFixed(2)} (${REWARDS_CONFIG.MIN_PAYOUT_INR * REWARDS_CONFIG.COINS_TO_INR_RATE} Coins).`,
      });
      return;
    }

    if (!upiId || typeof upiId !== 'string' || !upiId.includes('@')) {
      res.status(400).json({
        error: 'Please enter a valid UPI ID (e.g., yourname@okaxis, yourname@paytm, yourname@ybl).',
      });
      return;
    }

    const cleanUpi = upiId.trim().toLowerCase();
    const cleanName = (accountHolderName && typeof accountHolderName === 'string') ? accountHolderName.trim() : '';

    const requiredCoins = Math.round(numAmount * REWARDS_CONFIG.COINS_TO_INR_RATE);
    const wallet = getOrCreateWallet(userId);

    if (Number(wallet.coins_balance || 0) < requiredCoins) {
      res.status(400).json({
        error: `Insufficient coins balance. You have ${wallet.coins_balance} Coins, but need ${requiredCoins} Coins for ₹${numAmount.toFixed(2)}.`,
      });
      return;
    }

    // Deduct coins & cash from wallet
    const newCoins = Number(wallet.coins_balance || 0) - requiredCoins;
    const newCash = Math.max(0, Number((Number(wallet.cash_earned_inr || 0) - numAmount).toFixed(2)));

    db.prepare(`
      UPDATE user_wallets
      SET coins_balance = ?, cash_earned_inr = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(newCoins, newCash, userId);

    const payoutId = 'pay_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO payout_requests (id, user_id, amount_inr, coins_redeemed, upi_id, account_holder_name, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(payoutId, userId, numAmount, requiredCoins, cleanUpi, cleanName, nowIso);

    // Dual-persist to PostgreSQL
    persistWalletToPg({
      ...wallet,
      coins_balance: newCoins,
      cash_earned_inr: newCash,
    });
    persistPayoutToPg({
      id: payoutId,
      user_id: userId,
      amount_inr: numAmount,
      coins_redeemed: requiredCoins,
      upi_id: cleanUpi,
      account_holder_name: cleanName,
      status: 'pending',
      created_at: nowIso,
    });

    recordActivity(userId, 'requested_payout', {
      payoutId,
      amountInr: numAmount,
      upiId: cleanUpi,
    });

    res.json({
      success: true,
      message: `✅ Payout request for ₹${numAmount.toFixed(2)} to ${cleanUpi} submitted successfully! Your payment will be processed within 2-24 hours.`,
      payout: {
        id: payoutId,
        amount_inr: numAmount,
        coins_redeemed: requiredCoins,
        upi_id: cleanUpi,
        account_holder_name: cleanName,
        status: 'pending',
        created_at: nowIso,
      },
      wallet: {
        coins_balance: newCoins,
        cash_earned_inr: newCash,
      },
    });
  } catch (error: any) {
    console.error('requestPayout error:', error);
    res.status(500).json({ error: 'Failed to process payout request' });
  }
}

// ----------------------------------------------------
// 5. Admin: List All Payout Requests & Stats
// ----------------------------------------------------
export async function getAdminPayouts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawPayouts = db.prepare(`
      SELECT p.*, u.username, u.full_name, u.avatar_url, u.email
      FROM payout_requests p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 100
    `).all() as any[];

    // Calculate analytics
    const totalPendingRow = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount_inr), 0) as sum FROM payout_requests WHERE status = 'pending'").get() as any;
    const totalPaidRow = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount_inr), 0) as sum FROM payout_requests WHERE status = 'completed'").get() as any;
    const totalAdsRow = db.prepare("SELECT COUNT(*) as count FROM ad_views").get() as any;

    res.json({
      payouts: rawPayouts,
      stats: {
        pendingCount: totalPendingRow?.count || 0,
        pendingAmountInr: Number(totalPendingRow?.sum || 0),
        paidCount: totalPaidRow?.count || 0,
        paidAmountInr: Number(totalPaidRow?.sum || 0),
        totalAdsWatched: totalAdsRow?.count || 0,
      },
    });
  } catch (error: any) {
    console.error('getAdminPayouts error:', error);
    res.status(500).json({ error: 'Failed to fetch admin payouts' });
  }
}

// ----------------------------------------------------
// 6. Admin: Approve, Reject, or Mark Payout Paid
// ----------------------------------------------------
export async function updateAdminPayoutStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, adminNotes, transactionRef } = req.body;

    if (!['approved', 'completed', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Invalid payout status' });
      return;
    }

    const payout = db.prepare('SELECT * FROM payout_requests WHERE id = ?').get(id) as any;
    if (!payout) {
      res.status(404).json({ error: 'Payout request not found' });
      return;
    }

    const nowIso = new Date().toISOString();

    // If rejecting, refund the coins and cash to user wallet
    if (status === 'rejected' && payout.status !== 'rejected') {
      const wallet = getOrCreateWallet(payout.user_id);
      const refundedCoins = Number(wallet.coins_balance || 0) + Number(payout.coins_redeemed || 0);
      const refundedCash = Number((Number(wallet.cash_earned_inr || 0) + Number(payout.amount_inr || 0)).toFixed(2));

      db.prepare(`
        UPDATE user_wallets
        SET coins_balance = ?, cash_earned_inr = ?, updated_at = datetime('now')
        WHERE user_id = ?
      `).run(refundedCoins, refundedCash, payout.user_id);

      persistWalletToPg({
        ...wallet,
        coins_balance: refundedCoins,
        cash_earned_inr: refundedCash,
      });
    }

    db.prepare(`
      UPDATE payout_requests
      SET status = ?, admin_notes = ?, transaction_ref = ?, processed_at = ?
      WHERE id = ?
    `).run(status, adminNotes || '', transactionRef || '', nowIso, id);

    persistPayoutToPg({
      ...payout,
      status,
      admin_notes: adminNotes || '',
      transaction_ref: transactionRef || '',
      processed_at: nowIso,
    });

    res.json({
      success: true,
      message: `Payout request marked as ${status}.`,
    });
  } catch (error: any) {
    console.error('updateAdminPayoutStatus error:', error);
    res.status(500).json({ error: 'Failed to update payout request status' });
  }
}
