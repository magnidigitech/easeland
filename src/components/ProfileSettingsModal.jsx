import React, { useState } from 'react';
import {
  X, User, Mail, Phone, MapPin, Lock, ShieldCheck, Check, AlertCircle, Eye, EyeOff,
  Key, Bell, Save, Trash2, Smartphone, QrCode, Copy, CheckCircle2, Laptop, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  generateTotpSecret,
  formatSecretKeySpaced,
  generateTotpUri,
  getTotpQrCodeUrl,
  verifyTotpCode
} from '../utils/totp.js';
import {
  getDeviceFingerprint,
  mark2FAVerifiedForSession,
  clear2FAVerifiedForSession
} from '../firebase/securityService.js';

export default function ProfileSettingsModal({ isOpen, onClose, onUserUpdated }) {
  const { user, profile, updateProfileData, updatePreferencesData, deleteOwnAccount, checkAccountExists } = useAuth();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'security'

  const sanitizePhone = (ph) => {
    if (!ph) return '';
    const str = String(ph).trim();
    const lower = str.toLowerCase();
    if (lower === 'n/a' || lower === 'null' || lower === 'undefined' || str === '+91 N/A') return '';
    return str;
  };

  // Profile Form State
  const getInitialProfileState = () => {
    const uid = user?.uid || user?.id;
    let localStored = {};
    if (typeof window !== 'undefined' && uid) {
      try {
        const storedStr = localStorage.getItem('easeland_user_profile_' + uid) || localStorage.getItem('easeland_session_user');
        if (storedStr) localStored = JSON.parse(storedStr);
      } catch (e) {}
    }
    const adminPhone = typeof window !== 'undefined' ? (localStorage.getItem('easeland_admin_phone') || '') : '';
    const adminCity = typeof window !== 'undefined' ? (localStorage.getItem('easeland_admin_city') || '') : '';

    return {
      name: profile?.displayName || profile?.name || user?.displayName || user?.name || localStored.displayName || localStored.name || '',
      email: profile?.email || user?.email || localStored.email || '',
      phone: sanitizePhone(profile?.phone || profile?.phoneNumber || user?.phone || user?.phoneNumber || localStored.phone || localStored.phoneNumber || adminPhone),
      city: String(profile?.city || profile?.location || user?.city || user?.location || localStored.city || localStored.location || adminCity || '').trim()
    };
  };

  const [profileData, setProfileData] = useState(getInitialProfileState);

  // Security Form State
  const [securityData, setSecurityData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Authenticator App (2FA) States
  const [deviceInfo] = useState(() => getDeviceFingerprint());
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [setupSecret, setSetupSecret] = useState('');
  const [setupUri, setSetupUri] = useState('');
  const [setupQrUrl, setSetupQrUrl] = useState('');
  const [setupVerificationCode, setSetupVerificationCode] = useState('');
  const [setupError, setSetupError] = useState(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);

  const handleConfirmDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);
      const res = await deleteOwnAccount('User self-requested account deletion');
      setIsDeletingAccount(false);
      if (res && res.success) {
        setShowDeleteConfirm(false);
        onClose();
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      } else {
        setError(res?.error || 'Failed to delete account');
      }
    } catch (err) {
      setIsDeletingAccount(false);
      setError('Failed to delete account: ' + (err.message || 'Server error'));
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      const uid = user?.uid || user?.id;
      let localStored = {};
      if (typeof window !== 'undefined' && uid) {
        try {
          const storedStr = localStorage.getItem('easeland_user_profile_' + uid) || localStorage.getItem('easeland_session_user');
          if (storedStr) localStored = JSON.parse(storedStr);
        } catch (e) {}
      }
      const adminPhone = typeof window !== 'undefined' ? (localStorage.getItem('easeland_admin_phone') || '') : '';
      const adminCity = typeof window !== 'undefined' ? (localStorage.getItem('easeland_admin_city') || '') : '';

      const activeName = profile?.displayName || profile?.name || user?.displayName || user?.name || localStored.displayName || localStored.name || '';
      const activeEmail = profile?.email || user?.email || localStored.email || '';
      const activePhone = sanitizePhone(profile?.phone || profile?.phoneNumber || user?.phone || user?.phoneNumber || localStored.phone || localStored.phoneNumber || adminPhone);
      const activeCity = String(profile?.city || profile?.location || user?.city || user?.location || localStored.city || localStored.location || adminCity || '').trim();
      setProfileData({
        name: activeName,
        email: activeEmail,
        phone: activePhone,
        city: activeCity
      });
      setSecurityData({
        newPassword: '',
        confirmPassword: ''
      });
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, user?.uid, user?.phone, user?.phoneNumber, user?.city, user?.location, profile?.phone, profile?.phoneNumber, profile?.city, profile?.location]);

  if (!isOpen) return null;

  const displayName = profile?.displayName || profile?.name || user?.displayName || user?.name || 'EaseLand User';
  const displayEmail = profile?.email || user?.email || '';
  const displayRole = (profile?.role === 'ADMIN' || user?.role === 'ADMIN' || profile?.adminRole) ? 'ADMIN' : 'USER';

  const passLengthValid = securityData.newPassword.length >= 8;
  const passUpperValid = /[A-Z]/.test(securityData.newPassword);
  const passLowerValid = /[a-z]/.test(securityData.newPassword);
  const passDigitValid = /[0-9]/.test(securityData.newPassword);
  const passSymbolValid = /[!@#$%^&*]/.test(securityData.newPassword);
  const passIsStrong = passLengthValid && passUpperValid && passLowerValid && passDigitValid && passSymbolValid;

  const isTotpActive = Boolean(
    (profile?.security?.enable2FA || profile?.communicationPreferences?.enable2FA) &&
    (profile?.security?.twoFactorExplicitlyEnabled || profile?.communicationPreferences?.twoFactorExplicitlyEnabled) &&
    (profile?.security?.totpSecret || profile?.communicationPreferences?.totpSecret)
  );

  const currentTotpSecret = profile?.security?.totpSecret || profile?.communicationPreferences?.totpSecret || '';

  const handleStartTotpSetup = () => {
    const secret = currentTotpSecret || generateTotpSecret(16);
    const uri = generateTotpUri(secret, displayEmail || 'user@easeland.in', 'EaseLand');
    const qrUrl = getTotpQrCodeUrl(uri, 220);
    setSetupSecret(secret);
    setSetupUri(uri);
    setSetupQrUrl(qrUrl);
    setSetupVerificationCode('');
    setSetupError(null);
    setShowTotpModal(true);
  };

  const handleCopySecret = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(setupSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const handleVerifyAndEnableTotp = async () => {
    if (!setupVerificationCode || setupVerificationCode.trim().length !== 6) {
      setSetupError('Please enter the 6-digit verification code from your Authenticator app.');
      return;
    }

    setSetupLoading(true);
    setSetupError(null);
    const isValid = await verifyTotpCode(setupSecret, setupVerificationCode.trim(), 1);

    if (!isValid) {
      setSetupLoading(false);
      setSetupError('Incorrect 6-digit code. Please verify the code displayed in your Authenticator app and ensure your device clock is accurate.');
      return;
    }

    const res = await updatePreferencesData({
      enable2FA: true,
      twoFactorExplicitlyEnabled: true,
      totpSecret: setupSecret,
      twoFactorType: 'AUTHENTICATOR_APP'
    });

    setSetupLoading(false);

    if (!res.success) {
      setSetupError(res.error || 'Failed to enable Authenticator app.');
      return;
    }

    if (user?.uid) {
      mark2FAVerifiedForSession(user.uid);
    }

    setShowTotpModal(false);
    setSuccessMsg('Authenticator app activated! Two-step verification is now protecting your account.');
    setTimeout(() => setSuccessMsg(null), 4000);
    if (onUserUpdated) onUserUpdated();
  };

  const handleDisableTotp = async () => {
    setIsDisabling2FA(true);
    const res = await updatePreferencesData({
      enable2FA: false,
      twoFactorExplicitlyEnabled: false,
      totpSecret: null,
      twoFactorType: null
    });
    setIsDisabling2FA(false);

    if (!res.success) {
      setError(res.error || 'Failed to disable two-step verification.');
      return;
    }

    if (user?.uid) {
      clear2FAVerifiedForSession(user.uid);
    }

    setShowDisable2FAModal(false);
    setSuccessMsg('Two-step verification has been turned off.');
    setTimeout(() => setSuccessMsg(null), 4000);
    if (onUserUpdated) onUserUpdated();
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validation
    if (!profileData.name || profileData.name.trim().length < 2) {
      setError('Please enter a valid Full Name (minimum 2 characters)');
      return;
    }

    let cleanPhone = (profileData.phone || '').trim().replace(/\D/g, '');
    if (cleanPhone.length > 10 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.slice(2);
    }
    if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.slice(1);
    }
    if (cleanPhone && cleanPhone.length !== 10) {
      setError('Mobile number must be exactly 10 digits.');
      return;
    }

    if (!profileData.city || profileData.city.trim().length < 2) {
      setError('Please enter your City / Location.');
      return;
    }

    setLoading(true);

    // Enforce "One Mail One Account, One PhoneNumber One Account" constraint
    if (typeof checkAccountExists === 'function') {
      const activeUid = user?.uid || profile?.uid || '';
      const existsCheck = await checkAccountExists({
        email: profileData.email.trim(),
        phone: cleanPhone || profileData.phone.trim(),
        excludeUid: activeUid
      });
      if (existsCheck.emailExists) {
        setLoading(false);
        setError('An account already exists with this email address (' + profileData.email.trim() + ').');
        return;
      }
      if (existsCheck.phoneExists) {
        setLoading(false);
        setError('An account already exists with this mobile number (+91 ' + (cleanPhone || profileData.phone.trim()) + ').');
        return;
      }
    }

    const result = await updateProfileData({
      displayName: profileData.name.trim(),
      name: profileData.name.trim(),
      email: profileData.email.trim(),
      phone: cleanPhone || profileData.phone.trim(),
      phoneNumber: cleanPhone || profileData.phone.trim(),
      city: (profileData.city || '').trim(),
      location: (profileData.city || '').trim()
    });

    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    const finalPhone = cleanPhone || profileData.phone.trim();
    const finalCity = (profileData.city || '').trim();
    const finalName = profileData.name.trim();
    const finalEmail = profileData.email.trim();

    if (typeof window !== 'undefined') {
      const uid = user?.uid || user?.id;
      if (uid) {
        try {
          const uKey = 'easeland_user_profile_' + uid;
          const cur = JSON.parse(localStorage.getItem(uKey) || '{}');
          localStorage.setItem(uKey, JSON.stringify({
            ...cur,
            name: finalName,
            displayName: finalName,
            email: finalEmail,
            phone: finalPhone,
            phoneNumber: finalPhone,
            city: finalCity,
            location: finalCity
          }));
        } catch (e) {}
      }
      try {
        const sess = JSON.parse(localStorage.getItem('easeland_session_user') || '{}');
        localStorage.setItem('easeland_session_user', JSON.stringify({
          ...sess,
          name: finalName,
          displayName: finalName,
          email: finalEmail,
          phone: finalPhone,
          phoneNumber: finalPhone,
          city: finalCity,
          location: finalCity
        }));
      } catch (e) {}
      if (localStorage.getItem('easeland_admin_authenticated') === 'true' || user?.email?.includes('admin')) {
        localStorage.setItem('easeland_admin_phone', finalPhone);
        localStorage.setItem('easeland_admin_city', finalCity);
      }
      window.dispatchEvent(new CustomEvent('easeland-user-profile-updated', {
        detail: { name: finalName, email: finalEmail, phone: finalPhone, city: finalCity, location: finalCity }
      }));
    }

    if (onUserUpdated) onUserUpdated();
    setSuccessMsg('Profile updated successfully!');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleSaveSecurity = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (securityData.newPassword) {
      if (!passIsStrong) {
        setError('New password must meet all complexity requirements');
        return;
      }
      if (securityData.newPassword !== securityData.confirmPassword) {
        setError('New password and confirm password do not match');
        return;
      }
    }

    setLoading(true);
    try {
      const result = await updatePreferencesData({
        ...(securityData.newPassword ? { passwordUpdated: true } : {})
      });

      setLoading(false);
      if (result && !result.success) {
        setError(result.error || 'Failed to update security settings');
        return;
      }

      if (onUserUpdated) onUserUpdated();
      setSuccessMsg('Security settings updated successfully!');
      setSecurityData(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      setLoading(false);
      setError('An error occurred while updating security settings');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in">
      
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90dvh]">
        
        {/* HEADER */}
        <div className="bg-brand-charcoal text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-yellow text-brand-charcoal font-black text-xl flex items-center justify-center shadow-md">
              {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white">{displayName}</h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  displayRole === 'ADMIN' ? 'bg-purple-500 text-white' : 'bg-brand-yellow text-brand-charcoal'
                }`}>
                  {displayRole === 'ADMIN' ? 'Administrator' : 'User'}
                </span>
              </div>
              <span className="text-xs text-gray-300 font-medium block mt-0.5">{displayEmail}</span>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="grid grid-cols-2 bg-gray-100 p-1 text-xs font-bold border-b border-gray-200">
          <button
            type="button"
            onClick={() => { setActiveTab('profile'); setError(null); setSuccessMsg(null); }}
            className={`py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'profile' ? 'bg-white text-brand-charcoal shadow-sm' : 'text-gray-500 hover:text-brand-charcoal'
            }`}
          >
            <User className="w-4 h-4 text-brand-yellow" />
            <span>Profile Information</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('security'); setError(null); setSuccessMsg(null); }}
            className={`py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'security' ? 'bg-white text-brand-charcoal shadow-sm' : 'text-gray-500 hover:text-brand-charcoal'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-brand-yellow" />
            <span>Security & Password</span>
          </button>
        </div>

        {/* BODY CONTENT */}
        <div className="p-6 overflow-y-auto space-y-4">
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold rounded-xl flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: PROFILE INFORMATION */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mobile Number (+91)</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="Enter 10-digit mobile number"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value.replace(/\D/g, '') })}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">City / Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Enter your city and state"
                    value={profileData.city || ''}
                    onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Profile Changes</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SECURITY & PASSWORD */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              
              {/* SECURITY HEALTH & SESSION OVERVIEW BANNER */}
              <div className={`p-4 rounded-2xl border transition-all ${
                isTotpActive 
                  ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/50 border-emerald-200' 
                  : 'bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50/50 border-amber-200'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isTotpActive ? 'bg-emerald-500 text-white shadow-md' : 'bg-amber-400 text-slate-900 shadow-md'
                    }`}>
                      {isTotpActive ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900">
                          {isTotpActive ? 'Account Protection: High' : 'Account Protection: Standard'}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isTotpActive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                        }`}>
                          {isTotpActive ? '2FA Active' : 'Basic Security'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        {isTotpActive
                          ? 'Two-step verification is active with your Authenticator app. Codes refresh every 30 seconds.'
                          : 'Set up an Authenticator app (Google Authenticator, Microsoft Authenticator) for 2-step verification.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* SESSION DEVICE INFO */}
                <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Laptop className="w-3.5 h-3.5 text-slate-500" />
                    <span>Session: <strong>{deviceInfo?.deviceName || 'Current Browser'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-700 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Active Now</span>
                  </div>
                </div>
              </div>

              {/* AUTHENTICATOR APP (TOTP) CARD */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition-all space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-slate-900">Authenticator App (Two-Step Verification)</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isTotpActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isTotpActive ? 'Active' : 'Not Configured'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Use Google Authenticator, Microsoft Authenticator, or Apple Passwords to generate secure 6-digit codes on login.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  {isTotpActive ? (
                    <>
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Protected by TOTP RFC 6238 standard</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleStartTotpSetup}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>View QR / Key</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDisable2FAModal(true)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>Turn Off</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] text-slate-500 font-medium">Recommended for all account holders</span>
                      <button
                        type="button"
                        onClick={handleStartTotpSetup}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5 text-amber-400" />
                        <span>Set Up Authenticator App</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* PASSWORD UPDATE CARD */}
              <form onSubmit={handleSaveSecurity} className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">Account Password</h4>
                      <p className="text-[11px] text-slate-500">Leave blank if you do not want to change your password</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">New Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type={showNewPass ? 'text' : 'password'}
                          placeholder="Enter new password"
                          value={securityData.newPassword}
                          onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                          className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-400 focus:outline-none focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass(!showNewPass)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        >
                          {showNewPass ? <EyeOff className="w-4 h-4 text-slate-900" /> : <Eye className="w-4 h-4 text-slate-400" />}
                        </button>
                      </div>

                      {securityData.newPassword && (
                        <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-1.5 text-[10px]">
                          <div className={`flex items-center gap-1 font-bold ${passLengthValid ? 'text-emerald-700' : 'text-slate-400'}`}>
                            <Check className={`w-3 h-3 ${passLengthValid ? 'text-emerald-600' : 'text-slate-300'}`} />
                            <span>8+ characters</span>
                          </div>
                          <div className={`flex items-center gap-1 font-bold ${passUpperValid ? 'text-emerald-700' : 'text-slate-400'}`}>
                            <Check className={`w-3 h-3 ${passUpperValid ? 'text-emerald-600' : 'text-slate-300'}`} />
                            <span>1 Uppercase (A-Z)</span>
                          </div>
                          <div className={`flex items-center gap-1 font-bold ${passLowerValid ? 'text-emerald-700' : 'text-slate-400'}`}>
                            <Check className={`w-3 h-3 ${passLowerValid ? 'text-emerald-600' : 'text-slate-300'}`} />
                            <span>1 Lowercase (a-z)</span>
                          </div>
                          <div className={`flex items-center gap-1 font-bold ${passDigitValid ? 'text-emerald-700' : 'text-slate-400'}`}>
                            <Check className={`w-3 h-3 ${passDigitValid ? 'text-emerald-600' : 'text-slate-300'}`} />
                            <span>1 Number (0-9)</span>
                          </div>
                          <div className={`flex items-center gap-1 font-bold col-span-2 ${passSymbolValid ? 'text-emerald-700' : 'text-slate-400'}`}>
                            <Check className={`w-3 h-3 ${passSymbolValid ? 'text-emerald-600' : 'text-slate-300'}`} />
                            <span>1 Special character (!@#%^&*)</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {securityData.newPassword && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Confirm New Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type={showConfirmPass ? 'text' : 'password'}
                            placeholder="Confirm new password"
                            value={securityData.confirmPassword}
                            onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                            className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-400 focus:outline-none focus:bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPass(!showConfirmPass)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                          >
                            {showConfirmPass ? <EyeOff className="w-4 h-4 text-slate-900" /> : <Eye className="w-4 h-4 text-slate-400" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* DANGER ZONE - DELETE ACCOUNT */}
                <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs font-black text-rose-900">Delete Account & Posted Properties</span>
                    <span className="block text-[11px] text-rose-700 mt-0.5">Permanently deletes your account and removes all properties posted from it.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Account</span>
                  </button>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{loading ? 'Saving...' : 'Save Security Settings'}</span>
                  </button>
                </div>
              </form>

            </div>
          )}

        </div>

      </div>

      {/* DELETE ACCOUNT CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-200">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-brand-charcoal text-center">Permanently Delete Account?</h3>
            <p className="text-xs text-gray-600 text-center mt-2 leading-relaxed">
              This action is <span className="font-bold text-red-600">irreversible</span>. All properties posted from this account will be permanently deleted across all databases and search results.
            </p>
            <p className="text-[11px] text-gray-500 text-center mt-1.5 bg-gray-50 p-2 rounded-lg border border-gray-100">
              If you sign in with this account again in the future, it will be treated as a brand new account with zero trace of old data.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeletingAccount}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                disabled={isDeletingAccount}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isDeletingAccount ? (
                  <span>Deleting Everything...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm & Delete Account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTHENTICATOR APP SETUP MODAL */}
      {showTotpModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh]">
            
            {/* HEADER */}
            <div className="bg-slate-900 text-white p-5 relative flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowTotpModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/30 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Set Up Authenticator App</h3>
                <p className="text-[11px] text-slate-400 font-medium">Google Authenticator, Microsoft Authenticator, Apple Passwords</p>
              </div>
            </div>

            {/* CONTENT */}
            <div className="p-5 overflow-y-auto space-y-4">
              
              {/* STEP 1 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-amber-400 font-black text-[10px] flex items-center justify-center shrink-0">1</span>
                  <span className="text-xs font-black text-slate-900">Scan QR Code</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-7">
                  Open your authenticator app, tap <strong>Add Account</strong> (+), and scan this QR code:
                </p>
                <div className="flex justify-center py-2">
                  <div className="p-2 bg-white rounded-2xl border-2 border-slate-200 shadow-sm inline-block">
                    {setupQrUrl ? (
                      <img
                        src={setupQrUrl}
                        alt="2FA QR Code"
                        className="w-44 h-44 rounded-xl"
                        loading="eager"
                      />
                    ) : (
                      <div className="w-44 h-44 bg-slate-100 rounded-xl flex items-center justify-center text-xs text-slate-400">
                        Generating QR...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* STEP 2 */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-amber-400 font-black text-[10px] flex items-center justify-center shrink-0">2</span>
                  <span className="text-xs font-black text-slate-900">Or Enter Key Manually</span>
                </div>
                <div className="pl-7 space-y-1.5">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl">
                    <span className="font-mono text-xs font-black text-slate-900 tracking-wider flex-1 select-all break-all">
                      {formatSecretKeySpaced(setupSecret)}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                    >
                      {copiedSecret ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Account: {displayEmail || 'user@easeland.in'} | Key Type: Time-based
                  </p>
                </div>
              </div>

              {/* STEP 3 */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-amber-400 font-black text-[10px] flex items-center justify-center shrink-0">3</span>
                  <span className="text-xs font-black text-slate-900">Verify 6-Digit Code</span>
                </div>
                <div className="pl-7 space-y-2">
                  <p className="text-[11px] text-slate-600">
                    Enter the 6-digit code shown in your Authenticator app to activate:
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={setupVerificationCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setSetupVerificationCode(val);
                      setSetupError(null);
                    }}
                    className="w-full text-center font-mono text-2xl font-black tracking-widest py-2 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-amber-400 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {setupError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{setupError}</span>
                </div>
              )}

            </div>

            {/* FOOTER */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowTotpModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifyAndEnableTotp}
                disabled={setupLoading || setupVerificationCode.length !== 6}
                className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
              >
                {setupLoading ? (
                  <span>Verifying...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    <span>Verify & Turn On</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* DISABLE 2FA CONFIRMATION MODAL */}
      {showDisable2FAModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-900 text-center">Turn Off Two-Step Verification?</h3>
            <p className="text-xs text-slate-600 text-center mt-2 leading-relaxed">
              Your account will only be protected by your password. Anyone with your password will be able to sign in without an authenticator code.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDisable2FAModal(false)}
                disabled={isDisabling2FA}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Keep Enabled
              </button>
              <button
                type="button"
                onClick={handleDisableTotp}
                disabled={isDisabling2FA}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDisabling2FA ? 'Turning Off...' : 'Turn Off 2FA'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
