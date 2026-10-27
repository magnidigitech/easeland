import React, { useState } from 'react';
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
  getStageDefaultFollowUp
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
  onDragStart,
  onDragEnd,
  isFieldExecutive = false
}) {
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);

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
        'p-3.5 rounded-xl border border-l-4 transition-all duration-150 space-y-2.5 cursor-grab active:cursor-grabbing group shadow-xs hover:shadow-md hover:-translate-y-0.5 ' +
        (deal.isPropertyQuarantined
          ? 'bg-rose-50/40 border-rose-300 hover:border-rose-400'
          : isBeingDragged
            ? 'opacity-40 border-amber-400 border-2 border-dashed scale-95 bg-white'
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
                  Advance to Stage:
                </span>
                {deal.isPropertyQuarantined ? (
                  <div className="p-2 text-[11px] text-rose-700 font-bold bg-rose-50 rounded-lg">
                    Stage advancement frozen. Property listing was quarantined by Compliance.
                  </div>
                ) : (
                  kanbanStages.map(st => {
                    const stMeta = CRM_STAGE_METADATA[st] || {};
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
                        {stMeta.milestone && (
                          <span className="text-[9px] font-extrabold text-slate-400 ml-1 truncate">
                            {stMeta.milestone}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* STAGE MILESTONE BADGE & BROKER IDENTIFIER */}
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <span className={'px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide border uppercase ' + stageStyle.badge}>
          {stageMeta.milestone} • Step {stageMeta.step}/8
        </span>
        <span className="text-[10px] font-bold text-slate-400 truncate max-w-[120px]">
          {deal.assignedAgent || 'EaseLand Desk'}
        </span>
      </div>

      {/* COMPLIANCE QUARANTINE BADGE */}
      {deal.isPropertyQuarantined && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-100 text-rose-800 rounded-lg text-[10px] font-black border border-rose-200">
          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
          <span className="truncate">PROPERTY QUARANTINED BY ADMIN</span>
        </div>
      )}

      {/* PROPERTY TITLE & LOCATION */}
      <div className="space-y-0.5">
        <span className="text-xs font-black text-slate-800 line-clamp-1 group-hover:text-amber-600 transition-colors" title={deal.propertyTitle}>
          {deal.propertyTitle}
        </span>
        <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{deal.propertyLocation || 'Verified Location'}</span>
        </div>
      </div>

      {/* STAGE-SPECIFIC FOLLOW-UP ACTION & TIMING */}
      {deal.stage !== CrmDealStages.CLOSED_WON && deal.stage !== CrmDealStages.CLOSED_LOST ? (
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          {(() => {
            const todayIso = new Date().toISOString().split('T')[0];
            const hasFollowUp = Boolean(deal.nextFollowUpDate);
            const isOverdue = hasFollowUp && deal.nextFollowUpDate < todayIso;
            const isDueToday = hasFollowUp && deal.nextFollowUpDate === todayIso;

            return (
              <div
                onClick={() => onOpenFollowUp && onOpenFollowUp(deal)}
                className={'p-2 rounded-xl border text-xs space-y-1.5 transition-all cursor-pointer ' +
                  (isOverdue
                    ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/70'
                    : isDueToday
                      ? 'bg-amber-50/80 border-amber-300 hover:bg-amber-100/80'
                      : hasFollowUp
                        ? 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                        : 'bg-slate-50 border-dashed border-slate-300 hover:border-amber-400'
                  )
                }
                title="Click to reschedule or log activity"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex items-start gap-1.5 min-w-0 flex-1">
                    <Clock className={'w-3.5 h-3.5 mt-0.5 shrink-0 ' + (isOverdue ? 'text-rose-600' : isDueToday ? 'text-amber-600' : hasFollowUp ? 'text-emerald-600' : 'text-slate-400')} />
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        Stage Action:
                      </span>
                      <p className="text-[11px] font-black text-slate-900 leading-snug line-clamp-2" title={followUpGoal}>
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
                      ? 'Overdue (' + deal.nextFollowUpDate + ')'
                      : isDueToday
                        ? 'Due Today'
                        : hasFollowUp
                          ? deal.nextFollowUpDate
                          : '+ Schedule'}
                  </span>
                </div>

                {/* Stage-Specific Micro-Checklists */}
                {stageMeta.checklist && stageMeta.checklist.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    {stageMeta.checklist.slice(0, 3).map((chk, idx) => (
                      <span key={idx} className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200/80 truncate max-w-[130px]">
                        ✓ {chk}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : deal.stage === CrmDealStages.CLOSED_WON ? (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-black text-[11px]">Sale Deed Executed • Won</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-700">100%</span>
        </div>
      ) : null}

      {/* FINANCIAL BADGES */}
      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
        <div>
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Agreed Deal Value</span>
          <span className="font-black text-emerald-600">{deal.dealValueDisplay || ('Rs. ' + ((Number(deal.dealValue) || 0) / 100000).toFixed(1) + ' Lakhs')}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Commission</span>
          <span className="font-extrabold text-amber-600">Rs. {Number(deal.expectedCommission || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
          {deal.probability}% Win Prob
        </span>

        <div className="flex items-center gap-1.5">
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

