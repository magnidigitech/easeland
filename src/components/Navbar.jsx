import React, { useState, useEffect } from 'react';
import { Building2, Heart, PlusCircle, User, ShieldCheck, LogOut, Settings, Briefcase } from 'lucide-react';
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
              <span className="block text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                {user?.role === 'ADMIN' ? 'Admin Site Control Studio' : (siteConfig?.navbar?.logoSubtext || 'Direct Property Platform')}
              </span>
            </div>
          </div>

          {/* DESKTOP NAVIGATION (BUY, RENT, SELL) */}
          <nav className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setActivePage('buy')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-widest transition-all duration-200 focus:outline-none focus:ring-0 select-none ${
                activePage === 'buy'
                  ? 'text-amber-600 bg-amber-500/10 border border-amber-400/50 shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-transparent font-bold'
              }`}
            >
              {siteConfig?.navbar?.buyLabel || 'BUY'}
            </button>
            
            <button
              onClick={() => setActivePage('rent')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-widest transition-all duration-200 focus:outline-none focus:ring-0 select-none ${
                activePage === 'rent'
                  ? 'text-amber-600 bg-amber-500/10 border border-amber-400/50 shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-transparent font-bold'
              }`}
            >
              {siteConfig?.navbar?.rentLabel || 'RENT'}
            </button>
            
            <button
              onClick={() => setActivePage('sell')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-widest transition-all duration-200 focus:outline-none focus:ring-0 select-none ${
                activePage === 'sell'
                  ? 'text-amber-600 bg-amber-500/10 border border-amber-400/50 shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-transparent font-bold'
              }`}
            >
              {siteConfig?.navbar?.sellLabel || 'SELL'}
            </button>
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

            {/* SPECIAL NAVBAR BOX FOR ADMIN: "CHECK LIVE SITE" & "ADMIN SITE STUDIO" & "CRM STUDIO" */}
            {user && user.role === 'ADMIN' && (
              <div className="flex items-center gap-2">
                {activePage === 'admin' ? (
                  <button
                    onClick={() => setActivePage('home')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md border border-emerald-500 flex items-center gap-1.5 transition-all transform hover:scale-105 select-none"
                    title="Preview consumer live site"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-100" />
                    <span>CHECK LIVE SITE</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setActivePage('admin')}
                    className="bg-metallic-gold hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition-all transform hover:scale-105 border border-amber-300 select-none"
                    title="Return to Admin Site Control Studio"
                  >
                    <ShieldCheck className="w-4 h-4 text-slate-950" />
                    <span>ADMIN STUDIO</span>
                  </button>
                )}

                <button
                  onClick={() => setActivePage('crm')}
                  className={`font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md border flex items-center gap-1.5 transition-all select-none ${
                    activePage === 'crm'
                      ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/50'
                      : 'bg-slate-900 text-white border-slate-700 hover:bg-slate-800'
                  }`}
                  title="Open EaseLand CRM Studio"
                >
                  <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                  <span>CRM STUDIO</span>
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
          <div className="flex md:hidden items-center gap-3">
            <button
              onClick={onPostPropertyClick}
              className="bg-metallic-gold text-slate-950 font-bold text-xs px-3.5 py-2 rounded-lg"
            >
              Post Property
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-700 hover:text-slate-900"
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
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-3">
          <button
            onClick={() => { setActivePage('home'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-slate-800 font-semibold"
          >
            Home
          </button>
          <button
            onClick={() => { setActivePage('buy'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-slate-800 font-semibold"
          >
            Buy Info
          </button>
          <button
            onClick={() => { setActivePage('rent'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-slate-800 font-semibold"
          >
            Rent Info
          </button>
          <button
            onClick={() => { setActivePage('sell'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-slate-800 font-semibold"
          >
            Sell Info
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
