import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  PlusCircle,
  Layers,
  ChevronDown,
  Check,
  Briefcase,
  Table,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Clock
} from 'lucide-react';
import { CrmStageLabels, CrmDealStages } from '../../../firebase/crmService.js';
import CrmDealCard from './CrmDealCard.jsx';

// Stage Themes with distinctive, high-contrast visual identities
const STAGE_CONFIG = {
  [CrmDealStages.NEW]: {
    accent: 'bg-sky-500',
    border: 'border-sky-300',
    headerBg: 'bg-sky-50/70',
    text: 'text-sky-700',
    dot: 'bg-sky-500',
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    step: 1,
    tagline: 'Initial buyer inquiries'
  },
  [CrmDealStages.CONTACTED]: {
    accent: 'bg-indigo-500',
    border: 'border-indigo-300',
    headerBg: 'bg-indigo-50/70',
    text: 'text-indigo-700',
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    step: 2,
    tagline: 'Discovery & qualifications'
  },
  [CrmDealStages.SITE_VISIT]: {
    accent: 'bg-amber-500',
    border: 'border-amber-300',
    headerBg: 'bg-amber-50/70',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    step: 3,
    tagline: 'Physical plot inspections'
  },
  [CrmDealStages.DOCUMENT_AUDIT]: {
    accent: 'bg-purple-500',
    border: 'border-purple-300',
    headerBg: 'bg-purple-50/70',
    text: 'text-purple-700',
    dot: 'bg-purple-500',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    step: 4,
    tagline: 'Legal & title clearance'
  },
  [CrmDealStages.PRICE_NEGOTIATION]: {
    accent: 'bg-orange-500',
    border: 'border-orange-300',
    headerBg: 'bg-orange-50/70',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
    badge: 'bg-orange-100 text-orange-800 border-orange-200',
    step: 5,
    tagline: 'Price & terms structuring'
  },
  [CrmDealStages.TOKEN_ADVANCE]: {
    accent: 'bg-teal-500',
    border: 'border-teal-300',
    headerBg: 'bg-teal-50/70',
    text: 'text-teal-700',
    dot: 'bg-teal-500',
    badge: 'bg-teal-100 text-teal-800 border-teal-200',
    step: 6,
    tagline: 'Advance committed'
  },
  [CrmDealStages.REGISTRATION_PENDING]: {
    accent: 'bg-blue-600',
    border: 'border-blue-300',
    headerBg: 'bg-blue-50/70',
    text: 'text-blue-700',
    dot: 'bg-blue-600',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    step: 7,
    tagline: 'Sub-registrar filing'
  },
  [CrmDealStages.CLOSED_WON]: {
    accent: 'bg-emerald-500',
    border: 'border-emerald-300',
    headerBg: 'bg-emerald-50/70',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    step: 8,
    tagline: 'Executed & registered'
  },
  [CrmDealStages.CLOSED_LOST]: {
    accent: 'bg-rose-500',
    border: 'border-rose-300',
    headerBg: 'bg-rose-50/70',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    step: 9,
    tagline: 'Dropped / Cancelled'
  }
};

const DEFAULT_STAGE_CONFIG = {
  accent: 'bg-slate-500',
  border: 'border-slate-300',
  headerBg: 'bg-slate-50',
  text: 'text-slate-700',
  dot: 'bg-slate-500',
  badge: 'bg-slate-100 text-slate-800 border-slate-200',
  step: 1,
  tagline: 'Pipeline stage'
};

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
  onOpenFollowUp,
  isFieldExecutive = false
}) {
  const [selectedStageFilters, setSelectedStageFilters] = useState([]);
  const [isStageDropdownOpen, setIsStageDropdownOpen] = useState(false);
  const [onlyDueToday, setOnlyDueToday] = useState(false);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'ledger'
  const [draggedDealId, setDraggedDealId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  const dueTodayCount = useMemo(() => {
    return deals.filter(d =>
      d.stage !== CrmDealStages.CLOSED_WON &&
      d.stage !== CrmDealStages.CLOSED_LOST &&
      d.nextFollowUpDate &&
      d.nextFollowUpDate <= todayIso
    ).length;
  }, [deals, todayIso]);

  const displayedDeals = useMemo(() => {
    if (!onlyDueToday) return deals;
    return deals.filter(d =>
      d.stage !== CrmDealStages.CLOSED_WON &&
      d.stage !== CrmDealStages.CLOSED_LOST &&
      d.nextFollowUpDate &&
      d.nextFollowUpDate <= todayIso
    );
  }, [deals, onlyDueToday, todayIso]);

  // Scroll Container Ref & Nav State
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeStageIndex, setActiveStageIndex] = useState(0);

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

  // Check Scroll Bounds
  const checkScrollBounds = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atStart = el.scrollLeft <= 8;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
    setCanScrollLeft(!atStart);
    setCanScrollRight(!atEnd);

    // Compute which stage is centered or at start
    const columnWidth = 336; // 320px column + 16px gap
    const idx = Math.min(
      visibleStages.length - 1,
      Math.max(0, Math.round(el.scrollLeft / columnWidth))
    );
    setActiveStageIndex(idx);
  }, [visibleStages.length]);

  useEffect(() => {
    checkScrollBounds();
    const handleResize = () => checkScrollBounds();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkScrollBounds, visibleStages]);

  // Smooth Scroll Step (Arrows)
  const scrollByStep = (direction) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const columnWidth = 336;
    const scrollAmount = direction === 'left' ? -columnWidth * 1.5 : columnWidth * 1.5;
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  // Jump directly to a stage
  const scrollToStageIndex = (index) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const targetChild = el.children[index];
    if (targetChild && typeof targetChild.scrollIntoView === 'function') {
      targetChild.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    } else {
      el.scrollTo({ left: index * 336, behavior: 'smooth' });
    }
    setActiveStageIndex(index);
  };

  return (
    <div className="space-y-3.5 select-none">

      {/* 1. FILTER & CONTROL BAR */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 flex-wrap">

          {/* SEARCH INPUT */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by buyer, property or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none transition-all"
            />
          </div>

          {/* MULTI-SELECT STAGE FILTER */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsStageDropdownOpen(!isStageDropdownOpen)}
              className="bg-slate-50 border border-slate-300 hover:border-amber-400 hover:bg-white text-slate-800 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-2xs flex items-center justify-between gap-2 transition-all cursor-pointer"
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
                      const cfg = STAGE_CONFIG[st] || DEFAULT_STAGE_CONFIG;
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
                            <span className={'w-2 h-2 rounded-full ' + cfg.dot}></span>
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

          {/* QUICK TOGGLE: DUE TODAY / OVERDUE */}
          <button
            type="button"
            onClick={() => setOnlyDueToday(!onlyDueToday)}
            className={'px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ' +
              (onlyDueToday
                ? 'bg-amber-400 border-amber-400 text-slate-950 shadow-xs'
                : 'bg-slate-50 border-slate-300 text-slate-700 hover:border-amber-400 hover:bg-white'
              )
            }
            title={onlyDueToday ? 'Show all pipeline deals' : 'Filter deals with follow-ups due today or overdue'}
          >
            <Clock className={'w-3.5 h-3.5 ' + (onlyDueToday ? 'text-slate-950' : 'text-amber-500')} />
            <span>Due Today</span>
            {dueTodayCount > 0 && (
              <span className={'px-1.5 py-0.2 rounded-full text-[10px] font-black ' +
                (onlyDueToday ? 'bg-slate-950 text-amber-400' : 'bg-amber-100 text-amber-900')
              }>
                {dueTodayCount}
              </span>
            )}
          </button>

        </div>

        {/* VIEW MODE TOGGLE, STAGE ARROWS & NEW DEAL BUTTON */}
        <div className="flex items-center gap-2">
          {/* Quick Arrow Nav Controls in Header */}
          {viewMode === 'kanban' && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/90 gap-1">
              <button
                type="button"
                onClick={() => scrollByStep('left')}
                disabled={!canScrollLeft}
                className={'p-1.5 rounded-lg transition-all ' +
                  (canScrollLeft
                    ? 'text-slate-800 hover:bg-white hover:text-amber-600 shadow-2xs cursor-pointer active:scale-95'
                    : 'text-slate-300 cursor-not-allowed opacity-50'
                  )
                }
                title="Scroll stages left"
                aria-label="Scroll stages left"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
              </button>
              <span className="text-[10px] font-extrabold text-slate-600 px-1 whitespace-nowrap">
                Stage {activeStageIndex + 1} of {visibleStages.length}
              </span>
              <button
                type="button"
                onClick={() => scrollByStep('right')}
                disabled={!canScrollRight}
                className={'p-1.5 rounded-lg transition-all ' +
                  (canScrollRight
                    ? 'text-slate-800 hover:bg-white hover:text-amber-600 shadow-2xs cursor-pointer active:scale-95'
                    : 'text-slate-300 cursor-not-allowed opacity-50'
                  )
                }
                title="Scroll stages right"
                aria-label="Scroll stages right"
              >
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          )}

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={'px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ' +
                (viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800')
              }
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ledger')}
              className={'px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ' +
                (viewMode === 'ledger' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800')
              }
            >
              <Table className="w-3.5 h-3.5" />
              <span>Ledger Table</span>
            </button>
          </div>

          <button
            onClick={onOpenNewDeal}
            className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span>New Deal</span>
          </button>
        </div>
      </div>

      {/* 2. STAGE RIBBON / QUICK-JUMP TRACKER (KANBAN VIEW) */}
      {viewMode === 'kanban' && (
        <div className="bg-white/80 backdrop-blur-xs p-2 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-1 text-[11px] font-black text-slate-500 uppercase tracking-wider px-2 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Stages:</span>
          </div>

          {visibleStages.map((st, idx) => {
            const count = deals.filter(d => d.stage === st).length;
            const cfg = STAGE_CONFIG[st] || DEFAULT_STAGE_CONFIG;
            const isCurrentInView = activeStageIndex === idx;

            return (
              <button
                key={st}
                type="button"
                onClick={() => scrollToStageIndex(idx)}
                className={'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ' +
                  (isCurrentInView
                    ? 'bg-slate-950 text-white shadow-xs scale-102 ring-2 ring-amber-400/40'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                  )
                }
                title={'Jump to ' + (CrmStageLabels[st] || st)}
              >
                <span className={'w-1.5 h-1.5 rounded-full ' + (isCurrentInView ? 'bg-amber-400' : cfg.dot)}></span>
                <span className="font-mono text-[10px] opacity-60">0{idx + 1}</span>
                <span className="truncate max-w-[140px]">{CrmStageLabels[st] || st}</span>
                <span className={'text-[10px] px-1.5 py-0.2 rounded-full font-black ' +
                  (isCurrentInView
                    ? 'bg-amber-400 text-slate-950'
                    : count > 0 ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-400'
                  )
                }>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 3. HORIZONTALLY SCROLLABLE KANBAN LANES WITH END ARROWS */}
      {viewMode === 'kanban' && (
        <div className="relative group/kanban">

          {/* LEFT FLOATING SCROLL ARROW */}
          <button
            type="button"
            onClick={() => scrollByStep('left')}
            disabled={!canScrollLeft}
            aria-label="Scroll left to previous stages"
            className={'absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shadow-xl border ' +
              (canScrollLeft
                ? 'bg-white/95 backdrop-blur-md text-slate-800 border-slate-300 hover:bg-amber-400 hover:text-slate-950 hover:border-amber-400 hover:scale-110 active:scale-95 opacity-90 group-hover/kanban:opacity-100'
                : 'opacity-0 pointer-events-none'
              )
            }
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* RIGHT FLOATING SCROLL ARROW */}
          <button
            type="button"
            onClick={() => scrollByStep('right')}
            disabled={!canScrollRight}
            aria-label="Scroll right to next stages"
            className={'absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shadow-xl border ' +
              (canScrollRight
                ? 'bg-white/95 backdrop-blur-md text-slate-800 border-slate-300 hover:bg-amber-400 hover:text-slate-950 hover:border-amber-400 hover:scale-110 active:scale-95 opacity-90 group-hover/kanban:opacity-100'
                : 'opacity-0 pointer-events-none'
              )
            }
          >
            <ChevronRight className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* LEFT EDGE GRADIENT INDICATOR */}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-6 w-8 bg-gradient-to-r from-slate-100/90 to-transparent pointer-events-none z-10 rounded-l-2xl"></div>
          )}

          {/* RIGHT EDGE GRADIENT INDICATOR */}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-6 w-8 bg-gradient-to-l from-slate-100/90 to-transparent pointer-events-none z-10 rounded-r-2xl"></div>
          )}

          {/* KANBAN SCROLL TRACK */}
          <div
            ref={scrollContainerRef}
            onScroll={checkScrollBounds}
            className="flex gap-4 overflow-x-auto pb-6 items-stretch min-h-[calc(100dvh-340px)] custom-scrollbar scroll-smooth px-1"
          >
            {visibleStages.map((stage, sIdx) => {
              const stageDeals = displayedDeals.filter(d => d.stage === stage);
              const stageTotal = stageDeals.reduce((sum, d) => sum + (Number(d.dealValue) || 0), 0);
              const stageFormattedTotal = stageTotal >= 10000000
                ? 'Rs. ' + (stageTotal / 10000000).toFixed(2) + ' Cr'
                : 'Rs. ' + (stageTotal / 100000).toFixed(1) + ' Lakhs';
              const isDropTarget = dragOverStage === stage;
              const cfg = STAGE_CONFIG[stage] || DEFAULT_STAGE_CONFIG;

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
                    'w-80 shrink-0 min-h-[520px] rounded-2xl border-2 flex flex-col justify-between transition-all duration-200 shadow-xs relative overflow-hidden ' +
                    (isDropTarget
                      ? 'bg-amber-50/90 border-amber-400 border-dashed ring-4 ring-amber-400/30 scale-[1.01] shadow-xl'
                      : 'bg-slate-100/75 border-slate-200/90 hover:border-slate-300'
                    )
                  }
                >
                  {/* TOP STAGE ACCENT STRIP */}
                  <div className={'h-1.5 w-full ' + cfg.accent}></div>

                  {/* LANE HEADER */}
                  <div className={'p-3.5 border-b border-slate-200/80 backdrop-blur-xs flex items-center justify-between gap-2 shrink-0 ' + cfg.headerBg}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-black text-slate-400">0{sIdx + 1}</span>
                        <span className="text-xs font-black text-slate-900 block truncate" title={CrmStageLabels[stage] || stage}>
                          {CrmStageLabels[stage] || stage}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-extrabold text-slate-700 block truncate">
                          {stageFormattedTotal}
                        </span>
                        <span className="text-slate-300 text-[10px]">•</span>
                        <span className="text-[10px] text-slate-500 font-bold truncate">
                          {stageDeals.length} Deal{stageDeals.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <span className={'px-2 py-0.5 rounded-full font-black text-[10px] flex items-center justify-center border shrink-0 ' + cfg.badge}>
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
                  <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100dvh-390px)] custom-scrollbar">
                    {stageDeals.length === 0 ? (
                      <div className={'text-center rounded-xl my-2 p-5 flex flex-col items-center justify-center gap-2 border border-dashed transition-all ' +
                        (isDropTarget
                          ? 'border-amber-400 bg-amber-50/70 text-amber-900 ring-2 ring-amber-400/20'
                          : 'border-slate-300/80 bg-white/60 text-slate-400 hover:border-slate-400 hover:bg-white/80'
                        )
                      }>
                        <div className={'w-9 h-9 rounded-xl flex items-center justify-center ' + cfg.headerBg + ' ' + cfg.text}>
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-xs font-black text-slate-700 block">Stage Empty</span>
                          <p className="text-[10px] text-slate-400 font-medium">{cfg.tagline}</p>
                        </div>
                        <button
                          type="button"
                          onClick={onOpenNewDeal}
                          className="mt-1 px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-black rounded-lg transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 flex items-center gap-1"
                        >
                          <PlusCircle className="w-3 h-3 stroke-[2.5]" />
                          <span>New Deal</span>
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
                          onOpenFollowUp={onOpenFollowUp}
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

        </div>
      )}

      {/* 4. AUTHORITATIVE LEDGER TABLE VIEW */}
      {viewMode === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
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
                {displayedDeals.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      No deals found matching the search and stage criteria.
                    </td>
                  </tr>
                ) : (
                  displayedDeals.map((deal) => (
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
