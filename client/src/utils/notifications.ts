/**
 * Comprehensive System & Web Notification Manager
 * Supports Web Notification API, Service Worker Push/Background notifications,
 * and Mobile Haptic Vibration.
 */

let activeCallNotification: Notification | null = null;

export const getNotificationPermissionStatus = (): 'granted' | 'denied' | 'default' | 'unsupported' => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return false;
  }
};

/**
 * Show Incoming Call System Notification (High Priority, Persistent)
 */
export const showCallNotification = (
  callerName: string,
  callType: 'audio' | 'video' = 'video',
  callerAvatar?: string
) => {
  if (typeof window === 'undefined') return;

  // 1. Mobile Vibration (Ring pattern: buzz-pause-buzz-pause-buzz)
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([500, 250, 500, 250, 500]);
    } catch (e) {}
  }

  const title = `📞 Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`;
  const options: any = {
    body: `${callerName} is calling you on Nexus Royal. Tap to answer!`,
    icon: callerAvatar || '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: 'nexus-incoming-call',
    renotify: true,
    requireInteraction: true,
    silent: false,
  };

  // 2. Try ServiceWorker Registration Notification (Works on Android & PWA background)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        ...options,
        vibrate: [500, 250, 500, 250, 500],
        data: { url: '/', type: 'call', callType },
      }).catch(() => {
        showDesktopFallbackNotification(title, options);
      });
    }).catch(() => {
      showDesktopFallbackNotification(title, options);
    });
  } else {
    showDesktopFallbackNotification(title, options);
  }
};

/**
 * Close active call notification once answered or rejected
 */
export const closeCallNotification = () => {
  if (activeCallNotification) {
    try {
      activeCallNotification.close();
      activeCallNotification = null;
    } catch (e) {}
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.getNotifications({ tag: 'nexus-incoming-call' }).then((notifications) => {
        notifications.forEach(n => n.close());
      }).catch(() => {});
    }).catch(() => {});
  }
};

/**
 * Show New Message Notification (Chat Alert)
 */
export const showMessageNotification = (
  senderName: string,
  messageText: string,
  senderAvatar?: string,
  conversationId?: string
) => {
  if (typeof window === 'undefined') return;

  // 1. Mobile Vibration (Double short pulse)
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([150, 80, 150]);
    } catch (e) {}
  }

  const title = `💬 ${senderName}`;
  const options: any = {
    body: messageText || 'Sent an attachment',
    icon: senderAvatar || '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: `nexus-msg-${conversationId || 'chat'}`,
    renotify: true,
    silent: false,
  };

  // 2. Try ServiceWorker Registration Notification
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        ...options,
        vibrate: [150, 80, 150],
        data: { url: '/', type: 'message', conversationId },
      }).catch(() => {
        showDesktopFallbackNotification(title, options);
      });
    }).catch(() => {
      showDesktopFallbackNotification(title, options);
    });
  } else {
    showDesktopFallbackNotification(title, options);
  }
};

function showDesktopFallbackNotification(title: string, options: NotificationOptions) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, options);
      activeCallNotification = notif;
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (e) {
      console.warn('Desktop notification fallback error:', e);
    }
  }
}
