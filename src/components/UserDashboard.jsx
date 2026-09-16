import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  MessageSquare,
  Heart,
  Bell,
  User,
  Settings,
  PlusCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Edit,
  Trash2,
  Eye,
  ExternalLink,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Lock,
  Save,
  Check,
  Filter
} from 'lucide-react';
import { getCustomerEnquiries, getOwnerEnquiries, updateEnquiryStatus } from '../firebase/enquiryService.js';
import { getUserWishlistProperties } from '../firebase/wishlistService.js';
import { getDerivedEnquiryNotifications } from '../firebase/notificationService.js';
import {
  getOwnerProperties,
  markPropertySold,
  markPropertyRented,
  markPropertyUnavailable,
  markPropertyLive,
  archiveProperty,
  deletePropertyListing
} from '../firebase/propertyService.js';
import { mockApi } from '../services/mockApi';
import { useAuth } from '../context/AuthContext.jsx';

export default function UserDashboard({
  user,
  properties = [],
  wishlist = [],
  onWishlistToggle,
  onNavigate,
  onPostProperty
}) {
  const { updateProfileData } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'properties', 'verification', 'enquiries', 'wishlist', 'notifications', 'account'
  const [propertyFilter, setPropertyFilter] = useState('ALL'); // 'ALL', 'LIVE', 'PENDING_VERIFICATION', 'CHANGES_REQUIRED', 'REJECTED', 'DRAFT', 'UNAVAILABLE', 'SOLD', 'RENTED', 'ARCHIVED'
  const [enquiryType, setEnquiryType] = useState('RECEIVED'); // 'RECEIVED', 'SENT'

  // Real Firebase interaction state
  const [fbSentEnquiries, setFbSentEnquiries] = useState([]);
  const [fbReceivedEnquiries, setFbReceivedEnquiries] = useState([]);
  const [fbWishlistProps, setFbWishlistProps] = useState([]);
  const [fbNotifications, setFbNotifications] = useState([]);
  const [fbOwnerProperties, setFbOwnerProperties] = useState([]);
  const [fbLoading, setFbLoading] = useState(false);

  const refreshOwnerProperties = async () => {
    const userId = user?.uid || user?.id;
    if (!user || !userId) return;
    const res = await getOwnerProperties(userId);
    if (res.success) {
      setFbOwnerProperties(res.properties || []);
    }
  };

  useEffect(() => {
    const userId = user?.uid || user?.id;
    if (!user || !userId) return;
    let isMounted = true;
    setFbLoading(true);

    Promise.all([
      getCustomerEnquiries(userId),
      getOwnerEnquiries(userId),
      getUserWishlistProperties(userId),
      getDerivedEnquiryNotifications(userId),
      getOwnerProperties(userId)
    ]).then(([custRes, ownerRes, wishRes, notifRes, ownerPropRes]) => {
      if (!isMounted) return;
      if (custRes.success) setFbSentEnquiries(custRes.enquiries || []);
      if (ownerRes.success) setFbReceivedEnquiries(ownerRes.enquiries || []);
      if (wishRes.success) setFbWishlistProps(wishRes.properties || []);
      if (notifRes.success) setFbNotifications(notifRes.notifications || []);
      if (ownerPropRes.success) setFbOwnerProperties(ownerPropRes.properties || []);
    }).finally(() => {
      if (isMounted) setFbLoading(false);
    });

    return () => { isMounted = false; };
  }, [user]);


  const isRyuu = (user?.email || '').toLowerCase() === 'ryuu@easeland.in';
  // Use real Firebase derived notifications & wishlist items
  const notifications = fbNotifications;
  const wishlistProperties = fbWishlistProps.length > 0 ? fbWishlistProps : (wishlist || []);
  const unreadNotificationsCount = (notifications || []).filter(n => !n.read).length;


  // Account settings form state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || user?.displayName || 'EaseLand User',
    email: user?.email || '',
    phone: user?.phone || user?.phoneNumber || '',
    city: 'Guntur, Andhra Pradesh',
    accountType: 'Verified Property Owner & Buyer'
  });
  const [myPropertiesList, setMyPropertiesList] = useState([]);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setProfileForm({
      name: user?.name || user?.displayName || 'EaseLand User',
      email: user?.email || '',
      phone: user?.phone || user?.phoneNumber || '',
      city: 'Guntur, Andhra Pradesh',
      accountType: 'Verified Property Owner & Buyer'
    });
  }, [user]);

  // Load user properties from mockApi storage on mount and when events fire
  const refreshUserProperties = () => {
    const userIdToPass = user?.uid || user?.id;
    const rawList = mockApi.getMyProperties(userIdToPass, user?.email);
    setMyPropertiesList(rawList);
    refreshOwnerProperties();
  };

  useEffect(() => {
    refreshUserProperties();
    const handleCreated = () => refreshUserProperties();
    const handleApproved = () => refreshUserProperties();
    const handleStatusUpdated = () => refreshUserProperties();

    window.addEventListener('easeland-property-created', handleCreated);
    window.addEventListener('easeland-property-approved', handleApproved);
    window.addEventListener('easeland-property-status-updated', handleStatusUpdated);
    window.addEventListener('storage', handleStatusUpdated);

    return () => {
      window.removeEventListener('easeland-property-created', handleCreated);
      window.removeEventListener('easeland-property-approved', handleApproved);
      window.removeEventListener('easeland-property-status-updated', handleStatusUpdated);
      window.removeEventListener('storage', handleStatusUpdated);
    };
  }, [user]);

  // Combine Firestore and local/database properties cleanly so user always sees live status updates
  const combinedPropsMap = new Map();
  [...myPropertiesList, ...fbOwnerProperties].forEach(p => {
    const pId = p.propertyId || p.id;
    if (pId) {
      const existing = combinedPropsMap.get(pId) || {};
      const statusResolved = (p.listingStatus === 'LIVE' || p.status === 'LIVE' || p.status === 'APPROVED_LIVE' || p.isPublished || p.isPlatformVerified || existing.status === 'LIVE' || existing.listingStatus === 'LIVE')
        ? 'LIVE'
        : (p.listingStatus === 'REJECTED' || p.status === 'REJECTED' || existing.status === 'REJECTED')
        ? 'REJECTED'
        : (p.listingStatus === 'CHANGES_REQUIRED' || p.status === 'CHANGES_REQUIRED' || existing.status === 'CHANGES_REQUIRED')
        ? 'CHANGES_REQUIRED'
        : (p.listingStatus || existing.listingStatus || p.status || existing.status || 'DRAFT');

      combinedPropsMap.set(pId, {
        ...existing,
        ...p,
        listingStatus: statusResolved,
        status: statusResolved,
        isPlatformVerified: Boolean(p.isPlatformVerified || existing.isPlatformVerified || statusResolved === 'LIVE'),
        isPublished: Boolean(p.isPublished || existing.isPublished || statusResolved === 'LIVE'),
        verificationNotes: p.verificationNotes || existing.verificationNotes || p.ownerFacingNotes || existing.ownerFacingNotes
      });
    }
  });

  const activePropsSource = Array.from(combinedPropsMap.values());

  const userProperties = activePropsSource.map(p => {
    const locObj = p.location || {};
    const locParts = typeof locObj === 'object' ? [locObj.locality, locObj.city, locObj.state].filter(Boolean) : [];
    const locString = locParts.length > 0 ? locParts.join(', ') : (typeof p.location === 'string' ? p.location : 'India');

    let displayPrice = p.priceDisplay;
    if (!displayPrice && p.price) {
      if (p.price >= 10000000) {
        displayPrice = `Rs. ${(p.price / 10000000).toFixed(2)} Crores`;
      } else if (p.price >= 100000) {
        displayPrice = `Rs. ${(p.price / 100000).toFixed(2)} Lakhs`;
      } else {
        displayPrice = `Rs. ${Number(p.price).toLocaleString('en-IN')}`;
      }
    }

    const thumbImage = (Array.isArray(p.publicApprovedMedia) && p.publicApprovedMedia.length > 0)
      ? p.publicApprovedMedia[0].url
      : (Array.isArray(p.media) && p.media.length > 0)
        ? (typeof p.media[0] === 'string' ? p.media[0] : (p.media[0].url || p.media[0].mediaUrl))
        : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80';

    const statusVal = (p.status === 'LIVE' || p.listingStatus === 'LIVE' || p.isPublished || p.isPlatformVerified)
      ? 'LIVE'
      : (p.status === 'REJECTED' || p.listingStatus === 'REJECTED')
      ? 'REJECTED'
      : (p.status === 'CHANGES_REQUIRED' || p.listingStatus === 'CHANGES_REQUIRED')
      ? 'CHANGES_REQUIRED'
      : (p.status === 'PENDING_VERIFICATION' || p.listingStatus === 'PENDING_VERIFICATION' || p.status === 'UNDER_REVIEW' || p.listingStatus === 'UNDER_REVIEW')
      ? 'PENDING_VERIFICATION'
      : (p.status || p.listingStatus || 'DRAFT');

    let adminNoteVal = p.verificationNotes || p.ownerFacingNotes || p.adminFeedback;
    if (!adminNoteVal) {
      if (statusVal === 'LIVE') adminNoteVal = 'Platform Verified: Title and survey documents verified.';
      else if (statusVal === 'REJECTED') adminNoteVal = 'Listing rejected by platform auditor.';
      else if (statusVal === 'CHANGES_REQUIRED') adminNoteVal = 'Document changes requested by auditor.';
      else adminNoteVal = 'Verification audit in progress.';
    }

    return {
      id: p.propertyId || p.id,
      propertyId: p.propertyId || p.id,
      referenceId: p.referenceId || `EL-PROP-${p.id}`,
      title: p.title || 'Untitled Property Listing',
      price: displayPrice || 'Rs. 0',
      location: locString,
      type: p.propertyType || p.category || 'OPEN_PLOT',
      purpose: p.purpose || 'SALE',
      facing: p.specs?.facing || p.facing || 'East',
      area: p.areaDisplay || `${p.area || 0} sq ft`,
      status: statusVal,
      isPlatformVerified: Boolean(p.isPlatformVerified || statusVal === 'LIVE'),
      isPublished: Boolean(p.isPublished || statusVal === 'LIVE'),
      adminNote: adminNoteVal,
      dateListed: p.createdAt ? (p.createdAt.seconds ? new Date(p.createdAt.seconds * 1000).toISOString().split('T')[0] : (typeof p.createdAt === 'string' ? p.createdAt.split('T')[0] : 'Recent')) : 'Recent',
      views: p.views || 0,
      enquiriesCount: p.enquiriesCount || 0,
      image: thumbImage,
      rawProperty: p
    };
  });

  const [actionLoading, setActionLoading] = useState({});

  const handleOwnerPropertyAction = async (actionType, targetProp) => {
    const propId = typeof targetProp === 'object' && targetProp !== null
      ? (targetProp.id || targetProp.propertyId || targetProp.referenceId)
      : targetProp;

    const uId = user?.uid || user?.id;

    if (!user || !uId || !propId || actionLoading[propId]) return;

    setActionLoading(prev => ({ ...prev, [propId]: true }));
    try {
      let res = null;
      if (actionType === 'SOLD') {
        res = await markPropertySold(propId, uId);
      } else if (actionType === 'RENTED') {
        res = await markPropertyRented(propId, uId);
      } else if (actionType === 'UNAVAILABLE') {
        res = await markPropertyUnavailable(propId, uId);
      } else if (actionType === 'LIVE') {
        res = await markPropertyLive(propId, uId);
      } else if (actionType === 'ARCHIVE') {
        res = await archiveProperty(propId, uId);
      } else if (actionType === 'DELETE') {
        if (!window.confirm("Are you sure you want to PERMANENTLY delete this property listing? This action cannot be undone.")) return;

        // Immediately update UI state for 0ms deletion feedback
        setFbOwnerProperties(prev => prev.filter(p => {
          if (!p) return false;
          const id1 = String(p.id || '');
          const id2 = String(p.propertyId || '');
          const id3 = String(p.referenceId || '');
          const targetStr = String(propId);
          return id1 !== targetStr && id2 !== targetStr && id3 !== targetStr;
        }));

        res = await deletePropertyListing(propId, uId, false);
      }

      if (res && res.success) {
        await refreshOwnerProperties();
      } else if (res && res.error) {
        alert(`Action Failed: ${res.error}`);
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [propId]: false }));
    }
  };

  // Enquiries received / sent for this specific user from Firebase
  const enquiriesReceived = fbReceivedEnquiries.map(e => ({
    id: e.enquiryId,
    propertyId: e.propertyId,
    propertyName: e.propertyTitle || 'Property Listing',
    buyerName: e.customerName || e.buyerName || 'Interested Customer',
    buyerPhone: e.customerPhone || e.buyerPhone || '+91 N/A',
    buyerEmail: e.customerEmail || e.buyerEmail || '',
    message: e.message,
    status: e.status || 'SUBMITTED',
    date: e.createdAt ? (e.createdAt.seconds ? new Date(e.createdAt.seconds * 1000).toLocaleDateString() : 'Recent') : 'Recent',
    rawEnquiry: e
  }));

  const enquiriesSent = fbSentEnquiries.map(e => ({
    id: e.enquiryId,
    propertyId: e.propertyId,
    propertyName: e.propertyTitle || 'Property Listing',
    ownerName: e.ownerName || 'Property Owner',
    ownerPhone: 'Direct Owner',
    message: e.message,
    status: e.status || 'SUBMITTED',
    date: e.createdAt ? (e.createdAt.seconds ? new Date(e.createdAt.seconds * 1000).toLocaleDateString() : 'Recent') : 'Recent',
    rawEnquiry: e
  }));

  // Filter properties
  const filteredUserProperties = userProperties.filter(p => {
    if (propertyFilter === 'ALL') return true;
    return p.status === propertyFilter;
  });

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await updateProfileData({
        displayName: profileForm.name,
        name: profileForm.name,
        phone: profileForm.phone,
        phoneNumber: profileForm.phone,
        city: profileForm.city
      });
      if (res && res.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } else if (res && res.error) {
        alert(`Error updating profile: ${res.error}`);
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const markAllNotificationsRead = () => {
    setFbNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Strict Account Suspension Lockout Check
  const suspensionCheck = user?.accountStatus === 'SUSPENDED' || user?.status === 'SUSPENDED'
    ? { isSuspended: true, reason: user.suspension?.reason || 'Violation of platform verification guidelines' }
    : mockApi.isUserSuspended(user);

  if (suspensionCheck.isSuspended) {
    return (
      <div className="min-h-screen bg-gray-100 text-brand-charcoal py-12 px-4 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-3xl p-8 shadow-2xl border border-amber-300 space-y-6 text-center">

          <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
            <Lock className="w-10 h-10" />
          </div>

          <div>
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Account Temporarily Suspended
            </span>
            <h2 className="text-2xl font-black text-brand-charcoal mt-3">Account Access Restricted</h2>
            <p className="text-xs text-gray-500 font-medium mt-1">Logged in as {user?.name || user?.email}</p>
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-left space-y-2">
            <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">Reason for Suspension:</h4>
            <p className="text-xs font-bold text-amber-950 bg-white p-3 rounded-xl border border-amber-200">
              "{suspensionCheck.reason}"
            </p>
            <div className="flex items-center justify-between text-xs text-amber-900 font-medium pt-1">
              <span>Suspension Duration Remaining:</span>
              <strong className="font-extrabold text-amber-700 bg-amber-200/60 px-3 py-1 rounded-lg">{suspensionCheck.countdownText}</strong>
            </div>
            <p className="text-[11px] text-amber-800 italic">
              Suspension automatically expires on: <strong>{suspensionCheck.formattedUntil}</strong>
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-2xl border text-xs text-gray-600 space-y-1 text-left">
            <h4 className="font-extrabold text-brand-charcoal">What this means:</h4>
            <ul className="list-disc pl-5 space-y-1 font-medium text-gray-500">
              <li>You cannot post new property listings on EaseLand during suspension.</li>
              <li>Your existing property listings are temporarily hidden from public discovery.</li>
              <li>You cannot send or respond to buyer enquiries until suspension is lifted.</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('home')}
              className="w-full sm:w-auto bg-brand-charcoal text-white font-extrabold text-xs px-6 py-3 rounded-xl hover:bg-brand-charcoalLight transition-all"
            >
              Return to Homepage
            </button>
            <a
              href="mailto:support@easeland.in?subject=Suspension Appeal Inquiry"
              className="w-full sm:w-auto bg-amber-500 text-white font-extrabold text-xs px-6 py-3 rounded-xl hover:bg-amber-600 transition-all text-center"
            >
              Contact Legal Compliance Support
            </a>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-metallic-dark text-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* HEADER BAR */}
        <div className="bg-metallic-card text-white rounded-3xl p-6 sm:p-8 shadow-2xl mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-700/60 backdrop-blur-xl">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-metallic-gold text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg border-2 border-amber-300/40">
              {profileForm.name.charAt(0).toLowerCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">
                  {profileForm.name}
                </h1>
                <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Verified User
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-1 font-medium flex items-center gap-3">
                {profileForm.email && <span>{profileForm.email}</span>}
                {profileForm.phone && (
                  <>
                    <span>•</span>
                    <span>{profileForm.phone}</span>
                  </>
                )}
                {profileForm.city && (
                  <>
                    <span>•</span>
                    <span className="text-metallic-gold font-bold">{profileForm.city}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onPostProperty}
            className="bg-metallic-gold hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-5 py-3.5 rounded-xl shadow-[0_4px_20px_rgba(212,175,55,0.3)] flex items-center gap-2 transition-transform hover:scale-105 border border-amber-300/40"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span>POST NEW PROPERTY</span>
          </button>
        </div>

        {/* MAIN DASHBOARD CONTAINER WITH SIDEBAR & CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* BLOCK 1: SIDEBAR NAVIGATION */}
          <div className="lg:col-span-3 space-y-2">
            <div className="bg-metallic-card rounded-2xl shadow-lg border border-slate-700/60 p-3 space-y-1">

              {(user?.role === 'ADMIN' || user?.email === 'admin@easeland.in' || user?.email?.includes('admin')) && (
                <button
                  onClick={() => onNavigate('admin')}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-xs font-black transition-all bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 shadow-xl border border-amber-300 mb-2 transform hover:scale-[1.02]"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-slate-950" />
                    <span>ADMIN CONTROL STUDIO</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-950" />
                </button>
              )}

              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-extrabold transition-all border ${activeTab === 'overview'
                    ? 'bg-metallic-gold text-slate-950 border-amber-300 shadow-md'
                    : 'text-slate-300 border-transparent hover:bg-slate-800 hover:text-slate-100'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className={`w-4 h-4 ${activeTab === 'overview' ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>Overview</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>

              <button
                onClick={() => setActiveTab('properties')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-extrabold transition-all border ${activeTab === 'properties'
                    ? 'bg-metallic-gold text-slate-950 border-amber-300 shadow-md'
                    : 'text-slate-300 border-transparent hover:bg-slate-800 hover:text-slate-100'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Building2 className={`w-4 h-4 ${activeTab === 'properties' ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>My Properties ({userProperties.length})</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>

              <button
                onClick={() => setActiveTab('verification')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-extrabold transition-all border ${activeTab === 'verification'
                    ? 'bg-metallic-gold text-slate-950 border-amber-300 shadow-md'
                    : 'text-slate-300 border-transparent hover:bg-slate-800 hover:text-slate-100'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className={`w-4 h-4 ${activeTab === 'verification' ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>Verification Status</span>
                </div>
                {userProperties.some(p => p.status === 'PENDING_VERIFICATION') && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('enquiries')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-extrabold transition-all border ${activeTab === 'enquiries'
                    ? 'bg-metallic-gold text-slate-950 border-amber-300 shadow-md'
                    : 'text-slate-300 border-transparent hover:bg-slate-800 hover:text-slate-100'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className={`w-4 h-4 ${activeTab === 'enquiries' ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>Enquiries</span>
                </div>
                {enquiriesReceived.filter(e => e.status === 'SUBMITTED').length > 0 && (
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {enquiriesReceived.filter(e => e.status === 'SUBMITTED').length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('wishlist')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-extrabold transition-all border ${activeTab === 'wishlist'
                    ? 'bg-metallic-gold text-slate-950 border-amber-300 shadow-md'
                    : 'text-slate-300 border-transparent hover:bg-slate-800 hover:text-slate-100'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Heart className={`w-4 h-4 ${activeTab === 'wishlist' ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>Wishlist ({wishlistProperties.length})</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>

              <button
                onClick={() => setActiveTab('notifications')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-extrabold transition-all border ${activeTab === 'notifications'
                    ? 'bg-metallic-gold text-slate-950 border-amber-300 shadow-md'
                    : 'text-slate-300 border-transparent hover:bg-slate-800 hover:text-slate-100'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Bell className={`w-4 h-4 ${activeTab === 'notifications' ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>Notifications</span>
                </div>
                {unreadNotificationsCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('account')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-extrabold transition-all border ${activeTab === 'account'
                    ? 'bg-metallic-gold text-slate-950 border-amber-300 shadow-md'
                    : 'text-slate-300 border-transparent hover:bg-slate-800 hover:text-slate-100'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Settings className={`w-4 h-4 ${activeTab === 'account' ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>Account Settings</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>

            </div>
          </div>

          {/* RIGHT CONTENT PANEL */}
          <div className="lg:col-span-9 space-y-6">

            {/* TAB 1: OVERVIEW HOME */}
            {activeTab === 'overview' && (
              <div className="space-y-6">

                {/* METRICS CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 text-xs font-bold uppercase tracking-wider block">My Listings</span>
                      <span className="text-2xl font-black text-brand-charcoal mt-1 block">{userProperties.length}</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-brand-yellow/20 text-brand-charcoal flex items-center justify-center font-black">
                      <Building2 className="w-6 h-6 text-brand-charcoal" />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 text-xs font-bold uppercase tracking-wider block">Verified Live</span>
                      <span className="text-2xl font-black text-emerald-600 mt-1 block">
                        {userProperties.filter(p => p.status === 'APPROVED').length}
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 text-xs font-bold uppercase tracking-wider block">Total Enquiries</span>
                      <span className="text-2xl font-black text-brand-charcoal mt-1 block">{enquiriesReceived.length}</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 text-xs font-bold uppercase tracking-wider block">Saved Wishlist</span>
                      <span className="text-2xl font-black text-brand-charcoal mt-1 block">{wishlist.length}</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center font-black">
                      <Heart className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {/* ACTION REQUIRED VERIFICATION ALERT */}
                {userProperties.some(p => p.status === 'CHANGES_REQUIRED') && (
                  <div className="bg-amber-50 rounded-2xl p-5 border-2 border-amber-200 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-amber-900 text-sm">Verification Action Required</h3>
                        <button
                          onClick={() => setActiveTab('verification')}
                          className="text-xs font-extrabold text-amber-800 underline hover:text-amber-950"
                        >
                          View Details
                        </button>
                      </div>
                      <p className="text-xs text-amber-800 mt-1 font-medium">
                        Admin feedback received for <strong>Corner Open Plot near Inner Ring Road</strong>. Please re-upload clearer land title deed document (Pahani / Adangal extract).
                      </p>
                    </div>
                  </div>
                )}

                {/* RECENT PROPERTIES QUICK LIST */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-extrabold text-base text-brand-charcoal">Recent Posted Properties</h2>
                    <button
                      onClick={() => setActiveTab('properties')}
                      className="text-xs font-extrabold text-brand-charcoal hover:text-brand-yellow flex items-center gap-1"
                    >
                      <span>View All ({userProperties.length})</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {userProperties.map((prop) => (
                      <div key={prop.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <img
                            src={prop.image || prop.photos?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80'}
                            alt={prop.title}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80';
                            }}
                            className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                          />
                          <div>
                            <h3 className="font-extrabold text-sm text-brand-charcoal">{prop.title}</h3>
                            <p className="text-xs text-gray-500 font-medium flex items-center gap-2 mt-0.5">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{prop.location}</span>
                              <span>•</span>
                              <span className="font-bold text-brand-charcoal">{prop.price}</span>
                            </p>
                          </div>
                        </div>

                        <div>
                          {prop.status === 'APPROVED' && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Live & Verified
                            </span>
                          )}
                          {prop.status === 'PENDING' && (
                            <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                              <Clock className="w-3 h-3 text-blue-600" />
                              Under Review
                            </span>
                          )}
                          {prop.status === 'CHANGES_REQUIRED' && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Action Required
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2 & 3: MY PROPERTIES & VERIFICATION STATUS */}
            {(activeTab === 'properties' || activeTab === 'verification') && (
              <div className="space-y-6">

                {/* FILTER STATUS BAR */}
                <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'ALL', label: 'All Listings' },
                      { id: 'LIVE', label: 'Live & Verified' },
                      { id: 'PENDING_VERIFICATION', label: 'Under Review' },
                      { id: 'CHANGES_REQUIRED', label: 'Action Required' },
                      { id: 'UNAVAILABLE', label: 'Paused' },
                      { id: 'DRAFT', label: 'Drafts' },
                      { id: 'SOLD_RENTED', label: 'Sold / Closed' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setPropertyFilter(f.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all ${propertyFilter === f.id
                            ? 'bg-brand-charcoal text-white shadow'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => onPostProperty()}
                    className="bg-brand-yellow text-brand-charcoal font-extrabold text-xs px-4 py-2 rounded-xl shadow flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add New Property</span>
                  </button>
                </div>

                {/* PROPERTY LIST CARDS WITH CANONICAL OWNER ACTIONS & ADMIN FEEDBACK BANNERS */}
                {userProperties.filter(p => {
                  if (propertyFilter === 'ALL') return true;
                  if (propertyFilter === 'LIVE') return p.status === 'LIVE' || p.status === 'APPROVED';
                  if (propertyFilter === 'PENDING_VERIFICATION') return p.status === 'PENDING_VERIFICATION' || p.status === 'UNDER_REVIEW' || p.status === 'PENDING';
                  if (propertyFilter === 'CHANGES_REQUIRED') return p.status === 'CHANGES_REQUIRED';
                  if (propertyFilter === 'UNAVAILABLE') return p.status === 'UNAVAILABLE';
                  if (propertyFilter === 'DRAFT') return p.status === 'DRAFT';
                  if (propertyFilter === 'SOLD_RENTED') return ['SOLD', 'RENTED', 'ARCHIVED', 'REJECTED'].includes(p.status);
                  return true;
                }).length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm space-y-4">
                    <div className="w-16 h-16 bg-brand-yellow/20 text-brand-charcoal rounded-2xl mx-auto flex items-center justify-center text-2xl font-black">
                      🏡
                    </div>
                    <h3 className="text-lg font-extrabold text-brand-charcoal">No Properties Found</h3>
                    <p className="text-xs text-gray-500 max-w-md mx-auto font-medium">
                      No property listings match the selected filter. Click below to submit a new open plot, villa, apartment, or commercial property for direct owner discovery!
                    </p>
                    <button
                      onClick={() => onPostProperty()}
                      className="inline-flex items-center gap-2 bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-6 py-3 rounded-xl shadow transition-all"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Post New Property Now</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userProperties.filter(p => {
                      if (propertyFilter === 'ALL') return true;
                      if (propertyFilter === 'LIVE') return p.status === 'LIVE' || p.status === 'APPROVED';
                      if (propertyFilter === 'PENDING_VERIFICATION') return p.status === 'PENDING_VERIFICATION' || p.status === 'UNDER_REVIEW' || p.status === 'PENDING';
                      if (propertyFilter === 'CHANGES_REQUIRED') return p.status === 'CHANGES_REQUIRED';
                      if (propertyFilter === 'UNAVAILABLE') return p.status === 'UNAVAILABLE';
                      if (propertyFilter === 'DRAFT') return p.status === 'DRAFT';
                      if (propertyFilter === 'SOLD_RENTED') return ['SOLD', 'RENTED', 'ARCHIVED', 'REJECTED'].includes(p.status);
                      return true;
                    }).map((prop) => (
                      <div key={prop.id} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">

                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <img
                              src={prop.image || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80'}
                              alt={prop.title}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80';
                              }}
                              className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 shadow-sm"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-brand-yellow bg-brand-charcoal px-2.5 py-0.5 rounded-md">
                                  {prop.type}
                                </span>
                                <span className="text-xs font-semibold text-gray-500">• Ref: {prop.referenceId}</span>
                              </div>
                              <h3 className="font-extrabold text-base text-brand-charcoal mt-1">{prop.title}</h3>
                              <p className="text-xs text-gray-500 font-medium flex items-center gap-2 mt-0.5">
                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                <span>{prop.location}</span>
                                <span>•</span>
                                <span className="font-extrabold text-emerald-700 text-sm">{prop.price}</span>
                                <span>({prop.area})</span>
                              </p>
                            </div>
                          </div>

                          {/* STATUS BADGE */}
                          <div>
                            {(prop.status === 'LIVE' || prop.status === 'APPROVED') && (
                              <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-emerald-200">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                Live & Verified
                              </span>
                            )}
                            {(prop.status === 'PENDING_VERIFICATION' || prop.status === 'UNDER_REVIEW' || prop.status === 'PENDING') && (
                              <span className="bg-blue-100 text-blue-800 text-xs font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-blue-200">
                                <Clock className="w-4 h-4 text-blue-600" />
                                Under Audit
                              </span>
                            )}
                            {prop.status === 'CHANGES_REQUIRED' && (
                              <span className="bg-amber-100 text-amber-800 text-xs font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-amber-200">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                Action Required
                              </span>
                            )}
                            {prop.status === 'UNAVAILABLE' && (
                              <span className="bg-orange-100 text-orange-800 text-xs font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-orange-200">
                                <Clock className="w-4 h-4 text-orange-600" />
                                Paused
                              </span>
                            )}
                            {prop.status === 'SOLD' && (
                              <span className="bg-purple-100 text-purple-800 text-xs font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-purple-200">
                                <CheckCircle2 className="w-4 h-4 text-purple-600" />
                                Sold
                              </span>
                            )}
                            {prop.status === 'RENTED' && (
                              <span className="bg-indigo-100 text-indigo-800 text-xs font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-indigo-200">
                                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                Rented
                              </span>
                            )}
                            {prop.status === 'DRAFT' && (
                              <span className="bg-gray-100 text-gray-800 text-xs font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-gray-200">
                                <Edit className="w-4 h-4 text-gray-500" />
                                Draft
                              </span>
                            )}
                            {prop.status === 'REJECTED' && (
                              <span className="bg-red-100 text-red-800 text-xs font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-red-200">
                                <XCircle className="w-4 h-4 text-red-600" />
                                Rejected
                              </span>
                            )}
                            {prop.status === 'ARCHIVED' && (
                              <span className="bg-slate-100 text-slate-700 text-xs font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-slate-200">
                                <FileText className="w-4 h-4 text-slate-500" />
                                Archived
                              </span>
                            )}
                          </div>
                        </div>

                        {/* ADMIN FEEDBACK BANNER */}
                        <div className={`p-4 rounded-xl border text-xs font-medium ${prop.status === 'CHANGES_REQUIRED'
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : (prop.status === 'LIVE' || prop.status === 'APPROVED')
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                              : 'bg-blue-50 text-blue-900 border-blue-200'
                          }`}>
                          <span className="font-extrabold uppercase tracking-wider block mb-1">
                            Verification Status & Feedback:
                          </span>
                          <span>{prop.adminNote}</span>
                        </div>

                        {/* CARD FOOTER ACTIONS */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs font-extrabold text-gray-500">
                          <div className="flex items-center gap-4">
                            <span>Views: <strong className="text-brand-charcoal">{prop.views}</strong></span>
                            <span>Enquiries: <strong className="text-brand-charcoal">{prop.enquiriesCount}</strong></span>
                            <span>Listed: <strong className="text-brand-charcoal">{prop.dateListed}</strong></span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {/* DRAFT */}
                            {prop.status === 'DRAFT' && (
                              <button
                                onClick={() => onPostProperty(prop.propertyId)}
                                className="px-3 py-1.5 bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal rounded-lg flex items-center gap-1 font-bold shadow-sm"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Resume Draft</span>
                              </button>
                            )}

                            {/* CHANGES REQUIRED */}
                            {prop.status === 'CHANGES_REQUIRED' && (
                              <button
                                onClick={() => onPostProperty(prop.propertyId)}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1 font-bold shadow-sm"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Fix & Resubmit</span>
                              </button>
                            )}

                            {/* LIVE / APPROVED */}
                            {(prop.status === 'LIVE' || prop.status === 'APPROVED') && (
                              <>
                                <button
                                  onClick={() => onPostProperty(prop.id || prop.propertyId)}
                                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-brand-charcoal rounded-lg flex items-center gap-1"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => handleOwnerPropertyAction('UNAVAILABLE', prop)}
                                  className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-900 rounded-lg flex items-center gap-1"
                                >
                                  <Clock className="w-3.5 h-3.5 text-orange-600" />
                                  <span>Pause</span>
                                </button>
                                <button
                                  onClick={() => handleOwnerPropertyAction('SOLD', prop)}
                                  className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-lg flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Mark Sold</span>
                                </button>
                                <button
                                  onClick={() => handleOwnerPropertyAction('RENTED', prop)}
                                  className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded-lg flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Mark Rented</span>
                                </button>
                              </>
                            )}

                            {/* UNAVAILABLE (PAUSED) */}
                            {prop.status === 'UNAVAILABLE' && (
                              <button
                                onClick={() => handleOwnerPropertyAction('LIVE', prop)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 font-bold shadow-sm"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Unpause (Make Live)</span>
                              </button>
                            )}

                            {/* VIEW ON MAP (If published or live) */}
                            {prop.isPublished && (
                              <button
                                onClick={() => onNavigate('map')}
                                className="px-3 py-1.5 bg-brand-charcoal hover:bg-brand-charcoalLight text-white rounded-lg flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5 text-brand-yellow" />
                                <span>View on Map</span>
                              </button>
                            )}

                            {/* ARCHIVE (If not already archived) */}
                            {prop.status !== 'ARCHIVED' && (
                              <button
                                onClick={() => handleOwnerPropertyAction('ARCHIVE', prop)}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg flex items-center gap-1 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Archive</span>
                              </button>
                            )}

                            {/* DELETE PROPERTY PERMANENTLY */}
                            <button
                              onClick={() => handleOwnerPropertyAction('DELETE', prop)}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg flex items-center gap-1 transition-colors font-bold shadow-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Property</span>
                            </button>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

            {/* TAB 4: MY ENQUIRIES */}
            {activeTab === 'enquiries' && (
              <div className="space-y-6">

                {/* ENQUIRY TYPE TOGGLE */}
                <div className="bg-white rounded-2xl p-2 border border-gray-200 shadow-sm flex items-center gap-2 max-w-xs">
                  <button
                    onClick={() => setEnquiryType('RECEIVED')}
                    className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all ${enquiryType === 'RECEIVED'
                        ? 'bg-brand-charcoal text-white shadow'
                        : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    Received ({enquiriesReceived.length})
                  </button>
                  <button
                    onClick={() => setEnquiryType('SENT')}
                    className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all ${enquiryType === 'SENT'
                        ? 'bg-brand-charcoal text-white shadow'
                        : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    Sent ({enquiriesSent.length})
                  </button>
                </div>

                {/* ENQUIRY CARDS */}
                {enquiryType === 'RECEIVED' ? (
                  enquiriesReceived.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm space-y-4">
                      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center text-2xl font-black">
                        📩
                      </div>
                      <h3 className="text-lg font-extrabold text-brand-charcoal">No Enquiries Received Yet</h3>
                      <p className="text-xs text-gray-500 max-w-md mx-auto font-medium">
                        When buyers explore your verified property listings and submit direct contact requests, their details will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {enquiriesReceived.map((enq) => (
                        <div key={enq.id} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-brand-yellow bg-brand-charcoal px-3 py-1 rounded-full">
                              Property: {enq.propertyName}
                            </span>
                            <span className="text-xs text-gray-400 font-semibold">{enq.date}</span>
                          </div>

                          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                            <div className="flex items-center justify-between">
                              <h4 className="font-extrabold text-sm text-brand-charcoal">{enq.buyerName}</h4>
                              <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                                {enq.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-2 leading-relaxed font-medium">"{enq.message}"</p>
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-4 text-xs font-bold text-gray-600">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                {enq.buyerPhone}
                              </span>
                              <span className="flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5 text-blue-600" />
                                {enq.buyerEmail}
                              </span>
                            </div>

                            <a
                              href={`tel:${enq.buyerPhone}`}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow flex items-center gap-1.5"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>Call Buyer</span>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  enquiriesSent.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm space-y-4">
                      <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center text-2xl font-black">
                        📤
                      </div>
                      <h3 className="text-lg font-extrabold text-brand-charcoal">No Enquiries Sent Yet</h3>
                      <p className="text-xs text-gray-500 max-w-md mx-auto font-medium">
                        When you contact property owners or schedule site visits from the map view, your sent enquiries will be tracked here.
                      </p>
                      <button
                        onClick={() => onNavigate('map')}
                        className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-6 py-3 rounded-xl shadow-md inline-block"
                      >
                        Explore Interactive Map
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {enquiriesSent.map((enq) => (
                        <div key={enq.id} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-center justify-between">
                          <div>
                            <h4 className="font-extrabold text-sm text-brand-charcoal">{enq.propertyName}</h4>
                            <p className="text-xs text-gray-500 mt-1 font-medium">
                              Owner: <strong className="text-brand-charcoal">{enq.ownerName}</strong> ({enq.ownerPhone})
                            </p>
                          </div>
                          <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase">
                            Visit Scheduled
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                )}

              </div>
            )}

            {/* TAB 5: SAVED WISHLIST */}
            {activeTab === 'wishlist' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-extrabold text-lg text-brand-charcoal">My Saved Properties ({wishlist.length})</h2>
                </div>

                {wishlist.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center mx-auto">
                      <Heart className="w-8 h-8" />
                    </div>
                    <h3 className="font-extrabold text-base text-brand-charcoal">Your wishlist is empty</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto font-medium">
                      Browse properties on the map or home page and click the heart icon to save listings here for quick comparison.
                    </p>
                    <button
                      onClick={() => onNavigate('map')}
                      className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-6 py-3 rounded-xl shadow-md inline-block"
                    >
                      Browse Universal Map
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userProperties.map((prop) => (
                      <div key={prop.id} className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                        <img src={prop.image} alt={prop.title} className="w-full h-40 object-cover" />
                        <div className="p-4 space-y-2">
                          <h4 className="font-extrabold text-sm text-brand-charcoal">{prop.title}</h4>
                          <p className="text-xs font-extrabold text-emerald-700">{prop.price}</p>
                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full">
                              Available
                            </span>
                            <button
                              onClick={() => onWishlistToggle(prop.id)}
                              className="text-xs font-bold text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-extrabold text-lg text-brand-charcoal">Notification Center</h2>
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs font-extrabold text-brand-charcoal hover:text-brand-yellow"
                  >
                    Mark All as Read
                  </button>
                </div>

                <div className="space-y-3">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-4 rounded-xl border flex items-start gap-4 transition-all ${n.read ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-brand-yellow/10 border-brand-yellow/30'
                        }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${n.type === 'WARNING' ? 'bg-amber-500 text-white' : 'bg-brand-charcoal text-white'
                        }`}>
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-extrabold text-xs text-brand-charcoal">{n.title}</h4>
                          <span className="text-[10px] text-gray-400 font-semibold">{n.timestamp}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 font-medium">{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 7: ACCOUNT SETTINGS */}
            {activeTab === 'account' && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <h2 className="font-extrabold text-lg text-brand-charcoal">Account & Profile Settings</h2>

                {savedSuccess && (
                  <div className="bg-emerald-50 text-emerald-800 text-xs font-extrabold p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Profile settings updated successfully!</span>
                  </div>
                )}

                <form onSubmit={handleProfileSave} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-yellow/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-yellow/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-yellow/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        City / Location
                      </label>
                      <input
                        type="text"
                        value={profileForm.city}
                        onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-yellow/50"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="bg-brand-charcoal hover:bg-brand-charcoalLight disabled:opacity-50 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow-md flex items-center gap-2"
                    >
                      <Save className="w-4 h-4 text-brand-yellow" />
                      <span>{savingProfile ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
