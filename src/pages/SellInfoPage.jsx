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
      <div className="bg-gradient-to-br from-amber-950 via-orange-950 to-stone-950 text-white py-20 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden shadow-2xl border-b border-amber-900/50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.15),transparent_50%)]"></div>
        <div className="max-w-4xl mx-auto relative z-10">
          <span className="text-xs font-extrabold uppercase tracking-widest text-amber-300 bg-amber-900/60 px-3.5 py-1.5 rounded-full border border-amber-500/40 shadow-sm">
            {siteConfig?.sellPage?.badgeText || 'POST PROPERTY FOR FREE'}
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mt-4 mb-6">
            {siteConfig?.sellPage?.title || 'List Your Property Directly — Zero Brokerage Commission'}
          </h1>

          <p className="text-base sm:text-lg text-amber-100/90 max-w-2xl mx-auto mb-8 font-medium leading-relaxed">
            {siteConfig?.sellPage?.subtitle || 'Post your property once. Upload location, plot boundary, photos, and drone footage. Receive direct customer enquiries with zero broker commission.'}
          </p>

          <button
            onClick={onPostPropertyClick}
            className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-sm px-8 py-4 rounded-xl shadow-xl inline-flex items-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <PlusCircle className="w-5 h-5 stroke-[2.5]" />
            <span>Post Free Property Listing</span>
          </button>
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
      </div>v>

    </div>
  );
}
