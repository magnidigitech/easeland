import React, { useState, useEffect } from 'react';
import { Key, Search, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { mockApi } from '../services/mockApi';

export default function RentInfoPage({ onExploreClick }) {
  const [siteConfig, setSiteConfig] = useState(mockApi.getSiteConfig());

  useEffect(() => {
    const handleConfigUpdated = (e) => setSiteConfig(e.detail || mockApi.getSiteConfig());
    window.addEventListener('easeland-site-config-updated', handleConfigUpdated);
    return () => window.removeEventListener('easeland-site-config-updated', handleConfigUpdated);
  }, []);

  return (
    <div className="min-h-screen bg-brand-offwhite pb-20">

      {/* HERO SECTION */}
      <div className="bg-gradient-to-br from-purple-950 via-indigo-950 to-slate-950 text-white py-20 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden shadow-2xl border-b border-purple-900/50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.15),transparent_50%)]"></div>
        <div className="max-w-4xl mx-auto relative z-10">
          <span className="text-xs font-extrabold uppercase tracking-widest text-purple-300 bg-purple-900/60 px-3.5 py-1.5 rounded-full border border-purple-500/40 shadow-sm">
            {siteConfig?.rentPage?.badgeText || 'DIRECT TENANT CONNECT'}
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mt-4 mb-6">
            {siteConfig?.rentPage?.title || 'Rent Verified Apartments & Independent Houses'}
          </h1>

          <p className="text-base sm:text-lg text-purple-100/90 max-w-2xl mx-auto mb-8 font-medium leading-relaxed">
            {siteConfig?.rentPage?.subtitle || 'Save on high brokerage fees. EaseLand connects tenants directly with verified house owners and landlords across India.'}
          </p>

          <button
            onClick={() => {
              if (onExploreClick) onExploreClick({ purpose: 'RENT' });
              else window.location.href = '/properties?purpose=RENT';
            }}
            className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-sm px-8 py-4 rounded-xl shadow-xl inline-flex items-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Search className="w-5 h-5 stroke-[2.5]" />
            <span>Explore Rental Listings on Map</span>
          </button>
        </div>
      </div>

      {/* RENTAL ADVANTAGES */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center mb-4">
              <Key className="w-6 h-6 text-purple-700" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Zero Brokerage Fees</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Talk directly with property landlords without paying 1-2 months of rent to middleman brokers.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 text-purple-700" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Verified Rental Owners</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              EaseLand Admin reviews property ownership credentials to prevent fake or scam rental listings.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-purple-700" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Pan-India Availability</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              From metropolitan IT hubs to regional towns, search rental homes across every locality.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
