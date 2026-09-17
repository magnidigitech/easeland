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
      <div className="bg-brand-charcoal text-white py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <span className="text-xs font-extrabold uppercase tracking-widest text-brand-yellow bg-white/10 px-3 py-1 rounded-full border border-white/15">
            {siteConfig?.buyPage?.badgeText || 'DIRECT OWNER LISTINGS'}
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mt-4 mb-6">
            {siteConfig?.buyPage?.title || 'Buy Verified Land Plots & Properties Across India'}
          </h1>

          <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto mb-8 font-medium">
            {siteConfig?.buyPage?.subtitle || 'Discover verified open plots, independent houses, villas, and apartments directly from owners. Zero real-estate agents or brokers involved.'}
          </p>

          <button
            onClick={onExploreClick}
            className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-sm px-8 py-4 rounded-xl shadow-xl inline-flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
          >
            <Search className="w-5 h-5 stroke-[2.5]" />
            <span>Explore Properties on Interactive Map</span>
          </button>
        </div>
      </div>

      {/* HOW BUYING WORKS */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-charcoal">
            How Buying Property Works on EaseLand
          </h2>
          <p className="text-sm text-gray-500 font-medium mt-2">
            The fundamental proposition: Find → Explore → Verify → Connect directly with owners.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-brand-bordergray shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-brand-yellow text-brand-charcoal font-black text-lg flex items-center justify-center mb-4">
              1
            </div>
            <h3 className="text-base font-bold text-brand-charcoal mb-2">Deep Geographic Search</h3>
            <p className="text-xs text-gray-500 font-medium">
              Search by city, locality, sub-locality, road, landmark or village anywhere in India.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-brand-bordergray shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-brand-yellow text-brand-charcoal font-black text-lg flex items-center justify-center mb-4">
              2
            </div>
            <h3 className="text-base font-bold text-brand-charcoal mb-2">Interactive Map & Boundaries</h3>
            <p className="text-xs text-gray-500 font-medium">
              Inspect marker area sizes, price scale colors, and approved plot boundary polygons.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-brand-bordergray shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-brand-yellow text-brand-charcoal font-black text-lg flex items-center justify-center mb-4">
              3
            </div>
            <h3 className="text-base font-bold text-brand-charcoal mb-2">Platform Verification</h3>
            <p className="text-xs text-gray-500 font-medium">
              Every live property undergoes EaseLand Admin verification before becoming publicly visible.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-brand-bordergray shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-brand-yellow text-brand-charcoal font-black text-lg flex items-center justify-center mb-4">
              4
            </div>
            <h3 className="text-base font-bold text-brand-charcoal mb-2">Direct Owner Connection</h3>
            <p className="text-xs text-gray-500 font-medium">
              Submit your enquiry directly to the property owner with zero broker interference.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
