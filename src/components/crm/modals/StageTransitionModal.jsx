import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  FileText,
  CreditCard,
  Building,
  UserCheck,
  ShieldCheck,
  MapPin,
  TrendingUp,
  Tag,
  DollarSign
} from 'lucide-react';
import {
  CrmDealStages,
  CrmStageLabels,
  CRM_STAGE_METADATA,
  getStageDefaultFollowUp,
  formatAmountInWords,
  DEFAULT_CRM_AGENTS
} from '../../../firebase/crmService.js';

export default function StageTransitionModal({
  isOpen,
  onClose,
  deal,
  targetStage,
  onConfirm,
  activeAgents = DEFAULT_CRM_AGENTS
}) {
  if (!isOpen || !deal || !targetStage) return null;

  const currentStageMeta = CRM_STAGE_METADATA[deal.stage] || CRM_STAGE_METADATA[CrmDealStages.NEW];
  const targetStageMeta = CRM_STAGE_METADATA[targetStage] || CRM_STAGE_METADATA[CrmDealStages.NEW];
  const defaultFollowUp = getStageDefaultFollowUp(targetStage);

  // Form State initialized based on target stage
  const [stageFormData, setStageFormData] = useState({});
  const [followUpAction, setFollowUpAction] = useState(defaultFollowUp.action);
  const [followUpDate, setFollowUpDate] = useState(defaultFollowUp.date);
  const [followUpTime, setFollowUpTime] = useState(defaultFollowUp.time);
  const [transitionNote, setTransitionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Existing stage data for this deal if any
  const existingStageData = (deal.stageData && deal.stageData[targetStage]) || {};

  useEffect(() => {
    const todayIso = new Date().toISOString().split('T')[0];
    const initialDealVal = Number(deal.dealValue) || 0;
    const defaultTokenAmt = Math.round(initialDealVal * 0.1) || 200000;

    // Prefill intelligent defaults per target stage
    let initialData = { ...existingStageData };

    if (targetStage === CrmDealStages.PRICE_NEGOTIATION) {
      initialData = {
        negotiatedPrice: existingStageData.negotiatedPrice || initialDealVal || 4500000,
        ratePerSqYd: existingStageData.ratePerSqYd || '',
        negotiationTerms: existingStageData.negotiationTerms || 'Buyer counter-offered. 30-day token window agreed.',
        revisedClosingDate: existingStageData.revisedClosingDate || deal.expectedClosingDate || '',
        ...existingStageData
      };
    } else if (targetStage === CrmDealStages.TOKEN_ADVANCE) {
      const tokenPaid = existingStageData.tokenAmount || defaultTokenAmt;
      initialData = {
        tokenAmount: tokenPaid,
        paymentMode: existingStageData.paymentMode || 'RTGS / Bank Transfer',
        paymentRef: existingStageData.paymentRef || 'UTR' + Math.floor(10000000 + Math.random() * 90000000),
        paymentDate: existingStageData.paymentDate || todayIso,
        balanceDue: Math.max(0, initialDealVal - tokenPaid),
        agreementTargetDate: existingStageData.agreementTargetDate || '',
        ...existingStageData
      };
    } else if (targetStage === CrmDealStages.SITE_VISIT) {
      const visitDateDef = new Date();
      visitDateDef.setDate(visitDateDef.getDate() + 2);
      initialData = {
        visitDate: existingStageData.visitDate || visitDateDef.toISOString().split('T')[0],
        visitTime: existingStageData.visitTime || '10:30 AM',
        assignedAgent: existingStageData.assignedAgent || deal.assignedAgent || activeAgents[0]?.name || 'EaseLand Desk',
        meetingPoint: existingStageData.meetingPoint || (deal.propertyLocation || 'Venture Main Gate'),
        visitNotes: existingStageData.visitNotes || 'Physical boundary inspection and survey stone check.',
        ...existingStageData
      };
    } else if (targetStage === CrmDealStages.DOCUMENT_AUDIT) {
      initialData = {
        legalStatus: existingStageData.legalStatus || 'CLEAR_TITLE',
        ecPeriod: existingStageData.ecPeriod || '30 Years (1996 - 2026)',
        ecNumber: existingStageData.ecNumber || 'EC/AP/' + Math.floor(10000 + Math.random() * 90000),
        advocateName: existingStageData.advocateName || 'EaseLand Senior Legal Panel',
        revenueClearance: existingStageData.revenueClearance || '1B ROR / Adangal matched, survey sub-division verified',
        auditNotes: existingStageData.auditNotes || 'All 30-year link documents examined and verified.',
        ...existingStageData
      };
    } else if (targetStage === CrmDealStages.REGISTRATION_PENDING) {
      const regDateDef = new Date();
      regDateDef.setDate(regDateDef.getDate() + 3);
      initialData = {
        sroOffice: existingStageData.sroOffice || 'Mangalagiri Sub-Registrar Office (SRO)',
        slotDate: existingStageData.slotDate || regDateDef.toISOString().split('T')[0],
        slotTime: existingStageData.slotTime || '11:30 AM',
        challanNumber: existingStageData.challanNumber || 'CHL-AP-' + Math.floor(100000 + Math.random() * 900000),
        challanAmount: existingStageData.challanAmount || Math.round(initialDealVal * 0.075),
        witnessNames: existingStageData.witnessNames || 'Two identity verified witnesses arranged',
        ...existingStageData
      };
    } else if (targetStage === CrmDealStages.CLOSED_WON) {
      initialData = {
        deedNumber: existingStageData.deedNumber || 'Doc No. ' + Math.floor(1000 + Math.random() * 9000) + '/2026',
        finalConsideration: existingStageData.finalConsideration || initialDealVal,
        commissionRealized: existingStageData.commissionRealized || Number(deal.expectedCommission) || Math.round(initialDealVal * 0.015),
        handoverDate: existingStageData.handoverDate || todayIso,
        ...existingStageData
      };
    } else if (targetStage === CrmDealStages.CLOSED_LOST) {
      initialData = {
        lossReason: existingStageData.lossReason || 'Price Disagreement',
        lossNotes: existingStageData.lossNotes || '',
        ...existingStageData
      };
    } else {
      initialData = {
        buyerBudget: existingStageData.buyerBudget || initialDealVal,
        requirements: existingStageData.requirements || 'Verified plot requirement',
        discoveryNotes: existingStageData.discoveryNotes || '',
        ...existingStageData
      };
    }

    setStageFormData(initialData);
    setFollowUpAction(defaultFollowUp.action);
    setFollowUpDate(defaultFollowUp.date);
    setFollowUpTime(defaultFollowUp.time);
    setTransitionNote('');
  }, [targetStage, deal.id]);

  const updateField = (key, value) => {
    setStageFormData(prev => {
      const next = { ...prev, [key]: value };
      // Auto-recalculate balance due in Token Advance Paid
      if (targetStage === CrmDealStages.TOKEN_ADVANCE && key === 'tokenAmount') {
        const dealVal = Number(deal.dealValue) || 0;
        const tokVal = Number(value) || 0;
        next.balanceDue = Math.max(0, dealVal - tokVal);
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);

    try {
      const followUpPayload = {
        action: followUpAction || defaultFollowUp.action,
        date: followUpDate || defaultFollowUp.date,
        time: followUpTime || defaultFollowUp.time,
        milestone: targetStageMeta.milestone
      };

      await onConfirm(deal.id, targetStage, stageFormData, followUpPayload, transitionNote);
      onClose();
    } catch (err) {
      console.error('Stage transition submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
        
        {/* HEADER: STAGE TRANSITION STEPPER */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-extrabold text-[10px] tracking-wider uppercase border border-amber-400/30">
              Stage Milestone Intake
            </span>
            <span className="text-slate-400 text-xs font-bold">
              Step {targetStageMeta.step} of 8
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 flex-wrap">
            <span>{deal.customerName}</span>
            <span className="text-slate-500 font-medium">/</span>
            <span className="text-amber-400 font-bold truncate max-w-[260px]">{deal.propertyTitle}</span>
          </h3>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800 text-xs">
            <span className="text-slate-400 font-bold">Current:</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-extrabold text-[11px]">
              {CrmStageLabels[deal.stage] || deal.stage}
            </span>
            <ArrowRight className="w-4 h-4 text-amber-400" />
            <span className="text-amber-300 font-bold">Target Stage:</span>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[11px] shadow-xs">
              {CrmStageLabels[targetStage] || targetStage}
            </span>
          </div>
        </div>

        {/* BODY: CONTEXTUAL STAGE FORM */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">

          {/* STAGE-SPECIFIC INPUT SECTIONS */}

          {/* 1. PRICE NEGOTIATION FORM */}
          {targetStage === CrmDealStages.PRICE_NEGOTIATION && (
            <div className="space-y-4">
              <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-orange-950 uppercase tracking-wide">
                    Price Negotiation & Commercial Terms
                  </h4>
                  <p className="text-xs text-orange-800 font-medium mt-0.5">
                    Record buyer counter-offer, agreed rate per sq.yd, and payment milestones.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 flex items-center justify-between">
                    <span>Negotiated Deal Value (Rs.) *</span>
                    <span className="text-[10px] font-bold text-amber-600">
                      {formatAmountInWords(stageFormData.negotiatedPrice)}
                    </span>
                  </label>
                  <input
                    type="number"
                    required
                    value={stageFormData.negotiatedPrice || ''}
                    onChange={(e) => updateField('negotiatedPrice', e.target.value)}
                    placeholder="e.g. 4500000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-black text-sm focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {[2500000, 4500000, 6000000, 8500000, 10000000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => updateField('negotiatedPrice', amt)}
                        className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer"
                      >
                        {formatAmountInWords(amt).replace('Rs. ', '')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Agreed Rate per Sq. Yd. (Rs.)
                  </label>
                  <input
                    type="number"
                    value={stageFormData.ratePerSqYd || ''}
                    onChange={(e) => updateField('ratePerSqYd', e.target.value)}
                    placeholder="e.g. 18500"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-sm focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Assists in land area to rate reconciliation
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Revised Expected Closing Date
                  </label>
                  <input
                    type="date"
                    value={stageFormData.revisedClosingDate || ''}
                    onChange={(e) => updateField('revisedClosingDate', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Commercial Concessions / Terms
                  </label>
                  <input
                    type="text"
                    value={stageFormData.negotiationTerms || ''}
                    onChange={(e) => updateField('negotiationTerms', e.target.value)}
                    placeholder="e.g. 30-day token window; seller clears boundary demarcation"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. TOKEN ADVANCE PAID FORM */}
          {targetStage === CrmDealStages.TOKEN_ADVANCE && (
            <div className="space-y-4">
              <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-2xl flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-teal-950 uppercase tracking-wide">
                    Token Advance Deposit / Bayana Commitment
                  </h4>
                  <p className="text-xs text-teal-800 font-medium mt-0.5">
                    Record advance payment received, receipt reference, and remaining balance due.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 flex items-center justify-between">
                    <span>Token Advance Amount (Rs.) *</span>
                    <span className="text-[10px] font-bold text-teal-700">
                      {formatAmountInWords(stageFormData.tokenAmount)}
                    </span>
                  </label>
                  <input
                    type="number"
                    required
                    value={stageFormData.tokenAmount || ''}
                    onChange={(e) => updateField('tokenAmount', e.target.value)}
                    placeholder="e.g. 200000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-black text-sm focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {[0.05, 0.1, 0.15, 0.2].map(pct => {
                      const calculated = Math.round((Number(deal.dealValue) || 4500000) * pct);
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => updateField('tokenAmount', calculated)}
                          className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-colors cursor-pointer"
                        >
                          {(pct * 100) + '% (' + formatAmountInWords(calculated).replace('Rs. ', '') + ')'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Payment Mode *
                  </label>
                  <select
                    value={stageFormData.paymentMode || 'RTGS / Bank Transfer'}
                    onChange={(e) => updateField('paymentMode', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
                  >
                    <option value="RTGS / Bank Transfer">RTGS / Bank Transfer (Direct Escrow)</option>
                    <option value="UPI / PhonePe / GPay">UPI (Instant Verified QR)</option>
                    <option value="Cheque / Demand Draft">Cheque / Demand Draft</option>
                    <option value="Cash Deposit">Cash Deposit with Receipt</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    UTR / Cheque / Transaction Ref *
                  </label>
                  <input
                    type="text"
                    required
                    value={stageFormData.paymentRef || ''}
                    onChange={(e) => updateField('paymentRef', e.target.value)}
                    placeholder="e.g. UTR189281729 or CHQ00412"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-xs focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={stageFormData.paymentDate || ''}
                    onChange={(e) => updateField('paymentDate', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* REMAINING BALANCE CALLOUT */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Balance Due at Registration:</span>
                <span className="font-black text-sm text-slate-900">
                  {'Rs. ' + Number(stageFormData.balanceDue || Math.max(0, (Number(deal.dealValue) || 0) - Number(stageFormData.tokenAmount || 0))).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          {/* 3. SITE VISIT SCHEDULED FORM */}
          {targetStage === CrmDealStages.SITE_VISIT && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <MapPin className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                    Plot Site Visit & Field Inspection
                  </h4>
                  <p className="text-xs text-amber-800 font-medium mt-0.5">
                    Schedule physical survey, assign escort broker, and specify landmark meeting point.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Visit Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={stageFormData.visitDate || ''}
                    onChange={(e) => updateField('visitDate', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Visit Time *
                  </label>
                  <select
                    value={stageFormData.visitTime || '10:30 AM'}
                    onChange={(e) => updateField('visitTime', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
                  >
                    {['09:00 AM', '10:00 AM', '10:30 AM', '11:30 AM', '02:00 PM', '04:00 PM', '05:30 PM'].map(tm => (
                      <option key={tm} value={tm}>{tm}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Assigned Field Officer *
                  </label>
                  <select
                    value={stageFormData.assignedAgent || activeAgents[0]?.name || ''}
                    onChange={(e) => updateField('assignedAgent', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
                  >
                    {activeAgents.map(ag => (
                      <option key={ag.id} value={ag.name}>{ag.name} ({ag.role})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Meeting Landmark / Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={stageFormData.meetingPoint || ''}
                    onChange={(e) => updateField('meetingPoint', e.target.value)}
                    placeholder="e.g. Venture Main Arch, Vijayawada Highway"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 block">
                  Plot Boundary & Landmark Instructions
                </label>
                <input
                  type="text"
                  value={stageFormData.visitNotes || ''}
                  onChange={(e) => updateField('visitNotes', e.target.value)}
                  placeholder="e.g. Check boundary survey stones; buyer wants road width confirmation"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 4. TITLE DEED AUDIT FORM */}
          {targetStage === CrmDealStages.DOCUMENT_AUDIT && (
            <div className="space-y-4">
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-purple-950 uppercase tracking-wide">
                    Title Deed & Legal Due Diligence Audit
                  </h4>
                  <p className="text-xs text-purple-800 font-medium mt-0.5">
                    Record 30-year link documentation, Encumbrance Certificate, and revenue clearance.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Legal Opinion Status *
                  </label>
                  <select
                    value={stageFormData.legalStatus || 'CLEAR_TITLE'}
                    onChange={(e) => updateField('legalStatus', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-purple-400 focus:outline-none cursor-pointer"
                  >
                    <option value="CLEAR_TITLE">Clear & Marketable (100% Free of Encumbrance)</option>
                    <option value="CONDITIONAL">Conditional Clearance (Minor Rectification Needed)</option>
                    <option value="DISPUTED">Encumbered / Red Flag Detected</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    EC Period Search *
                  </label>
                  <input
                    type="text"
                    required
                    value={stageFormData.ecPeriod || ''}
                    onChange={(e) => updateField('ecPeriod', e.target.value)}
                    placeholder="e.g. 30 Years (1996 - 2026)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Legal Auditor / Panel Advocate
                  </label>
                  <input
                    type="text"
                    value={stageFormData.advocateName || ''}
                    onChange={(e) => updateField('advocateName', e.target.value)}
                    placeholder="e.g. EaseLand Senior Legal Panel"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Revenue & Survey Subdivision Status
                  </label>
                  <input
                    type="text"
                    value={stageFormData.revenueClearance || ''}
                    onChange={(e) => updateField('revenueClearance', e.target.value)}
                    placeholder="e.g. 1B ROR / Adangal matched, survey sub-division clear"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. REGISTRATION PENDING FORM */}
          {targetStage === CrmDealStages.REGISTRATION_PENDING && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
                <Building className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-blue-950 uppercase tracking-wide">
                    Sub-Registrar Office (SRO) Registration Prep
                  </h4>
                  <p className="text-xs text-blue-800 font-medium mt-0.5">
                    Schedule registration appointment slot, record stamp duty challan, and witness verification.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    SRO Jurisdiction Office *
                  </label>
                  <input
                    type="text"
                    required
                    value={stageFormData.sroOffice || ''}
                    onChange={(e) => updateField('sroOffice', e.target.value)}
                    placeholder="e.g. Mangalagiri SRO / Guntur Sub-Registrar"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Slot Date & Time *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      required
                      value={stageFormData.slotDate || ''}
                      onChange={(e) => updateField('slotDate', e.target.value)}
                      className="w-1/2 px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <select
                      value={stageFormData.slotTime || '11:30 AM'}
                      onChange={(e) => updateField('slotTime', e.target.value)}
                      className="w-1/2 px-2.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      {['10:00 AM', '11:00 AM', '11:30 AM', '12:30 PM', '02:30 PM', '03:30 PM'].map(tm => (
                        <option key={tm} value={tm}>{tm}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Stamp Duty Challan No. *
                  </label>
                  <input
                    type="text"
                    required
                    value={stageFormData.challanNumber || ''}
                    onChange={(e) => updateField('challanNumber', e.target.value)}
                    placeholder="e.g. CHL-AP-891240"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Witness Verification Status
                  </label>
                  <input
                    type="text"
                    value={stageFormData.witnessNames || ''}
                    onChange={(e) => updateField('witnessNames', e.target.value)}
                    placeholder="e.g. 2 witnesses Aadhaar verified"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6. CLOSED WON FORM */}
          {targetStage === CrmDealStages.CLOSED_WON && (
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                    Deal Won & Registered Deed Execution
                  </h4>
                  <p className="text-xs text-emerald-800 font-medium mt-0.5">
                    Record registered document number, brokerage realized, and mutation handover.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Registered Deed / Document No. *
                  </label>
                  <input
                    type="text"
                    required
                    value={stageFormData.deedNumber || ''}
                    onChange={(e) => updateField('deedNumber', e.target.value)}
                    placeholder="e.g. Doc No. 4921/2026 (Book 1)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Commission Realized (Rs.) *
                  </label>
                  <input
                    type="number"
                    required
                    value={stageFormData.commissionRealized || ''}
                    onChange={(e) => updateField('commissionRealized', e.target.value)}
                    placeholder="e.g. 67500"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-black text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 7. CLOSED LOST FORM */}
          {targetStage === CrmDealStages.CLOSED_LOST && (
            <div className="space-y-4">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-rose-950 uppercase tracking-wide">
                    Archive Deal Dossier (Closed Lost)
                  </h4>
                  <p className="text-xs text-rose-800 font-medium mt-0.5">
                    Document loss reasoning and unreserve property parcel for other buyers.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 block">
                  Primary Loss Reason *
                </label>
                <select
                  value={stageFormData.lossReason || 'Price Disagreement'}
                  onChange={(e) => updateField('lossReason', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none cursor-pointer"
                >
                  <option value="Price Disagreement">Price Disagreement (Buyer and Seller could not agree)</option>
                  <option value="Title / EC Issue">Title / Document Discrepancy</option>
                  <option value="Buyer Backed Out">Buyer Backed Out (Personal / Financial)</option>
                  <option value="Bought Alternative Property">Buyer Purchased Alternative Plot</option>
                  <option value="Bank Loan Denied">Bank Loan / Mortgage Rejected</option>
                  <option value="Other">Other / Indefinite Postponement</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 block">
                  Loss Feedback & Archive Remarks
                </label>
                <textarea
                  rows={2}
                  value={stageFormData.lossNotes || ''}
                  onChange={(e) => updateField('lossNotes', e.target.value)}
                  placeholder="Record what caused the loss and any feedback for the owner..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium text-xs focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 8. NEW OR CONTACTED FORM */}
          {(targetStage === CrmDealStages.NEW || targetStage === CrmDealStages.CONTACTED) && (
            <div className="space-y-4">
              <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl flex items-start gap-3">
                <FileText className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-sky-950 uppercase tracking-wide">
                    Buyer Qualification & Layout Discovery
                  </h4>
                  <p className="text-xs text-sky-800 font-medium mt-0.5">
                    Capture buyer budget, preferred orientation, and shortlist preferences.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 flex items-center justify-between">
                    <span>Buyer Target Budget (Rs.)</span>
                    <span className="text-[10px] font-bold text-sky-700">
                      {formatAmountInWords(stageFormData.buyerBudget)}
                    </span>
                  </label>
                  <input
                    type="number"
                    value={stageFormData.buyerBudget || ''}
                    onChange={(e) => updateField('buyerBudget', e.target.value)}
                    placeholder="e.g. 4500000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 block">
                    Preferred Dimensions / Facing
                  </label>
                  <input
                    type="text"
                    value={stageFormData.requirements || ''}
                    onChange={(e) => updateField('requirements', e.target.value)}
                    placeholder="e.g. 200 - 300 Sq Yd East Facing"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STAGE FOLLOW-UP ACTION & TIMELINE */}
          {targetStage !== CrmDealStages.CLOSED_WON && targetStage !== CrmDealStages.CLOSED_LOST && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wide">
                    Next Stage Action Goal & Follow-up Target
                  </span>
                </div>
                <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                  Auto-Adjusted for {CrmStageLabels[targetStage] || targetStage}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Action Goal Description *
                </label>
                <input
                  type="text"
                  required
                  value={followUpAction}
                  onChange={(e) => setFollowUpAction(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-slate-900 font-bold text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Target Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-slate-900 font-bold text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Target Time
                  </label>
                  <select
                    value={followUpTime}
                    onChange={(e) => setFollowUpTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-slate-900 font-bold text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
                  >
                    {['09:00 AM', '10:00 AM', '11:00 AM', '11:30 AM', '02:00 PM', '04:00 PM', '05:30 PM'].map(tm => (
                      <option key={tm} value={tm}>{tm}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TRANSITION AUDIT NOTE */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 block">
              Optional Audit Trail Note
            </label>
            <input
              type="text"
              value={transitionNote}
              onChange={(e) => setTransitionNote(e.target.value)}
              placeholder="e.g. Client agreed on terms during in-person office meeting"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          </div>

          {/* MODAL FOOTER */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              <span>
                {isSubmitting ? 'Saving & Moving...' : ('Confirm & Move to ' + (CrmStageLabels[targetStage] || targetStage))}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
