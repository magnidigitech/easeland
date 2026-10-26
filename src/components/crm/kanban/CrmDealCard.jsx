import React, { useState } from 'react';
import {
  MapPin,
  MessageSquare,
  ArrowRight,
  MoreVertical,
  ChevronDown,
  Trash2,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { CrmStageLabels, CrmDealStages } from '../../../firebase/crmService.js';

export default function CrmDealCard({
  deal,
  kanbanStages,
  onSelectDeal,
  onAdvanceStage,
  onDeleteDeal,
  onTriggerWhatsApp,
  isBeingDragged,
  onDragStart,
  onDragEnd,
  isFieldExecutive = false
}) {
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);

  return (
    <div
      draggable={!deal.isPropertyQuarantined}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onSelectDeal(deal)}
      className={
        'p-3.5 rounded-xl border transition-all duration-150 space-y-2.5 cursor-grab active:cursor-grabbing group shadow-xs hover:shadow-md hover:-translate-y-0.5 ' +
        (deal.isPropertyQuarantined
          ? 'bg-rose-50/40 border-rose-300 hover:border-rose-400'
          : isBeingDragged
            ? 'opacity-40 border-amber-400 border-2 border-dashed scale-95 bg-white'
            : 'bg-white border-slate-200 hover:border-amber-400'
        )
      }
    >
      {/* CARD TOP BAR */}
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
              <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1 space-y-0.5 text-xs animate-in fade-in duration-100">
                <span className="text-[10px] font-black uppercase text-slate-400 px-2 py-1 block">
                  Move to Stage:
                </span>
                {deal.isPropertyQuarantined ? (
                  <div className="p-2 text-[11px] text-rose-700 font-bold bg-rose-50 rounded-lg">
                    Stage advancement frozen. Property listing was quarantined by Compliance.
                  </div>
                ) : (
                  kanbanStages.map(st => (
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
                  ))
                )}
              </div>
            </>
          )}
        </div>
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
