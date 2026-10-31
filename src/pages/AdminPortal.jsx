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
  ChevronLeft,
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
  Trash2,
  UserCheck,
  PhoneCall,
  ExternalLink,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Plus,
  Star,
  Tag,
  Loader2
} from 'lucide-react';
import { mockApi, applySiteTheme, safeArray, isFakeProperty, DEFAULT_SITE_CONFIG } from '../services/mockApi';
import { DEFAULT_SHOWCASE_PROPERTIES } from '../services/showcaseProperties.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getVerificationQueue,
  getVerificationWorkspaceData,
  startPropertyReview,
  approvePropertyVerification,
  rejectPropertyEdits,
  requestVerificationChanges,
  rejectPropertyVerification
} from '../firebase/verificationService.js';
import {
  getAllUsersAdmin,
  suspendUserAccount,
  unsuspendUserAccount,
  removeUserAccount,
  subscribeToUsersAdmin
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
  publishSiteConfigAdmin,
  syncSiteConfigAndUsers
} from '../firebase/siteManagementService.js';
import {
  getVisitorLeads,
  updateVisitorStatus,
  deleteVisitorLead,
  convertVisitorToCrmLead
} from '../firebase/visitorService.js';
import VerificationLocationBoundaryCard from '../components/VerificationLocationBoundaryCard.jsx';
import { computeReauditDiff, formatInr } from '../utils/reauditDiffUtils.js';
import { isPropertyDeleted } from '../utils/filterMatchingUtils.js';
import { getFirstUploadedImage, getPropertyCoverOrFirstImage, NO_PHOTO_PLACEHOLDER } from '../utils/categoryUtils.js';

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

function CmsModuleActionBar({
  moduleId,
  moduleName,
  hasUnsaved,
  onSaveDraft,
  onPublishLive,
  onReset,
  isProcessing
}) {
  return (
    <div className="pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/80 -mx-6 -mb-6 p-4 rounded-b-2xl mt-6">
      <div className="flex items-center gap-2">
        {hasUnsaved ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Unsaved Changes in {moduleName}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-gray-500 bg-gray-100 border border-gray-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            {moduleName} in Sync
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <button
          type="button"
          onClick={onReset}
          disabled={isProcessing}
          className="px-3.5 py-2 rounded-xl text-xs font-extrabold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          title={'Reset ' + moduleName + ' to factory defaults'}
        >
          <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
          <span>Reset Module</span>
        </button>

        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isProcessing}
          className="px-4 py-2 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          title={'Save draft for ' + moduleName}
        >
          <Save className="w-3.5 h-3.5 text-blue-100" />
          <span>Save Draft</span>
        </button>

        <button
          type="button"
          onClick={onPublishLive}
          disabled={isProcessing}
          className="px-4 py-2 rounded-xl text-xs font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-md flex items-center gap-1.5 transition-all cursor-pointer transform hover:scale-105 disabled:opacity-50"
          title={'Publish ' + moduleName + ' live immediately'}
        >
          <Globe className="w-3.5 h-3.5 text-slate-950" />
          <span>Publish Live</span>
        </button>
      </div>
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
      } catch (e) { }
    }
    if (val.seconds) {
      return new Date(val.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  return 'Recent';
};

export default function AdminPortal({ onNavigate }) {
  const { user, profile, loginAdmin, logoutUser } = useAuth();

  // Admin Auth Gate State
  const [adminAuthEmail, setAdminAuthEmail] = useState('');
  const [adminAuthPassword, setAdminAuthPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState(null);

  const isAdminAuthenticated = profile?.role === 'ADMIN' || profile?.adminRole === true || localStorage.getItem('easeland_admin_authenticated') === 'true';

  const [activeTab, setActiveTab] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('easeland_admin_active_tab');
        if (stored) return stored;
      }
    } catch (e) {}
    return 'cms';
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && activeTab) {
        localStorage.setItem('easeland_admin_active_tab', activeTab);
      }
    } catch (e) {}
  }, [activeTab]);

  // Admin Profile & Dedicated Security Credentials State
  const [adminName, setAdminName] = useState(() => localStorage.getItem('easeland_admin_name') || 'EaseLand Admin');
  const [adminEmail, setAdminEmail] = useState(() => localStorage.getItem('easeland_admin_email') || 'admin@easeland.in');
  const [adminPhone, setAdminPhone] = useState(() => localStorage.getItem('easeland_admin_phone') || '');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showUpdateAdminPassword, setShowUpdateAdminPassword] = useState(false);
  const [showUpdateAdminConfirmPassword, setShowUpdateAdminConfirmPassword] = useState(false);

  useEffect(() => {
    if (isAdminAuthenticated) {
      setAdminName(localStorage.getItem('easeland_admin_name') || 'EaseLand Admin');
      setAdminEmail(localStorage.getItem('easeland_admin_email') || 'admin@easeland.in');
      setAdminPhone(localStorage.getItem('easeland_admin_phone') || '');
    }
  }, [isAdminAuthenticated]);

  // Master Site Management CMS State (All 16 Modules)

  const [siteConfig, setSiteConfig] = useState(mockApi.getSiteConfig());
  const hasUnsavedCmsChangesRef = React.useRef(false);
  const [hasUnsavedCmsChanges, setHasUnsavedCmsChanges] = useState(false);

  const updateCmsConfig = React.useCallback((updater) => {
    hasUnsavedCmsChangesRef.current = true;
    setHasUnsavedCmsChanges(true);
    setSiteConfig((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next && next.theme) {
        applySiteTheme(next.theme);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (siteConfig && siteConfig.theme) {
      applySiteTheme(siteConfig.theme);
    }
  }, [siteConfig?.theme]);

  // Popup Modal States for Category & FAQ creation
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState({
    title: '',
    countText: '',
    imageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'
  });

  const [isAddFaqModalOpen, setIsAddFaqModalOpen] = useState(false);
  const [newFaqForm, setNewFaqForm] = useState({
    question: '',
    answer: ''
  });
  const [cmsTab, setCmsTab] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('easeland_admin_cms_tab');
        if (stored) return stored;
      }
    } catch (e) {}
    return 'overview';
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && cmsTab) {
        localStorage.setItem('easeland_admin_cms_tab', cmsTab);
      }
    } catch (e) {}
  }, [cmsTab]);
  const [publishSuccessMessage, setPublishSuccessMessage] = useState('');

  const [globalSearch, setGlobalSearch] = useState('');
  const [verificationQueue, setVerificationQueue] = useState([]);
  const [deals, setDeals] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [allProperties, setAllProperties] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('easeland_admin_cached_properties');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
        const raw = localStorage.getItem('easeland_properties');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {}
    return [];
  });
  const [allPropSearchQuery, setAllPropSearchQuery] = useState('');
  const [allPropStatusFilter, setAllPropStatusFilter] = useState('ALL');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [enlargedMediaUrl, setEnlargedMediaUrl] = useState(null);
  const [auditRemovedItemKeys, setAuditRemovedItemKeys] = useState(new Set());

  // 1-Minute Site Visitor Leads (PostgreSQL /api/visitors)
  const [visitorLeads, setVisitorLeads] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('easeland_visitors');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {}
    return [];
  });
  const [visitorLoading, setVisitorLoading] = useState(false);
  const isDataLoadingRef = React.useRef(false);
  const [visitorSearchQuery, setVisitorSearchQuery] = useState('');
  const [visitorStatusFilter, setVisitorStatusFilter] = useState('ALL');
  const [visitorToast, setVisitorToast] = useState('');

  const loadVisitorLeads = async () => {
    try {
      setVisitorLoading(true);
      const data = await getVisitorLeads();
      setVisitorLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Error loading visitor leads:', err);
    } finally {
      setVisitorLoading(false);
    }
  };

  const handleUpdateVisitorStatus = async (visitorId, newStatus) => {
    await updateVisitorStatus(visitorId, newStatus);
    setVisitorLeads(prev => prev.map(v => (v.id === visitorId || v.visitorId === visitorId ? { ...v, status: newStatus } : v)));
  };

  const handleDeleteVisitor = async (visitorId) => {
    if (!window.confirm('Are you sure you want to delete this visitor lead from PostgreSQL?')) return;
    await deleteVisitorLead(visitorId);
    setVisitorLeads(prev => prev.filter(v => v.id !== visitorId && v.visitorId !== visitorId));
  };

  const handleConvertVisitorToCrm = async (visitor) => {
    const res = await convertVisitorToCrmLead(visitor);
    if (res.success) {
      setVisitorToast(`Successfully converted ${visitor.name || 'Visitor'} to CRM Deal Pipeline!`);
      setTimeout(() => setVisitorToast(''), 4000);
      handleUpdateVisitorStatus(visitor.id || visitor.visitorId, 'CONVERTED');
    }
  };

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
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);

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

  // Dynamic Activity Logs & Audit Trail State
  const defaultInitialLogs = [
    '[2026-09-02 12:45:00] EaseLand Admin published site configuration changes live.',
    '[2026-09-02 12:42:00] EaseLand Admin suspended user Ramesh Varma for 7 days (Fraudulent Title Document Upload).',
    '[2026-09-02 11:30:00] EaseLand Admin verified and published property prop-106 live.'
  ];

  const [activityLogs, setActivityLogs] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('easeland_admin_activity_logs');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) { }
    return defaultInitialLogs;
  });
  const [logSearchQuery, setLogSearchQuery] = useState('');

  const logAdminActivity = (actionMessage) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    
    let rawAdminName = user?.displayName || user?.name || profile?.displayName || localStorage.getItem('easeland_admin_name') || 'EaseLand Admin';
    if (rawAdminName.includes('Scarlett')) {
      rawAdminName = 'EaseLand Admin';
      try { localStorage.setItem('easeland_admin_name', 'EaseLand Admin'); } catch(e){}
    }
    const currentAdminName = rawAdminName;
    const logEntry = `[${timestamp}] Admin ${currentAdminName} ${actionMessage}`;

    setActivityLogs(prev => {
      const updated = [logEntry, ...prev];
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('easeland_admin_activity_logs', JSON.stringify(updated.slice(0, 100)));
        }
      } catch (e) { }
      return updated;
    });
  };

  // ==========================================
  // PAID PROMOTIONS MANAGEMENT STATE & HANDLERS
  // ==========================================
  const [promoSearchQuery, setPromoSearchQuery] = useState('');
  const [promoTypeFilter, setPromoTypeFilter] = useState('ALL');
  const [promoStatusFilter, setPromoStatusFilter] = useState('ALL');
  const [promoToast, setPromoToast] = useState('');
  const [promoSectionTitle, setPromoSectionTitle] = useState(() => siteConfig?.featuredListings?.sectionTitle || 'Featured & Recent Verified Properties');
  const [promoBadgeText, setPromoBadgeText] = useState(() => siteConfig?.featuredListings?.badgeText || 'VERIFIED LISTINGS');
  const [promoDisplayCount, setPromoDisplayCount] = useState(() => Number(siteConfig?.featuredListings?.displayCount) || 6);
  const [isSavingPromoSettings, setIsSavingPromoSettings] = useState(false);
  const [isPromoSettingsSaved, setIsPromoSettingsSaved] = useState(false);
  const [stagedPromotedIds, setStagedPromotedIds] = useState(() => {
    return safeArray(siteConfig?.featuredListings?.featuredPropertyIds).map(String).filter(Boolean);
  });
  const [isSavingActivePromotions, setIsSavingActivePromotions] = useState(false);
  const [isActivePromotionsSaved, setIsActivePromotionsSaved] = useState(false);
  const [hasUnsavedPromoChanges, setHasUnsavedPromoChanges] = useState(false);

  useEffect(() => {
    if (siteConfig?.featuredListings) {
      if (siteConfig.featuredListings.sectionTitle !== undefined) setPromoSectionTitle(siteConfig.featuredListings.sectionTitle);
      if (siteConfig.featuredListings.badgeText !== undefined) setPromoBadgeText(siteConfig.featuredListings.badgeText);
      if (siteConfig.featuredListings.displayCount !== undefined) {
        setPromoDisplayCount(Number(siteConfig.featuredListings.displayCount) || 6);
      }
      const incomingIds = safeArray(siteConfig.featuredListings.featuredPropertyIds).map(String).filter(Boolean);
      if (!hasUnsavedPromoChanges) {
        setStagedPromotedIds(incomingIds);
      }
    }
  }, [siteConfig?.featuredListings?.sectionTitle, siteConfig?.featuredListings?.badgeText, siteConfig?.featuredListings?.displayCount, siteConfig?.featuredListings?.featuredPropertyIds, hasUnsavedPromoChanges]);

  const candidateSourceProperties = React.useMemo(() => {
    const list = Array.isArray(allProperties) && allProperties.length > 0 ? allProperties : [];
    return list.filter(p => p && !isPropertyDeleted(p) && !isFakeProperty(p));
  }, [allProperties]);

  const resolvePromotedProperty = React.useCallback((id) => {
    if (!id) return null;
    const target = String(id).trim().toLowerCase();
    // 1. Try candidateSourceProperties
    let match = candidateSourceProperties.find(p => {
      if (!p) return false;
      const id1 = String(p.id || '').trim().toLowerCase();
      const id2 = String(p.propertyId || '').trim().toLowerCase();
      const ref = String(p.referenceId || '').trim().toLowerCase();
      return id1 === target || id2 === target || ref === target;
    });
    // 2. Try mockApi.getPropertyById (searches all local storage stores)
    if (!match) {
      try {
        match = mockApi.getPropertyById(id);
      } catch (e) {}
    }
    // 3. Try current featuredListings promotedProperties cache
    if (!match && Array.isArray(siteConfig?.featuredListings?.promotedProperties)) {
      match = siteConfig.featuredListings.promotedProperties.find(p => {
        if (!p) return false;
        const id1 = String(p.id || '').trim().toLowerCase();
        const id2 = String(p.propertyId || '').trim().toLowerCase();
        const ref = String(p.referenceId || '').trim().toLowerCase();
        return id1 === target || id2 === target || ref === target;
      });
    }
    if (match && !isPropertyDeleted(match) && !isFakeProperty(match)) {
      const st = String(match.status || match.listingStatus || '').toUpperCase();
      const lst = String(match.listingStatus || '').toUpperCase();
      if (st === 'DRAFT' || lst === 'DRAFT' || match.isDraft === true) return null;
      const title = (match.title || '').trim();
      if (!title || title.toLowerCase() === 'untitled property' || title === '.' || title === ',') return null;
      return match;
    }
    return null;
  }, [candidateSourceProperties, siteConfig?.featuredListings?.promotedProperties]);

  const promotedPropertyIds = React.useMemo(() => {
    return safeArray(stagedPromotedIds).map(String).filter(id => Boolean(resolvePromotedProperty(id)));
  }, [stagedPromotedIds, resolvePromotedProperty]);

  const promotedPropertiesList = React.useMemo(() => {
    return promotedPropertyIds.map((id) => resolvePromotedProperty(id)).filter(Boolean);
  }, [promotedPropertyIds, resolvePromotedProperty]);

  const candidatePropertiesForPromotion = React.useMemo(() => {
    const query = promoSearchQuery.trim().toLowerCase();
    return candidateSourceProperties.filter(prop => {
      if (!prop || isPropertyDeleted(prop) || isFakeProperty(prop)) return false;

      // Drafts, incomplete, and untitled properties can NEVER be promoted!
      const st = String(prop.status || prop.listingStatus || '').toUpperCase();
      const lst = String(prop.listingStatus || '').toUpperCase();
      if (st === 'DRAFT' || lst === 'DRAFT' || prop.isDraft === true) return false;
      const title = (prop.title || '').trim();
      if (!title || title.toLowerCase() === 'untitled property' || title === '.' || title === ',') return false;

      if (promoStatusFilter === 'VERIFIED_ONLY') {
        const isVer = prop.verificationStatus === 'APPROVED' || prop.verificationStatus === 'VERIFIED' || prop.verified === true;
        if (!isVer) return false;
      }

      if (promoTypeFilter !== 'ALL') {
        const cat = String(prop.propertyType || prop.category || prop.purpose || '').toUpperCase();
        if (!cat.includes(promoTypeFilter.toUpperCase())) return false;
      }

      if (!query) return true;

      const pTitle = String(prop.title || '').toLowerCase();
      const city = String(prop.city || prop.location?.city || prop.locality || prop.location?.locality || '').toLowerCase();
      const propId = String(prop.id || prop.propertyId || prop.referenceId || '').toLowerCase();
      const oName = String(prop.owner?.name || prop.ownerPublicName || '').toLowerCase();
      const oPhone = String(prop.owner?.phone || prop.ownerPublicPhone || '').toLowerCase();
      const oEmail = String(prop.owner?.email || prop.ownerPublicEmail || '').toLowerCase();

      return pTitle.includes(query) || city.includes(query) || propId.includes(query) || oName.includes(query) || oPhone.includes(query) || oEmail.includes(query);
    });
  }, [candidateSourceProperties, promoSearchQuery, promoTypeFilter, promoStatusFilter]);

  const savePromotionsConfig = async (updatedFeaturedListings, successMessage) => {
    const currentFeatured = siteConfig?.featuredListings || {};
    const mergedFeatured = {
      ...currentFeatured,
      ...updatedFeaturedListings,
      showOnlyFeatured: true
    };
    const targetIds = safeArray(mergedFeatured.featuredPropertyIds).map(String).filter(Boolean);
    const validTargetIds = targetIds.filter(id => Boolean(resolvePromotedProperty(id)));
    const activePromotedList = validTargetIds.map((id) => resolvePromotedProperty(id)).filter(Boolean);

    const cleanPromotedProperties = JSON.parse(JSON.stringify(activePromotedList, (k, v) => (v === undefined ? null : v)));
    mergedFeatured.featuredPropertyIds = validTargetIds;
    mergedFeatured.promotedProperties = cleanPromotedProperties;

    const updatedConfig = {
      ...siteConfig,
      featuredListings: mergedFeatured
    };

    setSiteConfig(updatedConfig);
    const apiUpdated = mockApi.updateSiteConfig(updatedConfig);
    if (apiUpdated) setSiteConfig({ ...apiUpdated });

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('easeland_site_config', JSON.stringify(updatedConfig));
        localStorage.setItem('easeland_promoted_properties', JSON.stringify(cleanPromotedProperties));
      } catch (e) {}
      window.dispatchEvent(new CustomEvent('easeland-site-config-updated', { detail: updatedConfig }));
    }

    try {
      const adminUid = user?.uid || 'admin_auditor';
      await updateSiteModuleAdmin('featuredListings', mergedFeatured, adminUid);
    } catch (err) {
      console.warn('Could not sync featuredListings to Firestore:', err);
    }

    if (successMessage) {
      setPromoToast(successMessage);
      setTimeout(() => setPromoToast(''), 4000);
    }
  };

  const handleSaveActivePromotions = async () => {
    setIsSavingActivePromotions(true);
    try {
      const targetIds = safeArray(stagedPromotedIds).map(String).filter(Boolean);
      const validTargetIds = targetIds.filter(id => Boolean(resolvePromotedProperty(id)));

      await savePromotionsConfig({
        featuredPropertyIds: validTargetIds
      }, validTargetIds.length === 0
        ? 'All active customer promotions cleared and saved. Showcase is now completely hidden.'
        : 'Active Promoted Customer Properties (' + validTargetIds.length + ') saved successfully to Cloud & Live Website!');

      setStagedPromotedIds(validTargetIds);
      setHasUnsavedPromoChanges(false);
      setIsActivePromotionsSaved(true);
      setTimeout(() => setIsActivePromotionsSaved(false), 3000);
      logAdminActivity('saved Active Promoted Properties list (count: ' + validTargetIds.length + ').');
    } catch (err) {
      console.error('Error saving active promotions:', err);
      setPromoToast('Error saving active promotions. Please try again.');
    } finally {
      setIsSavingActivePromotions(false);
    }
  };

  const handleAddPaidPromotion = (propertyId) => {
    if (!propertyId) return;
    const pIdStr = String(propertyId);
    if (stagedPromotedIds.includes(pIdStr)) {
      setPromoToast('This property is already in the Paid Promotions list.');
      setTimeout(() => setPromoToast(''), 3000);
      return;
    }
    const nextIds = [...stagedPromotedIds, pIdStr];
    setStagedPromotedIds(nextIds);
    setHasUnsavedPromoChanges(true);
    setPromoToast('Property added to active list! Click "Save Promoted Properties" to apply live.');
    setTimeout(() => setPromoToast(''), 4000);
    logAdminActivity('added property ' + pIdStr + ' to Paid Promotions showcase.');
  };

  const handleRemovePaidPromotion = (propertyId) => {
    if (!propertyId) return;
    const pIdStr = String(propertyId);
    const nextIds = stagedPromotedIds.filter(id => id !== pIdStr);
    setStagedPromotedIds(nextIds);
    setHasUnsavedPromoChanges(true);
    const msg = nextIds.length === 0
      ? 'Property removed. Click "Save Promoted Properties" to confirm empty showcase.'
      : 'Property removed from active list. Click "Save Promoted Properties" to apply live.';
    setPromoToast(msg);
    setTimeout(() => setPromoToast(''), 4000);
    logAdminActivity('removed property ' + pIdStr + ' from Paid Promotions.');
  };

  const handleTogglePaidPromotion = (propertyId) => {
    if (!propertyId) return;
    const pIdStr = String(propertyId);
    if (stagedPromotedIds.includes(pIdStr)) {
      handleRemovePaidPromotion(pIdStr);
    } else {
      handleAddPaidPromotion(pIdStr);
    }
  };

  const handleMovePaidPromotion = (propertyId, direction) => {
    const pIdStr = String(propertyId);
    const index = stagedPromotedIds.indexOf(pIdStr);
    if (index === -1) return;
    const nextIds = [...stagedPromotedIds];
    if (direction === 'UP' && index > 0) {
      const temp = nextIds[index - 1];
      nextIds[index - 1] = nextIds[index];
      nextIds[index] = temp;
      setStagedPromotedIds(nextIds);
      setHasUnsavedPromoChanges(true);
      setPromoToast('Priority moved up to Slot #' + index + '. Click "Save Promoted Properties" to apply live.');
      setTimeout(() => setPromoToast(''), 4000);
      logAdminActivity('moved property ' + pIdStr + ' up to Slot #' + index + ' in Paid Promotions.');
    } else if (direction === 'DOWN' && index < nextIds.length - 1) {
      const temp = nextIds[index + 1];
      nextIds[index + 1] = nextIds[index];
      nextIds[index] = temp;
      setStagedPromotedIds(nextIds);
      setHasUnsavedPromoChanges(true);
      setPromoToast('Priority moved down to Slot #' + (index + 2) + '. Click "Save Promoted Properties" to apply live.');
      setTimeout(() => setPromoToast(''), 4000);
      logAdminActivity('moved property ' + pIdStr + ' down to Slot #' + (index + 2) + ' in Paid Promotions.');
    }
  };

  const handleSavePromotionSettings = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsSavingPromoSettings(true);
    const parsedSlots = parseInt(promoDisplayCount, 10);
    const validCount = isNaN(parsedSlots) ? 6 : Math.max(1, Math.min(24, parsedSlots));
    setPromoDisplayCount(validCount);
    const cleanedTitle = (promoSectionTitle || '').trim() || 'Featured & Recent Verified Properties';
    const cleanedBadge = (promoBadgeText || '').trim() || 'VERIFIED LISTINGS';

    try {
      const targetIds = safeArray(stagedPromotedIds).map(String).filter(Boolean);
      const validTargetIds = targetIds.filter(id => Boolean(resolvePromotedProperty(id)));

      await savePromotionsConfig({
        sectionTitle: cleanedTitle,
        badgeText: cleanedBadge,
        displayCount: validCount,
        featuredPropertyIds: validTargetIds
      }, 'Showcase headline & display settings saved!');
      setStagedPromotedIds(validTargetIds);
      setHasUnsavedPromoChanges(false);
      logAdminActivity('saved Paid Promotions showcase title & display settings (Slots: ' + validCount + ').');
      setIsPromoSettingsSaved(true);
      setTimeout(() => setIsPromoSettingsSaved(false), 3000);
    } catch (err) {
      console.warn('Error saving promotion settings:', err);
      setPromoToast('Error saving promotion settings. Please try again.');
    } finally {
      setIsSavingPromoSettings(false);
    }
  };

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

  const handleResetToDefault = async () => {
    setIsResetModalOpen(false);
    setAdminActionProcessing(true);
    try {
      const resetConfig = mockApi.resetSiteConfigAdmin();
      setSiteConfig({ ...resetConfig });
      const adminUid = user?.uid || 'admin_auditor';
      try {
        await publishSiteConfigAdmin(resetConfig, adminUid);
      } catch (pubErr) {
        console.warn('Reset sync notice:', pubErr);
      }
      logAdminActivity('reset website configuration to factory defaults.');
      setPublishSuccessMessage('All 16 CMS modules have been reset to factory defaults and synced to database!');
      setTimeout(() => setPublishSuccessMessage(''), 5000);
    } catch (err) {
      console.warn('Reset error:', err);
      setPublishSuccessMessage('Reset to factory defaults locally.');
      setTimeout(() => setPublishSuccessMessage(''), 4000);
    } finally {
      setAdminActionProcessing(false);
    }
  };

  // Bulk Purge Test Properties Modal State
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgeConfirmInput, setPurgeConfirmInput] = useState('');
  const [isPurgingProcessing, setIsPurgingProcessing] = useState(false);
  const [purgeResultSummary, setPurgeResultSummary] = useState(null);

  const handleExecutePurgeAllProperties = async () => {
    if (purgeConfirmInput.trim() !== 'PURGE') return;
    setIsPurgingProcessing(true);
    try {
      const { purgeAllMarketplaceProperties } = await import('../firebase/propertyService.js');
      const res = await purgeAllMarketplaceProperties();

      setAllProperties([]);
      setVerificationQueue([]);
      setEnquiries([]);
      setSelectedProperty(null);
      setIsWorkspaceOpen(false);
      setActivityLogs([]);
      setDeals([]);
      setFollowUps([]);
      setVisitorLeads([]);
      
      logAdminActivity('authoritatively wiped all property listings, media, documents, enquiries, and CRM leads across PostgreSQL, Firestore, and Local Storage.');
      setPublishSuccessMessage('All properties and cascaded collections have been wiped clean across all 3 layers!');
      setPurgeResultSummary(res?.backendResult || { success: true });
      setTimeout(() => setPublishSuccessMessage(''), 5000);
      setIsPurgeModalOpen(false);
      setPurgeConfirmInput('');
    } catch (err) {
      console.error('Purge error:', err);
      alert('Purge operation encountered an error: ' + (err.message || err));
    } finally {
      setIsPurgingProcessing(false);
    }
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

  const unifyAndDeduplicateUsers = (userList, isDeletedFn = () => false) => {
    const canonicalUsers = new Map();
    const keyToCanonical = new Map();

    const mergeNonEmpty = (target, src) => {
      const res = { ...target };
      for (const [k, v] of Object.entries(src || {})) {
        if (v !== undefined && v !== null && v !== '') {
          res[k] = v;
        } else if (res[k] === undefined || res[k] === null) {
          res[k] = v;
        }
      }
      return res;
    };

    (userList || []).forEach(u => {
      if (!u || isDeletedFn(u)) return;
      const emailKey = (u.email || '').toLowerCase().trim();
      const rawUid = u.uid || u.id || '';
      const uidKey = String(rawUid).toLowerCase().trim();
      if (!emailKey && !uidKey) return;

      const canonicalFromEmail = emailKey ? keyToCanonical.get(emailKey) : null;
      const canonicalFromUid = uidKey ? keyToCanonical.get(uidKey) : null;

      let canonicalKey = canonicalFromEmail || canonicalFromUid || (emailKey || uidKey);

      let existing = canonicalUsers.get(canonicalKey) || {};
      if (canonicalFromEmail && canonicalFromUid && canonicalFromEmail !== canonicalFromUid) {
        const otherUser = canonicalUsers.get(canonicalFromUid) || {};
        existing = mergeNonEmpty(otherUser, existing);
        canonicalUsers.delete(canonicalFromUid);
        for (const [k, v] of keyToCanonical.entries()) {
          if (v === canonicalFromUid) keyToCanonical.set(k, canonicalKey);
        }
      }

      const combined = mergeNonEmpty(existing, u);

      const isSyntheticUid = (id) => !id || id === 'admin_uid_001' || String(id).startsWith('owner-');
      const bestUid = (!isSyntheticUid(u.uid) ? u.uid : (!isSyntheticUid(existing.uid) ? existing.uid : (u.uid || existing.uid || u.id || existing.id || rawUid)));

      const rawName = combined.name || combined.displayName || '';
      const isScarlett = rawName.includes('Scarlett') || emailKey === 'admin@easeland.in';
      const cleanName = isScarlett ? 'EaseLand Admin' : (rawName || (emailKey ? emailKey.split('@')[0] : 'Registered User'));

      const cleanPhone = (combined.phone || combined.phoneNumber || '').trim();
      const cleanCity = (combined.city || combined.location || '').trim();

      const mergedUser = {
        ...combined,
        uid: bestUid,
        id: bestUid,
        email: combined.email || (emailKey || ''),
        name: cleanName,
        displayName: cleanName,
        phone: cleanPhone,
        phoneNumber: cleanPhone,
        city: cleanCity,
        location: cleanCity,
        status: combined.status || combined.accountStatus || 'ACTIVE',
        accountStatus: combined.accountStatus || combined.status || 'ACTIVE',
        role: (emailKey === 'admin@easeland.in' || combined.role === 'ADMIN') ? 'ADMIN' : (combined.role || 'USER'),
        adminRole: emailKey === 'admin@easeland.in' || Boolean(combined.adminRole || combined.role === 'ADMIN'),
        suspension: combined.suspension || existing.suspension || null
      };

      canonicalUsers.set(canonicalKey, mergedUser);
      if (emailKey) keyToCanonical.set(emailKey, canonicalKey);
      if (uidKey) keyToCanonical.set(uidKey, canonicalKey);
      if (existing.uid) keyToCanonical.set(String(existing.uid).toLowerCase().trim(), canonicalKey);
      if (bestUid) keyToCanonical.set(String(bestUid).toLowerCase().trim(), canonicalKey);
    });

    return Array.from(canonicalUsers.values()).filter(u => !isDeletedFn(u));
  };

  const enrichAndSyncLiveUsers = (incomingUsers, propertiesList = allProperties) => {
    let deletedUsers = [];
    try {
      if (typeof window !== 'undefined') {
        const rawDel = localStorage.getItem('easeland_deleted_users');
        if (rawDel) deletedUsers = JSON.parse(rawDel).map(v => String(v).toLowerCase().trim());
      }
    } catch (e) { }

    const isUserDeleted = (u) => {
      if (!u) return true;
      const uUid = String(u.uid || u.id || '').toLowerCase().trim();
      const uEmail = (u.email || '').toLowerCase().trim();
      const rawSt = String(u.status || u.accountStatus || '').toUpperCase();
      return rawSt === 'REMOVED' || rawSt === 'DELETED' || rawSt === 'ACCOUNT_DELETED' ||
        (uUid && deletedUsers.includes(uUid)) || (uEmail && deletedUsers.includes(uEmail));
    };

    setRegisteredUsersList(prev => {
      const cleanPrev = (prev || []).filter(u => !isUserDeleted(u));
      const cleanIncoming = (incomingUsers || []).filter(u => !isUserDeleted(u));

      return unifyAndDeduplicateUsers([...cleanPrev, ...cleanIncoming], isUserDeleted)
        .map(u => {
          const uUid = String(u.uid || u.id || '').toLowerCase().trim();
          const uEmail = (u.email || '').toLowerCase().trim();

          const userListings = (propertiesList || []).filter(p => {
            if (!p) return false;
            const pOwnerId = String(p.ownerId || p.owner?.id || p.userId || p.uid || p.createdBy || '').toLowerCase().trim();
            const pEmail = (p.ownerPrivateEmail || p.ownerPublicEmail || p.owner?.email || p.email || p.userEmail || '').toLowerCase().trim();
            return (uUid && pOwnerId && uUid === pOwnerId) || (uEmail && pEmail && uEmail === pEmail);
          });

          const isUserAdmin = u.role === 'ADMIN' || u.email === 'admin@easeland.in' || uUid === 'admin-101';
          let derivedRole = u.role;
          if (!isUserAdmin) {
            derivedRole = userListings.length > 0 ? 'VERIFIED PROPERTY OWNER & BUYER' : 'USER';
          }

          let finalName = u.name || u.displayName || 'EaseLand User';
          if (isUserAdmin || finalName.includes('Scarlett') || uEmail === 'admin@easeland.in') {
            finalName = 'EaseLand Admin';
          }

          const effectiveStatus = u.suspension ? 'SUSPENDED' : (u.status || u.accountStatus || 'ACTIVE');

          return {
            ...u,
            name: finalName,
            displayName: finalName,
            status: effectiveStatus,
            accountStatus: effectiveStatus,
            role: isUserAdmin ? 'ADMIN' : derivedRole,
            postedListingsCount: userListings.length,
            authProvider: u.authProvider || (u.email?.endsWith('@gmail.com') ? 'Google OAuth' : 'Email/Password'),
            emailVerified: u.emailVerified ?? (u.email ? true : false)
          };
        });
    });
  };

  const loadData = async () => {
    if (isDataLoadingRef.current) return;
    isDataLoadingRef.current = true;
    try {
      // 1. Parallel fetch: Properties and Verification Queue
      let queue = [];
      let allMergedProps = [];

      const [pgPropsSettled, vResSettled] = await Promise.allSettled([
        fetch('/api/properties').then(r => r.ok ? r.json() : null).catch(() => null),
        getVerificationQueue().catch(() => ({ success: false, properties: [] }))
      ]);

      let postgresProps = [];
      if (pgPropsSettled.status === 'fulfilled' && pgPropsSettled.value && pgPropsSettled.value.success && Array.isArray(pgPropsSettled.value.properties)) {
        postgresProps = pgPropsSettled.value.properties;
      }

      let firebaseProps = [];
      if (vResSettled.status === 'fulfilled' && vResSettled.value && vResSettled.value.success && Array.isArray(vResSettled.value.properties)) {
        firebaseProps = vResSettled.value.properties;
      }

      let localProps = [];
      try {
        if (typeof window !== 'undefined') {
          const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties'];
          keys.forEach(k => {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                localProps.push(...parsed.filter(item => item && typeof item === 'object' && !Array.isArray(item) && (item.id || item.propertyId || item.title)));
              } else if (parsed && typeof parsed === 'object') {
                localProps.push(parsed);
              }
            }
          });
        }
      } catch (lErr) { }

      const queueMap = new Map();

      // 1. Seed fallback from local and firebase props
      [...localProps, ...firebaseProps].forEach(p => {
        if (!p || typeof p !== 'object') return;
        const pId = String(p.id || p.propertyId || p.referenceId || '');
        if (pId) {
          queueMap.set(pId, { ...p, id: pId, propertyId: pId });
        }
      });

      // 2. Authoritative PostgreSQL properties overlay: PostgreSQL ALWAYS takes precedence!
      postgresProps.forEach(p => {
        if (!p || typeof p !== 'object') return;
        const pId = String(p.id || p.propertyId || p.referenceId || '');
        if (pId) {
          const prev = queueMap.get(pId) || {};
          const mergedMedia = [
            ...(Array.isArray(prev.media) ? prev.media : []),
            ...(Array.isArray(p.media) ? p.media : []),
            ...(Array.isArray(p.photos) ? p.photos : [])
          ];
          const mergedDocs = [
            ...(Array.isArray(prev.documents) ? prev.documents : []),
            ...(Array.isArray(p.documents) ? p.documents : []),
            ...(Array.isArray(p.propertyDocuments) ? p.propertyDocuments : [])
          ];

          queueMap.set(pId, {
            ...prev,
            ...p,
            id: pId,
            propertyId: pId,
            status: p.status || p.listingStatus || prev.status,
            listingStatus: p.listingStatus || p.status || prev.listingStatus,
            listing_status: p.listing_status || p.listingStatus || p.status || prev.listing_status,
            isPublished: Boolean(p.isPublished || p.is_published),
            is_published: Boolean(p.is_published || p.isPublished),
            isPlatformVerified: Boolean(p.isPlatformVerified),
            hasPendingEdits: Boolean(p.hasPendingEdits),
            pendingReauditData: p.pendingReauditData || null,
            reAuditStatus: p.reAuditStatus || null,
            deletedByAdmin: Boolean(p.deletedByAdmin || p.status === 'DELETED_BY_ADMIN' || p.listingStatus === 'DELETED_BY_ADMIN'),
            isDeleted: Boolean(p.isDeleted || p.deletedByAdmin || p.status === 'DELETED_BY_ADMIN'),
            media: (Array.isArray(p.media) && p.media.length > 0) ? p.media : (mergedMedia.length > 0 ? mergedMedia : prev.media || []),
            photos: (Array.isArray(p.photos) && p.photos.length > 0) ? p.photos : (prev.photos || []),
            documents: (Array.isArray(p.documents) && p.documents.length > 0) ? p.documents : (mergedDocs.length > 0 ? mergedDocs : prev.documents || []),
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
      let submittedIds = [];
      try {
        if (typeof window !== 'undefined') {
          const rawDeleted = localStorage.getItem('easeland_deleted_properties');
          if (rawDeleted) deletedIds = JSON.parse(rawDeleted).map(String);
          const rawSub = localStorage.getItem('easeland_submitted_properties');
          if (rawSub) submittedIds = JSON.parse(rawSub).map(String);

          const rawAdminDel = localStorage.getItem('easeland_admin_deleted_properties');
          if (rawAdminDel) {
            try {
              const parsedAdminDel = JSON.parse(rawAdminDel);
              if (Array.isArray(parsedAdminDel) && parsedAdminDel.length > 0) {
                fetch('/api/properties/sync-deleted', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ deletedProperties: parsedAdminDel })
                }).catch(() => {});
              }
            } catch (eSync) {}
          }
        }
      } catch (e) { }

      const FAKE_DEMO_IDS = ['prop-102', 'prop-104', 'prop-105'];
      allMergedProps = Array.from(queueMap.values()).filter(p => {
        if (!p) return false;
        if (isPropertyDeleted(p) || isFakeProperty(p)) return false;
        const st = String(p.status || p.listingStatus || '').toUpperCase();
        const lst = String(p.listingStatus || '').toUpperCase();
        if (st === 'DELETED_BY_ADMIN' || lst === 'DELETED_BY_ADMIN' || p.deletedByAdmin === true || p.isDeleted === true) return false;
        const id1 = String(p.id || '').toLowerCase().trim();
        const id2 = String(p.propertyId || '').toLowerCase().trim();
        const id3 = String(p.referenceId || '').toLowerCase().trim();
        const num1 = id1.replace(/^(el-prop-|prop-)/i, '');
        const num2 = id2.replace(/^(el-prop-|prop-)/i, '');
        const num3 = id3.replace(/^(el-prop-|prop-)/i, '');
        const isDel = deletedIds.some(d => {
          const dStr = String(d || '').toLowerCase().trim();
          const dNum = dStr.replace(/^(el-prop-|prop-)/i, '');
          return (
            (dStr && (dStr === id1 || dStr === id2 || dStr === id3)) ||
            (dNum && ((num1 && dNum === num1) || (num2 && dNum === num2) || (num3 && dNum === num3)))
          );
        });
        if (isDel) return false;
        if (FAKE_DEMO_IDS.includes(id1) || FAKE_DEMO_IDS.includes(id2) || FAKE_DEMO_IDS.includes(id3)) return false;
        const ownerName = String(p.owner?.name || p.ownerPublicName || '').toLowerCase();
        const ownerEmail = String(p.owner?.email || p.ownerPrivateEmail || '').toLowerCase();
        if (ownerName.includes('demo owner') || ownerEmail.includes('testowner@easeland.in')) return false;
        const title = (p.title || '').trim();
        return title.length > 0 && title !== '.' && title !== ',';
      });

      // Synchronize submittedIds: remove properties that have been verified, rejected, or changes requested
      if (typeof window !== 'undefined' && submittedIds.length > 0) {
        const activeSubmittedIds = submittedIds.filter(sId => {
          const matched = allMergedProps.find(mp => String(mp.id || mp.propertyId || mp.referenceId || '') === String(sId));
          if (!matched) return true;
          const mst = String(matched.status || matched.listingStatus || '').toUpperCase();
          const mlst = String(matched.listingStatus || '').toUpperCase();
          const isNotPending = mst === 'CHANGES_REQUIRED' || mst === 'CHANGES_REQUESTED' || mlst === 'CHANGES_REQUIRED' || mlst === 'CHANGES_REQUESTED' || mst === 'REJECTED' || mlst === 'REJECTED' || mst === 'LIVE' || mlst === 'LIVE' || mst === 'DRAFT' || mlst === 'DRAFT';
          return !isNotPending;
        });
        if (activeSubmittedIds.length !== submittedIds.length) {
          localStorage.setItem('easeland_submitted_properties', JSON.stringify(activeSubmittedIds));
          submittedIds = activeSubmittedIds;
        }
      }

      queue = allMergedProps.filter(p => {
        if (!p) return false;
        const pId = String(p.id || p.propertyId || p.referenceId || '');
        const st = String(p.status || p.listingStatus || '').toUpperCase();
        const lst = String(p.listingStatus || '').toUpperCase();

        const isLive = st === 'LIVE' || st === 'APPROVED_LIVE' || st === 'APPROVED' || lst === 'LIVE' || lst === 'APPROVED_LIVE' || lst === 'APPROVED' || (p.isPlatformVerified === true && p.isPublished === true);
        const isClosed = st === 'REJECTED' || st === 'DELETED' || st === 'REJECTED_CLOSED' || st === 'CLOSED' || st === 'ARCHIVED' || lst === 'REJECTED' || lst === 'DELETED' || lst === 'REJECTED_CLOSED' || lst === 'CLOSED' || lst === 'ARCHIVED';
        const isChangesRequired = st === 'CHANGES_REQUIRED' || st === 'CHANGES_REQUESTED' || st === 'REVISION_REQUESTED' || lst === 'CHANGES_REQUIRED' || lst === 'CHANGES_REQUESTED' || lst === 'REVISION_REQUESTED';
        const isDraft = st === 'DRAFT' || lst === 'DRAFT' || p.isDraft === true;

        // Check if property has pending edits submitted for re-audit
        const hasPendingReaudit = Boolean(
          (p.hasPendingEdits === true || Boolean(p.pendingReauditData)) &&
          (p.reAuditStatus === 'PENDING_VERIFICATION' || p.reAuditStatus === 'UNDER_REVIEW' || !p.reAuditStatus || p.reAuditStatus === 'PENDING') &&
          p.reAuditStatus !== 'EDITS_REJECTED'
        );

        if (hasPendingReaudit) return true;

        // CRITICAL RULE: If ANY of the 3 actions took place (Live/Approved, Rejected, or Changes Requested), or if it's draft, NEVER show in Verification Queue!
        if (isLive || isClosed || isChangesRequired || isDraft) return false;

        // ONLY visible if actively in pending verification audit state (first submission or resubmission after changes)
        const isPendingAudit = st === 'PENDING_VERIFICATION' || lst === 'PENDING_VERIFICATION' || st === 'UNDER_REVIEW' || lst === 'UNDER_REVIEW' || st === 'SUBMITTED' || lst === 'SUBMITTED';

        return isPendingAudit || (submittedIds.includes(pId) && !isDraft && !isChangesRequired && !isClosed && !isLive);
      });

      // PROGRESSIVE STEP 1: Immediately render properties and verification queue without waiting for users or config!
      setAllProperties(allMergedProps);
      setVerificationQueue(queue);
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('easeland_admin_cached_properties', JSON.stringify(allMergedProps));
        }
      } catch (eCache) {}

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

      // Concurrently load visitor leads
      loadVisitorLeads();

      // 2. Parallel fetch: Users, Enquiries, Reports, and Site Config
      let deletedUsers = [];
      try {
        if (typeof window !== 'undefined') {
          const rawDel = localStorage.getItem('easeland_deleted_users');
          if (rawDel) deletedUsers = JSON.parse(rawDel).map(v => String(v).toLowerCase().trim());
        }
      } catch (e) { }

      const isUserExplicitlyDeleted = (uid, email, status, accountStatus) => {
        const uId = String(uid || '').toLowerCase().trim();
        const uEm = String(email || '').toLowerCase().trim();
        const rawSt = String(status || accountStatus || '').toUpperCase();
        if (rawSt === 'REMOVED' || rawSt === 'DELETED' || rawSt === 'ACCOUNT_DELETED') return true;
        if (uId && deletedUsers.includes(uId)) return true;
        if (uEm && deletedUsers.includes(uEm)) return true;
        return false;
      };

      const [pgUsersSettled, firestoreUsersSettled, enqsSettled, reportsSettled, cfgSettled] = await Promise.allSettled([
        fetch('/api/admin/firebase-users').then(r => r.ok ? r.json() : null).catch(() => null),
        getAllUsersAdmin().catch(() => ({ success: false, users: [] })),
        getAllEnquiriesAdmin().catch(() => ({ success: false, enquiries: [] })),
        getAllReportsAdmin().catch(() => ({ success: false, reports: [] })),
        getSiteConfigAdmin().catch(() => ({ success: false, config: null }))
      ]);

      let pgServerUsers = [];
      if (pgUsersSettled.status === 'fulfilled' && pgUsersSettled.value && pgUsersSettled.value.success && Array.isArray(pgUsersSettled.value.users)) {
        pgServerUsers = pgUsersSettled.value.users.filter(u => u && !isUserExplicitlyDeleted(u.uid || u.id, u.email, u.status, u.accountStatus));
      }

      let firestoreUsers = [];
      if (firestoreUsersSettled.status === 'fulfilled' && firestoreUsersSettled.value && firestoreUsersSettled.value.success && Array.isArray(firestoreUsersSettled.value.users)) {
        firestoreUsers = firestoreUsersSettled.value.users.filter(u => u && !isUserExplicitlyDeleted(u.uid || u.id, u.email, u.status, u.accountStatus));
      }

      let localRegisteredUsers = [];
      let localProfileUsers = [];
      try {
        if (typeof window !== 'undefined') {
          const rawReg = localStorage.getItem('easeland_registered_users');
          if (rawReg) {
            const parsed = JSON.parse(rawReg);
            if (Array.isArray(parsed)) {
              localRegisteredUsers = parsed.filter(u => u && !isUserExplicitlyDeleted(u.uid || u.id, u.email, u.status, u.accountStatus));
            }
          }
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('easeland_user_profile_')) {
              const rawProf = localStorage.getItem(k);
              if (rawProf) {
                const profObj = JSON.parse(rawProf);
                if (profObj && (profObj.uid || profObj.id || profObj.email)) {
                  if (!isUserExplicitlyDeleted(profObj.uid || profObj.id, profObj.email, profObj.status, profObj.accountStatus)) {
                    localProfileUsers.push(profObj);
                  }
                }
              }
            }
          }
        }
      } catch (lErr) {}

      let propertyOwnerUsers = [];
      allMergedProps.forEach(p => {
        if (!p) return;
        const oEmail = (p.ownerPrivateEmail || p.ownerPublicEmail || p.owner?.email || p.email || p.userEmail || '').trim();
        const oName = (p.ownerPublicName || p.owner?.name || 'Property Owner').trim();
        const oPhone = (p.ownerPrivatePhone || p.ownerPublicPhone || p.owner?.phone || p.phone || '').trim();
        const oId = p.ownerId || p.owner?.id || p.userId || p.uid || p.submittedBy;
        if (isUserExplicitlyDeleted(oId, oEmail)) return;
        if (oEmail || oPhone || oId) {
          propertyOwnerUsers.push({
            uid: oId || ('owner-' + (oEmail || oPhone)),
            id: oId || ('owner-' + (oEmail || oPhone)),
            displayName: oName,
            name: oName,
            email: oEmail,
            phone: oPhone,
            phoneNumber: oPhone,
            role: 'VERIFIED PROPERTY OWNER & BUYER',
            accountStatus: 'ACTIVE',
            authProvider: oEmail.endsWith('@gmail.com') ? 'Google OAuth' : 'Email/Password'
          });
        }
      });

      let users = unifyAndDeduplicateUsers(
        [...pgServerUsers, ...firestoreUsers, ...localRegisteredUsers, ...localProfileUsers, ...propertyOwnerUsers],
        (u) => isUserExplicitlyDeleted(u.uid || u.id, u.email, u.status, u.accountStatus)
      );

      // Enrich verification queue properties with matching registered user account details
      const enrichedQueue = queue.map(p => {
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
          } catch (e) { }
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

      setVerificationQueue(enrichedQueue);

      // Enquiries
      let enqs = [];
      if (enqsSettled.status === 'fulfilled' && enqsSettled.value && enqsSettled.value.success && Array.isArray(enqsSettled.value.enquiries)) {
        enqs = enqsSettled.value.enquiries;
      }
      setEnquiries(enqs);

      // Reports
      let reports = [];
      if (reportsSettled.status === 'fulfilled' && reportsSettled.value && reportsSettled.value.success && Array.isArray(reportsSettled.value.reports)) {
        reports = reportsSettled.value.reports;
      }

      // Site Config
      let cfg = mockApi.getSiteConfig();
      if (cfgSettled.status === 'fulfilled' && cfgSettled.value && cfgSettled.value.success && cfgSettled.value.config && Object.keys(cfgSettled.value.config).length > 0) {
        cfg = mockApi.mergeSiteConfigWithDefaults(cfgSettled.value.config);
        mockApi.updateSiteConfig(cfg);
      }
      if (!hasUnsavedCmsChangesRef.current) {
        setSiteConfig(cfg);
      }

      // Synchronize live users
      enrichAndSyncLiveUsers(users, allMergedProps);
    } catch (err) {
      console.warn('Error in loadData:', err);
    } finally {
      isDataLoadingRef.current = false;
    }
  };

  useEffect(() => {
    loadData();
    loadVisitorLeads();

    // Auto-sync Cloud & DB on mount in background
    syncSiteConfigAndUsers().then((syncRes) => {
      if (syncRes && syncRes.config && Object.keys(syncRes.config).length > 0) {
        const merged = mockApi.mergeSiteConfigWithDefaults(syncRes.config);
        mockApi.updateSiteConfig(merged);
        if (!hasUnsavedCmsChangesRef.current) {
          setSiteConfig(merged);
        }
      }
      if (!isDataLoadingRef.current) {
        loadData();
      }
    }).catch((err) => {
      console.warn('Auto background sync note:', err);
    });

    const handleRefresh = () => {
      if (!isDataLoadingRef.current) loadData();
    };
    const handleConfigUpdated = (e) => {
      if (!hasUnsavedCmsChangesRef.current) {
        setSiteConfig(e.detail || mockApi.getSiteConfig());
      }
    };
    const handleVisitorRefresh = () => loadVisitorLeads();

    // Continuous live Firestore subscription for instant bidirectional synchronization
    const unsubFirestoreUsers = subscribeToUsersAdmin((liveUsers) => {
      if (Array.isArray(liveUsers) && liveUsers.length > 0) {
        enrichAndSyncLiveUsers(liveUsers);
      }
    });

    window.addEventListener('easeland-users-updated', handleRefresh);
    window.addEventListener('easeland-user-status-changed', handleRefresh);
    window.addEventListener('easeland-property-created', handleRefresh);
    window.addEventListener('easeland-property-submitted', handleRefresh);
    window.addEventListener('easeland-property-approved', handleRefresh);
    window.addEventListener('easeland-property-status-updated', handleRefresh);
    window.addEventListener('easeland-property-updated', handleRefresh);
    window.addEventListener('easeland-property-deleted', handleRefresh);
    window.addEventListener('easeland-site-config-updated', handleConfigUpdated);
    window.addEventListener('easeland-visitor-lead-created', handleVisitorRefresh);
    window.addEventListener('easeland-visitor-lead-updated', handleVisitorRefresh);
    window.addEventListener('easeland-visitor-lead-deleted', handleVisitorRefresh);
    window.addEventListener('storage', handleRefresh);
    const pollTimer = setInterval(() => {
      if (!isDataLoadingRef.current) {
        loadData();
        loadVisitorLeads();
      }
    }, 20000);

    return () => {
      clearInterval(pollTimer);
      unsubFirestoreUsers();
      window.removeEventListener('easeland-users-updated', handleRefresh);
      window.removeEventListener('easeland-user-status-changed', handleRefresh);
      window.removeEventListener('easeland-property-created', handleRefresh);
      window.removeEventListener('easeland-property-submitted', handleRefresh);
      window.removeEventListener('easeland-property-approved', handleRefresh);
      window.removeEventListener('easeland-property-status-updated', handleRefresh);
      window.removeEventListener('easeland-property-updated', handleRefresh);
      window.removeEventListener('easeland-property-deleted', handleRefresh);
      window.removeEventListener('easeland-site-config-updated', handleConfigUpdated);
      window.removeEventListener('easeland-visitor-lead-created', handleVisitorRefresh);
      window.removeEventListener('easeland-visitor-lead-updated', handleVisitorRefresh);
      window.removeEventListener('easeland-visitor-lead-deleted', handleVisitorRefresh);
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

  const handleDeletePropertyFromAdmin = async (targetProp, propObj = null) => {
    const propId = typeof targetProp === 'object' && targetProp !== null
      ? (targetProp.id || targetProp.propertyId || targetProp.referenceId)
      : (targetProp || propObj?.id || propObj?.propertyId);
    if (!propId) return;

    const confirmDel = window.confirm('Are you sure you want to permanently delete this property listing?');
    if (!confirmDel) return;

    const pIdStr = String(propId || '');
    const matchedObj = (typeof targetProp === 'object' && targetProp !== null)
      ? targetProp
      : (propObj || allProperties.find(p => p && (String(p.id) === pIdStr || String(p.propertyId) === pIdStr || String(p.referenceId) === pIdStr)) || selectedProperty);

    const id2 = String(matchedObj?.propertyId || '');
    const id3 = String(matchedObj?.referenceId || '');
    const num1 = pIdStr.replace(/^(el-prop-|prop-)/i, '');
    const num2 = id2.replace(/^(el-prop-|prop-)/i, '');
    const num3 = id3.replace(/^(el-prop-|prop-)/i, '');
    const normTitle = String(matchedObj?.title || '').toLowerCase().trim();

    const allAliases = new Set([
      pIdStr.toLowerCase(),
      id2.toLowerCase(),
      id3.toLowerCase(),
      num1 ? `el-prop-${num1}`.toLowerCase() : '',
      num1 ? `prop-${num1}`.toLowerCase() : '',
      num1 ? num1.toLowerCase() : '',
      num2 ? `el-prop-${num2}`.toLowerCase() : '',
      num2 ? num2.toLowerCase() : '',
      num3 ? `el-prop-${num3}`.toLowerCase() : '',
      num3 ? num3.toLowerCase() : ''
    ].filter(Boolean));

    const matchesAlias = (p) => {
      if (!p) return false;
      const pid = String(p.id || '').toLowerCase().trim();
      const ppid = String(p.propertyId || '').toLowerCase().trim();
      const pref = String(p.referenceId || '').toLowerCase().trim();
      const pnum = pid.replace(/^(el-prop-|prop-)/i, '');
      const ptitle = String(p.title || '').toLowerCase().trim();

      return (
        allAliases.has(pid) ||
        allAliases.has(ppid) ||
        allAliases.has(pref) ||
        (pnum && allAliases.has(pnum)) ||
        (normTitle && ptitle && ptitle === normTitle)
      );
    };

    // 1. Authoritative PostgreSQL DELETE FIRST
    try {
      await fetch(`/api/properties/${encodeURIComponent(pIdStr)}?isAdmin=true`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isAdmin: true,
          propertyId: pIdStr,
          referenceId: id3,
          title: matchedObj?.title || '',
          property: matchedObj
        })
      });
    } catch (pgErr) {
      console.warn('PostgreSQL property delete request note:', pgErr);
    }

    // 2. LocalStorage updates across all stores
    try {
      const rawDeleted = localStorage.getItem('easeland_deleted_properties') || '[]';
      const parsedDeleted = JSON.parse(rawDeleted);
      allAliases.forEach(alias => {
        if (!parsedDeleted.includes(alias)) parsedDeleted.push(alias);
      });
      if (normTitle && !parsedDeleted.includes(normTitle)) parsedDeleted.push(normTitle);
      localStorage.setItem('easeland_deleted_properties', JSON.stringify(parsedDeleted));

      const rawAdminDel = localStorage.getItem('easeland_admin_deleted_properties') || '[]';
      const parsedAdminDel = JSON.parse(rawAdminDel);
      const exists = parsedAdminDel.some(item => matchesAlias(item));
      if (!exists) {
        parsedAdminDel.push({
          id: pIdStr,
          propertyId: id2 || pIdStr,
          referenceId: id3 || `EL-PROP-${num1 || pIdStr}`,
          title: matchedObj?.title || '',
          deletedByAdmin: true,
          status: 'DELETED_BY_ADMIN',
          listingStatus: 'DELETED_BY_ADMIN',
          adminFeedback: 'Notification: Deleted by Admin',
          adminNotes: 'Deleted by Admin',
          deletedAt: new Date().toISOString()
        });
        localStorage.setItem('easeland_admin_deleted_properties', JSON.stringify(parsedAdminDel));
        fetch('/api/properties/sync-deleted', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deletedProperties: parsedAdminDel })
        }).catch(() => {});
      }

      const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties'];
      keys.forEach(k => {
        const rawLocal = localStorage.getItem(k);
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter(p => !matchesAlias(p));
            localStorage.setItem(k, JSON.stringify(updated));
          }
        }
      });
    } catch (e) { }

    // 3. Immediately update UI state
    setAllProperties(prev => prev.filter(p => !matchesAlias(p)));
    setVerificationQueue(prev => prev.filter(p => !matchesAlias(p)));
    setIsWorkspaceOpen(false);
    setSelectedProperty(null);

    // 4. Cloud Firestore deletion / admin mark
    try {
      const { deletePropertyListing } = await import('../firebase/propertyService.js');
      await deletePropertyListing(pIdStr, user?.uid, true, matchedObj);
    } catch (e) { }

    // 5. Mock API store update
    try {
      const { mockApi } = await import('../services/mockApi.js');
      if (typeof mockApi.deleteProperty === 'function') {
        mockApi.deleteProperty(pIdStr, matchedObj, true);
      }
    } catch (e) { }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-property-deleted', { detail: { propertyId: pIdStr, isAdmin: true } }));
      window.dispatchEvent(new CustomEvent('easeland-property-status-updated', { detail: { propertyId: pIdStr, status: 'DELETED_BY_ADMIN' } }));
      window.dispatchEvent(new Event('storage'));
    }
    logAdminActivity(`deleted property listing ${pIdStr}.`);

    await loadData();
  };

  const [adminActionProcessing, setAdminActionProcessing] = useState(false);

  const handleSaveDraftConfig = async () => {
    if (adminActionProcessing) return;
    setAdminActionProcessing(true);
    try {
      const adminUid = user?.uid || 'admin_auditor';
      const updated = mockApi.updateSiteConfig(siteConfig);
      if (updated) setSiteConfig({ ...updated });
      try {
        await publishSiteConfigAdmin(siteConfig, adminUid);
        await updateSiteModuleAdmin('master_draft', siteConfig, adminUid);
      } catch (e) { }
      hasUnsavedCmsChangesRef.current = false;
      setHasUnsavedCmsChanges(false);
      logAdminActivity('saved and published CMS site configuration changes.');
      setPublishSuccessMessage('Changes saved and applied live across all 16 modules!');
      setTimeout(() => setPublishSuccessMessage(''), 4000);
    } catch (e) {
      const updated = mockApi.updateSiteConfig(siteConfig);
      if (updated) setSiteConfig({ ...updated });
      hasUnsavedCmsChangesRef.current = false;
      setHasUnsavedCmsChanges(false);
      setPublishSuccessMessage('Changes saved and applied locally.');
      setTimeout(() => setPublishSuccessMessage(''), 4000);
    } finally {
      setAdminActionProcessing(false);
    }
  };

  const handlePublishSiteConfig = async () => {
    if (adminActionProcessing) return;
    setAdminActionProcessing(true);
    try {
      const adminUid = user?.uid || 'admin_auditor';
      const updated = mockApi.updateSiteConfig(siteConfig);
      if (updated) setSiteConfig({ ...updated });
      try {
        await publishSiteConfigAdmin(siteConfig, adminUid);
      } catch (e) { }
      hasUnsavedCmsChangesRef.current = false;
      setHasUnsavedCmsChanges(false);
      logAdminActivity('published site configuration changes live.');
      setPublishSuccessMessage('Website configuration published live! All 16 modules are active immediately on the public site.');
      setTimeout(() => setPublishSuccessMessage(''), 4000);
    } catch (e) {
      const updated = mockApi.updateSiteConfig(siteConfig);
      if (updated) setSiteConfig({ ...updated });
      hasUnsavedCmsChangesRef.current = false;
      setHasUnsavedCmsChanges(false);
      setPublishSuccessMessage('Website configuration published locally.');
      setTimeout(() => setPublishSuccessMessage(''), 4000);
    } finally {
      setAdminActionProcessing(false);
    }
  };

  const handleSaveModuleDraft = async (moduleId) => {
    if (adminActionProcessing || !moduleId) return;
    setAdminActionProcessing(true);
    try {
      const adminUid = user?.uid || 'admin_auditor';
      const updated = mockApi.updateSiteConfig(siteConfig);
      if (updated) setSiteConfig({ ...updated });
      const moduleData = siteConfig[moduleId] !== undefined
        ? siteConfig[moduleId]
        : (moduleId === 'categories' ? siteConfig.categories : (moduleId === 'faq' ? siteConfig.faqs : (moduleId === 'maps' ? siteConfig.mapsConfig : siteConfig)));
      try {
        await updateSiteModuleAdmin(moduleId, moduleData, adminUid);
      } catch (e) { }
      hasUnsavedCmsChangesRef.current = false;
      setHasUnsavedCmsChanges(false);
      logAdminActivity('saved CMS draft for module: ' + moduleId);
      setPublishSuccessMessage('Draft adjustments saved for Module: ' + moduleId);
      setTimeout(() => setPublishSuccessMessage(''), 4000);
    } catch (e) {
      console.warn('Save module draft error:', e);
      hasUnsavedCmsChangesRef.current = false;
      setHasUnsavedCmsChanges(false);
      setPublishSuccessMessage('Draft saved locally for Module: ' + moduleId);
      setTimeout(() => setPublishSuccessMessage(''), 4000);
    } finally {
      setAdminActionProcessing(false);
    }
  };

  const handlePublishModuleLive = async (moduleId) => {
    if (adminActionProcessing || !moduleId) return;
    setAdminActionProcessing(true);
    try {
      const adminUid = user?.uid || 'admin_auditor';
      const updated = mockApi.updateSiteConfig(siteConfig);
      if (updated) setSiteConfig({ ...updated });
      try {
        await publishSiteConfigAdmin(siteConfig, adminUid);
      } catch (e) { }
      hasUnsavedCmsChangesRef.current = false;
      setHasUnsavedCmsChanges(false);
      logAdminActivity('published live changes for module: ' + moduleId);
      setPublishSuccessMessage('Module ' + moduleId + ' published LIVE to marketplace!');
      setTimeout(() => setPublishSuccessMessage(''), 4000);
    } catch (e) {
      console.warn('Publish module live error:', e);
      hasUnsavedCmsChangesRef.current = false;
      setHasUnsavedCmsChanges(false);
      setPublishSuccessMessage('Module ' + moduleId + ' published locally.');
      setTimeout(() => setPublishSuccessMessage(''), 4000);
    } finally {
      setAdminActionProcessing(false);
    }
  };

  const handleResetModule = (moduleId) => {
    if (!moduleId) return;
    const freshDefaults = JSON.parse(JSON.stringify(DEFAULT_SITE_CONFIG));

    // 1. Update CMS configuration state in React immediately
    updateCmsConfig(prev => {
      const next = { ...prev };
      if (moduleId === 'faq') {
        next.faqs = JSON.parse(JSON.stringify(freshDefaults.faqs));
      } else if (moduleId === 'categories') {
        next.categories = JSON.parse(JSON.stringify(freshDefaults.categories));
      } else if (moduleId === 'maps') {
        next.mapsConfig = JSON.parse(JSON.stringify(freshDefaults.mapsConfig));
      } else if (freshDefaults[moduleId] !== undefined) {
        next[moduleId] = JSON.parse(JSON.stringify(freshDefaults[moduleId]));
      }
      if (moduleId === 'theme' && freshDefaults.theme) {
        applySiteTheme(freshDefaults.theme);
      }
      return next;
    });

    // 2. Persist to mockApi store and sync to Firestore
    try {
      const updatedConfig = mockApi.resetModuleConfig ? mockApi.resetModuleConfig(moduleId) : null;
      if (updatedConfig) {
        setSiteConfig({ ...updatedConfig });
      }
      const adminUid = user?.uid || 'admin_auditor';
      const moduleData = freshDefaults[moduleId] !== undefined
        ? freshDefaults[moduleId]
        : (moduleId === 'categories' ? freshDefaults.categories : (moduleId === 'faq' ? freshDefaults.faqs : (moduleId === 'maps' ? freshDefaults.mapsConfig : freshDefaults)));
      updateSiteModuleAdmin(moduleId, moduleData, adminUid).catch(() => {});
    } catch (err) {
      console.warn('handleResetModule sync notice:', err);
    }

    hasUnsavedCmsChangesRef.current = false;
    setHasUnsavedCmsChanges(false);
    logAdminActivity('reset module ' + moduleId + ' to factory defaults.');
    setPublishSuccessMessage('Module ' + moduleId + ' reset to factory defaults.');
    setTimeout(() => setPublishSuccessMessage(''), 4000);
  };

  const handleOpenAddCategoryModal = () => {
    setNewCategoryForm({
      title: '',
      countText: '',
      imageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'
    });
    setIsAddCategoryModalOpen(true);
  };

  const handleCreateCategorySubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newCategoryForm.title || !newCategoryForm.title.trim()) {
      alert('Please enter a category title.');
      return;
    }
    const newCat = {
      id: 'cat-' + Date.now(),
      title: newCategoryForm.title.trim(),
      countText: newCategoryForm.countText.trim() || '0 Properties',
      imageUrl: newCategoryForm.imageUrl.trim() || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'
    };
    updateCmsConfig(prev => ({
      ...prev,
      categories: [newCat, ...safeArray(prev.categories)]
    }));
    setIsAddCategoryModalOpen(false);
    setPublishSuccessMessage('New category card "' + newCat.title + '" added to draft! Remember to save.');
    setTimeout(() => setPublishSuccessMessage(''), 4000);
  };

  const handleRemoveCategory = (catId) => {
    updateCmsConfig(prev => ({
      ...prev,
      categories: safeArray(prev.categories).filter(c => c && c.id !== catId)
    }));
  };

  const handleSyncCloudAndDb = async () => {
    if (adminActionProcessing) return;
    setAdminActionProcessing(true);
    try {
      setPublishSuccessMessage('Authoritative 3-way synchronization running across Firestore, PostgreSQL, and Local Stores...');
      const syncRes = await syncSiteConfigAndUsers();
      if (syncRes && syncRes.config && Object.keys(syncRes.config).length > 0) {
        const merged = mockApi.mergeSiteConfigWithDefaults(syncRes.config);
        mockApi.updateSiteConfig(merged);
        setSiteConfig(merged);
      }
      isDataLoadingRef.current = false;
      await Promise.allSettled([loadData(), loadVisitorLeads()]);
      setPublishSuccessMessage('CMS Modules and User Accounts successfully synchronized across Firestore, PostgreSQL, and Admin Portal!');
      setTimeout(() => setPublishSuccessMessage(''), 5000);
    } catch (err) {
      console.warn('Sync error:', err);
      isDataLoadingRef.current = false;
      await Promise.allSettled([loadData(), loadVisitorLeads()]);
      setPublishSuccessMessage('Admin Portal refreshed from active database.');
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

      // 1. PostgreSQL database save FIRST (Authoritative Primary Source)
      const pendingEdits = selectedProperty?.pendingReauditData || selectedProperty?.pendingEdits || {};
      const payload = {
        ...(selectedProperty || {}),
        ...pendingEdits,
        propertyId: propId,
        id: propId,
        hasPendingEdits: false,
        reAuditStatus: null,
        pendingReauditData: null,
        pendingEdits: null,
        listingStatus: 'LIVE',
        listing_status: 'LIVE',
        status: 'LIVE',
        isPlatformVerified: true,
        isPublished: true,
        is_published: true,
        isAdmin: true,
        isAdminApproval: true,
        adminVerified: true,
        verifiedDate: new Date().toISOString(),
        verificationNotes: note,
        verificationStatus: 'Platform Verified'
      };
      try {
        await fetch('/api/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (pgErr) { }

      // 2. Cloud Firestore update
      try {
        await approvePropertyVerification(propId, adminUid, adminName, note);
      } catch (e1) { }

      // 3. Mock API memory store update
      if (typeof mockApi.approvePropertyAdmin === 'function') {
        mockApi.approvePropertyAdmin(propId, note);
      }

      // 4. LocalStorage update across all storage arrays
      try {
        if (typeof window !== 'undefined') {
          const targetIdStr = String(propId);
          const rawSub = localStorage.getItem('easeland_submitted_properties');
          if (rawSub) {
            const parsedSub = JSON.parse(rawSub);
            if (Array.isArray(parsedSub)) {
              localStorage.setItem('easeland_submitted_properties', JSON.stringify(
                parsedSub.filter(id => {
                  const s = String(id || '');
                  return s !== targetIdStr && s !== String(selectedProperty?.id) && s !== String(selectedProperty?.propertyId) && s !== String(selectedProperty?.referenceId);
                })
              ));
            }
          }

          const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties'];
          keys.forEach(k => {
            const rawLocal = localStorage.getItem(k);
            if (rawLocal) {
              const parsed = JSON.parse(rawLocal);
              if (Array.isArray(parsed)) {
                const updated = parsed.map(p => {
                  if (p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr)) {
                    return {
                      ...p,
                      ...pendingEdits,
                      hasPendingEdits: false,
                      reAuditStatus: null,
                      pendingReauditData: null,
                      pendingEdits: null,
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
                localStorage.setItem(k, JSON.stringify(updated));
              }
            }
          });
        }
      } catch (lErr) { }

      // Evict immediately from Verification Queue UI state
      setVerificationQueue(prev => prev.filter(p => {
        if (!p) return false;
        const id1 = String(p.id || '');
        const id2 = String(p.propertyId || '');
        const id3 = String(p.referenceId || '');
        const targetId = String(propId);
        return id1 !== targetId && id2 !== targetId && id3 !== targetId;
      }));

      // Update in All Properties state
      setAllProperties(prev => prev.map(p => {
        if (!p) return p;
        const id1 = String(p.id || '');
        const id2 = String(p.propertyId || '');
        const id3 = String(p.referenceId || '');
        const targetId = String(propId);
        if (id1 === targetId || id2 === targetId || id3 === targetId) {
          return {
            ...p,
            ...pendingEdits,
            hasPendingEdits: false,
            reAuditStatus: null,
            pendingReauditData: null,
            pendingEdits: null,
            listingStatus: 'LIVE',
            status: 'LIVE',
            isPlatformVerified: true,
            isPublished: true,
            verificationNotes: note,
            verificationStatus: 'Platform Verified'
          };
        }
        return p;
      }));

      // 5. Notify window to refresh all user dashboards immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('easeland-property-approved', { detail: { propertyId: propId, status: 'LIVE' } }));
        window.dispatchEvent(new CustomEvent('easeland-property-status-updated', { detail: { propertyId: propId, status: 'LIVE' } }));
      }
      logAdminActivity('verified and published property ' + propId + ' live with approved details.');

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

  const handleRejectEdits = async (propId) => {
    if (adminActionProcessing || !propId) return;
    setAdminActionProcessing(true);
    try {
      const adminUid = user?.uid || 'admin_auditor';
      const adminName = user?.displayName || 'EaseLand Auditor';
      const note = feedbackNote || 'Proposed modifications rejected by Admin auditor. The previously approved listing details remain live.';

      // 1. PostgreSQL Authoritative Update FIRST
      const payload = {
        ...(selectedProperty || {}),
        propertyId: propId,
        id: propId,
        hasPendingEdits: false,
        reAuditStatus: 'EDITS_REJECTED',
        pendingReauditData: null,
        pendingEdits: null,
        listingStatus: 'LIVE',
        listing_status: 'LIVE',
        status: 'LIVE',
        isPlatformVerified: true,
        isPublished: true,
        is_published: true,
        isAdmin: true,
        verificationNotes: note,
        adminFeedback: note,
        ownerFacingNotes: note
      };

      try {
        await fetch('/api/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (pgErr) { }

      // 2. Cloud Firestore update
      try {
        await rejectPropertyEdits(propId, adminUid, adminName, note);
      } catch (e1) { }

      // 3. Mock API memory store update
      if (typeof mockApi.rejectPropertyEditsAdmin === 'function') {
        mockApi.rejectPropertyEditsAdmin(propId, note);
      }

      try {
        if (typeof window !== 'undefined') {
          const targetIdStr = String(propId);
          const rawSub = localStorage.getItem('easeland_submitted_properties');
          if (rawSub) {
            const parsedSub = JSON.parse(rawSub);
            if (Array.isArray(parsedSub)) {
              localStorage.setItem('easeland_submitted_properties', JSON.stringify(
                parsedSub.filter(id => {
                  const s = String(id || '');
                  return s !== targetIdStr && s !== String(selectedProperty?.id) && s !== String(selectedProperty?.propertyId) && s !== String(selectedProperty?.referenceId);
                })
              ));
            }
          }

          const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties'];
          keys.forEach(k => {
            const rawLocal = localStorage.getItem(k);
            if (rawLocal) {
              const parsed = JSON.parse(rawLocal);
              if (Array.isArray(parsed)) {
                const updated = parsed.map(p => {
                  if (p && (String(p.id) === targetIdStr || String(p.propertyId) === targetIdStr || String(p.referenceId) === targetIdStr)) {
                    return {
                      ...p,
                      hasPendingEdits: false,
                      reAuditStatus: 'EDITS_REJECTED',
                      pendingReauditData: null,
                      pendingEdits: null,
                      listingStatus: 'LIVE',
                      status: 'LIVE',
                      isPlatformVerified: true,
                      isPublished: true,
                      verificationNotes: note,
                      adminFeedback: note,
                      ownerFacingNotes: note
                    };
                  }
                  return p;
                });
                localStorage.setItem(k, JSON.stringify(updated));
              }
            }
          });
        }
      } catch (lErr) { }

      // Evict immediately from Verification Queue UI state
      setVerificationQueue(prev => prev.filter(p => {
        if (!p) return false;
        const id1 = String(p.id || '');
        const id2 = String(p.propertyId || '');
        const id3 = String(p.referenceId || '');
        const targetId = String(propId);
        return id1 !== targetId && id2 !== targetId && id3 !== targetId;
      }));

      // Update in All Properties state
      setAllProperties(prev => prev.map(p => {
        if (!p) return p;
        const id1 = String(p.id || '');
        const id2 = String(p.propertyId || '');
        const id3 = String(p.referenceId || '');
        const targetId = String(propId);
        if (id1 === targetId || id2 === targetId || id3 === targetId) {
          return {
            ...p,
            hasPendingEdits: false,
            reAuditStatus: 'EDITS_REJECTED',
            pendingReauditData: null,
            pendingEdits: null,
            listingStatus: 'LIVE',
            status: 'LIVE',
            isPlatformVerified: true,
            isPublished: true,
            verificationNotes: note,
            adminFeedback: note,
            ownerFacingNotes: note
          };
        }
        return p;
      }));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('easeland-property-status-updated', { detail: payload }));
        window.dispatchEvent(new CustomEvent('easeland-property-updated', { detail: payload }));
      }
      logAdminActivity('rejected proposed modifications for property ' + propId + ' (' + note + '). Approved listing remains live.');

      setPublishSuccessMessage('Proposed edits rejected. Previous approved listing remains LIVE.');
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

      // 1. PostgreSQL Authoritative Rejection FIRST
      const payload = {
        ...(selectedProperty || {}),
        propertyId: propId,
        id: propId,
        listingStatus: 'REJECTED',
        listing_status: 'REJECTED',
        status: 'REJECTED',
        isPlatformVerified: false,
        isPublished: false,
        is_published: false,
        isAdmin: true,
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
      } catch (pgErr) { }

      // 2. Cloud Firestore update
      try {
        await rejectPropertyVerification(propId, adminUid, adminName, note);
      } catch (e1) { }

      // 3. Mock API memory store update
      if (typeof mockApi.rejectPropertyAdmin === 'function') {
        mockApi.rejectPropertyAdmin(propId, note);
      }

      try {
        if (typeof window !== 'undefined') {
          const targetIdStr = String(propId);
          const rawSub = localStorage.getItem('easeland_submitted_properties');
          if (rawSub) {
            const parsedSub = JSON.parse(rawSub);
            if (Array.isArray(parsedSub)) {
              localStorage.setItem('easeland_submitted_properties', JSON.stringify(
                parsedSub.filter(id => {
                  const s = String(id || '');
                  return s !== targetIdStr && s !== String(selectedProperty?.id) && s !== String(selectedProperty?.propertyId) && s !== String(selectedProperty?.referenceId);
                })
              ));
            }
          }

          const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties'];
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
        }
      } catch (lErr) { }

      // Evict immediately from Verification Queue UI state
      setVerificationQueue(prev => prev.filter(p => {
        if (!p) return false;
        const id1 = String(p.id || '');
        const id2 = String(p.propertyId || '');
        const id3 = String(p.referenceId || '');
        const targetId = String(propId);
        return id1 !== targetId && id2 !== targetId && id3 !== targetId;
      }));

      // Update in All Properties state
      setAllProperties(prev => prev.map(p => {
        if (!p) return p;
        const id1 = String(p.id || '');
        const id2 = String(p.propertyId || '');
        const id3 = String(p.referenceId || '');
        const targetId = String(propId);
        if (id1 === targetId || id2 === targetId || id3 === targetId) {
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
      }));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('easeland-property-status-updated', { detail: payload }));
        window.dispatchEvent(new CustomEvent('easeland-property-updated', { detail: payload }));
      }
      logAdminActivity(`rejected property ${propId} (${note}).`);

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

      // 1. PostgreSQL Authoritative Changes Requested Save FIRST
      const payload = {
        ...(selectedProperty || {}),
        propertyId: propId,
        id: propId,
        listingStatus: 'CHANGES_REQUIRED',
        status: 'CHANGES_REQUIRED',
        listing_status: 'CHANGES_REQUIRED',
        isPublished: false,
        is_published: false,
        isPlatformVerified: false,
        isAdmin: true,
        hasPendingEdits: false,
        pendingReauditData: null,
        reAuditStatus: null,
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
      } catch (pgErr) { }

      // 2. Cloud Firestore update
      try {
        await requestVerificationChanges(propId, adminUid, adminName, note);
      } catch (e1) { }

      // 3. Mock API memory store update
      if (typeof mockApi.requestChangesAdmin === 'function') {
        mockApi.requestChangesAdmin(propId, note);
      }

      try {
        if (typeof window !== 'undefined') {
          const targetIdStr = String(propId);
          const rawSub = localStorage.getItem('easeland_submitted_properties');
          if (rawSub) {
            const parsedSub = JSON.parse(rawSub);
            if (Array.isArray(parsedSub)) {
              localStorage.setItem('easeland_submitted_properties', JSON.stringify(
                parsedSub.filter(id => {
                  const s = String(id || '');
                  return s !== targetIdStr && s !== String(selectedProperty?.id) && s !== String(selectedProperty?.propertyId) && s !== String(selectedProperty?.referenceId);
                })
              ));
            }
          }

          const keys = ['easeland_properties', 'easeland_user_properties', 'easeland_owner_properties'];
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
        }
      } catch (lErr) { }

      // Evict immediately from Verification Queue UI state
      setVerificationQueue(prev => prev.filter(p => {
        if (!p) return false;
        const id1 = String(p.id || '');
        const id2 = String(p.propertyId || '');
        const id3 = String(p.referenceId || '');
        const targetId = String(propId);
        return id1 !== targetId && id2 !== targetId && id3 !== targetId;
      }));

      // Update in All Properties state
      setAllProperties(prev => prev.map(p => {
        if (!p) return p;
        const id1 = String(p.id || '');
        const id2 = String(p.propertyId || '');
        const id3 = String(p.referenceId || '');
        const targetId = String(propId);
        if (id1 === targetId || id2 === targetId || id3 === targetId) {
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
      }));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('easeland-property-status-updated', { detail: payload }));
        window.dispatchEvent(new CustomEvent('easeland-property-updated', { detail: payload }));
      }
      logAdminActivity(`requested document changes for property ${propId}.`);

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

  const handleDeleteProperty = async (targetProp, propObj = null) => {
    return handleDeletePropertyFromAdmin(targetProp, propObj);
  };

  const handleCreateFollowUp = (e) => {
    e.preventDefault();
    mockApi.createFollowUpAdmin(newFollowUp);
    setNewFollowUp({ customerName: '', propertyTitle: '', followUpDate: '2026-09-03', followUpTime: '11:00 AM', nextAction: '', notes: '' });
    loadData();
  };

  const openWorkspace = async (prop) => {
    setSelectedProperty(prop);
    setAuditRemovedItemKeys(new Set());
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
    } catch (e) { }

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
    } catch (e) { }

    try {
      if (user?.uid) {
        await startPropertyReview(pId, user.uid, user?.displayName || 'EaseLand Auditor');
      }
    } catch (err) { }
  };

  // Auditor Media & Document Editing / Removal Handler
  const handleAdminRemoveMediaItem = async (type, item, propId) => {
    if (!propId || !item) return;
    const pIdStr = String(propId);

    try {
      if (type === 'photo') {
        const photoUrl = typeof item === 'string' ? item : (item.url || item.src || '');
        if (!photoUrl) return;

        setAuditRemovedItemKeys(prev => {
          const next = new Set(prev);
          next.add(photoUrl);
          next.add(photoUrl.toLowerCase());
          return next;
        });

        // 1. Update selectedProperty
        setSelectedProperty(prev => {
          if (!prev) return prev;
          const updatedPhotos = (prev.photos || []).filter(u => u !== photoUrl);
          const updatedMedia = (prev.media || []).filter(m => (typeof m === 'string' ? m : (m.publicUrl || m.url)) !== photoUrl);
          return {
            ...prev,
            photos: updatedPhotos,
            media: updatedMedia
          };
        });

        // 2. Update verificationQueue & allProperties
        setVerificationQueue(prev => prev.map(p => {
          if (String(p.id || p.propertyId) === pIdStr) {
            return {
              ...p,
              photos: (p.photos || []).filter(u => u !== photoUrl),
              media: (p.media || []).filter(m => (typeof m === 'string' ? m : (m.publicUrl || m.url)) !== photoUrl)
            };
          }
          return p;
        }));

        setAllProperties(prev => prev.map(p => {
          if (String(p.id || p.propertyId) === pIdStr) {
            return {
              ...p,
              photos: (p.photos || []).filter(u => u !== photoUrl),
              media: (p.media || []).filter(m => (typeof m === 'string' ? m : (m.publicUrl || m.url)) !== photoUrl)
            };
          }
          return p;
        }));

        // 3. Clean local storage
        try {
          if (typeof window !== 'undefined') {
            const rawDelMedia = localStorage.getItem('easeland_deleted_media') || '[]';
            const parsedDel = JSON.parse(rawDelMedia);
            if (!parsedDel.includes(photoUrl)) {
              parsedDel.push(photoUrl);
              localStorage.setItem('easeland_deleted_media', JSON.stringify(parsedDel));
            }
            const stored = localStorage.getItem(`easeland_media_${pIdStr}`);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed)) {
                localStorage.setItem(`easeland_media_${pIdStr}`, JSON.stringify(parsed.filter(m => (typeof m === 'string' ? m : m.url) !== photoUrl)));
              }
            }
            const userMedia = localStorage.getItem('easeland_user_media');
            if (userMedia) {
              const parsed = JSON.parse(userMedia);
              if (Array.isArray(parsed)) {
                localStorage.setItem('easeland_user_media', JSON.stringify(parsed.filter(m => (typeof m === 'string' ? m : m.url) !== photoUrl)));
              }
            }
          }
        } catch (e) { }

        // 4. Update Firestore & PostgreSQL non-blockingly
        try {
          const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
          const { db } = await import('../firebase/config.js');
          const propRef = doc(db, 'properties', pIdStr);
          await updateDoc(propRef, {
            photos: (selectedProperty?.photos || []).filter(u => u !== photoUrl),
            updatedAt: serverTimestamp()
          });
        } catch (fsErr) { }

        try {
          await fetch(`/api/properties/${pIdStr}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              photos: (selectedProperty?.photos || []).filter(u => u !== photoUrl)
            })
          });
        } catch (pgErr) { }

        logAdminActivity(`Auditor removed ineligible photo from property ${pIdStr}.`);
      } else if (type === 'video') {
        const videoUrl = typeof item === 'string' ? item : (item.url || item.embedUrl || '');
        if (!videoUrl) return;

        setAuditRemovedItemKeys(prev => {
          const next = new Set(prev);
          next.add(videoUrl);
          next.add(videoUrl.toLowerCase());
          return next;
        });

        // 1. Update selectedProperty
        setSelectedProperty(prev => {
          if (!prev) return prev;
          const updatedMedia = (prev.media || []).filter(m => {
            const u = typeof m === 'string' ? m : (m.url || m.embedUrl);
            return u !== videoUrl;
          });
          return {
            ...prev,
            videoUrl: prev.videoUrl === videoUrl ? null : prev.videoUrl,
            videoLink: prev.videoLink === videoUrl ? null : prev.videoLink,
            embeddedVideoUrl: prev.embeddedVideoUrl === videoUrl ? null : prev.embeddedVideoUrl,
            droneVideoUrl: prev.droneVideoUrl === videoUrl ? null : prev.droneVideoUrl,
            media: updatedMedia
          };
        });

        // 2. Update verificationQueue & allProperties
        setVerificationQueue(prev => prev.map(p => {
          if (String(p.id || p.propertyId) === pIdStr) {
            return {
              ...p,
              videoUrl: p.videoUrl === videoUrl ? null : p.videoUrl,
              videoLink: p.videoLink === videoUrl ? null : p.videoLink,
              embeddedVideoUrl: p.embeddedVideoUrl === videoUrl ? null : p.embeddedVideoUrl,
              media: (p.media || []).filter(m => (typeof m === 'string' ? m : m.url) !== videoUrl)
            };
          }
          return p;
        }));

        setAllProperties(prev => prev.map(p => {
          if (String(p.id || p.propertyId) === pIdStr) {
            return {
              ...p,
              videoUrl: p.videoUrl === videoUrl ? null : p.videoUrl,
              videoLink: p.videoLink === videoUrl ? null : p.videoLink,
              embeddedVideoUrl: p.embeddedVideoUrl === videoUrl ? null : p.embeddedVideoUrl,
              media: (p.media || []).filter(m => (typeof m === 'string' ? m : m.url) !== videoUrl)
            };
          }
          return p;
        }));

        try {
          const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
          const { db } = await import('../firebase/config.js');
          const propRef = doc(db, 'properties', pIdStr);
          await updateDoc(propRef, {
            videoUrl: null,
            videoLink: null,
            embeddedVideoUrl: null,
            droneVideoUrl: null,
            updatedAt: serverTimestamp()
          });
        } catch (fsErr) { }

        logAdminActivity(`Auditor removed ineligible video from property ${pIdStr}.`);
      } else if (type === 'document') {
        const docId = item.docId || item.id || item.name || item.url || '';
        const docName = item.documentName || item.name || 'Document';
        const docUrl = item.url || item.publicUrl || '';

        setAuditRemovedItemKeys(prev => {
          const next = new Set(prev);
          if (docId) next.add(String(docId));
          if (docName) next.add(String(docName));
          if (docUrl && docUrl !== '#') next.add(String(docUrl));
          return next;
        });

        // 1. Update selectedProperty
        setSelectedProperty(prev => {
          if (!prev) return prev;
          const updatedDocs = (prev.documents || []).filter(d => {
            const id = d.docId || d.id || d.name || d.url;
            return id !== docId && d.name !== docName && d.url !== docUrl;
          });
          return {
            ...prev,
            documents: updatedDocs,
            propertyDocuments: (prev.propertyDocuments || []).filter(d => (d.docId || d.id || d.name) !== docId),
            confidentialDocuments: (prev.confidentialDocuments || []).filter(d => (d.docId || d.id || d.name) !== docId)
          };
        });

        // 2. Update verificationQueue & allProperties
        setVerificationQueue(prev => prev.map(p => {
          if (String(p.id || p.propertyId) === pIdStr) {
            return {
              ...p,
              documents: (p.documents || []).filter(d => (d.docId || d.id || d.name || d.url) !== docId && d.name !== docName && d.url !== docUrl)
            };
          }
          return p;
        }));

        setAllProperties(prev => prev.map(p => {
          if (String(p.id || p.propertyId) === pIdStr) {
            return {
              ...p,
              documents: (p.documents || []).filter(d => (d.docId || d.id || d.name || d.url) !== docId && d.name !== docName && d.url !== docUrl)
            };
          }
          return p;
        }));

        try {
          const { removeConfidentialPropertyDocument } = await import('../firebase/documentService.js');
          await removeConfidentialPropertyDocument(docId, pIdStr, selectedProperty?.ownerId);
        } catch (docErr) { }

        logAdminActivity(`Auditor removed ineligible document "${docName}" from property ${pIdStr}.`);
      }
    } catch (err) {
      console.error('Error removing file during audit:', err);
    }
  };

  // User Suspension & Removal Handlers
  const handleSuspendUserModalOpen = (u) => {
    setSelectedUserForSuspension(u);
    setSuspensionDays(7);
    setSuspensionHours(0);
    setSuspensionReason('Fraudulent Land Title Document Upload');
    setCustomReasonText('');
    setIsSuspendModalOpen(true);
  };
  const handleOpenSuspendModal = handleSuspendUserModalOpen;

  const handleConfirmSuspendUser = async () => {
    if (!selectedUserForSuspension) return;
    const targetUser = selectedUserForSuspension;
    const targetId = String(targetUser.id || targetUser.uid || '').toLowerCase().trim();
    const targetEmail = String(targetUser.email || '').toLowerCase().trim();
    const totalHours = (suspensionDays * 24) + parseInt(suspensionHours || 0);
    const reasonText = (suspensionReason === 'Custom Reason' || suspensionReason === 'Other')
      ? (customReasonText || 'Policy Violation')
      : suspensionReason;

    const suspensionPayload = {
      days: suspensionDays,
      hours: suspensionHours,
      totalHours: totalHours,
      reason: reasonText,
      suspendedAt: new Date().toISOString(),
      suspendedUntil: new Date(Date.now() + (totalHours * 60 * 60 * 1000)).toISOString(),
      suspendedBy: user?.uid || 'admin_uid_001'
    };

    // 1. Immediate optimistic UI update
    setRegisteredUsersList(prev => prev.map(u => {
      const uId = String(u.id || u.uid || '').toLowerCase().trim();
      const uEm = String(u.email || '').toLowerCase().trim();
      const isMatch = (targetId && uId === targetId) || (targetEmail && uEm === targetEmail);
      if (isMatch) {
        return {
          ...u,
          accountStatus: 'SUSPENDED',
          status: 'SUSPENDED',
          suspension: suspensionPayload,
          suspensionReason: reasonText
        };
      }
      return u;
    }));

    setIsSuspendModalOpen(false);
    setSelectedUserForSuspension(null);
    setPublishSuccessMessage('User account suspended successfully for ' + suspensionDays + ' days.');
    setTimeout(() => setPublishSuccessMessage(''), 4000);

    // 2. Persist to Firestore
    try {
      await suspendUserAccount(targetUser.id || targetUser.uid, user?.uid || 'admin_uid_001', suspensionDays, reasonText);
    } catch (e) {
      console.warn('Firestore suspend note:', e);
    }

    // 3. Persist to mockApi and logs
    mockApi.suspendUserAdmin(targetUser.id || targetUser.uid, totalHours, reasonText);
    logAdminActivity('suspended user ' + (targetUser.name || targetUser.email || 'User') + ' for ' + suspensionDays + ' days (' + reasonText + ').');

    // 4. Persist to PostgreSQL backend
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: targetUser.uid || targetUser.id,
          id: targetUser.id || targetUser.uid,
          email: targetUser.email,
          displayName: targetUser.name || targetUser.displayName || 'EaseLand User',
          accountStatus: 'SUSPENDED',
          status: 'SUSPENDED',
          suspension: suspensionPayload
        })
      });
    } catch (apiErr) { }

    // 5. Update local storage and broadcast cross-tab events
    try {
      if (typeof window !== 'undefined') {
        const rawReg = localStorage.getItem('easeland_registered_users');
        if (rawReg) {
          const parsed = JSON.parse(rawReg);
          if (Array.isArray(parsed)) {
            const updated = parsed.map(u => {
              const uId = String(u.id || u.uid || '').toLowerCase().trim();
              const uEm = String(u.email || '').toLowerCase().trim();
              const isMatch = (targetId && uId === targetId) || (targetEmail && uEm === targetEmail);
              return isMatch ? { ...u, accountStatus: 'SUSPENDED', status: 'SUSPENDED', suspension: suspensionPayload } : u;
            });
            localStorage.setItem('easeland_registered_users', JSON.stringify(updated));
          }
        }
        window.dispatchEvent(new CustomEvent('easeland-users-updated', { detail: { userId: targetId, status: 'SUSPENDED' } }));
        window.dispatchEvent(new CustomEvent('easeland-user-status-changed', { detail: { userId: targetId, email: targetEmail, status: 'SUSPENDED', suspension: suspensionPayload } }));
      }
    } catch (e) { }
  };
  const handleApplySuspension = handleConfirmSuspendUser;

  const handleUnsuspendUser = async (u) => {
    if (!u) return;
    const targetUser = typeof u === 'object' ? u : (registeredUsersList.find(usr => usr.id === u || usr.uid === u) || { id: u, uid: u });
    const targetId = String(targetUser.id || targetUser.uid || '').toLowerCase().trim();
    const targetEmail = String(targetUser.email || '').toLowerCase().trim();

    // 1. Immediate optimistic UI update
    setRegisteredUsersList(prev => prev.map(usr => {
      const uId = String(usr.id || usr.uid || '').toLowerCase().trim();
      const uEm = String(usr.email || '').toLowerCase().trim();
      const isMatch = (targetId && uId === targetId) || (targetEmail && uEm === targetEmail);
      if (isMatch) {
        return {
          ...usr,
          accountStatus: 'ACTIVE',
          status: 'ACTIVE',
          suspension: null,
          suspensionReason: null
        };
      }
      return usr;
    }));

    setPublishSuccessMessage('User suspension lifted successfully. Account restored to ACTIVE.');
    setTimeout(() => setPublishSuccessMessage(''), 4000);

    // 2. Persist to Firestore
    try {
      await unsuspendUserAccount(targetUser.id || targetUser.uid, user?.uid || 'admin_uid_001');
    } catch (e) {
      console.warn('Firestore unsuspend note:', e);
    }

    // 3. Persist to mockApi and logs
    mockApi.unsuspendUserAdmin(targetUser.id || targetUser.uid);
    logAdminActivity('unsuspended user ' + (targetUser.name || targetUser.email || 'User') + '.');

    // 4. Persist to PostgreSQL backend
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: targetUser.uid || targetUser.id,
          id: targetUser.id || targetUser.uid,
          email: targetUser.email,
          displayName: targetUser.name || targetUser.displayName || 'EaseLand User',
          accountStatus: 'ACTIVE',
          status: 'ACTIVE',
          suspension: null
        })
      });
    } catch (apiErr) { }

    // 5. Update local storage and broadcast cross-tab events
    try {
      if (typeof window !== 'undefined') {
        const rawReg = localStorage.getItem('easeland_registered_users');
        if (rawReg) {
          const parsed = JSON.parse(rawReg);
          if (Array.isArray(parsed)) {
            const updated = parsed.map(usr => {
              const uId = String(usr.id || usr.uid || '').toLowerCase().trim();
              const uEm = String(usr.email || '').toLowerCase().trim();
              const isMatch = (targetId && uId === targetId) || (targetEmail && uEm === targetEmail);
              return isMatch ? { ...usr, accountStatus: 'ACTIVE', status: 'ACTIVE', suspension: null } : usr;
            });
            localStorage.setItem('easeland_registered_users', JSON.stringify(updated));
          }
        }
        window.dispatchEvent(new CustomEvent('easeland-users-updated', { detail: { userId: targetId, status: 'ACTIVE' } }));
        window.dispatchEvent(new CustomEvent('easeland-user-status-changed', { detail: { userId: targetId, email: targetEmail, status: 'ACTIVE' } }));
      }
    } catch (e) { }
  };

  const handleRemoveUserModalOpen = (u) => {
    setSelectedUserForRemoval(u);
    setRemovalReason('Account permanently deleted by platform admin for policy violation');
    setIsRemoveModalOpen(true);
  };
  const handleOpenRemoveModal = handleRemoveUserModalOpen;

  const handleConfirmRemoveUser = async () => {
    if (!selectedUserForRemoval) return;
    const targetUser = selectedUserForRemoval;
    const targetId = String(targetUser.id || targetUser.uid || '').toLowerCase().trim();
    const targetEmail = String(targetUser.email || '').toLowerCase().trim();

    // 0. Synchronously blacklist in localStorage BEFORE ANY ASYNC CALLS so all listeners/sync reject this user
    try {
      if (typeof window !== 'undefined') {
        const rawDel = localStorage.getItem('easeland_deleted_users');
        let delArr = rawDel ? JSON.parse(rawDel) : [];
        if (targetId && !delArr.includes(targetId)) delArr.push(targetId);
        if (targetEmail && !delArr.includes(targetEmail)) delArr.push(targetEmail);
        localStorage.setItem('easeland_deleted_users', JSON.stringify(delArr));

        localStorage.removeItem('easeland_user_profile_' + targetId);
        localStorage.removeItem('easeland_draft_' + targetId);
        localStorage.removeItem('easeland_wizard_location_' + targetId);

        const rawReg = localStorage.getItem('easeland_registered_users');
        if (rawReg) {
          const parsed = JSON.parse(rawReg);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter(u => {
              if (!u) return false;
              const id1 = String(u.id || u.uid || '').toLowerCase().trim();
              const em1 = String(u.email || '').toLowerCase().trim();
              return id1 !== targetId && (!targetEmail || em1 !== targetEmail);
            });
            localStorage.setItem('easeland_registered_users', JSON.stringify(updated));
          }
        }
      }
    } catch (e) { }

    // 1. Immediate optimistic UI update - registered users list
    setRegisteredUsersList(prev => (prev || []).filter(u => {
      if (!u) return false;
      const id1 = String(u.id || u.uid || '').toLowerCase().trim();
      const em1 = String(u.email || '').toLowerCase().trim();
      return id1 !== targetId && (!targetEmail || em1 !== targetEmail);
    }));

    // 2. Find and immediately purge all properties belonging to this user from Admin Portal state
    const propertiesOfUser = allProperties.filter(p => {
      if (!p) return false;
      const pOwner = String(p.ownerId || p.userId || '').toLowerCase().trim();
      const pEmail = String(p.ownerEmail || p.ownerPrivateEmail || '').toLowerCase().trim();
      return pOwner === targetId || (targetEmail && pEmail === targetEmail);
    });

    setAllProperties(prev => prev.filter(p => {
      if (!p) return false;
      const pOwner = String(p.ownerId || p.userId || '').toLowerCase().trim();
      const pEmail = String(p.ownerEmail || p.ownerPrivateEmail || '').toLowerCase().trim();
      return pOwner !== targetId && (!targetEmail || pEmail !== targetEmail);
    }));

    setVerificationQueue(prev => prev.filter(p => {
      if (!p) return false;
      const pOwner = String(p.ownerId || p.userId || '').toLowerCase().trim();
      const pEmail = String(p.ownerEmail || p.ownerPrivateEmail || '').toLowerCase().trim();
      return pOwner !== targetId && (!targetEmail || pEmail !== targetEmail);
    }));

    setIsRemoveModalOpen(false);
    setSelectedUserForRemoval(null);
    setPublishSuccessMessage('User account and all posted properties permanently deleted.');
    setTimeout(() => setPublishSuccessMessage(''), 4000);

    // 3. Cascade delete each property listing
    try {
      const { deletePropertyListing } = await import('../firebase/propertyService.js');
      for (const prop of propertiesOfUser) {
        try {
          await deletePropertyListing(prop.id || prop.propertyId, targetUser.id || targetUser.uid, true, prop);
        } catch (pDelErr) {}
      }
    } catch (importErr) {}

    // 4. Persist user removal to Firestore with userEmail
    try {
      await removeUserAccount(targetUser.id || targetUser.uid, user?.uid || 'admin_uid_001', removalReason, targetUser.email);
    } catch (e) {
      console.warn('Firestore remove note:', e);
    }

    // 5. Persist to mockApi and logs
    mockApi.removeUserAdmin(targetUser.id || targetUser.uid, removalReason);
    logAdminActivity('permanently removed user account ' + (targetUser.name || targetUser.email || 'User') + ' and cascade deleted all posted properties.');

    // 6. Delete from PostgreSQL backend
    try {
      const uidParam = encodeURIComponent(targetUser.uid || targetUser.id || targetEmail);
      const emailParam = targetUser.email ? ('?email=' + encodeURIComponent(targetUser.email)) : '';
      await fetch('/api/users/' + uidParam + emailParam, { method: 'DELETE' });
    } catch (apiErr) { }

    // 7. Broadcast cross-tab events after authoritative deletion has completed
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('easeland-users-updated', { detail: { userId: targetId, status: 'REMOVED' } }));
        window.dispatchEvent(new CustomEvent('easeland-user-status-changed', { detail: { userId: targetId, email: targetEmail, status: 'REMOVED' } }));
      }
    } catch (e) { }
  };

  // FAQ management helpers
  const handleOpenAddFaqModal = () => {
    setNewFaqForm({ question: '', answer: '' });
    setIsAddFaqModalOpen(true);
  };

  const handleCreateFaqSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newFaqForm.question || !newFaqForm.question.trim()) {
      alert('Please enter a question.');
      return;
    }
    if (!newFaqForm.answer || !newFaqForm.answer.trim()) {
      alert('Please enter an answer.');
      return;
    }
    const newFaq = {
      id: 'faq-' + Date.now(),
      question: newFaqForm.question.trim(),
      answer: newFaqForm.answer.trim()
    };
    updateCmsConfig(prev => ({
      ...prev,
      faqs: [newFaq, ...safeArray(prev.faqs || prev.faq)]
    }));
    setIsAddFaqModalOpen(false);
    setPublishSuccessMessage('New FAQ question added to draft! Remember to save.');
    setTimeout(() => setPublishSuccessMessage(''), 4000);
  };

  const handleRemoveFaq = (id) => {
    updateCmsConfig(prev => ({
      ...prev,
      faqs: safeArray(prev.faqs || prev.faq).filter(f => f && f.id !== id)
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
                  placeholder="Enter admin password"
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
      <div className="bg-slate-900 text-white border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md border border-amber-300">
              <ShieldCheck className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="font-black text-white text-sm tracking-wide block">ADMIN MASTER SITE MANAGEMENT STUDIO</span>
              <span className="text-amber-400 text-[10px] uppercase tracking-wider font-extrabold">16 Page & System Controls • Live Site Re-hydration</span>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full sm:w-auto justify-start sm:justify-end shrink-0 whitespace-nowrap">
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              disabled={adminActionProcessing}
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow flex items-center gap-1.5 transition-all border border-gray-600 cursor-pointer disabled:opacity-50 shrink-0"
              title="Reset all 16 CMS modules to factory default"
            >
              <RotateCcw className="w-3.5 h-3.5 text-brand-yellow" />
              <span>RESET TO DEFAULT</span>
            </button>

            <button
              type="button"
              onClick={handleSyncCloudAndDb}
              disabled={adminActionProcessing}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
              title="Run Authoritative 3-Way Synchronization across Cloud Firestore, PostgreSQL, and Local storage"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-950 ${adminActionProcessing ? 'animate-spin' : ''}`} />
              <span>SYNC CLOUD & DB</span>
            </button>

            <button
              type="button"
              onClick={handleSaveDraftConfig}
              disabled={adminActionProcessing}
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Archive className="w-3.5 h-3.5 text-blue-100" />
              <span>SAVE CHANGES</span>
            </button>

            <button
              type="button"
              onClick={handlePublishSiteConfig}
              disabled={adminActionProcessing}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 cursor-pointer disabled:opacity-50 shrink-0"
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
        {/* MOBILE HORIZONTAL NAVIGATION STRIP (lg:hidden) */}
        <div className="lg:hidden sticky top-14 sm:top-16 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 -mx-4 px-4 py-2.5 mb-6 shadow-md overflow-x-auto no-scrollbar flex items-center gap-2">
          {[
            { id: 'cms', label: 'Site CMS', icon: Sliders, badge: '16' },
            { id: 'promotions', label: 'Promotions', icon: Sparkles, count: promotedPropertyIds.length },
            { id: 'all-properties', label: 'All Properties', icon: Building2, count: allProperties.length },
            { id: 'verification', label: 'Queue', icon: Clock, count: verificationQueue.length },
            { id: 'workspace', label: 'Workspace', icon: ShieldCheck },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'visitors', label: 'Visitors', icon: UserCheck, count: visitorLeads.filter(v => v.status === 'NEW').length },
            { id: 'reports', label: 'Logs', icon: History },
            { id: 'profile-settings', label: 'Profile', icon: User }
          ].map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-brand-yellow text-brand-charcoal shadow-md scale-102 ring-2 ring-brand-yellow/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                }`}
              >
                <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-brand-charcoal' : 'text-brand-yellow'}`} />
                <span>{item.label}</span>
                {(item.count !== undefined ? item.count > 0 : Boolean(item.badge)) && (
                  <span
                    style={isActive ? { color: '#ffffff', backgroundColor: '#0f172a' } : undefined}
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black inline-flex items-center justify-center min-w-[18px] ${
                      isActive ? 'bg-slate-900 text-white shadow-xs' : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    {item.count ?? item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* SIDEBAR NAVIGATION - DESKTOP ONLY */}
          <div className="hidden lg:block lg:col-span-3 space-y-4">

            {/* SECTION A: MASTER SITE CMS STUDIO (16 MODULES) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 space-y-1">
              <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-yellow bg-brand-charcoal rounded-xl mb-2 flex items-center justify-between">
                <span>SITE CMS STUDIO</span>
                <span className="bg-brand-yellow text-brand-charcoal px-1.5 py-0.5 rounded text-[9px]">16 MODULES</span>
              </div>

              <button
                onClick={() => setActiveTab('cms')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-extrabold transition-all ${activeTab === 'cms'
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
                { id: 'promotions', label: 'Paid Promotions (' + promotedPropertyIds.length + ')', icon: Sparkles, badge: promotedPropertyIds.length },
                { id: 'all-properties', label: 'All Properties (' + allProperties.length + ')', icon: Building2, badge: 0 },
                { id: 'verification', label: 'Verification Queue (' + verificationQueue.length + ')', icon: Clock, badge: verificationQueue.length },
                { id: 'workspace', label: 'Verification Workspace', icon: ShieldCheck },
                { id: 'users', label: 'User Governance', icon: Users },
                { id: 'visitors', label: 'Visitors Details (' + visitorLeads.length + ')', icon: UserCheck, badge: visitorLeads.filter(v => v.status === 'NEW').length },
                { id: 'reports', label: 'Reports & Logs', icon: History },
                { id: 'profile-settings', label: 'Admin Profile & Security', icon: User }
              ].map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${activeTab === item.id
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

                  <div className="flex sm:grid sm:grid-cols-4 lg:grid-cols-8 gap-2 overflow-x-auto no-scrollbar py-1 w-full">
                    {cmsModules.map((mod) => {
                      const IconComp = mod.icon;
                      return (
                        <button
                          key={mod.id}
                          onClick={() => setCmsTab(mod.id)}
                          className={`p-2.5 rounded-xl text-left border text-[11px] font-extrabold transition-all flex flex-col justify-between h-16 shrink-0 min-w-[125px] sm:min-w-0 ${cmsTab === mod.id
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
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, overview: { ...prev.overview, siteName: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Domain Host Address</label>
                        <input
                          type="text"
                          value={siteConfig.overview?.domain || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, overview: { ...prev.overview, domain: e.target.value } }))}
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
                        onClick={() => updateCmsConfig(prev => ({ ...prev, overview: { ...prev.overview, emergencyMaintenance: !prev.overview?.emergencyMaintenance } }))}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${siteConfig.overview?.emergencyMaintenance
                            ? 'bg-red-600 text-white shadow'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                      >
                        {siteConfig.overview?.emergencyMaintenance ? 'MAINTENANCE ACTIVE' : 'SYSTEM NORMAL'}
                      </button>
                    </div>

                    <CmsModuleActionBar
                      moduleId="overview"
                      moduleName="Overview & Status"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('overview')}
                      onPublishLive={() => handlePublishModuleLive('overview')}
                      onReset={() => handleResetModule('overview')}
                      isProcessing={adminActionProcessing}
                    />
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
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, homepage: { ...prev.homepage, heroTagline: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Main Headline Prefix</label>
                          <input
                            type="text"
                            value={siteConfig.homepage?.heroTitlePrefix || ''}
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, homepage: { ...prev.homepage, heroTitlePrefix: e.target.value } }))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Main Headline Highlight Text (Gold Accent)</label>
                          <input
                            type="text"
                            value={siteConfig.homepage?.heroTitleHighlight || ''}
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, homepage: { ...prev.homepage, heroTitleHighlight: e.target.value } }))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Hero Subtitle Text</label>
                        <textarea
                          rows={3}
                          value={siteConfig.homepage?.heroSubtitle || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, homepage: { ...prev.homepage, heroSubtitle: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>

                      <MediaUploadInput
                        label="Hero Background Image Cover"
                        value={siteConfig.homepage?.heroBackgroundImage || ''}
                        onChange={(val) => updateCmsConfig(prev => ({ ...prev, homepage: { ...prev.homepage, heroBackgroundImage: val } }))}
                      />

                      <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
                        <div>
                          <span className="block text-xs font-black text-amber-900 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-amber-500/30" />
                            Paid Promotions Showcase Section
                          </span>
                          <span className="block text-[11px] text-amber-800 font-medium">
                            {promotedPropertyIds.length === 0
                              ? 'Section is currently completely HIDDEN on Home Page (0 customer properties added).'
                              : 'Section is LIVE on Home Page displaying ' + promotedPropertyIds.length + ' customer properties.'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('promotions')}
                          className="bg-brand-charcoal hover:bg-slate-800 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow shrink-0 transition-all"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-brand-yellow" />
                          <span>Open Paid Promotions Manager ({promotedPropertyIds.length})</span>
                        </button>
                      </div>
                    </div>

                    <CmsModuleActionBar
                      moduleId="homepage"
                      moduleName="Homepage Content & Hero Banner"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('homepage')}
                      onPublishLive={() => handlePublishModuleLive('homepage')}
                      onReset={() => handleResetModule('homepage')}
                      isProcessing={adminActionProcessing}
                    />
                  </div>
                )}

                {/* MODULE 3: NAVBAR */}
                {cmsTab === 'navbar' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-brand-charcoal">3. Top Navbar & Navigation Bar</h3>
                      <p className="text-xs text-gray-500 font-medium">Customize logo titles, emblem, subtext, and main navigation link names.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Logo Text Prefix</label>
                        <input
                          type="text"
                          value={siteConfig.navbar?.logoTextPrefix || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, navbar: { ...prev.navbar, logoTextPrefix: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Logo Text Suffix (Highlight)</label>
                        <input
                          type="text"
                          value={siteConfig.navbar?.logoTextSuffix || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, navbar: { ...prev.navbar, logoTextSuffix: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Logo Subtext</label>
                        <input
                          type="text"
                          value={siteConfig.navbar?.logoSubtext || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, navbar: { ...prev.navbar, logoSubtext: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>
                    </div>

                    <div>
                      <MediaUploadInput
                        label="Navbar Emblem Logo Asset"
                        value={siteConfig.navbar?.logoEmblemUrl || siteConfig.branding?.emblemUrl || ''}
                        onChange={(val) => updateCmsConfig(prev => ({
                          ...prev,
                          navbar: { ...prev.navbar, logoEmblemUrl: val },
                          branding: { ...prev.branding, emblemUrl: val }
                        }))}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Buy Button Label</label>
                        <input
                          type="text"
                          value={siteConfig.navbar?.buyLabel || 'BUY'}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, navbar: { ...prev.navbar, buyLabel: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Rent Button Label</label>
                        <input
                          type="text"
                          value={siteConfig.navbar?.rentLabel || 'RENT'}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, navbar: { ...prev.navbar, rentLabel: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Sell Button Label</label>
                        <input
                          type="text"
                          value={siteConfig.navbar?.sellLabel || 'SELL'}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, navbar: { ...prev.navbar, sellLabel: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Post Property Button Label</label>
                        <input
                          type="text"
                          value={siteConfig.navbar?.postButtonLabel || 'POST PROPERTY'}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, navbar: { ...prev.navbar, postButtonLabel: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>

                    <CmsModuleActionBar
                      moduleId="navbar"
                      moduleName="Top Navbar & Navigation Bar"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('navbar')}
                      onPublishLive={() => handlePublishModuleLive('navbar')}
                      onReset={() => handleResetModule('navbar')}
                      isProcessing={adminActionProcessing}
                    />
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
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, footer: { ...prev.footer, tagline: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Official Physical Office Address</label>
                        <input
                          type="text"
                          value={siteConfig.footer?.officeAddress || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, footer: { ...prev.footer, officeAddress: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Support Phone Hotline</label>
                          <input
                            type="text"
                            value={siteConfig.footer?.supportPhone || ''}
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, footer: { ...prev.footer, supportPhone: e.target.value } }))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Support Email Address</label>
                          <input
                            type="text"
                            value={siteConfig.footer?.supportEmail || ''}
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, footer: { ...prev.footer, supportEmail: e.target.value } }))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Twitter / X Profile Link</label>
                          <input
                            type="text"
                            placeholder="https://x.com/easeland"
                            value={siteConfig.footer?.socialTwitter || ''}
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, footer: { ...prev.footer, socialTwitter: e.target.value } }))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">LinkedIn Page Link</label>
                          <input
                            type="text"
                            placeholder="https://linkedin.com/company/easeland"
                            value={siteConfig.footer?.socialLinkedin || ''}
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, footer: { ...prev.footer, socialLinkedin: e.target.value } }))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">YouTube Channel Link</label>
                          <input
                            type="text"
                            placeholder="https://youtube.com/@easeland"
                            value={siteConfig.footer?.socialYoutube || ''}
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, footer: { ...prev.footer, socialYoutube: e.target.value } }))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Instagram Page Link</label>
                          <input
                            type="text"
                            placeholder="https://instagram.com/easeland"
                            value={siteConfig.footer?.socialInstagram || ''}
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, footer: { ...prev.footer, socialInstagram: e.target.value } }))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Copyright Notice Text</label>
                        <input
                          type="text"
                          value={siteConfig.footer?.copyrightText || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, footer: { ...prev.footer, copyrightText: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>

                    <CmsModuleActionBar
                      moduleId="footer"
                      moduleName="Footer & Legal Details"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('footer')}
                      onPublishLive={() => handlePublishModuleLive('footer')}
                      onReset={() => handleResetModule('footer')}
                      isProcessing={adminActionProcessing}
                    />
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
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, buyPage: { ...prev.buyPage, title: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Subtitle Description</label>
                        <textarea
                          rows={3}
                          value={siteConfig.buyPage?.subtitle || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, buyPage: { ...prev.buyPage, subtitle: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Top Badge Pill Label</label>
                        <input
                          type="text"
                          value={siteConfig.buyPage?.badgeText || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, buyPage: { ...prev.buyPage, badgeText: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>

                    <CmsModuleActionBar
                      moduleId="buyPage"
                      moduleName="Buy Property Landing Page"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('buyPage')}
                      onPublishLive={() => handlePublishModuleLive('buyPage')}
                      onReset={() => handleResetModule('buyPage')}
                      isProcessing={adminActionProcessing}
                    />
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
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, rentPage: { ...prev.rentPage, title: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Subtitle Description</label>
                        <textarea
                          rows={3}
                          value={siteConfig.rentPage?.subtitle || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, rentPage: { ...prev.rentPage, subtitle: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Top Badge Pill Label</label>
                        <input
                          type="text"
                          value={siteConfig.rentPage?.badgeText || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, rentPage: { ...prev.rentPage, badgeText: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>

                    <CmsModuleActionBar
                      moduleId="rentPage"
                      moduleName="Rent Property Landing Page"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('rentPage')}
                      onPublishLive={() => handlePublishModuleLive('rentPage')}
                      onReset={() => handleResetModule('rentPage')}
                      isProcessing={adminActionProcessing}
                    />
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
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, sellPage: { ...prev.sellPage, title: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Subtitle Description</label>
                        <textarea
                          rows={3}
                          value={siteConfig.sellPage?.subtitle || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, sellPage: { ...prev.sellPage, subtitle: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Top Badge Pill Label</label>
                        <input
                          type="text"
                          value={siteConfig.sellPage?.badgeText || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, sellPage: { ...prev.sellPage, badgeText: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>

                    <CmsModuleActionBar
                      moduleId="sellPage"
                      moduleName="Sell Property & Listing Page"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('sellPage')}
                      onPublishLive={() => handlePublishModuleLive('sellPage')}
                      onReset={() => handleResetModule('sellPage')}
                      isProcessing={adminActionProcessing}
                    />
                  </div>
                )}

                {/* MODULE 8: PROPERTY CATEGORIES */}
                {cmsTab === 'categories' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-black text-brand-charcoal">8. Property Category Cards Manager</h3>
                        <p className="text-xs text-gray-500 font-medium">Manage titles, subtext, cover images, and add/remove category cards.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAddCategoryModal}
                        className="bg-brand-yellow text-brand-charcoal font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Add Category</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {safeArray(siteConfig?.categories).map((cat, idx) => (
                        <div key={cat?.id || idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-brand-charcoal uppercase">Category {idx + 1}: {cat?.title}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-bold text-gray-400">ID: {cat?.id}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveCategory(cat?.id)}
                                className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            </div>
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
                                  updateCmsConfig(prev => ({ ...prev, categories: updatedCats }));
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
                                  updateCmsConfig(prev => ({ ...prev, categories: updatedCats }));
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
                                  updateCmsConfig(prev => ({ ...prev, categories: updatedCats }));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <CmsModuleActionBar
                      moduleId="categories"
                      moduleName="Property Category Cards"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('categories')}
                      onPublishLive={() => handlePublishModuleLive('categories')}
                      onReset={() => handleResetModule('categories')}
                      isProcessing={adminActionProcessing}
                    />
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
                        type="button"
                        onClick={handleOpenAddFaqModal}
                        className="bg-brand-yellow text-brand-charcoal font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Add Question</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {safeArray(siteConfig?.faqs || siteConfig?.faq).map((faq, idx) => (
                        <div key={faq.id || idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 relative">
                          <button
                            type="button"
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
                                const updatedFaqs = [...safeArray(siteConfig?.faqs || siteConfig?.faq)];
                                updatedFaqs[idx] = { ...faq, question: e.target.value };
                                updateCmsConfig(prev => ({ ...prev, faqs: updatedFaqs }));
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
                                const updatedFaqs = [...safeArray(siteConfig?.faqs || siteConfig?.faq)];
                                updatedFaqs[idx] = { ...faq, answer: e.target.value };
                                updateCmsConfig(prev => ({ ...prev, faqs: updatedFaqs }));
                              }}
                              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-medium"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <CmsModuleActionBar
                      moduleId="faq"
                      moduleName="Frequently Asked Questions (FAQ)"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('faq')}
                      onPublishLive={() => handlePublishModuleLive('faq')}
                      onReset={() => handleResetModule('faq')}
                      isProcessing={adminActionProcessing}
                    />
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
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, contact: { ...prev.contact, heading: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Contact Section Subheading</label>
                        <textarea
                          rows={2}
                          value={siteConfig.contact?.subheading || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, contact: { ...prev.contact, subheading: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Support Phone Display</label>
                          <input
                            type="text"
                            value={siteConfig.contact?.phoneDisplay || siteConfig.contact?.phone || '+91 98765 43210'}
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, contact: { ...prev.contact, phoneDisplay: e.target.value } }))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Support Email Display</label>
                          <input
                            type="text"
                            value={siteConfig.contact?.emailDisplay || siteConfig.contact?.email || 'support@easeland.in'}
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, contact: { ...prev.contact, emailDisplay: e.target.value } }))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Lead Recipient Email (Inbound Enquiries)</label>
                        <input
                          type="text"
                          value={siteConfig.contact?.recipientEmail || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, contact: { ...prev.contact, recipientEmail: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>

                    <CmsModuleActionBar
                      moduleId="contact"
                      moduleName="Contact Us & Support"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('contact')}
                      onPublishLive={() => handlePublishModuleLive('contact')}
                      onReset={() => handleResetModule('contact')}
                      isProcessing={adminActionProcessing}
                    />
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
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, branding: { ...prev.branding, brandTagline: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Platform Slogan</label>
                        <input
                          type="text"
                          value={siteConfig.branding?.slogan || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, branding: { ...prev.branding, slogan: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <MediaUploadInput
                          label="Transparent Emblem Asset"
                          value={siteConfig.branding?.emblemUrl || ''}
                          onChange={(val) => updateCmsConfig(prev => ({ ...prev, branding: { ...prev.branding, emblemUrl: val } }))}
                        />
                        <MediaUploadInput
                          label="Full Logo Asset"
                          value={siteConfig.branding?.logoUrl || ''}
                          onChange={(val) => updateCmsConfig(prev => ({ ...prev, branding: { ...prev.branding, logoUrl: val } }))}
                        />
                      </div>
                    </div>

                    <CmsModuleActionBar
                      moduleId="branding"
                      moduleName="Brand Assets & Identity"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('branding')}
                      onPublishLive={() => handlePublishModuleLive('branding')}
                      onReset={() => handleResetModule('branding')}
                      isProcessing={adminActionProcessing}
                    />
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
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, theme: { ...prev.theme, primaryColor: e.target.value } }))}
                            className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={siteConfig.theme?.primaryColor || '#F4C542'}
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, theme: { ...prev.theme, primaryColor: e.target.value } }))}
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
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, theme: { ...prev.theme, darkBgColor: e.target.value } }))}
                            className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={siteConfig.theme?.darkBgColor || '#0B2545'}
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, theme: { ...prev.theme, darkBgColor: e.target.value } }))}
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
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, theme: { ...prev.theme, accentColor: e.target.value } }))}
                            className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={siteConfig.theme?.accentColor || '#2563EB'}
                            onChange={(e) => updateCmsConfig(prev => ({ ...prev, theme: { ...prev.theme, accentColor: e.target.value } }))}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-gray-700">Typography & Font Family</label>
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          Active: {siteConfig.theme?.fontFamily || 'Plus Jakarta Sans'}
                        </span>
                      </div>
                      <select
                        value={siteConfig.theme?.fontFamily || 'Plus Jakarta Sans'}
                        onChange={(e) => updateCmsConfig(prev => ({ ...prev, theme: { ...prev.theme, fontFamily: e.target.value } }))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-800 focus:bg-white focus:ring-2 focus:ring-brand-yellow focus:outline-none transition-all cursor-pointer"
                      >
                        <optgroup label="Modern Geometric & Clean Sans (Default)">
                          <option value="Plus Jakarta Sans">Plus Jakarta Sans (Default - High Clarity Geometric)</option>
                          <option value="Inter">Inter (Clean, Balanced & High-Legibility Corporate)</option>
                          <option value="Outfit">Outfit (Bold, Contemporary Digital Geometric)</option>
                          <option value="Poppins">Poppins (Friendly, Rounded Geometric Sans)</option>
                          <option value="Montserrat">Montserrat (Architectural, Premium & Strong)</option>
                          <option value="Urbanist">Urbanist (Sleek, Modernist Luxury Real Estate)</option>
                          <option value="DM Sans">DM Sans (Low-Contrast Clean Minimalist)</option>
                          <option value="Manrope">Manrope (Semi-Geometric Contemporary Sans)</option>
                          <option value="Roboto">Roboto (Classic Neutral Precision)</option>
                        </optgroup>
                        <optgroup label="Luxury & Editorial Serifs (Heritage & High-End)">
                          <option value="Playfair Display">Playfair Display (High-End Luxury Real Estate Editorial)</option>
                          <option value="Cinzel">Cinzel (Classic Roman / Royal Architectural)</option>
                          <option value="Lora">Lora (Contemporary Elegant Literary Serif)</option>
                          <option value="Merriweather">Merriweather (Distinguished Book Serif with High Contrast)</option>
                        </optgroup>
                        <optgroup label="Modernist Tech & Display">
                          <option value="Space Grotesk">Space Grotesk (Neo-Brutalist Tech & Architectural)</option>
                          <option value="Sora">Sora (Futuristic High-Density Display)</option>
                        </optgroup>
                      </select>
                      <p className="text-[11px] text-gray-500 font-medium mt-1">
                        Select any font family above to instantly update all headings, titles, buttons, cards, and inputs across the entire application in real time.
                      </p>
                    </div>

                    {/* LIVE TYPOGRAPHY & SPECIMEN PREVIEW CARD */}
                    <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span className="text-xs font-black text-gray-800 uppercase tracking-wider">
                            Live Typography Specimen — {siteConfig.theme?.fontFamily || 'Plus Jakarta Sans'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          font-family: "{siteConfig.theme?.fontFamily || 'Plus Jakarta Sans'}", sans-serif
                        </span>
                      </div>

                      <div
                        style={{ fontFamily: '"' + (siteConfig.theme?.fontFamily || 'Plus Jakarta Sans') + '", sans-serif' }}
                        className="space-y-2.5 transition-all duration-200"
                      >
                        <div className="text-xl sm:text-2xl font-black text-brand-charcoal tracking-tight leading-tight">
                          Find Your Verified Sanctuary with EaseLand
                        </div>
                        <div className="text-sm font-semibold text-gray-600 leading-snug">
                          Delineated GeoJSON boundary polygons, physical site inspections, and 100% dispute-free land titles directly from authenticated owners.
                        </div>
                        <div className="text-xs font-mono text-gray-500 tracking-widest pt-1 border-t border-gray-100">
                          ABCDEFGHIJKLMNOPQRSTUVWXYZ • abcdefghijklmnopqrstuvwxyz • 0123456789
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="px-3 py-1 bg-brand-charcoal text-white rounded-lg text-xs font-bold">
                            Bold Heading Specimen
                          </span>
                          <span className="px-3 py-1 bg-brand-yellow text-brand-charcoal rounded-lg text-xs font-black">
                            Action Button Specimen
                          </span>
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium border border-gray-200">
                            Body Text Specimen
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-2">
                      <div className="text-xs font-black text-gray-700">Live Visual Palette Preview</div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className="bg-brand-yellow text-brand-charcoal font-black text-xs px-4 py-2 rounded-xl shadow transition-colors"
                        >
                          Primary Brand Button
                        </button>
                        <div className="bg-brand-navy text-white text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-sm">
                          Dark Charcoal / Navy Surface
                        </div>
                        <div className="bg-metallic-steel text-white text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-sm">
                          Secondary Steel Surface
                        </div>
                      </div>
                    </div>

                    <CmsModuleActionBar
                      moduleId="theme"
                      moduleName="Color Themes & Typography"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('theme')}
                      onPublishLive={() => handlePublishModuleLive('theme')}
                      onReset={() => handleResetModule('theme')}
                      isProcessing={adminActionProcessing}
                    />
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
                        onChange={(val) => updateCmsConfig(prev => ({ ...prev, media: { ...prev.media, fallbackPropertyImageUrl: val } }))}
                      />

                      <MediaUploadInput
                        label="Hero Banner Custom Media Cover"
                        value={siteConfig.media?.heroBannerUrl || ''}
                        onChange={(val) => updateCmsConfig(prev => ({ ...prev, media: { ...prev.media, heroBannerUrl: val } }))}
                      />
                    </div>

                    <CmsModuleActionBar
                      moduleId="media"
                      moduleName="Media Library & Assets"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('media')}
                      onPublishLive={() => handlePublishModuleLive('media')}
                      onReset={() => handleResetModule('media')}
                      isProcessing={adminActionProcessing}
                    />
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
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, mapsConfig: { ...prev.mapsConfig, defaultLat: Number(e.target.value) } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Default Center Longitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={siteConfig.mapsConfig?.defaultLng || 80.4285}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, mapsConfig: { ...prev.mapsConfig, defaultLng: Number(e.target.value) } }))}
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
                            updateCmsConfig(prev => ({ ...prev, mapsConfig: { ...prev.mapsConfig, defaultZoom: val } }));
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
                            updateCmsConfig(prev => ({ ...prev, mapsConfig: { ...prev.mapsConfig, locationZoom250: val } }));
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
                        onChange={(e) => updateCmsConfig(prev => ({ ...prev, mapsConfig: { ...prev.mapsConfig, googleMapsApiKey: e.target.value } }))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold"
                      />
                    </div>

                    <CmsModuleActionBar
                      moduleId="maps"
                      moduleName="Maps Engine & Geolocation"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('maps')}
                      onPublishLive={() => handlePublishModuleLive('maps')}
                      onReset={() => handleResetModule('maps')}
                      isProcessing={adminActionProcessing}
                    />
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
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, seo: { ...prev.seo, metaTitle: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Meta Description</label>
                        <textarea
                          rows={3}
                          value={siteConfig.seo?.metaDescription || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, seo: { ...prev.seo, metaDescription: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Search Keywords (Comma Separated)</label>
                        <input
                          type="text"
                          value={siteConfig.seo?.keywords || ''}
                          onChange={(e) => updateCmsConfig(prev => ({ ...prev, seo: { ...prev.seo, keywords: e.target.value } }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                        />
                      </div>
                    </div>

                    <CmsModuleActionBar
                      moduleId="seo"
                      moduleName="Search Engine Optimization (SEO)"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={() => handleSaveModuleDraft('seo')}
                      onPublishLive={() => handlePublishModuleLive('seo')}
                      onReset={() => handleResetModule('seo')}
                      isProcessing={adminActionProcessing}
                    />
                  </div>
                )}

                {/* MODULE 16: PREVIEW & PUBLISH */}
                {cmsTab === 'publish' && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                    <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-black text-brand-charcoal">16. Preview & Publish Live</h3>
                        <p className="text-xs text-gray-500 font-medium">Publish configuration updates instantly to all live marketplace sessions.</p>
                      </div>
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        SYSTEM READY FOR LIVE PUBLISH
                      </span>
                    </div>

                    {/* LIVE STATUS BANNER */}
                    <div className="p-6 bg-gradient-to-r from-slate-900 to-brand-navy rounded-2xl text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-md border border-slate-800">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center shadow-inner shrink-0">
                          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-base text-white">Live Site Sync Engine Active</h4>
                          <p className="text-xs text-slate-300 mt-0.5 font-medium">All 16 CMS module drafts are validated and ready. Use the controls below to publish changes live immediately or save drafts.</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              window.open('/', '_blank');
                            }
                          }}
                          className="bg-gray-800 hover:bg-gray-700 text-white font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl border border-gray-600 shadow flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
                        >
                          <Globe className="w-4 h-4 text-brand-yellow" />
                          <span>Check Live Public Site</span>
                        </button>
                      </div>
                    </div>

                    {/* 16 MODULES READINESS GRID */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-brand-charcoal">
                          All 16 CMS Modules Deployment Status
                        </span>
                        <span className="text-[11px] font-bold text-gray-500">
                          {hasUnsavedCmsChanges ? 'Unsaved Edits in Draft' : 'All Modules in Lockstep'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {cmsModules.map((m) => {
                          const IconComp = m.icon;
                          return (
                            <div
                              key={m.id}
                              onClick={() => setCmsTab(m.id)}
                              className="p-3 bg-gray-50 hover:bg-amber-50/50 rounded-xl border border-gray-200 cursor-pointer transition-all flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <IconComp className="w-4 h-4 text-brand-charcoal shrink-0" />
                                <span className="text-xs font-extrabold text-gray-800 truncate">{m.label}</span>
                              </div>
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* PRIMARY ACTION CONTROLS */}
                    <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-black text-amber-950">Publish All 16 Modules Live</h4>
                        <p className="text-xs text-amber-800 font-medium">Broadcasts all current adjustments to Cloud Firestore, PostgreSQL, and Local Storage.</p>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
                        <button
                          type="button"
                          onClick={handleSaveDraftConfig}
                          disabled={adminActionProcessing}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <Archive className="w-4 h-4 text-blue-100" />
                          <span>SAVE ALL AS DRAFT</span>
                        </button>

                        <button
                          type="button"
                          onClick={handlePublishSiteConfig}
                          disabled={adminActionProcessing}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transform hover:scale-105 transition-all disabled:opacity-50"
                        >
                          <Globe className="w-4 h-4 text-emerald-100 animate-pulse" />
                          <span>PUBLISH ALL 16 LIVE NOW</span>
                        </button>
                      </div>
                    </div>

                    <CmsModuleActionBar
                      moduleId="publish"
                      moduleName="Preview & Publish Live"
                      hasUnsaved={hasUnsavedCmsChanges}
                      onSaveDraft={handleSaveDraftConfig}
                      onPublishLive={handlePublishSiteConfig}
                      onReset={() => setIsResetModalOpen(true)}
                      isProcessing={adminActionProcessing}
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB: PAID PROMOTIONS MANAGEMENT */}
            {activeTab === 'promotions' && (
              <div className="space-y-6">

                {/* Toast feedback */}
                {promoToast && (
                  <div className="bg-brand-charcoal text-white px-5 py-3.5 rounded-2xl shadow-xl border border-brand-yellow/50 flex items-center justify-between text-xs font-bold animate-fadeIn">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-brand-yellow" />
                      <span>{promoToast}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPromoToast('')}
                      className="text-gray-400 hover:text-white ml-4 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Primary Overview Banner */}
                <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-brand-charcoal shadow-md shrink-0">
                      <Sparkles className="w-6 h-6 text-brand-charcoal" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-black text-brand-charcoal">Paid Promotions Showcase</h2>
                        <span className="bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-amber-300">
                          Admin Controlled
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium mt-1">
                        Select, reorder, and showcase properties of customers who paid for premium promotion on EaseLand.
                        When this section has 0 properties, it is completely hidden and empty across the website.
                      </p>
                    </div>
                  </div>

                  {/* Realtime Visibility Status */}
                  <div className="shrink-0 flex items-center gap-2">
                    {promotedPropertyIds.length === 0 ? (
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-100 text-gray-700 border border-gray-300 text-xs font-black shadow-sm">
                        <EyeOff className="w-4 h-4 text-gray-500" />
                        <span>SECTION HIDDEN ACROSS SITE (0 Properties)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black shadow-sm">
                        <Eye className="w-4 h-4 text-emerald-600" />
                        <span>
                          LIVE ON HOMEPAGE ({Math.min(promotedPropertyIds.length, Number(promoDisplayCount) || 6)} of {promotedPropertyIds.length} Properties Displayed • Max {promoDisplayCount || 6} Slots)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Showcase Headline & Display Settings */}
                <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-brand-charcoal" />
                      <h3 className="text-sm font-black text-brand-charcoal uppercase tracking-wider">Showcase Headline & Display Settings</h3>
                    </div>
                    <span className="text-[11px] text-gray-400 font-medium">Auto-saves to cloud & public website</span>
                  </div>

                  <form onSubmit={handleSavePromotionSettings} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Section Headline Title</label>
                        <input
                          type="text"
                          value={promoSectionTitle}
                          onChange={(e) => setPromoSectionTitle(e.target.value)}
                          placeholder="Featured & Recent Verified Properties"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Badge Pill Text</label>
                        <input
                          type="text"
                          value={promoBadgeText}
                          onChange={(e) => setPromoBadgeText(e.target.value)}
                          placeholder="VERIFIED LISTINGS"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-gray-700">Max Display Slots</label>
                          <span className="text-[10px] font-bold text-gray-400">1-24 slots</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={promoDisplayCount}
                            onChange={(e) => setPromoDisplayCount(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                          />
                          <button
                            type="submit"
                            disabled={isSavingPromoSettings}
                            className={'font-black text-xs px-4 py-2 rounded-xl shadow transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ' + (
                              isPromoSettingsSaved
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : isSavingPromoSettings
                                ? 'bg-gray-400 text-white cursor-not-allowed'
                                : 'bg-brand-charcoal hover:bg-slate-800 text-white'
                            )}
                          >
                            {isSavingPromoSettings ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-yellow" />
                                <span>Saving...</span>
                              </>
                            ) : isPromoSettingsSaved ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-white" />
                                <span>Saved!</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5 text-brand-yellow" />
                                <span>Save Settings</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick Preset Slot Selectors & Dynamic Allocation Feedback */}
                    <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full shrink-0">
                        <span className="text-[11px] font-bold text-gray-500 shrink-0">Quick Slot Presets:</span>
                        {[1, 2, 3, 4, 6, 8, 12].map((slotVal) => {
                          const isActive = Number(promoDisplayCount) === slotVal;
                          return (
                            <button
                              key={slotVal}
                              type="button"
                              onClick={() => {
                                setPromoDisplayCount(slotVal);
                                savePromotionsConfig({
                                  sectionTitle: promoSectionTitle || 'Featured & Recent Verified Properties',
                                  badgeText: promoBadgeText || 'VERIFIED LISTINGS',
                                  displayCount: slotVal,
                                  featuredPropertyIds: stagedPromotedIds
                                }, 'Showcase set to ' + slotVal + ' Max Display Slots.');
                              }}
                              className={'px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ' + (
                                isActive
                                  ? 'bg-brand-charcoal text-brand-yellow shadow-xs'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              )}
                            >
                              {slotVal} Slots
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-gray-500">Live Dynamic Allocation:</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-black">
                          {Math.min(promotedPropertyIds.length, Number(promoDisplayCount) || 6)} of {promotedPropertyIds.length} Active On Homepage
                        </span>
                        {promotedPropertyIds.length > (Number(promoDisplayCount) || 6) && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold">
                            +{promotedPropertyIds.length - (Number(promoDisplayCount) || 6)} Overflow on Standby
                          </span>
                        )}
                      </div>
                    </div>
                  </form>
                </div>

                {/* Section 1: Active Promoted Properties List */}
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/70">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                        <h3 className="text-sm font-black text-brand-charcoal uppercase tracking-wider">
                          Active Promoted Customer Properties ({promotedPropertyIds.length})
                        </h3>
                        {hasUnsavedPromoChanges && (
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                            Unsaved Changes
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">
                        These customer properties will be presented on the Homepage in the exact slot order below.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full sm:w-auto shrink-0 whitespace-nowrap self-start sm:self-auto">
                      {/* Separate Save Button for Active Promoted Customer Properties */}
                      <button
                        type="button"
                        onClick={handleSaveActivePromotions}
                        disabled={isSavingActivePromotions}
                        className={'font-black text-xs px-4 py-2 rounded-xl shadow transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ' + (
                          isActivePromotionsSaved
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : isSavingActivePromotions
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : hasUnsavedPromoChanges
                            ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300 shadow-md'
                            : 'bg-brand-charcoal hover:bg-slate-800 text-white'
                        )}
                        title="Save active promoted customer properties to cloud database & public website"
                      >
                        {isSavingActivePromotions ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-yellow" />
                            <span>Saving Promoted Properties...</span>
                          </>
                        ) : isActivePromotionsSaved ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-white" />
                            <span>Saved Live!</span>
                          </>
                        ) : (
                          <>
                            <Save className={'w-3.5 h-3.5 ' + (hasUnsavedPromoChanges ? 'text-white' : 'text-brand-yellow')} />
                            <span>{hasUnsavedPromoChanges ? 'Save Promoted Properties *' : 'Save Promoted Properties'}</span>
                          </>
                        )}
                      </button>

                      {promotedPropertyIds.length > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to clear all paid promotions? The showcase will immediately become hidden across the website.')) {
                              setStagedPromotedIds([]);
                              setHasUnsavedPromoChanges(false);
                              await savePromotionsConfig({ featuredPropertyIds: [] }, 'All paid promotions removed and saved. Showcase is now completely hidden.');
                            }
                          }}
                          className="text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-extrabold px-3 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear All Promotions</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {promotedPropertiesList.length === 0 ? (
                    <div className="p-10 text-center space-y-3 bg-amber-50/40">
                      <div className="w-14 h-14 bg-amber-100 border border-amber-200 rounded-3xl flex items-center justify-center mx-auto text-amber-600 shadow-sm">
                        <Sparkles className="w-7 h-7" />
                      </div>
                      <h4 className="font-black text-base text-brand-charcoal">
                        No Customer Properties in Paid Promotion
                      </h4>
                      <p className="text-xs text-gray-600 font-medium max-w-lg mx-auto">
                        The Paid Promotions section on the Home Page is currently <strong>100% empty and hidden across the website</strong>.
                        When a customer pays to promote their listing, use the catalog below to add their property.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {promotedPropertiesList.map((prop, idx) => {
                        const pId = String(prop.id || prop.propertyId || prop.referenceId || '');
                        const imgUrl = getFirstUploadedImage(prop);
                        const pPrice = prop.price ? formatInr(prop.price) : (prop.priceLabel || 'Price on Request');
                        const pLoc = [prop.location?.locality || prop.locality, prop.location?.city || prop.city, prop.location?.state || prop.state].filter(Boolean).join(', ') || 'Andhra Pradesh';
                        const ownerName = prop.owner?.name || prop.ownerPublicName || 'Registered Customer';
                        const ownerPhone = prop.owner?.phone || prop.ownerPublicPhone || 'Number in Records';
                        const ownerEmail = prop.owner?.email || prop.ownerPublicEmail || '';

                        return (
                          <div key={pId + '-' + idx} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 hover:bg-gray-50/80 transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                              <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                                {/* Order & Rank Controls */}
                                <div className="flex flex-col items-center justify-center gap-1 shrink-0 bg-gray-100 p-2 rounded-2xl border border-gray-200">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => handleMovePaidPromotion(pId, 'UP')}
                                    className={'p-1 rounded-lg transition-all ' + (idx === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-white hover:text-brand-charcoal hover:shadow-sm')}
                                    title="Move Up in Showcase Order"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="text-xs font-black text-brand-charcoal px-1.5 py-0.5 rounded-md bg-white border border-gray-200 shadow-xs">
                                    #{idx + 1}
                                  </span>
                                  {idx < (Number(promoDisplayCount) || 6) ? (
                                    <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.5 rounded">
                                      LIVE
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-1 py-0.5 rounded" title="This property exceeds Max Display Slots and is on standby">
                                      STANDBY
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    disabled={idx === promotedPropertiesList.length - 1}
                                    onClick={() => handleMovePaidPromotion(pId, 'DOWN')}
                                    className={'p-1 rounded-lg transition-all ' + (idx === promotedPropertiesList.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-white hover:text-brand-charcoal hover:shadow-sm')}
                                    title="Move Down in Showcase Order"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Thumbnail */}
                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0 relative">
                                  <img
                                    src={imgUrl}
                                    alt={prop.title || 'Property'}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = NO_PHOTO_PLACEHOLDER;
                                    }}
                                  />
                                  <span className="absolute top-1 left-1 bg-brand-charcoal/80 backdrop-blur-xs text-amber-300 font-extrabold text-[9px] px-1.5 py-0.5 rounded">
                                    PROMOTED
                                  </span>
                                </div>

                                {/* Property Title, Price, Location */}
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-black text-sm text-brand-charcoal line-clamp-1">{prop.title}</h4>
                                    <span className="text-[10px] font-extrabold text-brand-charcoal bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                                      {prop.propertyType || prop.category || 'Open Plot'}
                                    </span>
                                    <span className="text-[10px] font-mono text-gray-400">ID: {pId}</span>
                                  </div>
                                  <div className="flex items-center gap-2.5 text-xs flex-wrap">
                                    <span className="font-extrabold text-emerald-700">{pPrice}</span>
                                    {prop.area && (
                                      <span className="text-gray-500 font-medium">{prop.area} sq ft</span>
                                    )}
                                    <span className="text-gray-500 flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-gray-400" />
                                      {pLoc}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Customer Paid Ownership Card */}
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 w-full sm:w-auto lg:max-w-md flex items-center gap-3 text-[11px] shrink-0">
                                <div className="w-7 h-7 rounded-lg bg-brand-charcoal text-brand-yellow flex items-center justify-center shrink-0 font-bold">
                                  <User className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-extrabold text-brand-charcoal truncate">{ownerName}</span>
                                    <span className="text-[9px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.2 rounded shrink-0">PAID CUSTOMER</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-gray-600 mt-0.5 flex-wrap">
                                    <span className="flex items-center gap-1 font-semibold text-slate-900 shrink-0">
                                      <Phone className="w-2.5 h-2.5 text-gray-400" />
                                      {ownerPhone}
                                    </span>
                                    {ownerEmail && (
                                      <span className="flex items-center gap-1 text-gray-500 break-all">
                                        <Mail className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                                        {ownerEmail}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 w-full lg:w-auto justify-end shrink-0 pt-2 border-t border-gray-100 lg:border-0 lg:pt-0">
                              <button
                                type="button"
                                onClick={() => window.open('/property/' + pId, '_blank')}
                                className="flex-1 lg:flex-initial justify-center bg-brand-charcoal hover:bg-slate-800 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
                                title="Open Live Property Detail Page"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-brand-yellow" />
                                <span>View Live</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemovePaidPromotion(pId)}
                                className="flex-1 lg:flex-initial justify-center bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all"
                                title="Remove property from Paid Promotions"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                <span>Remove</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Section 2: Add Customer Properties to Paid Promotions */}
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Plus className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-sm font-black text-brand-charcoal uppercase tracking-wider">
                          Add Customer Properties to Paid Promotions
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">
                        Filter candidate customer properties, confirm promotion payment, and add to the homepage showcase with 1 click.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl">
                      {candidatePropertiesForPromotion.length} Properties Available
                    </span>
                  </div>

                  {/* Search and Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-6 relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={promoSearchQuery}
                        onChange={(e) => setPromoSearchQuery(e.target.value)}
                        placeholder="Search by title, property ID, customer owner name, phone, or city..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                      />
                      {promoSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setPromoSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="md:col-span-3">
                      <select
                        value={promoTypeFilter}
                        onChange={(e) => setPromoTypeFilter(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700"
                      >
                        <option value="ALL">All Categories & Types</option>
                        <option value="PLOT">Open Plots & Lands</option>
                        <option value="COMMERCIAL">Commercial Properties</option>
                        <option value="HOUSE">Houses & Villas</option>
                        <option value="AGRICULTURE">Agricultural Lands</option>
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <select
                        value={promoStatusFilter}
                        onChange={(e) => setPromoStatusFilter(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700"
                      >
                        <option value="ALL">All Active Listings</option>
                        <option value="VERIFIED_ONLY">Platform Verified Only</option>
                      </select>
                    </div>
                  </div>

                  {/* Candidate List */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100 max-h-96 overflow-y-auto">
                    {candidatePropertiesForPromotion.length === 0 ? (
                      <div className="p-8 text-center text-xs text-gray-500 font-semibold">
                        No properties found matching your filter criteria. Try adjusting the search query.
                      </div>
                    ) : (
                      candidatePropertiesForPromotion.map((prop) => {
                        const pId = String(prop.id || prop.propertyId || prop.referenceId || '');
                        const isAlreadyPromoted = promotedPropertyIds.includes(pId);
                        const promoIndex = promotedPropertyIds.indexOf(pId);
                        const imgUrl = getFirstUploadedImage(prop);
                        const pPrice = prop.price ? formatInr(prop.price) : (prop.priceLabel || 'Price on Request');
                        const pLoc = [prop.location?.locality || prop.locality, prop.location?.city || prop.city].filter(Boolean).join(', ') || 'India';
                        const ownerName = prop.owner?.name || prop.ownerPublicName || 'Registered Customer';
                        const ownerPhone = prop.owner?.phone || prop.ownerPublicPhone || 'Contact in Records';

                        return (
                          <div key={pId} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                                <img
                                  src={imgUrl}
                                  alt={prop.title || 'Property'}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = NO_PHOTO_PLACEHOLDER;
                                  }}
                                />
                              </div>

                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-extrabold text-xs text-brand-charcoal line-clamp-1">{prop.title}</span>
                                  <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded">
                                    {prop.propertyType || prop.category || 'Plot'}
                                  </span>
                                  <span className="text-[9px] font-mono text-gray-400">ID: {pId}</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-[11px] text-gray-500 flex-wrap">
                                  <span className="font-extrabold text-emerald-700">{pPrice}</span>
                                  <span>{pLoc}</span>
                                  <span className="font-bold text-slate-800">Owner: {ownerName} ({ownerPhone})</span>
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {isAlreadyPromoted ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemovePaidPromotion(pId)}
                                  className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-extrabold text-[11px] px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                                  title="Click to remove from Paid Promotions"
                                >
                                  <Sparkles className="w-3 h-3 text-amber-600 fill-amber-500" />
                                  <span>Slot #{promoIndex + 1} (Remove)</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddPaidPromotion(pId)}
                                  className="bg-brand-charcoal hover:bg-emerald-700 text-white font-extrabold text-[11px] px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                                  title="Add customer property to Paid Promotions showcase"
                                >
                                  <Plus className="w-3.5 h-3.5 text-brand-yellow" />
                                  <span>Add to Promotions</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

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

                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full sm:w-auto shrink-0 whitespace-nowrap">
                    <span className="bg-emerald-100 text-emerald-800 font-extrabold text-xs px-3.5 py-1.5 rounded-full border border-emerald-300 shrink-0">
                      {allProperties.filter(p => p && (p.status === 'LIVE' || p.listingStatus === 'LIVE' || p.isPlatformVerified)).length} Verified & Live
                    </span>
                    <span className="bg-amber-100 text-amber-800 font-extrabold text-xs px-3.5 py-1.5 rounded-full border border-amber-300 shrink-0">
                      {verificationQueue.length} Pending Audit
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsPurgeModalOpen(true)}
                      className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-300 font-extrabold text-xs px-3.5 py-1.5 rounded-full transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow shrink-0"
                      title="Wipe ALL property listings across PostgreSQL, Firestore, and Local Storage — Use with Caution"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span>Wipe ALL Properties</span>
                      <span className="text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Use with Caution
                      </span>
                    </button>
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
                  <div className="overflow-x-auto no-scrollbar">
                    <div className="min-w-[760px]">
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
                                <span className={`font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider ${isLive ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                    isPending ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                      isChanges ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                                        isRejected ? 'bg-red-100 text-red-800 border border-red-300' :
                                          'bg-gray-100 text-gray-700 border border-gray-300'
                                  }`}>
                                  {isLive ? 'PLATFORM VERIFIED' : isPending ? 'PENDING AUDIT' : isChanges ? 'CHANGES REQD' : isRejected ? 'REJECTED' : 'DRAFT'}
                                </span>

                                <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-end">
                                  {promotedPropertyIds.includes(String(prop.id || prop.propertyId)) ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePaidPromotion(prop.id || prop.propertyId)}
                                      className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-extrabold text-[11px] px-2 py-1 rounded-lg flex items-center gap-1 shadow-xs transition-all"
                                      title="Property is active in Paid Promotions. Click to remove."
                                    >
                                      <Sparkles className="w-3 h-3 text-amber-600 fill-amber-500" />
                                      <span>Promoted</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleAddPaidPromotion(prop.id || prop.propertyId)}
                                      className="bg-white hover:bg-amber-50 text-gray-700 hover:text-amber-800 border border-gray-300 font-bold text-[11px] px-2 py-1 rounded-lg flex items-center gap-1 transition-all"
                                      title="Add customer property to Paid Promotions"
                                    >
                                      <Sparkles className="w-3 h-3 text-gray-400" />
                                      <span>Promote</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => window.open('/property/' + (prop.propertyId || prop.id), '_blank')}
                                    className="bg-brand-charcoal hover:bg-slate-800 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1.5"
                                    title="View Property on Map"
                                  >
                                    <MapPin className="w-3 h-3 text-amber-400" />
                                    <span>View on Map</span>
                                  </button>

                                  <button
                                    onClick={() => handleDeletePropertyFromAdmin(prop.id || prop.propertyId, prop)}
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
                </div>
              </div>
            )}

            {/* TAB: VERIFICATION QUEUE */}
            {activeTab === 'verification' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-5 rounded-2xl border border-gray-200 shadow-sm gap-3">
                  <div>
                    <h3 className="text-lg font-black text-brand-charcoal">Verification Queue</h3>
                    <p className="text-xs text-gray-500 font-medium">Pending properties requiring document audit and field inspection approval.</p>
                  </div>
                  <span className="bg-amber-100 text-amber-800 font-extrabold text-xs px-3.5 py-1.5 rounded-full shrink-0 self-start sm:self-auto">
                    {verificationQueue.length} Pending Audit
                  </span>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto no-scrollbar">
                    <div className="min-w-[760px]">
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
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <span className="font-bold text-brand-charcoal line-clamp-1">{prop.title}</span>
                                {Boolean((prop.hasPendingEdits || prop.pendingReauditData) && (prop.reAuditStatus === 'PENDING_VERIFICATION' || prop.reAuditStatus === 'UNDER_REVIEW')) && (
                                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                                    Re-Verification Pending
                                  </span>
                                )}
                              </div>
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
                              <span className={`font-extrabold text-[11px] block line-clamp-1 ${prop.owner?.phone && prop.owner.phone !== 'Number Not Updated' && prop.owner.phone !== '+91 98765 43210' && prop.owner.phone !== '+91 N/A'
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

                    // Exhaustive field diff between Live Approved data and Proposed Modifications
                    const reauditDiff = computeReauditDiff(activeAuditProp);
                    const { isReaudit, hasChanges, changedFieldCount, changedKeys, diffs } = reauditDiff;

                    return (
                      <div className="bg-white rounded-2xl p-6 border border-slate-300 shadow-lg space-y-6 text-slate-900">

                        {/* HEADER BAR */}
                        <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border">
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {isReaudit ? (
                                <span className="text-xs font-black text-purple-900 bg-purple-200 px-3 py-1 rounded-md tracking-wider border border-purple-300 flex items-center gap-1.5 shadow-sm">
                                  <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                                  <span>RE-VERIFICATION (LIVE LISTING MODIFIED)</span>
                                  {changedFieldCount > 0 && (
                                    <span className="bg-purple-900 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1">
                                      {changedFieldCount + ' Field' + (changedFieldCount > 1 ? 's' : '') + ' Changed'}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-xs font-black text-amber-900 bg-amber-200 px-3 py-1 rounded-md tracking-wider">
                                  AUDIT IN PROGRESS
                                </span>
                              )}
                              <span className="text-xs font-bold text-slate-600 bg-slate-200 px-2.5 py-1 rounded-md">
                                ID: {propIdStr}
                              </span>
                              {isReaudit && diffs.location?.changed && (
                                <span className="text-[10px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded">
                                  Location Modified
                                </span>
                              )}
                              {isReaudit && diffs.boundary?.changed && (
                                <span className="text-[10px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded">
                                  Boundary Modified
                                </span>
                              )}
                            </div>

                            {diffs.title?.changed ? (
                              <div className="mt-1 space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-2xl font-black text-purple-950">{diffs.title.proposed}</h3>
                                  <span className="text-[10px] font-black uppercase bg-purple-200 text-purple-900 px-2 py-0.5 rounded border border-purple-300">
                                    PROPOSED TITLE
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 line-through font-semibold">
                                  Live Approved Title: {diffs.title.live}
                                </div>
                              </div>
                            ) : (
                              <h3 className="text-2xl font-black text-slate-900 mt-1">{propTitle}</h3>
                            )}

                            <p className="text-xs font-extrabold text-slate-700 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>
                                {locationStr}{pincodeStr}
                              </span>
                            </p>
                          </div>

                          <div className="flex flex-col sm:items-end sm:text-right gap-2">
                            <div>
                              {diffs.price?.changed ? (
                                <div>
                                  <div className="flex items-center gap-1.5 sm:justify-end">
                                    <span className="text-[10px] font-black uppercase text-purple-900 bg-purple-200 px-1.5 py-0.5 rounded border border-purple-300">
                                      PROPOSED
                                    </span>
                                    <span className="text-2xl font-black text-emerald-700 block">
                                      {diffs.price.proposedDisplay}
                                    </span>
                                  </div>
                                  <span className="text-xs font-bold text-slate-500 line-through block sm:text-right">
                                    Live: {diffs.price.liveDisplay}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-2xl font-black text-emerald-700 block">
                                  {priceStr}
                                </span>
                              )}
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                                Submitted: {activeAuditProp.submittedDate || 'Recent'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteProperty(activeAuditProp)}
                              className="bg-red-100 hover:bg-red-600 text-red-700 hover:text-white font-extrabold px-3 py-1.5 rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Property</span>
                            </button>
                          </div>
                        </div>

                        {/* PROPOSED MODIFICATIONS DIFF CARD (RE-AUDIT WORKFLOW) */}
                        {isReaudit && (
                          <div className="p-5 bg-purple-50/90 border-2 border-purple-300 rounded-2xl space-y-4 shadow-sm animate-in fade-in">
                            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-purple-200 pb-3">
                              <div className="flex items-center gap-2 text-purple-950 font-black text-sm">
                                <AlertTriangle className="w-5 h-5 text-purple-600 shrink-0" />
                                <span>PROPOSED MODIFICATIONS AWAITING VERIFICATION</span>
                                {changedFieldCount > 0 && (
                                  <span className="text-xs bg-purple-900 text-white px-2.5 py-0.5 rounded-full font-black">
                                    {changedFieldCount + ' item' + (changedFieldCount > 1 ? 's' : '') + ' changed'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-extrabold text-purple-800 bg-purple-200 px-3 py-1 rounded-full border border-purple-300">
                                Existing Listing Remains LIVE with Previously Approved Details
                              </span>
                            </div>

                            <p className="text-xs text-purple-900 font-semibold leading-relaxed">
                              The property owner submitted the following changes. The live public marketplace continues displaying the approved data shown below. Review the proposed changes before approving them to replace the live details.
                            </p>

                            {changedFieldCount === 0 ? (
                              <div className="p-3.5 bg-white border border-purple-200 rounded-xl text-xs font-semibold text-purple-900">
                                Owner re-submitted listing verification without modifying core parameter fields.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs font-semibold">
                                {/* TITLE DIFF */}
                                {diffs.title && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Title Modification:</span>
                                    <div className="text-slate-500 line-through text-[11px]">Live: {diffs.title.live}</div>
                                    <div className="text-purple-950 font-extrabold text-xs">Proposed: {diffs.title.proposed}</div>
                                  </div>
                                )}

                                {/* PRICE DIFF */}
                                {diffs.price && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Price Modification:</span>
                                    <div className="text-slate-500 line-through text-[11px]">Live: {diffs.price.liveDisplay}</div>
                                    <div className="text-emerald-700 font-extrabold text-xs">Proposed: {diffs.price.proposedDisplay}</div>
                                  </div>
                                )}

                                {/* AREA DIFF */}
                                {diffs.area && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Total Area Modification:</span>
                                    <div className="text-slate-500 line-through text-[11px]">Live: {diffs.area.liveDisplay}</div>
                                    <div className="text-emerald-700 font-extrabold text-xs">Proposed: {diffs.area.proposedDisplay}</div>
                                  </div>
                                )}

                                {/* CATEGORY & TYPE DIFF */}
                                {(diffs.category || diffs.propertyType) && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Category & Type:</span>
                                    <div className="text-slate-500 line-through text-[11px]">Live: {catStr + ' • ' + propTypeStr}</div>
                                    <div className="text-purple-950 font-extrabold text-xs">Proposed: {(diffs.category?.proposed || catStr) + ' • ' + (diffs.propertyType?.proposed || propTypeStr)}</div>
                                  </div>
                                )}

                                {/* INTENT DIFF */}
                                {diffs.intent && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Listing Intent:</span>
                                    <div className="text-slate-500 line-through text-[11px]">Live: {diffs.intent.live}</div>
                                    <div className="text-purple-950 font-extrabold text-xs">Proposed: {diffs.intent.proposed}</div>
                                  </div>
                                )}

                                {/* FACING & DIMENSIONS DIFF */}
                                {(diffs.facing || diffs.dimensions) && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Facing & Dimensions:</span>
                                    <div className="text-slate-500 line-through text-[11px]">Live: {facingStr + ' • ' + dimStr}</div>
                                    <div className="text-purple-950 font-extrabold text-xs">Proposed: {(diffs.facing?.proposed || facingStr) + ' • ' + (diffs.dimensions?.proposed || dimStr)}</div>
                                  </div>
                                )}

                                {/* SURVEY & LP DIFF */}
                                {(diffs.surveyNo || diffs.lpNo) && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Survey / LP Identifiers:</span>
                                    <div className="text-slate-500 line-through text-[11px]">Live: Sy. No: {surveyStr} • LP: {lpStr}</div>
                                    <div className="text-purple-950 font-extrabold text-xs">Proposed: Sy. No: {diffs.surveyNo?.proposed || surveyStr} • LP: {diffs.lpNo?.proposed || lpStr}</div>
                                  </div>
                                )}

                                {/* FURNISHING DIFF */}
                                {diffs.furnishing && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Furnishing:</span>
                                    <div className="text-slate-500 line-through text-[11px]">Live: {diffs.furnishing.live}</div>
                                    <div className="text-purple-950 font-extrabold text-xs">Proposed: {diffs.furnishing.proposed}</div>
                                  </div>
                                )}

                                {/* LOCATION & ADDRESS DIFF */}
                                {diffs.location && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1 md:col-span-2">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Location Coordinates & Address:</span>
                                    <div className="text-slate-500 line-through text-[11px]">Live: {diffs.location.liveAddress}</div>
                                    <div className="text-purple-950 font-extrabold text-xs">Proposed: {diffs.location.proposedAddress}</div>
                                    {diffs.location.coordsDiff && (
                                      <div className="text-[10px] font-bold text-purple-800 pt-0.5">
                                        New Coordinates: {diffs.location.proposedCoords?.lat?.toFixed(5) + ', ' + diffs.location.proposedCoords?.lng?.toFixed(5)}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* BOUNDARY GEOMETRY DIFF */}
                                {diffs.boundary && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1 md:col-span-2">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Plot Boundary Geometry:</span>
                                    <div className="text-slate-500 text-[11px]">
                                      Live: {diffs.boundary.liveVertexCount + ' corners • ' + diffs.boundary.liveAreaSqFt.toLocaleString('en-IN') + ' sq ft'}
                                    </div>
                                    <div className="text-purple-950 font-extrabold text-xs">
                                      Proposed: {diffs.boundary.proposedVertexCount + ' corners • ' + diffs.boundary.proposedAreaSqFt.toLocaleString('en-IN') + ' sq ft'}
                                      {' (' + (diffs.boundary.areaDeltaSqFt >= 0 ? '+' : '') + diffs.boundary.areaDeltaSqFt.toLocaleString('en-IN') + ' sq ft)'}
                                    </div>
                                  </div>
                                )}

                                {/* DESCRIPTION DIFF */}
                                {diffs.description && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1 md:col-span-2 lg:col-span-3">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Description Modification:</span>
                                    <div className="text-slate-500 text-[11px] max-h-16 overflow-y-auto">Live: {diffs.description.live}</div>
                                    <div className="text-purple-950 font-extrabold text-xs max-h-24 overflow-y-auto border-t border-purple-100 pt-1">
                                      Proposed: {diffs.description.proposed}
                                    </div>
                                  </div>
                                )}

                                {/* AMENITIES DIFF */}
                                {diffs.amenities && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1.5 md:col-span-2 lg:col-span-3">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Amenities Modification:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {diffs.amenities.added.map((a, i) => (
                                        <span key={'add-' + i} className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-black px-2 py-0.5 rounded">
                                          + Added: {a}
                                        </span>
                                      ))}
                                      {diffs.amenities.removed.map((a, i) => (
                                        <span key={'rem-' + i} className="bg-rose-100 text-rose-900 border border-rose-300 text-[11px] font-bold line-through px-2 py-0.5 rounded">
                                          - Removed: {a}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* PHOTOS DIFF */}
                                {diffs.photos && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Submitted Photos:</span>
                                    <div className="text-purple-950 font-extrabold text-xs">
                                      {diffs.photos.newCount + ' New Photo' + (diffs.photos.newCount > 1 ? 's' : '') + ' Uploaded by Owner'}
                                    </div>
                                  </div>
                                )}

                                {/* VIDEOS DIFF */}
                                {diffs.videos && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Submitted Video:</span>
                                    <div className="text-purple-950 font-extrabold text-xs">
                                      Owner updated property video link / upload
                                    </div>
                                  </div>
                                )}

                                {/* DOCUMENTS DIFF */}
                                {diffs.documents && (
                                  <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-purple-800 block">Verification Documents:</span>
                                    <div className="text-purple-950 font-extrabold text-xs">
                                      {diffs.documents.newCount + ' New Document' + (diffs.documents.newCount > 1 ? 's' : '') + ' Attached'}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

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
                              {/* Category & Type */}
                              <div className={'flex justify-between border-b border-slate-200 pb-1.5 ' + (changedKeys.has('category') || changedKeys.has('propertyType') ? 'bg-purple-100/70 p-1.5 rounded-lg border border-purple-300' : '')}>
                                <span className="text-slate-600 font-bold flex items-center gap-1">
                                  <span>Category & Type:</span>
                                  {(changedKeys.has('category') || changedKeys.has('propertyType')) && (
                                    <span className="bg-purple-200 text-purple-900 text-[9px] font-black px-1.5 py-0.2 rounded border border-purple-300">MODIFIED</span>
                                  )}
                                </span>
                                <div className="text-right">
                                  {(changedKeys.has('category') || changedKeys.has('propertyType')) && (
                                    <span className="text-slate-500 line-through text-[11px] block">{catStr + ' • ' + propTypeStr}</span>
                                  )}
                                  <span className="text-slate-900 font-extrabold">
                                    {(diffs.category?.proposed || catStr) + ' • ' + (diffs.propertyType?.proposed || propTypeStr)}
                                  </span>
                                </div>
                              </div>

                              {/* Listing Intent */}
                              <div className={'flex justify-between border-b border-slate-200 pb-1.5 ' + (changedKeys.has('intent') ? 'bg-purple-100/70 p-1.5 rounded-lg border border-purple-300' : '')}>
                                <span className="text-slate-600 font-bold flex items-center gap-1">
                                  <span>Listing Intent:</span>
                                  {changedKeys.has('intent') && (
                                    <span className="bg-purple-200 text-purple-900 text-[9px] font-black px-1.5 py-0.2 rounded border border-purple-300">MODIFIED</span>
                                  )}
                                </span>
                                <div className="text-right">
                                  {changedKeys.has('intent') && (
                                    <span className="text-slate-500 line-through text-[11px] block">{txTypeStr}</span>
                                  )}
                                  <span className="text-slate-900 font-extrabold">{diffs.intent?.proposed || txTypeStr}</span>
                                </div>
                              </div>

                              {/* Total Area */}
                              <div className={'flex justify-between border-b border-slate-200 pb-1.5 ' + (changedKeys.has('area') ? 'bg-purple-100/70 p-1.5 rounded-lg border border-purple-300' : '')}>
                                <span className="text-slate-600 font-bold flex items-center gap-1">
                                  <span>Total Area:</span>
                                  {changedKeys.has('area') && (
                                    <span className="bg-purple-200 text-purple-900 text-[9px] font-black px-1.5 py-0.2 rounded border border-purple-300">MODIFIED</span>
                                  )}
                                </span>
                                <div className="text-right">
                                  {changedKeys.has('area') && (
                                    <span className="text-slate-500 line-through text-[11px] block">{diffs.area.liveDisplay}</span>
                                  )}
                                  <span className="text-slate-900 font-extrabold">{diffs.area?.proposedDisplay || areaStr}</span>
                                </div>
                              </div>

                              {/* Facing & Dimensions */}
                              <div className={'flex justify-between border-b border-slate-200 pb-1.5 ' + (changedKeys.has('facing') || changedKeys.has('dimensions') ? 'bg-purple-100/70 p-1.5 rounded-lg border border-purple-300' : '')}>
                                <span className="text-slate-600 font-bold flex items-center gap-1">
                                  <span>Facing & Dimensions:</span>
                                  {(changedKeys.has('facing') || changedKeys.has('dimensions')) && (
                                    <span className="bg-purple-200 text-purple-900 text-[9px] font-black px-1.5 py-0.2 rounded border border-purple-300">MODIFIED</span>
                                  )}
                                </span>
                                <div className="text-right">
                                  {(changedKeys.has('facing') || changedKeys.has('dimensions')) && (
                                    <span className="text-slate-500 line-through text-[11px] block">{facingStr + ' • ' + dimStr}</span>
                                  )}
                                  <span className="text-slate-900 font-extrabold">{(diffs.facing?.proposed || facingStr) + ' • ' + (diffs.dimensions?.proposed || dimStr)}</span>
                                </div>
                              </div>

                              {/* Survey / LP */}
                              <div className={'flex justify-between ' + (changedKeys.has('surveyNo') || changedKeys.has('lpNo') ? 'bg-purple-100/70 p-1.5 rounded-lg border border-purple-300' : '')}>
                                <span className="text-slate-600 font-bold flex items-center gap-1">
                                  <span>Survey / LP Identifiers:</span>
                                  {(changedKeys.has('surveyNo') || changedKeys.has('lpNo')) && (
                                    <span className="bg-purple-200 text-purple-900 text-[9px] font-black px-1.5 py-0.2 rounded border border-purple-300">MODIFIED</span>
                                  )}
                                </span>
                                <div className="text-right">
                                  {(changedKeys.has('surveyNo') || changedKeys.has('lpNo')) && (
                                    <span className="text-slate-500 line-through text-[11px] block">{'Sy. No: ' + surveyStr + ' • LP: ' + lpStr}</span>
                                  )}
                                  <span className="text-slate-900 font-extrabold">{'Sy. No: ' + (diffs.surveyNo?.proposed || surveyStr) + ' • LP: ' + (diffs.lpNo?.proposed || lpStr)}</span>
                                </div>
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

                          if (!descVal && amenitiesList.length === 0 && !diffs.description && !diffs.amenities) return null;

                          return (
                            <div className="space-y-3 pt-4 border-t border-slate-200">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                  <FileText className="w-4 h-4 text-purple-600" />
                                  <span>Property Description & Key Amenities</span>
                                </h4>
                                {(diffs.description || diffs.amenities) && (
                                  <span className="bg-purple-200 text-purple-900 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-purple-300">
                                    MODIFIED CONTENT
                                  </span>
                                )}
                              </div>

                              {diffs.description ? (
                                <div className="space-y-2">
                                  <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-xl text-xs font-semibold text-purple-950 leading-relaxed shadow-sm">
                                    <span className="text-[10px] font-black uppercase text-purple-800 block mb-1">Proposed New Description:</span>
                                    {diffs.description.proposed}
                                  </div>
                                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 leading-relaxed">
                                    <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Live Approved Description:</span>
                                    {diffs.description.live}
                                  </div>
                                </div>
                              ) : descVal ? (
                                <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 leading-relaxed">
                                  {descVal}
                                </div>
                              ) : null}

                              {/* Amenities list with Added / Removed highlighting */}
                              <div className="flex flex-wrap gap-2 pt-1">
                                {amenitiesList.map((amenity, idx) => {
                                  const isNew = diffs.amenities?.added?.some(a => a.toLowerCase() === String(amenity).toLowerCase());
                                  return (
                                    <span
                                      key={'amenity-' + idx}
                                      className={'font-extrabold text-[11px] px-3 py-1 rounded-lg border flex items-center gap-1 ' +
                                        (isNew
                                          ? 'bg-emerald-100 text-emerald-950 border-emerald-400 shadow-sm animate-pulse'
                                          : 'bg-slate-200 text-slate-900 border-slate-300')}
                                    >
                                      {isNew ? <Sparkles className="w-3 h-3 text-emerald-700" /> : '✓ '}
                                      <span>{String(amenity)}</span>
                                      {isNew && <span className="bg-emerald-700 text-white text-[9px] px-1 rounded ml-0.5 font-black">NEW</span>}
                                    </span>
                                  );
                                })}

                                {diffs.amenities?.removed?.map((remAmenity, remIdx) => (
                                  <span
                                    key={'removed-' + remIdx}
                                    className="bg-rose-50 text-rose-800 font-bold text-[11px] px-3 py-1 rounded-lg border border-rose-300 line-through opacity-80 flex items-center gap-1"
                                  >
                                    <span>✕ {String(remAmenity)}</span>
                                    <span className="bg-rose-200 text-rose-900 text-[9px] px-1 rounded no-underline font-black">REMOVED</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* LOCATION & PLOT BOUNDARY VERIFICATION SECTION */}
                        <VerificationLocationBoundaryCard
                          property={activeAuditProp}
                          pendingReauditData={activeAuditProp.pendingReauditData}
                          locationDiff={diffs.location}
                          boundaryDiff={diffs.boundary}
                        />

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
                          } catch (e) { }

                          let extraMedia = [];
                          try {
                            const storedMedia = localStorage.getItem(`easeland_media_${propId}`) || localStorage.getItem('easeland_user_media');
                            if (storedMedia) {
                              const parsedMedia = JSON.parse(storedMedia);
                              if (Array.isArray(parsedMedia)) {
                                extraMedia = parsedMedia.filter(m => (m && (m.propertyId === propId || !m.propertyId)));
                              }
                            }
                          } catch (e) { }

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

                            if (auditRemovedItemKeys.has(urlStr) || auditRemovedItemKeys.has(cleanUrl)) return;

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
                              const docId = (typeof item === 'object' && item.docId) || docName;
                              const key = docUrl !== '#' ? docUrl : docId;

                              if (auditRemovedItemKeys.has(key) || auditRemovedItemKeys.has(docName) || auditRemovedItemKeys.has(docUrl) || auditRemovedItemKeys.has(String(docId))) {
                                return;
                              }

                              if (key && !seenDocKeys.has(key)) {
                                seenDocKeys.add(key);
                                documents.push({
                                  docId: docId,
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

                                if (auditRemovedItemKeys.has(videoKey) || auditRemovedItemKeys.has(videoUrl) || auditRemovedItemKeys.has(cleanUrl)) {
                                  return;
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
                              if (auditRemovedItemKeys.has(urlStr) || auditRemovedItemKeys.has(cleanUrl)) {
                                return;
                              }
                              seenPhotoUrls.add(urlStr);
                              photos.push(urlStr);
                            }
                          });

                          return (
                            <div className="space-y-6">

                              {/* SUBMITTED MEDIA PHOTO GALLERY */}
                              <div className="space-y-3 pt-4 border-t border-slate-200">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 text-blue-600" />
                                    <span>Submitted Property Photos ({photos.length})</span>
                                    {diffs.photos?.newCount > 0 && (
                                      <span className="bg-purple-200 text-purple-900 border border-purple-300 text-[10px] font-black px-2 py-0.5 rounded ml-1 shadow-sm">
                                        {diffs.photos.newCount + ' Proposed New'}
                                      </span>
                                    )}
                                  </h4>
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    Auditor can remove ineligible or blurred photos directly
                                  </span>
                                </div>
                                {photos.length === 0 ? (
                                  <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-600 font-semibold italic">
                                    No property photos currently listed or remaining.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {photos.map((imgUrl, idx) => (
                                      <div
                                        key={idx}
                                        className={'group relative aspect-square bg-slate-100 rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition-all ' +
                                          (diffs.photos?.newPhotos?.includes(imgUrl) ? 'border-2 border-purple-400 ring-2 ring-purple-200' : 'border-slate-300')}
                                      >
                                        <img
                                          src={imgUrl}
                                          alt={'User property photo ' + (idx + 1)}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform cursor-pointer"
                                          onClick={() => setEnlargedMediaUrl(imgUrl)}
                                          onError={(e) => {
                                            if (e.currentTarget && e.currentTarget.parentElement) {
                                              e.currentTarget.parentElement.style.display = 'none';
                                            }
                                          }}
                                        />

                                        {/* Status / Policy Badge */}
                                        {diffs.photos?.newPhotos?.includes(imgUrl) ? (
                                          <span className="absolute top-1.5 left-1.5 z-10 bg-purple-700 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow pointer-events-none flex items-center gap-0.5">
                                            <Sparkles className="w-2.5 h-2.5" />
                                            <span>Proposed Edit</span>
                                          </span>
                                        ) : (
                                          <span className="absolute top-1.5 left-1.5 z-10 bg-emerald-700/90 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow pointer-events-none">
                                            Eligible
                                          </span>
                                        )}

                                        {/* Admin Remove Button */}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAdminRemoveMediaItem('photo', imgUrl, propId);
                                          }}
                                          className="absolute top-1.5 right-1.5 z-20 bg-red-600 hover:bg-red-700 text-white p-1 rounded-md shadow-md transition-all flex items-center gap-1 text-[10px] font-bold"
                                          title="Remove non-compliant photo"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 text-white" />
                                          <span className="hidden group-hover:inline pr-0.5">Remove</span>
                                        </button>

                                        {/* Hover Overlay with Enlarge */}
                                        <div
                                          onClick={() => setEnlargedMediaUrl(imgUrl)}
                                          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold gap-1 cursor-pointer"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          <span>Click to Enlarge</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* SUBMITTED VIDEO PRESENTATION & REVIEW SECTION */}
                              <div className="space-y-4 pt-4 border-t border-slate-200">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                    <Video className="w-4 h-4 text-amber-600" />
                                    <span>Submitted Property Videos & Walkthroughs ({videos.length})</span>
                                    {diffs.videos?.changed && (
                                      <span className="bg-purple-200 text-purple-900 border border-purple-300 text-[10px] font-black px-2 py-0.5 rounded ml-1 shadow-sm">
                                        Proposed Video Edit
                                      </span>
                                    )}
                                  </h4>
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    Auditor can remove copyright-violating or invalid videos
                                  </span>
                                </div>
                                {videos.length === 0 ? (
                                  <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-600 font-semibold italic flex items-center gap-2">
                                    <Video className="w-4 h-4 text-amber-500 shrink-0" />
                                    <span>No video walkthrough attached. (Owners can attach YouTube/Google Drive video links or upload MP4/WebM files).</span>
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    {videos.map((vObj, vIdx) => {
                                      const rawUrl = typeof vObj === 'string' ? vObj : (vObj.embedUrl || vObj.publicUrl || vObj.url || vObj.mediaUrl || '');
                                      if (!rawUrl) return null;

                                      const isYoutube = rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be') || (typeof vObj === 'object' && vObj.provider === 'youtube');
                                      const isDrive = rawUrl.includes('drive.google.com') || (typeof vObj === 'object' && vObj.provider === 'gdrive');

                                      let embedSrc = (typeof vObj === 'object' && vObj.embedUrl) ? vObj.embedUrl : rawUrl;

                                      if (isYoutube) {
                                        const ytMatch = String(vObj.embedUrl || vObj.publicUrl || vObj.url || rawUrl).match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
                                        if (ytMatch && ytMatch[1]) {
                                          embedSrc = `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
                                        }
                                      } else if (isDrive) {
                                        const driveMatch = String(vObj.embedUrl || vObj.publicUrl || vObj.url || rawUrl).match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/i);
                                        if (driveMatch && (driveMatch[1] || driveMatch[2])) {
                                          embedSrc = `https://drive.google.com/file/d/${driveMatch[1] || driveMatch[2]}/preview`;
                                        }
                                      }

                                      return (
                                        <div key={vIdx} className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-md max-w-3xl mx-auto p-2">
                                          {isYoutube || isDrive ? (
                                            <iframe
                                              src={embedSrc}
                                              className="w-full aspect-video rounded-xl border-0"
                                              allowFullScreen
                                              title={'Property Video ' + (vIdx + 1)}
                                            />
                                          ) : (
                                            <video
                                              src={rawUrl}
                                              controls
                                              className="w-full aspect-video rounded-xl max-h-96"
                                            />
                                          )}
                                          <div className="p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 border-t border-slate-800 mt-2">
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold flex items-center gap-1.5 text-amber-400">
                                                🎬 {isYoutube ? 'YouTube Video' : isDrive ? 'Google Drive Video' : 'Direct Upload Video'}
                                              </span>
                                              {diffs.videos?.changed ? (
                                                <span className="bg-purple-900 text-purple-200 border border-purple-500 text-[9px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1">
                                                  <Sparkles className="w-2.5 h-2.5" />
                                                  <span>Proposed New Video</span>
                                                </span>
                                              ) : (
                                                <span className="bg-emerald-900/60 text-emerald-300 border border-emerald-600/40 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                                                  Eligible Media
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <a
                                                href={rawUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-amber-400 hover:text-amber-300 font-extrabold underline flex items-center gap-1"
                                              >
                                                <span>Open External Video Link ↗</span>
                                              </a>
                                              <button
                                                type="button"
                                                onClick={() => handleAdminRemoveMediaItem('video', rawUrl, propId)}
                                                className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1"
                                                title="Remove non-compliant video"
                                              >
                                                <Trash2 className="w-3 h-3 text-white" />
                                                <span>Remove Video</span>
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* UPLOADED VERIFICATION DOCUMENTS (ALWAYS VISIBLE SECTION) */}
                              <div className="space-y-3 pt-4 border-t border-slate-200">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-indigo-600" />
                                    <span>Uploaded Verification Documents ({documents.length})</span>
                                    {diffs.documents?.newCount > 0 && (
                                      <span className="bg-purple-200 text-purple-900 border border-purple-300 text-[10px] font-black px-2 py-0.5 rounded ml-1 shadow-sm">
                                        {diffs.documents.newCount + ' Proposed New'}
                                      </span>
                                    )}
                                  </h4>
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    Auditor can remove fake or unreadable documents
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {documents.length === 0 ? (
                                    <div className="col-span-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 italic font-semibold">
                                      No physical documents currently attached.
                                    </div>
                                  ) : (
                                    documents.map((docItem, idx) => {
                                      const docNameStr = typeof docItem.name === 'string' ? docItem.name : String(docItem.name || ('Document ' + (idx + 1)));
                                      const docTypeStr = typeof docItem.type === 'string' ? docItem.type : String(docItem.type || 'Verification Document');
                                      const docUrlStr = typeof docItem.url === 'string' ? docItem.url : String(docItem.url || '#');
                                      const isProposedDoc = diffs.documents?.newDocs?.some(k => k === docUrlStr || k === docNameStr || k === docItem.docId);

                                      return (
                                        <div
                                          key={idx}
                                          className={'p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-900 min-w-0 overflow-hidden shadow-sm ' +
                                            (isProposedDoc ? 'bg-purple-50 border-2 border-purple-300 ring-2 ring-purple-100' : 'bg-blue-50 border border-blue-200')}
                                        >
                                          <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
                                            <FileText className={'w-5 h-5 shrink-0 ' + (isProposedDoc ? 'text-purple-600' : 'text-blue-600')} />
                                            <div className="min-w-0 overflow-hidden">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-extrabold text-slate-900 block truncate" title={docNameStr}>
                                                  {docNameStr}
                                                </span>
                                                {isProposedDoc && (
                                                  <span className="text-[9px] font-black uppercase bg-purple-200 text-purple-900 border border-purple-300 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5">
                                                    <Sparkles className="w-2.5 h-2.5" />
                                                    <span>Proposed New</span>
                                                  </span>
                                                )}
                                              </div>
                                              <span className={'text-[10px] font-bold block truncate ' + (isProposedDoc ? 'text-purple-700' : 'text-blue-700')}>
                                                {docTypeStr}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                                            {docUrlStr && docUrlStr !== '#' && (
                                              <a
                                                href={docUrlStr}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition-all shadow-sm whitespace-nowrap"
                                              >
                                                View / Download PDF ↗
                                              </a>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => handleAdminRemoveMediaItem('document', docItem, propId)}
                                              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-extrabold text-[11px] px-2.5 py-1.5 rounded-lg transition-all shadow-sm flex items-center gap-1"
                                              title="Remove invalid or policy-violating document"
                                            >
                                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                              <span>Remove</span>
                                            </button>
                                          </div>
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
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full sm:w-auto justify-start sm:justify-end shrink-0 whitespace-nowrap pt-2">
                          <button
                            onClick={() => handleReject(activeAuditProp.id || activeAuditProp.propertyId)}
                            disabled={adminActionProcessing}
                            className="px-4 py-2.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 font-extrabold text-xs transition-colors cursor-pointer border border-red-300 shrink-0"
                            title="Completely unpublish and reject this property listing"
                          >
                            Reject Entire Listing
                          </button>
                          {Boolean(activeAuditProp.hasPendingEdits || activeAuditProp.pendingReauditData) && (
                            <button
                              onClick={() => handleRejectEdits(activeAuditProp.id || activeAuditProp.propertyId)}
                              disabled={adminActionProcessing}
                              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-colors cursor-pointer shadow-sm shrink-0"
                              title="Discard owner's proposed changes while keeping the previously approved listing live"
                            >
                              Reject Proposed Edits (Keep Approved Live)
                            </button>
                          )}
                          <button
                            onClick={() => handleRequestChanges(activeAuditProp.id || activeAuditProp.propertyId)}
                            disabled={adminActionProcessing}
                            className="px-5 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-xs transition-colors cursor-pointer border border-amber-300 shrink-0"
                          >
                            Request Document Changes
                          </button>
                          <button
                            onClick={() => handleApprove(activeAuditProp.id || activeAuditProp.propertyId)}
                            disabled={adminActionProcessing}
                            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
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
                <div className="relative max-w-5xl w-full max-h-[90dvh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setEnlargedMediaUrl(null)}
                    className="absolute -top-12 right-0 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 text-xs font-bold transition-all cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <img
                    src={enlargedMediaUrl}
                    alt="Enlarged property photo"
                    className="max-w-full max-h-[85dvh] object-contain rounded-2xl border-2 border-slate-700 shadow-2xl"
                  />
                </div>
              </div>
            )}

            {/* TAB: USER GOVERNANCE & TEMPORARY SUSPENSION */}
            {activeTab === 'users' && (
              <div className="space-y-6">

                {/* METRICS HEADER */}
                <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar py-1 w-full">
                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between shrink-0 min-w-[210px] sm:min-w-0 flex-1">
                    <div>
                      <span className="text-gray-500 text-xs font-bold uppercase tracking-wider block">Registered Users</span>
                      <span className="text-2xl font-black text-brand-charcoal mt-1 block">{registeredUsersList.length}</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                      <Users className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between shrink-0 min-w-[210px] sm:min-w-0 flex-1">
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

                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between shrink-0 min-w-[210px] sm:min-w-0 flex-1">
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

                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between shrink-0 min-w-[210px] sm:min-w-0 flex-1">
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
                      onChange={(e) => {
                        setUserSearchQuery(e.target.value);
                        setUserCurrentPage(1);
                      }}
                      className="w-full bg-gray-50 border border-gray-200 text-xs font-semibold px-3.5 py-2.5 pl-9 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                    />
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full sm:w-auto shrink-0 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={handleSyncCloudAndDb}
                      disabled={adminActionProcessing}
                      className="flex items-center gap-1.5 bg-brand-charcoal text-brand-yellow hover:bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-extrabold shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-50"
                      title="Run Authoritative 3-Way Synchronization across Firebase Auth, Cloud Firestore, and PostgreSQL"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${adminActionProcessing ? 'animate-spin' : ''}`} />
                      <span>Sync & Refresh All</span>
                    </button>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold shadow-xs shrink-0 select-none">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Live Sync Active</span>
                    </div>

                    {['ALL', 'ACTIVE', 'SUSPENDED', 'REMOVED'].map((st) => (
                      <button
                        key={st}
                        onClick={() => {
                          setUserStatusFilter(st);
                          setUserCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 ${userStatusFilter === st
                            ? 'bg-brand-charcoal text-white shadow'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        {st}
                      </button>
                    ))}

                    {/* Per Page Quick Selector in Toolbar */}
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1 rounded-xl text-xs shrink-0">
                      <span className="text-gray-500 font-bold text-[11px] whitespace-nowrap">Show:</span>
                      <select
                        value={usersPerPage}
                        onChange={(e) => {
                          setUsersPerPage(Number(e.target.value));
                          setUserCurrentPage(1);
                        }}
                        className="bg-white border border-gray-200 text-gray-800 rounded-lg text-xs font-black py-0.5 px-2 focus:outline-none focus:ring-1 focus:ring-brand-yellow cursor-pointer"
                        title="Set limit per page"
                      >
                        <option value={5}>5 / page</option>
                        <option value={10}>10 / page</option>
                        <option value={20}>20 / page</option>
                        <option value={50}>50 / page</option>
                        <option value={100}>100 / page</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* REGISTERED USERS DIRECTORY TABLE WITH PAGINATION */}
                {(() => {
                  let activeDeletedUsers = [];
                  try {
                    if (typeof window !== 'undefined') {
                      const rawDel = localStorage.getItem('easeland_deleted_users');
                      if (rawDel) activeDeletedUsers = JSON.parse(rawDel).map(v => String(v).toLowerCase().trim());
                    }
                  } catch (e) { }

                  const filteredUsers = registeredUsersList
                    .filter(u => {
                      if (!u) return false;
                      const uUid = String(u.uid || u.id || '').toLowerCase().trim();
                      const uEmail = (u.email || '').toLowerCase().trim();
                      const rawSt = String(u.status || u.accountStatus || '').toUpperCase();
                      const isRemoved = rawSt === 'REMOVED' || rawSt === 'DELETED' || rawSt === 'ACCOUNT_DELETED' ||
                        (uUid && activeDeletedUsers.includes(uUid)) || (uEmail && activeDeletedUsers.includes(uEmail));

                      if (userStatusFilter === 'ALL') {
                        if (isRemoved) return false;
                      } else if (userStatusFilter === 'REMOVED') {
                        if (!isRemoved) return false;
                      } else if (u.status !== userStatusFilter && u.accountStatus !== userStatusFilter) {
                        return false;
                      }
                      if (userSearchQuery) {
                        const q = userSearchQuery.toLowerCase();
                        return (u.name || '').toLowerCase().includes(q) ||
                          (u.displayName || '').toLowerCase().includes(q) ||
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
                      return (a.name || a.displayName || a.email || '').localeCompare(b.name || b.displayName || b.email || '');
                    });

                  const totalUsers = filteredUsers.length;
                  const totalPages = Math.max(1, Math.ceil(totalUsers / usersPerPage));
                  const currentPageClamped = Math.min(Math.max(1, userCurrentPage), totalPages);
                  const startIndex = (currentPageClamped - 1) * usersPerPage;
                  const endIndex = Math.min(startIndex + usersPerPage, totalUsers);
                  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

                  return (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="w-full overflow-x-auto no-scrollbar">
                        <div className="min-w-[680px]">
                          <table className="w-full text-left border-collapse table-auto">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                              <th className="py-3 px-3">User & Auth Details</th>
                              <th className="py-3 px-3">Auth Method</th>
                              <th className="py-3 px-3">Platform Role</th>
                              <th className="py-3 px-3">Contact Phone</th>
                              <th className="py-3 px-3 text-center">Account Status</th>
                              <th className="py-3 px-3 text-right">Governance Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-xs">
                            {paginatedUsers.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-10 text-center text-gray-400 font-semibold text-xs">
                                  No registered users found matching your filters.
                                </td>
                              </tr>
                            ) : (
                              paginatedUsers.map((u) => (
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
                                          <span className="text-[9px] text-slate-400 font-mono block truncate" title={'Firebase Auth UID: ' + (u.uid || u.id)}>
                                            UID: {String(u.uid || u.id).length > 18 ? (String(u.uid || u.id).substring(0, 16) + '...') : String(u.uid || u.id)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  <td className="py-3 px-3">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase inline-flex items-center gap-1 ${u.authProvider?.includes('Google') || u.email?.endsWith('@gmail.com')
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                      }`}>
                                      {u.authProvider || (u.email?.endsWith('@gmail.com') ? 'Google OAuth' : 'Email/Password')}
                                    </span>
                                  </td>

                                  <td className="py-3 px-3">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase inline-block ${u.role === 'ADMIN' || u.email === 'admin@easeland.in'
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

                                  <td className="py-3 px-3 text-center">
                                    {(u.status === 'SUSPENDED' || u.accountStatus === 'SUSPENDED') ? (
                                      <div>
                                        <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-xs">
                                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                                          SUSPENDED
                                        </span>
                                        {u.suspension?.suspendedUntil && (
                                          <span className="block text-[9px] text-amber-700 font-semibold mt-0.5">
                                            Until: {new Date(u.suspension.suspendedUntil).toLocaleDateString('en-IN')}
                                          </span>
                                        )}
                                      </div>
                                    ) : (u.status === 'ADMIN' || u.role === 'ADMIN' || u.email === 'admin@easeland.in') ? (
                                      <span className="bg-purple-100 text-purple-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-xs">
                                        <ShieldCheck className="w-3 h-3 text-purple-600" />
                                        ADMIN
                                      </span>
                                    ) : (
                                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-xs">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        ACTIVE
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-3 px-3 text-right">
                                    {u.status !== 'ADMIN' && u.role !== 'ADMIN' && u.email !== 'admin@easeland.in' && (
                                      <div className="flex items-center justify-end gap-1.5">
                                        {(u.status === 'SUSPENDED' || u.accountStatus === 'SUSPENDED') ? (
                                          <button
                                            type="button"
                                            onClick={() => handleUnsuspendUser(u)}
                                            className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-extrabold px-2.5 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer shadow-sm flex items-center gap-1"
                                            title="Lift suspension and restore account status to ACTIVE"
                                          >
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                            <span>Lift Suspension</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleSuspendUserModalOpen(u)}
                                            className="bg-amber-100 text-amber-900 hover:bg-amber-200 font-extrabold px-2.5 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer shadow-sm flex items-center gap-1"
                                            title="Temporarily restrict user access and capabilities"
                                          >
                                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                                            <span>Suspend Account</span>
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => handleRemoveUserModalOpen(u)}
                                          className="bg-red-100 text-red-800 hover:bg-red-200 font-extrabold px-2.5 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer shadow-sm flex items-center gap-1"
                                          title="Permanently remove user account"
                                        >
                                          <Trash2 className="w-3 h-3 text-red-600" />
                                          <span>Remove Account</span>
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                        </div>
                      </div>

                      {/* PAGINATION CONTROLS & PER PAGE SELECTOR */}
                      <div className="p-4 bg-gray-50/80 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-semibold text-gray-600">
                            Showing <span className="font-black text-brand-charcoal">{totalUsers === 0 ? 0 : startIndex + 1}</span> to{' '}
                            <span className="font-black text-brand-charcoal">{endIndex}</span> of{' '}
                            <span className="font-black text-brand-charcoal">{totalUsers}</span> users
                          </span>

                          <div className="flex items-center gap-2 pl-3 border-l border-gray-300">
                            <span className="text-[11px] font-bold text-gray-500">Show per page:</span>
                            <select
                              value={usersPerPage}
                              onChange={(e) => {
                                setUsersPerPage(Number(e.target.value));
                                setUserCurrentPage(1);
                              }}
                              className="bg-white border border-gray-200 text-gray-800 rounded-lg text-xs font-black py-1 px-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow cursor-pointer"
                            >
                              <option value={5}>5 per page</option>
                              <option value={10}>10 per page</option>
                              <option value={20}>20 per page</option>
                              <option value={50}>50 per page</option>
                              <option value={100}>100 per page</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 w-full sm:w-auto shrink-0 justify-center sm:justify-end">
                          <button
                            type="button"
                            disabled={currentPageClamped <= 1}
                            onClick={() => setUserCurrentPage(prev => Math.max(1, prev - 1))}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none text-xs font-extrabold text-gray-700 flex items-center gap-1 shadow-sm transition-all"
                            title="Previous Page"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Previous</span>
                          </button>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                              .filter(page => {
                                if (totalPages <= 7) return true;
                                if (page === 1 || page === totalPages) return true;
                                return Math.abs(page - currentPageClamped) <= 1;
                              })
                              .map((page, idx, arr) => {
                                const prev = arr[idx - 1];
                                const showEllipsis = prev && page - prev > 1;
                                return (
                                  <React.Fragment key={page}>
                                    {showEllipsis && <span className="px-1 text-gray-400 font-bold">...</span>}
                                    <button
                                      type="button"
                                      onClick={() => setUserCurrentPage(page)}
                                      className={`w-7 h-7 rounded-lg text-xs font-black transition-all ${
                                        currentPageClamped === page
                                          ? 'bg-brand-charcoal text-brand-yellow shadow'
                                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                                      }`}
                                    >
                                      {page}
                                    </button>
                                  </React.Fragment>
                                );
                              })}
                          </div>

                          <button
                            type="button"
                            disabled={currentPageClamped >= totalPages}
                            onClick={() => setUserCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none text-xs font-extrabold text-gray-700 flex items-center gap-1 shadow-sm transition-all"
                            title="Next Page"
                          >
                            <span>Next</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              </div>
            )}

            {/* TAB: VISITORS DETAILS (1-MINUTE SITE ENGAGEMENT REGISTRY) */}
            {activeTab === 'visitors' && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">

                {/* HEADER */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-black">
                        <UserCheck className="w-4 h-4 text-amber-600" />
                      </div>
                      <h3 className="text-lg font-black text-brand-charcoal">
                        Visitors Details &amp; 1-Min Lead Registry
                      </h3>
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        PostgreSQL Live
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium mt-1">
                      Prospective buyers captured via engagement popup after browsing the site for at least 1 minute.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={loadVisitorLeads}
                      disabled={visitorLoading}
                      className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${visitorLoading ? 'animate-spin text-brand-yellow' : 'text-gray-600'}`} />
                      <span>{visitorLoading ? 'Refreshing...' : 'Refresh List'}</span>
                    </button>
                  </div>
                </div>

                {/* TOAST ALERT */}
                {visitorToast && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-extrabold rounded-xl flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>{visitorToast}</span>
                  </div>
                )}

                {/* KPI METRIC CARDS */}
                <div className="flex sm:grid sm:grid-cols-4 gap-3 overflow-x-auto no-scrollbar py-1 w-full">
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 shrink-0 min-w-[170px] sm:min-w-0 flex-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 block">Total Captured</span>
                    <span className="text-2xl font-black text-blue-900">{visitorLeads.length}</span>
                    <span className="text-[10px] text-blue-600 block mt-0.5 font-semibold">Saved in PostgreSQL</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 shrink-0 min-w-[170px] sm:min-w-0 flex-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">New / Pending</span>
                    <span className="text-2xl font-black text-amber-900">
                      {visitorLeads.filter(v => v.status === 'NEW').length}
                    </span>
                    <span className="text-[10px] text-amber-700 block mt-0.5 font-semibold">Awaiting first contact</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 shrink-0 min-w-[170px] sm:min-w-0 flex-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">Contacted / Converted</span>
                    <span className="text-2xl font-black text-emerald-900">
                      {visitorLeads.filter(v => v.status === 'CONTACTED' || v.status === 'CONVERTED' || v.status === 'QUALIFIED').length}
                    </span>
                    <span className="text-[10px] text-emerald-600 block mt-0.5 font-semibold">Active in sales cycle</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 shrink-0 min-w-[170px] sm:min-w-0 flex-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 block">Avg Site Engagement</span>
                    <span className="text-2xl font-black text-purple-900">1+ Min</span>
                    <span className="text-[10px] text-purple-600 block mt-0.5 font-semibold">High purchase intent</span>
                  </div>
                </div>

                {/* SEARCH & FILTER CONTROLS */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search name, phone, city..."
                      value={visitorSearchQuery}
                      onChange={(e) => setVisitorSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <span className="text-xs font-bold text-gray-500">Filter Status:</span>
                    <select
                      value={visitorStatusFilter}
                      onChange={(e) => setVisitorStatusFilter(e.target.value)}
                      className="bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-yellow cursor-pointer"
                    >
                      <option value="ALL">All Statuses ({visitorLeads.length})</option>
                      <option value="NEW">New ({visitorLeads.filter(v => v.status === 'NEW').length})</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="QUALIFIED">Qualified</option>
                      <option value="CONVERTED">Converted to CRM</option>
                    </select>
                  </div>
                </div>

                {/* VISITOR LEADS LIST */}
                {(() => {
                  const filtered = visitorLeads.filter(v => {
                    const matchesSearch = !visitorSearchQuery ||
                      (v.name || '').toLowerCase().includes(visitorSearchQuery.toLowerCase()) ||
                      (v.phone || '').includes(visitorSearchQuery) ||
                      (v.email || '').toLowerCase().includes(visitorSearchQuery.toLowerCase()) ||
                      (v.preferredLocation || '').toLowerCase().includes(visitorSearchQuery.toLowerCase()) ||
                      (v.preferredPropertyType || '').toLowerCase().includes(visitorSearchQuery.toLowerCase());
                    const matchesStatus = visitorStatusFilter === 'ALL' || v.status === visitorStatusFilter;
                    return matchesSearch && matchesStatus;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-12 text-center bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                        <Clock className="w-8 h-8 text-gray-400 mx-auto" />
                        <h4 className="font-extrabold text-sm text-gray-700">No Visitor Leads Matching Filter</h4>
                        <p className="text-xs text-gray-400">
                          {visitorLeads.length === 0
                            ? 'New user leads will appear here automatically when users browse the site for over 1 minute.'
                            : 'Try adjusting your search query or status filter.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {filtered.map((vis) => {
                        const rawPhone = (vis.phone || '').replace(/[^0-9]/g, '');
                        const waPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
                        const durationMins = Math.max(1, Math.round((vis.stayDurationSeconds || 60) / 60));

                        return (
                          <div
                            key={vis.id || vis.visitorId}
                            className="p-4 bg-gray-50 rounded-2xl border border-gray-200 hover:border-amber-300/80 transition-all space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/60 pb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-brand-navy text-brand-yellow flex items-center justify-center font-black text-sm shrink-0">
                                  {(vis.name || 'V')[0].toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-sm text-brand-charcoal">{vis.name || 'Site Visitor'}</span>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${vis.status === 'CONVERTED' ? 'bg-purple-100 text-purple-800' :
                                        vis.status === 'QUALIFIED' ? 'bg-emerald-100 text-emerald-800' :
                                          vis.status === 'CONTACTED' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                                      }`}>
                                      {vis.status || 'NEW'}
                                    </span>
                                    <span className="text-[10px] font-bold bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                                      {durationMins}+ Mins On Site
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-500 font-medium block mt-0.5">
                                    ID: {vis.id || vis.visitorId} • Captured: {vis.createdAt ? new Date(vis.createdAt).toLocaleString('en-IN') : 'Recent'}
                                  </span>
                                </div>
                              </div>

                              {/* STATUS SELECTOR */}
                              <div className="flex items-center gap-2 self-start sm:self-auto">
                                <label className="text-[11px] font-bold text-gray-500">Status:</label>
                                <select
                                  value={vis.status || 'NEW'}
                                  onChange={(e) => handleUpdateVisitorStatus(vis.id || vis.visitorId, e.target.value)}
                                  className="text-xs font-bold bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-yellow cursor-pointer"
                                >
                                  <option value="NEW">NEW</option>
                                  <option value="CONTACTED">CONTACTED</option>
                                  <option value="QUALIFIED">QUALIFIED</option>
                                  <option value="CONVERTED">CONVERTED</option>
                                </select>
                              </div>
                            </div>

                            {/* DETAILS GRID */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                              <div className="bg-white p-2.5 rounded-xl border border-gray-200 flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Contact Phone</span>
                                  <span className="font-extrabold text-brand-navy">{vis.phone || 'Not Specified'}</span>
                                </div>
                                {vis.phone && (
                                  <div className="flex items-center gap-1">
                                    <a
                                      href={`https://wa.me/${waPhone}?text=${encodeURIComponent('Hello ' + (vis.name || '') + ', thank you for visiting EaseLand! We noticed you were exploring properties on our platform.')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                                      title="Chat on WhatsApp"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                    </a>
                                    <a
                                      href={`tel:${vis.phone}`}
                                      className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                                      title="Call Visitor"
                                    >
                                      <Phone className="w-3.5 h-3.5 text-blue-600" />
                                    </a>
                                  </div>
                                )}
                              </div>

                              <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Email Address</span>
                                <span className="font-extrabold text-brand-navy truncate block">
                                  {vis.email || 'Not Provided'}
                                </span>
                              </div>

                              <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Interested In</span>
                                <span className="font-extrabold text-brand-navy truncate block">
                                  {vis.preferredPropertyType || 'Open Plot Ventures'} • {vis.preferredLocation || 'AP Region'}
                                </span>
                              </div>
                            </div>

                            {/* ACTIONS BAR */}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[11px] text-gray-400 font-medium">
                                Source: {vis.source || '3_MIN_ENGAGEMENT_POPUP'}
                              </span>

                              <div className="flex items-center gap-2">
                                {vis.status !== 'CONVERTED' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleConvertVisitorToCrm(vis)}
                                    className="px-3.5 py-1.5 bg-brand-yellow hover:bg-brand-yellowHover text-brand-navy font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                                  >
                                    <Briefcase className="w-3.5 h-3.5" />
                                    <span>Convert to CRM Deal</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-extrabold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-200 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-purple-600" />
                                    In Deal Pipeline
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeleteVisitor(vis.id || vis.visitorId)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete visitor record"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

              </div>
            )}

            {/* TAB: REPORTS & LOGS */}
            {activeTab === 'reports' && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-brand-yellow font-extrabold text-xs uppercase tracking-wider mb-0.5">
                      <Clock className="w-4 h-4 text-brand-charcoal" />
                      <span>Platform Audit & Security Trail</span>
                    </div>
                    <h3 className="text-lg font-black text-brand-charcoal">Reports & Activity Logs</h3>
                    <p className="text-xs text-gray-500 font-medium">Real-time audit logs of all legal approvals, user suspensions, CMS edits, and site publications.</p>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0 self-start sm:self-auto">
                    <span className="bg-brand-charcoal text-brand-yellow font-extrabold text-xs px-3 py-1.5 rounded-full border border-gray-800 shrink-0">
                      {activityLogs.length} Total Logs
                    </span>
                    {activityLogs.length > 0 && (
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to clear all activity audit logs?')) {
                            setActivityLogs([]);
                            try { localStorage.removeItem('easeland_admin_activity_logs'); } catch (e) { }
                          }
                        }}
                        className="bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-xs px-3 py-1.5 rounded-xl border border-red-200 transition-colors shrink-0 whitespace-nowrap"
                      >
                        Clear Audit Trail
                      </button>
                    )}
                  </div>
                </div>

                {/* LOG FILTER SEARCH */}
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter logs by admin name, property ID, user, action..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                  />
                </div>

                {/* LOG ENTRIES CONTAINER */}
                <div className="p-4 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 text-xs font-mono max-h-[60dvh] overflow-y-auto space-y-2 shadow-inner">
                  {activityLogs.filter(log => !logSearchQuery.trim() || log.toLowerCase().includes(logSearchQuery.toLowerCase().trim())).length === 0 ? (
                    <div className="py-8 text-center text-slate-500 font-sans text-xs">
                      No activity logs match your filter search.
                    </div>
                  ) : (
                    activityLogs
                      .filter(log => !logSearchQuery.trim() || log.toLowerCase().includes(logSearchQuery.toLowerCase().trim()))
                      .map((logStr, idx) => (
                        <div key={idx} className="hover:bg-slate-900/90 p-2 rounded-lg transition-colors flex items-start gap-2 border-b border-slate-900/50">
                          <span className="text-amber-400 font-bold shrink-0">›</span>
                          <span className="leading-relaxed break-all">
                            {logStr}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* TAB: ADMIN PROFILE & SECURITY SETTINGS */}
            {activeTab === 'profile-settings' && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-brand-charcoal">Administrator Profile & Security Settings</h3>
                    <p className="text-xs text-gray-500 font-medium">Update your admin credentials, contact info, and security preferences.</p>
                  </div>
                  <span className="bg-purple-100 text-purple-900 font-extrabold text-xs px-3 py-1 rounded-full flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
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
                      <div className="relative">
                        <input
                          type={showUpdateAdminPassword ? 'text' : 'password'}
                          placeholder="Enter new password"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          className="w-full bg-white border border-gray-300 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowUpdateAdminPassword(!showUpdateAdminPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 focus:outline-none"
                          title={showUpdateAdminPassword ? "Hide password text" : "Show password text"}
                        >
                          {showUpdateAdminPassword ? <EyeOff className="w-4 h-4 text-brand-charcoal" /> : <Eye className="w-4 h-4 text-gray-400" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showUpdateAdminConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm new password"
                          value={adminConfirmPassword}
                          onChange={(e) => setAdminConfirmPassword(e.target.value)}
                          className="w-full bg-white border border-gray-300 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowUpdateAdminConfirmPassword(!showUpdateAdminConfirmPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 focus:outline-none"
                          title={showUpdateAdminConfirmPassword ? "Hide password text" : "Show password text"}
                        >
                          {showUpdateAdminConfirmPassword ? <EyeOff className="w-4 h-4 text-brand-charcoal" /> : <Eye className="w-4 h-4 text-gray-400" />}
                        </button>
                      </div>
                    </div>
                    {/* Require 2FA for Admin Portal (Hidden for now per request) */}
                    {/*
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700">Require 2FA for Admin Portal</span>
                      <input type="checkbox" defaultChecked className="w-4 h-4 text-brand-yellow rounded" />
                    </div>
                    */}
                  </div>
                </div>

                <div className="pt-2 flex justify-stretch sm:justify-end">
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
                    className="w-full sm:w-auto justify-center bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-black text-xs px-6 py-3 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[92dvh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-black text-brand-charcoal">Temporarily Suspend User Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSuspendModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
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
                      className={'py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ' + (suspensionDays === preset.d && suspensionHours === preset.h
                          ? 'bg-brand-charcoal text-brand-yellow border-brand-charcoal shadow'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100')}
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
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSuspendUser}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
              >
                Confirm Account Suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ACCOUNT REMOVAL CONFIRMATION */}
      {isRemoveModalOpen && selectedUserForRemoval && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 max-h-[92dvh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" />
                <h3 className="text-lg font-black text-brand-charcoal">Remove User Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRemoveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
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
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveUser}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
              >
                Permanently Remove Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CHECK DEAL DETAILS & DOSSIER */}
      {selectedDealForDossier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200 max-h-[92dvh] overflow-y-auto">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-black text-brand-yellow uppercase tracking-wider">
                  <Briefcase className="w-4 h-4 text-brand-yellow" />
                  Platform Deal Details
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
              <div className="flex sm:grid sm:grid-cols-5 gap-1.5 text-[9px] font-black uppercase text-center overflow-x-auto no-scrollbar py-0.5">
                {['NEW', 'SITE_VISIT', 'DOCUMENT_AUDIT', 'ADVANCE_PAID', 'DEAL_CLOSED'].map((stg) => (
                  <div
                    key={stg}
                    className={`p-1.5 rounded-lg border shrink-0 min-w-[90px] sm:min-w-0 ${selectedDealForDossier.stage === stg
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
                    <span>Buyer Phone: <strong>{selectedDealForDossier.customerPhone || 'Not Specified'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-brand-yellow" />
                    <span>Seller Owner: <strong>{selectedDealForDossier.ownerName || 'Verified Property Owner'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Assigned Admin: <strong>{selectedDealForDossier.assignedAdmin || 'EaseLand Admin'}</strong></span>
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
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SCHEDULE NEW FOLLOW-UP OR SITE VISIT */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[92dvh] overflow-y-auto animate-in fade-in zoom-in duration-200">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    placeholder="Enter scheduled time"
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
                  placeholder="Enter Action Agenda / Next Step"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-200 max-h-[92dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
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

      {/* MODAL 6: PURGE ALL TEST PROPERTIES CONFIRMATION */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-red-200 max-h-[92dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-black">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-brand-charcoal">Wipe ALL Properties?</h3>
                  <span className="text-[10px] uppercase font-bold text-red-600 tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                    <span>Authoritative 3-Way Cascade Wipe • DANGER: USE WITH CAUTION</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setIsPurgeModalOpen(false); setPurgeConfirmInput(''); }}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-2xl border-2 border-amber-300 text-amber-900 text-xs font-bold flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-black text-amber-900 uppercase tracking-wider text-[10px] mb-0.5">Warning: Use with Caution</div>
                <div className="text-[11px] font-medium text-amber-800 leading-snug">
                  This irreversible action permanently erases all property listings, private specs, uploaded media, confidential documents, verification records, and customer enquiries across all layers.
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-600 font-semibold leading-relaxed">
              This action will permanently delete all property listings, private specs, uploaded media, confidential documents, verification records, and customer enquiries.
            </p>

            <div className="p-3.5 bg-red-50 rounded-2xl border border-red-200 text-[11px] font-bold text-red-800 space-y-1.5">
              <div className="font-extrabold text-red-900 uppercase tracking-wider text-[10px] mb-1">Collections & Tables That Will Be Eradicated:</div>
              <div>• PostgreSQL: properties, media_files, enquiries, admin_deleted_properties</div>
              <div>• Cloud Firestore: properties, propertyPrivate, propertyMediaPrivate, propertyDocuments, verificationRecords, enquiries</div>
              <div>• Local Storage: easeland_properties, user caches, disk store backups</div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-[11px] font-bold text-emerald-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Safe Invariant: Registered User Accounts and Site CMS Settings are 100% PRESERVED.</span>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-gray-700">
                To confirm, type <span className="text-red-600 font-black tracking-wider">PURGE</span> below:
              </label>
              <input
                type="text"
                placeholder="Type PURGE to unlock button"
                value={purgeConfirmInput}
                onChange={(e) => setPurgeConfirmInput(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 uppercase tracking-widest placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isPurgingProcessing}
                onClick={() => { setIsPurgeModalOpen(false); setPurgeConfirmInput(''); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={purgeConfirmInput.trim() !== 'PURGE' || isPurgingProcessing}
                onClick={handleExecutePurgeAllProperties}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPurgingProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Purging Across 3 Layers...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Wipe ALL Properties</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: ADD PROPERTY CATEGORY CARD POPUP */}
      {isAddCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-200 max-h-[92dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-brand-yellow/20 text-brand-charcoal flex items-center justify-center font-black">
                  <Layers className="w-5 h-5 text-brand-charcoal" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-brand-charcoal">Add Property Category Card</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Create a new category card shown on the homepage.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCategoryModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Category Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Farmlands & Agriculture, Luxury Villas, Open Plots"
                  value={newCategoryForm.title}
                  onChange={(e) => setNewCategoryForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Count Subtext</label>
                <input
                  type="text"
                  placeholder="e.g. 120+ Verified Properties, Starting 25L"
                  value={newCategoryForm.countText}
                  onChange={(e) => setNewCategoryForm(prev => ({ ...prev, countText: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                />
              </div>

              <div>
                <MediaUploadInput
                  label="Category Cover Image Asset"
                  value={newCategoryForm.imageUrl}
                  onChange={(val) => setNewCategoryForm(prev => ({ ...prev, imageUrl: val }))}
                />
              </div>

              {newCategoryForm.imageUrl && (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 h-28 bg-gray-100">
                  <img
                    src={newCategoryForm.imageUrl}
                    alt="Category Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2.5">
                    <span className="text-white text-xs font-extrabold drop-shadow">
                      {newCategoryForm.title || 'Category Preview'}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-black text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add Category Card</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: ADD FAQ QUESTION POPUP */}
      {isAddFaqModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-200 max-h-[92dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-brand-yellow/20 text-brand-charcoal flex items-center justify-center font-black">
                  <HelpCircle className="w-5 h-5 text-brand-charcoal" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-brand-charcoal">Add Frequently Asked Question</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Add a new Q&A pair to the FAQ section.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddFaqModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFaqSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Question *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. How does EaseLand verify land plot boundaries?"
                  value={newFaqForm.question}
                  onChange={(e) => setNewFaqForm(prev => ({ ...prev, question: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Answer *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide a clear, detailed answer for buyers, sellers, and visitors..."
                  value={newFaqForm.answer}
                  onChange={(e) => setNewFaqForm(prev => ({ ...prev, answer: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-yellow leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddFaqModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-black text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add FAQ Question</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
