import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Lock, RefreshCw, X, AlertCircle, CheckCircle2, ArrowRight, Mail } from 'lucide-react';
import { verify2FAOtp, generate2FAOtp, send2FAEmailOtp } from '../firebase/securityService.js';

export default function TwoFactorModal({ isOpen, onClose, onVerifySuccess, userEmail = '', userPhone = '' }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(30);
  
  const inputRefs = [
    useRef(null), useRef(null), useRef(null),
    useRef(null), useRef(null), useRef(null)
  ];

  // Initialize 2FA Code on open & dispatch email
  useEffect(() => {
    if (!isOpen) return;

    // Reset inputs & status states for fresh 2FA attempt
    setDigits(['', '', '', '', '', '']);
    setError(null);
    setSuccess(false);
    setLoading(false);
    setResendCountdown(30);

    const identifier = userEmail || userPhone || 'session';
    const { code } = generate2FAOtp(identifier);
    if (userEmail) {
      send2FAEmailOtp(userEmail, code);
    }
    
    // Timer countdown
    const interval = setInterval(() => {
      setResendCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    // Auto-focus first input box
    setTimeout(() => inputRefs[0]?.current?.focus(), 150);

    return () => clearInterval(interval);
  }, [isOpen, userEmail, userPhone]);

  if (!isOpen) return null;

  const handleDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError(null);

    // Auto-advance to next input field
    if (value && index < 5) {
      inputRefs[index + 1]?.current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1]?.current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      const pasteDigits = pasted.split('');
      setDigits(pasteDigits);
      inputRefs[5]?.current?.focus();
    }
  };

  const handleResendOtp = () => {
    if (resendCountdown > 0) return;
    const identifier = userEmail || userPhone || 'session';
    const { code } = generate2FAOtp(identifier);
    if (userEmail) {
      send2FAEmailOtp(userEmail, code);
    }
    setResendCountdown(30);
    setError(null);
    setDigits(['', '', '', '', '', '']);
    inputRefs[0]?.current?.focus();
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    setError(null);

    const fullCode = digits.join('');
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setLoading(true);
    const identifier = userEmail || userPhone || 'session';
    const result = verify2FAOtp(identifier, fullCode);

    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      onVerifySuccess();
    }, 600);
  };

  const maskedTarget = userEmail
    ? userEmail.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '***' + c)
    : userPhone
    ? userPhone.replace(/^(\+91\s?\d{2})\d{6}(\d{2})$/, '$1******$2')
    : 'your registered account';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="bg-slate-900 text-white p-6 relative flex items-center gap-4">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-400 border border-amber-400/30 flex items-center justify-center font-black text-xl shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-black tracking-tight text-white">Two-Factor Authentication</h3>
            <p className="text-xs text-slate-400 font-medium">Verify login security identity</p>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-6">
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-slate-600">
              Enter the 6-digit verification code sent to
            </p>
            <strong className="text-xs font-black text-slate-900 block bg-slate-100 py-1.5 px-3 rounded-lg border border-slate-200">
              {maskedTarget}
            </strong>
          </div>

          {/* EMAIL DISPATCH CONFIRMATION BOX */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-emerald-800 text-xs font-bold">
              <Mail className="w-4 h-4 text-emerald-600" />
              <span>OTP Sent to Your Email</span>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium leading-relaxed">
              Check your inbox for <strong>{maskedTarget}</strong> and enter the 6-digit verification code below.
            </p>
          </div>

          {/* OTP PIN INPUT BOXES */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-center gap-2" onPaste={handlePaste}>
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={inputRefs[idx]}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className={`w-11 h-13 text-center font-mono text-xl font-black rounded-xl border-2 transition-all outline-none ${
                    digit
                      ? 'border-amber-400 bg-amber-50/30 text-slate-950 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20'
                  }`}
                />
              ))}
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-extrabold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-extrabold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Security Code Verified! Logging in...</span>
              </div>
            )}

            {/* RESEND LINK */}
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Didn't receive the code?</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCountdown > 0}
                className={`font-black flex items-center gap-1 ${
                  resendCountdown > 0
                    ? 'text-slate-400 cursor-not-allowed'
                    : 'text-amber-600 hover:text-amber-700 cursor-pointer underline'
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${resendCountdown > 0 ? 'animate-spin' : ''}`} />
                <span>{resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend Code'}</span>
              </button>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || digits.join('').length !== 6}
                className="w-1/2 py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

        </div>

      </div>
    </div>
  );
}
