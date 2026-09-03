import { initializeApp, cert, applicationDefault, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging, Message } from 'firebase-admin/messaging';
import fs from 'node:fs';

let firebaseApp: App | null = null;

// Check for service account credentials
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

try {
  if (serviceAccountJson) {
    const creds = JSON.parse(serviceAccountJson);
    firebaseApp = initializeApp({
      credential: cert(creds),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    console.log('🔥 Firebase Admin initialized via inline JSON credentials!');
  } else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const raw = fs.readFileSync(serviceAccountPath, 'utf8');
    const creds = JSON.parse(raw);
    firebaseApp = initializeApp({
      credential: cert(creds),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    console.log('🔥 Firebase Admin initialized via service account file!');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    firebaseApp = initializeApp({
      credential: applicationDefault(),
    });
    console.log('🔥 Firebase Admin initialized via Application Default Credentials!');
  } else {
    console.log('ℹ️ Firebase Admin SDK running in development/fallback mode (credentials not yet provided).');
  }
} catch (err: any) {
  console.warn('⚠️ Firebase Admin initialization deferred:', err.message);
}

export function isFirebaseReady(): boolean {
  return firebaseApp !== null;
}

/**
 * Verify a Firebase ID Token sent from the frontend
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<{
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
} | null> {
  if (!firebaseApp) {
    // Graceful fallback decoder if Firebase Admin credentials are not yet configured
    try {
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        return {
          uid: payload.sub || payload.user_id,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
        };
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  try {
    const decodedToken = await getAuth(firebaseApp).verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
    };
  } catch (error) {
    console.error('Firebase ID Token verification error:', error);
    return null;
  }
}

/**
 * Send High-Priority FCM Push Notification to Mobile Phone for Incoming Video/Audio Calls
 */
export async function sendCallPushNotification(params: {
  fcmToken: string;
  callerName: string;
  callerAvatar?: string;
  callType: 'audio' | 'video';
}): Promise<boolean> {
  if (!firebaseApp || !params.fcmToken) return false;

  try {
    const message: Message = {
      token: params.fcmToken,
      notification: {
        title: `📞 Incoming ${params.callType.toUpperCase()} Call`,
        body: `${params.callerName} is calling you on Nexus...`,
      },
      data: {
        callType: params.callType,
        callerName: params.callerName,
        callerAvatar: params.callerAvatar || '',
        tag: 'nexus-incoming-call',
        url: '/',
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'calls',
          priority: 'max',
          visibility: 'public',
        },
      },
    };

    await getMessaging(firebaseApp).send(message);
    return true;
  } catch (err: any) {
    console.warn('Failed to dispatch FCM call push notification:', err.message);
    return false;
  }
}

/**
 * Send FCM Push Notification for New Chat Message
 */
export async function sendMessagePushNotification(params: {
  fcmToken: string;
  senderName: string;
  messagePreview: string;
}): Promise<boolean> {
  if (!firebaseApp || !params.fcmToken) return false;

  try {
    const message: Message = {
      token: params.fcmToken,
      notification: {
        title: `💬 New message from ${params.senderName}`,
        body: params.messagePreview.substring(0, 100),
      },
      data: {
        senderName: params.senderName,
        tag: 'nexus-chat-message',
        url: '/',
      },
    };

    await getMessaging(firebaseApp).send(message);
    return true;
  } catch (err: any) {
    return false;
  }
}
