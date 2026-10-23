import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Save, CheckCircle2, AlertCircle, RotateCcw, Building2, Tag, MapPin, X, Trash2, Settings, Calculator } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { PropertyType, Purpose, ListingStatus } from '../firebase/schema.js';
import { createPropertyDraft, savePropertyDraftStep, getOwnerDrafts, getPropertyById, deletePropertyListing } from '../firebase/propertyService.js';
import { saveOwnerBoundarySubmission } from '../firebase/boundaryService.js';
import { AreaUnit } from '../firebase/specificationsConfig.js';
import PropertyLocationStep from '../components/PropertyLocationStep.jsx';
import PropertySpecificationsStep from '../components/PropertySpecificationsStep.jsx';
import PropertyMediaStep from '../components/PropertyMediaStep.jsx';
import PropertyDocumentStep from '../components/PropertyDocumentStep.jsx';
import PropertyBoundaryStep from '../components/PropertyBoundaryStep.jsx';
import PropertyReviewStep from '../components/PropertyReviewStep.jsx';
import { determineResumeStep } from '../utils/draftResumeUtils.js';

export { determineResumeStep };

export default function PostPropertyWizard({ onComplete, onCancel, onGoToAccountSettings, resumePropertyId = null, propertyId: propIdParam = null }) {
  const { user, profile } = useAuth();

  const [step, setStep] = useState(1);
  const [propertyId, setPropertyId] = useState(null);
  const [referenceId, setReferenceId] = useState(null);

  // Resume Draft State
  const [draftsList, setDraftsList] = useState([]);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Form State (Clean initialized state with 0 defaults)
  const [formData, setFormData] = useState({
    title: '',
    category: 'Open Plot Ventures',
    propertyType: PropertyType.OPEN_PLOT,
    otherPropertyType: '',
    purpose: Purpose.SALE,
    price: '',
    pricePerUnit: '',
    area: '',
    areaUnit: AreaUnit.SQ_FT,
    description: '',
    specs: { areaUnit: AreaUnit.SQ_FT },
    amenities: [],
    media: [],
    location: null,
    boundary: null
  });

  const sanitizePhone = (ph) => {
    if (!ph) return '';
    const str = String(ph).trim();
    const lower = str.toLowerCase();
    if (lower === 'n/a' || lower === 'null' || lower === 'undefined' || str === '+91 N/A') return '';
    return str;
  };

  const missingProfileCriteria = useMemo(() => {
    // If editing an existing property, never block wizard
    if (resumePropertyId || propertyId) return [];

    const missing = [];
    const uid = user?.uid || user?.id;
    const stored = uid && typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('easeland_user_profile_' + uid) || '{}') : {};
    const adminPhone = typeof window !== 'undefined' ? localStorage.getItem('easeland_admin_phone') : '';
    const sessionUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('easeland_session_user') || '{}') : {};

    const name = (user?.name || user?.displayName || profile?.name || profile?.displayName || stored?.name || stored?.displayName || sessionUser?.name || sessionUser?.displayName || '').trim();
    const email = (user?.email || profile?.email || stored?.email || sessionUser?.email || '').trim();
    const phone = sanitizePhone(
      user?.phone || user?.phoneNumber || profile?.phone || profile?.phoneNumber ||
      stored?.phone || stored?.phoneNumber ||
      adminPhone ||
      sessionUser?.phone || sessionUser?.phoneNumber || ''
    );
    const city = (user?.city || user?.location || profile?.city || profile?.location || stored?.city || stored?.location || sessionUser?.city || sessionUser?.location || '').trim();

    if (!name) missing.push('Full Name');
    if (!email) missing.push('Email Address');
    if (!phone) missing.push('Phone Number');
    if (!city) missing.push('City / Location');

    return missing;
  }, [resumePropertyId, propertyId, user, profile]);

  // Mandatory profile completeness check: force exit to account settings if required criteria are missing
  useEffect(() => {
    if (missingProfileCriteria.length > 0 && !resumePropertyId && !propertyId) {
      if (onGoToAccountSettings) {
        onGoToAccountSettings();
      } else if (onCancel) {
        onCancel();
      }
    }
  }, [missingProfileCriteria.length, resumePropertyId, propertyId, onGoToAccountSettings, onCancel]);

  // Clear step-specific validation errors when changing steps
  useEffect(() => {
    setErrorMsg(null);
    setFieldErrors({});
  }, [step]);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showResumeModal) {
        setShowResumeModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showResumeModal]);

  // Helper: Apply loaded property data into wizard state
  const applyPropertyToForm = (propCandidate, overrideStep = null) => {
    if (!propCandidate) return;
    const baseP = propCandidate.rawProperty || propCandidate;
    const pendingData = baseP.pendingReauditData || baseP.pendingEdits || propCandidate.pendingReauditData || propCandidate.pendingEdits || {};
    const p = {
      ...baseP,
      ...pendingData,
      specs: { ...(baseP.specs || {}), ...(pendingData.specs || {}) }
    };
    const pId = p.propertyId || p.id || propCandidate.propertyId || propCandidate.id;
    if (pId) setPropertyId(pId);
    const ref = p.referenceId || propCandidate.referenceId;
    if (ref) setReferenceId(ref);

    // Parse location if string or object
    let locCandidate = p.location || propCandidate.location || null;
    if (typeof locCandidate === 'string') {
      locCandidate = {
        locality: locCandidate,
        city: locCandidate,
        state: 'Andhra Pradesh',
        address: locCandidate
      };
    }

    let cachedLoc = locCandidate;
    const hasValidCandidateLoc = Boolean(
      locCandidate && (
        locCandidate.confirmed ||
        locCandidate.geoPoint ||
        (locCandidate.lat && !isNaN(Number(locCandidate.lat)) && Number(locCandidate.lat) !== 0 && Number(locCandidate.lat) !== 20.5937) ||
        (locCandidate.latitude && !isNaN(Number(locCandidate.latitude)) && Number(locCandidate.latitude) !== 0 && Number(locCandidate.latitude) !== 20.5937) ||
        locCandidate.locality ||
        locCandidate.city ||
        locCandidate.address
      )
    );

    // ONLY if the property has no existing location at all, check if a draft location exists for THIS specific propertyId
    if (!hasValidCandidateLoc && typeof window !== 'undefined' && pId) {
      try {
        const storedLoc = localStorage.getItem('easeland_wizard_location_' + pId);
        if (storedLoc) {
          const parsed = JSON.parse(storedLoc);
          if (parsed && (parsed.lat || parsed.latitude || parsed.geoPoint || parsed.city || parsed.address)) {
            cachedLoc = parsed;
          }
        }
      } catch (e) {}
    }

    // Parse clean numeric price
    let rawP = p.price !== undefined && p.price !== null ? p.price : propCandidate.price;
    let cleanPrice = '';
    if (typeof rawP === 'number') {
      cleanPrice = String(rawP);
    } else if (typeof rawP === 'string') {
      const lower = rawP.toLowerCase();
      if (lower.includes('crore')) {
        const num = parseFloat(lower.replace(/[^0-9.]/g, '')) || 0;
        cleanPrice = String(Math.round(num * 10000000));
      } else if (lower.includes('lakh')) {
        const num = parseFloat(lower.replace(/[^0-9.]/g, '')) || 0;
        cleanPrice = String(Math.round(num * 100000));
      } else {
        cleanPrice = rawP.replace(/[^0-9.]/g, '');
      }
    }

    // Parse clean numeric area
    let rawA = p.area !== undefined && p.area !== null ? p.area : propCandidate.area;
    let cleanArea = '';
    if (typeof rawA === 'number') {
      cleanArea = String(rawA);
    } else if (typeof rawA === 'string') {
      cleanArea = rawA.replace(/[^0-9.]/g, '');
    }

    // Parse clean numeric price per unit
    let rawPPU = p.pricePerUnit !== undefined && p.pricePerUnit !== null ? p.pricePerUnit : propCandidate.pricePerUnit;
    let cleanPPU = '';
    if (typeof rawPPU === 'number') {
      cleanPPU = String(rawPPU);
    } else if (typeof rawPPU === 'string') {
      cleanPPU = rawPPU.replace(/[^0-9.]/g, '');
    } else if (cleanPrice && cleanArea && Number(cleanArea) > 0) {
      cleanPPU = String(Math.round(Number(cleanPrice) / Number(cleanArea)));
    }

    const resolvedPropType = p.propertyType || p.type || p.category || propCandidate.propertyType || propCandidate.type || PropertyType.OPEN_PLOT;
    const isLandOrPlot = ['OPEN_PLOT', 'LAND', 'AGRICULTURAL_LAND', 'COMMERCIAL_LAND'].includes(String(resolvedPropType || '').toUpperCase());
    const existingFurn = p.specs?.furnishing || propCandidate.specs?.furnishing || p.furnishing || propCandidate.furnishing;
    const defaultFurn = (!isLandOrPlot && !existingFurn) ? 'Unfurnished' : existingFurn;
    const resolvedPurpose = p.purpose || propCandidate.purpose || Purpose.SALE;
    const mediaList = Array.isArray(p.media) ? p.media : (Array.isArray(propCandidate.media) ? propCandidate.media : (Array.isArray(p.photos) ? p.photos : []));
    const photosList = Array.isArray(p.photos) ? p.photos : mediaList.filter(m => m.type === 'PHOTO');

    const isLive = Boolean(
      baseP.listingStatus === 'LIVE' ||
      baseP.status === 'LIVE' ||
      baseP.isPublished ||
      baseP.isPlatformVerified ||
      propCandidate.isAlreadyLive
    );

    setFormData({
      isAlreadyLive: isLive,
      title: p.title || propCandidate.title || '',
      category: p.category || propCandidate.category || 'Open Plot Ventures',
      propertyType: resolvedPropType,
      otherPropertyType: p.otherPropertyType || propCandidate.otherPropertyType || '',
      purpose: resolvedPurpose,
      price: cleanPrice,
      pricePerUnit: cleanPPU,
      area: cleanArea,
      areaUnit: p.areaUnit || p.specs?.areaUnit || propCandidate.areaUnit || AreaUnit.SQ_FT,
      description: p.description || propCandidate.description || '',
      specs: {
        ...(baseP.specs || {}),
        ...(propCandidate.specs || {}),
        ...(pendingData.specs || {}),
        ...(defaultFurn ? { furnishing: defaultFurn } : {}),
        areaUnit: p.areaUnit || p.specs?.areaUnit || propCandidate.areaUnit || AreaUnit.SQ_FT
      },
      amenities: Array.isArray(p.amenities) ? p.amenities : (Array.isArray(propCandidate.amenities) ? propCandidate.amenities : []),
      media: mediaList,
      photos: photosList,
      documents: Array.isArray(p.documents) ? p.documents : (Array.isArray(propCandidate.documents) ? propCandidate.documents : []),
      videoUrl: p.videoUrl || p.videoLink || propCandidate.videoUrl || null,
      videoLink: p.videoLink || p.videoUrl || propCandidate.videoLink || null,
      embeddedVideoUrl: p.embeddedVideoUrl || propCandidate.embeddedVideoUrl || null,
      location: cachedLoc,
      boundary: p.boundary || p.ownerSubmittedBoundary || propCandidate.boundary || null,
      ownerSubmittedBoundary: p.ownerSubmittedBoundary || p.boundary || propCandidate.ownerSubmittedBoundary || null
    });

    const targetStep = overrideStep !== null && overrideStep !== undefined
      ? Number(overrideStep)
      : determineResumeStep(propCandidate);
    const clampedStep = Math.min(Math.max(Number(targetStep) || 1, 1), 8);
    setStep(clampedStep);
    setShowResumeModal(false);
  };

  // Load existing owner drafts or target resume property on mount
  useEffect(() => {
    if (user?.uid) {
      // Purge any stale user-level or guest wizard location keys that clobber individual property locations
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('easeland_wizard_location_' + (user?.uid || ''));
          localStorage.removeItem('easeland_wizard_location_guest');
        } catch (e) {}
      }

      let cachedProp = null;
      if (typeof window !== 'undefined') {
        try {
          const rawCached = sessionStorage.getItem('easeland_editing_property');
          if (rawCached) {
            const parsed = JSON.parse(rawCached);
            // Verify cachedProp is not marked deleted
            const rawDeleted = localStorage.getItem('easeland_deleted_properties') || '[]';
            const deletedList = JSON.parse(rawDeleted);
            const cachedIdStr = String(parsed?.id || parsed?.propertyId || parsed?.referenceId || '');

            if (cachedIdStr && deletedList.includes(cachedIdStr)) {
              sessionStorage.removeItem('easeland_editing_property');
            } else if (resumePropertyId) {
              const targetStr = String(resumePropertyId).toLowerCase().trim();
              const cId = String(parsed?.id || '').toLowerCase().trim();
              const cPropId = String(parsed?.propertyId || '').toLowerCase().trim();
              const cRefId = String(parsed?.referenceId || '').toLowerCase().trim();
              if (cId === targetStr || cPropId === targetStr || cRefId === targetStr) {
                cachedProp = parsed;
              } else {
                sessionStorage.removeItem('easeland_editing_property');
              }
            } else {
              sessionStorage.removeItem('easeland_editing_property');
            }
          }
        } catch (e) {}
      }

      if (resumePropertyId || cachedProp) {
        const loadTargetProperty = async () => {
          let foundProp = null;

          // 1. Instant cache check from sessionStorage ONLY if matching resumePropertyId
          if (cachedProp) {
            foundProp = cachedProp;
            applyPropertyToForm(cachedProp);
          }

          // 2. Fetch latest from getPropertyById if resumePropertyId is present
          if (resumePropertyId) {
            try {
              const res = await getPropertyById(resumePropertyId, user.uid, false, user.email);
              if (res.success && res.property) {
                foundProp = res.property;
                applyPropertyToForm(res.property);
                return;
              }
            } catch (e) {}
          }

          // 3. Fallback: Search in owner drafts (the same method used by the modal)
          if (!foundProp && resumePropertyId) {
            try {
              const dRes = await getOwnerDrafts(user.uid);
              if (dRes.success && Array.isArray(dRes.drafts)) {
                const targetStr = String(resumePropertyId).toLowerCase().trim();
                const match = dRes.drafts.find(d => {
                  if (!d) return false;
                  const dId = String(d.id || '').toLowerCase().trim();
                  const dPropId = String(d.propertyId || '').toLowerCase().trim();
                  const dRefId = String(d.referenceId || '').toLowerCase().trim();
                  const dTitle = String(d.title || '').toLowerCase().trim();
                  return dId === targetStr || dPropId === targetStr || dRefId === targetStr || (dTitle && dTitle === targetStr);
                });
                if (match) {
                  foundProp = match;
                  applyPropertyToForm(match);
                  return;
                }
              }
            } catch (e) {}
          }

          // 4. Fallback: Search in mockApi
          if (!foundProp && resumePropertyId) {
            try {
              const { mockApi } = await import('../services/mockApi.js');
              const targetStr = String(resumePropertyId).toLowerCase().trim();
              const allProps = mockApi.getProperties();
              const match = allProps.find(p => {
                if (!p) return false;
                const pId = String(p.id || '').toLowerCase().trim();
                const pPropId = String(p.propertyId || '').toLowerCase().trim();
                const pRefId = String(p.referenceId || '').toLowerCase().trim();
                return pId === targetStr || pPropId === targetStr || pRefId === targetStr;
              });
              if (match) {
                applyPropertyToForm(match);
                return;
              }
            } catch (e) {}
          }
        };

        loadTargetProperty();
      } else {
        getOwnerDrafts(user.uid).then(res => {
          if (res.success && res.drafts.length > 0) {
            setDraftsList(res.drafts);
            setShowResumeModal(true);
          }
        });
      }
    }
  }, [user?.uid, resumePropertyId]);

  // Resume selected draft
  const handleResumeDraft = (draft) => {
    const resumeStep = determineResumeStep(draft);
    applyPropertyToForm(draft, resumeStep);
  };

  // Delete single draft
  const handleDeleteSingleDraft = async (draftId, e) => {
    e.stopPropagation();
    if (!draftId) return;
    try {
      await deletePropertyListing(draftId, user?.uid, false);
      const updated = draftsList.filter(d => String(d.propertyId || d.id) !== String(draftId));
      setDraftsList(updated);
      if (updated.length === 0) {
        setShowResumeModal(false);
      }
    } catch (err) {
      console.error('Error deleting draft:', err);
    }
  };

  // Clear all drafts
  const handleClearAllDrafts = async () => {
    try {
      for (const d of draftsList) {
        const dId = d.propertyId || d.id;
        if (dId) {
          await deletePropertyListing(dId, user?.uid, false);
        }
      }
      setDraftsList([]);
      setShowResumeModal(false);
    } catch (err) {
      console.error('Error clearing all drafts:', err);
    }
  };


  // Helper: Calculate formatted display strings
  const getPriceDisplay = () => {
    const p = Number(formData.price) || 0;
    if (formData.purpose === Purpose.RENT) {
      return `Rs. ${p.toLocaleString('en-IN')} / month`;
    }
    if (p >= 10000000) {
      return `Rs. ${(p / 10000000).toFixed(2)} Crores`;
    }
    if (p >= 100000) {
      return `Rs. ${(p / 100000).toFixed(2)} Lakhs`;
    }
    return `Rs. ${p.toLocaleString('en-IN')}`;
  };

  const getPricePerUnitDisplay = () => {
    const a = Number(formData.area) || 0;
    const p = Number(formData.price) || 0;
    const ppu = Number(formData.pricePerUnit) || (a > 0 && p > 0 ? Math.round(p / a) : 0);
    const unit = formData.areaUnit || formData.specs?.areaUnit || AreaUnit.SQ_FT;
    if (ppu <= 0) return '';
    return `Rs. ${ppu.toLocaleString('en-IN')} / ${unit}`;
  };

  const getAreaDisplay = () => {
    const a = Number(formData.area) || 0;
    const unit = formData.areaUnit || formData.specs?.areaUnit || AreaUnit.SQ_FT;
    return `${a.toLocaleString('en-IN')} ${unit}`;
  };

  // Step Validations
  const validateCurrentStep = () => {
    setErrorMsg(null);
    setFieldErrors({});

    const errors = {};

    if (step === 1) {
      if (!formData.purpose) {
        errors.purpose = 'Please select a transaction purpose.';
      }
      if (!formData.propertyType) {
        errors.propertyType = 'Please select a property type.';
      }
      if (formData.propertyType === PropertyType.OTHER && (!formData.otherPropertyType || !formData.otherPropertyType.trim())) {
        errors.otherPropertyType = 'Please mention what property type you are listing.';
      }
    } else if (step === 2) {
      if (!formData.title || formData.title.trim().length < 2) {
        errors.title = 'Property Title is required (minimum 2 characters).';
      }
      const priceNum = Number(formData.price);
      const ppuNum = Number(formData.pricePerUnit);
      if ((!formData.price && !formData.pricePerUnit) || (isNaN(priceNum) && isNaN(ppuNum)) || (priceNum <= 0 && ppuNum <= 0)) {
        errors.price = 'Please enter a valid price or price per unit.';
      }
      const areaNum = Number(formData.area);
      if (!formData.area || isNaN(areaNum) || areaNum <= 0) {
        errors.area = `Please enter a valid total area (${formData.areaUnit || 'sq ft'}).`;
      }
      if (!formData.description || formData.description.trim().length < 3) {
        errors.description = 'Property Description is required (minimum 3 characters).';
      }
    } else if (step === 3) {
      if (!formData.location || !formData.location.confirmed || !formData.location.geoPoint) {
        errors.location = 'Please click "Confirm Location & Continue" on the map before proceeding.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      setErrorMsg(firstError);
      return false;
    }

    return true;
  };

  const handleRefreshMedia = async (directMedia = null) => {
    if (Array.isArray(directMedia)) {
      setFormData(prev => ({
        ...prev,
        media: directMedia,
        photos: directMedia.filter(m => m.type === 'PHOTO'),
        videoUrl: directMedia.find(m => m.type !== 'PHOTO')?.publicUrl || prev.videoUrl || null,
        videoLink: directMedia.find(m => m.type !== 'PHOTO')?.publicUrl || prev.videoLink || null,
        embeddedVideoUrl: directMedia.find(m => m.type !== 'PHOTO')?.embedUrl || prev.embeddedVideoUrl || null
      }));
      return;
    }

    if (!propertyId) return;
    try {
      const { getPropertyById } = await import('../firebase/propertyService.js');
      const pRes = await getPropertyById(propertyId, user?.uid, true);
      if (pRes.success && pRes.property) {
        const prop = pRes.property;
        const mList = Array.isArray(prop.media) && prop.media.length > 0 ? prop.media : (formData.media || []);
        setFormData(prev => ({
          ...prev,
          media: mList,
          photos: mList.filter(m => m.type === 'PHOTO'),
          videoUrl: prop.videoUrl || prop.videoLink || prev.videoUrl || null,
          videoLink: prop.videoLink || prop.videoUrl || prev.videoLink || null,
          embeddedVideoUrl: prop.embeddedVideoUrl || prev.embeddedVideoUrl || null
        }));
      } else {
        const { mockApi } = await import('../services/mockApi.js');
        const pObj = mockApi.getPropertyById(propertyId);
        if (pObj && Array.isArray(pObj.media) && pObj.media.length > 0) {
          setFormData(prev => ({
            ...prev,
            media: pObj.media,
            photos: pObj.media.filter(m => m.type === 'PHOTO'),
            videoUrl: pObj.videoUrl || prev.videoUrl || null,
            videoLink: pObj.videoLink || prev.videoLink || null,
            embeddedVideoUrl: pObj.embeddedVideoUrl || prev.embeddedVideoUrl || null
          }));
        }
      }
    } catch (e) {}
  };

  const handleRefreshDocuments = async () => {
    if (!propertyId || !user?.uid) return;
    try {
      const { getPropertyDocuments } = await import('../firebase/documentService.js');
      const dRes = await getPropertyDocuments(propertyId, user.uid);
      if (dRes.success && Array.isArray(dRes.documents)) {
        setFormData(prev => ({
          ...prev,
          documents: dRes.documents
        }));
      }
    } catch (e) {}
  };

  // Auto-Save / Save Draft
  const handleSaveDraft = async (targetStep = step, customUpdates = null) => {
    if (!user?.uid) return;
    setSavingDraft(true);
    setErrorMsg(null);

    try {
      const priceNum = Number(customUpdates?.price !== undefined ? customUpdates.price : formData.price) || 0;
      const areaNum = Number(customUpdates?.area !== undefined ? customUpdates.area : formData.area) || 0;
      const ppuNum = Number(customUpdates?.pricePerUnit !== undefined ? customUpdates.pricePerUnit : formData.pricePerUnit) || (areaNum > 0 && priceNum > 0 ? Math.round(priceNum / areaNum) : 0);

      const ownerName = profile?.displayName || profile?.name || user?.displayName || user?.name || user?.email || 'EaseLand User';
      const ownerPhone = profile?.phone || profile?.phoneNumber || profile?.mobile || profile?.contactNumber || user?.phone || user?.phoneNumber || '';
      const ownerEmail = user?.email || profile?.email || '';

      const effectiveBoundary = customUpdates?.boundary !== undefined ? customUpdates.boundary : (formData.boundary || formData.ownerSubmittedBoundary || null);

      const draftData = {
        ...formData,
        ...(customUpdates || {}),
        lastStep: targetStep,
        ownerId: user?.uid || user?.id,
        ownerPublicName: ownerName,
        ownerPrivateEmail: ownerEmail,
        ownerPrivatePhone: ownerPhone,
        owner: {
          id: user?.uid || user?.id,
          name: ownerName,
          email: ownerEmail,
          phone: ownerPhone
        },
        title: customUpdates?.title !== undefined ? customUpdates.title : formData.title,
        category: customUpdates?.category !== undefined ? customUpdates.category : (formData.category || 'Open Plot Ventures'),
        propertyType: customUpdates?.propertyType !== undefined ? customUpdates.propertyType : formData.propertyType,
        otherPropertyType: customUpdates?.otherPropertyType !== undefined ? customUpdates.otherPropertyType : (formData.otherPropertyType || ''),
        purpose: customUpdates?.purpose !== undefined ? customUpdates.purpose : formData.purpose,
        price: priceNum,
        priceDisplay: getPriceDisplay(),
        pricePerUnit: ppuNum > 0 ? ppuNum : null,
        pricePerUnitDisplay: ppuNum > 0 ? ('Rs. ' + ppuNum.toLocaleString('en-IN') + ' / ' + (formData.areaUnit || AreaUnit.SQ_FT)) : '',
        area: areaNum,
        areaUnit: formData.areaUnit || formData.specs?.areaUnit || AreaUnit.SQ_FT,
        areaDisplay: getAreaDisplay(),
        description: customUpdates?.description !== undefined ? customUpdates.description : formData.description,
        specs: (() => {
          const effectivePropType = customUpdates?.propertyType !== undefined ? customUpdates.propertyType : formData.propertyType;
          const isLand = ['OPEN_PLOT', 'LAND', 'AGRICULTURAL_LAND', 'COMMERCIAL_LAND'].includes(String(effectivePropType || '').toUpperCase());
          const merged = {
            ...(formData.specs || {}),
            ...(customUpdates?.specs || {}),
            areaUnit: formData.areaUnit || formData.specs?.areaUnit || AreaUnit.SQ_FT
          };
          if (!isLand && !merged.furnishing) {
            merged.furnishing = 'Unfurnished';
          }
          return merged;
        })(),
        amenities: customUpdates?.amenities !== undefined ? customUpdates.amenities : (formData.amenities || []),
        location: customUpdates?.location !== undefined ? customUpdates.location : (formData.location || null),
        boundary: effectiveBoundary || null,
        ownerSubmittedBoundary: effectiveBoundary || null,
        media: customUpdates?.media !== undefined ? customUpdates.media : (formData.media || []),
        photos: customUpdates?.photos !== undefined ? customUpdates.photos : (formData.photos || []),
        videoUrl: formData.videoUrl || formData.videoLink || null,
        videoLink: formData.videoLink || formData.videoUrl || null,
        embeddedVideoUrl: formData.embeddedVideoUrl || null,
        documents: customUpdates?.documents !== undefined ? customUpdates.documents : (formData.documents || [])
      };

      let pId = propertyId;
      if (!pId) {
        const res = await createPropertyDraft(user.uid, { ...draftData, lastStep: targetStep });
        if (res.success && res.propertyId) {
          pId = res.propertyId;
          setPropertyId(res.propertyId);
          setReferenceId(res.referenceId);
          await savePropertyDraftStep(res.propertyId, user.uid, draftData, targetStep);
        } else if (res.error) {
          setErrorMsg(res.error);
          return;
        }
      } else {
        await savePropertyDraftStep(pId, user.uid, draftData, targetStep);
      }

      if (effectiveBoundary && pId) {
        try {
          await saveOwnerBoundarySubmission(pId, user.uid, effectiveBoundary);
        } catch (e) {}
      }

      setSuccessMsg('Property draft saved.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Draft save error:', err);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleNextStep = async () => {
    if (!validateCurrentStep()) return;
    const next = Math.min(step + 1, 8);
    await handleSaveDraft(next);
    setStep(next);
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    setFieldErrors({});
    setStep(prev => Math.max(prev - 1, 1));
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      
      {/* RESUME DRAFT MODAL */}
      {showResumeModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowResumeModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-charcoal/80 backdrop-blur-sm animate-in fade-in"
        >
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4 relative">
            <button
              type="button"
              onClick={() => setShowResumeModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              title="Close Modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pr-8">
              <div className="w-10 h-10 rounded-xl bg-brand-yellow/20 text-brand-charcoal flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-brand-charcoal" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-brand-charcoal">Resume Unfinished Draft?</h3>
                <p className="text-xs text-gray-500 font-medium">You have unfinished property drafts saved in your account.</p>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pt-2">
              {draftsList.map((d) => (
                <div key={d.propertyId || d.id} className="p-3 bg-gray-50 hover:bg-brand-yellow/10 border border-gray-200 rounded-xl flex items-center justify-between transition-colors">
                  <div>
                    <span className="block text-xs font-bold text-brand-charcoal">{d.title || 'Untitled Draft'}</span>
                    <span className="block text-[10px] text-gray-500 font-semibold">{d.propertyType} • {d.purpose} • Step {determineResumeStep(d)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSingleDraft(d.propertyId || d.id, e)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                      title="Clear Draft"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResumeDraft(d)}
                      className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-3.5 py-1.5 rounded-lg shadow-sm"
                    >
                      Resume
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleClearAllDrafts}
                className="text-xs font-bold text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Drafts</span>
              </button>

              <button
                type="button"
                onClick={() => setShowResumeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Start New Property
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WIZARD HEADER */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onCancel}
            className="text-xs font-bold text-slate-600 hover:text-brand-navy flex items-center gap-1 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Exit Wizard
          </button>

          <div className="flex items-center gap-2">
            {referenceId && (
              <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                Ref: {referenceId}
              </span>
            )}
            <span className="text-xs font-black uppercase tracking-wider text-teal-950 bg-teal-400 px-3.5 py-1 rounded-full shadow-sm border border-teal-300">
              Step {step} of 8
            </span>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {resumePropertyId || propertyId ? `Edit Property Listing: ${formData.title || 'Untitled'}` : 'List Your Property on EaseLand'}
        </h1>
        <p className="text-xs text-slate-600 font-semibold mt-1">
          {resumePropertyId || propertyId
            ? `Editing existing property (Ref: ${referenceId || propertyId || 'Draft'}). All saved details loaded — click any step to edit directly.`
            : `Direct Property Owner Draft Workflow — Step ${step} of 8.`}
        </p>

        {/* INTERACTIVE STEP JUMP PILLS */}
        <div className="flex flex-wrap gap-1.5 pt-3">
          {[
            { num: 1, label: 'Type & Purpose' },
            { num: 2, label: 'Title & Price' },
            { num: 3, label: 'Location' },
            { num: 4, label: 'Specs' },
            { num: 5, label: 'Media & Photos' },
            { num: 6, label: 'Documents' },
            { num: 7, label: 'Boundary' },
            { num: 8, label: 'Review & Submit' }
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setFieldErrors({});
                setStep(s.num);
              }}
              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                step === s.num
                  ? 'bg-brand-navy text-brand-yellow shadow-sm ring-2 ring-brand-yellow/50'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>{s.num}. {s.label}</span>
            </button>
          ))}
        </div>

        {/* STEPPER PROGRESS BAR */}
        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mt-3">
          <div
            className="bg-teal-500 h-full transition-all duration-300"
            style={{ width: `${(step / 8) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* PROFILE CRITERIA BLOCKING SCREEN / WIZARD STEP CONTAINER */}
      {missingProfileCriteria.length > 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-amber-300 shadow-xl max-w-2xl mx-auto text-center space-y-6 my-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto font-black shadow-inner">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Profile Criteria Required Before Posting</h2>
            <p className="text-xs text-slate-600 font-semibold max-w-md mx-auto leading-relaxed">
              Your Account &amp; Profile settings are missing required details. You must complete these details in Account Settings before you can list a property.
            </p>
          </div>

          <div className="bg-amber-50/80 rounded-2xl p-5 border border-amber-200 text-left space-y-2.5">
            <span className="text-[11px] font-black uppercase text-amber-900 tracking-wider block">
              Missing Required Fields ({missingProfileCriteria.length}):
            </span>
            <ul className="flex flex-wrap gap-2 pt-1">
              {missingProfileCriteria.map((field) => (
                <li key={field} className="bg-amber-100 text-amber-950 text-xs font-black px-3.5 py-1.5 rounded-xl border border-amber-300 flex items-center gap-2 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  <span>{field}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onGoToAccountSettings || onCancel}
              className="w-full sm:w-auto bg-brand-charcoal hover:bg-black text-white text-xs font-extrabold px-6 py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4 text-brand-yellow" />
              <span>Fill Details in Account Settings</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-5 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
            >
              Exit to Dashboard
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* MESSAGES */}
          {errorMsg && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* WIZARD STEP CONTAINER */}
          <div className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
        
        {/* STEP 1: PROPERTY TYPE & PURPOSE */}
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-brand-navy pb-2 border-b border-gray-200 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-yellow" />
              <span>1. Property Type & Transaction Purpose</span>
            </h3>

            {(resumePropertyId || propertyId || formData.title) && (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white px-2.5 py-0.5 rounded-md shadow-xs">
                      Editing Property Listing
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-900 bg-white/80 px-2 py-0.5 rounded border border-blue-200">
                      Ref: {referenceId || propertyId || 'Draft'}
                    </span>
                  </div>
                  <h4 className="text-base font-extrabold text-slate-900 mt-1.5 line-clamp-1">
                    {formData.title || 'Untitled Property'}
                  </h4>
                  <p className="text-xs text-slate-600 font-bold mt-0.5">
                    Price: <span className="text-emerald-700">{getPriceDisplay()}</span> • Total Area: <span className="text-slate-800">{getAreaDisplay()}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setFieldErrors({});
                      setStep(2);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    <span>Edit Title &amp; Price →</span>
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Transaction Purpose
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Sale', value: Purpose.SALE },
                  { label: 'Rent', value: Purpose.RENT },
                  { label: 'Lease', value: Purpose.LEASE }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, purpose: item.value })}
                    className={`p-3.5 rounded-xl border font-extrabold text-xs text-center transition-all ${
                      formData.purpose === item.value
                        ? 'bg-brand-navy border-brand-navy text-brand-yellow shadow-md scale-105'
                        : 'bg-white border-gray-300 text-slate-700 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Property Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Open Plot Ventures', category: 'Open Plot Ventures', value: PropertyType.OPEN_PLOT },
                  { label: 'Open Plot (City)', category: 'Open Plot (City)', value: PropertyType.OPEN_PLOT },
                  { label: 'Apartments/Flat', category: 'Apartments/Flat', value: PropertyType.APARTMENT },
                  { label: 'Independent House/Villa', category: 'Independent House/Villa', value: PropertyType.HOUSE },
                  { label: 'Commerical Property', category: 'Commerical Property', value: PropertyType.COMMERCIAL },
                  { label: 'Agricultural Lands', category: 'Agricultural Lands', value: PropertyType.LAND },
                  { label: 'Amaravathi LPS layout plots', category: 'Amaravathi LPS layout plots', value: PropertyType.OPEN_PLOT },
                  { label: 'Others', category: 'Others', value: PropertyType.OTHER }
                ].map((item) => (
                  <button
                    key={item.category}
                    type="button"
                    onClick={() => {
                      const isLand = ['OPEN_PLOT', 'LAND'].includes(item.value);
                      const currentFurn = formData.specs?.furnishing;
                      const nextFurn = (!isLand && !currentFurn) ? 'Unfurnished' : currentFurn;
                      setFormData({
                        ...formData,
                        propertyType: item.value,
                        category: item.category,
                        specs: {
                          ...(formData.specs || {}),
                          ...(nextFurn ? { furnishing: nextFurn } : {})
                        }
                      });
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                      (formData.category === item.category || (!formData.category && formData.propertyType === item.value))
                        ? 'bg-brand-navy border-brand-navy text-brand-yellow shadow-md scale-105'
                        : 'bg-white border-gray-300 text-slate-700 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {(formData.category === 'Others' || formData.propertyType === PropertyType.OTHER) && (
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Mention Your Property Type *
                  </label>
                  <input
                    type="text"
                    value={formData.otherPropertyType || ''}
                    onChange={(e) => setFormData({ ...formData, otherPropertyType: e.target.value })}
                    placeholder="Enter Property Type"
                    className={`w-full p-3.5 bg-white border ${
                      fieldErrors.otherPropertyType ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'
                    } rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-navy placeholder:text-gray-400 shadow-sm`}
                  />
                  {fieldErrors.otherPropertyType && (
                    <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{fieldErrors.otherPropertyType}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: BASIC INFORMATION & PRICING */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-brand-navy pb-2 border-b border-gray-200 flex items-center gap-2">
              <Tag className="w-5 h-5 text-brand-yellow" />
              <span>2. Basic Information & Pricing</span>
            </h3>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Property Title *
                </label>
                <span className={`text-[11px] font-bold ${(formData.title || '').trim().length >= 2 ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {(formData.title || '').trim().length} / 2 min chars
                </span>
              </div>
              <input
                type="text"
                required
                placeholder="Enter Property Title"
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value });
                  if (fieldErrors.title) setFieldErrors(prev => ({ ...prev, title: null }));
                  if (errorMsg) setErrorMsg(null);
                }}
                className={`w-full p-3.5 bg-gray-50 border rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:bg-white focus:outline-none transition-all ${
                  fieldErrors.title ? 'border-red-500 ring-2 ring-red-200 bg-red-50/30' : 'border-gray-300 focus:ring-amber-400'
                }`}
              />
              {fieldErrors.title && (
                <p className="text-[11px] font-extrabold text-red-600 mt-1 flex items-center gap-1">
                  ⚠️ {fieldErrors.title}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. TOTAL AREA (TOTAL UNITS) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Total Area (Total Units) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="Enter Total Area / Units"
                  value={formData.area}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9.]/g, '');
                    const newArea = clean;
                    const areaNum = Number(newArea);
                    const ppuNum = Number(formData.pricePerUnit);

                    let nextPrice = formData.price;
                    if (areaNum > 0 && ppuNum > 0) {
                      nextPrice = String(Math.round(areaNum * ppuNum));
                    }

                    setFormData(prev => ({
                      ...prev,
                      area: newArea,
                      price: nextPrice
                    }));
                    if (fieldErrors.area) setFieldErrors(prev => ({ ...prev, area: null }));
                    if (fieldErrors.price && nextPrice) setFieldErrors(prev => ({ ...prev, price: null }));
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className={`w-full p-3.5 bg-gray-50 border rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:bg-white focus:outline-none transition-all ${
                    fieldErrors.area ? 'border-red-500 ring-2 ring-red-200 bg-red-50/30' : 'border-gray-300 focus:ring-amber-400'
                  }`}
                />
                {formData.area && !fieldErrors.area && (
                  <span className="text-[11px] font-extrabold text-slate-700 mt-1 block">
                    Display: {getAreaDisplay()}
                  </span>
                )}
                {fieldErrors.area && (
                  <p className="text-[11px] font-extrabold text-red-600 mt-1 flex items-center gap-1">
                    ⚠️ {fieldErrors.area}
                  </p>
                )}
              </div>

              {/* 2. MEASUREMENT AREA UNIT */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Measurement Area Unit
                </label>
                <select
                  value={formData.areaUnit || AreaUnit.SQ_FT}
                  onChange={(e) => {
                    const newUnit = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      areaUnit: newUnit,
                      specs: {
                        ...(prev.specs || {}),
                        areaUnit: newUnit
                      }
                    }));
                  }}
                  className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:bg-white focus:ring-amber-400 focus:outline-none transition-all cursor-pointer"
                >
                  {Object.values(AreaUnit).map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
                <span className="text-[11px] font-extrabold text-slate-700 mt-1 block">
                  Unit: {formData.areaUnit || AreaUnit.SQ_FT}
                </span>
              </div>

              {/* 3. PRICE PER UNIT */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Price Per {formData.areaUnit || AreaUnit.SQ_FT} (INR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder={`Enter price per ${formData.areaUnit || 'unit'}`}
                  value={formData.pricePerUnit || ''}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9.]/g, '');
                    const newPPU = clean;
                    const ppuNum = Number(newPPU);
                    const areaNum = Number(formData.area);

                    let nextPrice = formData.price;
                    if (ppuNum > 0 && areaNum > 0) {
                      nextPrice = String(Math.round(areaNum * ppuNum));
                    }

                    setFormData(prev => ({
                      ...prev,
                      pricePerUnit: newPPU,
                      price: nextPrice
                    }));
                    if (fieldErrors.price && nextPrice) setFieldErrors(prev => ({ ...prev, price: null }));
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:bg-white focus:ring-amber-400 focus:outline-none transition-all"
                />
                {formData.pricePerUnit && Number(formData.pricePerUnit) > 0 && (
                  <span className="text-[11px] font-extrabold text-emerald-700 mt-1 block">
                    Display: Rs. {Number(formData.pricePerUnit).toLocaleString('en-IN')} / {formData.areaUnit || AreaUnit.SQ_FT}
                  </span>
                )}
              </div>

              {/* 4. TOTAL EXPECTED PRICE */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Total Expected Price (INR) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="Total calculated price"
                  value={formData.price}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, '');
                    const newPrice = clean;
                    const priceNum = Number(newPrice);
                    const areaNum = Number(formData.area);

                    let nextPPU = formData.pricePerUnit;
                    if (priceNum > 0 && areaNum > 0) {
                      nextPPU = String(Math.round(priceNum / areaNum));
                    }

                    setFormData(prev => ({
                      ...prev,
                      price: newPrice,
                      pricePerUnit: nextPPU
                    }));
                    if (fieldErrors.price) setFieldErrors(prev => ({ ...prev, price: null }));
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className={`w-full p-3.5 bg-gray-50 border rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:bg-white focus:outline-none transition-all ${
                    fieldErrors.price ? 'border-red-500 ring-2 ring-red-200 bg-red-50/30' : 'border-gray-300 focus:ring-amber-400'
                  }`}
                />
                {formData.price && !fieldErrors.price && (
                  <span className="text-[11px] font-extrabold text-emerald-700 mt-1 block">
                    Display: {getPriceDisplay()}
                  </span>
                )}
                {fieldErrors.price && (
                  <p className="text-[11px] font-extrabold text-red-600 mt-1 flex items-center gap-1">
                    ⚠️ {fieldErrors.price}
                  </p>
                )}
              </div>
            </div>

            {/* INTERACTIVE CALCULATION SUMMARY BANNER */}
            {Number(formData.area) > 0 && (Number(formData.pricePerUnit) > 0 || Number(formData.price) > 0) && (
              <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <Calculator className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-slate-600">Total Price Calculation:</span>
                  <span className="font-mono bg-white px-2.5 py-1 rounded-lg border border-amber-200 text-slate-900 font-extrabold text-[11px]">
                    {Number(formData.area).toLocaleString('en-IN')} {formData.areaUnit || AreaUnit.SQ_FT} × Rs. {Number(formData.pricePerUnit || (Number(formData.area) > 0 ? Math.round(Number(formData.price) / Number(formData.area)) : 0)).toLocaleString('en-IN')} / {formData.areaUnit || AreaUnit.SQ_FT}
                  </span>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-slate-500 text-[11px]">Total:</span>
                  <span className="text-emerald-700 font-black text-sm">
                    {getPriceDisplay()}
                  </span>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Property Description *
                </label>
                <span className={`text-[11px] font-bold ${(formData.description || '').trim().length >= 3 ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {(formData.description || '').trim().length} / 3 min chars
                </span>
              </div>
              <textarea
                rows={4}
                required
                placeholder="Enter Property Description"
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (fieldErrors.description) setFieldErrors(prev => ({ ...prev, description: null }));
                  if (errorMsg) setErrorMsg(null);
                }}
                className={`w-full p-3.5 bg-gray-50 border rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:bg-white focus:outline-none transition-all ${
                  fieldErrors.description ? 'border-red-500 ring-2 ring-red-200 bg-red-50/30' : 'border-gray-300 focus:ring-amber-400'
                }`}
              />
              {fieldErrors.description && (
                <p className="text-[11px] font-extrabold text-red-600 mt-1 flex items-center gap-1">
                  ⚠️ {fieldErrors.description}
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: PROPERTY LOCATION */}
        {step === 3 && (
          <PropertyLocationStep
            locationData={formData.location}
            onLocationConfirmed={(confirmedLocation) => {
              setFormData(prev => {
                const next = { ...prev, location: confirmedLocation };
                if (typeof window !== 'undefined' && propertyId) {
                  try {
                    localStorage.setItem('easeland_wizard_location_' + propertyId, JSON.stringify(confirmedLocation));
                  } catch (e) {}
                }
                return next;
              });
              handleSaveDraft(3, { location: confirmedLocation });
            }}
          />
        )}

        {/* STEP 4: SPECIFICATIONS & AMENITIES */}
        {step === 4 && (
          <PropertySpecificationsStep
            propertyType={formData.propertyType}
            purpose={formData.purpose}
            specsData={formData.specs || {}}
            selectedAmenities={formData.amenities || []}
            onChangeSpecs={(updatedSpecs) => {
              setFormData(prev => ({
                ...prev,
                specs: {
                  ...updatedSpecs,
                  areaUnit: prev.areaUnit || updatedSpecs.areaUnit || AreaUnit.SQ_FT
                }
              }));
            }}
            onChangeAmenities={(updatedAmenities) => {
              setFormData(prev => ({ ...prev, amenities: updatedAmenities }));
            }}
          />
        )}

        {/* STEP 5: PROPERTY MEDIA (PHOTOS & VIDEOS) */}
        {step === 5 && (
          <PropertyMediaStep
            propertyId={propertyId}
            ownerId={user?.uid}
            mediaList={formData.media || []}
            onUpdateMedia={handleRefreshMedia}
          />
        )}

        {/* STEP 6: CONFIDENTIAL PROPERTY DOCUMENTS */}
        {step === 6 && (
          <PropertyDocumentStep
            propertyId={propertyId}
            ownerId={user?.uid}
            documentsList={formData.documents || []}
            onUpdateDocuments={(updatedDocs) => {
              setFormData(prev => ({ ...prev, documents: updatedDocs }));
              handleSaveDraft(6, { documents: updatedDocs });
            }}
          />
        )}

        {/* STEP 7: PROPERTY BOUNDARY (OPTIONAL) */}
        {step === 7 && (
          <PropertyBoundaryStep
            propertyLocation={formData.location}
            boundaryData={formData.boundary || formData.ownerSubmittedBoundary}
            onSaveBoundary={async (boundaryPayload) => {
              setFormData(prev => ({ ...prev, boundary: boundaryPayload, ownerSubmittedBoundary: boundaryPayload }));
              await handleSaveDraft(7, { boundary: boundaryPayload, ownerSubmittedBoundary: boundaryPayload });
              setStep(8);
            }}
            onSkipBoundary={async () => {
              await handleSaveDraft(7);
              setStep(8);
            }}
            onChangeBoundary={(boundaryPayload) => {
              setFormData(prev => ({ ...prev, boundary: boundaryPayload, ownerSubmittedBoundary: boundaryPayload }));
            }}
          />
        )}

        {/* STEP 8: FINAL REVIEW & SUBMIT FOR VERIFICATION */}
        {step === 8 && (
          <PropertyReviewStep
            propertyId={propertyId}
            ownerId={user?.uid}
            formData={formData}
            referenceId={referenceId}
            onNavigateStep={(targetStep) => setStep(targetStep)}
            onSubmissionComplete={() => {
              if (onComplete) onComplete();
            }}
          />
        )}

        {/* WIZARD BOTTOM ACTIONS */}
        {step < 8 && (
          <div className="pt-4 border-t border-gray-100 space-y-3">
            {errorMsg && (
              <div className="p-3.5 bg-red-50 border-2 border-red-400 text-red-700 text-xs font-extrabold rounded-xl flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Validation Error: {errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={step === 1}
                className={`px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors border ${
                  step === 1
                    ? 'cursor-not-allowed text-slate-500 bg-gray-100 border-gray-200 font-bold'
                    : 'text-brand-navy hover:text-brand-navy bg-white hover:bg-gray-50 border-gray-300 font-extrabold shadow-sm'
                }`}
              >
                <ChevronLeft className={`w-4 h-4 ${step === 1 ? 'text-slate-500' : 'text-brand-navy'}`} />
                <span>Previous Step</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSaveDraft(step)}
                  disabled={savingDraft}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors border border-gray-200"
                >
                  <Save className="w-4 h-4 text-brand-navy" />
                  <span>{savingDraft ? 'Saving...' : 'Save Draft'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 bg-brand-yellow hover:bg-brand-yellowHover text-brand-navy font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
                >
                  <span>{step === 7 ? 'Proceed to Review' : 'Next Step'}</span>
                  <ChevronRight className="w-4 h-4 text-brand-navy" />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )}
</div>
  );
}
