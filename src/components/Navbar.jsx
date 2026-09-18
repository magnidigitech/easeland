import React, { useState, useEffect } from 'react';
import { Building2, Heart, PlusCircle, User, ShieldCheck, LogOut, Settings } from 'lucide-react';
import { mockApi } from '../services/mockApi';

export default function Navbar({ activePage, setActivePage, wishlistCount, user, onLoginClick, onLogoutClick, onPostPropertyClick, onOpenProfileSettings }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [siteConfig, setSiteConfig] = useState(mockApi.getSiteConfig());

  useEffect(() => {
    const handleConfigUpdated = (e) => setSiteConfig(e.detail || mockApi.getSiteConfig());
    window.addEventListener('easeland-site-config-updated', handleConfigUpdated);
    return () => window.removeEventListener('easeland-site-config-updated', handleConfigUpdated);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl text-white border-b border-slate-800 shadow-2xl">
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
              className="h-11 w-auto object-contain group-hover:scale-105 transition-transform drop-shadow-[0_0_10px_rgba(212,175,55,0.3)]"
            />
            <div>
              <span className="text-2xl font-extrabold tracking-tight text-slate-100 font-sans">
                {siteConfig?.navbar?.logoTextPrefix || 'Ease'}<span className="text-metallic-gold">{siteConfig?.navbar?.logoTextSuffix || 'Land'}</span>
              </span>
              <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                {user?.role === 'ADMIN' ? 'Admin Site Control Studio' : (siteConfig?.navbar?.logoSubtext || 'Direct Property Platform')}
              </span>
            </div>
          </div>

          {/* DESKTOP NAVIGATION (BUY, RENT, SELL) */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => setActivePage('buy')}
              className={`text-sm font-semibold tracking-wide transition-colors py-2 border-b-2 ${
                activePage === 'buy' ? 'border-amber-400 text-amber-400 font-extrabold shadow-[0_4px_12px_rgba(212,175,55,0.2)]' : 'border-transparent text-slate-300 hover:text-slate-100'
              }`}
            >
              {siteConfig?.navbar?.buyLabel || 'BUY'}
            </button>
            
            <button
              onClick={() => setActivePage('rent')}
              className={`text-sm font-semibold tracking-wide transition-colors py-2 border-b-2 ${
                activePage === 'rent' ? 'border-amber-400 text-amber-400 font-extrabold shadow-[0_4px_12px_rgba(212,175,55,0.2)]' : 'border-transparent text-slate-300 hover:text-slate-100'
              }`}
            >
              {siteConfig?.navbar?.rentLabel || 'RENT'}
            </button>
            
            <button
              onClick={() => setActivePage('sell')}
              className={`text-sm font-semibold tracking-wide transition-colors py-2 border-b-2 ${
                activePage === 'sell' ? 'border-amber-400 text-amber-400 font-extrabold shadow-[0_4px_12px_rgba(212,175,55,0.2)]' : 'border-transparent text-slate-300 hover:text-slate-100'
              }`}
            >
              {siteConfig?.navbar?.sellLabel || 'SELL'}
            </button>
          </nav>

          {/* RIGHT ACTION CONTROLS */}
          <div className="hidden lg:flex items-center gap-5">

            {/* WISHLIST BUTTON - ONLY SHOWN WHEN USER IS LOGGED IN */}
            {user && (
              <button
                onClick={() => setActivePage('wishlist')}
                className="relative p-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors border border-transparent hover:border-slate-700"
                title="My Saved Properties"
              >
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-metallic-gold text-slate-950 text-[11px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-lg border border-amber-300">
                    {wishlistCount}
                  </span>
                )}
              </button>
            )}

            {/* SPECIAL NAVBAR BOX FOR ADMIN: "CHECK LIVE SITE" & "ADMIN SITE STUDIO" */}
            {user && user.role === 'ADMIN' && (
              activePage === 'admin' ? (
                <button
                  onClick={() => setActivePage('home')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-lg border border-emerald-400/40 flex items-center gap-2 transition-all transform hover:scale-105 select-none"
                  title="Preview consumer live site"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-100" />
                  <span>CHECK LIVE SITE</span>
                </button>
              ) : (
                <button
                  onClick={() => setActivePage('admin')}
                  className="bg-metallic-gold hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 border border-amber-300/40 select-none"
                  title="Return to Admin Site Control Studio"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-950" />
                  <span>ADMIN SITE STUDIO</span>
                </button>
              )
            )}

            {/* AUTHENTICATION STATE CONTROL */}
            {user ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActivePage('dashboard')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-colors ${
                    activePage === 'dashboard'
                      ? 'bg-metallic-gold text-slate-950 border-amber-300 font-extrabold shadow-md'
                      : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
                  }`}
                  title="Open User Dashboard"
                >
                  <div className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shadow transition-colors ${
                    activePage === 'dashboard'
                      ? 'bg-slate-950 text-metallic-gold'
                      : 'bg-metallic-gold text-slate-950'
                  }`}>
                    {(user.name || user.displayName || user.email || 'u').charAt(0).toLowerCase()}
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-bold line-clamp-1 max-w-[110px]">
                      {user.name || user.displayName || 'EaseLand User'}
                    </span>
                    <span className="block text-[9px] uppercase font-semibold opacity-80">
                      {user.role === 'ADMIN' ? 'DASHBOARD' : 'Dashboard'}
                    </span>
                  </div>
                </button>

                <button
                  onClick={onOpenProfileSettings}
                  className="p-2 text-slate-300 hover:text-amber-400 hover:bg-slate-800 rounded-xl transition-colors border border-transparent hover:border-slate-700"
                  title="Profile & Security Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>

                <button
                  onClick={onLogoutClick}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors border border-transparent hover:border-slate-700"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="text-xs font-bold text-slate-200 hover:text-amber-400 flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
              >
                <User className="w-4 h-4" />
                <span>LOGIN / REGISTER</span>
              </button>
            )}

            {/* POST PROPERTY PRIMARY BUTTON */}
            <button
              onClick={onPostPropertyClick}
              className="bg-metallic-gold hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-5 py-3 rounded-xl shadow-[0_4px_20px_rgba(212,175,55,0.3)] flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5 border border-amber-300/40"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>POST PROPERTY</span>
            </button>
          </div>

          {/* MOBILE MENU TOGGLE */}
          <div className="flex md:hidden items-center gap-3">
            <button
              onClick={onPostPropertyClick}
              className="bg-brand-yellow text-brand-charcoal font-bold text-xs px-3.5 py-2 rounded-lg"
            >
              Post Property
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-300 hover:text-white"
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
        <div className="md:hidden bg-brand-charcoal border-b border-white/10 px-4 pt-2 pb-6 space-y-3">
          <button
            onClick={() => { setActivePage('home'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-gray-200 font-semibold"
          >
            Home
          </button>
          <button
            onClick={() => { setActivePage('buy'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-gray-200 font-semibold"
          >
            Buy Info
          </button>
          <button
            onClick={() => { setActivePage('rent'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-gray-200 font-semibold"
          >
            Rent Info
          </button>
          <button
            onClick={() => { setActivePage('sell'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-gray-200 font-semibold"
          >
            Sell Info
          </button>

          {user && (
            <button
              onClick={() => { setActivePage('wishlist'); setMobileMenuOpen(false); }}
              className="block w-full text-left py-2 text-brand-yellow font-bold"
            >
              Saved Wishlist Properties ({wishlistCount})
            </button>
          )}

          {user ? (
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="font-bold text-white">{user.name}</span>
              <button onClick={onLogoutClick} className="text-red-400 font-bold">Log Out</button>
            </div>
          ) : (
            <button
              onClick={() => { onLoginClick(); setMobileMenuOpen(false); }}
              className="block w-full text-left py-2 text-brand-yellow font-bold border-t border-white/10"
            >
              Login / Register Account
            </button>
          )}
        </div>
      )}
    </header>
  );
}
