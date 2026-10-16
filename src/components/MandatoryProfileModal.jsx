import React, { useState } from 'react';
import { ShieldCheck, User, Mail, MapPin, Phone, ArrowRight, CheckCircle2, AlertCircle, Loader2, Sparkles, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { trackRegistrationComplete } from '../utils/metaPixel.js';

export default function MandatoryProfileModal({ isOpen, onComplete }) {
  const { user, profile, completeUserProfile, logoutUser } = useAuth();

  const [name, setName] = useState(profile?.name || user?.name || '');
  const [email, setEmail] = useState(profile?.email || user?.email || '');
  const [city, setCity] = useState(profile?.city || user?.city || '');
  const [userType, setUserType] = useState(profile?.userType || 'BUYER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const verifiedPhone = user?.phone || user?.phoneNumber || profile?.phone || profile?.phoneNumber || 'Mobile Number';

  const roleOptions = [
    { id: 'BUYER', title: 'Buyer / Tenant', desc: 'Looking for verified plots, lands, or homes' },
    { id: 'SELLER', title: 'Property Owner', desc: 'Listing land, plots, or houses for sale/rent' },
    { id: 'AGENT', title: 'Real Estate Agent', desc: 'Verified realtor representing clients' },
    { id: 'INVESTOR', title: 'Plot Investor', desc: 'Commercial ventures & development layouts' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCity = city.trim();

    if (!cleanName || cleanName.length < 2) {
      setError('Please enter your full legal name (minimum 2 characters).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!cleanCity || cleanCity.length < 2) {
      setError('Please enter your city and state.');
      return;
    }

    setLoading(true);
    try {
      const res = await completeUserProfile({
        name: cleanName,
        email: cleanEmail,
        city: cleanCity,
        userType
      });

      if (res.success) {
        trackRegistrationComplete('profile_completed');
        if (typeof onComplete === 'function') {
          onComplete(res.user);
        }
      } else {
        setError(res.error || 'Failed to save details. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'System error while saving details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl border border-amber-300/50 my-8 animate-in zoom-in-95 duration-200">
        
        {/* HEADER BADGE */}
        <div className="flex items-center gap-3 pb-5 border-b border-gray-100">
          <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-md font-black shrink-0">
            <ShieldCheck className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Action Required
              </span>
              <span className="text-[11px] font-bold text-gray-400">Step 2 of 2</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">
              Complete Your Account Details
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Please enter your details to unlock and access your account.
            </p>
          </div>
        </div>

        {/* VERIFIED PHONE BADGE */}
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-950">
              Verified Mobile: <strong className="font-extrabold text-emerald-900">{verifiedPhone}</strong>
            </span>
          </div>
          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> OTP Verified
          </span>
        </div>

        {/* ERROR NOTIFICATION */}
        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-semibold animate-in shake">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* DETAILS FORM */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          
          {/* FULL NAME */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Full Legal Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full legal name"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:bg-white"
              />
            </div>
          </div>

          {/* EMAIL ADDRESS */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:bg-white"
              />
            </div>
          </div>

          {/* CITY & STATE */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              City & State <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Enter your city and state"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:bg-white"
              />
            </div>
          </div>

          {/* ROLE / INTENT SELECTOR */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Primary Goal on EaseLand <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {roleOptions.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setUserType(role.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    userType === role.id
                      ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/40 shadow-sm'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className={`block text-xs font-extrabold ${userType === role.id ? 'text-slate-950' : 'text-slate-800'}`}>
                    {role.title}
                  </span>
                  <span className="block text-[10px] text-gray-500 leading-tight mt-0.5">
                    {role.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3.5 px-4 bg-metallic-gold hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg border border-amber-300 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Saving Details & Unlocking Account...</span>
              </>
            ) : (
              <>
                <span>Save Details & Enter Account</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </>
            )}
          </button>

          <p className="text-[10px] text-center text-gray-400 font-medium">
            Your details are protected with bank-grade encryption and will never be shared without consent.
          </p>

          <div className="pt-2 text-center border-t border-gray-100">
            <button
              type="button"
              onClick={async () => {
                await logoutUser();
              }}
              className="text-[11px] font-bold text-gray-500 hover:text-rose-600 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Use a different mobile number or Log Out</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
