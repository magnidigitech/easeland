import React, { useState, useEffect } from 'react';
import { PlusCircle, ShieldCheck, LandPlot, Home, CheckCircle2 } from 'lucide-react';
import { mockApi } from '../services/mockApi';

export default function SellInfoPage({ onPostPropertyClick }) {
  const [siteConfig, setSiteConfig] = useState(mockApi.getSiteConfig());

  useEffect(() => {
    const handleConfigUpdated = (e) => setSiteConfig(e.detail || mockApi.getSiteConfig());
    window.addEventListener('easeland-site-config-updated', handleConfigUpdated);
    return () => window.removeEventListener('easeland-site-config-updated', handleConfigUpdated);
  }, []);

  return (
    <div className="min-h-screen bg-brand-offwhite pb-20">

      {/* HERO SECTION */}
      <div className="bg-gradient-to-br from-amber-950 via-orange-950 to-stone-950 text-white py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden shadow-2xl border-b border-amber-900/50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_55%)] pointer-events-none"></div>
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-amber-300 bg-amber-900/70 backdrop-blur-md px-4 py-1.5 rounded-full border border-amber-500/40 shadow-sm mb-5">
                <PlusCircle className="w-4 h-4 text-amber-400" />
                <span>{siteConfig?.sellPage?.badgeText || 'DIRECT OWNER LISTINGS'}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-6 leading-tight">
                {(() => {
                  const title = siteConfig?.sellPage?.title;
                  if (!title || title.includes('Brokerage') || title.includes('brokerage') || title.includes('Commission') || title.includes('commission')) {
                    return 'List Your Property — Connect with Verified Serious Buyers';
                  }
                  return title;
                })()}
              </h1>

              <p className="text-base sm:text-lg text-amber-100/90 max-w-2xl mx-auto lg:mx-0 mb-8 font-medium leading-relaxed">
                {(() => {
                  const sub = siteConfig?.sellPage?.subtitle;
                  if (!sub || sub.includes('broker') || sub.includes('commission') || sub.includes('brokerage')) {
                    return 'Post your property once. Upload location, plot boundary, photos, and drone footage. Showcase your listing to thousands of active buyers with complete documentation support.';
                  }
                  return sub;
                })()}
              </p>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 mb-8">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-900/50 border border-amber-500/30 text-amber-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> Verified Serious Buyers
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-900/50 border border-amber-500/30 text-amber-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Confidential Doc Vault
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-900/50 border border-amber-500/30 text-amber-200">
                  <Home className="w-3.5 h-3.5 text-amber-400" /> Fast 24h Admin Approval
                </span>
              </div>

              {/* CTA Action */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <button
                  onClick={onPostPropertyClick}
                  className="w-full sm:w-auto bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-sm px-8 py-4 rounded-xl shadow-xl inline-flex items-center justify-center gap-2 transition-all cursor-pointer animate-smooth-zoom"
                >
                  <PlusCircle className="w-5 h-5 stroke-[2.5]" />
                  <span>List Verified Property Now</span>
                </button>
              </div>
            </div>

            {/* Right Visual Stage Column */}
            <div className="lg:col-span-5 relative flex items-center justify-center pt-4 lg:pt-0">
              {/* Ambient Glowing Aura */}
              <div className="absolute w-72 h-72 sm:w-80 sm:h-80 bg-amber-500/25 rounded-full blur-3xl pointer-events-none -z-0"></div>
              <div className="absolute w-60 h-60 bg-orange-500/20 rounded-full blur-2xl pointer-events-none -z-0"></div>

              {/* Transparent Hero Image Stage */}
              <div className="relative z-10 w-full max-w-sm sm:max-w-md lg:max-w-none flex items-center justify-center">
                <img
                  src="/images/heroes/sell_hero_transparent.png"
                  alt="List and Sell Verified Properties"
                  className="w-full h-auto max-h-[380px] sm:max-h-[440px] object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,0.7)] animate-gentle-float select-none"
                  loading="eager"
                />

                {/* Floating Micro-Badge Top Right */}
                <div className="absolute -top-3 right-0 sm:right-4 bg-slate-900/90 backdrop-blur-md border border-amber-500/50 px-3 py-1.5 rounded-xl shadow-2xl flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                  <span className="text-[11px] font-bold text-amber-200 tracking-wide">Owner Listed • For Sale</span>
                </div>

                {/* Floating Micro-Badge Bottom Left */}
                <div className="absolute -bottom-3 left-0 sm:left-4 bg-slate-900/90 backdrop-blur-md border border-amber-500/50 px-3 py-1.5 rounded-xl shadow-2xl flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px] font-bold text-white tracking-wide">Direct Buyers</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* VERIFICATION LIFECYCLE FOR OWNERS */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            The EaseLand Owner Listing Workflow
          </h2>
          <p className="text-sm text-slate-600 font-medium mt-2">
            Every property listing undergoes mandatory Admin verification to ensure high buyer trust.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 font-black text-lg flex items-center justify-center mb-4">
              1
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Create Listing</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Enter title, price, specifications, address, photos, and walkthrough/drone video links.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 font-black text-lg flex items-center justify-center mb-4">
              2
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Mark Location & Boundary</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Use "Use Current Location" GPS or drag marker to set location pin and plot boundary.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 font-black text-lg flex items-center justify-center mb-4">
              3
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Upload Confidential Docs</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Upload sale deed / tax receipts for Admin verification. Docs remain 100% confidential.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 font-black text-lg flex items-center justify-center mb-4">
              4
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Admin Approval & LIVE</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              EaseLand Admin reviews and approves the property. Listing becomes LIVE with a Verified badge.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
