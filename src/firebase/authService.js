import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInAnonymously
} from 'firebase/auth';
import { auth } from './config.js';
import { createUserProfile, syncUserToPostgres } from './userService.js';

/**
 * Format Firebase Auth error code into user-friendly error message
 */
export function formatAuthError(error) {
  if (!error) return 'An unknown error occurred.';
  const code = error.code || '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email address is already registered. Please log in instead.';
    case 'auth/invalid-email':
      return 'Invalid email address format. Please enter a valid email.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/weak-password':
      return 'Password is too weak. Please enter a stronger password (minimum 6 characters).';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Access temporarily restricted. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet connection.';
    case 'auth/user-disabled':
      return 'This account has been disabled by administrators.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase project settings.';
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
      return 'Firebase API key is invalid or unconfigured in local environment.';
    case 'auth/popup-blocked':
      return 'Google Sign-In popup was blocked by your browser settings. Redirecting to Google login page...';
    case 'auth/popup-closed-by-user':
      return 'Google Sign-In popup window was closed before completing login.';
    default:
      return error.message || 'An authentication error occurred. Please try again.';
  }
}

/**
 * Register a new user with Firebase Email/Password
 */
export async function registerUser(email, password, displayName = '') {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }
    if (userCredential?.user) {
      const u = userCredential.user;
      await createUserProfile(u.uid, {
        displayName: displayName || u.displayName || 'EaseLand User',
        email: u.email || email,
        phone: u.phoneNumber || '',
        authProvider: 'Email/Password'
      });
    }
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: formatAuthError(error) };
  }
}

/**
 * Log in an existing user with Firebase Email/Password
 */
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    if (userCredential?.user) {
      const u = userCredential.user;
      await createUserProfile(u.uid, {
        displayName: u.displayName || 'EaseLand User',
        email: u.email || email,
        phone: u.phoneNumber || '',
        authProvider: 'Email/Password'
      });
    }
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: formatAuthError(error) };
  }
}

/**
 * Log out the currently authenticated Firebase user
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: formatAuthError(error) };
  }
}

/**
 * Send password reset email to registered user
 */
export async function sendPasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: formatAuthError(error) };
  }
}

/**
 * Send email verification to current Firebase user
 */
export async function sendEmailVerificationUser() {
  try {
    if (!auth.currentUser) {
      return { success: false, error: 'No authenticated user found.' };
    }
    await sendEmailVerification(auth.currentUser);
    return { success: true };
  } catch (error) {
    return { success: false, error: formatAuthError(error) };
  }
}

/**
 * Subscribe to Firebase authentication state changes
 */
export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, (user) => {
    if (user && user.uid) {
      createUserProfile(user.uid, {
        displayName: user.displayName || (user.email === 'admin@easeland.in' ? 'EaseLand Admin' : 'EaseLand User'),
        email: user.email || '',
        phone: user.phoneNumber || '',
        authProvider: user.providerData?.[0]?.providerId === 'google.com' ? 'Google OAuth' : 'Email/Password'
      });
    }
    callback(user);
  });
}

/**
 * Ensure an active Firebase Auth session exists for database queries
 */
export async function ensureAuthSession() {
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Sign in user using Google OAuth popup provider with seamless redirect fallback
 */
export async function loginWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (result?.user) {
        const u = result.user;
        await createUserProfile(u.uid, {
          displayName: u.displayName || 'EaseLand User',
          email: u.email || '',
          phone: u.phoneNumber || '',
          authProvider: 'Google OAuth'
        });
      }
      return { success: true, user: result.user };
    } catch (popupErr) {
      if (popupErr?.code === 'auth/popup-blocked' || popupErr?.code === 'auth/cancelled-popup-request') {
        await signInWithRedirect(auth, provider);
        return { success: true, isRedirecting: true };
      }
      throw popupErr;
    }
  } catch (error) {
    return { success: false, error: formatAuthError(error) };
  }
}
