import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Phone, User, Mail, MapPin, Building, CheckCircle2, Sparkles, Clock } from 'lucide-react';
import { submitVisitorLead } from '../firebase/visitorService';

export default function VisitorLeadModal({ currentUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [secondsOnSite, setSecondsOnSite] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    propertyType: 'Open Plots',
    location: ''
  });

  // Track 1-Minute (60s) on-site engagement for unauthenticated visitors
  useEffect(() => {
    // If user is logged in, skip lead modal prompt
    if (currentUser?.uid || currentUser?.id || (currentUser?.phone && currentUser?.phone.length >= 10)) {
      return;
    }

    // If visitor already submitted previously, do not prompt again
    if (typeof localStorage !== 'undefined' && localStorage.getItem('easeland_visitor_submitted') === 'true') {
      return;
    }

    // If visitor dismissed in this active browser session, do not prompt again
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('easeland_visitor_dismissed') === 'true') {
      return;
    }

    // Initialize time spent from session storage (persists across page navigations)
    let initialSecs = 0;
    try {
      const storedSecs = sessionStorage.getItem('easeland_visitor_active_seconds');
      if (storedSecs) initialSecs = parseInt(storedSecs, 10) || 0;
    } catch (e) {}

    setSecondsOnSite(initialSecs);

    const timer = setInterval(() => {
      setSecondsOnSite((prev) => {
        const next = prev + 1;
        try {
          sessionStorage.setItem('easeland_visitor_active_seconds', next.toString());
        } catch (e) {}

        // Trigger at exactly 1 minute (60 seconds)
        if (next >= 60) {
          // Verify flags before popping up
          const alreadySubmitted = localStorage.getItem('easeland_visitor_submitted') === 'true';
          const alreadyDismissed = sessionStorage.getItem('easeland_visitor_dismissed') === 'true';

          if (!alreadySubmitted && !alreadyDismissed) {
            setIsOpen(true);
          }
          clearInterval(timer);
        }
        return next;
      });
    }, 1000);

    // Provide a developer/testing hook to trigger instantly without waiting
    if (typeof window !== 'undefined') {
      window.triggerVisitorLeadModal = () => setIsOpen(true);
    }

    return () => clearInterval(timer);
  }, [currentUser]);

  const handleDismiss = () => {
    setIsOpen(false);
    try {
      sessionStorage.setItem('easeland_visitor_dismissed', 'true');
    } catch (e) {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanName = (formData.name || '').trim();
    const cleanPhone = (formData.phone || '').trim().replace(/[^0-9+]/g, '');

    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Please enter your full name (minimum 2 characters).');
      return;
    }

    if (!cleanPhone || cleanPhone.replace(/[^0-9]/g, '').length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile or WhatsApp number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitVisitorLead({
        name: cleanName,
        phone: cleanPhone,
        email: (formData.email || '').trim(),
        preferredPropertyType: formData.propertyType,
        preferredLocation: (formData.location || '').trim(),
        stayDurationSeconds: Math.max(secondsOnSite, 60)
      });

      if (res.success) {
        setSubmitted(true);
        setTimeout(() => {
          setIsOpen(false);
        }, 2500);
      } else {
        setErrorMsg(res.error || 'Failed to submit. Please check your connection.');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-brand-charcoal/80 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-amber-300/60 overflow-hidden relative max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP ACCENT BRAND BAR */}
        <div className="h-2 bg-gradient-to-r from-brand-navy via-brand-yellow to-brand-navy shrink-0" />

        {/* CLOSE BUTTON */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors z-20"
          aria-label="Close popup"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          /* SUCCESS STATE */
          <div className="p-6 sm:p-8 text-center space-y-4 overflow-y-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-black text-brand-navy">
              Thank You, {formData.name}!
            </h3>
            <p className="text-xs text-gray-600 max-w-sm mx-auto leading-relaxed">
              Your details have been saved directly to our verified registry. An EaseLand property specialist will reach out with verified zero-brokerage options matching your criteria.
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-full border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Saved to PostgreSQL &amp; Verified Registry
              </span>
            </div>
          </div>
        ) : (
          /* LEAD FORM STATE */
          <div className="p-5 sm:p-8 space-y-5 overflow-y-auto max-h-[calc(90dvh-16px)]">
            {/* HEADER BADGE & TITLE */}
            <div className="space-y-2 pr-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-300 text-amber-900 rounded-full text-[11px] font-black uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>1+ Min Active On Site • Free VIP Assistance</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-brand-navy tracking-tight">
                Looking for the Right Land Plot in AP?
              </h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                You've been exploring EaseLand! Connect directly with verified land owners and get curated zero-brokerage plot deals tailored to your exact budget &amp; location.
              </p>
            </div>

            {/* ERROR ALERT */}
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">
                {errorMsg}
              </div>
            )}

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* NAME */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Varma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* PHONE */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-700 mb-1">
                    Mobile Number *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* LOCATION ADDRESS (OPTIONAL) */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-700 mb-1">
                  Location Address <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="e.g. Guntur, Vijayawada, Amaravati, Mangalagiri..."
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* PROPERTY TYPE */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-700 mb-1">
                    Property Type <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <select
                      value={formData.propertyType}
                      onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:bg-white cursor-pointer"
                    >
                      <option value="Open Plots">Open Plots</option>
                      <option value="Residential Plot">Residential Plot</option>
                      <option value="Commercial Land">Commercial Land</option>
                      <option value="Agricultural Land">Agricultural Land</option>
                      <option value="Villa / House">Villa / House</option>
                      <option value="Highway Commercial Bit">Highway Commercial Bit</option>
                    </select>
                  </div>
                </div>

                {/* EMAIL */}
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-700 mb-1">
                    Email Address <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-brand-yellow hover:bg-brand-yellowHover text-brand-navy font-black text-xs py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4 text-brand-navy" />
                  <span>{submitting ? 'Saving Details to PostgreSQL...' : 'Get Verified Plot Recommendations →'}</span>
                </button>

                <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                  <span className="flex items-center gap-1 text-emerald-700 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Zero Spam Guarantee
                  </span>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="hover:text-gray-600 font-semibold cursor-pointer underline"
                  >
                    I'll browse on my own
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
