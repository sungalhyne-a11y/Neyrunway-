import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache,
  Firestore
} from 'firebase/firestore';
import bundledFirebaseConfig from '../../firebase-applet-config.json';

// Support both static configuration and Vercel/Vite environment variables
const env = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : ({} as any);

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || bundledFirebaseConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || bundledFirebaseConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || bundledFirebaseConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || bundledFirebaseConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || bundledFirebaseConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || bundledFirebaseConfig.appId,
  firestoreDatabaseId: env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || bundledFirebaseConfig.firestoreDatabaseId || '(default)',
};

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with Multi-Tab IndexedDB Local Cache Persistence
let firestoreDb: Firestore;

try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, firebaseConfig.firestoreDatabaseId || undefined);
} catch (error: any) {
  const errorCode = error?.code || '';
  if (errorCode === 'failed-precondition') {
    // Multiple tabs open simultaneously in older environments
    console.info('Firestore notice: Multi-tab persistence fallback engaged.');
  } else if (errorCode === 'unimplemented') {
    // Browser does not support indexedDB storage
    console.info('Firestore notice: IndexedDB not supported by current browser environment, switching to memory cache.');
  } else {
    console.warn('Firestore initialization notice:', error?.message || error);
  }

  // Graceful fallback to memory or default instance
  try {
    firestoreDb = firebaseConfig.firestoreDatabaseId 
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
  } catch (fallbackError) {
    firestoreDb = initializeFirestore(app, {
      localCache: memoryLocalCache()
    }, firebaseConfig.firestoreDatabaseId || undefined);
  }
}

export const db = firestoreDb;
export default app;
