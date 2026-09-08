import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Save, CheckCircle2, AlertCircle, RotateCcw, Building2, Tag, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { PropertyType, Purpose, ListingStatus } from '../firebase/schema.js';
import { createPropertyDraft, savePropertyDraftStep, getOwnerDrafts, getPropertyById } from '../firebase/propertyService.js';
import { saveOwnerBoundarySubmission } from '../firebase/boundaryService.js';
import PropertyLocationStep from '../components/PropertyLocationStep.jsx';
import PropertySpecificationsStep from '../components/PropertySpecificationsStep.jsx';
import PropertyMediaStep from '../components/PropertyMediaStep.jsx';
import PropertyDocumentStep from '../components/PropertyDocumentStep.jsx';
import PropertyBoundaryStep from '../components/PropertyBoundaryStep.jsx';
import PropertyReviewStep from '../components/PropertyReviewStep.jsx';

export default function PostPropertyWizard({ onComplete, onCancel, resumePropertyId = null }) {
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [propertyId, setPropertyId] = useState(null);
  const [referenceId, setReferenceId] = useState(null);

  // Resume Draft State
  const [draftsList, setDraftsList] = useState([]);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form State (Clean initialized state with 0 defaults)
  const [formData, setFormData] = useState({
    title: '',
    propertyType: PropertyType.OPEN_PLOT,
    purpose: Purpose.SALE,
    price: '',
    area: '',
    description: '',
    specs: {},
    amenities: [],
    media: [],
    location: null,
    boundary: null
  });

  // Load existing owner drafts or target resume property on mount
  useEffect(() => {
    if (user?.uid) {
      if (resumePropertyId) {
        getPropertyById(resumePropertyId, user.uid).then(res => {
          if (res.success && res.property) {
            const p = res.property;
            setPropertyId(p.propertyId);
            setReferenceId(p.referenceId);
            setFormData({
              title: p.title || '',
              propertyType: p.propertyType || PropertyType.OPEN_PLOT,
              purpose: p.purpose || Purpose.SALE,
              price: p.price ? String(p.price) : '',
              area: p.area ? String(p.area) : '',
              description: p.description || '',
              specs: p.specs || {},
              amenities: Array.isArray(p.amenities) ? p.amenities : [],
              media: Array.isArray(p.media) ? p.media : [],
              location: p.location || null,
              boundary: p.boundary || null,
              ownerSubmittedBoundary: p.ownerSubmittedBoundary || null
            });
            setStep(p.lastStep || 1);
            setShowResumeModal(false);
          }
        });
      } else {
        getOwnerDrafts(user.uid).then(res => {
          if (res.success && res.drafts.length > 0) {
            setDraftsList(res.drafts);
            setShowResumeModal(true);
          }
        });
      }
    }
  }, [user, resumePropertyId]);

  // Resume selected draft
  const handleResumeDraft = (draft) => {
    setPropertyId(draft.propertyId);
    setReferenceId(draft.referenceId);
    setFormData({
      title: draft.title || '',
      propertyType: draft.propertyType || PropertyType.OPEN_PLOT,
      purpose: draft.purpose || Purpose.SALE,
      price: draft.price ? String(draft.price) : '',
      area: draft.area ? String(draft.area) : '',
      description: draft.description || '',
      specs: draft.specs || {},
      amenities: Array.isArray(draft.amenities) ? draft.amenities : [],
      media: Array.isArray(draft.media) ? draft.media : [],
      location: draft.location || null,
      boundary: draft.boundary || null
    });
    setStep(draft.lastStep || 1);
    setShowResumeModal(false);
  };

  // Refresh media list from Firestore
  const handleRefreshMedia = async () => {
    if (!propertyId) return;
    const res = await getPropertyById(propertyId, user?.uid);
    if (res.success && res.property) {
      setFormData(prev => ({ ...prev, media: res.property.media || [] }));
    }
  };

  // Helper: Calculate formatted display strings
  const getPriceDisplay = () => {
    const p = Number(formData.price) || 0;
    if (formData.purpose === Purpose.RENT) {
      return `Rs. ${p.toLocaleString()} / month`;
    }
    if (p >= 10000000) {
      return `Rs. ${(p / 10000000).toFixed(2)} Crores`;
    }
    if (p >= 100000) {
      return `Rs. ${(p / 100000).toFixed(2)} Lakhs`;
    }
    return `Rs. ${p.toLocaleString()}`;
  };

  const getAreaDisplay = () => {
    const a = Number(formData.area) || 0;
    const unit = formData.specs?.areaUnit || 'sq ft';
    return `${a.toLocaleString()} ${unit}`;
  };

  // Step Validations
  const validateCurrentStep = () => {
    setErrorMsg(null);
    if (step === 1) {
      if (!formData.propertyType || !formData.purpose) {
        setErrorMsg('Please select both Property Type and Purpose.');
        return false;
      }
    } else if (step === 2) {
      if (!formData.title || formData.title.trim().length < 3) {
        setErrorMsg('Please enter a descriptive property title (min 3 characters).');
        return false;
      }
      const priceNum = Number(formData.price);
      if (!priceNum || priceNum <= 0) {
        setErrorMsg('Please enter a valid positive price amount.');
        return false;
      }
      const areaNum = Number(formData.area);
      if (!areaNum || areaNum <= 0) {
        setErrorMsg('Please enter a valid positive total area.');
        return false;
      }
      if (!formData.description || formData.description.trim().length < 10) {
        setErrorMsg('Please provide a property description (min 10 characters).');
        return false;
      }
    } else if (step === 3) {
      if (!formData.location || !formData.location.confirmed || !formData.location.geoPoint) {
        setErrorMsg('Please explicitly confirm the property location before proceeding.');
        return false;
      }
    }
    return true;
  };

  // Auto-Save / Save Draft
  const handleSaveDraft = async (targetStep = step) => {
    if (!user?.uid) return;
    setSavingDraft(true);
    setErrorMsg(null);

    try {
      const priceNum = Number(formData.price) || 0;
      const areaNum = Number(formData.area) || 0;

      const draftData = {
        title: formData.title,
        propertyType: formData.propertyType,
        purpose: formData.purpose,
        price: priceNum,
        priceDisplay: getPriceDisplay(),
        area: areaNum,
        areaDisplay: getAreaDisplay(),
        description: formData.description,
        specs: formData.specs || {},
        amenities: formData.amenities || [],
        location: formData.location || null
      };

      let pId = propertyId;
      if (!pId) {
        const res = await createPropertyDraft(user.uid, draftData);
        if (res.success && res.propertyId) {
          pId = res.propertyId;
          setPropertyId(res.propertyId);
          setReferenceId(res.referenceId);
        } else if (res.error) {
          setErrorMsg(res.error);
          return;
        }
      } else {
        await savePropertyDraftStep(pId, user.uid, draftData, targetStep);
      }

      if (formData.boundary && pId) {
        try {
          await saveOwnerBoundarySubmission(pId, user.uid, formData.boundary);
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
    setStep(prev => Math.max(prev - 1, 1));
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      
      {/* RESUME DRAFT MODAL */}
      {showResumeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-charcoal/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-yellow/20 text-brand-charcoal flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-brand-charcoal" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-brand-charcoal">Resume Unfinished Draft?</h3>
                <p className="text-xs text-gray-500 font-medium">You have unfinished property drafts saved in your account.</p>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pt-2">
              {draftsList.map((d) => (
                <div key={d.propertyId} className="p-3 bg-gray-50 hover:bg-brand-yellow/10 border border-gray-200 rounded-xl flex items-center justify-between transition-colors">
                  <div>
                    <span className="block text-xs font-bold text-brand-charcoal">{d.title || 'Untitled Draft'}</span>
                    <span className="block text-[10px] text-gray-500 font-semibold">{d.propertyType} • {d.purpose} • Step {d.lastStep || 1}</span>
                  </div>
                  <button
                    onClick={() => handleResumeDraft(d)}
                    className="bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-3 py-1.5 rounded-lg shadow-sm"
                  >
                    Resume
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
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
            className="text-xs font-bold text-gray-500 hover:text-brand-charcoal flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Exit Wizard
          </button>

          <div className="flex items-center gap-2">
            {referenceId && (
              <span className="text-[11px] font-mono font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                Ref: {referenceId}
              </span>
            )}
            <span className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal bg-brand-yellow px-3 py-1 rounded-full">
              Step {step} of 8
            </span>
          </d        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
          List Your Property on EaseLand
        </h1>
        <p className="text-xs text-slate-400 font-medium mt-1">
          Direct Property Owner Draft Workflow — Step {step} of 8.
        </p>

        {/* STEPPER PROGRESS BAR */}
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-4">
          <div
            className="bg-metallic-gold h-full transition-all duration-300"
            style={{ width: `${(step / 8) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* MESSAGES */}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-semibold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* WIZARD STEP CONTAINER */}
      <div className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-300 shadow-2xl space-y-6">
        
        {/* STEP 1: PROPERTY TYPE & PURPOSE */}
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 pb-2 border-b border-gray-200 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-500" />
              <span>1. Property Type & Transaction Purpose</span>
            </h3>

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
                        ? 'bg-metallic-gold border-amber-400 text-slate-950 shadow-md scale-105'
                        : 'bg-gray-50 border-gray-300 text-slate-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Property Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Open Plot', value: PropertyType.OPEN_PLOT },
                  { label: 'House / Villa', value: PropertyType.HOUSE },
                  { label: 'Apartment', value: PropertyType.APARTMENT },
                  { label: 'Villa', value: PropertyType.VILLA },
                  { label: 'Commercial', value: PropertyType.COMMERCIAL },
                  { label: 'Rental', value: PropertyType.RENTAL },
                  { label: 'Land', value: PropertyType.LAND },
                  { label: 'Other', value: PropertyType.OTHER }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, propertyType: item.value })}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                      formData.propertyType === item.value
                        ? 'bg-slate-900 border-slate-900 text-amber-400 shadow-md scale-105'
                        : 'bg-gray-50 border-gray-300 text-slate-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: BASIC INFORMATION & PRICING */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 pb-2 border-b border-gray-200 flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-500" />
              <span>2. Basic Information & Pricing</span>
            </h3>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Property Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Premium 200 Sq Yds East Facing Residential Plot"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-400 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Expected Price (INR)
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 4500000"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-400 focus:bg-white focus:outline-none"
                />
                {formData.price && (
                  <span className="text-[11px] font-extrabold text-emerald-700 mt-1 block">
                    Display: {getPriceDisplay()}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Total Area
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 1800"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-400 focus:bg-white focus:outline-none"
                />
                {formData.area && (
                  <span className="text-[11px] font-extrabold text-slate-700 mt-1 block">
                    Display: {getAreaDisplay()}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Property Description
              </label>
              <textarea
                rows={4}
                required
                placeholder="Describe key features, surroundings, approach road, and highlights..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* STEP 3: PROPERTY LOCATION */}
        {step === 3 && (
          <PropertyLocationStep
            locationData={formData.location}
            onLocationConfirmed={(confirmedLocation) => {
              setFormData(prev => ({ ...prev, location: confirmedLocation }));
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
              setFormData(prev => ({ ...prev, specs: updatedSpecs }));
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
          />
        )}

        {/* STEP 7: PROPERTY BOUNDARY (OPTIONAL) */}
        {step === 7 && (
          <PropertyBoundaryStep
            propertyLocation={formData.location}
            boundaryData={formData.boundary}
            onSaveBoundary={async (boundaryPayload) => {
              setFormData(prev => ({ ...prev, boundary: boundaryPayload }));
              await handleSaveDraft(7);
              setStep(8);
            }}
            onSkipBoundary={async () => {
              await handleSaveDraft(7);
              setStep(8);
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
          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={step === 1}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors ${
                step === 1 ? 'opacity-40 cursor-not-allowed text-gray-400' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSaveDraft(step)}
                disabled={savingDraft}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-4 h-4 text-brand-charcoal" />
                <span>{savingDraft ? 'Saving...' : 'Save Draft'}</span>
              </button>

              <button
                type="button"
                onClick={handleNextStep}
                className="px-6 py-2.5 bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <span>{step === 7 ? 'Proceed to Review' : 'Next Step'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
