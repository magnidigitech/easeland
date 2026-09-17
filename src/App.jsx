import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HeroSearch from './components/HeroSearch';
import PropertyCategoryCards from './components/PropertyCategoryCards';
import UniversalMapEngine from './components/UniversalMapEngine';
import PropertyDetailsView from './components/PropertyDetailsView';
import PropertyDetailPage from './pages/PropertyDetailPage';
import AuthModal from './components/AuthModal';
import ProfileSettingsModal from './components/ProfileSettingsModal';
import BuyInfoPage from './pages/BuyInfoPage';
import RentInfoPage from './pages/RentInfoPage';
import SellInfoPage from './pages/SellInfoPage';
import PostPropertyWizard from './pages/PostPropertyWizard';
import AdminPortal from './pages/AdminPortal';
import UserDashboard from './components/UserDashboard';
import PropertiesSearchPage from './pages/PropertiesSearchPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import { mockApi, applySiteTheme, safeArray } from './services/mockApi';
import { useAuth } from './context/AuthContext';
import { urlParamsToSearchState, searchStateToUrlParams } from './firebase/searchUrl.js';
import { getSiteConfigAdmin } from './firebase/siteManagementService.js';
import { ShieldCheck, Search, Building2, MapPin, Heart, ChevronRight, Send, CheckCircle2, ChevronDown } from 'lucide-react';

const getInitialPageState = () => {
  if (typeof window === 'undefined') return { page: 'home', propId: null };
  const rawPath = window.location.pathname || '/';
  const cleanPath = rawPath.toLowerCase().replace(/\/$/, '') || '/';
  const search = window.location.search || '';
  const urlParams = new URLSearchParams(search);
  const modeParam = urlParams.get('mode');

  if (cleanPath === '/' || cleanPath === '') {
    return { page: 'home', propId: null };
  }

  const propertyMatch = cleanPath.match(/\/property\/([a-zA-Z0-9_-]+)/);
  if (propertyMatch && propertyMatch[1]) {
    return { page: 'property-detail', propId: propertyMatch[1] };
  }

  if (cleanPath.startsWith('/properties')) return { page: 'map', propId: null };
  if (cleanPath === '/admin' || modeParam === 'admin') return { page: 'admin', propId: null };
  if (cleanPath === '/buy') return { page: 'buy', propId: null };
  if (cleanPath === '/rent') return { page: 'rent', propId: null };
  if (cleanPath === '/sell') return { page: 'sell', propId: null };
  if (cleanPath === '/post-property') return { page: 'post-property', propId: null };
  if (cleanPath === '/dashboard') return { page: 'dashboard', propId: null };
  if (cleanPath === '/wishlist') return { page: 'wishlist', propId: null };
  if (cleanPath === '/privacy-policy' || cleanPath === '/privacy') return { page: 'privacy-policy', propId: null };

  return { page: 'home', propId: null };
};

export default function App() {
  const { user: authUser, profile: authProfile, loading: authLoading, logoutUser } = useAuth();
  const [initialPageState] = useState(getInitialPageState);
  const [activePage, setActivePage] = useState(initialPageState.page);

  const isAdminSession = Boolean(
    authUser?.email === 'admin@easeland.in' ||
    authUser?.email?.includes('admin') ||
    authProfile?.role === 'ADMIN' ||
    authProfile?.adminRole ||
    (typeof window !== 'undefined' && localStorage.getItem('easeland_admin_authenticated') === 'true')
  );

  const currentUser = authUser ? {
    uid: authUser.uid,
    id: authUser.uid,
    name: authProfile?.displayName || authUser.displayName || (isAdminSession ? 'EaseLand Admin' : 'EaseLand User'),
    email: authUser.email,
    phone: authProfile?.phone || authProfile?.phoneNumber || authUser?.phoneNumber || '',
    role: isAdminSession ? 'ADMIN' : (authProfile?.role || 'USER'),
    adminRole: isAdminSession,
    capabilities: isAdminSession ? ['ADMIN', 'CUSTOMER', 'OWNER'] : (authProfile?.capabilities || ['CUSTOMER', 'OWNER']),
    ownerVerificationState: isAdminSession ? 'VERIFIED' : (authProfile?.ownerVerificationState || 'NOT_VERIFIED')
  } : null;

  // Auth & Profile Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState(null);

  // Search & Filter State
  const [filters, setFilters] = useState({
    query: '',
    purpose: '',
    propertyType: '',
    state: '',
    district: '',
    city: '',
    locality: '',
    minPrice: '',
    maxPrice: '',
    minArea: '',
    maxArea: '',
    bedrooms: '',
    facing: '',
    furnishing: '',
    amenities: [],
    sortBy: 'newest'
  });

  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [activePropertyId, setActivePropertyId] = useState(initialPageState.propId);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [faqOpenIndex, setFaqOpenIndex] = useState(null);
  const [siteConfig, setSiteConfig] = useState(mockApi.getSiteConfig());

  // General Contact Us Form State
  const [generalContact, setGeneralContact] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [generalContactSubmitted, setGeneralContactSubmitted] = useState(false);
  const [generalContactLoading, setGeneralContactLoading] = useState(false);

  // Fetch properties based on active filters
  const loadProperties = () => {
    const data = mockApi.getPublicProperties(filters);
    setProperties(data);
    setWishlistCount(mockApi.getWishlist().length);
  };

  const changeActivePage = (pageName, propId = null) => {
    setActivePage(pageName);
    try {
      localStorage.setItem('easeland_active_page', pageName);

      let targetPath = '/';
      if (pageName === 'property-detail' && propId) {
        setActivePropertyId(propId);
        targetPath = `/property/${propId}`;
      } else if (pageName === 'map' || pageName === 'properties') {
        const queryParams = searchStateToUrlParams(filters);
        const searchString = queryParams.toString();
        targetPath = searchString ? `/properties?${searchString}` : '/properties';
      } else if (pageName === 'admin') {
        targetPath = '/admin';
      } else if (pageName === 'buy') {
        targetPath = '/buy';
      } else if (pageName === 'rent') {
        targetPath = '/rent';
      } else if (pageName === 'sell') {
        targetPath = '/sell';
      } else if (pageName === 'post-property') {
        targetPath = '/post-property';
      } else if (pageName === 'dashboard') {
        targetPath = '/dashboard';
      } else if (pageName === 'wishlist') {
        targetPath = '/wishlist';
      } else if (pageName === 'privacy-policy' || pageName === 'privacy') {
        targetPath = '/privacy-policy';
      } else {
        targetPath = '/';
      }

      if (window.location.pathname + window.location.search !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    } catch (err) {}
  };

  const syncStateFromUrl = () => {
    const rawPath = window.location.pathname || '/';
    const cleanPath = rawPath.toLowerCase().replace(/\/$/, '') || '/';
    const search = window.location.search || '';
    const urlParams = new URLSearchParams(search);
    const modeParam = urlParams.get('mode');

    if (cleanPath === '/' || cleanPath === '') {
      setActivePage('home');
      try { localStorage.setItem('easeland_active_page', 'home'); } catch(e){}
      return;
    }

    const propertyMatch = cleanPath.match(/\/property\/([a-zA-Z0-9_-]+)/);
    if (propertyMatch && propertyMatch[1]) {
      setActivePropertyId(propertyMatch[1]);
      setActivePage('property-detail');
      try { localStorage.setItem('easeland_active_page', 'property-detail'); } catch(e){}
      return;
    }

    if (cleanPath.startsWith('/properties')) {
      const parsedFilters = urlParamsToSearchState(search);
      setFilters(prev => ({ ...prev, ...parsedFilters }));
      setActivePage('map');
      try { localStorage.setItem('easeland_active_page', 'map'); } catch(e){}
      return;
    }

    if (cleanPath === '/admin' || modeParam === 'admin') {
      setActivePage('admin');
      try { localStorage.setItem('easeland_active_page', 'admin'); } catch(e){}
      return;
    }

    if (cleanPath === '/buy') {
      setActivePage('buy');
      try { localStorage.setItem('easeland_active_page', 'buy'); } catch(e){}
      return;
    }

    if (cleanPath === '/rent') {
      setActivePage('rent');
      try { localStorage.setItem('easeland_active_page', 'rent'); } catch(e){}
      return;
    }

    if (cleanPath === '/sell') {
      setActivePage('sell');
      try { localStorage.setItem('easeland_active_page', 'sell'); } catch(e){}
      return;
    }

    if (cleanPath === '/post-property') {
      setActivePage('post-property');
      try { localStorage.setItem('easeland_active_page', 'post-property'); } catch(e){}
      return;
    }

    if (cleanPath === '/dashboard') {
      setActivePage('dashboard');
      try { localStorage.setItem('easeland_active_page', 'dashboard'); } catch(e){}
      return;
    }

    if (cleanPath === '/wishlist') {
      setActivePage('wishlist');
      try { localStorage.setItem('easeland_active_page', 'wishlist'); } catch(e){}
      return;
    }

    if (cleanPath === '/privacy-policy' || cleanPath === '/privacy') {
      setActivePage('privacy-policy');
      try { localStorage.setItem('easeland_active_page', 'privacy-policy'); } catch(e){}
      return;
    }

    setActivePage('home');
    try { localStorage.setItem('easeland_active_page', 'home'); } catch(e){}
  };

  useEffect(() => {
    // 1. Synchronize state with current URL on mount / reload
    syncStateFromUrl();

    // 2. Handle PopState Browser History Navigation
    const handlePopState = () => {
      syncStateFromUrl();
    };
    window.addEventListener('popstate', handlePopState);

    // 3. Listen for session profile updates
    const handleProfileUpdated = () => {};
    window.addEventListener('easeland-user-profile-updated', handleProfileUpdated);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('easeland-user-profile-updated', handleProfileUpdated);
    };
  }, []);

  useEffect(() => {
    loadProperties();
    
    getSiteConfigAdmin().then(res => {
      if (res && res.success && res.config && Object.keys(res.config).length > 0) {
        setSiteConfig(prev => ({ ...prev, ...res.config }));
        if (res.config.theme) applySiteTheme(res.config.theme);
      }
    }).catch(err => console.warn('Live CMS config fetch warning:', err));

    if (siteConfig && siteConfig.theme) {
      applySiteTheme(siteConfig.theme);
    }
    const handleApproved = () => loadProperties();
    const handleConfigUpdated = (e) => {
      const updatedConfig = e.detail || mockApi.getSiteConfig();
      setSiteConfig(updatedConfig);
      if (updatedConfig && updatedConfig.theme) {
        applySiteTheme(updatedConfig.theme);
      }
    };

    window.addEventListener('easeland-property-approved', handleApproved);
    window.addEventListener('easeland-site-config-updated', handleConfigUpdated);

    return () => {
      window.removeEventListener('easeland-property-approved', handleApproved);
      window.removeEventListener('easeland-site-config-updated', handleConfigUpdated);
    };
  }, [filters, activePage]);

  const handleHeroSearch = (searchPayload) => {
    setFilters(prev => ({
      ...prev,
      cleared: false,
      ...searchPayload
    }));
    changeActivePage('map');
  };


  const handleCategorySelect = (catTitle) => {
    setFilters(prev => ({
      ...prev,
      cleared: false,
      category: catTitle
    }));
    changeActivePage('map');
  };

  const handleSelectProperty = (prop) => {
    const propId = prop.propertyId || prop.id;
    setSelectedProperty(prop);
    setActivePropertyId(propId);
    changeActivePage('property-detail', propId);
  };

  const handleWishlistToggle = (propertyId) => {
    mockApi.toggleWishlist(propertyId);
    setWishlistCount(mockApi.getWishlist().length);
    loadProperties();
  };

  const [editingPropertyId, setEditingPropertyId] = useState(null);

  const handlePostPropertyClick = (propId = null) => {
    const targetPropId = typeof propId === 'string' ? propId : null;
    setEditingPropertyId(targetPropId);
    if (!currentUser) {
      setAuthIntent('post-property');
      setIsAuthModalOpen(true);
    } else {
      changeActivePage('post-property');
    }
  };

  const handleAuthSuccess = (authenticatedUser, intent) => {
    if (intent === 'post-property') {
      changeActivePage('post-property');
    } else {
      changeActivePage('dashboard');
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    try { localStorage.removeItem('easeland_admin_authenticated'); } catch(e){}
    changeActivePage('home');
  };

  const handleGeneralContactSubmit = (e) => {
    e.preventDefault();
    setGeneralContactLoading(true);
    setTimeout(() => {
      setGeneralContactLoading(false);
      setGeneralContactSubmitted(true);
    }, 600);
  };

  const faqs = safeArray(siteConfig?.faqs || siteConfig?.faq).map(f => ({
    q: f?.question || f?.q || f?.title || '',
    a: f?.answer || f?.a || f?.desc || ''
  }));

  return (
    <div className="min-h-screen bg-brand-offwhite text-brand-charcoal font-sans flex flex-col">
      
      {/* NAVBAR */}
      <Navbar
        activePage={activePage}
        setActivePage={changeActivePage}
        wishlistCount={wishlistCount}
        user={currentUser}
        onLoginClick={() => {
          setAuthIntent(null);
          setIsAuthModalOpen(true);
        }}
        onLogoutClick={handleLogout}
        onPostPropertyClick={handlePostPropertyClick}
        onOpenProfileSettings={() => setIsProfileModalOpen(true)}
      />

      {/* ADMIN LIVE SITE INSPECTION MODE BAR */}
      {currentUser && currentUser.role === 'ADMIN' && activePage !== 'admin' && (
        <div className="bg-emerald-700 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md border-b border-emerald-600">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-300 animate-pulse" />
            <span>YOU ARE VIEWING THE LIVE SITE (ADMIN PREVIEW MODE). All text, colors & elements match your Admin Studio edits.</span>
          </div>
          <button
            onClick={() => changeActivePage('admin')}
            className="bg-emerald-900 hover:bg-emerald-950 text-emerald-200 font-extrabold px-3 py-1 rounded-lg border border-emerald-500/40 text-[11px] transition-colors"
          >
            RETURN TO ADMIN STUDIO →
          </button>
        </div>
      )}

      {/* PAGE ROUTING BODY */}
      <main className="flex-1">

        {/* PAGE 1: HOME */}
        {(activePage === 'home' || !['map', 'properties', 'property-detail', 'buy', 'rent', 'sell', 'post-property', 'admin', 'dashboard', 'wishlist', 'privacy-policy', 'privacy'].includes(activePage)) && (
          <div>
            <HeroSearch onSearch={handleHeroSearch} />
            
            <PropertyCategoryCards onSelectCategory={handleCategorySelect} />

            {/* FEATURED / RECENT VERIFIED PROPERTIES */}
            <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-800 bg-emerald-100 px-3 py-1 rounded-md">
                    Verified Listings
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-extrabold text-brand-charcoal tracking-tight mt-3">
                    Featured & Recent Verified Properties
                  </h2>
                </div>
                <button
                  onClick={() => changeActivePage('map')}
                  className="mt-3 md:mt-0 text-sm font-bold text-brand-charcoal hover:text-brand-yellowHover flex items-center gap-1"
                >
                  <span>Explore All Properties on Map</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {properties.slice(0, 3).map((prop) => (
                  <div
                    key={prop.id}
                    onClick={() => handleSelectProperty(prop)}
                    className="group bg-white rounded-2xl border border-brand-bordergray shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden flex flex-col transform hover:-translate-y-1"
                  >
                    <div className="relative h-48 bg-gray-100 overflow-hidden">
                      <img
                        src={prop.photos?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'}
                        alt={prop.title}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3 bg-brand-charcoal/90 text-brand-yellow text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md flex items-center gap-1 shadow">
                        <ShieldCheck className="w-3 h-3 text-brand-yellow" />
                        <span>{prop.verificationStatus}</span>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-500 font-bold mb-1">
                          <span>{prop.location?.locality}, {prop.location?.city}</span>
                          <span className="text-brand-charcoal">{prop.category}</span>
                        </div>
                        <h3 className="text-base font-bold text-brand-charcoal line-clamp-1 mb-3">
                          {prop.title}
                        </h3>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-gray-400 block font-medium">Listed Price</span>
                          <span className="text-lg font-extrabold text-emerald-700">{prop.priceDisplay}</span>
                        </div>
                        <span className="text-xs font-bold text-brand-charcoal">{prop.areaDisplay}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* PLATFORM INFORMATION SECTION WITH BACKGROUND IMAGE */}
            <section className="relative bg-brand-charcoal text-white py-20 px-4 sm:px-6 lg:px-8 my-12 overflow-hidden">
              <div className="absolute inset-0 opacity-15 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=2000&q=80')" }}></div>
              
              <div className="max-w-5xl mx-auto relative z-10 text-center">
                <span className="text-xs font-extrabold uppercase tracking-widest text-brand-yellow bg-white/10 px-3 py-1 rounded-full border border-white/15">
                  A Simpler Way to Find Property
                </span>

                <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mt-4 mb-6">
                  Empowering Pan-India Property Discovery
                </h2>

                <p className="text-base sm:text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed font-medium mb-8">
                  Search across any state, district, city, locality, road, or village in India. Explore property coordinates visually on an interactive map, inspect surrounding infrastructure, view walkthrough and drone footage, and connect directly with verified property owners.
                </p>

                <div className="inline-flex flex-wrap justify-center gap-6 text-xs font-bold text-brand-yellow">
                  <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> 100% Admin Verified</span>
                  <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" /> Zero Broker Commissions</span>
                  <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Deep Pan-India Geospatial Engine</span>
                </div>
              </div>
            </section>

            {/* FAQ ACCORDION SECTION */}
            <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
              <div className="text-center mb-10">
                <span className="text-xs font-extrabold uppercase tracking-widest text-slate-950 bg-metallic-gold px-3 py-1 rounded-md shadow-md border border-amber-300">
                  Frequently Asked Questions
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100 tracking-tight mt-3">
                  Everything You Need to Know About EaseLand
                </h2>
              </div>

              <div className="space-y-4">
                {faqs.map((faq, idx) => (
                  <div key={idx} className="bg-white rounded-2xl border border-slate-300 overflow-hidden shadow-lg">
                    <button
                      onClick={() => setFaqOpenIndex(faqOpenIndex === idx ? null : idx)}
                      className="w-full p-5 text-left font-bold text-sm sm:text-base text-slate-900 hover:text-amber-600 flex items-center justify-between gap-4 transition-colors"
                    >
                      <span className="text-slate-900 font-bold">{faq.q}</span>
                      <ChevronDown className={`w-5 h-5 text-slate-500 shrink-0 transition-transform ${faqOpenIndex === idx ? 'rotate-180 text-amber-500' : ''}`} />
                    </button>
                    {faqOpenIndex === idx && (
                      <div className="px-5 pb-5 text-xs sm:text-sm text-slate-700 font-medium leading-relaxed border-t border-slate-200 pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* GENERAL CONTACT FORM */}
            <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-300 shadow-xl text-slate-900">
                <h3 className="text-xl font-extrabold text-slate-900 mb-1">Have Questions? Contact EaseLand Admin</h3>
                <p className="text-xs text-slate-600 font-medium mb-6">Website inquiries, platform feedback, or support assistance.</p>

                {generalContactSubmitted ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center text-emerald-900 space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <h4 className="text-base font-bold text-emerald-950">Message Delivered to EaseLand Support!</h4>
                    <p className="text-xs text-emerald-800">Our platform team will review your message and reach out shortly.</p>
                  </div>
                ) : (
                  <form onSubmit={handleGeneralContactSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Your Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Ryuu"
                          value={generalContact.name}
                          onChange={(e) => setGeneralContact({ ...generalContact, name: e.target.value })}
                          className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                        <input
                          type="email"
                          required
                          placeholder="ryuu@example.com"
                          value={generalContact.email}
                          onChange={(e) => setGeneralContact({ ...generalContact, email: e.target.value })}
                          className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
                      <input
                        type="text"
                        required
                        placeholder="Inquiry about platform verification"
                        value={generalContact.subject}
                        onChange={(e) => setGeneralContact({ ...generalContact, subject: e.target.value })}
                        className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Message</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Enter your message here..."
                        value={generalContact.message}
                        onChange={(e) => setGeneralContact({ ...generalContact, message: e.target.value })}
                        className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none resize-none"
                      ></textarea>
                    </div>

                    <button
                      type="submit"
                      disabled={generalContactLoading}
                      className="w-full bg-metallic-gold hover:bg-amber-400 text-slate-950 font-extrabold text-sm py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all border border-amber-300"
                    >
                      <Send className="w-4 h-4 text-slate-950" />
                      <span>{generalContactLoading ? 'Sending Message...' : 'Send Message'}</span>
                    </button>
                  </form>
                )}
              </div>
            </section>
          </div>
        )}

        {/* PAGE 2: PRIMARY MARKETPLACE SEARCH & MAP DISCOVERY (BLOCK 17) */}
        {(activePage === 'map' || activePage === 'properties') && (
          <PropertiesSearchPage
            onNavigateToProperty={(pId) => changeActivePage('property-detail', pId)}
            onOpenAuthModal={() => {
              setAuthIntent('login');
              setIsAuthModalOpen(true);
            }}
          />
        )}

        {/* PAGE 3: PUBLIC PROPERTY DETAIL PAGE (BLOCK 15) */}
        {activePage === 'property-detail' && (
          <PropertyDetailPage
            propertyId={activePropertyId || selectedProperty?.propertyId || selectedProperty?.id}
            onNavigateHome={() => changeActivePage('home')}
            onNavigateMap={() => changeActivePage('map')}
          />
        )}

        {/* INFORMATIONAL PAGES */}
        {activePage === 'buy' && <BuyInfoPage onExploreClick={() => changeActivePage('map')} />}
        {activePage === 'rent' && <RentInfoPage onExploreClick={() => changeActivePage('map')} />}
        {activePage === 'sell' && <SellInfoPage onPostPropertyClick={handlePostPropertyClick} />}

        {/* PRIVACY POLICY PAGE */}
        {(activePage === 'privacy-policy' || activePage === 'privacy') && (
          <PrivacyPolicyPage onBackToHome={() => changeActivePage('home')} />
        )}

        {/* WIZARD & DASHBOARDS */}
        {activePage === 'post-property' && (
          <PostPropertyWizard
            resumePropertyId={editingPropertyId}
            onComplete={() => {
              setEditingPropertyId(null);
              changeActivePage('dashboard');
            }}
            onCancel={() => {
              setEditingPropertyId(null);
              changeActivePage('dashboard');
            }}
          />
        )}

        {activePage === 'admin' && <AdminPortal />}

        {/* USER DASHBOARD (COVERING ALL 7 BLOCKS) */}
        {activePage === 'dashboard' && (
          <UserDashboard
            user={currentUser}
            properties={properties}
            wishlist={mockApi.getWishlist()}
            onWishlistToggle={handleWishlistToggle}
            onNavigate={(page) => changeActivePage(page)}
            onPostProperty={handlePostPropertyClick}
          />
        )}

        {/* WISHLIST VIEW */}
        {activePage === 'wishlist' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="text-2xl font-extrabold text-brand-charcoal mb-6">My Saved Wishlist Properties</h2>
            {mockApi.getWishlist().length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 text-gray-500">
                <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-brand-charcoal">No saved properties yet</h3>
                <button onClick={() => changeActivePage('map')} className="mt-4 bg-brand-yellow text-brand-charcoal font-bold text-xs px-4 py-2.5 rounded-xl">
                  Explore Map to Save Properties
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {mockApi.getWishlist().map((prop) => (
                  <div key={prop.id} onClick={() => handleSelectProperty(prop)} className="bg-white rounded-2xl border p-4 cursor-pointer shadow-sm">
                    <img src={prop.photos?.[0]} alt="" className="w-full h-40 object-cover rounded-xl mb-3" />
                    <h3 className="text-sm font-bold line-clamp-1">{prop.title}</h3>
                    <span className="text-sm font-extrabold text-emerald-700 block mt-1">{prop.priceDisplay}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* AUTH MODAL */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        initialIntent={authIntent}
      />

      {/* FOOTER (Hidden on Map & Admin Portal for clean full height canvas) */}
      {activePage !== 'map' && activePage !== 'admin' && (
        <footer className="bg-brand-charcoal text-white pt-12 pb-8 border-t border-white/10 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 pb-8 border-b border-white/10 text-xs">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <img
                  src="/easeland_emblem_transparent.png"
                  alt="EaseLand Logo"
                  className="h-10 w-auto object-contain"
                />
                <div>
                  <span className="text-xl font-extrabold tracking-tight text-white font-sans">
                    Ease<span className="text-brand-yellow">Land</span>
                  </span>
                  <span className="block text-[9px] uppercase tracking-widest text-gray-400 font-semibold">
                    Direct Property Platform
                  </span>
                </div>
              </div>
              <p className="text-gray-400 leading-relaxed font-medium">
                {siteConfig?.footer?.tagline || 'EaseLand is India\'s premier direct property discovery and verification marketplace. Zero brokerage, 100% verified land titles and plot boundaries.'}
              </p>
            </div>

            <div>
              <h4 className="font-extrabold text-brand-yellow uppercase tracking-wider mb-3">Explore</h4>
              <ul className="space-y-2 text-gray-300 font-semibold">
                <li><button onClick={() => changeActivePage('buy')} className="hover:text-white">Buy Property Info</button></li>
                <li><button onClick={() => changeActivePage('rent')} className="hover:text-white">Rent Property Info</button></li>
                <li><button onClick={() => changeActivePage('sell')} className="hover:text-white">Sell Property Info</button></li>
                <li><button onClick={() => changeActivePage('map')} className="hover:text-white">Explore Universal Map</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-extrabold text-brand-yellow uppercase tracking-wider mb-3">For Owners</h4>
              <ul className="space-y-2 text-gray-300 font-semibold">
                <li><button onClick={handlePostPropertyClick} className="hover:text-white">Post Free Listing</button></li>
                <li><button onClick={() => changeActivePage('sell')} className="hover:text-white">Verification Process</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-extrabold text-brand-yellow uppercase tracking-wider mb-3">Legal & Support</h4>
              <ul className="space-y-2 text-gray-400 text-xs">
                <li><button onClick={() => changeActivePage('privacy-policy')} className="hover:text-white font-bold text-brand-yellow underline">Privacy Policy</button></li>
                <li><span>{siteConfig?.footer?.officeAddress}</span></li>
                <li><span>Phone: {siteConfig?.footer?.supportPhone}</span></li>
                <li><span>Email: {siteConfig?.footer?.supportEmail}</span></li>
              </ul>
            </div>
          </div>

          <div className="text-center text-[11px] text-gray-500 font-semibold">
            {siteConfig?.footer?.copyrightText || '© 2026 EaseLand Platform India Private Limited. All Rights Reserved.'}
          </div>
        </div>
      </footer>
      )}

      {/* PROFILE & SECURITY SETTINGS MODAL */}
      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

    </div>
  );
}
