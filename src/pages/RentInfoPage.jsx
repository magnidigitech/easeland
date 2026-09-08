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
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      
      {/* HERO SECTION */}
      <div className="bg-slate-900 border-b border-slate-800 text-white py-20 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-black uppercase tracking-widest text-slate-950 bg-metallic-gold px-3.5 py-1.5 rounded-md shadow-md border border-amber-300 inline-block">
            {siteConfig.rentPage?.badgeText || 'DIRECT TENANT CONNECT'}
          </span>
          
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mt-4 mb-6">
            {siteConfig.rentPage?.title || 'Rent Verified Apartments & Independent Houses'}
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-8 font-medium leading-relaxed">
            {siteConfig.rentPage?.subtitle || 'Save on high brokerage fees. EaseLand connects tenants directly with verified house owners and landlords across India.'}
          </p>

          <button
            onClick={onExploreClick}
            className="bg-metallic-gold hover:bg-amber-400 text-slate-950 font-black text-sm px-8 py-4 rounded-xl shadow-xl inline-flex items-center gap-2 transition-all transform hover:-translate-y-0.5 border border-amber-300"
          >
            <Search className="w-5 h-5 stroke-[2.5]" />
            <span>Explore Rental Listings on Map</span>
          </button>
        </div>
      </div>

      {/* RENTAL ADVANTAGES */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center mb-4 border border-slate-800 shadow">
              <Key className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-2">Zero Brokerage Fees</h3>
            <p className="text-xs text-slate-700 font-semibold leading-relaxed">
              Talk directly with property landlords without paying 1-2 months of rent to middleman brokers.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center mb-4 border border-slate-800 shadow">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-2">Verified Rental Owners</h3>
            <p className="text-xs text-slate-700 font-semibold leading-relaxed">
              EaseLand Admin reviews property ownership credentials to prevent fake or scam rental listings.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center mb-4 border border-slate-800 shadow">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-2">Pan-India Availability</h3>
            <p className="text-xs text-slate-700 font-semibold leading-relaxed">
              From metropolitan IT hubs to regional towns, search rental homes across every locality.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
