import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Lock, ShieldAlert } from 'lucide-react';

/**
 * Reusable Protected Route / Authentication Guard Component
 */
export default function ProtectedRoute({ children, fallback = null, onUnauthorized = null }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center p-8 bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Verifying Authentication...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (fallback) {
      return fallback;
    }

    return (
      <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-200 shadow-xl text-center space-y-5">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl mx-auto flex items-center justify-center font-black">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
              Authentication Required
            </span>
            <h3 className="text-xl font-black text-brand-charcoal mt-2">Protected Area</h3>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Please log in or register an account to access this page.
            </p>
          </div>
          {onUnauthorized && (
            <button
              onClick={onUnauthorized}
              className="w-full bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs py-3 rounded-xl shadow transition-all"
            >
              Log In / Register Now
            </button>
          )}
        </div>
      </div>
    );
  }

  return children;
}
