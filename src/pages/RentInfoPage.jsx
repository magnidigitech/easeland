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
      <div className="bg-gradient-to-br from-purple-950 via-indigo-950 to-slate-950 text-white py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden shadow-2xl border-b border-purple-900/50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_55%)] pointer-events-none"></div>
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#a855f7_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-purple-300 bg-purple-900/70 backdrop-blur-md px-4 py-1.5 rounded-full border border-purple-500/40 shadow-sm mb-5">
                <Key className="w-4 h-4 text-purple-400" />
                <span>{siteConfig?.rentPage?.badgeText || 'DIRECT TENANT CONNECT'}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-6 leading-tight">
                {siteConfig?.rentPage?.title || 'Rent Verified Apartments & Independent Houses'}
              </h1>

              <p className="text-base sm:text-lg text-purple-100/90 max-w-2xl mx-auto lg:mx-0 mb-8 font-medium leading-relaxed">
                {(() => {
                  const sub = siteConfig?.rentPage?.subtitle;
                  if (!sub || sub.includes('brokerage') || sub.includes('commission') || sub.includes('middleman')) {
                    return 'Discover premium rental homes, modern apartments, and villas with authenticated owners and complete agreement support.';
                  }
                  return sub;
                })()}
              </p>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 mb-8">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-900/50 border border-purple-500/30 text-purple-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> Verified Landlords
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-900/50 border border-purple-500/30 text-purple-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> Clear Rental Agreements
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-900/50 border border-purple-500/30 text-purple-200">
                  <Key className="w-3.5 h-3.5 text-purple-400" /> Fast Move-in Ready
                </span>
              </div>

              {/* CTA Action */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <button
                  onClick={() => {
                    if (onExploreClick) onExploreClick({ purpose: 'RENT' });
                    else window.location.href = '/properties?purpose=RENT';
                  }}
                  className="w-full sm:w-auto bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-sm px-8 py-4 rounded-xl shadow-xl inline-flex items-center justify-center gap-2 transition-all cursor-pointer animate-smooth-zoom"
                >
                  <Search className="w-5 h-5 stroke-[2.5]" />
                  <span>Explore Rental Listings on Map</span>
                </button>
              </div>
            </div>

            {/* Right Visual Stage Column */}
            <div className="lg:col-span-5 relative flex items-center justify-center pt-4 lg:pt-0">
              {/* Ambient Glowing Aura */}
              <div className="absolute w-72 h-72 sm:w-80 sm:h-80 bg-purple-500/25 rounded-full blur-3xl pointer-events-none -z-0"></div>
              <div className="absolute w-60 h-60 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none -z-0"></div>

              {/* Transparent Hero Image Stage */}
              <div className="relative z-10 w-full max-w-sm sm:max-w-md lg:max-w-none flex items-center justify-center">
                <img
                  src="/images/heroes/rent_hero_transparent.png"
                  alt="Verified Rental Apartments and Residences"
                  className="w-full h-auto max-h-[380px] sm:max-h-[440px] object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,0.7)] animate-gentle-float select-none"
                  loading="eager"
                />

                {/* Floating Micro-Badge Top Right */}
                <div className="absolute -top-3 right-0 sm:right-4 bg-slate-900/90 backdrop-blur-md border border-purple-500/50 px-3 py-1.5 rounded-xl shadow-2xl flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse"></span>
                  <span className="text-[11px] font-bold text-purple-200 tracking-wide">Direct Tenant Connect</span>
                </div>

                {/* Floating Micro-Badge Bottom Left */}
                <div className="absolute -bottom-3 left-0 sm:left-4 bg-slate-900/90 backdrop-blur-md border border-purple-500/50 px-3 py-1.5 rounded-xl shadow-2xl flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span className="text-[11px] font-bold text-white tracking-wide">Verified Landlord</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* RENTAL ADVANTAGES */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center mb-4">
              <Key className="w-6 h-6 text-purple-700" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Transparent & Fair Terms</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Connect with verified landlords with clear rental agreements, authenticated property records, and complete transaction guidance.
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
