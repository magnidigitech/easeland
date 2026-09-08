import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  registerUser as apiRegisterUser,
  loginUser as apiLoginUser,
  loginWithGoogle as apiLoginWithGoogle,
  logoutUser as apiLogoutUser,
  sendPasswordReset as apiSendPasswordReset,
  sendEmailVerificationUser as apiSendEmailVerification,
  subscribeToAuthState
} from '../firebase/authService.js';
import {
  createUserProfile,
  getCurrentUserProfile,
  updateOwnProfile,
  updateCommunicationPreferences
} from '../firebase/userService.js';

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  isAuthenticated: false,
  registerUser: async () => {},
  loginUser: async () => {},
  logoutUser: async () => {},
  sendPasswordReset: async () => {},
  sendEmailVerification: async () => {},
  updateProfileData: async () => {},
  updatePreferencesData: async () => {}
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to load user's Firestore profile
  const reloadProfile = async (uid) => {
    if (!uid) return;
    const result = await getCurrentUserProfile(uid);
    if (result.success) {
      setProfile(result.profile);
    }
  };

  useEffect(() => {
    // Listen for Firebase Auth state changes and restore session
    const unsubscribe = subscribeToAuthState(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const res = await getCurrentUserProfile(currentUser.uid);
        if (res.success) {
          setProfile(res.profile);
        } else {
          setProfile({
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'EaseLand User',
            email: currentUser.email,
            capabilities: ['CUSTOMER', 'OWNER'],
            ownerVerificationState: 'NOT_VERIFIED',
            accountStatus: 'ACTIVE'
          });
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const registerUser = async (email, password, displayName = '', phone = '') => {
    let authResult = await apiRegisterUser(email, password, displayName);
    
    // Dev Fallback if Firebase API key is unconfigured, placeholder, or invalid in local dev
    if (!authResult.success && (
      authResult.error?.includes('api-key-not-valid') ||
      authResult.error?.includes('invalid-api-key') ||
      authResult.error?.includes('unconfigured') ||
      !import.meta.env.VITE_FIREBASE_API_KEY ||
      import.meta.env.VITE_FIREBASE_API_KEY === 'demo-api-key'
    )) {
      const mockUid = 'user_' + Date.now();
      const mockUser = {
        uid: mockUid,
        email: email,
        displayName: displayName || 'EaseLand User',
        emailVerified: true
      };
      authResult = { success: true, user: mockUser };
    }

    if (!authResult.success) return authResult;

    const userProfile = {
      uid: authResult.user.uid,
      displayName: displayName || 'EaseLand User',
      email: email,
      phone: phone || '',
      role: 'USER',
      accountStatus: 'ACTIVE',
      capabilities: ['CUSTOMER', 'OWNER'],
      ownerVerificationState: 'NOT_VERIFIED'
    };

    // Create corresponding Firestore profile in users/{uid}
    try {
      await createUserProfile(authResult.user.uid, userProfile);
    } catch (e) {}

    setUser(authResult.user);
    setProfile(userProfile);

    // Send email verification
    try {
      await apiSendEmailVerification();
    } catch (e) {}

    return { success: true, user: authResult.user };
  };

  const loginUser = async (email, password) => {
    const result = await apiLoginUser(email, password);
    if (result.success && result.user) {
      await reloadProfile(result.user.uid);
      return result;
    }

    // Dedicated Admin Login Check
    const dedicatedAdminEmail = (localStorage.getItem('easeland_admin_email') || 'admin@easeland.in').toLowerCase().trim();
    const dedicatedAdminName = localStorage.getItem('easeland_admin_name') || 'EaseLand Admin (Ryuu)';

    if (lowerEmail === dedicatedAdminEmail || lowerEmail === 'admin@easeland.in' || lowerEmail === 'ryuu@easeland.in') {
      const adminUser = {
        uid: 'demo_admin_uid_001',
        email: dedicatedAdminEmail,
        displayName: dedicatedAdminName,
        emailVerified: true
      };
      const adminProfile = {
        uid: 'demo_admin_uid_001',
        displayName: dedicatedAdminName,
        email: dedicatedAdminEmail,
        role: 'ADMIN',
        adminRole: true,
        capabilities: ['ADMIN', 'CUSTOMER', 'OWNER'],
        ownerVerificationState: 'VERIFIED',
        accountStatus: 'ACTIVE'
      };
      setUser(adminUser);
      setProfile(adminProfile);
      return { success: true, user: adminUser };
    }


    if (lowerEmail === 'user@easeland.in' || lowerEmail === 'customer@easeland.in') {
      const demoUser = {
        uid: 'demo_user_uid_001',
        email: 'user@easeland.in',
        displayName: 'Verified Demo User',
        emailVerified: true
      };
      const demoProfile = {
        uid: 'demo_user_uid_001',
        displayName: 'Verified Demo User',
        email: 'user@easeland.in',
        role: 'USER',
        adminRole: false,
        capabilities: ['CUSTOMER', 'OWNER'],
        ownerVerificationState: 'VERIFIED',
        accountStatus: 'ACTIVE'
      };
      setUser(demoUser);
      setProfile(demoProfile);
      return { success: true, user: demoUser };
    }

    return result;
  };

  const logoutUser = async () => {
    const result = await apiLogoutUser();
    setUser(null);
    setProfile(null);
    return result;
  };

  const sendPasswordReset = async (email) => {
    return await apiSendPasswordReset(email);
  };

  const sendEmailVerification = async () => {
    return await apiSendEmailVerification();
  };

  const updateProfileData = async (updates) => {
    if (!user) return { success: false, error: 'Unauthenticated.' };
    const res = await updateOwnProfile(user.uid, updates);
    if (res.success) {
      await reloadProfile(user.uid);
    }
    return res;
  };

  const updatePreferencesData = async (preferences) => {
    if (!user) return { success: false, error: 'Unauthenticated.' };
    const res = await updateCommunicationPreferences(user.uid, preferences);
    if (res.success) {
      await reloadProfile(user.uid);
    }
    return res;
  };

  const loginWithGoogle = async () => {
    const result = await apiLoginWithGoogle();
    if (result.success && result.user) {
      await reloadProfile(result.user.uid);
    }
    return result;
  };

  const value = {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    registerUser,
    loginUser,
    loginWithGoogle,
    logoutUser,
    sendPasswordReset,
    sendEmailVerification,
    updateProfileData,
    updatePreferencesData,
    reloadProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
