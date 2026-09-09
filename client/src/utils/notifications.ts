/**
 * Nexus Royal — Comprehensive Notification & Web Push Manager
 * Handles: Web Push (RFC 8292 VAPID), Service Worker Background Notifications,
 * System Notifications, Mobile Haptic Vibration, and PUSH_RECEIVED wakeup.
 */
import axios from 'axios';
import { requestFcmToken } from '../config/firebase';

let activeCallNotification: Notification | null = null;

export const getNotificationPermissionStatus = (): 'granted' | 'denied' | 'default' | 'unsupported' => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Prevent concurrent subscription attempts
let _subscribeInFlight = false;

/**
 * Register (or refresh) Web Push subscription with server.
 * force=true: unsubscribes existing subscription first to ensure VAPID key matches.
 */
export const subscribeToWebPush = async (force = false): Promise<boolean> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('📵 Web Push not supported in this browser');
    return false;
  }

  if (_subscribeInFlight) return false;
  _subscribeInFlight = true;

  try {
    // Ensure service worker is registered
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (e) {}

    // Wait for service worker with timeout fallback
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<ServiceWorkerRegistration>((_, reject) =>
        setTimeout(() => reject(new Error('SW ready timeout')), 6000)
      ),
    ]);

    // Fetch current VAPID public key from server
    const res = await axios.get('/api/notifications/vapid-public-key', { timeout: 10000 });
    const vapidPublicKey: string = res.data?.publicKey;
    if (!vapidPublicKey) {
      console.warn('❌ VAPID public key missing from server');
      return false;
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    let subscription = await registration.pushManager.getSubscription();

    // Force-unsubscribe if requested (e.g. after user clicks Allow Alerts)
    if (subscription && force) {
      try {
        await subscription.unsubscribe();
      } catch (e) {}
      subscription = null;
    }

    // Create push subscription if not exists
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any,
      });
    }

    // Save subscription to server (upsert by endpoint)
    await axios.post('/api/notifications/subscribe', {
      subscription: subscription.toJSON(),
    }, { timeout: 10000 });

    console.log('🤖 [Push Robot] Device Web Push registered with server!', subscription.endpoint.slice(0, 55) + '...');
    return true;
  } catch (err: any) {
    console.warn('⚠️ Web Push subscription note:', err?.message || err);
    return false;
  } finally {
    _subscribeInFlight = false;
  }
};

/**
 * Sync both Web Push VAPID and FCM token (if available) with server.
 */
export const syncAllPushTokens = async (force = false): Promise<boolean> => {
  let webPushSuccess = false;
  try {
    webPushSuccess = await subscribeToWebPush(force);
  } catch (e) {}

  try {
    const fcmToken = await requestFcmToken();
    if (fcmToken) {
      await axios.post('/api/users/fcm-token', { token: fcmToken });
      console.log('🤖 [Push Robot] FCM Push Token synchronized!');
    }
  } catch (e) {}

  return webPushSuccess;
};

/**
 * Request browser notification permission, then subscribe to Web Push & FCM.
 * Triggered by 1-tap activation or user interaction.
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      // Force-refresh subscription on explicit user grant
      await syncAllPushTokens(true);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return false;
  }
};

/**
 * Auto-register push subscription on app load if permission already granted.
 * Safe to call on every mount — does nothing if permission is not 'granted'.
 */
export const autoRegisterPushIfGranted = (): void => {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  setTimeout(() => {
    syncAllPushTokens(false).catch(() => {});
  }, 1000);
};

let _robotInitialized = false;
let _lastSyncTimestamp = 0;

/**
 * 🤖 Royal Auto-Push Robot
 * Automatically turns on notifications on app open:
 * 1. Checks current permission.
 * 2. If 'granted' -> auto-syncs Web Push and FCM immediately with server.
 * 3. If 'default' -> attempts auto-request, and attaches 1-touch auto-trigger to first user click/tap.
 * 4. Syncs on visibilitychange (when phone is unlocked or user switches back to app tab).
 * 5. Heartbeat every 10 minutes to prevent subscription expiration.
 */
export const startPushNotificationRobot = (options?: {
  onStatusChange?: (status: 'granted' | 'denied' | 'default' | 'unsupported') => void;
}): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const currentStatus = getNotificationPermissionStatus();
  if (options?.onStatusChange) {
    options.onStatusChange(currentStatus);
  }

  const triggerRobotSync = async (force = false) => {
    const now = Date.now();
    if (!force && now - _lastSyncTimestamp < 25000) return; // Prevent excessive spam
    _lastSyncTimestamp = now;

    if (Notification.permission === 'granted') {
      console.log('🤖 [Royal Push Robot] Running auto-registration...');
      await syncAllPushTokens(force);
      localStorage.setItem('nexus_push_robot_last_sync', String(now));
      if (options?.onStatusChange) {
        options.onStatusChange('granted');
      }
    }
  };

  // 1. Immediately run on app open
  if (currentStatus === 'granted') {
    triggerRobotSync(false).catch(() => {});
  } else if (currentStatus === 'default') {
    // Attempt silent browser prompt on startup
    try {
      Notification.requestPermission().then((res) => {
        if (options?.onStatusChange) options.onStatusChange(res);
        if (res === 'granted') {
          triggerRobotSync(true).catch(() => {});
        }
      }).catch(() => {});
    } catch (e) {}

    // Attach 1-Touch Auto-Activator: The first time user touches or clicks anywhere, trigger permission prompt!
    const onFirstUserTouch = async () => {
      window.removeEventListener('click', onFirstUserTouch, true);
      window.removeEventListener('touchstart', onFirstUserTouch, true);
      window.removeEventListener('pointerdown', onFirstUserTouch, true);

      if (Notification.permission === 'default') {
        try {
          console.log('🤖 [Royal Push Robot] User interaction detected -> requesting permission...');
          const res = await Notification.requestPermission();
          if (options?.onStatusChange) options.onStatusChange(res);
          if (res === 'granted') {
            await triggerRobotSync(true);
          }
        } catch (e) {}
      }
    };

    window.addEventListener('click', onFirstUserTouch, { capture: true, once: true });
    window.addEventListener('touchstart', onFirstUserTouch, { capture: true, once: true });
    window.addEventListener('pointerdown', onFirstUserTouch, { capture: true, once: true });
  }

  if (_robotInitialized) return () => {};
  _robotInitialized = true;

  // 2. Re-sync when user returns to app (visibility change)
  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && Notification.permission === 'granted') {
      triggerRobotSync(false).catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  // 3. Periodic robot heartbeat every 10 minutes
  const intervalId = setInterval(() => {
    if (Notification.permission === 'granted') {
      triggerRobotSync(false).catch(() => {});
    }
  }, 10 * 60 * 1000);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibility);
    clearInterval(intervalId);
  };
};

// ============================================================
// 📞 CALL NOTIFICATION (High Priority, Persistent)
// ============================================================
export const showCallNotification = (
  callerName: string,
  callType: 'audio' | 'video' = 'video',
  callerAvatar?: string
) => {
  if (typeof window === 'undefined') return;

  // Haptic: long ring pattern
  if ('vibrate' in navigator) {
    try { navigator.vibrate([600, 200, 600, 200, 600, 200, 600]); } catch (e) {}
  }

  const title = `📞 Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`;
  const body = `${callerName} is calling you. Tap to answer!`;
  const options: any = {
    body,
    icon: callerAvatar || '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: 'nexus-incoming-call',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [600, 200, 600, 200, 600, 200, 600],
    data: { url: '/', type: 'call', callType },
  };

  // Prefer Service Worker registration notification (works when app is backgrounded)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, options))
      .catch(() => _showDesktopFallback(title, options));
  } else {
    _showDesktopFallback(title, options);
  }
};

/**
 * Close active call notification when answered / rejected / ended
 */
export const closeCallNotification = () => {
  if (activeCallNotification) {
    try { activeCallNotification.close(); } catch (e) {}
    activeCallNotification = null;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.getNotifications({ tag: 'nexus-incoming-call' }))
      .then((ns) => ns.forEach((n) => n.close()))
      .catch(() => {});

    // Instruct service worker to close call notification too
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ action: 'closeCallNotification' });
    }
  }
};

// ============================================================
// 💬 MESSAGE NOTIFICATION
// ============================================================
export const showMessageNotification = (
  senderName: string,
  messageText: string,
  senderAvatar?: string,
  conversationId?: string
) => {
  if (typeof window === 'undefined') return;

  // Short double pulse for messages
  if ('vibrate' in navigator) {
    try { navigator.vibrate([200, 100, 200]); } catch (e) {}
  }

  const title = `💬 ${senderName}`;
  const body = messageText || 'Sent an attachment';
  const options: any = {
    body,
    icon: senderAvatar || '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: `nexus-msg-${conversationId || 'chat'}`,
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: { url: '/', type: 'message', conversationId },
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, options))
      .catch(() => _showDesktopFallback(title, options));
  } else {
    _showDesktopFallback(title, options);
  }
};

function _showDesktopFallback(title: string, options: any) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, options);
      if (options.tag === 'nexus-incoming-call') {
        activeCallNotification = notif;
      }
      notif.onclick = () => { window.focus(); notif.close(); };
    } catch (e) {
      console.warn('Fallback notification error:', e);
    }
  }
}



