/**
 * Nexus Royal — Comprehensive Notification & Web Push Manager
 * Handles: Web Push (RFC 8292 VAPID), Service Worker Background Notifications,
 * System Notifications, Mobile Haptic Vibration, and PUSH_RECEIVED wakeup.
 */
import axios from 'axios';

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
    const registration = await navigator.serviceWorker.ready;

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
      await subscription.unsubscribe();
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

    console.log('📱 Web Push subscription registered!', subscription.endpoint.slice(0, 60) + '...');
    return true;
  } catch (err: any) {
    console.warn('⚠️ Web Push subscription error:', err?.message || err);
    return false;
  } finally {
    _subscribeInFlight = false;
  }
};

/**
 * Request browser notification permission, then subscribe to Web Push.
 * Triggered by user clicking "Allow Alerts" button.
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      // Force-refresh subscription on explicit user grant
      await subscribeToWebPush(true);
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

  // Wait for service worker to activate before subscribing
  setTimeout(() => {
    subscribeToWebPush(false).catch(() => {});
  }, 2000);
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



