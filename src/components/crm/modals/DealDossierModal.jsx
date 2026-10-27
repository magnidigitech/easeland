import React from 'react';
import {
  FileText,
  X,
  MapPin,
  MessageSquare,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Lock,
  Clock
} from 'lucide-react';
import { CrmStageLabels } from '../../../firebase/crmService.js';

export default function DealDossierModal({
  deal,
  onClose,
  onTriggerWhatsApp,
  onDeleteDeal,
  onAdvanceStage,
  onOpenFollowUp,
  kanbanStages = [],
  isFieldExecutive = false
}) {
  if (!deal) return null;

  const maskPhone = (ph) => {
    if (!ph) return '';
    if (!isFieldExecutive) return ph;
    const str = String(ph).trim();
    if (str.length <= 5) return '****';
    return str.slice(0, 3) + '****' + str.slice(-3);
  };

  const maskEmail = (em) => {
    if (!em) return '';
    if (!isFieldExecutive) return em;
    const parts = em.split('@');
    if (parts.length < 2) return '****@easeland.in';
    return parts[0].slice(0, 1) + '***@' + parts[1];
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up max-h-[90dvh] flex flex-col">

        {/* MODAL HEADER */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              <FileText className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-base">Transaction Deal Dossier</h4>
                {deal.isPropertyQuarantined && (
                  <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                    Quarantined
                  </span>
                )}
              </div>
              <span className="text-xs text-amber-400 font-mono font-semibold">{deal.id}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">

          {/* COMPLIANCE QUARANTINE WARNING BANNER */}
          {deal.isPropertyQuarantined && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-start gap-3 text-rose-950">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <span className="font-black text-rose-900 text-sm block">
                  COMPLIANCE NOTICE: PROPERTY QUARANTINED
                </span>
                <p className="leading-relaxed font-medium">
                  This transaction is frozen because the underlying land parcel was flagged or removed by Admin Compliance. Stage advancement, customer deposits, and closing actions are locked pending clearance.
                </p>
              </div>
            </div>
          )}

          {/* STAGE & FINANCIALS BANNER */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Current Stage</span>
              <span className="font-black text-slate-900 text-sm block truncate">{CrmStageLabels[deal.stage] || deal.stage}</span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Deal Value</span>
              <span className="font-black text-emerald-600 text-sm block truncate">{deal.dealValueDisplay || ('Rs. ' + ((Number(deal.dealValue) || 0) / 100000).toFixed(1) + ' Lakhs')}</span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Brokerage Fee</span>
              <span className="font-black text-amber-600 text-sm block truncate">Rs. {Number(deal.expectedCommission || 0).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Legal Audit</span>
              <span className="font-black text-blue-600 text-sm block truncate">{deal.legalAuditStatus || 'VERIFIED'}</span>
            </div>
          </div>

          {/* CLIENT FOLLOW-UP STATUS & SCHEDULER BANNER */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-xs font-black">
                <Clock className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider block">
                  Next Scheduled Client Follow-up
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-sm text-slate-900">
                    {deal.nextFollowUpDate
                      ? deal.nextFollowUpDate + (deal.nextFollowUpTime ? ' at ' + deal.nextFollowUpTime : '')
                      : 'No follow-up scheduled'}
                  </span>
                  {deal.nextFollowUpAction && (
                    <span className="text-xs font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md">
                      {deal.nextFollowUpAction}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {onOpenFollowUp && (
              <button
                type="button"
                onClick={() => onOpenFollowUp(deal)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{deal.nextFollowUpDate ? 'Update Follow-up' : 'Schedule Follow-up'}</span>
              </button>
            )}
          </div>

          {/* PARTIES INVOLVED */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block">Purchaser / Buyer</span>
                {isFieldExecutive && (
                  <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Masked
                  </span>
                )}
              </div>
              <h5 className="font-black text-sm text-slate-900">{deal.customerName}</h5>
              <span className="text-xs text-slate-600 font-bold block">{maskPhone(deal.customerPhone) || 'Direct Platform Lead'}</span>
              {deal.customerEmail && <span className="text-xs text-slate-400 block truncate">{maskEmail(deal.customerEmail)}</span>}
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block">Property Owner / Seller</span>
                {isFieldExecutive && (
                  <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Masked
                  </span>
                )}
              </div>
              <h5 className="font-black text-sm text-slate-900">{deal.ownerName || 'Verified Platform Owner'}</h5>
              <span className="text-xs text-slate-600 font-bold block">{maskPhone(deal.ownerPhone) || '+91 Direct Registered'}</span>
            </div>
          </div>

          {/* PROPERTY PARCEL SPECIFICATION */}
          <div className="space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">Land Parcel Specification</span>
            <h5 className="font-black text-sm text-slate-900">{deal.propertyTitle}</h5>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{deal.propertyLocation || 'Verified Location'}</span>
            </p>
          </div>

          {/* PAYMENT MILESTONES & TOKEN ADVANCE STATUS */}
          <div className="space-y-2">
            <span className="text-xs font-black text-slate-900 block">Payment Milestones & Token Status</span>
            <div className="space-y-2">
              {(deal.paymentMilestones || []).length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs font-semibold">
                  Standard token advance deposit and registration milestones apply.
                </div>
              ) : (
                deal.paymentMilestones.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs font-bold border border-slate-200">
                    <div>
                      <span className="text-slate-900 block">{m.name}</span>
                      <span className="text-[11px] text-slate-400">{m.date}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-900 block font-black">Rs. {Number(m.amount || 0).toLocaleString()}</span>
                      <span className={'text-[10px] font-black ' + (m.status === 'PAID' ? 'text-emerald-600' : 'text-amber-600')}>
                        {m.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AUDIT LOG TIMELINE */}
          <div className="space-y-2">
            <span className="text-xs font-black text-slate-900 block">Transaction Audit Trail</span>
            <div className="space-y-1.5">
              {(deal.timeline || []).map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="font-bold text-slate-800">{t.event}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block font-medium">{t.date}</span>
                    <span className="text-[10px] text-slate-500 font-semibold">{t.user}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {deal.customerPhone && (
              <button
                type="button"
                onClick={() => {
                  if (isFieldExecutive) {
                    alert('Field Broker Policy: Direct customer messaging is restricted to Senior Brokers. Contact Admin Desk to initiate customer handover.');
                    return;
                  }
                  onTriggerWhatsApp(deal.customerPhone, deal.customerName, deal.propertyTitle);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{isFieldExecutive ? 'Contact Desk' : 'WhatsApp Buyer'}</span>
              </button>
            )}

            {/* INLINE STAGE ADVANCER */}
            {onAdvanceStage && kanbanStages.length > 0 && (
              <div className="flex items-center gap-1.5">
                <select
                  disabled={deal.isPropertyQuarantined}
                  value={deal.stage}
                  onChange={(e) => onAdvanceStage(deal.id, e.target.value, 'Updated via Deal Dossier')}
                  className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-2.5 py-2 focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer disabled:opacity-50"
                  title={deal.isPropertyQuarantined ? 'Action frozen due to compliance quarantine' : 'Advance deal stage'}
                >
                  {kanbanStages.map(st => (
                    <option key={st} value={st}>{CrmStageLabels[st] || st}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={(e) => onDeleteDeal(e, deal.id, deal.customerName)}
              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Delete deal completely"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
}
