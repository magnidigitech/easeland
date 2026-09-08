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
    <header className="sticky top-0 z-50 bg-brand-charcoal text-white border-b border-white/10 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* LOGO - Returns Admin to Admin Studio or Users to Homepage */}
          <div 
            onClick={() => setActivePage(user?.role === 'ADMIN' ? 'admin' : 'home')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <img
              src={siteConfig.navbar?.logoEmblemUrl || "/easeland_emblem_transparent.png"}
              alt="EaseLand Logo"
              className="h-11 w-auto object-contain group-hover:scale-105 transition-transform"
            />
            <div>
              <span className="text-2xl font-extrabold tracking-tight text-white font-sans">
                {siteConfig.navbar?.logoTextPrefix || 'Ease'}<span className="text-brand-yellow">{siteConfig.navbar?.logoTextSuffix || 'Land'}</span>
              </span>
              <span className="block text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
                {user?.role === 'ADMIN' ? 'Admin Site Control Studio' : (siteConfig.navbar?.logoSubtext || 'Direct Property Platform')}
              </span>
            </div>
          </div>

          {/* DESKTOP NAVIGATION (BUY, RENT, SELL) */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => setActivePage('buy')}
              className={`text-sm font-semibold tracking-wide transition-colors py-2 border-b-2 ${
                activePage === 'buy' ? 'border-brand-yellow text-brand-yellow' : 'border-transparent text-gray-300 hover:text-white'
              }`}
            >
              {siteConfig.navbar?.buyLabel || 'BUY'}
            </button>
            
            <button
              onClick={() => setActivePage('rent')}
              className={`text-sm font-semibold tracking-wide transition-colors py-2 border-b-2 ${
                activePage === 'rent' ? 'border-brand-yellow text-brand-yellow' : 'border-transparent text-gray-300 hover:text-white'
              }`}
            >
              {siteConfig.navbar?.rentLabel || 'RENT'}
            </button>
            
            <button
              onClick={() => setActivePage('sell')}
              className={`text-sm font-semibold tracking-wide transition-colors py-2 border-b-2 ${
                activePage === 'sell' ? 'border-brand-yellow text-brand-yellow' : 'border-transparent text-gray-300 hover:text-white'
              }`}
            >
              {siteConfig.navbar?.sellLabel || 'SELL'}
            </button>
          </nav>

          {/* RIGHT ACTION CONTROLS */}
          <div className="hidden lg:flex items-center gap-5">

            {/* WISHLIST BUTTON - ONLY SHOWN WHEN USER IS LOGGED IN */}
            {user && (
              <button
                onClick={() => setActivePage('wishlist')}
                className="relative p-2.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                title="My Saved Properties"
              >
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-brand-yellow text-brand-charcoal text-[11px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow">
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
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-lg border border-emerald-400/30 flex items-center gap-2 transition-all transform hover:scale-105 select-none"
                  title="Preview consumer live site"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-100" />
                  <span>CHECK LIVE SITE</span>
                </button>
              ) : (
                <button
                  onClick={() => setActivePage('admin')}
                  className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 select-none"
                  title="Return to Admin Site Control Studio"
                >
                  <ShieldCheck className="w-4 h-4 text-brand-charcoal" />
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
                      ? 'bg-brand-yellow text-brand-charcoal border-brand-yellow font-extrabold shadow'
                      : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
                  }`}
                  title="Open User Dashboard"
                >
                  <div className="w-7 h-7 rounded-lg bg-brand-yellow text-brand-charcoal font-black text-xs flex items-center justify-center">
                    {user.name ? user.name.charAt(0).toLowerCase() : 'u'}
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-bold line-clamp-1 max-w-[100px]">
                      {user.name}
                    </span>
                    <span className="block text-[9px] uppercase font-semibold opacity-80">
                      Dashboard
                    </span>
                  </div>
                </button>

                <button
                  onClick={onOpenProfileSettings}
                  className="p-2 text-gray-300 hover:text-brand-yellow hover:bg-white/10 rounded-xl transition-colors"
                  title="Profile & Security Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>

                <button
                  onClick={onLogoutClick}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-xl transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="text-xs font-bold text-white hover:text-brand-yellow flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors"
              >
                <User className="w-4 h-4" />
                <span>LOGIN / REGISTER</span>
              </button>
            )}

            {/* POST PROPERTY PRIMARY BUTTON */}
            <button
              onClick={onPostPropertyClick}
              className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-5 py-3 rounded-xl shadow-lg flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5"
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
