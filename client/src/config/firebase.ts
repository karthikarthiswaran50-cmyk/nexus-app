import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, Auth, UserCredential } from 'firebase/auth';
import { getStorage, FirebaseStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getMessaging, Messaging, getToken, onMessage } from 'firebase/messaging';

// Firebase configuration from Vite environment variables
const metaEnv = (import.meta as any).env || {};
const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || '',
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: metaEnv.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
  );
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let storage: FirebaseStorage | null = null;
let messaging: Messaging | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    storage = getStorage(app);
    
    // Messaging only supported in browsers with Notification / SW API
    if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
      try {
        messaging = getMessaging(app);
      } catch (e) {
        console.warn('FCM Messaging initialization skipped in current context:', e);
      }
    }
  } catch (err) {
    console.error('Firebase initialization error:', err);
  }
}

export { app, auth, googleProvider, storage, messaging };

/**
 * 1-Click Google Sign In with Popup
 */
export async function signInWithGoogle(): Promise<{ idToken: string; user: any }> {
  if (!auth || !googleProvider) {
    throw new Error(
      'Firebase is not configured yet. Please provide your VITE_FIREBASE_API_KEY and credentials in your environment.'
    );
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
    throw new Error('Firebase Storage is not configured.');
  }

  const fileRef = ref(storage, `${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`);
  const snapshot = await uploadBytes(fileRef, file);
  return await getDownloadURL(snapshot.ref);
}
