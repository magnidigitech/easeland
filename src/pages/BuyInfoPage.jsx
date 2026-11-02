import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Building2, LandPlot, Home, Key, ChevronRight, CheckCircle2 } from 'lucide-react';
import { mockApi } from '../services/mockApi';

export default function BuyInfoPage({ onExploreClick }) {
  const [siteConfig, setSiteConfig] = useState(mockApi.getSiteConfig());

  useEffect(() => {
    const handleConfigUpdated = (e) => setSiteConfig(e.detail || mockApi.getSiteConfig());
    window.addEventListener('easeland-site-config-updated', handleConfigUpdated);
    return () => window.removeEventListener('easeland-site-config-updated', handleConfigUpdated);
  }, []);

  return (
    <div className="min-h-screen bg-brand-offwhite pb-20">

      {/* HERO SECTION */}
      <div className="bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 text-white pt-4 pb-6 sm:py-16 lg:py-20 px-3.5 sm:px-6 lg:px-8 relative overflow-hidden shadow-2xl border-b border-emerald-900/50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_55%)] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6 lg:gap-8 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-emerald-300 bg-emerald-900/70 backdrop-blur-md px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border border-emerald-500/40 shadow-sm mb-2 sm:mb-5">
                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                <span>{siteConfig?.buyPage?.badgeText || 'DIRECT OWNER LISTINGS'}</span>
              </div>

              <h1 className="text-xl xs:text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-1.5 sm:mb-6 leading-tight">
                {siteConfig?.buyPage?.title || 'Buy Verified Land Plots & Properties Across India'}
              </h1>

              <p className="text-xs sm:text-base lg:text-lg text-emerald-100/90 max-w-2xl mx-auto lg:mx-0 mb-2.5 sm:mb-8 font-medium leading-normal sm:leading-relaxed line-clamp-2 sm:line-clamp-none">
                {siteConfig?.buyPage?.subtitle || 'Discover verified open plots, independent houses, villas, and apartments with authenticated documentation and zero boundary disputes.'}
              </p>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 sm:gap-2.5 mb-3 sm:mb-8">
                <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-emerald-900/50 border border-emerald-500/30 text-emerald-200 whitespace-nowrap">
                  <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" /> Verified Title Deeds
                </span>
                <span className="inline-flex items-center gap-1.5 sm:gap-1.5 text-[10px] sm:text-xs font-semibold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-emerald-900/50 border border-emerald-500/30 text-emerald-200 whitespace-nowrap">
                  <LandPlot className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" /> Delineated Plot Boundaries
                </span>
                <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-emerald-900/50 border border-emerald-500/30 text-emerald-200 whitespace-nowrap">
                  <Home className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" /> Direct Owner Connect
                </span>
              </div>

              {/* CTA Action */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4">
                <button
                  onClick={() => {
                    if (onExploreClick) onExploreClick({ purpose: 'SALE' });
                    else window.location.href = '/properties?purpose=SALE';
                  }}
                  className="w-full sm:w-auto bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs sm:text-sm px-6 py-2.5 sm:px-8 sm:py-4 rounded-xl shadow-xl inline-flex items-center justify-center gap-2 transition-all cursor-pointer animate-smooth-zoom"
                >
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                  <span>Explore Properties on Interactive Map</span>
                </button>
              </div>
            </div>

            {/* Right Visual Stage Column */}
            <div className="lg:col-span-5 relative flex items-center justify-center pt-1 sm:pt-4 lg:pt-0">
              {/* Ambient Glowing Aura */}
              <div className="absolute w-52 h-52 sm:w-80 sm:h-80 bg-emerald-500/25 rounded-full blur-3xl pointer-events-none -z-0"></div>
              <div className="absolute w-40 h-40 sm:w-60 sm:h-60 bg-teal-400/20 rounded-full blur-2xl pointer-events-none -z-0"></div>

              {/* Transparent Hero Image Stage */}
              <div className="relative z-10 w-full max-w-[270px] xs:max-w-xs sm:max-w-md lg:max-w-none flex items-center justify-center">
                <img
                  src="/images/heroes/buy_hero_transparent.png"
                  alt="Verified Buy Properties and Land Plots"
                  className="w-full h-auto max-h-[190px] xs:max-h-[230px] sm:max-h-[380px] lg:max-h-[440px] object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,0.7)] animate-gentle-float select-none"
                  loading="eager"
                />

                {/* Floating Micro-Badge Top Right */}
                <div className="absolute -top-2 sm:-top-3 right-0 sm:right-4 bg-slate-900/90 backdrop-blur-md border border-emerald-500/50 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl shadow-2xl flex items-center gap-1.5 sm:gap-2">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-emerald-200 tracking-wide">100% Physically Inspected</span>
                </div>

                {/* Floating Micro-Badge Bottom Left */}
                <div className="absolute -bottom-2 sm:-bottom-3 left-0 sm:left-4 bg-slate-900/90 backdrop-blur-md border border-emerald-500/50 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl shadow-2xl flex items-center gap-1.5 sm:gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-white tracking-wide">Boundary Marked</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* HOW BUYING WORKS */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            How Buying Property Works on EaseLand
          </h2>
          <p className="text-sm text-slate-600 font-medium mt-2">
            The fundamental proposition: Find → Explore → Verify → Connect directly with owners.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-900 font-black text-lg flex items-center justify-center mb-4">
              1
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Deep Geographic Search</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Search by city, locality, sub-locality, road, landmark or village anywhere in India.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-900 font-black text-lg flex items-center justify-center mb-4">
              2
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Interactive Map & Boundaries</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Inspect marker area sizes, price scale colors, and approved plot boundary polygons.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-900 font-black text-lg flex items-center justify-center mb-4">
              3
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Platform Verification</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Every live property undergoes EaseLand Admin verification before becoming publicly visible.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-900 font-black text-lg flex items-center justify-center mb-4">
              4
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Direct Owner Connection</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Connect directly with verified owners backed by thorough property documentation and clear site coordinates.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
