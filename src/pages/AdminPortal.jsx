import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Lock,
  Calendar,
  Phone,
  Mail,
  User,
  Layers,
  RefreshCw,
  Archive,
  Clock,
  Search,
  Check,
  AlertTriangle,
  Building2,
  MapPin,
  Eye,
  EyeOff,
  LogOut,
  FileCheck,
  Filter,
  DollarSign,
  TrendingUp,
  Users,
  MessageSquare,
  Briefcase,
  Flag,
  History,
  Key,
  ChevronRight,
  PlusCircle,
  X,
  Globe,
  Layout,
  Palette,
  Image as ImageIcon,
  Share2,
  RotateCcw,
  Send,
  HelpCircle,
  Sliders,
  CheckSquare,
  Save,
  Upload,
  Video,
  Trash2
} from 'lucide-react';
import { mockApi, safeArray } from '../services/mockApi';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getVerificationQueue,
  getVerificationWorkspaceData,
  startPropertyReview,
  approvePropertyVerification,
  requestVerificationChanges,
  rejectPropertyVerification
} from '../firebase/verificationService.js';
import {
  getAllUsersAdmin,
  suspendUserAccount,
  unsuspendUserAccount,
  removeUserAccount
} from '../firebase/userService.js';
import {
  getAllEnquiriesAdmin,
  updateEnquiryStatusAdmin
} from '../firebase/enquiryService.js';
import {
  getAllReportsAdmin,
  resolveReportAdmin
} from '../firebase/reportService.js';
import {
  getSiteConfigAdmin,
  updateSiteModuleAdmin,
  publishSiteConfigAdmin
} from '../firebase/siteManagementService.js';

// Reusable Media Uploader with Local File Upload Dropzone + Direct URL + Live Preview
function MediaUploadInput({ label, value, onChange, placeholder = 'Paste image/video URL or select local file...' }) {
  const fileInputRef = React.useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target.result;
      onChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      {label && <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">{label}</label>}
      
      <div className="flex flex-col sm:flex-row items-stretch gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-800 pr-8 focus:outline-none focus:ring-2 focus:ring-brand-yellow"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 font-bold text-xs"
              title="Clear media"
            >
              ✕
            </button>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,video/*"
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="bg-brand-charcoal hover:bg-brand-charcoalLight text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5 text-brand-yellow" />
          <span>Upload File</span>
        </button>
      </div>

      {value && (
        <div className="relative mt-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 border border-gray-300">
            {value.startsWith('data:video') || value.endsWith('.mp4') ? (
              <video src={value} className="w-full h-full object-cover" />
            ) : (
              <img src={value} alt="Media Preview" className="w-full h-full object-cover" onError={(e) => e.target.src = '/easeland_hero_bg.jpg'} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-block mb-0.5">
              ✓ Active Custom Media Loaded
            </span>
            <p className="text-[11px] font-mono text-gray-500 truncate">{value}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs font-bold text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

const parseSafeDate = (val) => {
  if (!val) return 'Recent';
  if (val === 'Invalid Date') return 'Recent';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === 'Invalid Date') return 'Recent';
    if (trimmed === 'Recent' || trimmed.includes('Ago')) return trimmed;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return trimmed;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        return val.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch (e) {}
    }
    if (val.seconds) {
      return new Date(val.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  return 'Recent';
};

export default function AdminPortal() {
  const { user, profile, loginAdmin, logoutUser } = useAuth();

  // Admin Auth Gate State
  const [adminAuthEmail, setAdminAuthEmail] = useState('');
  const [adminAuthPassword, setAdminAuthPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState(null);

  const isAdminAuthenticated = profile?.role === 'ADMIN' || profile?.adminRole === true || localStorage.getItem('easeland_admin_authenticated') === 'true';

  const [activeTab, setActiveTab] = useState('cms'); 
  // 'cms', 'verification', 'workspace', 'users', 'enquiries', 'crm', 'followups', 'reports', 'archive', 'security'

  // Admin Profile & Dedicated Security Credentials State
  const [adminName, setAdminName] = useState(() => localStorage.getItem('easeland_admin_name') || 'EaseLand Admin');
  const [adminEmail, setAdminEmail] = useState(() => localStorage.getItem('easeland_admin_email') || 'admin@easeland.in');
  const [adminPhone, setAdminPhone] = useState(() => localStorage.getItem('easeland_admin_phone') || '');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');

  useEffect(() => {
    if (isAdminAuthenticated) {
      setAdminName(localStorage.getItem('easeland_admin_name') || 'EaseLand Admin');
      setAdminEmail(localStorage.getItem('easeland_admin_email') || 'admin@easeland.in');
      setAdminPhone(localStorage.getItem('easeland_admin_phone') || '');
    }
  }, [isAdminAuthenticated]);

  // Master Site Management CMS State (All 16 Modules)

  const [siteConfig, setSiteConfig] = useState(mockApi.getSiteConfig());
  const [cmsTab, setCmsTab] = useState('overview'); // 1-16 modules
  const [publishSuccessMessage, setPublishSuccessMessage] = useState('');

  const [globalSearch, setGlobalSearch] = useState('');
  const [verificationQueue, setVerificationQueue] = useState([]);
  const [deals, setDeals] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [allProperties, setAllProperties] = useState([]);
  const [allPropSearchQuery, setAllPropSearchQuery] = useState('');
  const [allPropStatusFilter, setAllPropStatusFilter] = useState('ALL');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [enlargedMediaUrl, setEnlargedMediaUrl] = useState(null);

  // Custom feedback text for verification review
  const [feedbackNote, setFeedbackNote] = useState('');

  // New Follow Up State
  const [newFollowUp, setNewFollowUp] = useState({
    customerName: '',
    propertyTitle: '',
    followUpDate: '2026-09-03',
    followUpTime: '11:00 AM',
    nextAction: '',
    notes: ''
  });

  // Registered Users Management State
  const [registeredUsersList, setRegisteredUsersList] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('ALL');

  // Suspension Modal State
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [selectedUserForSuspension, setSelectedUserForSuspension] = useState(null);
  const [suspensionDays, setSuspensionDays] = useState(7);
  const [suspensionHours, setSuspensionHours] = useState(0);
  const [suspensionReason, setSuspensionReason] = useState('Fraudulent Land Title Document Upload');
  const [customReasonText, setCustomReasonText] = useState('');

  // Account Removal Modal State
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [selectedUserForRemoval, setSelectedUserForRemoval] = useState(null);
  const [removalReason, setRemovalReason] = useState('Account permanently deleted by platform admin for policy violation');

  // Deal Dossier Modal State
  const [selectedDealForDossier, setSelectedDealForDossier] = useState(null);

  // Schedule Follow-Up Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    propertyTitle: '',
    followUpDate: new Date().toISOString().split('T')[0],
    followUpTime: '11:30 AM',
    nextAction: 'Site Visit & Legal Audit Discussion',
    notes: 'Schedule site visit with buyer and confirm loan clearance.'
  });
  const [crmStageFilter, setCrmStageFilter] = useState('ALL');

  // Reset to Default Modal State & Handler
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const handleResetToDefault = () => {
    const resetConfig = mockApi.resetSiteConfigAdmin();
    setSiteConfig({ ...resetConfig });
    setIsResetModalOpen(false);
    setPublishSuccessMessage('All 16 CMS modules have been reset to factory default settings!');
    setTimeout(() => setPublishSuccessMessage(''), 4000);
  };

  const handleOpenScheduleModal = (deal = null) => {
    if (deal) {
      setScheduleForm({
        customerName: deal.customerName || '',
        customerPhone: deal.customerPhone || '+91 98765 43210',
        customerEmail: deal.customerEmail || 'buyer@example.com',
        propertyTitle: deal.propertyTitle || '',
        followUpDate: new Date().toISOString().split('T')[0],
        followUpTime: '11:30 AM',
        nextAction: 'Site Visit & Physical Boundary Verification',
        notes: `Follow-up scheduled for deal ${deal.id} (${deal.stage})`
      });
    } else {
      setScheduleForm({
        customerName: 'Suresh Kumar',
        customerPhone: '+91 98765 43210',
        customerEmail: 'suresh.k@example.com',
        propertyTitle: 'Gated Community Residential Plot in Vidyanagar',
        followUpDate: new Date().toISOString().split('T')[0],
        followUpTime: '11:30 AM',
        nextAction: 'Call customer to confirm loan eligibility and close final offer at Rs. 31 Lakhs.',
        notes: 'Customer requested bank approval clearance document before signing agreement.'
      });
    }
    setIsScheduleModalOpen(true);
  };

  const handleSaveFollowUp = (e) => {
    e.preventDefault();
    mockApi.createFollowUpAdmin(scheduleForm);
    setFollowUps(mockApi.getFollowUpsAdmin());
    setIsScheduleModalOpen(false);
  };

  const handleUpdateDealStage = (dealId, stage) => {
    mockApi.updateDealStageAdmin(dealId, stage);
    setDeals(mockApi.getDealsAdmin());
  };

  const handleToggleFollowUpStatus = (fupId) => {
    const updated = followUps.map(f => {
      if (f.id === fupId) {
        const nextStatus = f.status === 'COMPLETED' ? 'SCHEDULED' : 'COMPLETED';
        return { ...f, status: nextStatus };
      }
      return f;
    });
    setFollowUps(updated);
  };

  const loadData = async () => {
    // 1. Verification Queue (Retrieved directly from Cloud Firestore, Postgres & local storage)
    let queue = [];
    let allMergedProps = [];
    try {
      const vRes = await getVerificationQueue();
      let firebaseProps = (vRes.success && Array.isArray(vRes.properties)) ? vRes.properties : [];

      let postgresProps = [];
      try {
        const pgRes = await fetch('/api/properties');
        if (pgRes.ok) {
          const pgData = await pgRes.json();
          if (pgData.success && Array.isArray(pgData.properties)) {
            postgresProps = pgData.properties;
          }
        }
      } catch (pgErr) {}

      let localProps = [];
      try {
        if (typeof window !== 'undefined') {
          const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties', 'easeland_submitted_properties'];
          keys.forEach(k => {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) localProps.push(...parsed);
              else if (parsed && typeof parsed === 'object') localProps.push(parsed);
            }
          });
        }
      } catch (lErr) {}

      const queueMap = new Map();
      let mockQueueProps = typeof mockApi.getVerificationQueue === 'function' ? mockApi.getVerificationQueue() : [];
      let mockAllProps = typeof mockApi.getAllPropertiesAdmin === 'function' ? mockApi.getAllPropertiesAdmin() : [];

      [...mockQueueProps, ...mockAllProps, ...localProps, ...postgresProps, ...firebaseProps].forEach(p => {
        if (!p) return;
        const pId = String(p.id || p.propertyId || p.referenceId || '');
        if (pId) {
          const prev = queueMap.get(pId) || {};
          const mergedMedia = [
            ...(Array.isArray(prev.media) ? prev.media : []),
            ...(Array.isArray(p.media) ? p.media : []),
            ...(Array.isArray(p.photos) ? p.photos : []),
            ...(Array.isArray(p.publicApprovedMedia) ? p.publicApprovedMedia : [])
          ];
          const mergedDocs = [
            ...(Array.isArray(prev.documents) ? prev.documents : []),
            ...(Array.isArray(p.documents) ? p.documents : []),
            ...(Array.isArray(p.propertyDocuments) ? p.propertyDocuments : []),
            ...(Array.isArray(p.confidentialDocuments) ? p.confidentialDocuments : [])
          ];

          queueMap.set(pId, {
            ...prev,
            ...p,
            id: pId,
            propertyId: pId,
            media: mergedMedia.length > 0 ? mergedMedia : (p.media || prev.media || []),
            photos: (Array.isArray(p.photos) && p.photos.length > 0) ? p.photos : (prev.photos || []),
            documents: mergedDocs.length > 0 ? mergedDocs : (p.documents || prev.documents || []),
            videoUrl: p.videoUrl || prev.videoUrl || null,
            videoLink: p.videoLink || prev.videoLink || null,
            embeddedVideoUrl: p.embeddedVideoUrl || prev.embeddedVideoUrl || null,
            owner: {
              ...(prev.owner || {}),
              ...(p.owner || {}),
              name: p.ownerPublicName || p.owner?.name || prev.owner?.name,
              phone: p.ownerPrivatePhone || p.ownerPublicPhone || p.owner?.phone || prev.owner?.phone,
              email: p.ownerPrivateEmail || p.owner?.email || prev.owner?.email
            }
          });
        }
      });
      let deletedIds = [];
      try {
        if (typeof window !== 'undefined') {
          const rawDeleted = localStorage.getItem('easeland_deleted_properties');
          if (rawDeleted) deletedIds = JSON.parse(rawDeleted).map(String);
        }
      } catch (e) {}

      const FAKE_DEMO_IDS = ['prop-102', 'prop-104', 'prop-105'];
      allMergedProps = Array.from(queueMap.values()).filter(p => {
        if (!p) return false;
        const id1 = String(p.id || '');
        const id2 = String(p.propertyId || '');
        const id3 = String(p.referenceId || '');
        if (deletedIds.includes(id1) || deletedIds.includes(id2) || deletedIds.includes(id3)) return false;
        if (FAKE_DEMO_IDS.includes(id1) || FAKE_DEMO_IDS.includes(id2) || FAKE_DEMO_IDS.includes(id3)) return false;
        const ownerName = String(p.owner?.name || p.ownerPublicName || '').toLowerCase();
        const ownerEmail = String(p.owner?.email || p.ownerPrivateEmail || '').toLowerCase();
        if (ownerName.includes('demo owner') || ownerEmail.includes('testowner@easeland.in')) return false;
        const title = (p.title || '').trim();
        return title.length > 0 && title !== '.' && title !== ',';
      });

      queue = allMergedProps.filter(p => {
        if (!p) return false;
        const st = String(p.status || p.listingStatus || '').toUpperCase();
        const lst = String(p.listingStatus || '').toUpperCase();
        const isLive = st === 'LIVE' || st === 'APPROVED_LIVE' || st === 'APPROVED' || lst === 'LIVE' || lst === 'APPROVED_LIVE' || lst === 'APPROVED' || (p.isPlatformVerified === true && p.isPublished === true);
        const isClosed = st === 'REJECTED' || st === 'DELETED' || st === 'REJECTED_CLOSED' || st === 'CLOSED' || st === 'ARCHIVED' || lst === 'REJECTED' || lst === 'DELETED' || lst === 'REJECTED_CLOSED' || lst === 'CLOSED' || lst === 'ARCHIVED';
        return !isLive && !isClosed;
      });
    } catch (e1) {
      console.warn('Error loading verification queue:', e1);
    }

    // 2. Users (Strictly Cloud Firestore Data)
    let users = [];
    try {
      const usersRes = await getAllUsersAdmin();
      users = (usersRes.success && Array.isArray(usersRes.users)) ? usersRes.users : [];
    } catch (e2) {
      console.warn('Error loading users from Firestore:', e2);
    }

    // Enrich verification queue properties with matching registered user account details
    queue = queue.map(p => {
      const oId = p.ownerId || p.owner?.id || p.userId || p.uid || p.submittedBy || p.createdBy;
      const oEmail = (p.ownerPrivateEmail || p.ownerPublicEmail || p.owner?.email || p.email || p.userEmail || '').toLowerCase().trim();
      
      let matchedUser = users.find(u => {
        if (!u) return false;
        const uUid = String(u.uid || u.id || '').toLowerCase().trim();
        const uEmail = (u.email || '').toLowerCase().trim();
        const matchesId = oId && uUid && (uUid === String(oId).toLowerCase().trim());
        const matchesEmail = oEmail && uEmail && (uEmail === oEmail);
        return matchesId || matchesEmail;
      });

      // Local storage fallback for user profile if not found in Firestore users array
      let localUserProfile = null;
      if (!matchedUser && typeof window !== 'undefined') {
        try {
          if (oId) {
            const rawStored = localStorage.getItem('easeland_user_profile_' + oId);
            if (rawStored) localUserProfile = JSON.parse(rawStored);
          }
          if (!localUserProfile && oEmail) {
            const rawReg = localStorage.getItem('easeland_registered_users');
            if (rawReg) {
              const regArr = JSON.parse(rawReg);
              if (Array.isArray(regArr)) {
                localUserProfile = regArr.find(u => u && u.email && u.email.toLowerCase().trim() === oEmail);
              }
            }
          }
        } catch (e) {}
      }

      const effectiveUser = matchedUser || localUserProfile;

      // Check if owner matches currently authenticated session user
      const isCurrentSessionUser = user && (
        (oId && (String(user.uid || user.id) === String(oId))) ||
        (oEmail && user.email && user.email.toLowerCase().trim() === oEmail)
      );

      let resolvedName = '';
      if (effectiveUser?.displayName || effectiveUser?.name || effectiveUser?.fullName) {
        resolvedName = effectiveUser.displayName || effectiveUser.name || effectiveUser.fullName;
      } else if (isCurrentSessionUser && (user.displayName || user.name || profile?.name || profile?.displayName)) {
        resolvedName = user.displayName || user.name || profile?.name || profile?.displayName;
      } else if (p.ownerPublicName && !['Property Owner', 'Verified Property Owner', 'Verified Owner'].includes(p.ownerPublicName.trim())) {
        resolvedName = p.ownerPublicName.trim();
      } else if (p.owner?.name && !['Property Owner', 'Verified Property Owner', 'Verified Owner'].includes(p.owner.name.trim())) {
        resolvedName = p.owner.name.trim();
      } else if (effectiveUser?.email || oEmail || (isCurrentSessionUser && user.email) || p.ownerPrivateEmail || p.owner?.email) {
        resolvedName = effectiveUser?.email || oEmail || (isCurrentSessionUser && user.email) || p.ownerPrivateEmail || p.owner?.email;
      } else {
        resolvedName = 'Registered Account Owner';
      }

      const rawPhone =
        effectiveUser?.phone ||
        effectiveUser?.phoneNumber ||
        effectiveUser?.mobile ||
        effectiveUser?.contactNumber ||
        effectiveUser?.contactPhone ||
        effectiveUser?.phoneNo ||
        effectiveUser?.contact ||
        effectiveUser?.telePhone ||
        effectiveUser?.profile?.phone ||
        effectiveUser?.profile?.phoneNumber ||
        (isCurrentSessionUser && (profile?.phone || profile?.phoneNumber || profile?.mobile || profile?.contactNumber || user?.phoneNumber || user?.phone)) ||
        p.ownerPrivatePhone ||
        p.ownerPublicPhone ||
        p.owner?.phone ||
        p.owner?.phoneNumber ||
        p.ownerContact ||
        p.contactNumber ||
        p.contactPhone ||
        p.phone ||
        p.mobile;

      const cleanedPhone = rawPhone ? String(rawPhone).trim() : '';
      const isPlaceholder = !cleanedPhone ||
        cleanedPhone === '+91 98765 43210' ||
        (cleanedPhone === '9876543210' && !effectiveUser && !isCurrentSessionUser) ||
        cleanedPhone === '+91 N/A' ||
        cleanedPhone === 'N/A' ||
        cleanedPhone === 'undefined' ||
        cleanedPhone === 'null';

      const resolvedPhone = !isPlaceholder ? cleanedPhone : 'Number Not Updated';
      const resolvedEmail = effectiveUser?.email || oEmail || (isCurrentSessionUser && user.email) || p.ownerPrivateEmail || p.owner?.email || '';

      return {
        ...p,
        owner: {
          ...(p.owner || {}),
          name: resolvedName,
          phone: resolvedPhone,
          email: resolvedEmail
        }
      };
    });

    // 3. Enquiries
    let enqs = [];
    try {
      const enqsRes = await getAllEnquiriesAdmin();
      enqs = (enqsRes.success && Array.isArray(enqsRes.enquiries)) ? enqsRes.enquiries : (typeof mockApi.getEnquiriesAdmin === 'function' ? mockApi.getEnquiriesAdmin() : []);
    } catch (e3) {
      console.warn('Error loading enquiries:', e3);
    }

    // 4. Reports
    let reports = [];
    try {
      const reportsRes = await getAllReportsAdmin();
      reports = (reportsRes.success && Array.isArray(reportsRes.reports)) ? reportsRes.reports : [];
    } catch (e4) {
      console.warn('Error loading reports:', e4);
    }

    // 5. Site Config
    let cfg = {};
    try {
      const cfgRes = await getSiteConfigAdmin();
      cfg = (cfgRes.success && Object.keys(cfgRes.config).length > 0) ? cfgRes.config : mockApi.getSiteConfig();
    } catch (e5) {
      console.warn('Error loading site config:', e5);
    }

    const dls = typeof mockApi.getDealsAdmin === 'function' ? mockApi.getDealsAdmin() : [];
    const fups = typeof mockApi.getFollowUpsAdmin === 'function' ? mockApi.getFollowUpsAdmin() : [];
    const props = typeof mockApi.getAllPropertiesAdmin === 'function' ? mockApi.getAllPropertiesAdmin() : [];

    const finalAllProperties = allMergedProps.length > 0 ? allMergedProps : props;

    setVerificationQueue(queue);
    setDeals(dls);
    setFollowUps(fups);
    setEnquiries(enqs);
    setAllProperties(finalAllProperties);
    let deletedUsers = [];
    try {
      if (typeof window !== 'undefined') {
        const rawDel = localStorage.getItem('easeland_deleted_users');
        if (rawDel) deletedUsers = JSON.parse(rawDel).map(v => String(v).toLowerCase().trim());
      }
    } catch (e) {}

    const cleanUsers = users.filter(u => {
      if (!u) return false;
      const uId = String(u.id || u.uid || '').toLowerCase().trim();
      const uEmail = String(u.email || '').toLowerCase().trim();
      const st = String(u.status || u.accountStatus || '').toUpperCase();
      if (st === 'REMOVED' || st === 'DELETED' || st === 'ACCOUNT_DELETED') return false;
      if (deletedUsers.includes(uId) || deletedUsers.includes(uEmail)) return false;
      return true;
    });

    const enrichedUsers = cleanUsers.map(u => {
      const uUid = String(u.uid || u.id || '').toLowerCase().trim();
      const uEmail = (u.email || '').toLowerCase().trim();

      const userListings = finalAllProperties.filter(p => {
        if (!p) return false;
        const pOwnerId = String(p.ownerId || p.owner?.id || p.userId || p.uid || p.createdBy || '').toLowerCase().trim();
        const pEmail = (p.ownerPrivateEmail || p.ownerPublicEmail || p.owner?.email || p.email || p.userEmail || '').toLowerCase().trim();
        return (uUid && pOwnerId && uUid === pOwnerId) || (uEmail && pEmail && uEmail === pEmail);
      });

      const isUserAdmin = u.role === 'ADMIN' || u.email === 'admin@easeland.in';
      let derivedRole = u.role;
      if (!isUserAdmin) {
        derivedRole = userListings.length > 0 ? 'VERIFIED PROPERTY OWNER & BUYER' : 'USER';
      }

      return {
        ...u,
        role: derivedRole,
        postedListingsCount: userListings.length,
        authProvider: u.authProvider || (u.email?.endsWith('@gmail.com') ? 'Google OAuth' : 'Email/Password'),
        emailVerified: u.emailVerified ?? (u.email ? true : false)
      };
    });

    setRegisteredUsersList(enrichedUsers);
    setSiteConfig(cfg);

    if (queue.length > 0) {
      setSelectedProperty(prev => {
        if (prev) {
          const prevId = String(prev.id || prev.propertyId || prev.referenceId || '');
          const match = queue.find(q => String(q.id || q.propertyId || q.referenceId || '') === prevId);
          if (match) return match;
        }
        return queue[0];
      });
    } else {
      setSelectedProperty(null);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    const handleConfigUpdated = (e) => setSiteConfig(e.detail || mockApi.getSiteConfig());

    window.addEventListener('easeland-users-updated', handleRefresh);
    window.addEventListener('easeland-property-created', handleRefresh);
    window.addEventListener('easeland-property-submitted', handleRefresh);
    window.addEventListener('easeland-property-approved', handleRefresh);
    window.addEventListener('easeland-property-status-updated', handleRefresh);
    window.addEventListener('easeland-property-updated', handleRefresh);
    window.addEventListener('easeland-property-deleted', handleRefresh);
    window.addEventListener('easeland-site-config-updated', handleConfigUpdated);
    window.addEventListener('storage', handleRefresh);

    return () => {
      window.removeEventListener('easeland-users-updated', handleRefresh);
      window.removeEventListener('easeland-property-created', handleRefresh);
      window.removeEventListener('easeland-property-submitted', handleRefresh);
      window.removeEventListener('easeland-property-approved', handleRefresh);
      window.removeEventListener('easeland-property-status-updated', handleRefresh);
      window.removeEventListener('easeland-property-updated', handleRefresh);
      window.removeEventListener('easeland-property-deleted', handleRefresh);
      window.removeEventListener('easeland-site-config-updated', handleConfigUpdated);
      window.removeEventListener('storage', handleRefresh);
    };
  }, []);

  const filteredAllProperties = React.useMemo(() => {
    return allProperties.filter(p => {
      if (!p) return false;
      const st = String(p.status || p.listingStatus || '').toUpperCase();
      const lst = String(p.listingStatus || '').toUpperCase();
      const vst = String(p.verificationStatus || '').toUpperCase();

      if (allPropStatusFilter === 'LIVE' && !(st === 'LIVE' || lst === 'LIVE' || vst === 'PLATFORM VERIFIED' || p.isPlatformVerified)) return false;
      if (allPropStatusFilter === 'PENDING_VERIFICATION' && !(st === 'PENDING_VERIFICATION' || lst === 'PENDING_VERIFICATION')) return false;
      if (allPropStatusFilter === 'DRAFT' && !(st === 'DRAFT' || lst === 'DRAFT')) return false;
      if (allPropStatusFilter === 'REJECTED' && !(st === 'REJECTED' || lst === 'REJECTED')) return false;
      if (allPropStatusFilter === 'CHANGES_REQUIRED' && !(st === 'CHANGES_REQUIRED' || lst === 'CHANGES_REQUIRED')) return false;

      if (!allPropSearchQuery.trim()) return true;

      const q = allPropSearchQuery.toLowerCase().trim();
      const title = (p.title || '').toLowerCase();
      const ownerName = (p.owner?.name || p.ownerPublicName || '').toLowerCase();
      const ownerEmail = (p.owner?.email || p.ownerPrivateEmail || '').toLowerCase();
      const ownerPhone = (p.owner?.phone || p.ownerPrivatePhone || '').toLowerCase();
      const city = (p.location?.city || p.city || '').toLowerCase();
      const locality = (p.location?.locality || p.locality || '').toLowerCase();

      return title.includes(q) || ownerName.includes(q) || ownerEmail.includes(q) || ownerPhone.includes(q) || city.includes(q) || locality.includes(q);
    });
  }, [allProperties, allPropSearchQuery, allPropStatusFilter]);

  const handleDeletePropertyFromAdmin = async (propId) => {
    if (!propId) return;
    const confirmDel = window.confirm('Are you sure you want to permanently delete this property listing?');
    if (!confirmDel) return;

    const pIdStr = String(propId);
    try {
      const rawDeleted = localStorage.getItem('easeland_deleted_properties') || '[]';
      const parsedDeleted = JSON.parse(rawDeleted);
      if (!parsedDeleted.includes(pIdStr)) parsedDeleted.push(pIdStr);
      localStorage.setItem('easeland_deleted_properties', JSON.stringify(parsedDeleted));
    } catch (e) {}

    setAllProperties(prev => prev.filter(p => p && String(p.id || p.propertyId) !== pIdStr));
    setVerificationQueue(prev => prev.filter(p => p && String(p.id || p.propertyId) !== pIdStr));

    try {
      const { deletePropertyListing } = await import('../firebase/propertyService.js');
      await deletePropertyListing(propId, user?.uid, true);
    } catch (e) {}

    try {
      const { mockApi } = await import('../services/mockApi.js');
      if (typeof mockApi.deleteProperty === 'function') {
        mockApi.deleteProperty(propId);
      }
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-property-deleted', { detail: { propertyId: propId } }));
    }

    await loadData();
  };

  const [adminActionProcessing, setAdminActionProcessing] = useState(false);

  const handleSaveDraftConfig = async () => {
    if (adminActionProcessing) return;
    setAdminActionProcessing(true);
    try {
      const adminUid = user?.uid || 'admin_auditor';
      await updateSiteModuleAdmin('master_draft', siteConfig, adminUid);
      setPublishSuccessMessage('Draft changes saved successfully.');
      setTimeout(() => setPublishSuccessMessage(''), 3000);
    } finally {
      setAdminActionProcessing(false);
    }
  };

  const handlePublishSiteConfig = async () => {
    if (adminActionProcessing) return;
    setAdminActionProcessing(true);
    try {
      const adminUid = user?.uid || 'admin_auditor';
      await publishSiteConfigAdmin(siteConfig, adminUid);
      setPublishSuccessMessage('Website configuration published live! All changes are active immediately on the public site.');
      setTimeout(() => setPublishSuccessMessage(''), 4000);
    } finally {
      setAdminActionProcessing(false);
    }
  };

  const handleApprove = async (propId) => {
    if (adminActionProcessing || !propId) return;
    setAdminActionProcessing(true);
    try {
      const adminUid = user?.uid || 'admin_auditor';
      const adminName = user?.displayName || 'EaseLand Auditor';
      const note = feedbackNote || 'Verified & Approved by EaseLand Senior Admin Auditor.';

      // 1. Cloud Firestore update
      try {
        await approvePropertyVerification(propId, adminUid, adminName, note);
      } catch (e1) {}

      // 2. Mock API memory store update
      if (typeof mockApi.approvePropertyAdmin === 'function') {
        mockApi.approvePropertyAdmin(propId, note);
      }

      // 3. PostgreSQL database sync (/api/properties)
      try {
        const payload = {
          ...(selectedProperty || {}),
          propertyId: propId,
          id: propId,
          listingStatus: 'LIVE',
          status: 'LIVE',
          isPlatformVerified: true,
          isPublished: true,
          verifiedDate: new Date().toISOString(),
          verificationNotes: note,
          verificationStatus: 'Platform Verified'
        };
        await fetch('/api/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (pgErr) {}

      // 4. LocalStorage update
      try {
        const rawLocal = localStorage.getItem('easeland_user_properties');
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          const updated = parsed.map(p => {
            if ((p.id || p.propertyId) === propId) {
              return {
                ...p,
                listingStatus: 'LIVE',
                status: 'LIVE',
                isPlatformVerified: true,
                isPublished: true,
                verificationNotes: note,
                verificationStatus: 'Platform Verified'
              };
            }
            return p;
          });
          localStorage.setItem('easeland_user_properties', JSON.stringify(updated));
        }
      } catch (lErr) {}

      // 5. Notify window to refresh all user dashboards immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('easeland-property-approved', { detail: { propertyId: propId, status: 'LIVE' } }));
        window.dispatchEvent(new CustomEvent('easeland-property-status-updated', { detail: { propertyId: propId, status: 'LIVE' } }));
      }

      setPublishSuccessMessage('Property approved and successfully published LIVE!');
      setFeedbackNote('');
      setIsWorkspaceOpen(false);
      setSelectedProperty(null);
      setActiveTab('verification');
      await loadData();
      setTimeout(() => setPublishSuccessMessage(''), 4000);
    } finally {
      setAdminActionProcessing(false);
    }
  };

  const handleReject = async (propId) => {
    if (adminActionProcessing || !propId) return;
    if (!feedbackNote || feedbackNote.trim().length < 5) {
      alert('Please enter a detailed reason for rejection in the Auditor Notes field.');
      return;
    }
    setAdminActionProcessing(true);
    try {
      const adminUid = user?.uid || 'admin_auditor';
      const adminName = user?.displayName || 'EaseLand Auditor';
      const note = feedbackNote;

      try {
        await rejectPropertyVerification(propId, adminUid, adminName, note);
      } catch (e1) {}

      if (typeof mockApi.rejectPropertyAdmin === 'function') {
        mockApi.rejectPropertyAdmin(propId, note);
      }

      const payload = {
        ...(selectedProperty || {}),
        propertyId: propId,
        id: propId,
        listingStatus: 'REJECTED',
        status: 'REJECTED',
        isPlatformVerified: false,
        isPublished: false,
        verificationNotes: note,
        ownerFacingNotes: note,
        adminNotes: note,
        adminFeedback: note,
        rejectionReason: note
      };

      try {
        await fetch('/api/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (pgErr) {}

      try {
        const targetIdStr = String(propId);
        const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties', 'easeland_submitted_properties'];
        keys.forEach(k => {
          const rawLocal = localStorage.getItem(k);
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (Array.isArray(parsed)) {
              const updated = parsed.map(p => {
                if (p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr)) {
                  return {
                    ...p,
                    listingStatus: 'REJECTED',
                    status: 'REJECTED',
                    isPlatformVerified: false,
                    isPublished: false,
                    verificationNotes: note,
                    ownerFacingNotes: note,
                    adminNotes: note,
                    adminFeedback: note,
                    rejectionReason: note
                  };
                }
                return p;
              });
              localStorage.setItem(k, JSON.stringify(updated));
            }
          }
        });
      } catch (lErr) {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('easeland-property-status-updated', { detail: payload }));
        window.dispatchEvent(new CustomEvent('easeland-property-updated', { detail: payload }));
      }

      setPublishSuccessMessage('Property listing has been rejected.');
      setFeedbackNote('');
      setIsWorkspaceOpen(false);
      setSelectedProperty(null);
      setActiveTab('verification');
      await loadData();
      setTimeout(() => setPublishSuccessMessage(''), 4000);
    } finally {
      setAdminActionProcessing(false);
    }
  };

  const handleRequestChanges = async (propId) => {
    if (adminActionProcessing || !propId) return;
    if (!feedbackNote || feedbackNote.trim().length < 5) {
      alert('Please specify what document/boundary changes are requested in the Auditor Notes field.');
      return;
    }
    setAdminActionProcessing(true);
    try {
      const adminUid = user?.uid || 'admin_auditor';
      const adminName = user?.displayName || 'EaseLand Auditor';
      const note = feedbackNote;

      try {
        await requestVerificationChanges(propId, adminUid, adminName, note);
      } catch (e1) {}

      if (typeof mockApi.requestChangesAdmin === 'function') {
        mockApi.requestChangesAdmin(propId, note);
      }

      const payload = {
        ...(selectedProperty || {}),
        propertyId: propId,
        id: propId,
        listingStatus: 'CHANGES_REQUIRED',
        status: 'CHANGES_REQUIRED',
        isPublished: false,
        ownerFacingNotes: note,
        verificationNotes: note,
        adminNotes: note,
        adminFeedback: note
      };

      try {
        await fetch('/api/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (pgErr) {}

      try {
        const targetIdStr = String(propId);
        const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties', 'easeland_submitted_properties'];
        keys.forEach(k => {
          const rawLocal = localStorage.getItem(k);
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (Array.isArray(parsed)) {
              const updated = parsed.map(p => {
                if (p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr)) {
                  return {
                    ...p,
                    listingStatus: 'CHANGES_REQUIRED',
                    status: 'CHANGES_REQUIRED',
                    isPublished: false,
                    verificationNotes: note,
                    ownerFacingNotes: note,
                    adminNotes: note,
                    adminFeedback: note
                  };
                }
                return p;
              });
              localStorage.setItem(k, JSON.stringify(updated));
            }
          }
        });
      } catch (lErr) {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('easeland-property-status-updated', { detail: payload }));
        window.dispatchEvent(new CustomEvent('easeland-property-updated', { detail: payload }));
      }

      setPublishSuccessMessage('Document changes requested from property owner.');
      setFeedbackNote('');
      setIsWorkspaceOpen(false);
      setSelectedProperty(null);
      setActiveTab('verification');
      await loadData();
      setTimeout(() => setPublishSuccessMessage(''), 4000);
    } finally {
      setAdminActionProcessing(false);
    }
  };

  const handleDeleteProperty = async (targetProp) => {
    const propId = typeof targetProp === 'object' ? (targetProp?.id || targetProp?.propertyId || targetProp?.referenceId) : targetProp;
    if (adminActionProcessing || !propId) {
      console.warn('Cannot delete property listing: Property ID is undefined or missing', targetProp);
      return;
    }

    if (!window.confirm('Are you sure you want to PERMANENTLY delete this property listing from the platform? This cannot be undone.')) return;

    setAdminActionProcessing(true);
    try {
      const pIdStr = String(propId);
      try {
        const rawDeleted = localStorage.getItem('easeland_deleted_properties') || '[]';
        const parsedDeleted = JSON.parse(rawDeleted);
        const idsToAdd = [pIdStr];
        if (selectedProperty) {
          if (selectedProperty.id) idsToAdd.push(String(selectedProperty.id));
          if (selectedProperty.propertyId) idsToAdd.push(String(selectedProperty.propertyId));
          if (selectedProperty.referenceId) idsToAdd.push(String(selectedProperty.referenceId));
        }
        idsToAdd.forEach(idVal => {
          if (idVal && !parsedDeleted.includes(idVal)) parsedDeleted.push(idVal);
        });
        localStorage.setItem('easeland_deleted_properties', JSON.stringify(parsedDeleted));
      } catch (e) {}

      // Immediately remove from UI state for 0ms lag
      setVerificationQueue(prev => prev.filter(p => {
        if (!p) return false;
        const id1 = String(p.id || '');
        const id2 = String(p.propertyId || '');
        const id3 = String(p.referenceId || '');
        return id1 !== pIdStr && id2 !== pIdStr && id3 !== pIdStr;
      }));

      const { deletePropertyListing } = await import('../firebase/propertyService.js');
      await deletePropertyListing(propId, user?.uid, true);

      try {
        const { mockApi } = await import('../services/mockApi.js');
        if (typeof mockApi.deleteProperty === 'function') {
          mockApi.deleteProperty(propId);
        }
      } catch (e) {}

      setPublishSuccessMessage('Property listing deleted successfully.');
      setIsWorkspaceOpen(false);
      setSelectedProperty(null);
      await loadData();
      setTimeout(() => setPublishSuccessMessage(''), 4000);
    } finally {
      setAdminActionProcessing(false);
    }
  };

  const handleCreateFollowUp = (e) => {
    e.preventDefault();
    mockApi.createFollowUpAdmin(newFollowUp);
    setNewFollowUp({ customerName: '', propertyTitle: '', followUpDate: '2026-09-03', followUpTime: '11:00 AM', nextAction: '', notes: '' });
    loadData();
  };

  const openWorkspace = async (prop) => {
    setSelectedProperty(prop);
    setIsWorkspaceOpen(true);
    setActiveTab('workspace');
    const pId = prop?.id || prop?.propertyId;
    if (!pId) return;

    // 1. Fetch full database property record from PostgreSQL
    try {
      const pgRes = await fetch(`/api/properties/${pId}`);
      if (pgRes.ok) {
        const pgData = await pgRes.json();
        if (pgData.success && pgData.property) {
          const pgProp = pgData.property;
          setSelectedProperty(prev => {
            const mergedMedia = [
              ...(Array.isArray(prev?.media) ? prev.media : []),
              ...(Array.isArray(pgProp.media) ? pgProp.media : []),
              ...(Array.isArray(pgProp.photos) ? pgProp.photos : [])
            ];
            const mergedDocs = [
              ...(Array.isArray(prev?.documents) ? prev.documents : []),
              ...(Array.isArray(pgProp.documents) ? pgProp.documents : []),
              ...(Array.isArray(pgProp.propertyDocuments) ? pgProp.propertyDocuments : [])
            ];
            return {
              ...prev,
              ...pgProp,
              media: mergedMedia.length > 0 ? mergedMedia : (pgProp.media || prev?.media || []),
              photos: (Array.isArray(pgProp.photos) && pgProp.photos.length > 0) ? pgProp.photos : (prev?.photos || []),
              documents: mergedDocs.length > 0 ? mergedDocs : (pgProp.documents || prev?.documents || []),
              videoUrl: pgProp.videoUrl || prev?.videoUrl || null,
              videoLink: pgProp.videoLink || prev?.videoLink || null,
              owner: {
                ...(prev?.owner || {}),
                ...(pgProp.owner || {}),
                name: pgProp.ownerPublicName || pgProp.owner?.name || prev?.owner?.name,
                phone: pgProp.ownerPrivatePhone || pgProp.ownerPublicPhone || pgProp.owner?.phone || prev?.owner?.phone,
                email: pgProp.ownerPrivateEmail || pgProp.owner?.email || prev?.owner?.email
              }
            };
          });
        }
      }
    } catch (e) {}

    // 2. Fetch confidential documents and verification evidence from Firestore
    try {
      const workspaceRes = await getVerificationWorkspaceData(pId);
      if (workspaceRes.success && workspaceRes.workspace?.property) {
        const wProp = workspaceRes.workspace.property;
        const wPrivate = workspaceRes.workspace.privateData || {};
        const wDocs = workspaceRes.workspace.documents || [];

        setSelectedProperty(prev => {
          const mergedMedia = [
            ...(Array.isArray(prev?.media) ? prev.media : []),
            ...(Array.isArray(wProp.media) ? wProp.media : []),
            ...(Array.isArray(wProp.photos) ? wProp.photos : []),
            ...(Array.isArray(wProp.publicApprovedMedia) ? wProp.publicApprovedMedia : [])
          ];
          const mergedDocs = [
            ...(Array.isArray(prev?.documents) ? prev.documents : []),
            ...(Array.isArray(wDocs) ? wDocs : []),
            ...(Array.isArray(wProp.documents) ? wProp.documents : []),
            ...(Array.isArray(wProp.propertyDocuments) ? wProp.propertyDocuments : []),
            ...(Array.isArray(wProp.confidentialDocuments) ? wProp.confidentialDocuments : [])
          ];
          return {
            ...prev,
            ...wProp,
            media: mergedMedia.length > 0 ? mergedMedia : (wProp.media || prev?.media || []),
            photos: (Array.isArray(wProp.photos) && wProp.photos.length > 0) ? wProp.photos : (prev?.photos || []),
            documents: mergedDocs.length > 0 ? mergedDocs : (wProp.documents || prev?.documents || []),
            videoUrl: wProp.videoUrl || prev?.videoUrl || null,
            videoLink: wProp.videoLink || prev?.videoLink || null,
            embeddedVideoUrl: wProp.embeddedVideoUrl || prev?.embeddedVideoUrl || null,
            owner: {
              ...(prev?.owner || {}),
              name: wProp.ownerPublicName || wProp.owner?.name || prev?.owner?.name,
              phone: wPrivate.ownerPrivatePhone || wProp.ownerPublicPhone || prev?.owner?.phone,
              email: wPrivate.ownerPrivateEmail || prev?.owner?.email
            }
          };
        });
      }
    } catch (e) {}

    try {
      if (user?.uid) {
        await startPropertyReview(pId, user.uid, user?.displayName || 'EaseLand Auditor');
      }
    } catch (err) {}
  };

  // User Suspension & Removal Handlers
  const handleSuspendUserModalOpen = (u) => {
    setSelectedUserForSuspension(u);
    setIsSuspendModalOpen(true);
  };

  const handleConfirmSuspendUser = async () => {
    if (!selectedUserForSuspension) return;
    const totalHours = (suspensionDays * 24) + parseInt(suspensionHours || 0);
    const reasonText = suspensionReason === 'Other' ? customReasonText : suspensionReason;
    
    try {
      await suspendUserAccount(selectedUserForSuspension.id || selectedUserForSuspension.uid, user?.uid || 'admin_uid_001', suspensionDays, reasonText);
    } catch(e) {}
    mockApi.suspendUserAdmin(selectedUserForSuspension.id, totalHours, reasonText);
    
    setRegisteredUsersList(prev => prev.map(u => {
      if (u.id === selectedUserForSuspension.id || u.email === selectedUserForSuspension.email) {
        return {
          ...u,
          accountStatus: 'SUSPENDED',
          status: 'SUSPENDED',
          suspensionReason: reasonText
        };
      }
      return u;
    }));

    setIsSuspendModalOpen(false);
    setSelectedUserForSuspension(null);
  };

  const handleUnsuspendUser = async (u) => {
    try {
      await unsuspendUserAccount(u.id || u.uid, user?.uid || 'admin_uid_001');
    } catch(e) {}
    mockApi.unsuspendUserAdmin(u.id);
    setRegisteredUsersList(prev => prev.map(usr => {
      if (usr.id === u.id || usr.email === usr.email) {
        return {
          ...usr,
          accountStatus: 'ACTIVE',
          status: 'ACTIVE'
        };
      }
      return usr;
    }));
  };

  const handleRemoveUserModalOpen = (u) => {
    setSelectedUserForRemoval(u);
    setRemovalReason('Account permanently deleted by platform admin for policy violation');
    setIsRemoveModalOpen(true);
  };

  const handleConfirmRemoveUser = async () => {
    if (!selectedUserForRemoval) return;
    const targetId = String(selectedUserForRemoval.id || selectedUserForRemoval.uid || '').toLowerCase().trim();
    const targetEmail = String(selectedUserForRemoval.email || '').toLowerCase().trim();

    try {
      await removeUserAccount(selectedUserForRemoval.id || selectedUserForRemoval.uid, user?.uid || 'admin_uid_001', removalReason);
    } catch(e) {}

    mockApi.removeUserAdmin(selectedUserForRemoval.id, removalReason);

    try {
      if (typeof window !== 'undefined') {
        const rawDel = localStorage.getItem('easeland_deleted_users');
        let delArr = rawDel ? JSON.parse(rawDel) : [];
        if (targetId && !delArr.includes(targetId)) delArr.push(targetId);
        if (targetEmail && !delArr.includes(targetEmail)) delArr.push(targetEmail);
        localStorage.setItem('easeland_deleted_users', JSON.stringify(delArr));

        const rawReg = localStorage.getItem('easeland_registered_users');
        if (rawReg) {
          const parsed = JSON.parse(rawReg);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter(u => {
              if (!u) return false;
              const id1 = String(u.id || u.uid || '').toLowerCase().trim();
              const em1 = String(u.email || '').toLowerCase().trim();
              return id1 !== targetId && em1 !== targetEmail;
            });
            localStorage.setItem('easeland_registered_users', JSON.stringify(updated));
          }
        }
      }
    } catch (e) {}

    setRegisteredUsersList(prev => prev.filter(u => {
      const id1 = String(u.id || u.uid || '').toLowerCase().trim();
      const em1 = String(u.email || '').toLowerCase().trim();
      return id1 !== targetId && em1 !== targetEmail;
    }));

    setIsRemoveModalOpen(false);
    setSelectedUserForRemoval(null);
    await loadData();
  };

  // FAQ management helpers
  const handleAddFaq = () => {
    const newFaq = {
      id: `faq-${Date.now()}`,
      question: 'New Frequently Asked Question',
      answer: 'Detailed answer provided by platform administrator.'
    };
    setSiteConfig(prev => ({
      ...prev,
      faqs: [...(prev.faqs || []), newFaq]
    }));
  };

  const handleRemoveFaq = (id) => {
    setSiteConfig(prev => ({
      ...prev,
      faqs: (prev.faqs || []).filter(f => f.id !== id)
    }));
  };

  const cmsModules = [
    { id: 'overview', label: '1. Overview', icon: Globe },
    { id: 'homepage', label: '2. Homepage', icon: Layout },
    { id: 'navbar', label: '3. Navbar', icon: Layers },
    { id: 'footer', label: '4. Footer', icon: Archive },
    { id: 'buyPage', label: '5. Buy Page', icon: DollarSign },
    { id: 'rentPage', label: '6. Rent Page', icon: Key },
    { id: 'sellPage', label: '7. Sell Page', icon: PlusCircle },
    { id: 'categories', label: '8. Categories', icon: Filter },
    { id: 'faq', label: '9. FAQ Section', icon: HelpCircle },
    { id: 'contact', label: '10. Contact', icon: Mail },
    { id: 'branding', label: '11. Branding', icon: ShieldCheck },
    { id: 'theme', label: '12. Theme & Colors', icon: Palette },
    { id: 'media', label: '13. Media', icon: ImageIcon },
    { id: 'maps', label: '14. Maps Config', icon: MapPin },
    { id: 'seo', label: '15. SEO Tags', icon: Search },
    { id: 'publish', label: '16. Publish Live', icon: CheckSquare }
  ];

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-brand-charcoal flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-amber-400/10 border border-amber-400/30 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
              <ShieldCheck className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight font-sans">
              Ease<span className="text-brand-yellow">Land</span> Admin Studio
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Restricted Portal • Enter Administrator Credentials
            </p>
          </div>

          {adminLoginError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{adminLoginError}</span>
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAdminLoginLoading(true);
              setAdminLoginError(null);
              const res = await loginAdmin(adminAuthEmail, adminAuthPassword);
              setAdminLoginLoading(false);
              if (!res.success) {
                setAdminLoginError(res.error || 'Access Denied. Invalid Admin Credentials.');
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Admin Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={adminAuthEmail}
                  onChange={(e) => setAdminAuthEmail(e.target.value)}
                  placeholder="admin@easeland.in"
                  className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Admin Access Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  required
                  value={adminAuthPassword}
                  onChange={(e) => setAdminAuthPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={adminLoginLoading}
              className="w-full bg-metallic-gold hover:bg-amber-400 text-slate-950 font-extrabold text-sm py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all border border-amber-300 mt-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-slate-950" />
              <span>{adminLoginLoading ? 'Authenticating Admin...' : 'Log In to Admin Portal →'}</span>
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800/80 text-center">
            <button
              type="button"
              onClick={() => {
                window.history.pushState(null, '', '/');
                window.dispatchEvent(new Event('popstate'));
              }}
              className="text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              ← Return to EaseLand Main Site
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-metallic-dark text-slate-100">
      
      {/* ADMIN TOP SUB-HEADER TOOLBAR */}
      <div className="bg-metallic-card text-white border-b border-slate-800 shadow-2xl backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-metallic-gold text-slate-950 flex items-center justify-center font-black shadow-md border border-amber-300/40">
              <ShieldCheck className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="font-extrabold text-slate-100 text-sm tracking-wide block">ADMIN MASTER SITE MANAGEMENT STUDIO</span>
              <span className="text-amber-400 text-[10px] uppercase tracking-wider font-semibold">16 Page & System Controls • Live Site Re-hydration</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow flex items-center gap-1.5 transition-all border border-gray-600 cursor-pointer"
              title="Reset all 16 CMS modules to factory default"
            >
              <RotateCcw className="w-3.5 h-3.5 text-brand-yellow" />
              <span>RESET TO DEFAULT</span>
            </button>

            <button
              onClick={handleSaveDraftConfig}
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5 text-blue-100" />
              <span>SAVE CHANGES</span>
            </button>

            <button
              onClick={handlePublishSiteConfig}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 cursor-pointer"
            >
              <Globe className="w-4 h-4 text-emerald-100 animate-pulse" />
              <span>PUBLISH TO LIVE SITE</span>
            </button>

          </div>

        </div>
      </div>

      {/* PUBLISH SUCCESS NOTIFICATION BANNER */}
      {publishSuccessMessage && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold text-center shadow-inner flex items-center justify-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{publishSuccessMessage}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* SIDEBAR NAVIGATION */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* SECTION A: MASTER SITE CMS STUDIO (16 MODULES) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 space-y-1">
              <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-yellow bg-brand-charcoal rounded-xl mb-2 flex items-center justify-between">
                <span>SITE CMS STUDIO</span>
                <span className="bg-brand-yellow text-brand-charcoal px-1.5 py-0.5 rounded text-[9px]">16 MODULES</span>
              </div>

              <button
                onClick={() => setActiveTab('cms')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-extrabold transition-all ${
                  activeTab === 'cms'
                    ? 'bg-brand-yellow text-brand-charcoal shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-4 h-4 text-brand-charcoal" />
                  <span>Site Management Panel</span>
                </div>
                <ChevronRight className="w-4 h-4 text-brand-charcoal" />
              </button>
            </div>

            {/* SECTION B: PLATFORM AUDIT & GOVERNANCE */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 space-y-1">
              <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-500 bg-gray-50 rounded-xl mb-2">
                AUDIT & GOVERNANCE
              </div>

              {[
                { id: 'all-properties', label: `All Properties (${allProperties.length})`, icon: Building2, badge: 0 },
                { id: 'verification', label: `Verification Queue (${verificationQueue.length})`, icon: Clock, badge: verificationQueue.length },
                { id: 'workspace', label: 'Verification Workspace', icon: ShieldCheck },
                { id: 'users', label: 'User Governance', icon: Users },
                { id: 'enquiries', label: 'Enquiry Directory', icon: MessageSquare },
                { id: 'crm', label: 'Deal CRM Pipeline', icon: Briefcase },
                { id: 'followups', label: 'Follow-ups Scheduler', icon: Calendar },
                { id: 'reports', label: 'Reports & Logs', icon: History },
                { id: 'profile-settings', label: 'Admin Profile & Security', icon: User }
              ].map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                      activeTab === item.id
                        ? 'bg-brand-charcoal text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-brand-charcoal'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <IconComponent className={`w-4 h-4 ${activeTab === item.id ? 'text-brand-yellow' : 'text-gray-500'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge > 0 && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    )}
                  </button>
                );
              })}
            </div>

          </div>

          {/* MAIN CONTENT AREA */}
          <div className="lg:col-span-9 space-y-6 w-full min-w-0">

            {/* TAB: SITE MANAGEMENT CMS STUDIO (ALL 16 MODULES) */}
            {activeTab === 'cms' && (
              <div className="space-y-6">
                
                {/* 16 MODULE SELECTION PILLS GRID */}
                <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-brand-yellow" />
                      Select Site Module To Manage & Edit:
                    </span>
                    <span className="text-[11px] font-bold text-gray-500">Live Editor Active</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    {cmsModules.map((mod) => {
                      const IconComp = mod.icon;
                      return (
                        <button
                          key={mod.id}
                          onClick={() => setCmsTab(mod.id)}
                          className={`p-2.5 rounded-xl text-left border text-[11px] font-extrabold transition-all flex flex-col justify-between h-16 ${
                            cmsTab === mod.id
                              ? 'bg-brand-charcoal text-white border-brand-charcoal shadow-md ring-2 ring-brand-yellow'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <IconComp className={`w-4 h-4 ${cmsTab === mod.id ? 'text-brand-yellow' : 'text-gray-500'}`} />
                          <span className="line-clamp-1">{mod.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* MODULE 1: WEBSITE OVERVIEW */}
                {cmsTab === 'overview' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-black text-brand-charcoal">1. Website Overview & Status</h3>
                        <p className="text-xs text-gray-500 font-medium">Control global publication state and domain routing.</p>
                      </div>
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full">
                        Status: {siteConfig.overview?.status || 'PUBLISHED'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Platform Brand Name</label>
                        <input
                          type="text"
                          value={siteConfig.overview?.siteName || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, overview: { ...prev.overview, siteName: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Domain Host Address</label>
                        <input
                          type="text"
                          value={siteConfig.overview?.domain || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, overview: { ...prev.overview, domain: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-center justify-between">
                      <div>
                        <span className="block text-xs font-black text-amber-900">Emergency Maintenance Mode</span>
                        <span className="block text-[11px] text-amber-700 font-medium">When enabled, public users see a maintenance banner while Admin retains studio access.</span>
                      </div>
                      <button
                        onClick={() => setSiteConfig(prev => ({ ...prev, overview: { ...prev.overview, emergencyMaintenance: !prev.overview?.emergencyMaintenance } }))}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                          siteConfig.overview?.emergencyMaintenance
                            ? 'bg-red-600 text-white shadow'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {siteConfig.overview?.emergencyMaintenance ? 'MAINTENANCE ACTIVE' : 'SYSTEM NORMAL'}
                      </button>
                    </div>
                  </div>
                )}

                {/* MODULE 2: HOMEPAGE */}
                {cmsTab === 'homepage' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-brand-charcoal">2. Homepage Content & Hero Banner</h3>
                      <p className="text-xs text-gray-500 font-medium">Manage main headlines, subtext, and hero background cover.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Hero Top Tagline Badge</label>
                        <input
                          type="text"
                          value={siteConfig.homepage?.heroTagline || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, homepage: { ...prev.homepage, heroTagline: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Main Headline Prefix</label>
                          <input
                            type="text"
                            value={siteConfig.homepage?.heroTitlePrefix || ''}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, homepage: { ...prev.homepage, heroTitlePrefix: e.target.value } }))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Main Headline Highlight Text (Gold Accent)</label>
                          <input
                            type="text"
                            value={siteConfig.homepage?.heroTitleHighlight || ''}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, homepage: { ...prev.homepage, heroTitleHighlight: e.target.value } }))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Hero Subtitle Text</label>
                        <textarea
                          rows={3}
                          value={siteConfig.homepage?.heroSubtitle || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, homepage: { ...prev.homepage, heroSubtitle: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>

                      <MediaUploadInput
                        label="Hero Background Image Cover"
                        value={siteConfig.homepage?.heroBackgroundImage || ''}
                        onChange={(val) => setSiteConfig(prev => ({ ...prev, homepage: { ...prev.homepage, heroBackgroundImage: val } }))}
                      />
                    </div>
                  </div>
                )}

                {/* MODULE 3: NAVBAR */}
                {cmsTab === 'navbar' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-brand-charcoal">3. Top Navbar & Navigation Bar</h3>
                      <p className="text-xs text-gray-500 font-medium">Customize logo titles, subtext, and main navigation link names.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Logo Text Prefix</label>
                        <input
                          type="text"
                          value={siteConfig.navbar?.logoTextPrefix || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, navbar: { ...prev.navbar, logoTextPrefix: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Logo Text Suffix (Highlight)</label>
                        <input
                          type="text"
                          value={siteConfig.navbar?.logoTextSuffix || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, navbar: { ...prev.navbar, logoTextSuffix: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Logo Subtext</label>
                        <input
                          type="text"
                          value={siteConfig.navbar?.logoSubtext || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, navbar: { ...prev.navbar, logoSubtext: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Buy Button Label</label>
                        <input
                          type="text"
                          value={siteConfig.navbar?.buyLabel || 'BUY'}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, navbar: { ...prev.navbar, buyLabel: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Rent Button Label</label>
                        <input
                          type="text"
                          value={siteConfig.navbar?.rentLabel || 'RENT'}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, navbar: { ...prev.navbar, rentLabel: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Sell Button Label</label>
                        <input
                          type="text"
                          value={siteConfig.navbar?.sellLabel || 'SELL'}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, navbar: { ...prev.navbar, sellLabel: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Post Property Button Label</label>
                        <input
                          type="text"
                          value={siteConfig.navbar?.postButtonLabel || 'POST PROPERTY'}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, navbar: { ...prev.navbar, postButtonLabel: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* MODULE 4: FOOTER */}
                {cmsTab === 'footer' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-brand-charcoal">4. Footer & Legal Contact Details</h3>
                      <p className="text-xs text-gray-500 font-medium">Configure office address, support hotline, and social links.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Footer Tagline & Description</label>
                        <textarea
                          rows={2}
                          value={siteConfig.footer?.tagline || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, footer: { ...prev.footer, tagline: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Official Physical Office Address</label>
                        <input
                          type="text"
                          value={siteConfig.footer?.officeAddress || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, footer: { ...prev.footer, officeAddress: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Support Phone Hotline</label>
                          <input
                            type="text"
                            value={siteConfig.footer?.supportPhone || ''}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, footer: { ...prev.footer, supportPhone: e.target.value } }))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Support Email Address</label>
                          <input
                            type="text"
                            value={siteConfig.footer?.supportEmail || ''}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, footer: { ...prev.footer, supportEmail: e.target.value } }))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Copyright Notice Text</label>
                        <input
                          type="text"
                          value={siteConfig.footer?.copyrightText || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, footer: { ...prev.footer, copyrightText: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* MODULE 5: BUY PAGE */}
                {cmsTab === 'buyPage' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-brand-charcoal">5. Buy Property Landing Page</h3>
                      <p className="text-xs text-gray-500 font-medium">Edit banner titles and description for property buyers.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Page Title</label>
                        <input
                          type="text"
                          value={siteConfig.buyPage?.title || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, buyPage: { ...prev.buyPage, title: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Subtitle Description</label>
                        <textarea
                          rows={3}
                          value={siteConfig.buyPage?.subtitle || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, buyPage: { ...prev.buyPage, subtitle: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Top Badge Pill Label</label>
                        <input
                          type="text"
                          value={siteConfig.buyPage?.badgeText || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, buyPage: { ...prev.buyPage, badgeText: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* MODULE 6: RENT PAGE */}
                {cmsTab === 'rentPage' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-brand-charcoal">6. Rent Property Landing Page</h3>
                      <p className="text-xs text-gray-500 font-medium">Edit banner titles and tenant guidelines for rental searchers.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Page Title</label>
                        <input
                          type="text"
                          value={siteConfig.rentPage?.title || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, rentPage: { ...prev.rentPage, title: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Subtitle Description</label>
                        <textarea
                          rows={3}
                          value={siteConfig.rentPage?.subtitle || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, rentPage: { ...prev.rentPage, subtitle: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Top Badge Pill Label</label>
                        <input
                          type="text"
                          value={siteConfig.rentPage?.badgeText || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, rentPage: { ...prev.rentPage, badgeText: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* MODULE 7: SELL PAGE */}
                {cmsTab === 'sellPage' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-brand-charcoal">7. Sell Property & Listing Page</h3>
                      <p className="text-xs text-gray-500 font-medium">Edit headlines and owner verification SLAs for sellers.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Page Title</label>
                        <input
                          type="text"
                          value={siteConfig.sellPage?.title || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, sellPage: { ...prev.sellPage, title: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Subtitle Description</label>
                        <textarea
                          rows={3}
                          value={siteConfig.sellPage?.subtitle || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, sellPage: { ...prev.sellPage, subtitle: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Top Badge Pill Label</label>
                        <input
                          type="text"
                          value={siteConfig.sellPage?.badgeText || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, sellPage: { ...prev.sellPage, badgeText: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* MODULE 8: PROPERTY CATEGORIES */}
                {cmsTab === 'categories' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-brand-charcoal">8. Property Category Cards Manager</h3>
                      <p className="text-xs text-gray-500 font-medium">Manage titles, subtext, and cover images for homepage category cards.</p>
                    </div>

                    <div className="space-y-4">
                      {safeArray(siteConfig?.categories).map((cat, idx) => (
                        <div key={cat?.id || idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-brand-charcoal uppercase">Category {idx + 1}: {cat?.title}</span>
                            <span className="text-[10px] font-bold text-gray-400">ID: {cat?.id}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-gray-600 mb-1">Title</label>
                              <input
                                type="text"
                                value={cat?.title || ''}
                                onChange={(e) => {
                                  const updatedCats = [...safeArray(siteConfig?.categories)];
                                  updatedCats[idx] = { ...cat, title: e.target.value };
                                  setSiteConfig(prev => ({ ...prev, categories: updatedCats }));
                                }}
                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-gray-600 mb-1">Count Subtext</label>
                              <input
                                type="text"
                                value={cat?.countText || ''}
                                onChange={(e) => {
                                  const updatedCats = [...safeArray(siteConfig?.categories)];
                                  updatedCats[idx] = { ...cat, countText: e.target.value };
                                  setSiteConfig(prev => ({ ...prev, categories: updatedCats }));
                                }}
                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-semibold"
                              />
                            </div>
                            <div className="md:col-span-3">
                              <MediaUploadInput
                                label="Cover Image Asset"
                                value={cat?.imageUrl || ''}
                                onChange={(val) => {
                                  const updatedCats = [...safeArray(siteConfig?.categories)];
                                  updatedCats[idx] = { ...cat, imageUrl: val };
                                  setSiteConfig(prev => ({ ...prev, categories: updatedCats }));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* MODULE 9: FAQ */}
                {cmsTab === 'faq' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-black text-brand-charcoal">9. Frequently Asked Questions (FAQ) Manager</h3>
                        <p className="text-xs text-gray-500 font-medium">Add, edit, or remove FAQ questions and answers.</p>
                      </div>
                      <button
                        onClick={handleAddFaq}
                        className="bg-brand-yellow text-brand-charcoal font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Add Question
                      </button>
                    </div>

                    <div className="space-y-4">
                      {safeArray(siteConfig?.faqs || siteConfig?.faq).map((faq, idx) => (
                        <div key={faq.id || idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 relative">
                          <button
                            onClick={() => handleRemoveFaq(faq.id)}
                            className="absolute top-3 right-3 text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"
                          >
                            <X className="w-4 h-4" /> Remove
                          </button>
                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 mb-1">Question {idx + 1}</label>
                            <input
                              type="text"
                              value={faq.question || ''}
                              onChange={(e) => {
                                const updatedFaqs = [...siteConfig.faqs];
                                updatedFaqs[idx] = { ...faq, question: e.target.value };
                                setSiteConfig(prev => ({ ...prev, faqs: updatedFaqs }));
                              }}
                              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 mb-1">Answer</label>
                            <textarea
                              rows={2}
                              value={faq.answer || ''}
                              onChange={(e) => {
                                const updatedFaqs = [...siteConfig.faqs];
                                updatedFaqs[idx] = { ...faq, answer: e.target.value };
                                setSiteConfig(prev => ({ ...prev, faqs: updatedFaqs }));
                              }}
                              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-medium"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* MODULE 10: CONTACT */}
                {cmsTab === 'contact' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-brand-charcoal">10. Contact Us & Support Configuration</h3>
                      <p className="text-xs text-gray-500 font-medium">Configure contact form lead recipients and support displays.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Contact Section Heading</label>
                        <input
                          type="text"
                          value={siteConfig.contact?.heading || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, contact: { ...prev.contact, heading: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Contact Section Subheading</label>
                        <textarea
                          rows={2}
                          value={siteConfig.contact?.subheading || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, contact: { ...prev.contact, subheading: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Lead Recipient Email (Inbound Enquiries)</label>
                        <input
                          type="text"
                          value={siteConfig.contact?.recipientEmail || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, contact: { ...prev.contact, recipientEmail: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* MODULE 11: BRANDING */}
                {cmsTab === 'branding' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-brand-charcoal">11. Brand Assets & Identity</h3>
                      <p className="text-xs text-gray-500 font-medium">Manage logos, emblems, slogans, and platform tags.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Brand Tagline</label>
                        <input
                          type="text"
                          value={siteConfig.branding?.brandTagline || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, branding: { ...prev.branding, brandTagline: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Platform Slogan</label>
                        <input
                          type="text"
                          value={siteConfig.branding?.slogan || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, branding: { ...prev.branding, slogan: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <MediaUploadInput
                          label="Transparent Emblem Asset"
                          value={siteConfig.branding?.emblemUrl || ''}
                          onChange={(val) => setSiteConfig(prev => ({ ...prev, branding: { ...prev.branding, emblemUrl: val } }))}
                        />
                        <MediaUploadInput
                          label="Full Logo Asset"
                          value={siteConfig.branding?.logoUrl || ''}
                          onChange={(val) => setSiteConfig(prev => ({ ...prev, branding: { ...prev.branding, logoUrl: val } }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* MODULE 12: THEME & COLORS */}
                {cmsTab === 'theme' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-brand-charcoal">12. Color Themes & Typography</h3>
                      <p className="text-xs text-gray-500 font-medium">Customize primary brand colors, dark backgrounds, and font families.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Primary Brand Gold Hex</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={siteConfig.theme?.primaryColor || '#F4C542'}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, theme: { ...prev.theme, primaryColor: e.target.value } }))}
                            className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={siteConfig.theme?.primaryColor || '#F4C542'}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, theme: { ...prev.theme, primaryColor: e.target.value } }))}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Dark Charcoal Background Hex</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={siteConfig.theme?.darkBgColor || '#0B2545'}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, theme: { ...prev.theme, darkBgColor: e.target.value } }))}
                            className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={siteConfig.theme?.darkBgColor || '#0B2545'}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, theme: { ...prev.theme, darkBgColor: e.target.value } }))}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Accent Electric Color Hex</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={siteConfig.theme?.accentColor || '#2563EB'}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, theme: { ...prev.theme, accentColor: e.target.value } }))}
                            className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={siteConfig.theme?.accentColor || '#2563EB'}
                            onChange={(e) => setSiteConfig(prev => ({ ...prev, theme: { ...prev.theme, accentColor: e.target.value } }))}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Font Family</label>
                      <select
                        value={siteConfig.theme?.fontFamily || 'Plus Jakarta Sans'}
                        onChange={(e) => setSiteConfig(prev => ({ ...prev, theme: { ...prev.theme, fontFamily: e.target.value } }))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                      >
                        <option value="Plus Jakarta Sans">Plus Jakarta Sans (Default)</option>
                        <option value="Inter">Inter (Clean Modern)</option>
                        <option value="Outfit">Outfit (Bold Geometric)</option>
                        <option value="Roboto">Roboto (Classic Sans)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* MODULE 13: IMAGES & MEDIA */}
                {cmsTab === 'media' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-brand-charcoal">13. Media Library & Custom File Upload Dropzone</h3>
                      <p className="text-xs text-gray-500 font-medium">Upload custom local media files or paste direct URLs for system fallback assets.</p>
                    </div>

                    <div className="space-y-6">
                      <MediaUploadInput
                        label="Fallback Property Image"
                        value={siteConfig.media?.fallbackPropertyImageUrl || ''}
                        onChange={(val) => setSiteConfig(prev => ({ ...prev, media: { ...prev.media, fallbackPropertyImageUrl: val } }))}
                      />

                      <MediaUploadInput
                        label="Hero Banner Custom Media Cover"
                        value={siteConfig.media?.heroBannerUrl || ''}
                        onChange={(val) => setSiteConfig(prev => ({ ...prev, media: { ...prev.media, heroBannerUrl: val } }))}
                      />
                    </div>
                  </div>
                )}

                {/* MODULE 14: MAPS CONFIGURATION */}
                {cmsTab === 'maps' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-brand-charcoal">14. Maps Engine & Geolocation Settings</h3>
                      <p className="text-xs text-gray-500 font-medium">Manage map center coordinates, Google Maps API key, and 250% zoom levels.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Default Center Latitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={siteConfig.mapsConfig?.defaultLat || 16.3124}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, mapsConfig: { ...prev.mapsConfig, defaultLat: Number(e.target.value) } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Default Center Longitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={siteConfig.mapsConfig?.defaultLng || 80.4285}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, mapsConfig: { ...prev.mapsConfig, defaultLng: Number(e.target.value) } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-gray-700">Default Map Zoom Level (1-22)</label>
                          <span className="text-[10px] font-bold text-amber-600">Standard: 12-14</span>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="22"
                          value={siteConfig.mapsConfig?.defaultZoom || 13}
                          onChange={(e) => {
                            const val = Math.min(22, Math.max(1, Number(e.target.value) || 13));
                            setSiteConfig(prev => ({ ...prev, mapsConfig: { ...prev.mapsConfig, defaultZoom: val } }));
                          }}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                        <span className="text-[10px] text-gray-400 font-medium block mt-1">
                          Note: Map tile providers support Zoom Scale 1 (World) to 22 (Max Building Close-up). Values above 22 automatically clamp to 22.
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-gray-700">Detect Location 250% Auto-Zoom Level (1-22)</label>
                          <span className="text-[10px] font-bold text-emerald-600">High Precision: 18-21</span>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="22"
                          value={siteConfig.mapsConfig?.locationZoom250 || 20}
                          onChange={(e) => {
                            const val = Math.min(22, Math.max(1, Number(e.target.value) || 20));
                            setSiteConfig(prev => ({ ...prev, mapsConfig: { ...prev.mapsConfig, locationZoom250: val } }));
                          }}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                        <span className="text-[10px] text-gray-400 font-medium block mt-1">
                          Controls the ultra-deep 250% zoom in when users click "Near Me" or Detect Location.
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Google Maps Platform API Key</label>
                      <input
                        type="text"
                        value={siteConfig.mapsConfig?.googleMapsApiKey || ''}
                        onChange={(e) => setSiteConfig(prev => ({ ...prev, mapsConfig: { ...prev.mapsConfig, googleMapsApiKey: e.target.value } }))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                )}

                {/* MODULE 15: SEO */}
                {cmsTab === 'seo' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-brand-charcoal">15. Search Engine Optimization (SEO)</h3>
                      <p className="text-xs text-gray-500 font-medium">Manage HTML meta titles, descriptions, and OpenGraph tags.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Meta Title Tag</label>
                        <input
                          type="text"
                          value={siteConfig.seo?.metaTitle || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, seo: { ...prev.seo, metaTitle: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Meta Description</label>
                        <textarea
                          rows={3}
                          value={siteConfig.seo?.metaDescription || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, seo: { ...prev.seo, metaDescription: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Search Keywords (Comma Separated)</label>
                        <input
                          type="text"
                          value={siteConfig.seo?.keywords || ''}
                          onChange={(e) => setSiteConfig(prev => ({ ...prev, seo: { ...prev.seo, keywords: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* MODULE 16: PREVIEW & PUBLISH */}
                {cmsTab === 'publish' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-black text-brand-charcoal">16. Preview & Publish Live</h3>
                        <p className="text-xs text-gray-500 font-medium">Inspect configuration snapshot and publish instantly to the live marketplace.</p>
                      </div>
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        SYSTEM READY FOR LIVE PUBLISH
                      </span>
                    </div>

                    {/* EXECUTIVE VISUAL SNAPSHOT CARDS GRID (ZERO RAW CODE) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* CARD 1: BRANDING & THEMING */}
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Branding & Logo</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        </div>
                        <h4 className="font-extrabold text-sm text-brand-charcoal">
                          {siteConfig.branding?.platformName || 'EaseLand'}
                        </h4>
                        <div className="text-xs font-semibold text-gray-600 space-y-1">
                          <div>Tagline: <strong className="text-gray-900">{siteConfig.branding?.tagline || 'Direct Property Platform'}</strong></div>
                          <div>Theme Accent: <strong className="text-brand-blue">{siteConfig.theme?.primaryColor || '#D4A017'}</strong></div>
                        </div>
                      </div>

                      {/* CARD 2: HERO COVER & NAVIGATION */}
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Hero Banner & CTA</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        </div>
                        <h4 className="font-extrabold text-sm text-brand-charcoal line-clamp-1">
                          {siteConfig.hero?.title || 'Direct Property Discovery'}
                        </h4>
                        <div className="text-xs font-semibold text-gray-600 space-y-1">
                          <div>Primary CTA: <strong className="text-gray-900">{siteConfig.hero?.ctaText || 'EXPLORE VERIFIED PLOTS'}</strong></div>
                          <div>Badge Text: <strong className="text-emerald-600 font-extrabold">{siteConfig.hero?.badgeText || '100% DIRECT OWNER'}</strong></div>
                        </div>
                      </div>

                      {/* CARD 3: MAPS CONFIGURATION */}
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Map Engine & Zoom</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        </div>
                        <h4 className="font-extrabold text-sm text-brand-charcoal">
                          Google & Leaflet Layers
                        </h4>
                        <div className="text-xs font-semibold text-gray-600 space-y-1">
                          <div>Default Center: <strong className="text-gray-900">{siteConfig.mapsConfig?.defaultLat || 16.3124}, {siteConfig.mapsConfig?.defaultLng || 80.4285}</strong></div>
                          <div>Zoom Range: <strong className="text-brand-yellow font-black">Level 1 - 22 (Max Ultra-Close)</strong></div>
                        </div>
                      </div>

                      {/* CARD 4: AUDIT & SUPPORT */}
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Security & Contact</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        </div>
                        <h4 className="font-extrabold text-sm text-brand-charcoal">
                          Encrypted Vault Active
                        </h4>
                        <div className="text-xs font-semibold text-gray-600 space-y-1">
                          <div>Support Hotline: <strong className="text-gray-900">{siteConfig.footer?.supportPhone || '+91 98765 43210'}</strong></div>
                          <div>Support Email: <strong className="text-brand-blue">{siteConfig.footer?.supportEmail || 'support@easeland.in'}</strong></div>
                        </div>
                      </div>
                    </div>

                    {/* SYSTEM PUBLISHING STATUS BANNER */}
                    <div className="bg-brand-charcoal text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-yellow text-brand-charcoal font-black flex items-center justify-center text-sm shadow">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="font-extrabold text-xs text-brand-yellow block uppercase tracking-wider">Instant Re-hydration Engine</span>
                          <span className="text-xs text-gray-300 font-medium">All 16 CMS modules will broadcast live across all user sessions instantly with 0ms downtime.</span>
                        </div>
                      </div>
                    </div>

                    {/* PUBLISH BUTTON */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
                      <div>
                        <span className="block text-xs font-extrabold text-brand-charcoal">Ready to Push Changes Live or Restore Defaults?</span>
                        <span className="block text-[11px] text-gray-500 font-medium">Publish live updates or restore all 16 CMS modules to factory default settings.</span>
                      </div>
                      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <button
                          onClick={() => setIsResetModalOpen(true)}
                          className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 font-extrabold text-xs px-4 py-3 rounded-xl shadow-sm flex items-center gap-2 transition-all"
                        >
                          <RotateCcw className="w-4 h-4 text-gray-600" />
                          <span>Reset to Default</span>
                        </button>
                        <button
                          onClick={handlePublishSiteConfig}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-7 py-3.5 rounded-xl shadow-lg flex items-center gap-2 transition-all transform hover:scale-105"
                        >
                          <CheckCircle2 className="w-5 h-5 text-emerald-100" />
                          PUBLISH CHANGES LIVE
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* TAB: ALL PROPERTIES MASTER DIRECTORY */}
            {activeTab === 'all-properties' && (
              <div className="space-y-6">
                {/* Summary Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-5 rounded-2xl border border-gray-200 shadow-sm gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-brand-yellow font-extrabold text-xs uppercase tracking-wider mb-1">
                      <Building2 className="w-4 h-4 text-brand-charcoal" />
                      <span>Platform Master Catalog</span>
                    </div>
                    <h3 className="text-xl font-black text-brand-charcoal">All Platform Properties ({allProperties.length})</h3>
                    <p className="text-xs text-gray-500 font-medium">
                      Complete master directory of all properties posted by Users, Property Owners, and Admins across EaseLand.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-emerald-100 text-emerald-800 font-extrabold text-xs px-3.5 py-1.5 rounded-full border border-emerald-300">
                      {allProperties.filter(p => p && (p.status === 'LIVE' || p.listingStatus === 'LIVE' || p.isPlatformVerified)).length} Verified & Live
                    </span>
                    <span className="bg-amber-100 text-amber-800 font-extrabold text-xs px-3.5 py-1.5 rounded-full border border-amber-300">
                      {verificationQueue.length} Pending Audit
                    </span>
                  </div>
                </div>

                {/* Search & Filter Toolbar */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter by title, owner name, email, phone, city..."
                      value={allPropSearchQuery}
                      onChange={(e) => setAllPropSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                      value={allPropStatusFilter}
                      onChange={(e) => setAllPropStatusFilter(e.target.value)}
                      className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="LIVE">Live & Verified</option>
                      <option value="PENDING_VERIFICATION">Pending Audit</option>
                      <option value="DRAFT">Draft</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="CHANGES_REQUIRED">Changes Required</option>
                    </select>
                  </div>
                </div>

                {/* Master Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100 bg-gray-50 font-extrabold text-xs text-gray-500 uppercase tracking-wider grid grid-cols-12 gap-3">
                    <span className="col-span-3">Property Title & Location</span>
                    <span className="col-span-3">Posted By / Owner</span>
                    <span className="col-span-2">Submitted Date</span>
                    <span className="col-span-2">Price & Details</span>
                    <span className="col-span-2 text-right">Status & Action</span>
                  </div>

                  {filteredAllProperties.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 font-bold text-xs">
                      No properties match your filter criteria.
                    </div>
                  ) : (
                    filteredAllProperties.map((prop) => {
                      const st = String(prop.status || prop.listingStatus || '').toUpperCase();
                      const lst = String(prop.listingStatus || '').toUpperCase();
                      const isLive = st === 'LIVE' || st === 'APPROVED_LIVE' || st === 'APPROVED' || lst === 'LIVE' || prop.isPlatformVerified;
                      const isPending = st === 'PENDING_VERIFICATION' || lst === 'PENDING_VERIFICATION' || st === 'PENDING';
                      const isRejected = st === 'REJECTED' || lst === 'REJECTED';
                      const isChanges = st === 'CHANGES_REQUIRED' || lst === 'CHANGES_REQUIRED';

                      const ownerName = prop.owner?.name || prop.ownerPublicName || 'Registered User';
                      const ownerEmail = prop.owner?.email || prop.ownerPrivateEmail || '';
                      const ownerPhone = prop.owner?.phone || prop.ownerPrivatePhone || 'Number Not Updated';
                      const isAdminPoster = ownerEmail.includes('admin') || ownerName.toLowerCase().includes('admin');

                      const priceVal = Number(prop.price) || 0;
                      const priceLabel = prop.priceDisplay || (priceVal >= 10000000 
                        ? `Rs. ${(priceVal / 10000000).toFixed(2)} Cr` 
                        : priceVal >= 100000 
                          ? `Rs. ${(priceVal / 100000).toFixed(2)} Lakhs` 
                          : `Rs. ${priceVal.toLocaleString()}`);

                      const submittedDate = parseSafeDate(prop.submittedDate || prop.createdAt || prop.verifiedDate || prop.updatedAt);

                      return (
                        <div key={prop.id || prop.propertyId} className="p-4 border-b border-gray-100 grid grid-cols-12 gap-3 items-center text-xs hover:bg-gray-50 transition-colors">
                          {/* TITLE & LOCATION */}
                          <div className="col-span-3">
                            <span className="font-extrabold text-brand-charcoal block line-clamp-1">{prop.title}</span>
                            <span className="text-gray-500 text-[11px] block line-clamp-1">
                              {[prop.location?.locality || prop.locality, prop.location?.city || prop.city, prop.location?.state || prop.state].filter(Boolean).join(', ') || 'India'}
                            </span>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] font-extrabold text-brand-charcoal bg-amber-100 px-2 py-0.5 rounded">
                                {prop.purpose?.toUpperCase() || 'BUY'}
                              </span>
                              <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                {prop.propertyType || prop.category || 'Plot'}
                              </span>
                            </div>
                          </div>

                          {/* POSTED BY / OWNER */}
                          <div className="col-span-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-900 line-clamp-1">{ownerName}</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isAdminPoster ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                {isAdminPoster ? 'ADMIN' : 'USER'}
                              </span>
                            </div>
                            {ownerEmail && (
                              <span className="text-slate-500 text-[11px] block line-clamp-1 font-semibold">{ownerEmail}</span>
                            )}
                            <span className="text-slate-700 text-[11px] block font-bold mt-0.5">{ownerPhone}</span>
                          </div>

                          {/* SUBMITTED DATE */}
                          <div className="col-span-2 text-gray-600 font-semibold text-[11px]">
                            <Calendar className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                            {submittedDate}
                          </div>

                          {/* PRICE & DETAILS */}
                          <div className="col-span-2">
                            <span className="font-extrabold text-emerald-700 block">{priceLabel}</span>
                            <span className="text-gray-500 text-[11px]">{prop.area ? `${prop.area} sq ft` : ''}</span>
                          </div>

                          {/* STATUS & ACTION */}
                          <div className="col-span-2 text-right flex flex-col items-end gap-1.5">
                            <span className={`font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              isLive ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                              isPending ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                              isChanges ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                              isRejected ? 'bg-red-100 text-red-800 border border-red-300' :
                              'bg-gray-100 text-gray-700 border border-gray-300'
                            }`}>
                              {isLive ? 'PLATFORM VERIFIED' : isPending ? 'PENDING AUDIT' : isChanges ? 'CHANGES REQD' : isRejected ? 'REJECTED' : 'DRAFT'}
                            </span>

                            <div className="flex items-center gap-1.5 mt-1">
                              <button
                                onClick={() => window.open('/property/' + (prop.propertyId || prop.id), '_blank')}
                                className="bg-brand-charcoal hover:bg-slate-800 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1.5"
                                title="View Property on Map"
                              >
                                <MapPin className="w-3 h-3 text-amber-400" />
                                <span>View on Map</span>
                              </button>

                              <button
                                onClick={() => handleDeletePropertyFromAdmin(prop.id || prop.propertyId)}
                                className="bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] px-2 py-1 rounded-lg border border-red-200"
                                title="Delete Listing"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB: VERIFICATION QUEUE */}
            {activeTab === 'verification' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                  <div>
                    <h3 className="text-lg font-black text-brand-charcoal">Verification Queue</h3>
                    <p className="text-xs text-gray-500 font-medium">Pending properties requiring document audit and field inspection approval.</p>
                  </div>
                  <span className="bg-amber-100 text-amber-800 font-extrabold text-xs px-3.5 py-1.5 rounded-full">
                    {verificationQueue.length} Pending Audit
                  </span>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100 bg-gray-50 font-extrabold text-xs text-gray-500 uppercase tracking-wider grid grid-cols-12 gap-4">
                    <span className="col-span-4">Property Title & Location</span>
                    <span className="col-span-3">Owner Name</span>
                    <span className="col-span-2">Owner Contact</span>
                    <span className="col-span-1">Submitted</span>
                    <span className="col-span-2 text-right">Action</span>
                  </div>

                  {verificationQueue.length === 0 ? (
                    <div className="p-12 text-center bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2 my-4 mx-4">
                      <div className="text-3xl">🎉</div>
                      <h4 className="font-black text-lg text-emerald-800 uppercase tracking-wide">
                        ALL VERIFICATIONS ARE CLEAR !!
                      </h4>
                      <p className="text-xs text-emerald-600 font-bold">
                        No pending property audits or document approvals in queue. All properties processed!
                      </p>
                    </div>
                  ) : (
                    verificationQueue.map((prop) => (
                      <div key={prop.id} className="p-4 border-b border-gray-100 grid grid-cols-12 gap-4 items-center text-xs hover:bg-gray-50 transition-colors">
                        {/* TITLE & LOCATION */}
                        <div className="col-span-4">
                          <span className="font-bold text-brand-charcoal block line-clamp-1">{prop.title}</span>
                          <span className="text-gray-500 text-[11px]">
                            {[prop.location?.locality || prop.locality, prop.location?.city || prop.city, prop.location?.state || prop.state].filter(Boolean).join(', ') || (typeof prop.location === 'string' ? prop.location : 'India')}
                          </span>
                        </div>

                        {/* SEPARATE COLUMN: OWNER NAME */}
                        <div className="col-span-3">
                          <span className="font-extrabold text-slate-900 block line-clamp-1">
                            {prop.owner?.name || 'Registered Account Owner'}
                          </span>
                          {prop.owner?.email && (
                            <span className="text-slate-500 text-[10px] block line-clamp-1 font-semibold">
                              {prop.owner.email}
                            </span>
                          )}
                        </div>

                        {/* SEPARATE COLUMN: OWNER CONTACT */}
                        <div className="col-span-2">
                          <span className={`font-extrabold text-[11px] block line-clamp-1 ${
                            prop.owner?.phone && prop.owner.phone !== 'Number Not Updated' && prop.owner.phone !== '+91 98765 43210' && prop.owner.phone !== '+91 N/A'
                              ? 'text-slate-900'
                              : 'text-amber-700 font-semibold'
                          }`}>
                            {prop.owner?.phone && prop.owner.phone !== '+91 98765 43210' && prop.owner.phone !== '+91 N/A'
                              ? prop.owner.phone
                              : 'Number Not Updated'}
                          </span>
                        </div>

                        {/* SUBMITTED */}
                        <div className="col-span-1 text-gray-500 font-semibold">
                          {prop.submittedDate || 'Recent'}
                        </div>

                        {/* ACTION */}
                        <div className="col-span-2 text-right flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openWorkspace(prop);
                            }}
                            className="bg-slate-900 text-white font-extrabold px-3 py-1.5 rounded-xl hover:bg-amber-400 hover:text-slate-950 transition-all text-[11px] shadow-sm border border-transparent hover:border-amber-300 cursor-pointer"
                          >
                            Audit Now
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteProperty(prop);
                            }}
                            className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white font-extrabold px-2.5 py-1.5 rounded-xl transition-all text-[11px] shadow-sm"
                            title="Delete Property Listing"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB: VERIFICATION WORKSPACE */}
            {activeTab === 'workspace' && (
              (verificationQueue.length === 0 || !selectedProperty || !verificationQueue.some(q => String(q.id || q.propertyId) === String(selectedProperty?.id || selectedProperty?.propertyId))) ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm space-y-3">
                  <div className="text-4xl">🎉</div>
                  <h3 className="font-black text-xl text-emerald-800 uppercase tracking-wide">
                    ALL VERIFICATIONS ARE CLEAR !!
                  </h3>
                  <p className="text-xs text-slate-600 font-semibold max-w-md mx-auto">
                    There are no pending property audits or verification documents requiring attention. The workspace is clear!
                  </p>
                </div>
              ) : (
                (() => {
                  try {
                    const activeAuditProp = selectedProperty || verificationQueue[0];

                    if (!activeAuditProp) {
                      return (
                        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm space-y-3">
                          <div className="text-4xl">📋</div>
                          <h3 className="font-black text-xl text-slate-800 uppercase tracking-wide">
                            NO PROPERTY SELECTED FOR AUDIT
                          </h3>
                          <p className="text-xs text-slate-600 font-semibold max-w-md mx-auto">
                            Select a property from the Verification Queue to begin document and field audit.
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab('verification')}
                            className="mt-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                          >
                            Go to Verification Queue
                          </button>
                        </div>
                      );
                    }

                    // Format property location cleanly without empty leading commas
                    const rawLocParts = [
                      activeAuditProp.location?.address || activeAuditProp.address,
                      activeAuditProp.location?.locality || activeAuditProp.locality,
                      activeAuditProp.location?.city || activeAuditProp.city,
                      activeAuditProp.location?.district || activeAuditProp.district,
                      activeAuditProp.location?.state || activeAuditProp.state
                    ];
                    const locParts = rawLocParts.map(val => {
                      if (!val) return '';
                      if (typeof val === 'string') return val.trim();
                      if (typeof val === 'object') return val.name || val.locality || val.city || val.address || '';
                      return String(val).trim();
                    }).filter(Boolean);

                    const locationStr = locParts.length > 0 ? locParts.join(', ') : 'Location details pending';
                    const pincodeVal = activeAuditProp.location?.pincode || activeAuditProp.pincode;
                    const pincodeStr = pincodeVal && typeof pincodeVal !== 'object' ? ` - ${String(pincodeVal).trim()}` : '';

                    const propTitle = typeof activeAuditProp.title === 'string' && activeAuditProp.title.trim()
                      ? activeAuditProp.title.trim()
                      : (activeAuditProp.title?.name || activeAuditProp.title?.title || String(activeAuditProp.title || 'Untitled Property'));

                    const propIdStr = String(activeAuditProp.id || activeAuditProp.propertyId || 'N/A');

                    const priceStr = typeof activeAuditProp.priceDisplay === 'string' && activeAuditProp.priceDisplay
                      ? activeAuditProp.priceDisplay
                      : (activeAuditProp.price && !isNaN(Number(activeAuditProp.price))
                          ? `Rs. ${Number(activeAuditProp.price).toLocaleString('en-IN')}`
                          : 'Price on Request');

                    const ownerNameRaw = activeAuditProp.owner?.name && !['Property Owner', 'Verified Property Owner', 'Verified Owner'].includes(String(activeAuditProp.owner.name).trim())
                      ? activeAuditProp.owner.name
                      : (activeAuditProp.owner?.email || activeAuditProp.ownerPublicName || 'Account Name Not Set');
                    const ownerNameStr = typeof ownerNameRaw === 'string'
                      ? ownerNameRaw
                      : (typeof ownerNameRaw === 'object' && ownerNameRaw ? (ownerNameRaw.name || ownerNameRaw.displayName || ownerNameRaw.email || 'Account Name Not Set') : String(ownerNameRaw));

                    const ownerPhoneRaw = activeAuditProp.owner?.phone && activeAuditProp.owner.phone !== '+91 98765 43210' && activeAuditProp.owner.phone !== '+91 N/A'
                      ? activeAuditProp.owner.phone
                      : 'Number Not Updated';
                    const ownerPhoneStr = typeof ownerPhoneRaw === 'string' ? ownerPhoneRaw : String(ownerPhoneRaw || 'Number Not Updated');

                    const ownerEmailRaw = activeAuditProp.owner?.email || activeAuditProp.userEmail || 'N/A';
                    const ownerEmailStr = typeof ownerEmailRaw === 'string' ? ownerEmailRaw : String(ownerEmailRaw || 'N/A');

                    const ownerRoleRaw = activeAuditProp.owner?.role || 'Property Owner';
                    const ownerRoleStr = typeof ownerRoleRaw === 'string' ? ownerRoleRaw : String(ownerRoleRaw || 'Property Owner');

                    const catStr = typeof activeAuditProp.category === 'string' ? activeAuditProp.category : (activeAuditProp.category?.name || 'Real Estate');
                    const propTypeStr = typeof activeAuditProp.propertyType === 'string' ? activeAuditProp.propertyType : (activeAuditProp.propertyType?.name || 'Plot/Property');
                    const txTypeStr = typeof activeAuditProp.transactionType === 'string' ? activeAuditProp.transactionType : (activeAuditProp.intent || 'FOR SALE');
                    const areaStr = typeof activeAuditProp.areaDisplay === 'string' ? activeAuditProp.areaDisplay : `${activeAuditProp.area || 0} ${activeAuditProp.areaUnit || 'sq ft'}`;
                    const facingStr = typeof activeAuditProp.facing === 'string' ? activeAuditProp.facing : 'East';
                    const dimStr = typeof activeAuditProp.dimensions === 'string' ? activeAuditProp.dimensions : 'Standard Plot';

                    const surveyVal = activeAuditProp.location?.surveyNo || activeAuditProp.surveyNo || 'N/A';
                    const surveyStr = typeof surveyVal === 'string' || typeof surveyVal === 'number' ? String(surveyVal) : 'N/A';

                    const lpVal = activeAuditProp.location?.lpNo || activeAuditProp.lpNo || 'N/A';
                    const lpStr = typeof lpVal === 'string' || typeof lpVal === 'number' ? String(lpVal) : 'N/A';

                    return (
                      <div className="bg-white rounded-2xl p-6 border border-slate-300 shadow-lg space-y-6 text-slate-900">
                        
                        {/* HEADER BAR */}
                        <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-black text-amber-900 bg-amber-200 px-3 py-1 rounded-md tracking-wider">
                                AUDIT IN PROGRESS
                              </span>
                              <span className="text-xs font-bold text-slate-600 bg-slate-200 px-2.5 py-1 rounded-md">
                                ID: {propIdStr}
                              </span>
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 mt-1">{propTitle}</h3>
                            <p className="text-xs font-extrabold text-slate-700 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>
                                {locationStr}{pincodeStr}
                              </span>
                            </p>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2">
                            <div>
                              <span className="text-2xl font-black text-emerald-700 block">
                                {priceStr}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                                Submitted: {activeAuditProp.submittedDate || 'Recent'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteProperty(activeAuditProp)}
                              className="bg-red-100 hover:bg-red-600 text-red-700 hover:text-white font-extrabold px-3 py-1.5 rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Property</span>
                            </button>
                          </div>
                        </div>

                        {/* 2-COLUMN DATA CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          
                          {/* OWNER & CONTACT INFORMATION CARD */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                              <User className="w-4 h-4 text-blue-600" />
                              <span>Owner & Contact Verification</span>
                            </h4>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 text-xs space-y-2.5 text-slate-900 font-bold">
                              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                                <span className="text-slate-600 font-bold">Owner Name:</span>
                                <span className="text-slate-900 font-extrabold">{ownerNameStr}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                                <span className="text-slate-600 font-bold">Phone Number:</span>
                                <span className="text-slate-900 font-extrabold">{ownerPhoneStr}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                                <span className="text-slate-600 font-bold">Email Address:</span>
                                <span className="text-slate-900 font-extrabold">{ownerEmailStr}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                                <span className="text-slate-600 font-bold">Listing Role:</span>
                                <span className="text-slate-900 font-extrabold">{ownerRoleStr}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 font-bold">KYC / Identity Status:</span>
                                <span className="text-emerald-700 font-black bg-emerald-100 px-2 py-0.5 rounded text-[10px]">
                                  VERIFIED OWNER
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* SPECIFICATIONS & FINANCIAL DETAILS */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-emerald-600" />
                              <span>Property Specifications & Financials</span>
                            </h4>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 text-xs space-y-2.5 text-slate-900 font-bold">
                              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                                <span className="text-slate-600 font-bold">Category & Type:</span>
                                <span className="text-slate-900 font-extrabold">{catStr} • {propTypeStr}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                                <span className="text-slate-600 font-bold">Listing Intent:</span>
                                <span className="text-slate-900 font-extrabold">{txTypeStr}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                                <span className="text-slate-600 font-bold">Total Area:</span>
                                <span className="text-slate-900 font-extrabold">{areaStr}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                                <span className="text-slate-600 font-bold">Facing & Dimensions:</span>
                                <span className="text-slate-900 font-extrabold">{facingStr} • {dimStr}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 font-bold">Survey / LP Identifiers:</span>
                                <span className="text-slate-900 font-extrabold">Sy. No: {surveyStr} • LP: {lpStr}</span>
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* FULL DESCRIPTION & AMENITIES */}
                        {(() => {
                          const descVal = typeof activeAuditProp.description === 'string' ? activeAuditProp.description : '';
                          const amenitiesList = Array.isArray(activeAuditProp.amenities)
                            ? activeAuditProp.amenities.map(a => typeof a === 'string' ? a : (a?.name || a?.label || String(a || ''))).filter(Boolean)
                            : (typeof activeAuditProp.amenities === 'string'
                                ? activeAuditProp.amenities.split(',').map(s => s.trim()).filter(Boolean)
                                : []);

                          if (!descVal && amenitiesList.length === 0) return null;

                          return (
                            <div className="space-y-3 pt-4 border-t border-slate-200">
                              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-purple-600" />
                                <span>Property Description & Key Amenities</span>
                              </h4>
                              {descVal && (
                                <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 leading-relaxed">
                                  {descVal}
                                </div>
                              )}
                              {amenitiesList.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {amenitiesList.map((amenity, idx) => (
                                    <span key={idx} className="bg-slate-200 text-slate-900 font-extrabold text-[11px] px-3 py-1 rounded-lg border border-slate-300">
                                      ✓ {String(amenity)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* SUBMITTED MEDIA, VIDEO PRESENTATION & UPLOADED DOCUMENTS */}
                        {(() => {
                          const propId = activeAuditProp.id || activeAuditProp.propertyId;

                          // Local & session document fallbacks
                          let extraDocs = [];
                          try {
                            const storedDocs = localStorage.getItem(`easeland_docs_${propId}`) || localStorage.getItem('easeland_user_documents');
                            if (storedDocs) {
                              const parsedDocs = JSON.parse(storedDocs);
                              if (Array.isArray(parsedDocs)) {
                                extraDocs = parsedDocs.filter(d => (d && (d.propertyId === propId || !d.propertyId)));
                              }
                            }
                          } catch (e) {}

                          let extraMedia = [];
                          try {
                            const storedMedia = localStorage.getItem(`easeland_media_${propId}`) || localStorage.getItem('easeland_user_media');
                            if (storedMedia) {
                              const parsedMedia = JSON.parse(storedMedia);
                              if (Array.isArray(parsedMedia)) {
                                extraMedia = parsedMedia.filter(m => (m && (m.propertyId === propId || !m.propertyId)));
                              }
                            }
                          } catch (e) {}

                          const rawItems = [
                            ...(Array.isArray(activeAuditProp.documents) ? activeAuditProp.documents : []),
                            ...(Array.isArray(activeAuditProp.propertyDocuments) ? activeAuditProp.propertyDocuments : []),
                            ...(Array.isArray(activeAuditProp.confidentialDocuments) ? activeAuditProp.confidentialDocuments : []),
                            ...extraDocs,
                            ...extraMedia,
                            ...(Array.isArray(activeAuditProp.media) ? activeAuditProp.media : []),
                            ...(Array.isArray(activeAuditProp.photos) ? activeAuditProp.photos : []),
                            ...(Array.isArray(activeAuditProp.images) ? activeAuditProp.images : []),
                            ...(Array.isArray(activeAuditProp.publicApprovedMedia) ? activeAuditProp.publicApprovedMedia : [])
                          ];

                          if (activeAuditProp.videoUrl) rawItems.push(activeAuditProp.videoUrl);
                          if (activeAuditProp.videoLink) rawItems.push(activeAuditProp.videoLink);
                          if (activeAuditProp.embeddedVideoUrl) rawItems.push(activeAuditProp.embeddedVideoUrl);
                          if (activeAuditProp.droneVideoUrl) rawItems.push(activeAuditProp.droneVideoUrl);

                          const photos = [];
                          const videos = [];
                          const documents = [];

                          const seenPhotoUrls = new Set();
                          const seenVideoUrls = new Set();
                          const seenDocKeys = new Set();

                          const isValidPhotoUrl = (u) => {
                            if (!u || typeof u !== 'string') return false;
                            const s = u.trim().toLowerCase();
                            if (s.length < 5) return false;
                            if (s.includes('placeholder') || s.includes('dummy') || s.includes('submitted photo') || s === '[object object]') return false;
                            if (s.includes('youtube.com') || s.includes('youtu.be') || s.includes('drive.google.com')) return false;
                            if (s.endsWith('.mp4') || s.endsWith('.webm') || s.endsWith('.mov') || s.endsWith('.avi') || s.endsWith('.pdf') || s.endsWith('.doc')) return false;
                            return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:image/') || s.startsWith('blob:') || s.startsWith('/');
                          };

                          rawItems.forEach(item => {
                            if (!item) return;

                            let urlStr = '';
                            if (typeof item === 'string') {
                              urlStr = item.trim();
                            } else if (typeof item === 'object') {
                              const candidate = item.url || item.publicUrl || item.mediaUrl || item.embedUrl || item.storagePath || item.path || '';
                              if (typeof candidate === 'string') {
                                urlStr = candidate.trim();
                              } else if (typeof candidate === 'object' && candidate) {
                                urlStr = String(candidate.url || candidate.publicUrl || candidate.link || candidate.path || '').trim();
                              } else {
                                urlStr = String(candidate || '').trim();
                              }
                            }

                            const cleanUrl = typeof urlStr === 'string' ? urlStr.toLowerCase() : '';

                            // 1. CHECK IF DOCUMENT
                            let isDocument = false;
                            if (typeof item === 'object') {
                              if (item.isDocument === true || item.docId || item.documentType) isDocument = true;
                              const typeUpper = String(item.documentType || item.type || item.documentName || '').toUpperCase();
                              if (['DOCUMENT', 'TITLE_DEED', 'LAYOUT_APPROVAL', 'TAX_RECEIPT', 'ENCUMBRANCE_CERTIFICATE', 'FIELD_MEASUREMENT', 'OTHER', 'LEGAL_DEED', 'MUTATION', 'KHATA', 'PASSPORT', 'AADHAAR', 'PAN'].includes(typeUpper)) {
                                isDocument = true;
                              }
                              if (typeUpper.includes('DOC') || typeUpper.includes('DEED') || typeUpper.includes('TAX') || typeUpper.includes('APPROVAL') || typeUpper.includes('CERTIFICATE') || typeUpper.includes('RECEIPT')) {
                                isDocument = true;
                              }
                              if (item.contentType && typeof item.contentType === 'string' && (item.contentType.startsWith('application/') || item.contentType.includes('pdf') || item.contentType.includes('word'))) {
                                isDocument = true;
                              }
                            }
                            if (cleanUrl) {
                              if (cleanUrl.includes('/uploads/documents/') || cleanUrl.includes('private_docs') || cleanUrl.includes('document')) {
                                isDocument = true;
                              }
                              if (cleanUrl.endsWith('.pdf') || cleanUrl.endsWith('.doc') || cleanUrl.endsWith('.docx') || cleanUrl.endsWith('.txt') || cleanUrl.endsWith('.xls') || cleanUrl.endsWith('.xlsx')) {
                                isDocument = true;
                              }
                            }

                            if (isDocument) {
                              let docName = 'Confidential Property Document';
                              if (typeof item === 'object') {
                                const candidate = item.name || item.documentName || item.fileName || item.title;
                                if (typeof candidate === 'string' && candidate.trim()) docName = candidate.trim();
                                else if (typeof candidate === 'object' && candidate) docName = String(candidate.name || candidate.title || candidate.fileName || 'Confidential Property Document');
                              }

                              let docType = 'Verification Document';
                              if (typeof item === 'object') {
                                const candidate = item.type || item.documentType;
                                if (typeof candidate === 'string' && candidate.trim()) docType = candidate.trim();
                                else if (typeof candidate === 'object' && candidate) docType = String(candidate.type || candidate.name || 'Verification Document');
                              }

                              const docUrl = urlStr || '#';
                              const key = docUrl !== '#' ? docUrl : ((typeof item === 'object' && item.docId) || docName);

                              if (key && !seenDocKeys.has(key)) {
                                seenDocKeys.add(key);
                                documents.push({
                                  docId: (typeof item === 'object' && item.docId) || `doc-${documents.length + 1}`,
                                  name: docName,
                                  type: docType,
                                  url: docUrl,
                                  size: (typeof item === 'object' && item.fileSize) || null
                                });
                              }
                              return;
                            }

                            // 2. CHECK IF VIDEO
                            let isVideo = false;
                            if (typeof item === 'object') {
                              const typeUpper = String(item.type || item.mediaType || '').toUpperCase();
                              if (['WALKTHROUGH_VIDEO', 'DRONE_VIDEO', 'VIDEO'].includes(typeUpper)) isVideo = true;
                              if (item.provider === 'youtube' || item.provider === 'gdrive' || item.videoId || item.fileId || item.embedUrl) isVideo = true;
                              if (item.contentType && typeof item.contentType === 'string' && item.contentType.startsWith('video/')) isVideo = true;
                            }
                            if (cleanUrl) {
                              if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be') || cleanUrl.includes('drive.google.com') || cleanUrl.includes('/uploads/videos/')) {
                                isVideo = true;
                              }
                              if (cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.avi') || cleanUrl.endsWith('.mkv')) {
                                isVideo = true;
                              }
                            }

                            if (isVideo) {
                              const videoUrl = urlStr || (typeof item === 'object' && typeof item.embedUrl === 'string' ? item.embedUrl : '');
                              if (videoUrl) {
                                let videoKey = videoUrl.trim();
                                const ytMatch = videoKey.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
                                const driveMatch = videoKey.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/i);

                                if (ytMatch && ytMatch[1]) {
                                  videoKey = `youtube:${ytMatch[1]}`;
                                } else if (driveMatch && (driveMatch[1] || driveMatch[2])) {
                                  videoKey = `gdrive:${driveMatch[1] || driveMatch[2]}`;
                                } else {
                                  videoKey = videoKey.toLowerCase();
                                }

                                if (!seenVideoUrls.has(videoKey)) {
                                  seenVideoUrls.add(videoKey);
                                  let videoTitle = 'Submitted Property Video';
                                  if (typeof item === 'object') {
                                    const candidate = item.title || item.fileName || item.caption;
                                    if (typeof candidate === 'string' && candidate) videoTitle = candidate;
                                  }
                                  videos.push({
                                    url: videoUrl,
                                    embedUrl: (typeof item === 'object' && typeof item.embedUrl === 'string' ? item.embedUrl : videoUrl),
                                    provider: (typeof item === 'object' && typeof item.provider === 'string' ? item.provider : (cleanUrl.includes('youtube') || cleanUrl.includes('youtu.be') ? 'youtube' : cleanUrl.includes('drive.google') ? 'gdrive' : 'direct')),
                                    title: videoTitle
                                  });
                                }
                              }
                              return;
                            }

                            // 3. IF NOT DOCUMENT AND NOT VIDEO -> EVALUATE AS USER UPLOADED PHOTO
                            if (urlStr && isValidPhotoUrl(urlStr) && !seenPhotoUrls.has(urlStr)) {
                              seenPhotoUrls.add(urlStr);
                              photos.push(urlStr);
                            }
                          });

                          return (
                            <div className="space-y-6">
                              
                              {/* SUBMITTED MEDIA PHOTO GALLERY */}
                              <div className="space-y-3 pt-4 border-t border-slate-200">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                  <ImageIcon className="w-4 h-4 text-blue-600" />
                                  <span>Submitted Property Photos ({photos.length})</span>
                                </h4>
                                {photos.length === 0 ? (
                                  <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-600 font-semibold italic">
                                    No property photos uploaded by user.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {photos.map((imgUrl, idx) => (
                                      <div
                                        key={idx}
                                        onClick={() => setEnlargedMediaUrl(imgUrl)}
                                        className="group relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-300 shadow-sm hover:shadow-md transition-all cursor-pointer"
                                      >
                                        <img
                                          src={imgUrl}
                                          alt={`User property photo ${idx + 1}`}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                          onError={(e) => {
                                            if (e.currentTarget && e.currentTarget.parentElement) {
                                              e.currentTarget.parentElement.style.display = 'none';
                                            }
                                          }}
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                                          <Eye className="w-4 h-4" />
                                          <span>Enlarge</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* SUBMITTED VIDEO PRESENTATION & REVIEW SECTION */}
                              <div className="space-y-4 pt-4 border-t border-slate-200">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                  <Video className="w-4 h-4 text-amber-600" />
                                  <span>Submitted Property Videos & Walkthroughs ({videos.length})</span>
                                </h4>
                                {videos.length === 0 ? (
                                  <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-600 font-semibold italic flex items-center gap-2">
                                    <Video className="w-4 h-4 text-amber-500 shrink-0" />
                                    <span>No video walkthrough attached. (Owners can attach YouTube/Google Drive video links or upload MP4/WebM files).</span>
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    {videos.map((vObj, vIdx) => {
                                      const vItem = typeof vObj.url === 'string' ? vObj.url : (typeof vObj.embedUrl === 'string' ? vObj.embedUrl : String(vObj.url || vObj.embedUrl || ''));
                                      if (!vItem) return null;

                                      const isYoutube = vItem.includes('youtube.com') || vItem.includes('youtu.be');
                                      const isDrive = vItem.includes('drive.google.com');

                                      let embedSrc = vItem;
                                      if (isYoutube) {
                                        if (vItem.includes('watch?v=')) {
                                          embedSrc = vItem.replace('watch?v=', 'embed/').split('&')[0];
                                        } else if (vItem.includes('youtu.be/')) {
                                          const id = vItem.split('youtu.be/')[1]?.split('?')[0];
                                          embedSrc = `https://www.youtube.com/embed/${id}`;
                                        }
                                      } else if (isDrive) {
                                        if (vItem.includes('/view')) {
                                          embedSrc = vItem.replace('/view', '/preview');
                                        } else if (!vItem.includes('/preview')) {
                                          const match = vItem.match(/d\/([a-zA-Z0-9_-]+)/);
                                          if (match && match[1]) embedSrc = `https://drive.google.com/file/d/${match[1]}/preview`;
                                        }
                                      }

                                      return (
                                        <div key={vIdx} className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-md max-w-3xl mx-auto p-2">
                                          {isYoutube || isDrive ? (
                                            <iframe
                                              src={embedSrc}
                                              className="w-full aspect-video rounded-xl border-0"
                                              allowFullScreen
                                              title={`Property Video ${vIdx + 1}`}
                                            />
                                          ) : (
                                            <video
                                              src={vItem}
                                              controls
                                              className="w-full aspect-video rounded-xl max-h-96"
                                            />
                                          )}
                                          <div className="p-2 flex items-center justify-between text-xs text-slate-300 border-t border-slate-800 mt-2">
                                            <span className="font-bold flex items-center gap-1.5 text-amber-400">
                                              🎬 {isYoutube ? 'YouTube Video' : isDrive ? 'Google Drive Video' : 'Direct Upload Video'}
                                            </span>
                                            <a
                                              href={vItem}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-amber-400 hover:text-amber-300 font-extrabold underline flex items-center gap-1"
                                            >
                                              <span>Open External Video Link ↗</span>
                                            </a>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* UPLOADED VERIFICATION DOCUMENTS (ALWAYS VISIBLE SECTION) */}
                              <div className="space-y-3 pt-4 border-t border-slate-200">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-indigo-600" />
                                  <span>Uploaded Verification Documents ({documents.length})</span>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {documents.length === 0 ? (
                                    <div className="col-span-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 italic font-semibold">
                                      No physical documents attached. Property subject to basic title and field verification.
                                    </div>
                                  ) : (
                                    documents.map((docItem, idx) => {
                                      const docNameStr = typeof docItem.name === 'string' ? docItem.name : String(docItem.name || `Document ${idx + 1}`);
                                      const docTypeStr = typeof docItem.type === 'string' ? docItem.type : String(docItem.type || 'Verification Document');
                                      const docUrlStr = typeof docItem.url === 'string' ? docItem.url : String(docItem.url || '#');

                                      return (
                                        <div key={idx} className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3 text-xs text-slate-900 min-w-0 overflow-hidden shadow-sm">
                                          <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
                                            <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                                            <div className="min-w-0 overflow-hidden">
                                              <span className="font-extrabold text-blue-950 block truncate" title={docNameStr}>
                                                {docNameStr}
                                              </span>
                                              <span className="text-[10px] text-blue-700 font-bold block truncate">
                                                {docTypeStr}
                                              </span>
                                            </div>
                                          </div>
                                          {docUrlStr && docUrlStr !== '#' && (
                                            <a
                                              href={docUrlStr}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition-all shadow-sm shrink-0 whitespace-nowrap"
                                            >
                                              View / Download PDF ↗
                                            </a>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>

                            </div>
                          );
                        })()}

                        {/* AUDITOR NOTES & FEEDBACK TEXTAREA */}
                        <div className="space-y-3 pt-4 border-t border-slate-200">
                          <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Auditor Notes / Reason for Feedback
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Enter official legal audit notes, boundary verification remarks, or document rejection details..."
                            value={feedbackNote}
                            onChange={(e) => setFeedbackNote(e.target.value)}
                            className="w-full bg-white text-slate-900 border-2 border-slate-300 rounded-xl p-3.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 placeholder-slate-400 shadow-inner"
                          />
                        </div>

                        {/* ACTION BUTTONS */}
                        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                          <button
                            onClick={() => handleReject(activeAuditProp.id || activeAuditProp.propertyId)}
                            disabled={adminActionProcessing}
                            className="px-5 py-2.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 font-extrabold text-xs transition-colors cursor-pointer border border-red-300"
                          >
                            Reject Listing
                          </button>
                          <button
                            onClick={() => handleRequestChanges(activeAuditProp.id || activeAuditProp.propertyId)}
                            disabled={adminActionProcessing}
                            className="px-5 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-xs transition-colors cursor-pointer border border-amber-300"
                          >
                            Request Document Changes
                          </button>
                          <button
                            onClick={() => handleApprove(activeAuditProp.id || activeAuditProp.propertyId)}
                            disabled={adminActionProcessing}
                            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                            <span>Approve & Publish Live</span>
                          </button>
                        </div>

                      </div>
                    );
                  } catch (err) {
                    console.error("Error rendering Verification Workspace:", err);
                    return (
                      <div className="bg-white rounded-2xl p-8 border border-red-200 shadow-lg space-y-4 text-slate-900">
                        <div className="flex items-center gap-3 text-red-600 font-extrabold text-base">
                          <AlertCircle className="w-6 h-6 shrink-0" />
                          <span>Verification Workspace Render Warning</span>
                        </div>
                        <p className="text-xs text-slate-600 font-semibold">
                          An unexpected formatting issue occurred while rendering property verification details.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('verification')}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
                        >
                          Return to Verification Queue
                        </button>
                      </div>
                    );
                  }
                })()
              )
            )}

            {/* LIGHTBOX MODAL FOR ENLARGED MEDIA */}
            {enlargedMediaUrl && (
              <div
                className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setEnlargedMediaUrl(null)}
              >
                <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setEnlargedMediaUrl(null)}
                    className="absolute -top-12 right-0 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 text-xs font-bold transition-all cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <img
                    src={enlargedMediaUrl}
                    alt="Enlarged property photo"
                    className="max-w-full max-h-[85vh] object-contain rounded-2xl border-2 border-slate-700 shadow-2xl"
                  />
                </div>
              </div>
            )}

            {/* TAB: USER GOVERNANCE & TEMPORARY SUSPENSION */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                
                {/* METRICS HEADER */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 text-xs font-bold uppercase tracking-wider block">Registered Users</span>
                      <span className="text-2xl font-black text-brand-charcoal mt-1 block">{registeredUsersList.length}</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                      <Users className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 text-xs font-bold uppercase tracking-wider block">Active Users</span>
                      <span className="text-2xl font-black text-emerald-600 mt-1 block">
                        {registeredUsersList.filter(u => u.status === 'ACTIVE').length}
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 text-xs font-bold uppercase tracking-wider block">Suspended Users</span>
                      <span className="text-2xl font-black text-amber-600 mt-1 block">
                        {registeredUsersList.filter(u => u.status === 'SUSPENDED').length}
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 text-xs font-bold uppercase tracking-wider block">Removed / Deleted</span>
                      <span className="text-2xl font-black text-red-600 mt-1 block">
                        {registeredUsersList.filter(u => u.status === 'REMOVED').length}
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-black">
                      <XCircle className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {/* SEARCH & STATUS FILTER BAR */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="relative w-full sm:w-80">
                    <input
                      type="text"
                      placeholder="Search users by name, email, phone, or UID..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 text-xs font-semibold px-3.5 py-2.5 pl-9 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                    />
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                    <button
                      type="button"
                      onClick={async () => {
                        await loadData();
                        setPublishSuccessMessage('User directory synced & refreshed from Firebase Auth!');
                        setTimeout(() => setPublishSuccessMessage(''), 3000);
                      }}
                      className="flex items-center gap-1.5 bg-brand-charcoal text-brand-yellow hover:bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-extrabold shadow-sm transition-all shrink-0"
                      title="Sync and Refresh User Directory from Firebase Auth & Firestore"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sync & Refresh</span>
                    </button>

                    {['ALL', 'ACTIVE', 'SUSPENDED', 'REMOVED'].map((st) => (
                      <button
                        key={st}
                        onClick={() => setUserStatusFilter(st)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                          userStatusFilter === st
                            ? 'bg-brand-charcoal text-white shadow'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* REGISTERED USERS DIRECTORY TABLE (Clean Responsive Layout with Zero Side-Scrolling) */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="w-full">
                    <table className="w-full text-left border-collapse table-auto">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                          <th className="py-3 px-3">User & Auth Details</th>
                          <th className="py-3 px-3">Auth Method</th>
                          <th className="py-3 px-3">Platform Role</th>
                          <th className="py-3 px-3">Contact Phone</th>
                          <th className="py-3 px-3 text-center">Listings</th>
                          <th className="py-3 px-3 text-center">Account Status</th>
                          <th className="py-3 px-3 text-right">Governance Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {registeredUsersList
                          .filter(u => {
                            if (!u || u.status === 'DELETED' || u.status === 'REMOVED') return false;
                            if (userStatusFilter !== 'ALL' && u.status !== userStatusFilter) return false;
                            if (userSearchQuery) {
                              const q = userSearchQuery.toLowerCase();
                              return (u.name || '').toLowerCase().includes(q) ||
                                     (u.email || '').toLowerCase().includes(q) ||
                                     (u.phone || '').includes(q) ||
                                     (u.uid || '').toLowerCase().includes(q);
                            }
                            return true;
                          })
                          .sort((a, b) => {
                            const aIsAdmin = a.role === 'ADMIN' || a.email === 'admin@easeland.in';
                            const bIsAdmin = b.role === 'ADMIN' || b.email === 'admin@easeland.in';
                            if (aIsAdmin && !bIsAdmin) return -1;
                            if (!aIsAdmin && bIsAdmin) return 1;
                            return 0;
                          })
                          .map((u) => (
                            <tr key={u.id || u.email || u.uid} className="hover:bg-gray-50/80 transition-colors">
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-xl bg-brand-charcoal text-brand-yellow font-black text-xs flex items-center justify-center shadow-sm shrink-0">
                                    {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-extrabold text-brand-charcoal block truncate text-xs">{u.name}</span>
                                      {u.emailVerified && (
                                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.2 rounded inline-flex items-center gap-0.5" title="Firebase Email Verified">
                                          ✓ Verified
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-gray-500 font-medium block truncate">{u.email}</span>
                                    {(u.uid || u.id) && (
                                      <span className="text-[9px] text-slate-400 font-mono block truncate" title={`Firebase Auth UID: ${u.uid || u.id}`}>
                                        UID: {String(u.uid || u.id).length > 18 ? `${String(u.uid || u.id).substring(0, 16)}...` : String(u.uid || u.id)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase inline-flex items-center gap-1 ${
                                  u.authProvider?.includes('Google') || u.email?.endsWith('@gmail.com')
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}>
                                  {u.authProvider || (u.email?.endsWith('@gmail.com') ? 'Google OAuth' : 'Email/Password')}
                                </span>
                              </td>

                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase inline-block ${
                                  u.role === 'ADMIN' || u.email === 'admin@easeland.in'
                                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                    : u.role?.includes('VERIFIED') || u.postedListingsCount > 0
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {u.role === 'ADMIN' || u.email === 'admin@easeland.in' ? 'ADMINISTRATOR' : (u.postedListingsCount > 0 ? 'VERIFIED PROPERTY OWNER & BUYER' : u.role)}
                                </span>
                              </td>

                              <td className="py-3 px-3 font-semibold text-gray-700 text-xs">
                                {u.phone ? (
                                  <span>{u.phone}</span>
                                ) : (
                                  <span className="text-gray-400 italic text-[10px]">Not Provided</span>
                                )}
                              </td>

                              <td className="py-3 px-3 text-center font-extrabold text-brand-charcoal text-xs">
                                {u.postedListingsCount || 0} Posted
                              </td>

                              <td className="py-3 px-3 text-center">
                                {u.status === 'ACTIVE' && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    ACTIVE
                                  </span>
                                )}

                                {u.status === 'SUSPENDED' && (
                                  <div>
                                    <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                                      SUSPENDED
                                    </span>
                                    {u.suspension && (
                                      <span className="block text-[9px] text-amber-700 font-semibold mt-0.5">
                                        Until: {new Date(u.suspension.suspendedUntil).toLocaleDateString('en-IN')}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {u.status === 'ADMIN' && (
                                  <span className="bg-purple-100 text-purple-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-purple-600" />
                                    ADMIN
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-3 text-right">
                                {u.status !== 'ADMIN' && u.role !== 'ADMIN' && u.email !== 'admin@easeland.in' && (
                                  <div className="flex items-center justify-end gap-1.5">
                                    {u.status === 'SUSPENDED' ? (
                                      <button
                                        onClick={() => handleUnsuspendUser(u.id)}
                                        className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-extrabold px-2.5 py-1 rounded-lg text-[10px] transition-colors"
                                      >
                                        Lift Suspension
                                      </button>
                                    ) : u.status === 'ACTIVE' ? (
                                      <button
                                        onClick={() => handleOpenSuspendModal(u)}
                                        className="bg-amber-100 text-amber-900 hover:bg-amber-200 font-extrabold px-2.5 py-1 rounded-lg text-[10px] transition-colors"
                                      >
                                        Suspend Account
                                      </button>
                                    ) : null}

                                    <button
                                      onClick={() => handleOpenRemoveModal(u)}
                                      className="bg-red-100 text-red-800 hover:bg-red-200 font-extrabold px-2.5 py-1 rounded-lg text-[10px] transition-colors"
                                    >
                                      Remove Account
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB: ENQUIRIES */}
            {activeTab === 'enquiries' && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="border-b border-gray-100 pb-4">
                  <h3 className="text-lg font-black text-brand-charcoal">Enquiry Directory</h3>
                  <p className="text-xs text-gray-500 font-medium">Inbound buyer enquiries submitted across verified properties.</p>
                </div>
                {enquiries.length === 0 ? (
                  <div className="p-12 text-center bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                    <div className="text-3xl">🎉</div>
                    <h4 className="font-black text-lg text-emerald-800 uppercase tracking-wide">
                      ALL ENQUIRIES ARE CLEAR !!
                    </h4>
                    <p className="text-xs text-emerald-600 font-bold">
                      No unprocessed buyer inquiries present. All messages handled!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-semibold flex items-center justify-between">
                      <span>Total Inbound Buyer Enquiries: <strong>{enquiries.length}</strong></span>
                      <span className="text-[11px] font-bold text-blue-700">All submissions saved in live database</span>
                    </div>

                    <div className="space-y-3">
                      {enquiries.map((enq) => (
                        <div key={enq.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3 hover:bg-gray-100/60 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/60 pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm text-brand-charcoal">{enq.customerName || enq.name}</span>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                  enq.status === 'CLOSED' ? 'bg-gray-200 text-gray-700' :
                                  enq.status === 'CONTACTED' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {enq.status || 'NEW'}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500 font-medium block mt-0.5">
                                {enq.customerEmail || enq.email} • {enq.customerPhone || enq.phone}
                              </span>
                            </div>

                            <span className="text-[11px] text-gray-400 font-semibold self-start sm:self-auto">
                              {enq.createdAt ? new Date(enq.createdAt).toLocaleDateString() : 'Recent'}
                            </span>
                          </div>

                          <div className="text-xs space-y-1.5">
                            <div>
                              <span className="font-bold text-gray-500">Property: </span>
                              <span className="font-black text-brand-charcoal">{enq.propertyTitle || 'Direct General Discovery Enquiry'}</span>
                            </div>
                            {enq.message && (
                              <div className="p-3 bg-white rounded-xl border border-gray-200 text-gray-700 font-medium italic">
                                "{enq.message}"
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              onClick={() => {
                                enq.status = 'CONTACTED';
                                setEnquiries([...enquiries]);
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-extrabold text-xs hover:bg-blue-700 transition-colors shadow-sm"
                            >
                              Mark Contacted
                            </button>
                            <button
                              onClick={() => {
                                enq.status = 'CLOSED';
                                setEnquiries([...enquiries]);
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-300 transition-colors"
                            >
                              Close Enquiry
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: CRM */}
            {activeTab === 'crm' && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-brand-charcoal flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-brand-yellow" />
                      Deal CRM Pipeline
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">Manage buyer-seller deal stages, legal audits, and registration progress.</p>
                  </div>

                  <button
                    onClick={() => handleOpenScheduleModal()}
                    className="px-4 py-2.5 rounded-xl bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs flex items-center gap-2 shadow-md transition-all self-start sm:self-auto"
                  >
                    <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                    Schedule Follow-up / Visit
                  </button>
                </div>

                {/* STAGE FILTERS */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {['ALL', 'NEW', 'SITE_VISIT', 'DOCUMENT_AUDIT', 'ADVANCE_PAID', 'REGISTRATION_PENDING', 'DEAL_CLOSED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setCrmStageFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all ${
                        crmStageFilter === st
                          ? 'bg-brand-charcoal text-brand-yellow shadow'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                {/* DEAL CARDS GRID */}
                {deals.filter(d => crmStageFilter === 'ALL' || d.stage === crmStageFilter).length === 0 ? (
                  <div className="p-12 text-center bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                    <div className="text-3xl">🎉</div>
                    <h4 className="font-black text-lg text-emerald-800 uppercase tracking-wide">
                      ALL DEALS ARE CLEAR !!
                    </h4>
                    <p className="text-xs text-emerald-600 font-bold">
                      No active pipeline deals matching the selected stage filter ({crmStageFilter}).
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {deals
                      .filter(d => crmStageFilter === 'ALL' || d.stage === crmStageFilter)
                      .map((deal) => (
                        <div key={deal.id} className="p-5 bg-gray-50 rounded-2xl border border-gray-200 hover:border-brand-yellow transition-all shadow-sm flex flex-col justify-between gap-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-black text-sm text-brand-charcoal flex items-center gap-1.5">
                                <User className="w-4 h-4 text-gray-500" />
                                {deal.customerName}
                              </span>
                              <select
                                value={deal.stage}
                                onChange={(e) => handleUpdateDealStage(deal.id, e.target.value)}
                                className="bg-brand-yellow/20 text-brand-charcoal text-[10px] font-black px-2.5 py-1 rounded-lg border border-brand-yellow/40 focus:outline-none cursor-pointer"
                              >
                                <option value="NEW">NEW</option>
                                <option value="SITE_VISIT">SITE VISIT</option>
                                <option value="DOCUMENT_AUDIT">DOCUMENT AUDIT</option>
                                <option value="ADVANCE_PAID">ADVANCE PAID</option>
                                <option value="REGISTRATION_PENDING">REGISTRATION</option>
                                <option value="DEAL_CLOSED">DEAL CLOSED</option>
                              </select>
                            </div>

                            <div>
                              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Property</span>
                              <p className="text-xs font-black text-brand-charcoal line-clamp-1 mt-0.5">{deal.propertyTitle}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60 text-xs">
                              <div>
                                <span className="text-[10px] font-bold text-gray-400 block">Listed Price</span>
                                <span className="font-extrabold text-gray-700">{deal.listedPrice}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-gray-400 block">Agreed / Offer</span>
                                <span className="font-black text-emerald-600">{deal.negotiatedPrice || 'Rs. 30.5 Lakhs'}</span>
                              </div>
                            </div>
                          </div>

                          {/* ACTION BUTTONS */}
                          <div className="flex items-center gap-2 pt-3 border-t border-gray-200/80">
                            <button
                              onClick={() => setSelectedDealForDossier(deal)}
                              className="flex-1 bg-brand-charcoal text-white hover:bg-brand-charcoalLight text-xs font-extrabold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                            >
                              <Eye className="w-3.5 h-3.5 text-brand-yellow" />
                              Deal Details
                            </button>
                            <button
                              onClick={() => handleOpenScheduleModal(deal)}
                              className="flex-1 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 text-xs font-extrabold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"
                            >
                              <Calendar className="w-3.5 h-3.5 text-brand-blue" />
                              Schedule
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: FOLLOW UPS */}
            {activeTab === 'followups' && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-brand-charcoal flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-brand-yellow" />
                      Follow-ups & Site Visit Scheduler
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">Schedule site visits and document verification calls with buyers and sellers.</p>
                  </div>

                  <button
                    onClick={() => handleOpenScheduleModal()}
                    className="px-4 py-2.5 rounded-xl bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs flex items-center gap-2 shadow-md transition-all self-start sm:self-auto"
                  >
                    <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                    + Schedule New Visit / Call
                  </button>
                </div>

                {followUps.length === 0 ? (
                  <div className="p-12 text-center bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                    <div className="text-3xl">🎉</div>
                    <h4 className="font-black text-lg text-emerald-800 uppercase tracking-wide">
                      ALL FOLLOW-UPS ARE CLEAR !!
                    </h4>
                    <p className="text-xs text-emerald-600 font-bold">
                      No pending site visits or scheduled follow-ups on calendar.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {followUps.map((fup) => (
                      <div key={fup.id} className="p-5 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-brand-yellow shadow-sm">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-brand-charcoal">{fup.customerName}</span>
                            <span className="text-gray-400">•</span>
                            <span className="font-bold text-xs text-gray-700">{fup.propertyTitle}</span>
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                              fup.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {fup.status}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-gray-600 font-medium">
                            <span className="flex items-center gap-1 text-brand-charcoal font-extrabold">
                              <Calendar className="w-3.5 h-3.5 text-brand-yellow" />
                              {fup.followUpDate} at {fup.followUpTime}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-gray-500">
                              {fup.nextAction}
                            </span>
                          </div>

                          {fup.notes && (
                            <p className="text-[11px] text-gray-500 font-medium bg-white p-2 rounded-lg border border-gray-200/60 mt-2">
                              Note: {fup.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-auto">
                          <button
                            onClick={() => handleToggleFollowUpStatus(fup.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                              fup.status === 'COMPLETED'
                                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                            }`}
                          >
                            {fup.status === 'COMPLETED' ? 'Mark Scheduled' : 'Mark Completed'}
                          </button>
                          <button
                            onClick={() => handleOpenScheduleModal({ customerName: fup.customerName, propertyTitle: fup.propertyTitle })}
                            className="px-3 py-1.5 rounded-xl bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-bold transition-all"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => {
                              const matchedDeal = deals.find(d => d.customerName === fup.customerName) || deals[0];
                              setSelectedDealForDossier(matchedDeal);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-brand-charcoal text-white hover:bg-brand-charcoalLight text-xs font-extrabold flex items-center gap-1 shadow-sm transition-all"
                          >
                            <Eye className="w-3.5 h-3.5 text-brand-yellow" />
                            Deal Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: REPORTS & LOGS */}
            {activeTab === 'reports' && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="border-b border-gray-100 pb-4">
                  <h3 className="text-lg font-black text-brand-charcoal">Reports & Activity Logs</h3>
                  <p className="text-xs text-gray-500 font-medium">Audit logs of all legal approvals, user suspensions, and site publications.</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs font-mono text-gray-700 space-y-2">
                  <div>[2026-09-02 12:45:00] Admin Scarlett published site configuration changes live.</div>
                  <div>[2026-09-02 12:42:00] Admin Scarlett suspended user Ramesh Varma for 7 days (Fraudulent Title Document Upload).</div>
                  <div>[2026-09-02 11:30:00] Admin Scarlett verified and published property prop-106 live.</div>
                </div>
              </div>
            )}

            {/* TAB: ADMIN PROFILE & SECURITY SETTINGS */}
            {activeTab === 'profile-settings' && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-brand-charcoal">Administrator Profile & Security Settings</h3>
                    <p className="text-xs text-gray-500 font-medium">Update your admin credentials, contact info, and security preferences.</p>
                  </div>
                  <span className="bg-purple-100 text-purple-900 font-extrabold text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-700" />
                    PLATFORM ADMIN
                  </span>
                </div>

                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-charcoal text-brand-yellow font-black text-base flex items-center justify-center shadow-sm">
                    {adminName ? adminName.charAt(0).toUpperCase() : 'A'}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-brand-charcoal">{adminName}</h4>
                    <p className="text-xs text-purple-900 font-semibold">{adminEmail} • {adminPhone}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* ADMIN PROFILE INFO */}
                  <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <h4 className="font-extrabold text-xs text-gray-500 uppercase tracking-wider">Personal & Contact Info</h4>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Admin Display Name</label>
                      <input
                        type="text"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Admin Email Address</label>
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Emergency Mobile Number (+91)</label>
                      <input
                        type="tel"
                        value={adminPhone}
                        onChange={(e) => setAdminPhone(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  {/* ADMIN SECURITY & CREDENTIALS */}
                  <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <h4 className="font-extrabold text-xs text-gray-500 uppercase tracking-wider">Security & Access Key</h4>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Update Admin Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={adminConfirmPassword}
                        onChange={(e) => setAdminConfirmPassword(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold"
                      />
                    </div>
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700">Require 2FA for Admin Portal</span>
                      <input type="checkbox" defaultChecked className="w-4 h-4 text-brand-yellow rounded" />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      if (adminPassword && adminPassword !== adminConfirmPassword) {
                        alert('Password and Confirm Password do not match.');
                        return;
                      }
                      localStorage.setItem('easeland_admin_name', adminName);
                      localStorage.setItem('easeland_admin_email', adminEmail);
                      localStorage.setItem('easeland_admin_phone', adminPhone);
                      if (adminPassword) {
                        localStorage.setItem('easeland_admin_password', adminPassword);
                      }
                      setAdminPassword('');
                      setAdminConfirmPassword('');
                      setPublishSuccessMessage('Admin Profile & Security Settings updated successfully!');
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('easeland-admin-updated', {
                          detail: { name: adminName, email: adminEmail, phone: adminPhone }
                        }));
                      }
                      setTimeout(() => setPublishSuccessMessage(''), 3000);
                    }}
                    className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-black text-xs px-6 py-3 rounded-xl shadow-md flex items-center gap-1.5 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Save Admin Credentials
                  </button>
                </div>
              </div>
            )}


          </div>
        </div>
      </div>

      {/* MODAL 1: SUSPENSION DURATION & REASON CUSTOMIZER */}
      {isSuspendModalOpen && selectedUserForSuspension && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-black text-brand-charcoal">Temporarily Suspend User Account</h3>
              </div>
              <button
                onClick={() => setIsSuspendModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <span className="font-extrabold block">Target User: {selectedUserForSuspension.name} ({selectedUserForSuspension.email})</span>
              <span className="block text-amber-800">During suspension, the user cannot log in, post property listings, or access their owner dashboard.</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Quick Duration Presets</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '1 Day', d: 1, h: 0 },
                    { label: '3 Days', d: 3, h: 0 },
                    { label: '7 Days', d: 7, h: 0 },
                    { label: '14 Days', d: 14, h: 0 },
                    { label: '30 Days', d: 30, h: 0 },
                    { label: 'Custom', d: suspensionDays, h: suspensionHours }
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSuspensionDays(preset.d);
                        setSuspensionHours(preset.h);
                      }}
                      className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${
                        suspensionDays === preset.d && suspensionHours === preset.h
                          ? 'bg-brand-charcoal text-brand-yellow border-brand-charcoal shadow'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Days</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={suspensionDays}
                    onChange={(e) => setSuspensionDays(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Hours</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={suspensionHours}
                    onChange={(e) => setSuspensionHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Suspension Reason</label>
                <select
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-800"
                >
                  <option value="Fraudulent Land Title Document Upload">Fraudulent Land Title Document Upload</option>
                  <option value="Fake / Misleading Property Listing Details">Fake / Misleading Property Listing Details</option>
                  <option value="Abusive Communication with Buyers / Owners">Abusive Communication with Buyers / Owners</option>
                  <option value="Unverified Agent Brokerage Solicitations">Unverified Agent Brokerage Solicitations</option>
                  <option value="Custom Reason">Custom Reason...</option>
                </select>
              </div>

              {suspensionReason === 'Custom Reason' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Custom Suspension Note</label>
                  <textarea
                    rows={2}
                    placeholder="Provide detailed explanation for suspension..."
                    value={customReasonText}
                    onChange={(e) => setCustomReasonText(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-semibold"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsSuspendModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplySuspension}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md transition-all"
              >
                Confirm Account Suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ACCOUNT REMOVAL CONFIRMATION */}
      {isRemoveModalOpen && selectedUserForRemoval && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" />
                <h3 className="text-lg font-black text-brand-charcoal">Remove User Account</h3>
              </div>
              <button
                onClick={() => setIsRemoveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-red-50 p-3.5 rounded-xl border border-red-200 text-xs text-red-900 space-y-1">
              <span className="font-extrabold block">Permanently Deleting User: {selectedUserForRemoval.name} ({selectedUserForRemoval.email})</span>
              <span className="block text-red-800">This action permanently removes the user's account and revokes platform access.</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Reason for Removal</label>
              <textarea
                rows={3}
                value={removalReason}
                onChange={(e) => setRemovalReason(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-semibold"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsRemoveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveUser}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md transition-all"
              >
                Permanently Remove Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CHECK DEAL DETAILS & DOSSIER */}
      {selectedDealForDossier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-black text-brand-yellow uppercase tracking-wider">
                  <Briefcase className="w-4 h-4 text-brand-yellow" />
                  Platform Deal CRM Dossier
                </div>
                <h3 className="text-xl font-black text-brand-charcoal mt-0.5">{selectedDealForDossier.customerName}</h3>
              </div>
              <button
                onClick={() => setSelectedDealForDossier(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DEAL STAGE PROGRESS BAR */}
            <div className="bg-brand-charcoal text-white p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Current Deal Stage</span>
                <span className="text-brand-yellow font-black uppercase">{selectedDealForDossier.stage}</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-[9px] font-black uppercase text-center">
                {['NEW', 'SITE_VISIT', 'DOCUMENT_AUDIT', 'ADVANCE_PAID', 'DEAL_CLOSED'].map((stg) => (
                  <div
                    key={stg}
                    className={`p-1.5 rounded-lg border ${
                      selectedDealForDossier.stage === stg
                        ? 'bg-brand-yellow text-brand-charcoal border-brand-yellow font-extrabold shadow'
                        : 'bg-white/10 text-gray-300 border-white/10'
                    }`}
                  >
                    {stg.replace('_', ' ')}
                  </div>
                ))}
              </div>
            </div>

            {/* PROPERTY & NEGOTIATION SUMMARY */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Property Details</span>
                <h4 className="font-extrabold text-sm text-brand-charcoal">{selectedDealForDossier.propertyTitle}</h4>
                <div className="text-xs font-semibold text-gray-600 space-y-1">
                  <div>Listed Price: <strong className="text-gray-900">{selectedDealForDossier.listedPrice}</strong></div>
                  <div>Negotiated Offer: <strong className="text-emerald-600 font-black">{selectedDealForDossier.negotiatedPrice || 'Rs. 30.5 Lakhs'}</strong></div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Contact Information</span>
                <div className="text-xs font-semibold text-gray-700 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-brand-blue" />
                    <span>Buyer Phone: <strong>{selectedDealForDossier.customerPhone || '+91 98765 43210'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-brand-yellow" />
                    <span>Seller Owner: <strong>{selectedDealForDossier.ownerName || 'Ramesh Varma'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Assigned Admin: <strong>{selectedDealForDossier.assignedAdmin || 'Scarlett'}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* LEGAL DOCUMENTATION AUDIT CHECKLIST */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-brand-charcoal uppercase tracking-wider">Legal Document Audit Checklist</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-extrabold">
                <div className="p-3 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <span>Title Deed Audit</span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-black">VERIFIED</span>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <span>Encumbrance Certificate (EC)</span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-black">VERIFIED</span>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <span>GeoJSON Boundary Delineation</span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-black">VERIFIED</span>
                </div>
                <div className="p-3 bg-amber-50 text-amber-900 rounded-xl border border-amber-200 flex items-center justify-between">
                  <span>Bank Loan Pre-Sanction</span>
                  <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-black">IN PROGRESS</span>
                </div>
              </div>
            </div>

            {/* ADMIN REMARKS */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Deal Audit Notes & Field Activity</label>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-medium">
                {selectedDealForDossier.notes || 'Customer liked the site location and 40ft road facing. Legal audit clear.'}
              </div>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => {
                  const dealToSchedule = selectedDealForDossier;
                  setSelectedDealForDossier(null);
                  handleOpenScheduleModal(dealToSchedule);
                }}
                className="px-4 py-2.5 rounded-xl bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs flex items-center gap-1.5 shadow"
              >
                <Calendar className="w-4 h-4 stroke-[2.5]" />
                Schedule Follow-up Visit
              </button>
              <button
                onClick={() => setSelectedDealForDossier(null)}
                className="px-5 py-2.5 rounded-xl bg-brand-charcoal text-white font-extrabold text-xs hover:bg-brand-charcoalLight shadow transition-all"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SCHEDULE NEW FOLLOW-UP OR SITE VISIT */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-brand-charcoal">
                <Calendar className="w-5 h-5 text-brand-yellow" />
                <h3 className="text-lg font-black">Schedule Follow-up / Site Visit</h3>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFollowUp} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-gray-700 mb-1">Buyer / Customer Name</label>
                <input
                  type="text"
                  required
                  value={scheduleForm.customerName}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, customerName: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 mb-1">Property Title / ID</label>
                <input
                  type="text"
                  required
                  value={scheduleForm.propertyTitle}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, propertyTitle: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.followUpDate}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, followUpDate: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">Scheduled Time</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 11:30 AM"
                    value={scheduleForm.followUpTime}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, followUpTime: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 mb-1">Action Agenda / Next Step</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call customer to confirm loan eligibility and close final offer"
                  value={scheduleForm.nextAction}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, nextAction: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-black text-xs shadow-md transition-all"
                >
                  Confirm & Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: RESET TO FACTORY DEFAULT CONFIRMATION */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base text-brand-charcoal">Reset to Factory Default?</h3>
              </div>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 font-semibold leading-relaxed">
              Are you sure you want to reset all 16 CMS modules, branding, hero titles, map center coordinates, color themes, and FAQ sections back to initial factory default settings?
            </p>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] font-bold text-amber-800 space-y-1.5">
              <div>• Restores default brand name ("EaseLand") & tagline</div>
              <div>• Resets default primary and accent color themes</div>
              <div>• Re-hydrates original 16 CMS configuration modules</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-amber-600 hover:bg-amber-700 text-white shadow-md flex items-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Confirm & Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
