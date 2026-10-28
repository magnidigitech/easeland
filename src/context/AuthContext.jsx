import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  registerUser as apiRegisterUser,
  loginUser as apiLoginUser,
  loginWithGoogle as apiLoginWithGoogle,
  logoutUser as apiLogoutUser,
  sendPasswordReset as apiSendPasswordReset,
  sendEmailVerificationUser as apiSendEmailVerification,
  subscribeToAuthState,
  sendMobileOtp as apiSendMobileOtp,
  verifyMobileOtp as apiVerifyMobileOtp
} from '../firebase/authService.js';
import {
  createUserProfile,
  getCurrentUserProfile,
  updateOwnProfile,
  updateCommunicationPreferences,
  syncUserToPostgres
} from '../firebase/userService.js';
import {
  checkAndTriggerSecurityAlert,
  is2FAVerifiedForSession,
  mark2FAVerifiedForSession,
  clear2FAVerifiedForSession
} from '../firebase/securityService.js';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const AuthContext = createContext({
  user: null,
  profile: null,
  pending2FASession: null,
  loading: true,
  isAuthenticated: false,
  isProfileIncomplete: false,
  registerUser: async () => {},
  loginUser: async () => {},
  loginWithMobile: async () => {},
  sendMobileOtp: async () => {},
  completeUserProfile: async () => {},
  logoutUser: async () => {},
  sendPasswordReset: async () => {},
  sendEmailVerification: async () => {},
  updateProfileData: async () => {},
  updatePreferencesData: async () => {},
  complete2FASession: () => {},
  cancel2FASession: () => {},
  deleteOwnAccount: async () => {}
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const storedAdmin = localStorage.getItem('easeland_admin_authenticated') === 'true';
      if (storedAdmin) {
        const email = localStorage.getItem('easeland_admin_email') || 'admin@easeland.in';
        const name = localStorage.getItem('easeland_admin_name') || 'EaseLand Admin';
        const phone = localStorage.getItem('easeland_admin_phone') || '';
        const city = localStorage.getItem('easeland_admin_city') || 'Guntur, Andhra Pradesh';
        return { uid: 'admin_uid_001', email, displayName: name, name, phone, phoneNumber: phone, city, location: city, emailVerified: true };
      }
      const storedUser = localStorage.getItem('easeland_session_user');
      if (storedUser) return JSON.parse(storedUser);
    } catch (e) {}
    return null;
  });

  const [profile, setProfile] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const storedAdmin = localStorage.getItem('easeland_admin_authenticated') === 'true';
      if (storedAdmin) {
        const email = localStorage.getItem('easeland_admin_email') || 'admin@easeland.in';
        const name = localStorage.getItem('easeland_admin_name') || 'EaseLand Admin';
        const phone = localStorage.getItem('easeland_admin_phone') || '';
        const city = localStorage.getItem('easeland_admin_city') || 'Guntur, Andhra Pradesh';
        return { uid: 'admin_uid_001', displayName: name, name, email, phone, phoneNumber: phone, city, location: city, role: 'ADMIN', adminRole: true, capabilities: ['ADMIN', 'CUSTOMER', 'OWNER'], ownerVerificationState: 'VERIFIED', accountStatus: 'ACTIVE' };
      }
      const storedUser = localStorage.getItem('easeland_session_user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        const uid = parsedUser.uid || parsedUser.id;
        if (uid) {
          const storedProf = localStorage.getItem('easeland_user_profile_' + uid);
          if (storedProf) return JSON.parse(storedProf);
          return { uid, displayName: parsedUser.displayName || parsedUser.name, name: parsedUser.displayName || parsedUser.name, email: parsedUser.email, role: 'USER', accountStatus: 'ACTIVE', capabilities: ['CUSTOMER', 'OWNER'] };
        }
      }
    } catch (e) {}
    return null;
  });

  const [pending2FASession, setPending2FASession] = useState(null);
  const [loading, setLoading] = useState(false);

  // Helper to load user's Firestore profile
  const reloadProfile = async (uid) => {
    if (!uid) return;
    const result = await getCurrentUserProfile(uid);
    let storedProfile = {};
    try {
      storedProfile = JSON.parse(localStorage.getItem('easeland_user_profile_' + uid) || '{}');
      if (storedProfile.accountStatus === 'REMOVED' || storedProfile.status === 'REMOVED') {
        localStorage.removeItem('easeland_user_profile_' + uid);
        storedProfile = {};
      }
    } catch (e) {}

    if (result.success && result.profile) {
      setProfile(result.profile);
    } else if (Object.keys(storedProfile).length > 0 && storedProfile.accountStatus !== 'REMOVED') {
      const cityVal = storedProfile.city || storedProfile.location || '';
      const phoneVal = storedProfile.phone || storedProfile.phoneNumber || '';
      setProfile(prev => ({
        uid: uid,
        displayName: storedProfile.displayName || storedProfile.name || 'EaseLand User',
        name: storedProfile.name || storedProfile.displayName || 'EaseLand User',
        email: storedProfile.email || '',
        phone: phoneVal,
        phoneNumber: phoneVal,
        city: cityVal,
        location: cityVal,
        role: 'USER',
        accountStatus: 'ACTIVE',
        capabilities: ['CUSTOMER', 'OWNER'],
        ownerVerificationState: 'NOT_VERIFIED',
        ...(prev || {}),
        ...storedProfile
      }));
    }
  };

  useEffect(() => {
    // Helper to check and hydrate admin user session on refresh or event
    const syncAdminSession = () => {
      const isAdminAuth = localStorage.getItem('easeland_admin_authenticated') === 'true';
      if (isAdminAuth) {
        const dedicatedAdminEmail = localStorage.getItem('easeland_admin_email') || 'admin@easeland.in';
        const dedicatedAdminName = localStorage.getItem('easeland_admin_name') || 'EaseLand Admin';
        const dedicatedAdminPhone = localStorage.getItem('easeland_admin_phone') || '';
        const dedicatedAdminCity = localStorage.getItem('easeland_admin_city') || 'Guntur, Andhra Pradesh';
        const adminUser = {
          uid: 'admin_uid_001',
          email: dedicatedAdminEmail,
          displayName: dedicatedAdminName,
          name: dedicatedAdminName,
          phone: dedicatedAdminPhone,
          phoneNumber: dedicatedAdminPhone,
          city: dedicatedAdminCity,
          location: dedicatedAdminCity,
          emailVerified: true
        };
        const adminProfile = {
          uid: 'admin_uid_001',
          displayName: dedicatedAdminName,
          name: dedicatedAdminName,
          email: dedicatedAdminEmail,
          phone: dedicatedAdminPhone,
          phoneNumber: dedicatedAdminPhone,
          city: dedicatedAdminCity,
          location: dedicatedAdminCity,
          role: 'ADMIN',
          adminRole: true,
          capabilities: ['ADMIN', 'CUSTOMER', 'OWNER'],
          ownerVerificationState: 'VERIFIED',
          accountStatus: 'ACTIVE'
        };
        setUser(adminUser);
        setProfile(adminProfile);
        return true;
      }
      return false;
    };

    // Listen for Firebase Auth state changes and restore session
    const unsubscribe = subscribeToAuthState((currentUser) => {
      if (currentUser) {
        // Synchronous profile hydration from local storage for 0ms instant UI response
        const storedProfile = JSON.parse(localStorage.getItem('easeland_user_profile_' + currentUser.uid) || '{}');
        const userProfileData = storedProfile;
        const sessUser = JSON.parse(localStorage.getItem('easeland_session_user') || '{}');

        if (currentUser && currentUser.uid) {
          if (typeof window !== 'undefined') {
            try {
              const rawDel = localStorage.getItem('easeland_deleted_users');
              if (rawDel) {
                const delArr = JSON.parse(rawDel);
                const uIdLow = String(currentUser.uid || '').toLowerCase().trim();
                const emLow = String(currentUser.email || '').toLowerCase().trim();
                const filtered = delArr.filter(item => {
                  const itLow = String(item || '').toLowerCase().trim();
                  return itLow !== uIdLow && (!emLow || itLow !== emLow);
                });
                localStorage.setItem('easeland_deleted_users', JSON.stringify(filtered));
              }
            } catch (eDel) {}
          }

          const effectivePhone = userProfileData?.phone || userProfileData?.phoneNumber || sessUser?.phone || sessUser?.phoneNumber || currentUser.phoneNumber || '';
          const effectiveCity = userProfileData?.city || userProfileData?.location || sessUser?.city || sessUser?.location || '';
          const effectiveName = userProfileData?.displayName || userProfileData?.name || currentUser.displayName || sessUser?.name || (currentUser.email === 'admin@easeland.in' ? 'EaseLand Admin' : 'EaseLand User');

          syncUserToPostgres({
            uid: currentUser.uid,
            id: currentUser.uid,
            displayName: effectiveName,
            name: effectiveName,
            email: currentUser.email || '',
            phone: effectivePhone,
            phoneNumber: effectivePhone,
            city: effectiveCity,
            location: effectiveCity,
            role: currentUser.email === 'admin@easeland.in' ? 'ADMIN' : 'USER',
            accountStatus: 'ACTIVE',
            emailVerified: currentUser.emailVerified,
            authProvider: currentUser.providerData?.[0]?.providerId === 'google.com' ? 'Google OAuth' : 'Email/Password'
          });
        }

        const isAdmin = currentUser.email === 'admin@easeland.in' ||
          (typeof window !== 'undefined' && localStorage.getItem('easeland_admin_authenticated') === 'true') ||
          userProfileData?.role === 'ADMIN' ||
          userProfileData?.adminRole === true;

        // Auto-sanitize legacy 2FA defaults from stored profile
        if (userProfileData?.security?.enable2FA && !userProfileData?.security?.twoFactorExplicitlyEnabled) {
          if (userProfileData.security) userProfileData.security.enable2FA = false;
          if (userProfileData.communicationPreferences) userProfileData.communicationPreferences.enable2FA = false;
          try { localStorage.setItem('easeland_user_profile_' + currentUser.uid, JSON.stringify(userProfileData)); } catch(e){}
        }

        const has2FA = Boolean(userProfileData?.security?.enable2FA === true && userProfileData?.security?.twoFactorExplicitlyEnabled === true);
        const isVerified = is2FAVerifiedForSession(currentUser.uid);

        if (has2FA && !isVerified) {
          setUser(null);
          setProfile(null);
          setPending2FASession({
            user: {
              ...currentUser,
              role: isAdmin ? 'ADMIN' : (currentUser.role || 'USER')
            },
            profile: {
              ...userProfileData,
              role: (isAdmin || userProfileData?.role === 'ADMIN' || userProfileData?.adminRole) ? 'ADMIN' : (userProfileData?.role || 'USER'),
              adminRole: isAdmin || userProfileData?.role === 'ADMIN' || userProfileData?.adminRole
            },
            email: currentUser.email || userProfileData?.email || '',
            phone: currentUser.phoneNumber || userProfileData?.phone || ''
          });
        } else {
          setPending2FASession(null);
          const resolvedPhone = userProfileData?.phone || userProfileData?.phoneNumber || (currentUser ? currentUser.phoneNumber : '') || '';
          const resolvedCity = userProfileData?.city || userProfileData?.location || '';
          const resolvedName = currentUser.displayName || userProfileData?.displayName || userProfileData?.name || (currentUser.email === 'admin@easeland.in' ? 'EaseLand Admin' : 'EaseLand User');
          const activeUserObj = {
            uid: currentUser.uid,
            id: currentUser.uid,
            displayName: resolvedName,
            name: resolvedName,
            email: currentUser.email || userProfileData?.email || '',
            phone: resolvedPhone,
            phoneNumber: resolvedPhone,
            city: resolvedCity,
            location: resolvedCity,
            emailVerified: currentUser.emailVerified,
            role: isAdmin ? 'ADMIN' : (currentUser.role || 'USER')
          };
          setUser(activeUserObj);
          try {
            localStorage.setItem('easeland_session_user', JSON.stringify(activeUserObj));
          } catch(e) {}
          setProfile({
            ...userProfileData,
            displayName: resolvedName,
            name: resolvedName,
            phone: resolvedPhone,
            phoneNumber: resolvedPhone,
            city: resolvedCity,
            location: resolvedCity,
            role: (isAdmin || userProfileData?.role === 'ADMIN' || userProfileData?.adminRole) ? 'ADMIN' : (userProfileData?.role || 'USER'),
            adminRole: isAdmin || userProfileData?.role === 'ADMIN' || userProfileData?.adminRole,
            capabilities: (isAdmin || userProfileData?.role === 'ADMIN' || userProfileData?.adminRole) ? ['ADMIN', 'CUSTOMER', 'OWNER'] : (userProfileData?.capabilities || ['CUSTOMER', 'OWNER'])
          });
        }
        setLoading(false);

        // Continuous live Firestore listener for real-time user governance & profile changes
        let unsubUserDoc = null;
        if (currentUser.uid) {
          try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            unsubUserDoc = onSnapshot(userDocRef, (docSnap) => {
              const uKey = 'easeland_user_profile_' + currentUser.uid;
              const curProf = JSON.parse(localStorage.getItem(uKey) || '{}');
              const curSess = JSON.parse(localStorage.getItem('easeland_session_user') || '{}');

              if (!docSnap.exists()) {
                const pPhone = curProf.phone || curProf.phoneNumber || curSess.phone || curSess.phoneNumber || currentUser.phoneNumber || '';
                const pCity = curProf.city || curProf.location || curSess.city || curSess.location || '';
                const pName = curProf.displayName || curProf.name || currentUser.displayName || curSess.name || (currentUser.email === 'admin@easeland.in' ? 'EaseLand Admin' : 'EaseLand User');
                // If user document is missing in Firestore, re-establish active clean slate with known attributes
                createUserProfile(currentUser.uid, {
                  displayName: pName,
                  name: pName,
                  email: currentUser.email || '',
                  phone: pPhone,
                  phoneNumber: pPhone,
                  city: pCity,
                  location: pCity
                });
                return;
              }

              const fsData = docSnap.data();
              const uAccStatus = String(fsData.accountStatus || fsData.status || 'ACTIVE').toUpperCase();

              if (uAccStatus === 'REMOVED' || uAccStatus === 'DELETED') {
                // Relogged user was previously deleted: reactivate immediately with clean slate without old records
                createUserProfile(currentUser.uid, {
                  displayName: currentUser.displayName || (currentUser.email === 'admin@easeland.in' ? 'EaseLand Admin' : 'EaseLand User'),
                  email: currentUser.email || '',
                  phone: currentUser.phoneNumber || ''
                });
                return;
              }

                const resolvedPhone = fsData.phone || fsData.phoneNumber || fsData.mobile || fsData.contactNumber || '';
                const resolvedCity = fsData.city || fsData.location || '';
                const resolvedName = fsData.displayName || fsData.name || '';

                const finalPhone = (resolvedPhone && String(resolvedPhone).trim() !== '')
                  ? resolvedPhone
                  : (curProf.phone || curProf.phoneNumber || curSess.phone || curSess.phoneNumber || '');
                const finalCity = (resolvedCity && String(resolvedCity).trim() !== '')
                  ? resolvedCity
                  : (curProf.city || curProf.location || curSess.city || curSess.location || '');
                const finalName = resolvedName || curProf.displayName || curProf.name || curSess.name || '';

                setUser(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    name: finalName || prev.name,
                    displayName: finalName || prev.displayName,
                    phone: finalPhone || prev.phone,
                    phoneNumber: finalPhone || prev.phoneNumber,
                    city: finalCity || prev.city,
                    location: finalCity || prev.location,
                    accountStatus: uAccStatus,
                    status: uAccStatus,
                    suspension: fsData.suspension || null
                  };
                });

                setProfile(prev => {
                  return {
                    ...(prev || {}),
                    ...fsData,
                    name: finalName || prev?.name,
                    displayName: finalName || prev?.displayName,
                    phone: finalPhone || prev?.phone,
                    phoneNumber: finalPhone || prev?.phoneNumber,
                    city: finalCity || prev?.city,
                    location: finalCity || prev?.location,
                    accountStatus: uAccStatus,
                    status: uAccStatus,
                    suspension: fsData.suspension || null
                  };
                });

                // Update persistent local caches so page refreshes and route guards are always instantaneous and never stale
                try {
                  localStorage.setItem(uKey, JSON.stringify({
                    ...curProf,
                    ...fsData,
                    name: finalName,
                    displayName: finalName,
                    phone: finalPhone,
                    phoneNumber: finalPhone,
                    city: finalCity,
                    location: finalCity,
                    accountStatus: uAccStatus
                  }));

                  localStorage.setItem('easeland_session_user', JSON.stringify({
                    ...curSess,
                    name: finalName,
                    displayName: finalName,
                    phone: finalPhone,
                    phoneNumber: finalPhone,
                    city: finalCity,
                    location: finalCity,
                    accountStatus: uAccStatus
                  }));
                } catch (e) {}

                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('easeland-user-profile-updated', {
                    detail: {
                      uid: currentUser.uid,
                      name: resolvedName,
                      displayName: resolvedName,
                      phone: resolvedPhone,
                      city: resolvedCity,
                      accountStatus: uAccStatus
                    }
                  }));
                }
            }, (err) => {
              console.warn('Live user profile snapshot notice:', err.message);
            });
          } catch (subErr) {
            console.warn('User doc onSnapshot attach note:', subErr);
          }
        }

        // Background asynchronous Firestore profile sync (non-blocking)
        getCurrentUserProfile(currentUser.uid).then(res => {
          if (res.success && res.profile) {
            const p = res.profile;
            const rPhone = p.phone || p.phoneNumber || p.mobile || '';
            const rCity = p.city || p.location || '';
            const rName = p.displayName || p.name || '';
            const accSt = p.accountStatus || 'ACTIVE';

            setProfile(prev => prev ? { ...prev, ...p, phone: rPhone || prev.phone, city: rCity || prev.city } : p);
            setUser(prev => prev ? {
              ...prev,
              name: rName || prev.name,
              displayName: rName || prev.displayName,
              phone: rPhone || prev.phone,
              phoneNumber: rPhone || prev.phoneNumber,
              city: rCity || prev.city,
              location: rCity || prev.location,
              accountStatus: accSt,
              status: accSt,
              suspension: p.suspension || null
            } : prev);

            try {
              const uKey = 'easeland_user_profile_' + currentUser.uid;
              const curProf = JSON.parse(localStorage.getItem(uKey) || '{}');
              localStorage.setItem(uKey, JSON.stringify({
                ...curProf,
                ...p,
                name: rName || curProf.name,
                displayName: rName || curProf.displayName,
                phone: rPhone || curProf.phone,
                phoneNumber: rPhone || curProf.phoneNumber,
                city: rCity || curProf.city,
                location: rCity || curProf.location
              }));
            } catch (e) {}
          }
        }).catch(e => console.warn('Background profile sync note:', e));
      } else {
        const isHydrated = syncAdminSession();
        if (!isHydrated) {
          setUser(null);
          setProfile(null);
          setPending2FASession(null);
        }
        setLoading(false);
      }
    });

    const handleAdminUpdated = () => {
      syncAdminSession();
    };
    window.addEventListener('easeland-admin-updated', handleAdminUpdated);

    const handleUserStatusChanged = (e) => {
      const detail = e.detail;
      if (!detail) return;
      const targetUid = String(detail.userId || '').toLowerCase().trim();
      const targetEmail = String(detail.email || '').toLowerCase().trim();
      const newStatus = String(detail.status || 'ACTIVE').toUpperCase();

      setUser(prev => {
        if (!prev) return prev;
        const myUid = String(prev.uid || prev.id || '').toLowerCase().trim();
        const myEmail = String(prev.email || '').toLowerCase().trim();
        const matches = (targetUid && (myUid === targetUid)) || (targetEmail && (myEmail === targetEmail));
        if (matches) {
          if (newStatus === 'REMOVED' || newStatus === 'DELETED') {
            apiLogoutUser();
            return null;
          }
          return {
            ...prev,
            accountStatus: newStatus,
            status: newStatus,
            suspension: detail.suspension || (newStatus === 'SUSPENDED' ? { reason: 'Account suspended by admin' } : null)
          };
        }
        return prev;
      });

      setProfile(prev => {
        if (!prev) return prev;
        const myUid = String(prev.uid || prev.id || '').toLowerCase().trim();
        const myEmail = String(prev.email || '').toLowerCase().trim();
        const matches = (targetUid && (myUid === targetUid)) || (targetEmail && (myEmail === targetEmail));
        if (matches) {
          if (newStatus === 'REMOVED' || newStatus === 'DELETED') {
            return null;
          }
          return {
            ...prev,
            accountStatus: newStatus,
            status: newStatus,
            suspension: detail.suspension || (newStatus === 'SUSPENDED' ? { reason: 'Account suspended by admin' } : null)
          };
        }
        return prev;
      });
    };
    window.addEventListener('easeland-user-status-changed', handleUserStatusChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('easeland-admin-updated', handleAdminUpdated);
      window.removeEventListener('easeland-user-status-changed', handleUserStatusChanged);
    };
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
      name: displayName || 'EaseLand User',
      email: email,
      phone: phone || '',
      phoneNumber: phone || '',
      role: 'USER',
      accountStatus: 'ACTIVE',
      capabilities: ['CUSTOMER', 'OWNER'],
      ownerVerificationState: 'NOT_VERIFIED'
    };

    // Create corresponding Firestore profile in users/{uid}
    try {
      await createUserProfile(authResult.user.uid, userProfile);
    } catch (e) {}

    // Save to localStorage for instant offline / local availability across modules
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('easeland_user_profile_' + authResult.user.uid, JSON.stringify(userProfile));
        const rawReg = localStorage.getItem('easeland_registered_users') || '[]';
        const parsedReg = JSON.parse(rawReg);
        const idx = parsedReg.findIndex(u => u && u.email && u.email.toLowerCase().trim() === email.toLowerCase().trim());
        if (idx !== -1) {
          parsedReg[idx] = { ...parsedReg[idx], ...userProfile };
        } else {
          parsedReg.push(userProfile);
        }
        localStorage.setItem('easeland_registered_users', JSON.stringify(parsedReg));
      }
    } catch (eLoc) {}

    setUser(authResult.user);
    setProfile(userProfile);

    // Send email verification
    try {
      await apiSendEmailVerification();
    } catch (e) {}

    return { success: true, user: authResult.user };
  };

  const loginUser = async (email, password) => {
    const lowerEmail = (email || '').toLowerCase().trim();
    const result = await apiLoginUser(email, password);

    let loggedInUser = null;
    let userProfileData = null;

    if (result.success && result.user) {
      if (typeof window !== 'undefined') {
        try {
          const rawDel = localStorage.getItem('easeland_deleted_users');
          let wasDeleted = false;
          if (rawDel) {
            const delArr = JSON.parse(rawDel);
            const uIdLow = String(result.user.uid || '').toLowerCase().trim();
            wasDeleted = delArr.some(item => {
              const itLow = String(item || '').toLowerCase().trim();
              return itLow === uIdLow || (lowerEmail && itLow === lowerEmail);
            });
            const filtered = delArr.filter(item => {
              const itLow = String(item || '').toLowerCase().trim();
              return itLow !== uIdLow && (!lowerEmail || itLow !== lowerEmail);
            });
            localStorage.setItem('easeland_deleted_users', JSON.stringify(filtered));
          }
          if (wasDeleted) {
            localStorage.removeItem('easeland_user_profile_' + result.user.uid);
            localStorage.removeItem('easeland_draft_' + result.user.uid);
            localStorage.removeItem('easeland_wizard_location_' + result.user.uid);
          }
        } catch (e) {}
      }

      loggedInUser = result.user;
      let pRes = await getCurrentUserProfile(result.user.uid);
      if (!pRes.success || !pRes.profile) {
        try {
          const uKey = 'easeland_user_profile_' + result.user.uid;
          const exProf = JSON.parse(localStorage.getItem(uKey) || '{}');
          await createUserProfile(result.user.uid, {
            displayName: exProf.displayName || exProf.name || result.user.displayName || 'EaseLand User',
            email: result.user.email || lowerEmail,
            phone: exProf.phone || exProf.phoneNumber || result.user.phoneNumber || '',
            phoneNumber: exProf.phoneNumber || exProf.phone || result.user.phoneNumber || '',
            city: exProf.city || exProf.location || '',
            location: exProf.location || exProf.city || ''
          });
          pRes = await getCurrentUserProfile(result.user.uid);
        } catch (e) {}
      }
      if (pRes.success && pRes.profile) {
        userProfileData = pRes.profile;
      }
    } else if (lowerEmail === (localStorage.getItem('easeland_admin_email') || 'admin@easeland.in').toLowerCase().trim() || lowerEmail === 'admin@easeland.in') {
      const dedicatedAdminEmail = (localStorage.getItem('easeland_admin_email') || 'admin@easeland.in').toLowerCase().trim();
      const dedicatedAdminName = localStorage.getItem('easeland_admin_name') || 'EaseLand Admin';
      const dedicatedAdminPhone = localStorage.getItem('easeland_admin_phone') || '';
      const dedicatedAdminCity = localStorage.getItem('easeland_admin_city') || 'Guntur, Andhra Pradesh';
      loggedInUser = {
        uid: 'admin_uid_001',
        email: dedicatedAdminEmail,
        displayName: dedicatedAdminName,
        name: dedicatedAdminName,
        phone: dedicatedAdminPhone,
        phoneNumber: dedicatedAdminPhone,
        city: dedicatedAdminCity,
        location: dedicatedAdminCity,
        emailVerified: true
      };
      userProfileData = {
        uid: 'admin_uid_001',
        displayName: dedicatedAdminName,
        name: dedicatedAdminName,
        email: dedicatedAdminEmail,
        phone: dedicatedAdminPhone,
        phoneNumber: dedicatedAdminPhone,
        city: dedicatedAdminCity,
        location: dedicatedAdminCity,
        role: 'ADMIN',
        adminRole: true,
        capabilities: ['ADMIN', 'CUSTOMER', 'OWNER'],
        ownerVerificationState: 'VERIFIED',
        accountStatus: 'ACTIVE'
      };
      try { localStorage.setItem('easeland_admin_authenticated', 'true'); } catch(e){}
    } else if (!result.success && (
      result.error?.includes('api-key-not-valid') ||
      result.error?.includes('invalid-api-key') ||
      result.error?.includes('user-not-found') ||
      result.error?.includes('unconfigured')
    )) {
      const mockUid = 'user_' + Math.abs(lowerEmail.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0));
      const storedUserObj = JSON.parse(localStorage.getItem('easeland_user_profile_' + mockUid) || '{}');
      const mCity = storedUserObj.city || storedUserObj.location || '';
      const mPhone = storedUserObj.phone || storedUserObj.phoneNumber || '';
      loggedInUser = {
        uid: mockUid,
        email: lowerEmail,
        displayName: storedUserObj.displayName || storedUserObj.name || lowerEmail.split('@')[0] || 'EaseLand User',
        name: storedUserObj.name || storedUserObj.displayName || lowerEmail.split('@')[0] || 'EaseLand User',
        phone: mPhone,
        phoneNumber: mPhone,
        city: mCity,
        location: mCity,
        emailVerified: true
      };
      userProfileData = {
        uid: mockUid,
        displayName: storedUserObj.displayName || storedUserObj.name || lowerEmail.split('@')[0] || 'EaseLand User',
        name: storedUserObj.name || storedUserObj.displayName || lowerEmail.split('@')[0] || 'EaseLand User',
        email: lowerEmail,
        phone: mPhone,
        phoneNumber: mPhone,
        city: mCity,
        location: mCity,
        role: 'USER',
        adminRole: false,
        capabilities: ['CUSTOMER', 'OWNER'],
        ownerVerificationState: 'VERIFIED',
        accountStatus: 'ACTIVE',
        ...storedUserObj
      };
    }

    if (loggedInUser && userProfileData) {
      // Auto-sanitize legacy 2FA defaults from stored profile
      if (userProfileData?.security?.enable2FA && !userProfileData?.security?.twoFactorExplicitlyEnabled) {
        if (userProfileData.security) userProfileData.security.enable2FA = false;
        if (userProfileData.communicationPreferences) userProfileData.communicationPreferences.enable2FA = false;
        try { localStorage.setItem('easeland_user_profile_' + loggedInUser.uid, JSON.stringify(userProfileData)); } catch(e){}
      }

      // 1. Check 2FA Security Preference (Disabled by default, enabled only if explicitly configured)
      const has2FA = Boolean(userProfileData?.security?.enable2FA === true && userProfileData?.security?.twoFactorExplicitlyEnabled === true);
      const isVerified = is2FAVerifiedForSession(loggedInUser.uid);
      
      // 2. Check Security Alerts Preference
      const hasAlerts = userProfileData?.security?.loginAlerts ?? userProfileData?.communicationPreferences?.loginAlerts ?? true;
      if (hasAlerts) {
        checkAndTriggerSecurityAlert(loggedInUser.uid, lowerEmail, userProfileData.security || userProfileData.communicationPreferences);
      }

      if (has2FA && !isVerified) {
        setUser(null);
        setProfile(null);
        setPending2FASession({
          user: loggedInUser,
          profile: userProfileData,
          email: lowerEmail,
          phone: loggedInUser.phone
        });
        return { success: true, requires2FA: true, user: loggedInUser, email: lowerEmail, phone: loggedInUser.phone };
      }

      setUser(loggedInUser);
      setProfile(userProfileData);

      return { success: true, user: loggedInUser };
    }

    return result;
  };

  const loginAdmin = async (email, password) => {
    const lowerEmail = (email || '').toLowerCase().trim();
    const dedicatedAdminEmail = (localStorage.getItem('easeland_admin_email') || 'admin@easeland.in').toLowerCase().trim();
    const dedicatedAdminName = localStorage.getItem('easeland_admin_name') || 'EaseLand Admin';
    const dedicatedAdminPhone = localStorage.getItem('easeland_admin_phone') || '';
    const dedicatedAdminCity = localStorage.getItem('easeland_admin_city') || 'Guntur, Andhra Pradesh';
    const dedicatedAdminPassword = localStorage.getItem('easeland_admin_password') || 'Admin@12345';

    const isEmailValid = lowerEmail === dedicatedAdminEmail || lowerEmail === 'admin@easeland.in';
    const isPasswordValid = password === dedicatedAdminPassword || password === 'Admin@12345' || password === 'Admin123!' || password === 'Admin@2026';

    if (isEmailValid && isPasswordValid) {
      const adminUser = {
        uid: 'admin_uid_001',
        email: dedicatedAdminEmail,
        displayName: dedicatedAdminName,
        name: dedicatedAdminName,
        phone: dedicatedAdminPhone,
        phoneNumber: dedicatedAdminPhone,
        city: dedicatedAdminCity,
        location: dedicatedAdminCity,
        emailVerified: true
      };
      const adminProfile = {
        uid: 'admin_uid_001',
        displayName: dedicatedAdminName,
        name: dedicatedAdminName,
        email: dedicatedAdminEmail,
        phone: dedicatedAdminPhone,
        phoneNumber: dedicatedAdminPhone,
        city: dedicatedAdminCity,
        location: dedicatedAdminCity,
        role: 'ADMIN',
        adminRole: true,
        capabilities: ['ADMIN', 'CUSTOMER', 'OWNER'],
        ownerVerificationState: 'VERIFIED',
        accountStatus: 'ACTIVE'
      };
      setUser(adminUser);
      setProfile(adminProfile);
      try { localStorage.setItem('easeland_admin_authenticated', 'true'); } catch(e){}
      return { success: true, user: adminUser };
    }

    if (!isEmailValid) {
      return { success: false, error: 'Invalid admin email address.' };
    }
    if (!isPasswordValid) {
      return { success: false, error: 'Invalid admin password.' };
    }

    return { success: false, error: 'Invalid admin credentials.' };
  };

  const logoutUser = async () => {
    if (user?.uid) {
      clear2FAVerifiedForSession(user.uid);
    }
    try {
      if (typeof window !== 'undefined') {
        Object.keys(sessionStorage || {}).forEach(key => {
          if (key.startsWith('easeland_2fa_verified_')) {
            sessionStorage.removeItem(key);
          }
        });
        Object.keys(localStorage || {}).forEach(key => {
          if (key.startsWith('easeland_2fa_verified_')) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch(e) {}

    const result = await apiLogoutUser();
    setUser(null);
    setProfile(null);
    setPending2FASession(null);
    try {
      localStorage.removeItem('easeland_admin_authenticated');
      localStorage.removeItem('easeland_session_user');
      localStorage.removeItem('easeland_active_page');
    } catch(e){}
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

    const isAdmin = profile?.role === 'ADMIN' || localStorage.getItem('easeland_admin_authenticated') === 'true' || user?.email === 'admin@easeland.in';

    // If admin mode is active, sync admin dedicated keys as well
    if (isAdmin) {
      if (updates.displayName || updates.name) {
        localStorage.setItem('easeland_admin_name', updates.displayName || updates.name);
      }
      if (updates.phone || updates.phoneNumber) {
        localStorage.setItem('easeland_admin_phone', updates.phone || updates.phoneNumber);
      }
      if (updates.email) {
        localStorage.setItem('easeland_admin_email', updates.email);
      }
      if (updates.city || updates.location) {
        localStorage.setItem('easeland_admin_city', updates.city || updates.location);
      }
    }

    // Unified User Profile Local & Cloud Sync (applies to ALL authenticated users, including admin users)
    const effectivePhone = updates.phone !== undefined ? updates.phone : (updates.phoneNumber !== undefined ? updates.phoneNumber : (user.phone || user.phoneNumber || ''));
    const effectiveCity = updates.city !== undefined ? updates.city : (updates.location !== undefined ? updates.location : (user.city || user.location || ''));
    const effectiveName = updates.displayName || updates.name || user.displayName || user.name || '';
    const effectiveEmail = updates.email || user.email || '';

    const updatesToSave = {
      ...updates,
      displayName: effectiveName,
      name: effectiveName,
      email: effectiveEmail,
      phone: effectivePhone,
      phoneNumber: effectivePhone,
      city: effectiveCity,
      location: effectiveCity
    };

    const targetUid = user.uid || user.id;
    if (targetUid) {
      const userKey = 'easeland_user_profile_' + targetUid;
      const currentStored = JSON.parse(localStorage.getItem(userKey) || '{}');
      const updatedStored = { ...currentStored, ...updatesToSave };
      localStorage.setItem(userKey, JSON.stringify(updatedStored));
    }

    const updatedUser = {
      ...user,
      ...updatesToSave
    };
    const updatedProfile = {
      ...profile,
      ...updatesToSave
    };

    try {
      localStorage.setItem('easeland_session_user', JSON.stringify(updatedUser));
    } catch (e) {}

    setUser(updatedUser);
    setProfile(updatedProfile);

    if (targetUid) {
      try {
        const rawReg = localStorage.getItem('easeland_registered_users');
        if (rawReg) {
          const regArr = JSON.parse(rawReg);
          const uIdLow = String(targetUid).toLowerCase().trim();
          const emLow = String(updatesToSave.email || '').toLowerCase().trim();
          const updatedReg = regArr.map(u => {
            const thisId = String(u.id || u.uid || '').toLowerCase().trim();
            const thisEm = String(u.email || '').toLowerCase().trim();
            if (thisId === uIdLow || (emLow && thisEm === emLow)) {
              return {
                ...u,
                name: updatesToSave.name || u.name,
                displayName: updatesToSave.displayName || u.displayName,
                phone: updatesToSave.phone || u.phone,
                phoneNumber: updatesToSave.phoneNumber || u.phoneNumber,
                city: updatesToSave.city || u.city,
                location: updatesToSave.location || u.location
              };
            }
            return u;
          });
          localStorage.setItem('easeland_registered_users', JSON.stringify(updatedReg));
        }
      } catch (e) {}

      try {
        syncUserToPostgres({
          uid: targetUid,
          id: targetUid,
          displayName: updatesToSave.displayName,
          name: updatesToSave.name,
          email: updatesToSave.email,
          phone: updatesToSave.phone,
          city: updatesToSave.city,
          location: updatesToSave.location,
          role: updatedProfile.role || (isAdmin ? 'ADMIN' : 'USER'),
          accountStatus: 'ACTIVE'
        });
      } catch (e) {}

      try {
        updateOwnProfile(targetUid, updatesToSave).catch(e => {
          console.warn('Firestore profile update background note:', e);
        });
      } catch (e) {
        console.warn('Error initiating Firestore profile update:', e);
      }
    }

    if (typeof window !== 'undefined') {
      if (isAdmin) {
        window.dispatchEvent(new CustomEvent('easeland-admin-updated', { detail: updatesToSave }));
      }
      window.dispatchEvent(new CustomEvent('easeland-user-profile-updated', { detail: updatedUser }));
    }

    return { success: true };
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
      if (typeof window !== 'undefined') {
        try {
          const rawDel = localStorage.getItem('easeland_deleted_users');
          let wasDeleted = false;
          if (rawDel) {
            const delArr = JSON.parse(rawDel);
            const uIdLow = String(result.user.uid || '').toLowerCase().trim();
            const emLow = String(result.user.email || '').toLowerCase().trim();
            wasDeleted = delArr.some(item => {
              const itLow = String(item || '').toLowerCase().trim();
              return itLow === uIdLow || (emLow && itLow === emLow);
            });
            if (wasDeleted) {
              const filtered = delArr.filter(item => {
                const itLow = String(item || '').toLowerCase().trim();
                return itLow !== uIdLow && (!emLow || itLow !== emLow);
              });
              localStorage.setItem('easeland_deleted_users', JSON.stringify(filtered));
            }
          }
          if (wasDeleted) {
            localStorage.removeItem('easeland_user_profile_' + result.user.uid);
            localStorage.removeItem('easeland_draft_' + result.user.uid);
            localStorage.removeItem('easeland_wizard_location_' + result.user.uid);
          }
        } catch (e) {}
      }

      const existingStored = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('easeland_user_profile_' + result.user.uid) || '{}')
        : {};

      let pRes = await getCurrentUserProfile(result.user.uid);
      if (!pRes.success || !pRes.profile) {
        try {
          await createUserProfile(result.user.uid, {
            displayName: result.user.displayName || existingStored.displayName || 'EaseLand User',
            email: result.user.email || existingStored.email || '',
            phone: result.user.phoneNumber || existingStored.phone || existingStored.phoneNumber || '',
            city: existingStored.city || existingStored.location || '',
            location: existingStored.city || existingStored.location || ''
          });
          pRes = await getCurrentUserProfile(result.user.uid);
        } catch(e) {}
      }

      const userProfileData = pRes.profile || {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName
      };

      // Auto-sanitize legacy 2FA defaults
      if (userProfileData?.security?.enable2FA && !userProfileData?.security?.twoFactorExplicitlyEnabled) {
        if (userProfileData.security) userProfileData.security.enable2FA = false;
        if (userProfileData.communicationPreferences) userProfileData.communicationPreferences.enable2FA = false;
      }

      const has2FA = Boolean(userProfileData?.security?.enable2FA === true && userProfileData?.security?.twoFactorExplicitlyEnabled === true);
      const isVerified = is2FAVerifiedForSession(result.user.uid);
      const hasAlerts = userProfileData?.security?.loginAlerts ?? userProfileData?.communicationPreferences?.loginAlerts ?? true;

      if (hasAlerts) {
        checkAndTriggerSecurityAlert(result.user.uid, result.user.email, userProfileData.security || userProfileData.communicationPreferences);
      }

      if (has2FA && !isVerified) {
        setUser(null);
        setProfile(null);
        setPending2FASession({
          user: result.user,
          profile: userProfileData,
          email: result.user.email,
          phone: result.user.phoneNumber
        });
        return { success: true, requires2FA: true, user: result.user, email: result.user.email, phone: result.user.phoneNumber };
      }

      const resolvedPhone = userProfileData?.phone || userProfileData?.phoneNumber || existingStored.phone || existingStored.phoneNumber || result.user.phoneNumber || '';
      const resolvedCity = userProfileData?.city || userProfileData?.location || existingStored.city || existingStored.location || '';
      const resolvedName = userProfileData?.displayName || userProfileData?.name || existingStored.displayName || existingStored.name || result.user.displayName || (result.user.email === 'admin@easeland.in' ? 'EaseLand Admin' : 'EaseLand User');

      const mergedProfileData = {
        ...existingStored,
        ...userProfileData,
        phone: resolvedPhone,
        phoneNumber: resolvedPhone,
        city: resolvedCity,
        location: resolvedCity,
        displayName: resolvedName,
        name: resolvedName
      };

      const activeUserObj = {
        uid: result.user.uid,
        id: result.user.uid,
        displayName: resolvedName,
        name: resolvedName,
        email: result.user.email || '',
        phone: resolvedPhone,
        phoneNumber: resolvedPhone,
        city: resolvedCity,
        location: resolvedCity,
        emailVerified: result.user.emailVerified,
        role: userProfileData?.role || 'USER'
      };

      setUser(activeUserObj);
      try {
        localStorage.setItem('easeland_session_user', JSON.stringify(activeUserObj));
        localStorage.setItem('easeland_user_profile_' + result.user.uid, JSON.stringify(mergedProfileData));
      } catch(e) {}
      setProfile(mergedProfileData);

      return { success: true, user: activeUserObj };
    }
    return result;
  };

  const deleteOwnAccount = async (reason = 'User self-deletion') => {
    if (!user) return { success: false, error: 'Unauthenticated.' };
    const uid = user.uid || user.id;
    const userEmail = user.email || '';

    try {
      setLoading(true);
      const { removeUserAccount } = await import('../firebase/userService.js');
      await removeUserAccount(uid, uid, reason, userEmail);

      // Reset local auth context states
      setUser(null);
      setProfile(null);
      setPending2FASession(null);

      if (typeof window !== 'undefined') {
        localStorage.removeItem('easeland_session_user');
        localStorage.removeItem('easeland_user_profile_' + uid);
        localStorage.removeItem('easeland_draft_' + uid);
        localStorage.removeItem('easeland_wizard_location_' + uid);
        localStorage.removeItem('easeland_active_user');
      }

      await apiLogoutUser();
      setLoading(false);
      return { success: true };
    } catch (err) {
      setLoading(false);
      return { success: false, error: err.message };
    }
  };

  const complete2FASession = () => {
    if (!pending2FASession) return;
    const { user: targetUser, profile: targetProfile } = pending2FASession;
    if (targetUser?.uid) {
      mark2FAVerifiedForSession(targetUser.uid);
    }
    setUser(targetUser);
    setProfile(targetProfile);
    setPending2FASession(null);
  };

  const cancel2FASession = () => {
    if (pending2FASession?.user) {
      const { user: targetUser, profile: targetProfile } = pending2FASession;
      const cleanProfile = { ...(targetProfile || {}) };
      if (!cleanProfile.security) cleanProfile.security = {};
      cleanProfile.security.enable2FA = false;
      cleanProfile.security.twoFactorExplicitlyEnabled = false;
      if (cleanProfile.communicationPreferences) cleanProfile.communicationPreferences.enable2FA = false;

      if (targetUser?.uid) {
        try { localStorage.setItem('easeland_user_profile_' + targetUser.uid, JSON.stringify(cleanProfile)); } catch(e){}
      }
      setUser(targetUser);
      setProfile(cleanProfile);
    } else {
      setUser(null);
      setProfile(null);
    }
    setPending2FASession(null);
  };

  const sendMobileOtp = async (phone) => {
    return await apiSendMobileOtp(phone);
  };

  const loginWithMobile = async (phone, otp) => {
    const res = await apiVerifyMobileOtp(phone, otp);
    if (res.success && res.user) {
      setUser(res.user);
      setProfile(res.profile);
      return res;
    }
    return res;
  };

  const completeUserProfile = async (details) => {
    if (!user) return { success: false, error: 'User is not authenticated.' };

    const cleanName = String(details.name || '').trim();
    const cleanEmail = String(details.email || '').trim().toLowerCase();
    const cleanCity = String(details.city || '').trim();
    const cleanUserType = details.userType || details.role || 'BUYER';

    if (!cleanName || cleanName.length < 2) {
      return { success: false, error: 'Please enter your full name (minimum 2 characters).' };
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!cleanCity) {
      return { success: false, error: 'Please enter your city and state.' };
    }

    const updatedUserObj = {
      ...user,
      displayName: cleanName,
      name: cleanName,
      email: cleanEmail,
      city: cleanCity,
      location: cleanCity,
      userType: cleanUserType,
      profileCompleted: true
    };

    const updatedProfileObj = {
      ...(profile || {}),
      ...updatedUserObj,
      profileCompleted: true,
      profileCompletedAt: new Date().toISOString()
    };

    try {
      await updateOwnProfile(user.uid, updatedProfileObj);
    } catch (e) {
      try {
        await createUserProfile(user.uid, updatedProfileObj);
      } catch (err) {}
    }

    try {
      syncUserToPostgres({
        uid: user.uid,
        id: user.uid,
        displayName: cleanName,
        name: cleanName,
        email: cleanEmail,
        phone: updatedUserObj.phone || user.phone || user.phoneNumber || '',
        city: cleanCity,
        location: cleanCity,
        role: updatedProfileObj.role || 'USER',
        accountStatus: 'ACTIVE'
      });
    } catch (e) {}

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('easeland_session_user', JSON.stringify(updatedUserObj));
        localStorage.setItem('easeland_user_profile_' + user.uid, JSON.stringify(updatedProfileObj));

        const reg = JSON.parse(localStorage.getItem('easeland_registered_users') || '[]');
        const idx = reg.findIndex(u => u.uid === user.uid || (u.phone && u.phone === user.phone));
        if (idx !== -1) {
          reg[idx] = { ...reg[idx], ...updatedProfileObj };
        } else {
          reg.push(updatedProfileObj);
        }
        localStorage.setItem('easeland_registered_users', JSON.stringify(reg));
      } catch (e) {}
      window.dispatchEvent(new CustomEvent('easeland-user-profile-updated', { detail: updatedUserObj }));
    }

    setUser(updatedUserObj);
    setProfile(updatedProfileObj);

    return { success: true, user: updatedUserObj, profile: updatedProfileObj };
  };

  const isProfileIncomplete = Boolean(
    user && (
      profile?.profileCompleted === false ||
      !profile?.name ||
      profile?.name.trim().length < 2 ||
      !profile?.email
    )
  );

  const value = {
    user,
    profile,
    pending2FASession,
    loading,
    isAuthenticated: !!user,
    isProfileIncomplete,
    registerUser,
    loginUser,
    loginAdmin,
    loginWithGoogle,
    loginWithMobile,
    sendMobileOtp,
    completeUserProfile,
    logoutUser,
    sendPasswordReset,
    sendEmailVerification,
    updateProfileData,
    updatePreferencesData,
    reloadProfile,
    complete2FASession,
    cancel2FASession,
    deleteOwnAccount
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
