import React, { useState, useEffect } from 'react';
import { Lock, FileText, Upload, Trash2, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, EyeOff } from 'lucide-react';
import { DocumentType, VerificationStatus } from '../firebase/schema.js';
import { uploadConfidentialPropertyDocument, getPropertyDocuments, removeConfidentialPropertyDocument } from '../firebase/documentService.js';

export default function PropertyDocumentStep({ propertyId, ownerId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [documentType, setDocumentType] = useState(DocumentType.TITLE_DEED);
  const [customDocName, setCustomDocName] = useState('');

  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Load existing confidential documents for this property
  const fetchDocuments = async () => {
    if (!propertyId || !ownerId) return;
    setLoading(true);
    const res = await getPropertyDocuments(propertyId, ownerId);
    if (res.success) {
      setDocuments(res.documents || []);
    } else {
      setErrorMsg(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, [propertyId, ownerId]);

  // Handle Document Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!propertyId || !ownerId) {
      setErrorMsg('Please save initial property details before uploading confidential documents.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);

    const result = await uploadConfidentialPropertyDocument({
      propertyId,
      ownerId,
      file,
      documentType,
      documentName: customDocName.trim(),
      onProgress: (pct) => setUploadProgress(pct)
    });

    setUploading(false);
    if (result.success) {
      setSuccessMsg('Confidential document uploaded. Saved securely for Admin verification.');
      setCustomDocName('');
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchDocuments();
    } else {
      setErrorMsg(result.error);
    }
  };

  // Handle Document Removal
  const handleRemoveDocument = async (docId) => {
    if (!docId || !ownerId) return;
    setErrorMsg(null);
    const res = await removeConfidentialPropertyDocument(docId, propertyId, ownerId);
    if (res.success) {
      setSuccessMsg('Document removed.');
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchDocuments();
    } else {
      setErrorMsg(res.error);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-brand-charcoal flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-500" />
            <span>Confidential Property & Legal Documents</span>
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Attach confidential title deeds, layout approvals, or tax receipts for Admin verification.
          </p>
        </div>

        <span className="text-[10px] font-mono bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg font-extrabold flex items-center gap-1">
          <EyeOff className="w-3 h-3 text-red-600" />
          <span>Strictly Private</span>
        </span>
      </div>

      {/* CONFIDENTIALITY NOTICE BANNER */}
      <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-medium space-y-1">
        <span className="font-extrabold flex items-center gap-1.5 text-amber-950">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <span>Strict Confidentiality Guarantee:</span>
        </span>
        <span>
          Confidential property documents are stored in an encrypted private vault (`private_docs/`). They are accessible ONLY by authorized EaseLand Verification Admins. Customers and public users will NEVER have access to these documents.
        </span>
      </div>

      {/* MESSAGES */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* UPLOAD PROGRESS BAR */}
      {uploading && (
        <div className="p-4 bg-brand-yellow/10 border border-brand-yellow rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs font-extrabold text-brand-charcoal">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-brand-charcoal" />
              Uploading confidential document to private vault...
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-brand-yellow h-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* UPLOAD FORM */}
      <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-200 space-y-4">
        <h4 className="text-xs font-black uppercase tracking-wider text-gray-700">
          Upload New Confidential Document
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Document Category</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
            >
              <option value={DocumentType.TITLE_DEED}>Title Deed / Deed of Sale</option>
              <option value={DocumentType.SALE_DEED}>Registered Sale Deed</option>
              <option value={DocumentType.ENCUMBRANCE_CERTIFICATE}>Encumbrance Certificate (EC)</option>
              <option value={DocumentType.LAYOUT_APPROVAL}>Layout Approval / Plot Map</option>
              <option value={DocumentType.TAX_RECEIPT}>Property Tax Receipt</option>
              <option value={DocumentType.OWNERSHIP_DOCUMENT}>Ownership Document</option>
              <option value={DocumentType.IDENTITY_DOCUMENT}>Identity / KYC Document</option>
              <option value={DocumentType.PROPERTY_DOCUMENT}>General Property Document</option>
              <option value={DocumentType.APPROVAL_DOCUMENT}>Municipal Approval Document</option>
              <option value={DocumentType.OTHER}>Other Legal Document</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Document Title (Optional)</label>
            <input
              type="text"
              placeholder="e.g. EC Certificate 2024-2025"
              value={customDocName}
              onChange={(e) => setCustomDocName(e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-gray-500 font-medium">
            Supported formats: PDF, JPEG, PNG, WebP (Max 25MB per document).
          </span>

          <label className="cursor-pointer bg-brand-charcoal hover:bg-black text-brand-yellow font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-2 shrink-0">
            <Upload className="w-4 h-4" />
            <span>Select & Upload Document</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* DOCUMENT LIST */}
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-gray-700">
          Uploaded Property Documents ({documents.length})
        </h4>

        {loading ? (
          <div className="p-4 text-center text-xs text-gray-500 font-semibold">
            Loading confidential documents...
          </div>
        ) : documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map((docItem) => (
              <div key={docItem.docId} className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-extrabold text-brand-charcoal">
                      {docItem.documentName}
                    </span>
                    <span className="block text-[10px] text-gray-500 font-semibold">
                      Category: {docItem.documentType} • Size: {(docItem.fileSize / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                    {docItem.verificationStatus || 'PENDING'}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemoveDocument(docItem.docId)}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 bg-white rounded-xl border border-gray-200 text-xs text-gray-500 text-center font-medium">
            No confidential documents uploaded yet. Upload legal papers or title deeds for Admin verification.
          </div>
        )}
      </div>

    </div>
  );
}
