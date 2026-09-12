import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyB6x3JQ9wrYIZRYg0C36cd_5Gvhfmds4EQ',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'easeland.in',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'easeland-fba04',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'easeland-fba04.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '109876543210',
  appId: env.VITE_FIREBASE_APP_ID || '1:109876543210:web:easelandapp123456'
};

// Ensure Firebase App is initialized exactly once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase modular SDK services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
