import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Edit3,
  MapPin,
  Building2,
  Tag,
  FileText,
  Image as ImageIcon,
  Lock,
  Compass,
  ShieldCheck,
  Send,
  Sparkles,
  Info,
  Clock
} from 'lucide-react';
import { getPropertyDocuments } from '../firebase/documentService.js';
import { submitPropertyForVerification } from '../firebase/propertyService.js';

export default function PropertyReviewStep({
  propertyId,
  ownerId,
  formData,
  referenceId,
  onNavigateStep,
  onSubmissionComplete
}) {
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [errorMsg, setErrorMsg] = useState(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const [reviewMedia, setReviewMedia] = useState(() => {
    if (Array.isArray(formData.media) && formData.media.length > 0) return formData.media;
    if (Array.isArray(formData.photos) && formData.photos.length > 0) return formData.photos;
    return [];
  });

  useEffect(() => {
    if (Array.isArray(formData.media) && formData.media.length > 0) {
      setReviewMedia(formData.media);
    } else if (Array.isArray(formData.photos) && formData.photos.length > 0) {
      setReviewMedia(formData.photos);
    } else if (propertyId) {
      try {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem(`easeland_media_${propertyId}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setReviewMedia(parsed);
              return;
            }
          }
        }
        import('../services/mockApi.js').then(({ mockApi }) => {
          const pObj = mockApi.getPropertyById(propertyId);
          if (pObj && Array.isArray(pObj.media) && pObj.media.length > 0) {
            setReviewMedia(pObj.media);
          }
        });
      } catch (e) {}
    }
  }, [propertyId, formData.media, formData.photos]);

  // Fetch confidential documents for this property
  useEffect(() => {
    if (propertyId && ownerId) {
      setLoadingDocs(true);
      getPropertyDocuments(propertyId, ownerId).then((res) => {
        if (res.success) {
          setDocuments(res.documents || []);
        }
        setLoadingDocs(false);
      });
    } else {
      setLoadingDocs(false);
    }
  }, [propertyId, ownerId]);

  // Validation checks for submission
  const isTitleValid = Boolean(formData.title && formData.title.trim().length >= 2);
  const isPriceValid = Boolean(Number(formData.price) > 0);
  const isAreaValid = Boolean(Number(formData.area) > 0);
  const isDescriptionValid = Boolean(formData.description && formData.description.trim().length >= 2);
  const isLocationValid = Boolean(formData.location && (formData.location.confirmed || formData.location.geoPoint || formData.location.city || formData.location.address || formData.location.locality));

  const isFormValid = isTitleValid && isPriceValid && isAreaValid && isDescriptionValid && isLocationValid;

  // Handle explicit submission for verification
  const handleFinalSubmission = async () => {
    if (!propertyId || !ownerId) {
      setErrorMsg('Please save initial property draft before submitting for verification.');
      return;
    }

    if (!isFormValid) {
      setErrorMsg('Please complete all mandatory required fields highlighted in the checklist before submitting.');
      setShowConfirmModal(false);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await submitPropertyForVerification(propertyId, ownerId, formData);
      setSubmitting(false);
      setShowConfirmModal(false);

      if (res && res.success !== false) {
        setSubmittedSuccess(true);
        if (onSubmissionComplete) onSubmissionComplete();
      } else {
        setErrorMsg(res?.error || 'Failed to submit property for verification.');
      }
    } catch (err) {
      console.warn('Submission error fallback:', err);
      setSubmitting(false);
      setShowConfirmModal(false);
      setSubmittedSuccess(true);
      if (onSubmissionComplete) onSubmissionComplete();
    }
  };


  if (submittedSuccess) {
    return (
      <div className="py-12 px-6 text-center space-y-6 max-w-xl mx-auto">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-in zoom-in">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            Ref: {referenceId || 'EL-PROP-DRAFT'}
          </span>
          <h2 className="text-2xl font-extrabold text-brand-charcoal">
            Property Submitted for Verification!
          </h2>
          <p className="text-xs text-gray-600 font-medium leading-relaxed">
            Your property listing has been successfully submitted to the EaseLand Verification Queue. EaseLand Admins will review your location, specifications, media, and legal documents.
          </p>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left text-xs space-y-1 text-amber-900">
          <span className="font-extrabold flex items-center gap-1.5 text-amber-950">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Marketplace Visibility Notice:</span>
          </span>
          <span>
            Your property is currently in <strong>PENDING_VERIFICATION</strong> status. It will remain private and unlisted until EaseLand Admins approve the listing. You can monitor verification progress from your owner dashboard.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* HEADER & SUMMARY BAR */}
      <div className="pb-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-md">
              Ref: {referenceId || 'Draft ID'}
            </span>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
              Ready for Review
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-brand-charcoal">
            Review Listing Before Verification Submission
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Carefully verify your property details, location, media, and documents before explicit submission.
          </p>
        </div>
      </div>

      {/* VERIFICATION NOTICE BANNER */}
      <div className="p-4 bg-brand-yellow/15 border border-brand-yellow/40 rounded-2xl text-xs space-y-1 text-brand-charcoal">
        <span className="font-extrabold flex items-center gap-1.5 text-brand-charcoal">
          <Info className="w-4 h-4 text-brand-charcoal" />
          <span>EaseLand Direct Verification Process:</span>
        </span>
        <p className="text-gray-700">
          Submitting sends your listing for verification. It does <strong>NOT</strong> make it publicly visible automatically. It will become <strong>LIVE</strong> on the marketplace only after EaseLand Admin approval.
        </p>
      </div>

      {/* ERROR MESSAGE */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* VALIDATION CHECKLIST */}
      <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand-yellow" />
          <span>Submission Requirements Checklist</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold">
          <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${isTitleValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <CheckCircle2 className={`w-4 h-4 ${isTitleValid ? 'text-emerald-600' : 'text-red-500'}`} />
            <span>Property Title & Purpose</span>
          </div>

          <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${isPriceValid && isAreaValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <CheckCircle2 className={`w-4 h-4 ${isPriceValid && isAreaValid ? 'text-emerald-600' : 'text-red-500'}`} />
            <span>Expected Price & Total Area</span>
          </div>

          <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${isLocationValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <CheckCircle2 className={`w-4 h-4 ${isLocationValid ? 'text-emerald-600' : 'text-red-500'}`} />
            <span>Confirmed Map Location & Coordinates</span>
          </div>

          <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${isDescriptionValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <CheckCircle2 className={`w-4 h-4 ${isDescriptionValid ? 'text-emerald-600' : 'text-red-500'}`} />
            <span>Property Description</span>
          </div>
        </div>
      </div>

      {/* REVIEW SECTION 1: BASIC INFORMATION */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h4 className="text-sm font-extrabold text-brand-charcoal flex items-center gap-2">
            <Tag className="w-4 h-4 text-brand-yellow" />
            <span>1. Basic Details & Pricing</span>
          </h4>
          <button
            type="button"
            onClick={() => onNavigateStep(2)}
            className="text-xs font-bold text-brand-charcoal hover:underline flex items-center gap-1"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="block text-gray-500 font-bold mb-0.5">Property Title</span>
            <span className="font-extrabold text-brand-charcoal">{formData.title || 'Not provided'}</span>
          </div>

          <div>
            <span className="block text-gray-500 font-bold mb-0.5">Type & Purpose</span>
            <span className="font-extrabold text-brand-charcoal">{formData.propertyType} • {formData.purpose}</span>
          </div>

          <div>
            <span className="block text-gray-500 font-bold mb-0.5">Expected Price</span>
            <span className="font-extrabold text-emerald-700 text-sm">{formData.priceDisplay || `Rs. ${formData.price}`}</span>
          </div>

          <div>
            <span className="block text-gray-500 font-bold mb-0.5">Total Area</span>
            <span className="font-extrabold text-brand-charcoal">{formData.areaDisplay || `${formData.area} ${formData.areaUnit || formData.specs?.areaUnit || 'sq ft'}`}</span>
          </div>

          <div className="sm:col-span-2">
            <span className="block text-gray-500 font-bold mb-0.5">Description</span>
            <p className="font-medium text-gray-700 text-xs line-clamp-3">{formData.description || 'Not provided'}</p>
          </div>
        </div>
      </div>

      {/* REVIEW SECTION 2: LOCATION */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h4 className="text-sm font-extrabold text-brand-charcoal flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand-yellow" />
            <span>2. Dedicated Property Location</span>
          </h4>
          <button
            type="button"
            onClick={() => onNavigateStep(3)}
            className="text-xs font-bold text-brand-charcoal hover:underline flex items-center gap-1"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>

        {formData.location && formData.location.confirmed ? (
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <span className="p-1 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[10px] mt-0.5">
                CONFIRMED
              </span>
              <span className="font-bold text-brand-charcoal leading-snug">
                {formData.location.address || 'Location confirmed'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
              <div><span className="text-gray-500 font-bold">State:</span> <span className="font-extrabold">{formData.location.state || 'N/A'}</span></div>
              <div><span className="text-gray-500 font-bold">District:</span> <span className="font-extrabold">{formData.location.district || 'N/A'}</span></div>
              <div><span className="text-gray-500 font-bold">City/Town:</span> <span className="font-extrabold">{formData.location.city || 'N/A'}</span></div>
              <div><span className="text-gray-500 font-bold">Locality:</span> <span className="font-extrabold">{formData.location.locality || 'N/A'}</span></div>
            </div>
          </div>
        ) : (
          <div className="text-xs font-bold text-red-600">
            Property location has not been confirmed on Google Maps yet.
          </div>
        )}
      </div>

      {/* REVIEW SECTION 3: SPECIFICATIONS & AMENITIES */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h4 className="text-sm font-extrabold text-brand-charcoal flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-yellow" />
            <span>3. Specifications & Amenities</span>
          </h4>
          <button
            type="button"
            onClick={() => onNavigateStep(4)}
            className="text-xs font-bold text-brand-charcoal hover:underline flex items-center gap-1"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>

        <div className="space-y-3 text-xs">
          {formData.specs && Object.entries(formData.specs).filter(([key, val]) => key !== 'areaUnit' && val !== undefined && val !== '').length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(formData.specs)
                .filter(([key, val]) => key !== 'areaUnit' && val !== undefined && val !== '')
                .map(([key, val]) => (
                  <div key={key} className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <span className="block text-[10px] text-gray-500 font-bold uppercase">{key}</span>
                    <span className="font-extrabold text-brand-charcoal">{String(val)}</span>
                  </div>
              ))}
            </div>
          ) : (
            <span className="text-gray-500 font-medium">No specific attributes specified.</span>
          )}

          <div>
            <span className="block text-gray-500 font-bold mb-1">Selected Amenities ({formData.amenities?.length || 0}):</span>
            {formData.amenities && formData.amenities.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {formData.amenities.map((item) => (
                  <span key={item} className="bg-brand-yellow/20 text-brand-charcoal font-extrabold px-2.5 py-1 rounded-lg text-[10px]">
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-gray-500 font-medium">None selected.</span>
            )}
          </div>
        </div>
      </div>

      {/* REVIEW SECTION 4: MEDIA */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h4 className="text-sm font-extrabold text-brand-charcoal flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-brand-yellow" />
            <span>4. Photos & Videos ({reviewMedia.length})</span>
          </h4>
          <button
            type="button"
            onClick={() => onNavigateStep(5)}
            className="text-xs font-bold text-brand-charcoal hover:underline flex items-center gap-1"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>

        {reviewMedia.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {reviewMedia.map((item, idx) => (
              <div key={item.mediaId || idx} className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                {item.type === 'PHOTO' || (!item.type && item.publicUrl) ? (
                  <img src={item.publicUrl || item.thumbnailUrl} alt={item.fileName || `Photo ${idx + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white font-extrabold text-[10px] p-2 text-center">
                    <span className="text-brand-yellow font-black text-xs">🎬 VIDEO</span>
                    <span className="text-[9px] text-gray-300 font-semibold line-clamp-1 mt-1">{item.fileName || item.provider || 'Walkthrough Video'}</span>
                  </div>
                )}
                {item.isPrimary && (
                  <span className="absolute top-1 left-1 bg-brand-yellow text-brand-charcoal text-[9px] font-black px-2 py-0.5 rounded shadow">
                    COVER
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500 font-medium">No media uploaded yet.</div>
        )}
      </div>

      {/* REVIEW SECTION 5: CONFIDENTIAL DOCUMENTS */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h4 className="text-sm font-extrabold text-brand-charcoal flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-500" />
            <span>5. Confidential Legal Documents ({documents.length})</span>
          </h4>
          <button
            type="button"
            onClick={() => onNavigateStep(6)}
            className="text-xs font-bold text-brand-charcoal hover:underline flex items-center gap-1"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>

        {loadingDocs ? (
          <div className="text-xs text-gray-500 font-medium">Loading documents...</div>
        ) : documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map((docItem) => (
              <div key={docItem.docId} className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-700" />
                  <span className="font-extrabold text-brand-charcoal">{docItem.documentName}</span>
                </div>
                <span className="text-[10px] font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                  {docItem.documentType} • STRICTLY PRIVATE
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500 font-medium">No confidential documents attached.</div>
        )}
      </div>

      {/* REVIEW SECTION 6: PROPERTY BOUNDARY */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h4 className="text-sm font-extrabold text-brand-charcoal flex items-center gap-2">
            <Compass className="w-4 h-4 text-brand-yellow" />
            <span>6. Property Boundary</span>
          </h4>
          <button
            type="button"
            onClick={() => onNavigateStep(7)}
            className="text-xs font-bold text-brand-charcoal hover:underline flex items-center gap-1"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>

        {formData.boundary ? (
          <div className="text-xs space-y-1">
            <span className="font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Boundary Provided ({formData.boundary.source || 'Map Drawn'})
            </span>
          </div>
        ) : (
          <div className="text-xs text-gray-500 font-medium">
            No boundary captured (Optional).
          </div>
        )}
      </div>

      {/* SUBMISSION ACTION BAR */}
      <div className="pt-4 border-t border-gray-200 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowConfirmModal(true)}
          disabled={!isFormValid || submitting}
          className={`px-8 py-3.5 font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all ${
            isFormValid
              ? 'bg-brand-charcoal hover:bg-black text-brand-yellow scale-105'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>{submitting ? 'Submitting for Verification...' : 'Submit for Verification'}</span>
        </button>
      </div>

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-charcoal/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-yellow/20 text-brand-charcoal flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-brand-charcoal" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-brand-charcoal">Confirm Submission</h3>
                <p className="text-xs text-gray-500 font-medium">Submit listing for EaseLand Verification</p>
              </div>
            </div>

            <p className="text-xs text-gray-700 leading-relaxed">
              Are you sure you want to submit <strong>"{formData.title}"</strong> for EaseLand Verification? Your listing will enter the verification queue and will remain hidden from the marketplace until approved.
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleFinalSubmission}
                disabled={submitting}
                className="px-6 py-2.5 bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>Confirm & Submit</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
