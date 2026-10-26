import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  PlusCircle,
  Layers,
  ChevronDown,
  Check,
  Briefcase,
  Table
} from 'lucide-react';
import { CrmStageLabels, CrmDealStages } from '../../../firebase/crmService.js';
import CrmDealCard from './CrmDealCard.jsx';

export default function CrmKanbanBoard({
  deals,
  searchQuery,
  setSearchQuery,
  kanbanStages,
  onSelectDeal,
  onAdvanceStage,
  onDeleteDeal,
  onTriggerWhatsApp,
  onOpenNewDeal,
  isFieldExecutive = false
}) {
  const [selectedStageFilters, setSelectedStageFilters] = useState([]);
  const [isStageDropdownOpen, setIsStageDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'ledger'
  const [draggedDealId, setDraggedDealId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  // Stage Multi-Select Toggle Handler
  const handleToggleStageFilter = (stKey) => {
    if (selectedStageFilters.length === 0) {
      setSelectedStageFilters(kanbanStages.filter(k => k !== stKey));
    } else if (selectedStageFilters.includes('NONE')) {
      setSelectedStageFilters([stKey]);
    } else if (selectedStageFilters.includes(stKey)) {
      const updated = selectedStageFilters.filter(k => k !== stKey);
      setSelectedStageFilters(updated.length === 0 ? ['NONE'] : updated);
    } else {
      const updated = [...selectedStageFilters.filter(k => k !== 'NONE'), stKey];
      if (updated.length >= kanbanStages.length) {
        setSelectedStageFilters([]);
      } else {
        setSelectedStageFilters(updated);
      }
    }
  };

  const handleSelectAllStages = () => {
    if (selectedStageFilters.length === 0 || (selectedStageFilters.length === kanbanStages.length && !selectedStageFilters.includes('NONE'))) {
      setSelectedStageFilters(['NONE']);
    } else {
      setSelectedStageFilters([]);
    }
  };

  const getStageFilterLabel = () => {
    if (selectedStageFilters.includes('NONE')) {
      return 'No Stages Selected (0)';
    }
    if (selectedStageFilters.length === 0 || selectedStageFilters.length === kanbanStages.length) {
      return 'All Stages (' + deals.length + ')';
    }
    if (selectedStageFilters.length === 1) {
      return CrmStageLabels[selectedStageFilters[0]] || selectedStageFilters[0];
    }
    return selectedStageFilters.length + ' Stages Selected';
  };

  const visibleStages = useMemo(() => {
    return kanbanStages.filter(st =>
      selectedStageFilters.length === 0 ||
      selectedStageFilters.length === kanbanStages.length ||
      selectedStageFilters.includes(st)
    );
  }, [kanbanStages, selectedStageFilters]);

  return (
    <div className="space-y-4">

      {/* FILTER & CONTROL BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 flex-wrap">

          {/* SEARCH INPUT */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by buyer, property or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          </div>

          {/* MULTI-SELECT STAGE FILTER */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsStageDropdownOpen(!isStageDropdownOpen)}
              className="bg-slate-50 border border-slate-300 hover:border-amber-400 hover:bg-white text-slate-800 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center justify-between gap-2 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-amber-500" />
                <span>{getStageFilterLabel()}</span>
              </div>
              <ChevronDown className={'w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ' + (isStageDropdownOpen ? 'rotate-180 text-amber-600' : '')} />
            </button>

            {isStageDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsStageDropdownOpen(false)}></div>
                <div className="absolute left-0 sm:right-0 mt-1.5 w-72 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150 select-none">

                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={handleSelectAllStages}
                      className="flex items-center gap-2 text-xs font-black text-slate-800 hover:text-amber-600 transition-colors cursor-pointer"
                    >
                      <div className={'w-4 h-4 rounded-md border flex items-center justify-center transition-all ' +
                        ((selectedStageFilters.length === 0 || selectedStageFilters.length === kanbanStages.length) && !selectedStageFilters.includes('NONE')
                          ? 'bg-amber-500 border-amber-500 text-slate-950'
                          : 'border-slate-300 bg-white'
                        )
                      }>
                        {((selectedStageFilters.length === 0 || selectedStageFilters.length === kanbanStages.length) && !selectedStageFilters.includes('NONE')) && (
                          <Check className="w-3 h-3 stroke-[3]" />
                        )}
                      </div>
                      <span>Select All Stages</span>
                    </button>
                    <span className="text-[10px] font-black text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                      {deals.length} Total
                    </span>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
                    {kanbanStages.map((st) => {
                      const count = deals.filter(d => d.stage === st).length;
                      const isChecked = !selectedStageFilters.includes('NONE') &&
                        (selectedStageFilters.length === 0 ||
                          selectedStageFilters.length === kanbanStages.length ||
                          selectedStageFilters.includes(st));
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleToggleStageFilter(st)}
                          className={'w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer group ' +
                            (isChecked ? 'bg-amber-50/80 text-slate-900 font-extrabold' : 'text-slate-600 hover:bg-slate-100')
                          }
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={'w-4 h-4 rounded-md border flex items-center justify-center transition-all ' +
                              (isChecked
                                ? 'bg-amber-400 border-amber-400 text-slate-950 shadow-xs'
                                : 'border-slate-300 bg-white group-hover:border-amber-400'
                              )
                            }>
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className="truncate">{CrmStageLabels[st] || st}</span>
                          </div>
                          <span className={'text-[10px] px-2 py-0.5 rounded-full font-extrabold ' +
                            (isChecked ? 'bg-amber-200/70 text-amber-900' : 'bg-slate-100 text-slate-400')
                          }>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs px-1">
                    <button
                      type="button"
                      onClick={() => setSelectedStageFilters([])}
                      className="text-[11px] font-bold text-amber-600 hover:underline cursor-pointer"
                    >
                      Reset Selection
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsStageDropdownOpen(false)}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] rounded-lg transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>

                </div>
              </>
            )}
          </div>

        </div>

        {/* VIEW MODE TOGGLE & NEW DEAL BUTTON */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={'px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ' +
                (viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')
              }
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ledger')}
              className={'px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ' +
                (viewMode === 'ledger' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')
              }
            >
              <Table className="w-3.5 h-3.5" />
              <span>Ledger Table</span>
            </button>
          </div>

          <button
            onClick={onOpenNewDeal}
            className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span>New Deal</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: HORIZONTALLY SCROLLABLE KANBAN LANES */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-6 items-stretch min-h-[calc(100dvh-320px)] custom-scrollbar">
          {visibleStages.map((stage) => {
            const stageDeals = deals.filter(d => d.stage === stage);
            const stageTotal = stageDeals.reduce((sum, d) => sum + (Number(d.dealValue) || 0), 0);
            const stageFormattedTotal = stageTotal >= 10000000
              ? 'Rs. ' + (stageTotal / 10000000).toFixed(2) + ' Cr'
              : 'Rs. ' + (stageTotal / 100000).toFixed(1) + ' Lakhs';
            const isDropTarget = dragOverStage === stage;

            return (
              <div
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverStage !== stage) setDragOverStage(stage);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget)) return;
                  setDragOverStage(null);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  const dealId = draggedDealId || e.dataTransfer.getData('text/plain');
                  setDragOverStage(null);
                  setDraggedDealId(null);
                  if (dealId) {
                    await onAdvanceStage(dealId, stage, 'Moved via Drag & Drop');
                  }
                }}
                className={
                  'w-80 shrink-0 min-h-[550px] rounded-2xl border-2 flex flex-col justify-between transition-all duration-200 shadow-xs ' +
                  (isDropTarget
                    ? 'bg-amber-100/90 border-amber-400 border-dashed ring-4 ring-amber-400/30 scale-[1.01] shadow-xl'
                    : 'bg-slate-100/80 border-slate-200/90 hover:border-slate-300'
                  )
                }
              >
                {/* LANE HEADER */}
                <div className="p-3 border-b border-slate-200/80 bg-white/70 backdrop-blur-xs rounded-t-2xl flex items-center justify-between gap-2 shrink-0">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-black text-slate-900 block truncate" title={CrmStageLabels[stage] || stage}>
                      {CrmStageLabels[stage] || stage}
                    </span>
                    <span className="text-[10px] font-extrabold text-amber-700 block truncate">
                      {stageFormattedTotal} • {stageDeals.length} Deal{stageDeals.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-black text-[10px] flex items-center justify-center border border-slate-800 shrink-0 shadow-xs">
                    {stageDeals.length}
                  </span>
                </div>

                {/* DROP BADGE INDICATOR */}
                {isDropTarget && (
                  <div className="mx-3 mt-2 py-2 bg-amber-400/20 border border-amber-400/60 rounded-xl text-center text-amber-900 text-xs font-black animate-pulse">
                    Drop Deal Here to Move
                  </div>
                )}

                {/* DEAL CARDS CONTAINER */}
                <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100dvh-380px)] custom-scrollbar">
                  {stageDeals.length === 0 ? (
                    <div className={'text-center rounded-2xl my-2 p-6 flex flex-col items-center justify-center gap-2 border-2 border-dashed transition-all ' +
                      (isDropTarget
                        ? 'border-amber-400 bg-amber-50/60 text-amber-900 ring-2 ring-amber-400/20'
                        : 'border-slate-300/70 bg-white/40 text-slate-400 hover:border-slate-400'
                      )
                    }>
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-600">Stage Empty</span>
                      <p className="text-[10px] text-slate-400 font-medium">Drag deals here or initiate a transaction</p>
                      <button
                        type="button"
                        onClick={onOpenNewDeal}
                        className="mt-1 px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-black rounded-lg transition-colors cursor-pointer shadow-xs"
                      >
                        + New Deal
                      </button>
                    </div>
                  ) : (
                    stageDeals.map((deal) => (
                      <CrmDealCard
                        key={deal.id}
                        deal={deal}
                        kanbanStages={kanbanStages}
                        onSelectDeal={onSelectDeal}
                        onAdvanceStage={onAdvanceStage}
                        onDeleteDeal={onDeleteDeal}
                        onTriggerWhatsApp={onTriggerWhatsApp}
                        isBeingDragged={draggedDealId === deal.id}
                        isFieldExecutive={isFieldExecutive}
                        onDragStart={(e) => {
                          setDraggedDealId(deal.id);
                          e.dataTransfer.setData('text/plain', deal.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggedDealId(null);
                          setDragOverStage(null);
                        }}
                      />
                    ))
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: AUTHORITATIVE LEDGER TABLE VIEW */}
      {viewMode === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="px-4 py-3">Deal ID</th>
                  <th className="px-4 py-3">Buyer Name</th>
                  <th className="px-4 py-3">Property Parcel</th>
                  <th className="px-4 py-3">Current Stage</th>
                  <th className="px-4 py-3 text-right">Agreed Value</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3 text-center">Probability</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      No deals found matching the search and stage criteria.
                    </td>
                  </tr>
                ) : (
                  deals.map((deal) => (
                    <tr
                      key={deal.id}
                      onClick={() => onSelectDeal(deal)}
                      className={'hover:bg-amber-50/50 cursor-pointer transition-colors ' + (deal.isPropertyQuarantined ? 'bg-rose-50/30' : '')}
                    >
                      <td className="px-4 py-3 font-mono text-[11px] text-amber-600 font-black">{deal.id}</td>
                      <td className="px-4 py-3 font-black text-slate-900">{deal.customerName}</td>
                      <td className="px-4 py-3 text-slate-800 max-w-xs truncate">
                        <span>{deal.propertyTitle}</span>
                        {deal.isPropertyQuarantined && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-800 text-[9px] font-black uppercase">
                            Quarantined
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-200">
                          {CrmStageLabels[deal.stage] || deal.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-emerald-600">{deal.dealValueDisplay || ('Rs. ' + ((Number(deal.dealValue) || 0) / 100000).toFixed(1) + ' Lakhs')}</td>
                      <td className="px-4 py-3 text-right text-amber-600 font-extrabold">Rs. {Number(deal.expectedCommission || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-600">
                          {deal.probability}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{deal.assignedAgent}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => onDeleteDeal(e, deal.id, deal.customerName)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Delete deal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
