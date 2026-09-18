import React, { useState } from 'react';
import { X, Lock, Mail, Phone, User, ArrowRight, ShieldCheck, Check, AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialIntent = null }) {
  if (!isOpen) return null;

  const { loginUser, registerUser, loginWithGoogle, sendPasswordReset } = useAuth();

  const [mode, setMode] = useState('login'); // 'login', 'register', 'forgot'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Live Password Validation Checks
  const passLengthValid = formData.password.length >= 8;
  const passUpperValid = /[A-Z]/.test(formData.password);
  const passLowerValid = /[a-z]/.test(formData.password);
  const passDigitValid = /[0-9]/.test(formData.password);
  const passSymbolValid = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(formData.password);

  const isPasswordSecure = passLengthValid && passUpperValid && passLowerValid && passDigitValid && passSymbolValid;

  const validateForm = () => {
    setError(null);
    setSuccessMessage(null);

    // Forgot password validation
    if (mode === 'forgot') {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
        setError('Please enter a valid email address.');
        return false;
      }
      return true;
    }

    // Name check
    if (mode === 'register') {
      if (!formData.name || formData.name.trim().length < 2) {
        setError('Please enter your full name (minimum 2 characters)');
        return false;
      }
    }

    // Email check
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address (e.g. name@domain.com)');
      return false;
    }

    // Phone check
    if (mode === 'register') {
      const cleanPhone = formData.phone.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        setError('Mobile number must be exactly 10 digits.');
        return false;
      }
    }

    // Password check
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

  const handleSubmit = async (e) => {
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
      const result = await registerUser(
        formData.email.trim(),
        formData.password,
        formData.name.trim(),
        formData.phone.replace(/\D/g, '')
      );

      setLoading(false);
      if (!result.success) {
        setError(result.error);
        return;
      }

      if (onAuthSuccess) onAuthSuccess(result.user, initialIntent);
      onClose();
    } else {
      const result = await loginUser(formData.email.trim(), formData.password);
      setLoading(false);
      if (!result.success) {
        setError(result.error);
        return;
      }

      if (onAuthSuccess) onAuthSuccess(result.user, initialIntent);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-charcoal/80 backdrop-blur-sm animate-in fade-in">
      
      <div className={`bg-white w-full ${mode === 'register' ? 'max-w-lg' : 'max-w-md'} rounded-2xl shadow-2xl border border-brand-bordergray overflow-hidden transition-all duration-200`}>
        
        {/* MODAL HEADER */}
        <div className="bg-brand-charcoal text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <img
              src="/easeland_emblem_transparent.png"
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
            {mode === 'login' ? 'Log In to EaseLand' : 'Create Your EaseLand Account'}
          </h3>
          <p className="text-xs text-gray-300 mt-0.5 font-medium">
            {initialIntent === 'post-property'
              ? 'Please log in or create an account to post your property on EaseLand.'
              : 'One unified account to explore, buy, rent, and list properties across India.'}
          </p>
        </div>

        {/* MODE TABS */}
        <div className="grid grid-cols-2 bg-slate-100 p-1 text-xs font-bold border-b border-slate-200">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`py-2 rounded-lg transition-all font-extrabold ${
              mode === 'login' ? 'bg-slate-900 text-amber-400 shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Log In
          </button>
          
          <button
            type="button"
            onClick={() => { setMode('register'); setError(null); }}
            className={`py-2 rounded-lg transition-all font-extrabold ${
              mode === 'register' ? 'bg-slate-900 text-amber-400 shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Register New Account
          </button>
        </div>

        {/* AUTH FORM */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-3.5">
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* INPUTS CONTAINER */}
          {mode === 'register' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* FULL NAME */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Suresh Kumar"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* MOBILE NUMBER */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number (10 Digits)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
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
                    placeholder="name@domain.com"
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
                    placeholder="Enter password (min 8 chars)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-9 pr-9 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors"
                    title={showPassword ? "Hide password text" : "Show password text"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-slate-700" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                    )}
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
                    placeholder="Re-enter password"
                    value={formData.confirmPassword || ''}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full pl-9 pr-9 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors"
                    title={showConfirmPassword ? "Hide password text" : "Show password text"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4 text-slate-700" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* LOGIN MODE INPUTS */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="name@domain.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
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
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors"
                    title={showPassword ? "Hide password text" : "Show password text"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-slate-700" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* LIVE PASSWORD REQUIREMENTS CHECKLIST (Registration Mode) */}
          {mode === 'register' && (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5 text-[11px]">
              <span className="font-extrabold text-gray-500 block uppercase tracking-wider text-[10px]">Password Requirements:</span>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <div className={`flex items-center gap-1.5 font-bold ${passLengthValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                  <Check className={`w-3.5 h-3.5 ${passLengthValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                  <span>8+ Characters</span>
                </div>
                <div className={`flex items-center gap-1.5 font-bold ${passUpperValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                  <Check className={`w-3.5 h-3.5 ${passUpperValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                  <span>1 Capital (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 font-bold ${passLowerValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                  <Check className={`w-3.5 h-3.5 ${passLowerValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                  <span>1 Small (a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 font-bold ${passDigitValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                  <Check className={`w-3.5 h-3.5 ${passDigitValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                  <span>1 Digit (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 font-bold col-span-2 ${passSymbolValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                  <Check className={`w-3.5 h-3.5 ${passSymbolValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                  <span>1 Special Symbol (!@#$%^&*)</span>
                </div>
              </div>
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            className="w-full bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-sm py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all mt-1"
          >
            <span>{mode === 'login' ? 'Log In to EaseLand' : 'Create Account & Continue'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* GOOGLE OAUTH CONTINUATION BUTTON */}
          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              setError(null);
              const res = await loginWithGoogle();
              setLoading(false);
              if (res.success) {
                if (onAuthSuccess) onAuthSuccess(res.user, initialIntent);
                onClose();
              } else {
                setError(res.error);
              }
            }}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs py-2.5 rounded-xl border border-gray-300 shadow-sm flex items-center justify-center gap-2 transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="text-[11px] text-gray-500 font-medium text-center pt-1">
            {mode === 'login' ? (
              <span>New to EaseLand? Click <strong>Register New Account</strong> above.</span>
            ) : (
              <span>Already registered? Click <strong>Log In</strong> above.</span>
            )}
          </div>

        </form>

      </div>

    </div>
  );
}
