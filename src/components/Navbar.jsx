import React, { useState, useEffect } from 'react';
import { Building2, Heart, PlusCircle, User, ShieldCheck, LogOut, Settings, Briefcase, Search, Key, Tag, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { mockApi } from '../services/mockApi';

export default function Navbar({ activePage, setActivePage, wishlistCount, user, onLoginClick, onLogoutClick, onPostPropertyClick, onOpenProfileSettings }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [siteConfig, setSiteConfig] = useState(mockApi.getSiteConfig());
  const [hoveredNav, setHoveredNav] = useState(null);

  useEffect(() => {
    const handleConfigUpdated = (e) => setSiteConfig(e.detail || mockApi.getSiteConfig());
    window.addEventListener('easeland-site-config-updated', handleConfigUpdated);
    return () => window.removeEventListener('easeland-site-config-updated', handleConfigUpdated);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl text-slate-900 border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* LOGO - Returns Admin to Admin Studio or Users to Homepage */}
          <div 
            onClick={() => setActivePage(user?.role === 'ADMIN' ? 'admin' : 'home')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <img
              src={siteConfig?.navbar?.logoEmblemUrl || "/easeland_emblem_transparent.png"}
              alt="EaseLand Logo"
              className="h-11 w-auto object-contain group-hover:scale-105 transition-transform"
            />
            <div>
              <span className="text-2xl font-extrabold tracking-tight text-slate-900 font-sans">
                {siteConfig?.navbar?.logoTextPrefix || 'Ease'}<span className="text-amber-500">{siteConfig?.navbar?.logoTextSuffix || 'Land'}</span>
              </span>
              <span className="hidden sm:block text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                {user?.role === 'ADMIN' ? 'Admin Site Control Studio' : (siteConfig?.navbar?.logoSubtext || 'Direct Property Platform')}
              </span>
            </div>
          </div>

          {/* DESKTOP NAVIGATION (BUY, RENT, SELL WITH CONTINUOUS 3D PULSING GLOWS & POPUP CARDS) */}
          <nav className="hidden md:flex items-center gap-4 relative">
            
            {/* BUY BUTTON (PERMANENT CONTINUOUS 3D PULSING EMERALD GLOW) */}
            <div 
              className="relative group"
              onMouseEnter={() => setHoveredNav('buy')}
              onMouseLeave={() => setHoveredNav(null)}
            >
              {/* Permanent Ambient 3D Pulsing Backdrop Glow */}
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 blur-md animate-pulse-glow group-hover:opacity-100 transition duration-300" />
              
              <button
                onClick={() => setActivePage('buy')}
                className={`relative z-10 px-5 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all duration-200 transform border-t border-x select-none flex items-center gap-1.5 ${
                  activePage === 'buy'
                    ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white border-t-emerald-300 border-x-emerald-500 border-b-4 border-b-emerald-950 shadow-[0_6px_20px_rgba(16,185,129,0.85),inset_0_1px_1px_rgba(255,255,255,0.4)] scale-105 -translate-y-0.5'
                    : 'bg-gradient-to-b from-emerald-600 to-emerald-800 text-white border-t-emerald-300/80 border-x-emerald-600 border-b-4 border-b-emerald-950 shadow-[0_4px_16px_rgba(16,185,129,0.55),0_0_14px_rgba(16,185,129,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_8px_25px_rgba(16,185,129,0.9),0_0_22px_rgba(16,185,129,0.75)] hover:-translate-y-1 active:translate-y-0.5 active:border-b-2'
                }`}
              >
                <Search className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{siteConfig?.navbar?.buyLabel || 'BUY'}</span>
              </button>

              {/* POP-UP CARD FOR BUY */}
              {hoveredNav === 'buy' && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 bg-white/95 backdrop-blur-xl rounded-2xl p-4 shadow-[0_20px_50px_rgba(16,185,129,0.25)] border border-emerald-200 z-50 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-t border-l border-emerald-200 rotate-45" />
                  <div className="relative z-10 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-xs">
                      <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                        <Search className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <span>Buy Verified Properties</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Explore 100% owner-verified plots, residential homes, and commercial lands.
                    </p>
                    <div className="pt-2 border-t border-emerald-100 flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> 0% Brokerage
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-500" /> Land Verified
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* RENT BUTTON (PERMANENT CONTINUOUS 3D PULSING ROYAL PURPLE GLOW) */}
            <div 
              className="relative group"
              onMouseEnter={() => setHoveredNav('rent')}
              onMouseLeave={() => setHoveredNav(null)}
            >
              {/* Permanent Ambient 3D Pulsing Backdrop Glow */}
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 blur-md animate-pulse-glow group-hover:opacity-100 transition duration-300" />

              <button
                onClick={() => setActivePage('rent')}
                className={`relative z-10 px-5 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all duration-200 transform border-t border-x select-none flex items-center gap-1.5 ${
                  activePage === 'rent'
                    ? 'bg-gradient-to-b from-purple-500 to-purple-700 text-white border-t-purple-300 border-x-purple-500 border-b-4 border-b-purple-950 shadow-[0_6px_20px_rgba(168,85,247,0.85),inset_0_1px_1px_rgba(255,255,255,0.4)] scale-105 -translate-y-0.5'
                    : 'bg-gradient-to-b from-purple-600 to-purple-800 text-white border-t-purple-300/80 border-x-purple-600 border-b-4 border-b-purple-950 shadow-[0_4px_16px_rgba(168,85,247,0.55),0_0_14px_rgba(168,85,247,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_8px_25px_rgba(168,85,247,0.9),0_0_22px_rgba(168,85,247,0.75)] hover:-translate-y-1 active:translate-y-0.5 active:border-b-2'
                }`}
              >
                <Key className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{siteConfig?.navbar?.rentLabel || 'RENT'}</span>
              </button>

              {/* POP-UP CARD FOR RENT */}
              {hoveredNav === 'rent' && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 bg-white/95 backdrop-blur-xl rounded-2xl p-4 shadow-[0_20px_50px_rgba(168,85,247,0.25)] border border-purple-200 z-50 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-t border-l border-purple-200 rotate-45" />
                  <div className="relative z-10 space-y-2">
                    <div className="flex items-center gap-2 text-purple-700 font-extrabold text-xs">
                      <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                        <Key className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <span>Direct Tenant Rental Connect</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Find rental homes, villas, and farmland leases directly from property owners.
                    </p>
                    <div className="pt-2 border-t border-purple-100 flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-purple-500" /> Direct Agreement
                      </span>
                      <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-200 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-500" /> Deposit Safe
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* SELL BUTTON (PERMANENT CONTINUOUS 3D PULSING AMBER GOLD GLOW) */}
            <div 
              className="relative group"
              onMouseEnter={() => setHoveredNav('sell')}
              onMouseLeave={() => setHoveredNav(null)}
            >
              {/* Permanent Ambient 3D Pulsing Backdrop Glow */}
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 blur-md animate-pulse-glow group-hover:opacity-100 transition duration-300" />

              <button
                onClick={() => setActivePage('sell')}
                className={`relative z-10 px-5 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all duration-200 transform border-t border-x select-none flex items-center gap-1.5 ${
                  activePage === 'sell'
                    ? 'bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950 border-t-amber-200 border-x-amber-400 border-b-4 border-b-amber-900 shadow-[0_6px_20px_rgba(245,158,11,0.9),inset_0_1px_1px_rgba(255,255,255,0.6)] scale-105 -translate-y-0.5'
                    : 'bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950 border-t-amber-200/90 border-x-amber-400 border-b-4 border-b-amber-900 shadow-[0_4px_16px_rgba(245,158,11,0.65),0_0_16px_rgba(245,158,11,0.5),inset_0_1px_1px_rgba(255,255,255,0.6)] hover:shadow-[0_8px_25px_rgba(245,158,11,0.95),0_0_24px_rgba(245,158,11,0.8)] hover:-translate-y-1 active:translate-y-0.5 active:border-b-2'
                }`}
              >
                <Tag className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{siteConfig?.navbar?.sellLabel || 'SELL'}</span>
              </button>

              {/* POP-UP CARD FOR SELL */}
              {hoveredNav === 'sell' && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 bg-white/95 backdrop-blur-xl rounded-2xl p-4 shadow-[0_20px_50px_rgba(245,158,11,0.3)] border border-amber-200 z-50 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-t border-l border-amber-200 rotate-45" />
                  <div className="relative z-10 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 font-extrabold text-xs">
                      <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                        <Tag className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <span>List Property Free</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Reach 50,000+ verified buyers across South India with zero commission fees.
                    </p>
                    <div className="pt-2 border-t border-amber-100 flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-amber-500" /> Free Posting
                      </span>
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" /> Instant Buyer Leads
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </nav>

          {/* RIGHT ACTION CONTROLS */}
          <div className="hidden lg:flex items-center gap-4">

            {/* WISHLIST BUTTON - ONLY SHOWN WHEN USER IS LOGGED IN */}
            {user && (
              <button
                onClick={() => setActivePage('wishlist')}
                className="relative p-2.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-transparent"
                title="My Saved Properties"
              >
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-metallic-gold text-slate-950 text-[11px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-md border border-amber-300">
                    {wishlistCount}
                  </span>
                )}
              </button>
            )}

            {/* SPECIAL NAVBAR BOX FOR ADMIN: "ADMIN SITE STUDIO" & "CRM STUDIO" */}
            {user && user.role === 'ADMIN' && (
              <div className="flex items-center gap-2">
                {activePage !== 'admin' && (
                  <button
                    onClick={() => setActivePage('admin')}
                    className="bg-metallic-gold hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition-all transform hover:scale-105 border border-amber-300 select-none whitespace-nowrap"
                    title="Return to Admin Site Control Studio"
                  >
                    <ShieldCheck className="w-4 h-4 text-slate-950" />
                    <span className="whitespace-nowrap">ADMIN STUDIO</span>
                  </button>
                )}

                <button
                  onClick={() => setActivePage('crm')}
                  className={`font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md border flex items-center gap-1.5 transition-all select-none whitespace-nowrap ${
                    activePage === 'crm'
                      ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/50'
                      : 'bg-slate-900 text-white border-slate-700 hover:bg-slate-800'
                  }`}
                  title="Open EaseLand CRM Studio"
                >
                  <Briefcase className={`w-3.5 h-3.5 ${activePage === 'crm' ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span className="whitespace-nowrap">CRM STUDIO</span>
                </button>
              </div>
            )}

            {/* AUTHENTICATION STATE CONTROL */}
            {user ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActivePage('dashboard')}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all ${
                    activePage === 'dashboard'
                      ? 'bg-slate-100 text-slate-900 border-2 border-amber-500 font-extrabold shadow-sm'
                      : 'bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-100'
                  }`}
                  title="Open User Dashboard"
                >
                  <div className="w-7 h-7 rounded-lg bg-metallic-gold text-slate-950 font-black text-xs flex items-center justify-center shadow-md border border-amber-300 shrink-0">
                    {(user.name || user.displayName || user.email || 'u').charAt(0).toLowerCase()}
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-bold line-clamp-1 max-w-[110px] text-slate-900">
                      {user.name || user.displayName || 'EaseLand User'}
                    </span>
                    <span className={`block text-[9px] uppercase font-black tracking-wider ${
                      activePage === 'dashboard' ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                      {user.role === 'ADMIN' ? 'DASHBOARD' : 'Dashboard'}
                    </span>
                  </div>
                </button>

                <button
                  onClick={onOpenProfileSettings}
                  className="p-2 text-slate-700 hover:text-amber-600 hover:bg-slate-100 rounded-xl transition-colors border border-transparent"
                  title="Profile & Security Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>

                <button
                  onClick={onLogoutClick}
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-xl transition-colors border border-transparent"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="text-xs font-bold text-slate-800 hover:text-amber-600 flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors border border-transparent"
              >
                <User className="w-4 h-4 text-slate-600" />
                <span>LOGIN / REGISTER</span>
              </button>
            )}

            {/* POST PROPERTY PRIMARY BUTTON */}
            <button
              onClick={onPostPropertyClick}
              className="bg-metallic-gold hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-5 py-3 rounded-xl shadow-md flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5 border border-amber-300"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>POST PROPERTY</span>
            </button>
          </div>

          {/* MOBILE MENU TOGGLE */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={onPostPropertyClick}
              className="bg-metallic-gold hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] px-2.5 py-1.5 rounded-lg shadow-sm border border-amber-300 shrink-0 whitespace-nowrap flex items-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Post</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Toggle navigation menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

        </div>
      </div>

      {/* MOBILE MENU DRAWER */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 space-y-3">
          <button
            onClick={() => { onPostPropertyClick(); setMobileMenuOpen(false); }}
            className="w-full bg-metallic-gold text-slate-950 font-black text-xs py-3 rounded-xl shadow-md border border-amber-300 flex items-center justify-center gap-2 mb-2"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span>POST PROPERTY LISTING</span>
          </button>
          <button
            onClick={() => { setActivePage('home'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-slate-800 font-semibold"
          >
            Home
          </button>

          {/* BUY (EMERALD GLOW MOBILE) */}
          <button
            onClick={() => { setActivePage('buy'); setMobileMenuOpen(false); }}
            className="w-full text-left py-2.5 px-3 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold text-xs flex items-center justify-between shadow-[0_0_12px_rgba(16,185,129,0.2)]"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
              <span>BUY PROPERTIES</span>
            </div>
            <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-extrabold">0% Brokerage</span>
          </button>

          {/* RENT (ROYAL PURPLE GLOW MOBILE) */}
          <button
            onClick={() => { setActivePage('rent'); setMobileMenuOpen(false); }}
            className="w-full text-left py-2.5 px-3 rounded-xl bg-purple-50 text-purple-900 border border-purple-300 font-bold text-xs flex items-center justify-between shadow-[0_0_12px_rgba(168,85,247,0.2)]"
          >
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-600 stroke-[2.5]" />
              <span>RENT HOMES & LAND</span>
            </div>
            <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-extrabold">Direct Owners</span>
          </button>

          {/* SELL (AMBER GOLD GLOW MOBILE) */}
          <button
            onClick={() => { setActivePage('sell'); setMobileMenuOpen(false); }}
            className="w-full text-left py-2.5 px-3 rounded-xl bg-amber-50 text-amber-950 border border-amber-300 font-bold text-xs flex items-center justify-between shadow-[0_0_12px_rgba(245,158,11,0.25)]"
          >
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-600 stroke-[2.5]" />
              <span>SELL / POST LISTING</span>
            </div>
            <span className="text-[10px] bg-amber-300 text-slate-950 px-2 py-0.5 rounded-full font-black">Free Listing</span>
          </button>

          {user && (
            <button
              onClick={() => { setActivePage('wishlist'); setMobileMenuOpen(false); }}
              className="block w-full text-left py-2 text-amber-600 font-bold"
            >
              Saved Wishlist Properties ({wishlistCount})
            </button>
          )}

          {user && user.role === 'ADMIN' && (
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <button
                onClick={() => { setActivePage('admin'); setMobileMenuOpen(false); }}
                className="w-full text-left py-2 px-3 rounded-lg bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                <span>Admin Site Studio</span>
              </button>
              <button
                onClick={() => { setActivePage('crm'); setMobileMenuOpen(false); }}
                className="w-full text-left py-2 px-3 rounded-lg bg-slate-900 text-white font-extrabold text-xs flex items-center gap-2"
              >
                <Briefcase className="w-4 h-4 text-amber-400" />
                <span>EaseLand CRM Studio</span>
              </button>
            </div>
          )}

          {user ? (
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900">{user.name}</span>
              <button onClick={onLogoutClick} className="text-rose-600 font-bold">Log Out</button>
            </div>
          ) : (
            <button
              onClick={() => { onLoginClick(); setMobileMenuOpen(false); }}
              className="block w-full text-left py-2 text-amber-600 font-bold border-t border-slate-200"
            >
              Login / Register Account
            </button>
          )}
        </div>
      )}
    </header>
  );
}
