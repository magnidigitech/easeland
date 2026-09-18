import React, { useState } from 'react';
import { X, User, Mail, Phone, Lock, ShieldCheck, Check, AlertCircle, Eye, EyeOff, Key, Bell, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProfileSettingsModal({ isOpen, onClose, onUserUpdated }) {
  if (!isOpen) return null;

  const { user, profile, updateProfileData, updatePreferencesData } = useAuth();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'security'

  const sanitizePhone = (ph) => {
    if (!ph) return '';
    const str = String(ph).trim();
    const lower = str.toLowerCase();
    if (
      str === '+91 98765 43210' ||
      str === '9876543210' ||
      str === '+91 98765 00000' ||
      str === '9876500000' ||
      str === '+91 N/A' ||
      str === 'N/A' ||
      lower === 'n/a' ||
      lower === 'null' ||
      lower === 'undefined'
    ) return '';
    return str;
  };

  // Profile Form State
  const [profileData, setProfileData] = useState({
    name: profile?.displayName || user?.displayName || '',
    email: profile?.email || user?.email || '',
    phone: sanitizePhone(profile?.phone || profile?.phoneNumber || user?.phone || user?.phoneNumber || ''),
  });

  // Security Form State
  const [securityData, setSecurityData] = useState({
    emailAlerts: profile?.preferences?.emailAlerts ?? true,
    smsAlerts: profile?.preferences?.smsAlerts ?? true
  });

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validation
    if (!profileData.name || profileData.name.trim().length < 2) {
      setError('Please enter a valid Full Name (minimum 2 characters)');
      return;
    }

    const cleanPhone = profileData.phone.replace(/\D/g, '');
    if (cleanPhone && cleanPhone.length !== 10) {
      setError('Mobile number must be exactly 10 digits (e.g. 9876543210)');
      return;
    }

    setLoading(true);
    const result = await updateProfileData({
      displayName: profileData.name.trim(),
      phone: cleanPhone
    });

    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    if (onUserUpdated) onUserUpdated();
    setSuccessMsg('Profile updated successfully!');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    setLoading(true);
    const result = await updatePreferencesData({
      emailAlerts: securityData.emailAlerts,
      smsAlerts: securityData.smsAlerts
    });

    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    if (onUserUpdated) onUserUpdated();
    setSuccessMsg('Communication preferences updated successfully!');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-charcoal/80 backdrop-blur-sm animate-in fade-in">
      
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        
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
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white">{user.name}</h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  user.role === 'ADMIN' ? 'bg-purple-500 text-white' : 'bg-brand-yellow text-brand-charcoal'
                }`}>
                  {user.role === 'ADMIN' ? 'Administrator' : 'User'}
                </span>
              </div>
              <span className="text-xs text-gray-300 font-medium block mt-0.5">{user.email}</span>
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
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value.replace(/\D/g, '') })}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Account Role Description</label>
                <input
                  type="text"
                  value={profileData.role}
                  onChange={(e) => setProfileData({ ...profileData, role: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                />
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
            <form onSubmit={handleSaveSecurity} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">New Password (Leave blank to keep unchanged)</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={securityData.newPassword}
                    onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4 text-brand-charcoal" /> : <Eye className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>

                {securityData.newPassword && (
                  <div className="mt-2.5 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1 text-[11px]">
                    <span className="font-extrabold text-gray-500 block uppercase tracking-wider text-[10px] mb-1">Password Requirements:</span>
                    <div className={`flex items-center gap-1.5 font-bold ${passLengthValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                      <Check className={`w-3.5 h-3.5 ${passLengthValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                      <span>At least 8 characters long</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-bold ${passUpperValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                      <Check className={`w-3.5 h-3.5 ${passUpperValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                      <span>1 Capital letter (A-Z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-bold ${passLowerValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                      <Check className={`w-3.5 h-3.5 ${passLowerValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                      <span>1 Small letter (a-z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-bold ${passDigitValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                      <Check className={`w-3.5 h-3.5 ${passDigitValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                      <span>1 Digit (0-9)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-bold ${passSymbolValid ? 'text-emerald-700' : 'text-gray-400'}`}>
                      <Check className={`w-3.5 h-3.5 ${passSymbolValid ? 'text-emerald-600' : 'text-gray-300'}`} />
                      <span>1 Special Symbol (!@#$%^&*)</span>
                    </div>
                  </div>
                )}
              </div>

              {securityData.newPassword && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={securityData.confirmPassword}
                      onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* SECURITY TOGGLES */}
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-extrabold text-brand-charcoal">Two-Factor Authentication</span>
                    <span className="block text-[10px] text-gray-500 font-medium">Require SMS / Email OTP verification on login</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={securityData.enable2FA}
                    onChange={(e) => setSecurityData({ ...securityData, enable2FA: e.target.checked })}
                    className="w-4 h-4 text-brand-yellow rounded focus:ring-brand-yellow"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-extrabold text-brand-charcoal">Unrecognized Login Alerts</span>
                    <span className="block text-[10px] text-gray-500 font-medium">Send instant email alert when account is accessed from new device</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={securityData.loginAlerts}
                    onChange={(e) => setSecurityData({ ...securityData, loginAlerts: e.target.checked })}
                    className="w-4 h-4 text-brand-yellow rounded focus:ring-brand-yellow"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
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
                  <span>Save Security Settings</span>
                </button>
              </div>
            </form>
          )}

        </div>

      </div>

    </div>
  );
}
