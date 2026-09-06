import webpush, { RequestOptions } from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, pgPool } from '../db.js';
import { sendCallPushNotification, sendMessagePushNotification } from './firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../../data');
const keysFile = path.join(dataDir, 'vapid.json');

// Initialize push subscriptions table (SQLite + PostgreSQL permanent sync)
export function initPushSubscriptionsTable() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  } catch (e) {
    console.warn('initPushSubscriptionsTable note:', e);
  }

  if (pgPool) {
    pgPool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `).catch(() => {});
  }
}

initPushSubscriptionsTable();

// ----------------------------------------------------
// VAPID Keypair Management (Auto-generated & Persisted)
// ----------------------------------------------------
interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let vapidKeys: VapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || '',
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  if (fs.existsSync(keysFile)) {
    try {
      const content = fs.readFileSync(keysFile, 'utf8');
      vapidKeys = JSON.parse(content);
    } catch (e) {
      console.warn('Error reading stored VAPID keys:', e);
    }
  }

  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    // Generate new VAPID keys on first launch
    const generated = webpush.generateVAPIDKeys();
    vapidKeys = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
    };
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(keysFile, JSON.stringify(vapidKeys, null, 2), 'utf8');
      console.log('🔑 New VAPID Keys generated and saved for Web Push notifications!');
    } catch (e) {
      console.warn('Could not persist VAPID keys to disk:', e);
    }
  }
}

// Configure web-push with VAPID details
try {
  webpush.setVapidDetails(
    'mailto:support@nexusroyal.app',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
  console.log('📡 Web Push service active with standard VAPID authentication!');
} catch (err: any) {
  console.warn('Web push setVapidDetails warning:', err.message);
}

export function getVapidPublicKey(): string {
  return vapidKeys.publicKey;
}

// ----------------------------------------------------
// Subscription Storage & Management
// ----------------------------------------------------
export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function savePushSubscription(userId: string, sub: WebPushSubscription): void {
  if (!userId || !sub || !sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return;

  try {
    const id = 'sub_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    db.prepare(`
      INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        created_at = datetime('now')
    `).run(id, userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth);

    if (pgPool) {
      pgPool.query(`
        INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (endpoint) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth,
          created_at = NOW()
      `, [id, userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]).catch(() => {});
    }
  } catch (err) {
    console.error('Error saving push subscription:', err);
  }
}

export function removePushSubscriptionByEndpoint(endpoint: string): void {
  try {
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
    if (pgPool) {
      pgPool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]).catch(() => {});
    }
  } catch (e) {}
}

export function getPushSubscriptionsForUser(userId: string): WebPushSubscription[] {
  try {
    const rows = db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(userId) as any[];
    return rows.map((r) => ({
      endpoint: r.endpoint,
      keys: {
        p256dh: r.p256dh,
        auth: r.auth,
      },
    }));
  } catch (e) {
    return [];
  }
}

export function isUserPushRegistered(userId: string): boolean {
  try {
    const row = db.prepare('SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1').get(userId);
    if (row) return true;
    const settings = db.prepare('SELECT fcm_token FROM user_settings WHERE user_id = ?').get(userId) as any;
    return !!settings?.fcm_token;
  } catch (e) {
    return false;
  }
}

// ----------------------------------------------------
// Dispatch Push Notifications (Web Push & FCM Dual-Channel)
// ----------------------------------------------------
export interface PushPayload {
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
  };
  data?: Record<string, any>;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  isCall: boolean = false
): Promise<boolean> {
  let anyDelivered = false;

  // 1. Channel 1: RFC 8292 Standard Web Push (Chrome, Firefox, Safari iOS 16.4+, Edge)
  const subscriptions = getPushSubscriptionsForUser(userId);
  console.log(`📤 Sending push to user ${userId}: ${subscriptions.length} subscription(s), isCall=${isCall}`);

  if (subscriptions.length > 0) {
    const stringified = JSON.stringify(payload);
    const options: RequestOptions = {
      TTL: isCall ? 60 : 86400, // 60s for calls, 24h for messages
      urgency: isCall ? 'high' : 'normal',
    };

    const promises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub as any, stringified, options);
        anyDelivered = true;
        console.log(`✅ Web Push delivered to ${sub.endpoint.slice(0, 60)}...`);
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription expired or revoked by user
          removePushSubscriptionByEndpoint(sub.endpoint);
          console.log(`🗑️ Removed expired push subscription: ${sub.endpoint.slice(0, 60)}...`);
        } else {
          console.warn('❌ Web push delivery failed:', err.statusCode, err.message);
        }
      }
    });

    await Promise.allSettled(promises);
  } else {
    console.log(`⚠️ No push subscriptions found for user ${userId} — push not sent`);
  }

  // 2. Channel 2: Firebase FCM Fallback (if configured)
  try {
    const settings = db.prepare('SELECT fcm_token FROM user_settings WHERE user_id = ?').get(userId) as any;
    if (settings?.fcm_token) {
      if (isCall) {
        const callerName = payload.data?.callerName || payload.notification.title;
        const callType = payload.data?.callType || 'video';
        await sendCallPushNotification({
          fcmToken: settings.fcm_token,
          callerName,
          callerAvatar: payload.notification.icon,
          callType,
        });
      } else {
        const senderName = payload.data?.senderName || payload.notification.title;
        await sendMessagePushNotification({
          fcmToken: settings.fcm_token,
          senderName,
          messagePreview: payload.notification.body,
        });
      }
      anyDelivered = true;
    }
  } catch (fcmErr) {}

  return anyDelivered;
}
