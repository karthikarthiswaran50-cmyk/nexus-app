import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, Auth, UserCredential } from 'firebase/auth';
import { getStorage, FirebaseStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getMessaging, Messaging, getToken } from 'firebase/messaging';
import { getAnalytics, isSupported, Analytics, logEvent, setUserId as setFbUserId } from 'firebase/analytics';
import { getFirestore, Firestore, collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { getDatabase, Database, ref as rtdbRef, push as rtdbPush, set as rtdbSet } from 'firebase/database';

// Official Nexus Firebase configuration
const metaEnv = (import.meta as any).env || {};

export const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || "AIzaSyBGwj2ppva8ZRG1ftf7_B-0G0oGuec5paM",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "nexus-platform-cb84c.firebaseapp.com",
  databaseURL: metaEnv.VITE_FIREBASE_DATABASE_URL || "https://nexus-platform-cb84c-default-rtdb.firebaseio.com",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || "nexus-platform-cb84c",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "nexus-platform-cb84c.firebasestorage.app",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "866191964279",
  appId: metaEnv.VITE_FIREBASE_APP_ID || "1:866191964279:web:5d6d6cd724155869b9ae72",
  measurementId: metaEnv.VITE_FIREBASE_MEASUREMENT_ID || "G-WCXMQ15D9W",
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
  );
};

let app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
let auth: Auth = getAuth(app);
let firestore: Firestore = getFirestore(app);
let storage: FirebaseStorage = getStorage(app);

let rtdb: Database | null = null;
try {
  rtdb = getDatabase(app);
} catch (e) {
  console.warn('Realtime Database init note:', e);
}

let googleProvider: GoogleAuthProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let messaging: Messaging | null = null;
let analytics: Analytics | null = null;

// Initialize Analytics if supported in current browser environment
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch (e) {}
    }
  }).catch(() => {});

  // Messaging (FCM) supported in modern browsers with Notification & ServiceWorker
  if ('Notification' in window && 'serviceWorker' in navigator) {
    try {
      messaging = getMessaging(app);
    } catch (e) {
      console.warn('FCM Messaging initialization skipped in current context:', e);
    }
  }
}

export { app, auth, firestore, rtdb, googleProvider, storage, messaging, analytics };

/**
 * Real-Time User Activity Tracking for Firebase Console
 * Logs to:
 * 1. Firebase Realtime Database ('user_activities' and 'users_online')
 * 2. Cloud Firestore ('user_activities')
 * 3. Google Analytics (Realtime StreamView)
 */
export interface UserActivityData {
  userId?: string;
  username?: string;
  action:
    | 'login'
    | 'logout'
    | 'call_started'
    | 'call_answered'
    | 'call_ended'
    | 'chat_sent'
    | 'plan_view'
    | 'checkout_click'
    | 'profile_updated';
  details?: Record<string, any>;
}

export async function trackUserActivity(data: UserActivityData): Promise<void> {
  try {
    const timestamp = new Date().toISOString();

    // 1. Log to Firebase Realtime Database (visible in Realtime Database -> Data tab)
    if (rtdb) {
      try {
        const activitiesRef = rtdbRef(rtdb, 'user_activities');
        await rtdbPush(activitiesRef, {
          userId: data.userId || 'anonymous',
          username: data.username || 'anonymous',
          action: data.action,
          details: data.details || {},
          timestamp: Date.now(),
          time: new Date().toLocaleTimeString(),
          date: new Date().toLocaleDateString(),
        });

        if (data.userId) {
          const presenceRef = rtdbRef(rtdb, `users_online/${data.userId}`);
          await rtdbSet(presenceRef, {
            userId: data.userId,
            username: data.username || '',
            lastAction: data.action,
            lastActive: Date.now(),
            isOnline: data.action !== 'logout',
          });
        }
      } catch (e) {}
    }

    // 2. Log to Firebase Google Analytics (visible in Analytics -> Realtime / StreamView)
    if (analytics) {
      try {
        (logEvent as any)(analytics, data.action, {
          user_id: data.userId || 'anonymous',
          username: data.username || 'anonymous',
          timestamp,
          ...data.details,
        });
        if (data.userId) {
          setFbUserId(analytics, data.userId);
        }
      } catch (e) {}
    }

    // 3. Log in Real-Time to Cloud Firestore (visible in Firestore Database -> 'user_activities')
    if (firestore) {
      try {
        await addDoc(collection(firestore, 'user_activities'), {
          userId: data.userId || 'anonymous',
          username: data.username || 'anonymous',
          action: data.action,
          details: data.details || {},
          timestamp: serverTimestamp(),
          device: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
        });

        // Update Live Online Presence in Firestore
        if (data.userId) {
          await setDoc(
            doc(firestore, 'users_live_presence', data.userId),
            {
              userId: data.userId,
              username: data.username || '',
              lastAction: data.action,
              lastActive: serverTimestamp(),
              isOnline: data.action !== 'logout',
            },
            { merge: true }
          );
        }
      } catch (e) {}
    }
  } catch (err) {
    console.debug('Activity tracking log:', err);
  }
}

/**
 * 1-Click Google Sign In with Popup
 */
export async function signInWithGoogle(): Promise<{ idToken: string; user: any }> {
  if (!auth || !googleProvider) {
    throw new Error('Firebase Auth is not ready.');
  }

  const credential: UserCredential = await signInWithPopup(auth, googleProvider);
  const idToken = await credential.user.getIdToken();

  return {
    idToken,
    user: {
      uid: credential.user.uid,
      email: credential.user.email,
      displayName: credential.user.displayName,
      photoURL: credential.user.photoURL,
    },
  };
}

/**
 * Request FCM Push Notification Permission for Call Alerts
 */
export async function requestFcmToken(vapidKey?: string): Promise<string | null> {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission was not granted.');
      return null;
    }

    let registration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.ready;
    }

    const currentToken = await getToken(messaging, {
      vapidKey: vapidKey || metaEnv.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return currentToken || null;
  } catch (err) {
    console.warn('Error retrieving FCM registration token:', err);
    return null;
  }
}

/**
 * Upload Avatar or Media File to Firebase Cloud Storage
 */
export async function uploadToFirebaseStorage(file: File, folder = 'avatars'): Promise<string> {
  if (!storage) {
    throw new Error('Firebase Storage is not ready.');
  }

  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
  const fileRef = storageRef(storage, `${folder}/${Date.now()}_${cleanFileName}`);
  const snapshot = await uploadBytes(fileRef, file);
  return await getDownloadURL(snapshot.ref);
}
