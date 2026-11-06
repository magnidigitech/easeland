import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Mail,
  Phone,
  User,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Smartphone,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TwoFactorModal from './TwoFactorModal';
import { trackRegistrationComplete } from '../utils/metaPixel.js';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialIntent = null }) {
  const {
    loginUser,
    registerUser,
    loginWithGoogle,
    sendPasswordReset,
    sendMobileOtp,
    loginWithMobile,
    updateProfileData,
    checkAccountExists
  } = useAuth();

  // Top-level Auth Method: 'mobile' (Default) or 'email'
  const [authMethod, setAuthMethod] = useState('mobile');

  // Mobile OTP States
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [testOtpCode, setTestOtpCode] = useState(null);

  // Email Auth States
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pending2FAData, setPending2FAData] = useState(null);
  const [mode, setMode] = useState('login'); // 'login', 'register', 'forgot'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Email Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Countdown timer for Mobile OTP Resend
  useEffect(() => {
    let interval = null;
    if (isOtpSent && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOtpSent, otpTimer]);

  if (!isOpen) return null;

  // Live Password Validation Checks
  const passLengthValid = formData.password.length >= 8;
  const passUpperValid = /[A-Z]/.test(formData.password);
  const passLowerValid = /[a-z]/.test(formData.password);
  const passDigitValid = /[0-9]/.test(formData.password);
  const passSymbolValid = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(formData.password);

  const isPasswordSecure =
    passLengthValid && passUpperValid && passLowerValid && passDigitValid && passSymbolValid;

  // Mobile OTP: Request Code
  const handleSendMobileOtp = async () => {
    if (mode === 'register') {
      if (!formData.name || formData.name.trim().length < 2) {
        setError('Please enter your full name (minimum 2 characters).');
        return;
      }
    }

    const cleanPhone = mobileNumber.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    // Enforce "One PhoneNumber One Account" constraint
    if (mode === 'register') {
      const existsCheck = await checkAccountExists({ phone: cleanPhone });
      if (existsCheck.phoneExists) {
        setLoading(false);
        setError('An account already exists with this mobile number (+91 ' + cleanPhone + '). Please switch to the Log In tab.');
        return;
      }
    } else if (mode === 'login') {
      const existsCheck = await checkAccountExists({ phone: cleanPhone });
      if (!existsCheck.phoneExists) {
        setLoading(false);
        setError('No account found with mobile number +91 ' + cleanPhone + '. Please switch to the Register tab.');
        return;
      }
    }

    try {
      const res = await sendMobileOtp(cleanPhone);
      setLoading(false);
      if (res && res.success) {
        setIsOtpSent(true);
        setTestOtpCode(res.otpCode);
        setOtpTimer(30);
        setSuccessMessage('OTP code sent successfully to +91 ' + cleanPhone);
      } else {
        setError(res?.error || 'Failed to send OTP code. Please try again.');
      }
    } catch (err) {
      setLoading(false);
      setError(err?.message || 'Failed to connect to authentication server.');
    }
  };

  // Mobile OTP: Verify and Login/Register
  const handleVerifyMobileOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanPhone = mobileNumber.replace(/\D/g, '').slice(-10);
    const cleanCode = otpCode.trim();

    if (!cleanCode || cleanCode.length < 4) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    // Safety re-check in register mode
    if (mode === 'register') {
      const existsCheck = await checkAccountExists({ phone: cleanPhone });
      if (existsCheck.phoneExists) {
        setLoading(false);
        setError('An account already exists with this mobile number (+91 ' + cleanPhone + '). Please switch to the Log In tab.');
        return;
      }
    }

    try {
      const res = await loginWithMobile(cleanPhone, cleanCode);
      setLoading(false);
      if (res && res.success) {
        if (mode === 'register' && formData.name?.trim()) {
          try {
            await updateProfileData({
              displayName: formData.name.trim(),
              name: formData.name.trim()
            });
          } catch (e) {}
        }
        if (res.isNewUser) {
          trackRegistrationComplete('mobile_otp');
        }
        if (onAuthSuccess) onAuthSuccess(res.user, initialIntent);
        onClose();
      } else {
        setError(res?.error || 'Invalid or expired OTP code. Please try again.');
      }
    } catch (err) {
      setLoading(false);
      setError(err?.message || 'Authentication error while verifying OTP.');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loginWithGoogle();
      setLoading(false);
      if (res.success) {
        if (res.requires2FA) {
          onClose();
          return;
        }
        if (onAuthSuccess) onAuthSuccess(res.user, initialIntent);
        onClose();
      } else {
        setError(res.error || 'Google sign-in was not completed.');
      }
    } catch (err) {
      setLoading(false);
      setError(err?.message || 'Google sign-in error.');
    }
  };

  const handleMobileFormSubmit = (e) => {
    e.preventDefault();
    if (!isOtpSent) {
      handleSendMobileOtp();
    } else {
      handleVerifyMobileOtp(e);
    }
  };

  const validateForm = () => {
    setError(null);
    setSuccessMessage(null);

    if (mode === 'forgot') {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
        setError('Please enter a valid email address.');
        return false;
      }
      return true;
    }

    if (mode === 'register') {
      if (!formData.name || formData.name.trim().length < 2) {
        setError('Please enter your full name (minimum 2 characters)');
        return false;
      }
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return false;
    }

    if (mode === 'register') {
      const cleanPhone = formData.phone.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        setError('Mobile number must be exactly 10 digits.');
        return false;
      }
    }

    if (mode === 'register') {
      if (!isPasswordSecure) {
        setError('Password must meet all security requirements.');
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Password and Confirm Password do not match.');
        return false;
      }
    }

    if (!formData.password) {
      setError('Please enter your password.');
      return false;
    }

    return true;
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (mode === 'forgot') {
      const result = await sendPasswordReset(formData.email.trim());
      setLoading(false);
      if (result.success) {
        setSuccessMessage('Password reset link sent to your email! Please check your inbox.');
      } else {
        setError(result.error);
      }
      return;
    }

    if (mode === 'register') {
      const cleanPhone = formData.phone.replace(/\D/g, '').slice(-10);
      const cleanEmail = formData.email.trim();

      const existsCheck = await checkAccountExists({ email: cleanEmail, phone: cleanPhone });
      if (existsCheck.emailExists) {
        setLoading(false);
        setError('An account already exists with this email address (' + cleanEmail + '). Please log in instead.');
        return;
      }
      if (existsCheck.phoneExists) {
        setLoading(false);
        setError('An account already exists with this mobile number (+91 ' + cleanPhone + '). Please log in instead.');
        return;
      }

      const result = await registerUser(
        cleanEmail,
        formData.password,
        formData.name.trim(),
        cleanPhone
      );

      setLoading(false);
      if (!result.success) {
        setError(result.error);
        return;
      }

      trackRegistrationComplete('email');
      if (onAuthSuccess) onAuthSuccess(result.user, initialIntent);
      onClose();
    } else {
      const result = await loginUser(formData.email.trim(), formData.password);
      setLoading(false);
      if (!result.success) {
        setError(result.error);
        return;
      }

      if (result.requires2FA) {
        onClose();
        return;
      }

      if (onAuthSuccess) onAuthSuccess(result.user, initialIntent);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in">
      <div
        className={`bg-white w-full ${
          authMethod === 'email' && mode === 'register' ? 'max-w-lg' : 'max-w-md'
        } rounded-t-3xl sm:rounded-2xl shadow-2xl border border-brand-bordergray overflow-hidden transition-all duration-200 max-h-[92dvh] sm:max-h-[90vh] flex flex-col`}
      >
        {/* MODAL HEADER */}
        <div className="bg-brand-charcoal text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <img
              src="/easeland_emblem.svg"
              alt="EaseLand Logo"
              className="h-9 w-auto object-contain"
            />
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white font-sans">
                Ease<span className="text-brand-yellow">Land</span>
              </span>
              <span className="block text-[9px] uppercase tracking-widest text-gray-400 font-semibold">
                Direct Property Platform
              </span>
            </div>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-white">
            {mode === 'forgot'
              ? 'Reset Your Password'
              : mode === 'register'
              ? 'Create Your EaseLand Account'
              : 'Log In to EaseLand'}
          </h3>
          <p className="text-xs text-gray-300 mt-0.5 font-medium">
            {initialIntent === 'post-property'
              ? 'Please log in or sign up to post and manage your property listing.'
              : mode === 'register'
              ? 'Join thousands of buyers, sellers, and agents across India.'
              : 'Welcome back! Access your properties, wishlist, and leads.'}
          </p>
        </div>

        {/* PRIMARY TOP TABS: ONLY 2 TABS - LOG IN & REGISTER */}
        <div className="grid grid-cols-2 border-b border-gray-200 bg-slate-100 p-1.5 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setSuccessMessage(null);
            }}
            className={`py-2.5 px-3 rounded-xl font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mode === 'login' || mode === 'forgot'
                ? 'bg-brand-charcoal text-amber-400 shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Log In</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
              setSuccessMessage(null);
            }}
            className={`py-2.5 px-3 rounded-xl font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-brand-charcoal text-amber-400 shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Register</span>
          </button>
        </div>

        {/* TAB BODY */}
        {mode === 'forgot' ? (
          <form onSubmit={handleEmailSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto no-scrollbar flex-1">
            <div className="flex items-center gap-2 mb-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Log In</span>
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Registered Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="Enter your registered email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5 font-medium">
                We will send you an email with a secure link to reset your account password.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-black text-sm py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Sending Reset Link...</span>
                </>
              ) : (
                <>
                  <span>Send Password Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto no-scrollbar flex-1 flex flex-col justify-between">
            <div>
              {/* SUB-METHOD TOGGLE: MOBILE OTP vs EMAIL & PASSWORD */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('mobile');
                    setIsOtpSent(false);
                    setOtpCode('');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authMethod === 'mobile'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-amber-500" />
                  <span>Mobile OTP</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('email');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authMethod === 'email'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span>Email & Password</span>
                </button>
              </div>

              {/* ALERTS */}
              {error && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMessage && (
                <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* 1. MOBILE OTP FORM */}
              {authMethod === 'mobile' ? (
                <form onSubmit={handleMobileFormSubmit} className="space-y-3.5">
                  {!isOtpSent ? (
                    <>
                      {mode === 'register' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Full Name
                          </label>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              required
                              placeholder="Enter your full name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                              autoFocus
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Mobile Number (10 Digits)
                        </label>
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-xs font-black text-slate-800 select-none shrink-0">
                            <span className="text-sm">🇮🇳</span>
                            <span>+91</span>
                          </div>
                          <div className="relative flex-1">
                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="tel"
                              required
                              maxLength={10}
                              placeholder="Enter 10-digit mobile number"
                              value={mobileNumber}
                              onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                              className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none tracking-wider"
                              autoFocus={mode === 'login'}
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1.5 font-medium">
                          {mode === 'register'
                            ? "We will send a 6-digit OTP code to verify your phone number and create your account."
                            : "We will send a 6-digit OTP code to instantly log into your account."}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700">Enter Verification Code (OTP)</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsOtpSent(false);
                            setOtpCode('');
                            setError(null);
                          }}
                          className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                        >
                          Change Number
                        </button>
                      </div>

                      <div className="text-xs text-gray-600 mb-2.5 bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between">
                        <span>
                          Sent to: <strong>+91 {mobileNumber}</strong>
                        </span>
                        {testOtpCode && (
                          <span className="text-[10px] bg-amber-200 text-amber-950 font-black px-2 py-0.5 rounded-md">
                            Dev OTP: {testOtpCode}
                          </span>
                        )}
                      </div>

                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="Enter 6-digit OTP"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-center tracking-[0.4em] py-3 bg-gray-50 border-2 border-amber-400 rounded-xl text-lg font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                        autoFocus
                      />

                      <div className="flex items-center justify-between mt-2.5 text-xs text-gray-500">
                        <span>Did not receive code?</span>
                        {otpTimer > 0 ? (
                          <span className="font-semibold text-gray-400">Resend in {otpTimer}s</span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSendMobileOtp}
                            className="font-extrabold text-amber-600 hover:text-amber-800 underline flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" /> Resend OTP
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-black text-sm py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all mt-1 cursor-pointer disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Processing...</span>
                      </>
                    ) : !isOtpSent ? (
                      <>
                        <span>Send OTP Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>{mode === 'register' ? 'Verify & Create Account' : 'Verify OTP & Log In'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* 2. EMAIL & PASSWORD FORM */
                <form onSubmit={handleEmailSubmit} className="space-y-3">
                  {mode === 'register' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* FULL NAME */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            required
                            placeholder="Enter full name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                            autoFocus
                          />
                        </div>
                      </div>

                      {/* MOBILE NUMBER */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Mobile Number (10 Digits)
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="tel"
                            required
                            maxLength={10}
                            placeholder="10-digit mobile number"
                            value={formData.phone}
                            onChange={(e) =>
                              setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })
                            }
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* EMAIL */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="email"
                            required
                            placeholder="Enter email address"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* PASSWORD */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            placeholder="Create password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                            title={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5 text-slate-700" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                          </button>
                        </div>
                      </div>

                      {/* CONFIRM PASSWORD */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            required
                            placeholder="Confirm password"
                            value={formData.confirmPassword || ''}
                            onChange={(e) =>
                              setFormData({ ...formData, confirmPassword: e.target.value })
                            }
                            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                            title={showConfirmPassword ? 'Hide password' : 'Show password'}
                          >
                            {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5 text-slate-700" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* LOGIN MODE INPUTS */
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="email"
                            required
                            placeholder="Enter your email address"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                            autoFocus
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-slate-700">Password</label>
                          <button
                            type="button"
                            onClick={() => {
                              setMode('forgot');
                              setError(null);
                              setSuccessMessage(null);
                            }}
                            className="text-[11px] font-bold text-amber-600 hover:text-amber-800 underline cursor-pointer"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            placeholder="Enter account password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                            title={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4 text-slate-700" /> : <Eye className="w-4 h-4 text-slate-400 hover:text-slate-600" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PASSWORD REQUIREMENTS CHECKLIST */}
                  {mode === 'register' && (
                    <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1 text-[11px]">
                      <span className="font-extrabold text-gray-500 block uppercase tracking-wider text-[10px]">
                        Password Requirements:
                      </span>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                        <div className={`flex items-center gap-1.5 font-bold ${passLengthValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                          <Check className={`w-3 h-3 ${passLengthValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                          <span>8+ Characters</span>
                        </div>
                        <div className={`flex items-center gap-1.5 font-bold ${passUpperValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                          <Check className={`w-3 h-3 ${passUpperValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                          <span>1 Capital (A-Z)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 font-bold ${passLowerValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                          <Check className={`w-3 h-3 ${passLowerValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                          <span>1 Small (a-z)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 font-bold ${passDigitValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                          <Check className={`w-3 h-3 ${passDigitValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                          <span>1 Digit (0-9)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 font-bold col-span-2 ${passSymbolValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                          <Check className={`w-3 h-3 ${passSymbolValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                          <span>1 Special Symbol (!@#...)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-black text-sm py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all mt-1 cursor-pointer disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <span>{mode === 'login' ? 'Log In to EaseLand' : 'Create Account & Continue'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* DIVIDER: OR CONTINUE WITH */}
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-gray-500 font-semibold">or continue with</span>
                </div>
              </div>

              {/* GOOGLE CONTINUATION BUTTON */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-white hover:bg-gray-50 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl border border-gray-300 shadow-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer hover:border-gray-400 disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>

            {/* BOTTOM SWITCHER */}
            <div className="text-xs text-gray-500 font-medium text-center pt-3 mt-1 border-t border-gray-100">
              {mode === 'login' ? (
                <span>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="font-extrabold text-amber-600 hover:text-amber-800 underline cursor-pointer ml-1"
                  >
                    Register New Account
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="font-extrabold text-amber-600 hover:text-amber-800 underline cursor-pointer ml-1"
                  >
                    Log In
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {show2FAModal && (
        <TwoFactorModal
          isOpen={show2FAModal}
          onClose={() => setShow2FAModal(false)}
          userEmail={pending2FAData?.email || formData.email}
          userPhone={pending2FAData?.phone || ''}
          onVerifySuccess={() => {
            setShow2FAModal(false);
            if (onAuthSuccess) onAuthSuccess(pending2FAData?.user, initialIntent);
            onClose();
          }}
        />
      )}
    </div>
  );
}
