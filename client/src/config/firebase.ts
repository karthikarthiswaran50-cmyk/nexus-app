import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, Auth, UserCredential } from 'firebase/auth';
import { getStorage, FirebaseStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getMessaging, Messaging, getToken, onMessage } from 'firebase/messaging';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';

// Official Nexus Firebase configuration
const metaEnv = (import.meta as any).env || {};

export const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || "AIzaSyBGwj2ppva8ZRG1ftf7_B-0G0oGuec5paM",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "nexus-platform-cb84c.firebaseapp.com",
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
let googleProvider: GoogleAuthProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let storage: FirebaseStorage = getStorage(app);
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

export { app, auth, googleProvider, storage, messaging, analytics };

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

    const currentToken = await getToken(messaging, {
      vapidKey: vapidKey || metaEnv.VITE_FIREBASE_VAPID_KEY,
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
  const fileRef = ref(storage, `${folder}/${Date.now()}_${cleanFileName}`);
  const snapshot = await uploadBytes(fileRef, file);
  return await getDownloadURL(snapshot.ref);
}
