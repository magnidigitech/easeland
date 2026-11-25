import React, { useState, useEffect } from 'react';
import {
  MapPin,
  MessageSquare,
  ArrowRight,
  MoreVertical,
  ChevronDown,
  Trash2,
  FileText,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  Layers,
  Sparkles,
  Tag
} from 'lucide-react';
import {
  CrmStageLabels,
  CrmDealStages,
  CRM_STAGE_METADATA,
  getStageDefaultFollowUp,
  getLocalDateIso,
  formatShortDate,
  formatLegalStatusLabel
} from '../../../firebase/crmService.js';

// Stage Visual Themes: distinctive high-contrast left borders and badges
const STAGE_ACCENTS = {
  [CrmDealStages.NEW]: {
    borderLeft: 'border-l-sky-500',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500'
  },
  [CrmDealStages.CONTACTED]: {
    borderLeft: 'border-l-indigo-500',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500'
  },
  [CrmDealStages.SITE_VISIT]: {
    borderLeft: 'border-l-amber-500',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500'
  },
  [CrmDealStages.DOCUMENT_AUDIT]: {
    borderLeft: 'border-l-purple-500',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500'
  },
  [CrmDealStages.PRICE_NEGOTIATION]: {
    borderLeft: 'border-l-orange-500',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500'
  },
  [CrmDealStages.TOKEN_ADVANCE]: {
    borderLeft: 'border-l-teal-500',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
    dot: 'bg-teal-500'
  },
  [CrmDealStages.REGISTRATION_PENDING]: {
    borderLeft: 'border-l-blue-600',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-600'
  },
  [CrmDealStages.CLOSED_WON]: {
    borderLeft: 'border-l-emerald-500',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500'
  },
  [CrmDealStages.CLOSED_LOST]: {
    borderLeft: 'border-l-slate-400',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400'
  }
};

export default function CrmDealCard({
  deal,
  kanbanStages,
  onSelectDeal,
  onAdvanceStage,
  onDeleteDeal,
  onTriggerWhatsApp,
  onOpenFollowUp,
  isBeingDragged,
  isSelected = false,
  onDragStart,
  onDragEnd,
  isFieldExecutive = false
}) {
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMoveMenuOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsMoveMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMoveMenuOpen]);

  const stageMeta = CRM_STAGE_METADATA[deal.stage] || CRM_STAGE_METADATA[CrmDealStages.NEW];
  const stageStyle = STAGE_ACCENTS[deal.stage] || STAGE_ACCENTS[CrmDealStages.NEW];
  const followUpGoal = deal.nextFollowUpAction || stageMeta.defaultAction;

  return (
    <div
      draggable={!deal.isPropertyQuarantined}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onSelectDeal(deal)}
      className={
        'p-3.5 rounded-xl border border-l-4 transition-all duration-150 space-y-2.5 cursor-grab active:cursor-grabbing group shadow-sm hover:shadow-md hover:-translate-y-0.5 ' +
        (deal.isPropertyQuarantined
          ? 'bg-rose-50/40 border-rose-300 hover:border-rose-400'
          : isBeingDragged
            ? 'opacity-40 border-amber-400 border-2 border-dashed scale-95 bg-white'
            : isSelected
              ? ('bg-amber-50/40 border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_18px_rgba(251,191,36,0.28)] ' + stageStyle.borderLeft)
              : ('bg-white border-slate-200 hover:border-slate-300 ' + stageStyle.borderLeft)
        )
      }
    >
      {/* CARD TOP BAR: BUYER NAME & STAGE MOVE MENU */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-slate-300 group-hover:text-amber-500 font-mono text-[10px] select-none cursor-grab" title="Drag to move deal">
            ⋮⋮
          </span>
          <span className="font-black text-xs text-slate-900 group-hover:text-amber-600 transition-colors truncate" title={deal.customerName}>
            {deal.customerName}
          </span>
        </div>

        {/* 1-TAP STAGE SELECTOR (MOBILE/TOUCH ACTION SHEET) */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setIsMoveMenuOpen(!isMoveMenuOpen)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Move deal stage"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {isMoveMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsMoveMenuOpen(false)}></div>
              <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1 space-y-0.5 text-xs animate-in fade-in duration-100">
                <span className="text-[10px] font-black uppercase text-slate-400 px-2 py-1 block">
                  Move to Stage:
                </span>
                {deal.isPropertyQuarantined ? (
                  <div className="p-2 text-[11px] text-rose-700 font-bold bg-rose-50 rounded-lg">
                    Stage locked. Property paused by Admin.
                  </div>
                ) : (
                  kanbanStages.map(st => {
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setIsMoveMenuOpen(false);
                          onAdvanceStage(deal.id, st, 'Moved via menu');
                        }}
                        className={'w-full text-left px-2.5 py-1.5 rounded-lg font-bold flex items-center justify-between transition-colors cursor-pointer ' +
                          (deal.stage === st ? 'bg-amber-100 text-amber-900 font-black' : 'text-slate-700 hover:bg-slate-100')
                        }
                      >
                        <span className="truncate">{CrmStageLabels[st] || st}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* STEP PROGRESS & ASSIGNED BROKER */}
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <span className={'px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide border ' + stageStyle.badge}>
          Step {stageMeta.step} of 8
        </span>
        <span className="text-[10px] font-bold text-slate-500 truncate max-w-[140px]">
          {deal.assignedAgent || 'EaseLand Desk'}
        </span>
      </div>

      {/* COMPLIANCE PAUSE BADGE */}
      {deal.isPropertyQuarantined && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-100 text-rose-800 rounded-lg text-[10px] font-black border border-rose-200">
          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
          <span className="truncate">Paused by Admin Compliance</span>
        </div>
      )}

      {/* PROPERTY TITLE & LOCATION */}
      <div className="space-y-0.5">
        <span className="text-xs font-black text-slate-800 line-clamp-1 group-hover:text-amber-600 transition-colors" title={deal.propertyTitle}>
          {deal.propertyTitle}
        </span>
        <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{deal.propertyLocation || 'Location pending'}</span>
        </div>
      </div>

      {/* CONTEXTUAL STAGE-SPECIFIC HIGHLIGHT */}
      {(() => {
        const stData = (deal.stageData && deal.stageData[deal.stage]) || {};

        if (deal.stage === CrmDealStages.PRICE_NEGOTIATION) {
          const negVal = stData.negotiatedPrice ? ('Rs. ' + (Number(stData.negotiatedPrice) / 100000).toFixed(1) + ' Lakhs') : deal.dealValueDisplay;
          return (
            <div className="p-2.5 rounded-xl bg-orange-50/80 border border-orange-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-orange-900 tracking-wide">Offered Price:</span>
                <span className="font-black text-orange-700 text-xs">{negVal}</span>
              </div>
              {stData.ratePerSqYd && (
                <div className="text-[11px] font-bold text-orange-800">
                  {'Rs. ' + Number(stData.ratePerSqYd).toLocaleString('en-IN') + ' / sq.yd'}
                </div>
              )}
              {stData.negotiationTerms && (
                <p className="text-[10px] font-medium text-orange-950 line-clamp-1 italic">
                  {'"' + stData.negotiationTerms + '"'}
                </p>
              )}
            </div>
          );
        }

        if (deal.stage === CrmDealStages.TOKEN_ADVANCE) {
          const tokAmt = stData.tokenAmount ? ('Rs. ' + Number(stData.tokenAmount).toLocaleString('en-IN')) : 'Paid';
          const balDue = stData.balanceDue ? ('Rs. ' + Number(stData.balanceDue).toLocaleString('en-IN')) : null;
          return (
            <div className="p-2.5 rounded-xl bg-teal-50/80 border border-teal-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-teal-900 tracking-wide">Advance Paid:</span>
                <span className="font-black text-teal-700 text-xs">{tokAmt}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-teal-800">
                <span>{stData.paymentMode || 'Bank Transfer'}</span>
                {stData.paymentRef && <span className="font-mono">#{stData.paymentRef}</span>}
              </div>
              {balDue && (
                <div className="text-[10px] font-extrabold text-slate-600 pt-0.5 border-t border-teal-200/60">
                  {'Balance Left: ' + balDue}
                </div>
              )}
            </div>
          );
        }

        if (deal.stage === CrmDealStages.SITE_VISIT) {
          return (
            <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-amber-900 tracking-wide">Visit Booked:</span>
                <span className="font-black text-amber-800 text-xs">
                  {stData.visitDate ? (formatShortDate(stData.visitDate) + (stData.visitTime ? ' · ' + stData.visitTime : '')) : 'Date Pending'}
                </span>
              </div>
              {stData.meetingPoint && (
                <div className="text-[10px] font-bold text-slate-700 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                  <span className="truncate">{stData.meetingPoint}</span>
                </div>
              )}
            </div>
          );
        }

        if (deal.stage === CrmDealStages.DOCUMENT_AUDIT) {
          return (
            <div className="p-2.5 rounded-xl bg-purple-50/80 border border-purple-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-purple-900 tracking-wide">Legal Status:</span>
                <span className="font-black text-purple-700 text-[10px]">
                  {formatLegalStatusLabel(stData.legalStatus || 'CLEAR_TITLE')}
                </span>
              </div>
              {stData.ecPeriod && (
                <div className="text-[10px] font-bold text-purple-800 truncate">
                  {'EC Checked: ' + stData.ecPeriod}
                </div>
              )}
            </div>
          );
        }

        if (deal.stage === CrmDealStages.REGISTRATION_PENDING) {
          return (
            <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-blue-900 tracking-wide">Reg. Slot:</span>
                <span className="font-black text-blue-800 text-xs">
                  {stData.slotDate ? (formatShortDate(stData.slotDate) + (stData.slotTime ? ' · ' + stData.slotTime : '')) : 'Slot Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
                <span className="truncate">{stData.sroOffice || 'Sub-Registrar Office'}</span>
                {stData.challanNumber && <span className="font-mono text-blue-700 truncate max-w-[100px]">#{stData.challanNumber}</span>}
              </div>
            </div>
          );
        }

        return null;
      })()}

      {/* FOLLOW-UP NEXT STEP */}
      {deal.stage !== CrmDealStages.CLOSED_WON && deal.stage !== CrmDealStages.CLOSED_LOST ? (
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          {(() => {
            const todayIso = getLocalDateIso();
            const hasFollowUp = Boolean(deal.nextFollowUpDate);
            const isOverdue = hasFollowUp && deal.nextFollowUpDate < todayIso;
            const isDueToday = hasFollowUp && deal.nextFollowUpDate === todayIso;
            const shortDate = hasFollowUp ? formatShortDate(deal.nextFollowUpDate) : '';

            return (
              <div
                onClick={() => onOpenFollowUp && onOpenFollowUp(deal)}
                className={'p-2.5 rounded-xl border text-xs transition-all cursor-pointer ' +
                  (isOverdue
                    ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/70'
                    : isDueToday
                      ? 'bg-amber-50/80 border-amber-300 hover:bg-amber-100/80'
                      : hasFollowUp
                        ? 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                        : 'bg-slate-50 border-dashed border-slate-300 hover:border-amber-400'
                  )
                }
                title="Click to update follow-up or log a call"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-start gap-1.5 min-w-0 flex-1">
                    <Clock className={'w-3.5 h-3.5 mt-0.5 shrink-0 ' + (isOverdue ? 'text-rose-600' : isDueToday ? 'text-amber-600' : hasFollowUp ? 'text-emerald-600' : 'text-slate-400')} />
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        Next Step
                      </span>
                      <p className="text-[11px] font-bold text-slate-800 leading-snug line-clamp-2" title={followUpGoal}>
                        {followUpGoal}
                      </p>
                    </div>
                  </div>
                  <span className={'px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 whitespace-nowrap ' +
                    (isOverdue
                      ? 'bg-rose-100 text-rose-800'
                      : isDueToday
                        ? 'bg-amber-100 text-amber-900 animate-pulse'
                        : hasFollowUp
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-white border border-slate-200 text-slate-500'
                    )
                  }>
                    {isOverdue
                      ? 'Overdue · ' + shortDate
                      : isDueToday
                        ? 'Today'
                        : hasFollowUp
                          ? shortDate
                          : '+ Set Date'}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      ) : deal.stage === CrmDealStages.CLOSED_WON ? (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-black text-[11px]">Registered &amp; Closed</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-700">Done</span>
        </div>
      ) : null}

      {/* FINANCIAL BADGES */}
      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
        <div>
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Deal Value</span>
          <span className="font-black text-emerald-600">
            {Number(deal.dealValue) > 0
              ? (deal.dealValueDisplay || ('Rs. ' + (Number(deal.dealValue) / 100000).toFixed(1) + ' Lakhs'))
              : (deal.dealValueDisplay || 'Price Pending')}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Brokerage</span>
          <span className="font-extrabold text-amber-600">
            {Number(deal.expectedCommission) > 0 ? ('Rs. ' + Number(deal.expectedCommission).toLocaleString('en-IN')) : 'TBD'}
          </span>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
          {deal.probability}% Chance
        </span>

        <div className="flex items-center gap-1.5">
          {deal.customerPhone && (
            <button
              type="button"
              onClick={() => onTriggerWhatsApp(deal.customerPhone, deal.customerName, deal.propertyTitle)}
              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
              title={isFieldExecutive ? 'Contact restricted by field policy' : 'Chat with buyer on WhatsApp'}
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => onDeleteDeal(e, deal.id, deal.customerName)}
            className="p-1.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
            title="Delete deal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
}

