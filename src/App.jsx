import React, { useState, useEffect, useMemo } from 'react';
import Navbar from './components/Navbar';
import HeroSearch from './components/HeroSearch';
import PropertyCategoryCards from './components/PropertyCategoryCards';
import UniversalMapEngine from './components/UniversalMapEngine';
import PropertyDetailsView from './components/PropertyDetailsView';
import PropertyDetailPage from './pages/PropertyDetailPage';
import AuthModal from './components/AuthModal';
import MandatoryProfileModal from './components/MandatoryProfileModal';
import ProfileSettingsModal from './components/ProfileSettingsModal';
import TwoFactorModal from './components/TwoFactorModal';
import VisitorLeadModal from './components/VisitorLeadModal';
import BuyInfoPage from './pages/BuyInfoPage';
import RentInfoPage from './pages/RentInfoPage';
import SellInfoPage from './pages/SellInfoPage';
import PostPropertyWizard from './pages/PostPropertyWizard';
import AdminPortal from './pages/AdminPortal';
import EaseLandCRM from './pages/EaseLandCRM';
import UserDashboard from './components/UserDashboard';
import PropertiesSearchPage, { matchesSearchFilters, isPropertyPubliclyVisible, isPropertyDeleted } from './pages/PropertiesSearchPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import PwaInstallBanner from './components/PwaInstallBanner';
import OfflineIndicator from './components/OfflineIndicator';
import PwaUpdatePrompt from './components/PwaUpdatePrompt';
import { mockApi, applySiteTheme, safeArray, deduplicateProperties, isFakeProperty } from './services/mockApi';
import { useAuth } from './context/AuthContext';
import { urlParamsToSearchState, searchStateToUrlParams, createDefaultFilterState } from './firebase/searchUrl.js';
import { getSiteConfigAdmin } from './firebase/siteManagementService.js';
import { searchPublicProperties } from './firebase/searchService.js';
import { getUserWishlistProperties, removeWishlistProperty } from './firebase/wishlistService.js';
import { getFirstUploadedImage, getCategoryFallbackImage } from './utils/categoryUtils.js';
import { trackPageView } from './utils/metaPixel.js';
import { parseRouteFromUrl } from './utils/routeUtils.js';
import { ShieldCheck, Search, Building2, MapPin, Heart, ChevronRight, Send, CheckCircle2, ChevronDown, ChevronUp, AlertTriangle, X, Settings, User, Sparkles } from 'lucide-react';
import { DEFAULT_SHOWCASE_PROPERTIES } from './services/showcaseProperties.js';
import AnimatedPromotionBanner from './components/AnimatedPromotionBanner.jsx';

export const getInitialPageState = parseRouteFromUrl;

export default function App() {
  const { user: authUser, profile: authProfile, loading: authLoading, logoutUser, pending2FASession, complete2FASession, cancel2FASession, isProfileIncomplete } = useAuth();
  const [initialPageState] = useState(getInitialPageState);
  const [activePage, setActivePage] = useState(initialPageState.page);

  const isAdminSession = Boolean(
    authUser?.email === 'admin@easeland.in' ||
    authUser?.email?.includes('admin') ||
    authProfile?.role === 'ADMIN' ||
    authProfile?.adminRole ||
    (typeof window !== 'undefined' && localStorage.getItem('easeland_admin_authenticated') === 'true')
  );

  const sanitizePhone = (ph) => {
    if (!ph) return '';
    const str = String(ph).trim();
    const lower = str.toLowerCase();
    if (
      lower === 'n/a' ||
      lower === 'null' ||
      lower === 'undefined' ||
      str === '+91 N/A'
    ) return '';
    return str;
  };

  const [profileRefreshTick, setProfileRefreshTick] = useState(0);

  useEffect(() => {
    const handleProfileUpdate = () => {
      setProfileRefreshTick(t => t + 1);
      setIsProfileWarningOpen(false);
    };
    window.addEventListener('easeland-user-profile-updated', handleProfileUpdate);
    window.addEventListener('easeland-admin-updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);
    return () => {
      window.removeEventListener('easeland-user-profile-updated', handleProfileUpdate);
      window.removeEventListener('easeland-admin-updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, []);

  const currentUser = useMemo(() => {
    if (!authUser) return null;
    let localStored = {};
    if (typeof window !== 'undefined' && authUser?.uid) {
      try {
        const storedStr = localStorage.getItem('easeland_user_profile_' + authUser.uid) || localStorage.getItem('easeland_session_user');
        if (storedStr) localStored = JSON.parse(storedStr);
      } catch (e) {}
    }
    const adminPhone = typeof window !== 'undefined' ? (localStorage.getItem('easeland_admin_phone') || '') : '';
    const adminCity = typeof window !== 'undefined' ? (localStorage.getItem('easeland_admin_city') || 'Guntur, Andhra Pradesh') : 'Guntur, Andhra Pradesh';

    const activeName = authProfile?.displayName || authProfile?.name || authUser.displayName || authUser.name || localStored.displayName || localStored.name || (isAdminSession ? 'EaseLand Admin' : 'EaseLand User');
    const activeEmail = authProfile?.email || authUser.email || localStored.email || '';
    const activePhone = sanitizePhone(
      authProfile?.phone || authProfile?.phoneNumber ||
      authUser?.phoneNumber || authUser?.phone ||
      localStored.phone || localStored.phoneNumber ||
      (isAdminSession ? adminPhone : '')
    );
    const activeCity = (
      authProfile?.city || authProfile?.location ||
      authUser?.city || authUser?.location ||
      localStored.city || localStored.location ||
      (isAdminSession ? adminCity : '')
    ).trim();

    return {
      uid: authUser.uid,
      id: authUser.uid,
      name: activeName,
      displayName: activeName,
      email: activeEmail,
      phone: activePhone,
      phoneNumber: activePhone,
      city: activeCity,
      location: activeCity,
      role: isAdminSession ? 'ADMIN' : (authProfile?.role || 'USER'),
      adminRole: isAdminSession,
      capabilities: isAdminSession ? ['ADMIN', 'CUSTOMER', 'OWNER'] : (authProfile?.capabilities || ['CUSTOMER', 'OWNER']),
      ownerVerificationState: isAdminSession ? 'VERIFIED' : (authProfile?.ownerVerificationState || 'NOT_VERIFIED')
    };
  }, [
    authUser?.uid,
    authUser?.email,
    authUser?.displayName,
    authUser?.phoneNumber,
    authProfile?.displayName,
    authProfile?.name,
    authProfile?.email,
    authProfile?.phone,
    authProfile?.phoneNumber,
    authProfile?.city,
    authProfile?.location,
    authProfile?.role,
    authProfile?.ownerVerificationState,
    isAdminSession,
    profileRefreshTick
  ]);

  // Auth & Profile Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState(null);
  const [dashboardTab, setDashboardTab] = useState(() => {
    if (initialPageState.page === 'dashboard' && initialPageState.tab) {
      return initialPageState.tab;
    }
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('easeland_active_dashboard_tab');
        if (saved) return saved;
      } catch (e) {}
    }
    return 'overview';
  });
  const [dashboardTabKey, setDashboardTabKey] = useState(Date.now());

  // Search & Filter State
  const [filters, setFilters] = useState(() => {
    if (initialPageState.filters) {
      return createDefaultFilterState(initialPageState.filters);
    }
    return {
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
    };
  });

  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [activePropertyId, setActivePropertyId] = useState(initialPageState.propId);
  const [wishlistProperties, setWishlistProperties] = useState([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [faqOpenIndex, setFaqOpenIndex] = useState(null);
  const [siteConfig, setSiteConfig] = useState(mockApi.getSiteConfig());

  // Real-time Wishlist Refresh Handler across Firestore & Local Storage
  const refreshWishlist = async () => {
    const uid = currentUser?.uid || currentUser?.id;
    try {
      const res = await getUserWishlistProperties(uid);
      if (res && res.success && Array.isArray(res.properties)) {
        const validWishlist = res.properties.filter(p => !isPropertyDeleted(p));
        setWishlistProperties(validWishlist);
        setWishlistCount(validWishlist.length);
      } else {
        setWishlistProperties([]);
        setWishlistCount(0);
      }
    } catch (err) {
      setWishlistProperties([]);
      setWishlistCount(0);
    }
  };

  useEffect(() => {
    refreshWishlist();

    const handleWishlistUpdated = () => refreshWishlist();
    window.addEventListener('easeland-wishlist-updated', handleWishlistUpdated);
    return () => {
      window.removeEventListener('easeland-wishlist-updated', handleWishlistUpdated);
    };
  }, [currentUser]);

  // General Contact Us Form State
  const [generalContact, setGeneralContact] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [generalContactSubmitted, setGeneralContactSubmitted] = useState(false);
  const [generalContactLoading, setGeneralContactLoading] = useState(false);

  // Fetch properties based on active filters (Live PostgreSQL + Firestore + LocalStorage)
  const loadProperties = async () => {
    let pgProperties = [];
    try {
      const res = await fetch('/api/properties?publicOnly=true');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.properties)) {
          pgProperties = json.properties;
        }
      }
    } catch (pgErr) {}

    let fsProperties = [];
    try {
      const result = await searchPublicProperties({
        searchState: filters,
        pageSize: 100
      });
      if (result.success && Array.isArray(result.properties)) {
        fsProperties = result.properties;
      }
    } catch (fsErr) {}

    const localData = mockApi.getPublicProperties(filters) || [];

    const candidateProps = [...pgProperties, ...fsProperties, ...localData].filter(p => !isPropertyDeleted(p) && !isFakeProperty(p) && isPropertyPubliclyVisible(p));
    const hasActiveFilters = filters && Object.values(filters).some(v => v !== '' && v !== null && v !== undefined && v !== 'All' && v !== 'ALL');
    const filteredCandidates = hasActiveFilters ? candidateProps.filter(p => matchesSearchFilters(p, filters)) : candidateProps;

    const merged = deduplicateProperties(filteredCandidates);
    setProperties(merged);
    refreshWishlist();
  };

  const [editingPropertyId, setEditingPropertyId] = useState(null);
  const [incompleteProfileFields, setIncompleteProfileFields] = useState([]);
  const [isProfileWarningOpen, setIsProfileWarningOpen] = useState(false);

  const checkProfileComplete = (u, p) => {
    const missing = [];
    const uid = u?.uid || p?.uid || authUser?.uid;
    let localStored = {};
    if (typeof window !== 'undefined' && uid) {
      try {
        const storedStr = localStorage.getItem('easeland_user_profile_' + uid) || localStorage.getItem('easeland_session_user');
        if (storedStr) localStored = JSON.parse(storedStr);
      } catch (e) {}
    }
    const adminPhone = typeof window !== 'undefined' ? (localStorage.getItem('easeland_admin_phone') || '') : '';
    const adminCity = typeof window !== 'undefined' ? (localStorage.getItem('easeland_admin_city') || (isAdminSession ? 'Guntur, Andhra Pradesh' : '')) : (isAdminSession ? 'Guntur, Andhra Pradesh' : '');

    const name = (u?.name || u?.displayName || p?.name || p?.displayName || localStored.displayName || localStored.name || (isAdminSession ? 'EaseLand Admin' : '')).trim();
    const email = (u?.email || p?.email || localStored.email || '').trim();
    const phone = sanitizePhone(
      u?.phone || u?.phoneNumber ||
      p?.phone || p?.phoneNumber ||
      localStored.phone || localStored.phoneNumber ||
      adminPhone
    );
    const city = (
      u?.city || u?.location ||
      p?.city || p?.location ||
      localStored.city || localStored.location ||
      adminCity
    ).trim();

    if (!name) missing.push('Full Name');
    if (!email) missing.push('Email Address');
    if (!phone) missing.push('Phone Number');
    if (!city) missing.push('City / Location');

    return missing;
  };

  const navigateToAccountSettings = (mode = 'dashboard') => {
    setIsProfileWarningOpen(false);

    if (mode === 'popup') {
      setIsProfileModalOpen(true);
      return;
    }

    setDashboardTab('account');
    setDashboardTabKey(Date.now());
    changeActivePage('dashboard', { tab: 'account' });

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      const section = document.getElementById('account-profile-settings-section');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const missingName = document.getElementById('account-profile-name');
      const missingEmail = document.getElementById('account-profile-email');
      const missingPhone = document.getElementById('account-profile-phone');
      const missingCity = document.getElementById('account-profile-city');

      if (missingName && !missingName.value) missingName.focus();
      else if (missingEmail && !missingEmail.value) missingEmail.focus();
      else if (missingPhone && !missingPhone.value) missingPhone.focus();
      else if (missingCity && !missingCity.value) missingCity.focus();
      else if (missingPhone) missingPhone.focus();
    }, 300);
  };

  const changeActivePage = (pageName, propIdOrFilters = null) => {
    let resolvedPage = pageName;
    let resolvedPropId = typeof propIdOrFilters === 'string' ? propIdOrFilters : null;

    if (authUser && isProfileIncomplete && (resolvedPage === 'dashboard' || resolvedPage === 'crm' || resolvedPage === 'post-property')) {
      return;
    }

    // Never allow navigating to post-property without complete profile details
    if (resolvedPage === 'post-property' && !editingPropertyId) {
      if (!currentUser && !authLoading) {
        setAuthIntent('post-property');
        setIsAuthModalOpen(true);
        return;
      }
      if (currentUser) {
        const missing = checkProfileComplete(currentUser, authProfile);
        if (missing.length > 0) {
          setIncompleteProfileFields(missing);
          navigateToAccountSettings('dashboard');
          setIsProfileWarningOpen(true);
          return;
        }
      }
    }

    if (typeof pageName === 'string') {
      if (pageName.startsWith('property/')) {
        resolvedPage = 'property-detail';
        resolvedPropId = pageName.replace('property/', '');
      } else if (pageName.startsWith('property-detail/')) {
        resolvedPage = 'property-detail';
        resolvedPropId = pageName.replace('property-detail/', '');
      }
    }

    let activeFilterState = { ...filters };
    if ((resolvedPage === 'map' || resolvedPage === 'properties') && propIdOrFilters && typeof propIdOrFilters === 'object') {
      activeFilterState = createDefaultFilterState(propIdOrFilters);
      setFilters(activeFilterState);
    }

    setActivePage(resolvedPage);
    if (resolvedPropId) {
      setActivePropertyId(resolvedPropId);
    }

    try {
      let targetPath = '/';
      if (resolvedPage === 'property-detail' && resolvedPropId) {
        targetPath = `/property/${resolvedPropId}`;
      } else if (resolvedPage === 'map' || resolvedPage === 'properties') {
        const targetSearch = searchStateToUrlParams(activeFilterState);
        targetPath = targetSearch || '/properties';
      } else if (resolvedPage === 'admin') {
        targetPath = '/admin';
      } else if (resolvedPage === 'buy') {
        targetPath = '/buy';
      } else if (resolvedPage === 'rent') {
        targetPath = '/rent';
      } else if (resolvedPage === 'sell') {
        targetPath = '/sell';
      } else if (resolvedPage === 'post-property') {
        targetPath = '/post-property';
      } else if (resolvedPage === 'dashboard') {
        const targetTab = (propIdOrFilters && typeof propIdOrFilters === 'object' && propIdOrFilters.tab) ? propIdOrFilters.tab : dashboardTab;
        targetPath = targetTab && targetTab !== 'overview' ? `/dashboard?tab=${targetTab}` : '/dashboard';
      } else if (resolvedPage === 'wishlist') {
        targetPath = '/wishlist';
      } else if (resolvedPage === 'privacy-policy' || resolvedPage === 'privacy') {
        targetPath = '/privacy-policy';
      } else {
        targetPath = '/';
      }

      if (window.location.pathname + window.location.search !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    } catch (err) {}
  };

  // Route-level protection: Never allow staying on or accessing post-property without complete profile details
  useEffect(() => {
    if (activePage === 'post-property' && !editingPropertyId) {
      if (!currentUser && !authLoading) {
        setAuthIntent('post-property');
        setIsAuthModalOpen(true);
        setActivePage('home');
        return;
      }
      if (currentUser && !authLoading) {
        const missing = checkProfileComplete(currentUser, authProfile);
        if (missing.length > 0) {
          setIncompleteProfileFields(missing);
          navigateToAccountSettings('dashboard');
          setIsProfileWarningOpen(true);
          try {
            window.history.replaceState(null, '', '/dashboard?tab=account');
          } catch (e) {}
        } else {
          setIsProfileWarningOpen(false);
        }
      }
    }
  }, [activePage, currentUser, authProfile, authLoading, editingPropertyId]);

  const syncStateFromUrl = () => {
    const route = getInitialPageState();
    setActivePage(route.page);
    if (route.propId) {
      setActivePropertyId(route.propId);
    }
    if (route.page === 'map') {
      const parsedFilters = urlParamsToSearchState(window.location.search || '');
      setFilters(createDefaultFilterState(parsedFilters));
    }
    if (route.page === 'dashboard') {
      let tabToUse = route.tab;
      if (!tabToUse && typeof window !== 'undefined') {
        try {
          tabToUse = sessionStorage.getItem('easeland_active_dashboard_tab');
        } catch (e) {}
      }
      setDashboardTab(tabToUse || 'overview');
      setDashboardTabKey(Date.now());
    }
  };

  useEffect(() => {
    // 1. Synchronize state with current URL on mount / reload
    syncStateFromUrl();

    // 2. Disable browser scroll restoration & force scroll to top on mount
    if (typeof window !== 'undefined') {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }

    // 3. Handle PopState Browser History Navigation
    const handlePopState = () => {
      syncStateFromUrl();
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    };
    window.addEventListener('popstate', handlePopState);

    // 4. Listen for session profile updates
    const handleProfileUpdated = () => {};
    window.addEventListener('easeland-user-profile-updated', handleProfileUpdated);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('easeland-user-profile-updated', handleProfileUpdated);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      trackPageView();
    }
  }, [activePage, activePropertyId]);

  // Scroll To Top (Arrow Head Button) state & listeners
  const [showScrollTop, setShowScrollTop] = useState(false);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      document.body.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window === 'undefined') return;
      if (activePage === 'map' || activePage === 'properties') {
        setShowScrollTop(false);
        return;
      }
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const windowHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const documentHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight,
        document.body.offsetHeight
      );

      // Trigger button when user scrolls down (> 300px) or reaches near the end of the page (within 800px of bottom)
      const isScrolledDown = scrollTop > 300;
      const isNearEnd = (scrollTop + windowHeight >= documentHeight - 800);

      setShowScrollTop(isScrolledDown || isNearEnd);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activePage, activePropertyId]);

  useEffect(() => {
    loadProperties();
    
    getSiteConfigAdmin().then(res => {
      if (res && res.success && res.config && Object.keys(res.config).length > 0) {
        setSiteConfig(prev => mockApi.mergeSiteConfigWithDefaults({ ...prev, ...res.config }));
        if (res.config.theme) applySiteTheme(res.config.theme);
      }
    }).catch(err => console.warn('Live CMS config fetch warning:', err));

    if (siteConfig && siteConfig.theme) {
      applySiteTheme(siteConfig.theme);
    }
    const handleApproved = () => loadProperties();
    const handleConfigUpdated = (e) => {
      const detail = e.detail || mockApi.getSiteConfig();
      if (!detail || typeof detail !== 'object') return;

      setSiteConfig((prev) => {
        let merged = { ...prev };
        if (detail.featuredPropertyIds && !detail.featuredListings) {
          merged.featuredListings = {
            ...(prev?.featuredListings || {}),
            ...detail,
            showOnlyFeatured: true
          };
        } else {
          merged = { ...merged, ...detail };
        }
        return mockApi.mergeSiteConfigWithDefaults(merged);
      });

      const themeToApply = detail?.theme || (detail?.branding ? detail : null);
      if (themeToApply) {
        applySiteTheme(themeToApply);
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
    let propType = searchPayload?.propertyType || 'ALL';
    let purp = searchPayload?.purpose || 'ALL';

    const catStr = String(searchPayload?.category || '').toLowerCase();
    if (catStr.includes('amaravathi') || catStr.includes('lps')) propType = 'OPEN_PLOT';
    else if (catStr.includes('agricultural') || catStr.includes('farm')) propType = 'LAND';
    else if (catStr.includes('commercial') || catStr.includes('commeric')) propType = 'COMMERCIAL';
    else if (catStr.includes('apartment') || catStr.includes('flat')) propType = 'APARTMENT';
    else if (catStr.includes('house') || catStr.includes('villa') || catStr.includes('independent')) propType = 'HOUSE';
    else if (catStr.includes('city') && catStr.includes('plot')) propType = 'OPEN_PLOT';
    else if (catStr.includes('venture') || catStr.includes('plot')) propType = 'OPEN_PLOT';
    else if (catStr.includes('other')) propType = 'OTHER';
    else if (catStr.includes('rent')) { purp = 'RENT'; propType = 'ALL'; }

    const newFilters = createDefaultFilterState({
      ...searchPayload,
      propertyType: propType !== 'ALL' ? propType : (searchPayload?.propertyType || 'ALL'),
      purpose: purp !== 'ALL' ? purp : (searchPayload?.purpose || 'ALL')
    });

    setFilters(newFilters);

    try {
      const searchString = searchStateToUrlParams(newFilters);
      if (window.location.pathname + window.location.search !== searchString) {
        window.history.pushState(null, '', searchString);
      }
    } catch (e) {}

    setActivePage('map');
  };

  const handleCategorySelect = (catTitle) => {
    let propType = 'ALL';
    let purp = 'ALL';

    const catStr = String(catTitle || '').toLowerCase();
    if (catStr.includes('amaravathi') || catStr.includes('lps')) propType = 'OPEN_PLOT';
    else if (catStr.includes('agricultural') || catStr.includes('farm')) propType = 'LAND';
    else if (catStr.includes('commercial') || catStr.includes('commeric')) propType = 'COMMERCIAL';
    else if (catStr.includes('apartment') || catStr.includes('flat')) propType = 'APARTMENT';
    else if (catStr.includes('house') || catStr.includes('villa') || catStr.includes('independent')) propType = 'HOUSE';
    else if (catStr.includes('city') && catStr.includes('plot')) propType = 'OPEN_PLOT';
    else if (catStr.includes('venture') || catStr.includes('plot')) propType = 'OPEN_PLOT';
    else if (catStr.includes('other')) propType = 'OTHER';
    else if (catStr.includes('rent')) { purp = 'RENT'; propType = 'ALL'; }

    const updatedFilters = createDefaultFilterState({
      purpose: purp,
      propertyType: propType,
      category: catTitle
    });

    setFilters(updatedFilters);

    try {
      const searchString = searchStateToUrlParams(updatedFilters);
      if (window.location.pathname + window.location.search !== searchString) {
        window.history.pushState(null, '', searchString);
      }
    } catch (e) {}

    setActivePage('map');
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

  const handlePostPropertyClick = (propParam = null) => {
    let targetPropId = null;
    let targetPropObj = null;
    if (propParam !== null && propParam !== undefined) {
      if (typeof propParam === 'string' || typeof propParam === 'number') {
        targetPropId = String(propParam).trim();
      } else if (typeof propParam === 'object') {
        targetPropObj = propParam;
        targetPropId = String(propParam.propertyId || propParam.id || propParam.referenceId || '').trim();
        try {
          sessionStorage.setItem('easeland_editing_property', JSON.stringify(propParam));
        } catch (e) {}
      }
    } else {
      try {
        sessionStorage.removeItem('easeland_editing_property');
      } catch (e) {}
    }
    setEditingPropertyId(targetPropId || null);

    if (!currentUser) {
      setAuthIntent('post-property');
      setIsAuthModalOpen(true);
      return;
    }

    if (authUser && isProfileIncomplete) {
      return;
    }

    // Editing existing property: NEVER block with profile criteria warning modal!
    if (targetPropId || targetPropObj) {
      setIsProfileWarningOpen(false);
      changeActivePage('post-property');
      return;
    }

    const missingFields = checkProfileComplete(currentUser, authProfile);
    if (missingFields.length > 0) {
      setIncompleteProfileFields(missingFields);
      navigateToAccountSettings('dashboard');
      setIsProfileWarningOpen(true);
      return;
    }

    changeActivePage('post-property');
  };

  const handleAuthSuccess = (authenticatedUser, intent) => {
    if (isProfileIncomplete) {
      return;
    }
    if (intent === 'post-property') {
      const missingFields = checkProfileComplete(authenticatedUser, authProfile);
      if (missingFields.length > 0) {
        setIncompleteProfileFields(missingFields);
        navigateToAccountSettings('dashboard');
        setIsProfileWarningOpen(true);
      } else {
        changeActivePage('post-property');
      }
    } else {
      changeActivePage('home');
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
    <div className={'bg-brand-offwhite text-brand-charcoal font-sans flex flex-col w-full max-w-full overflow-x-hidden ' + (
      (activePage === 'map' || activePage === 'properties') ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-screen'
    )}>
      
      {/* PWA STATUS & PROMPTS */}
      <OfflineIndicator />
      <PwaUpdatePrompt />
      <PwaInstallBanner />

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
      <main className={'w-full max-w-full min-w-0 ' + (
        (activePage === 'map' || activePage === 'properties') ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'flex-1'
      )}>

        {/* PAGE 1: HOME */}
        {(activePage === 'home' || !['map', 'properties', 'property-detail', 'buy', 'rent', 'sell', 'post-property', 'admin', 'crm', 'dashboard', 'wishlist', 'privacy-policy', 'privacy'].includes(activePage)) && (
          <div>
            <HeroSearch onSearch={handleHeroSearch} />
            
            <PropertyCategoryCards onSelectCategory={handleCategorySelect} />

            {/* PAID PROMOTIONS / FEATURED VERIFIED SHOWCASE */}
            {(() => {
              const featuredConfig = siteConfig?.featuredListings || {};
              const featuredIds = safeArray(featuredConfig.featuredPropertyIds).map(String).filter(Boolean);
              const parsedDisplay = Number(featuredConfig.displayCount);
              const displayCount = isNaN(parsedDisplay) ? 6 : Math.max(1, Math.min(24, Math.floor(parsedDisplay)));

              // Build comprehensive candidate pool from all property data sources
              const candidatePool = [];
              const seenPoolKeys = new Set();
              const addToPool = (items) => {
                if (!Array.isArray(items)) return;
                items.forEach((p) => {
                  if (!p || isPropertyDeleted(p) || isFakeProperty(p)) return;
                  const k1 = String(p.id || '').trim().toLowerCase();
                  const k2 = String(p.propertyId || '').trim().toLowerCase();
                  const k3 = String(p.referenceId || '').trim().toLowerCase();
                  const primaryKey = k1 || k2 || k3;
                  if (primaryKey && !seenPoolKeys.has(primaryKey)) {
                    seenPoolKeys.add(primaryKey);
                    candidatePool.push(p);
                  }
                });
              };

              addToPool(properties);
              if (Array.isArray(featuredConfig.promotedProperties)) {
                addToPool(featuredConfig.promotedProperties);
              }
              if (typeof window !== 'undefined') {
                try {
                  const rawPromo = localStorage.getItem('easeland_promoted_properties');
                  if (rawPromo) addToPool(JSON.parse(rawPromo));
                } catch (e) {}
                try {
                  const rawAdmin = localStorage.getItem('easeland_admin_cached_properties');
                  if (rawAdmin) addToPool(JSON.parse(rawAdmin));
                } catch (e) {}
                try {
                  const rawProps = localStorage.getItem('easeland_properties');
                  if (rawProps) addToPool(JSON.parse(rawProps));
                } catch (e) {}
              }
              try {
                if (typeof mockApi.getProperties === 'function') {
                  addToPool(mockApi.getProperties());
                }
              } catch (e) {}


              // Explicitly match properties in exact slot order defined by Admin
              const explicitlyFeatured = [];
              featuredIds.forEach((fId, slotIdx) => {
                const target = String(fId).trim().toLowerCase();
                const matched = candidatePool.find((p) => {
                  if (!p) return false;
                  const id1 = String(p.id || '').trim().toLowerCase();
                  const id2 = String(p.propertyId || '').trim().toLowerCase();
                  const ref = String(p.referenceId || '').trim().toLowerCase();
                  return id1 === target || id2 === target || ref === target;
                });
                if (matched && !isFakeProperty(matched)) {
                  const mKey = String(matched.id || matched.propertyId || matched.referenceId || '').trim().toLowerCase();
                  if (!explicitlyFeatured.some((ef) => String(ef.id || ef.propertyId || ef.referenceId || '').trim().toLowerCase() === mKey)) {
                    explicitlyFeatured.push(matched);
                  }
                }
              });

              // Strictly only show properties explicitly added to paid promotions by admin
              const homepageProperties = explicitlyFeatured.slice(0, displayCount);
              const count = homepageProperties.length;

              // If admin has not added properties to promotion, show Animated Text!
              if (count === 0) {
                return (
                  <AnimatedPromotionBanner
                    onPostProperty={() => changeActivePage('post-property')}
                    onExploreMap={() => changeActivePage('map', { clean: true })}
                  />
                );
              }

              // Dynamic container width & vertical padding: shrink or expand based on property count
              const containerWidthClass =
                count === 1 ? 'max-w-4xl' :
                count === 2 ? 'max-w-5xl' :
                count === 3 ? 'max-w-6xl' :
                'max-w-7xl';

              const sectionPaddingClass =
                count === 1 ? 'py-8 sm:py-10' :
                count === 2 ? 'py-10 sm:py-12' :
                'py-12 sm:py-16';

              const gridLayoutClass =
                count === 1 ? 'grid-cols-1' :
                count === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                count === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                count === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
                (count === 5 || count === 6) ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

              return (
                <section className={'px-4 sm:px-6 lg:px-8 mx-auto transition-all duration-500 ease-in-out ' + containerWidthClass + ' ' + sectionPaddingClass}>
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8 transition-all duration-300">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-800 bg-emerald-100 px-3 py-1 rounded-md">
                          {featuredConfig.badgeText || 'VERIFIED LISTINGS'}
                        </span>
                        <span className="text-[11px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500 fill-amber-400" />
                          <span>{count} {count === 1 ? 'Showcase Property' : 'Showcase Properties'}</span>
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-4xl font-extrabold text-brand-charcoal tracking-tight mt-3">
                        {featuredConfig.sectionTitle || 'Featured & Recent Verified Properties'}
                      </h2>
                    </div>
                    <button
                      onClick={() => changeActivePage('map', { clean: true })}
                      className="text-sm font-bold text-brand-charcoal hover:text-brand-yellowHover flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span>Explore All Properties on Map</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {count === 1 ? (
                    <div
                      onClick={() => handleSelectProperty(homepageProperties[0])}
                      className="group bg-white rounded-3xl border border-amber-300 ring-2 ring-amber-400/30 shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden flex flex-col md:flex-row transform hover:-translate-y-1"
                    >
                      <div className="relative md:w-1/2 h-64 md:h-auto min-h-[240px] bg-gray-100 overflow-hidden shrink-0">
                        <img
                          src={getFirstUploadedImage(homepageProperties[0])}
                          alt={homepageProperties[0].title}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = getCategoryFallbackImage(homepageProperties[0]);
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 left-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-md border border-amber-300">
                          <Sparkles className="w-3.5 h-3.5 text-brand-yellow fill-brand-yellow" />
                          <span>FEATURED SPOTLIGHT PROMOTION</span>
                        </div>
                        <div className="absolute bottom-3 left-3 bg-brand-charcoal/80 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-md">
                          {homepageProperties[0].category || 'Open Plot'}
                        </div>
                      </div>

                      <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
                            <span className="flex items-center gap-1 text-slate-700">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                              {[homepageProperties[0].location?.locality, homepageProperties[0].location?.city].map(s => typeof s === 'string' ? s.trim() : '').filter(Boolean).join(', ') || homepageProperties[0].location?.city || homepageProperties[0].location?.state || 'India'}
                            </span>
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                              100% VERIFIED
                            </span>
                          </div>

                          <h3 className="text-xl md:text-2xl font-black text-brand-charcoal line-clamp-2 leading-tight">
                            {homepageProperties[0].title}
                          </h3>

                          {homepageProperties[0].description && (
                            <p className="text-xs text-gray-500 line-clamp-2 font-medium leading-relaxed">
                              {homepageProperties[0].description}
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-xs font-bold text-gray-600 pt-1">
                            {homepageProperties[0].area && (
                              <span className="bg-gray-100 px-2.5 py-1 rounded-md">
                                {homepageProperties[0].areaDisplay || (homepageProperties[0].area + ' sq ft')}
                              </span>
                            )}
                            {homepageProperties[0].propertyType && (
                              <span className="bg-gray-100 px-2.5 py-1 rounded-md">
                                {homepageProperties[0].propertyType}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="pt-5 mt-4 border-t border-gray-100 flex items-center justify-between">
                          <div>
                            <span className="text-xs text-gray-400 block font-semibold uppercase tracking-wider">Listed Price</span>
                            <span className="text-2xl font-black text-emerald-700">
                              {homepageProperties[0].priceDisplay || homepageProperties[0].price}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="bg-brand-charcoal hover:bg-slate-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>View Verified Listing</span>
                            <ChevronRight className="w-4 h-4 text-brand-yellow" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={'grid ' + gridLayoutClass + ' gap-6 transition-all duration-500'}>
                      {homepageProperties.map((prop) => {
                        const propId = String(prop.id || prop.propertyId);
                        const isFeatured = featuredIds.includes(propId);

                        return (
                          <div
                            key={prop.id || prop.propertyId}
                            onClick={() => handleSelectProperty(prop)}
                            className={'group bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden flex flex-col transform hover:-translate-y-1 ' + (
                              isFeatured ? 'border-amber-300 ring-2 ring-amber-400/30' : 'border-brand-bordergray'
                            )}
                          >
                            <div className="relative h-48 bg-gray-100 overflow-hidden">
                              <img
                                src={getFirstUploadedImage(prop)}
                                alt={prop.title}
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = getCategoryFallbackImage(prop);
                                }}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute top-3 left-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md flex items-center gap-1 shadow-md border border-amber-300">
                                <Sparkles className="w-3 h-3 text-brand-yellow fill-brand-yellow" />
                                <span>FEATURED PROMOTION</span>
                              </div>
                            </div>

                            <div className="p-5 flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between text-xs text-gray-500 font-bold mb-1">
                                  <span>{[prop.location?.locality, prop.location?.city].map(s => typeof s === 'string' ? s.trim() : '').filter(Boolean).join(', ') || prop.location?.city || prop.location?.state || 'India'}</span>
                                  <span className="text-brand-charcoal">{prop.category}</span>
                                </div>
                                <h3 className="text-base font-bold text-brand-charcoal line-clamp-1 mb-3">
                                  {prop.title}
                                </h3>
                              </div>

                              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                                <div>
                                  <span className="text-xs text-gray-400 block font-medium">Listed Price</span>
                                  <span className="text-lg font-extrabold text-emerald-700">{prop.priceDisplay || prop.price}</span>
                                </div>
                                <span className="text-xs font-bold text-brand-charcoal">{prop.areaDisplay || prop.area}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })()}

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
                  <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" /> Transparent & Safe Transactions</span>
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
                <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
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
                          placeholder="Enter Your Name"
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
                          placeholder="Enter Your Email Address"
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
            initialFilters={filters}
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
        {activePage === 'buy' && <BuyInfoPage onExploreClick={(targetFilter) => changeActivePage('map', targetFilter || { purpose: 'SALE' })} />}
        {activePage === 'rent' && <RentInfoPage onExploreClick={(targetFilter) => changeActivePage('map', targetFilter || { purpose: 'RENT' })} />}
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
              try { sessionStorage.removeItem('easeland_editing_property'); } catch (e) {}
              changeActivePage('dashboard');
            }}
            onCancel={() => {
              setEditingPropertyId(null);
              try { sessionStorage.removeItem('easeland_editing_property'); } catch (e) {}
              changeActivePage('dashboard');
            }}
            onGoToAccountSettings={() => {
              setEditingPropertyId(null);
              try { sessionStorage.removeItem('easeland_editing_property'); } catch (e) {}
              navigateToAccountSettings('dashboard');
            }}
          />
        )}

        {activePage === 'admin' && <AdminPortal onNavigate={(page) => changeActivePage(page)} />}

        {/* EASELAND CRM STUDIO & ENTERPRISE SUITE */}
        {activePage === 'crm' && (
          <EaseLandCRM
            onReturnToAdmin={() => changeActivePage('admin')}
            onNavigateToMarketplace={() => changeActivePage('home')}
          />
        )}

        {/* USER DASHBOARD (COVERING ALL 7 BLOCKS) */}
        {activePage === 'dashboard' && (
          <UserDashboard
            user={currentUser}
            initialTab={dashboardTab}
            tabKey={dashboardTabKey}
            onTabChange={(newTab) => {
              setDashboardTab(newTab);
            }}
            properties={properties}
            wishlist={wishlistProperties}
            onWishlistToggle={handleWishlistToggle}
            onNavigate={(page, propId) => changeActivePage(page, propId)}
            onPostProperty={handlePostPropertyClick}
          />
        )}

        {/* WISHLIST VIEW */}
        {activePage === 'wishlist' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="text-2xl font-extrabold text-brand-charcoal mb-6">My Saved Wishlist Properties ({wishlistProperties.length})</h2>
            {wishlistProperties.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 text-gray-500 shadow-sm">
                <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-brand-charcoal">No saved properties yet</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">Explore verified properties on our interactive map and tap the heart icon to save your favorites.</p>
                <button onClick={() => changeActivePage('map')} className="mt-5 bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-5 py-3 rounded-xl shadow-md border border-yellow-400/40 transition-all">
                  Explore Map to Save Properties
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {wishlistProperties.map((prop) => {
                  const pId = prop.propertyId || prop.id;
                  const firstPhoto = getFirstUploadedImage(prop);
                  return (
                    <div key={pId} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                      <div>
                        <div className="relative h-48 w-full bg-gray-100">
                          <img
                            src={firstPhoto}
                            alt={prop.title}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = getCategoryFallbackImage(prop);
                            }}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-3 left-3 bg-slate-900/90 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full uppercase border border-slate-700">
                            {prop.propertyType || prop.type || 'Property'}
                          </span>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await removeWishlistProperty(currentUser?.uid, pId);
                              refreshWishlist();
                            }}
                            className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white text-rose-500 rounded-full shadow-md transition-all border border-gray-100"
                            title="Remove from Wishlist"
                          >
                            <Heart className="w-4 h-4 fill-rose-500" />
                          </button>
                        </div>
                        <div className="p-5">
                          <span className="text-xs text-brand-yellow font-extrabold uppercase tracking-wider block mb-1">
                            {prop.purpose === 'RENT' ? 'For Rent' : 'For Sale'} • Ref: {prop.referenceId || `EL-PROP-${pId}`}
                          </span>
                          <h3 className="text-base font-extrabold text-slate-900 line-clamp-1">{prop.title}</h3>
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span>{prop.location?.locality || prop.location?.city || prop.location?.district || 'India'}, {prop.location?.state || ''}</span>
                          </p>
                          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-gray-400 block font-bold uppercase">Listed Price</span>
                              <span className="text-base font-extrabold text-emerald-700">{prop.priceDisplay || `Rs. ${prop.price}`}</span>
                            </div>
                            <span className="text-xs font-bold text-slate-700">{prop.areaDisplay || (prop.area ? `${prop.area} sq ft` : '')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2">
                        <button
                          onClick={() => changeActivePage('property-detail', pId)}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1"
                        >
                          <span>View Property Details</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                {(() => {
                  const tag = siteConfig?.footer?.tagline;
                  if (!tag || tag.includes('Zero brokerage') || tag.includes('zero brokerage') || tag.includes('precise plot boundaries')) {
                    return 'EaseLand is India\'s premier property discovery and verification marketplace. 100% physically inspected listings, crystal-clear land titles, and zero boundary disputes.';
                  }
                  return tag;
                })()}
              </p>
            </div>

            <div>
              <h4 className="font-extrabold text-brand-yellow uppercase tracking-wider mb-3">Explore</h4>
              <ul className="space-y-2 text-gray-300 font-semibold">
                <li><button onClick={() => changeActivePage('buy')} className="hover:text-white">Buy Property Info</button></li>
                <li><button onClick={() => changeActivePage('rent')} className="hover:text-white">Rent Property Info</button></li>
                <li><button onClick={() => changeActivePage('sell')} className="hover:text-white">Sell Property Info</button></li>
                <li><button onClick={() => changeActivePage('map', { clean: true })} className="hover:text-white">Explore Universal Map</button></li>
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

      {/* MANDATORY PROFILE COMPLETION MODAL FOR MOBILE NUMBER SIGNUP */}
      <MandatoryProfileModal
        isOpen={Boolean(authUser && isProfileIncomplete)}
        onComplete={() => {
          setProfileRefreshTick((prev) => prev + 1);
        }}
      />

      {/* PROFILE & SECURITY SETTINGS MODAL */}
      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onUserUpdated={() => setIsProfileWarningOpen(false)}
      />

      {/* INCOMPLETE PROFILE CRITERIA WARNING MODAL FOR POST PROPERTY */}
      {isProfileWarningOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-charcoal/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-amber-200 overflow-hidden space-y-5 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-brand-charcoal">Profile Criteria Required</h3>
                  <span className="text-xs text-amber-700 font-semibold">Account Setup Incomplete</span>
                </div>
              </div>
              <button
                onClick={() => setIsProfileWarningOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              Before posting a property listing on EaseLand, all 4 Account &amp; Profile fields must be completed. Please fill out the missing required fields below:
            </p>

            <div className="bg-amber-50/80 rounded-xl p-4 border border-amber-200 space-y-2">
              <span className="text-[11px] font-black text-amber-900 uppercase tracking-wider block">
                Missing Required Fields ({incompleteProfileFields.length}):
              </span>
              <ul className="space-y-1.5">
                {incompleteProfileFields.map((fieldLabel) => (
                  <li key={fieldLabel} className="text-xs font-extrabold text-amber-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                    <span>{fieldLabel}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 pt-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigateToAccountSettings('dashboard')}
                  className="flex-1 bg-brand-charcoal hover:bg-black text-white font-extrabold text-xs py-3.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  title="Redirect to Account & Profile Settings in Dashboard"
                >
                  <Settings className="w-4 h-4 text-brand-yellow" />
                  <span>Fill Account Settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsProfileWarningOpen(false)}
                  className="px-5 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-xl transition-all text-center cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="text-center pt-0.5">
                <button
                  type="button"
                  onClick={() => navigateToAccountSettings('popup')}
                  className="text-[11px] font-bold text-amber-800 hover:text-amber-950 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                  title="Quick Fill Required Details via Profile Popup Modal"
                >
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  <span>Prefer a quick popup instead? Click here</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TWO FACTOR OTP VERIFICATION MODAL */}
      <TwoFactorModal
        isOpen={!!pending2FASession}
        userEmail={pending2FASession?.email || ''}
        onVerifySuccess={() => {
          complete2FASession();
          changeActivePage('home');
        }}
        onClose={cancel2FASession}
      />

      {/* ENGAGEMENT VISITOR LEAD POPUP MODAL (1-MIN ENGAGEMENT FOR UNAUTHENTICATED VISITORS) */}
      <VisitorLeadModal currentUser={currentUser} />

      {/* SCROLL TO TOP ARROW HEAD BUTTON (Hidden on Map Page) */}
      {activePage !== 'map' && activePage !== 'properties' && (
        <button
          id="scroll-to-top-btn"
          onClick={scrollToTop}
          aria-label="Scroll to top of current page"
          title="Scroll to top of page"
          className={`fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 hover:from-amber-400 hover:to-yellow-200 text-slate-950 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 border border-amber-200/90 flex items-center justify-center transition-all duration-300 transform group cursor-pointer ${
            showScrollTop
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
              : 'opacity-0 translate-y-8 scale-75 pointer-events-none'
          }`}
        >
          <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] group-hover:-translate-y-0.5 transition-transform duration-200" />
        </button>
      )}

    </div>
  );
}
