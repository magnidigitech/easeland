import React, { useState, useMemo } from 'react';
import {
  Calendar,
  PlusCircle,
  CheckCircle2,
  Check,
  MessageSquare,
  Trash2,
  Clock,
  MapPin,
  UserCheck,
  Search,
  X
} from 'lucide-react';

export default function CrmSiteVisits({
  visits,
  selectedAgent,
  onOpenScheduleVisit,
  onUpdateVisitStatus,
  onDeleteVisit,
  onTriggerWhatsApp
}) {
  const [visitSearch, setVisitSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'SCHEDULED', 'COMPLETED'
  const [completingVisitId, setCompletingVisitId] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('Site inspection completed successfully with buyer.');

  const agentScopedVisits = useMemo(() => {
    return visits.filter((v) => selectedAgent === 'ALL' || v.agentAssigned === selectedAgent);
  }, [visits, selectedAgent]);

  const statusCounts = useMemo(() => {
    let scheduled = 0;
    let completed = 0;
    for (const v of agentScopedVisits) {
      if (v.status === 'SCHEDULED') scheduled += 1;
      else if (v.status === 'COMPLETED') completed += 1;
    }
    return { all: agentScopedVisits.length, scheduled, completed };
  }, [agentScopedVisits]);

  const filteredVisits = useMemo(() => {
    const q = visitSearch.toLowerCase().trim();
    const qDigits = q.replace(/\D/g, '');
    return agentScopedVisits.filter((v) => {
      if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
      if (!q) return true;
      const ph = String(v.customerPhone || '').replace(/\D/g, '');
      return (
        (qDigits.length >= 3 && ph.includes(qDigits)) ||
        (v.customerName || '').toLowerCase().includes(q) ||
        (v.propertyTitle || '').toLowerCase().includes(q) ||
        (v.propertyLocation || '').toLowerCase().includes(q) ||
        (v.agentAssigned || '').toLowerCase().includes(q) ||
        (v.visitDate || '').includes(q)
      );
    });
  }, [agentScopedVisits, visitSearch, statusFilter]);

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">

      {/* HEADER & SCHEDULE BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            Physical Site Visits & Field Inspection Dispatcher
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Coordinate field executives, client venture pickups, and physical plot boundary audits across districts.
          </p>
        </div>

        <button
          onClick={onOpenScheduleVisit}
          className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4 stroke-[2.5]" />
          <span>Schedule New Visit</span>
        </button>
      </div>

      {/* SEARCH & STATUS FILTER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search visits by buyer, phone, parcel, location, date..."
            value={visitSearch}
            onChange={(e) => setVisitSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
          />
          {visitSearch && (
            <button
              type="button"
              onClick={() => setVisitSearch('')}
              aria-label="Clear visit search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 shrink-0">
          {[
            { id: 'ALL', label: 'All (' + statusCounts.all + ')' },
            { id: 'SCHEDULED', label: 'Scheduled (' + statusCounts.scheduled + ')' },
            { id: 'COMPLETED', label: 'Completed (' + statusCounts.completed + ')' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={'px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ' +
                (statusFilter === tab.id
                  ? 'bg-slate-900 text-amber-400 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* VISITS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredVisits.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 text-xs font-semibold">
            No physical site visits currently scheduled for this portfolio filter.
          </div>
        ) : (
          filteredVisits.map((visit) => (
            <div
              key={visit.id}
              className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-amber-400 shadow-sm transition-all space-y-3.5 flex flex-col justify-between"
            >
              <div className="space-y-2.5">

                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-slate-900 truncate pr-2">{visit.customerName}</span>
                  <span className={'text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 ' +
                    (visit.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                      visit.status === 'SCHEDULED' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700')
                  }>
                    {visit.status}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Inspection Parcel</span>
                  <p className="text-xs font-black text-slate-800 line-clamp-1">{visit.propertyTitle}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">Date</span>
                    <span className="font-extrabold text-slate-800">{visit.visitDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">Time</span>
                    <span className="font-extrabold text-slate-800">{visit.visitTime}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">Field Executive Assigned</span>
                  <span className="text-xs font-black text-slate-700 flex items-center gap-1 mt-0.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                    <span>{visit.agentAssigned}</span>
                  </span>
                </div>

                {visit.customerNotes && (
                  <div className="bg-slate-50 p-2.5 rounded-xl text-[11px] text-slate-600 font-medium">
                    {visit.customerNotes}
                  </div>
                )}

                {visit.customerFeedback && (
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-[11px] text-emerald-800 font-medium">
                    Feedback: {visit.customerFeedback}
                  </div>
                )}

              </div>

              {/* FOOTER ACTIONS */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                {completingVisitId === visit.id ? (
                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                    <input
                      type="text"
                      value={completionNotes}
                      onChange={(e) => setCompletionNotes(e.target.value)}
                      placeholder="Enter inspection notes or buyer feedback..."
                      className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateVisitStatus(visit.id, 'COMPLETED', completionNotes.trim());
                          setCompletingVisitId(null);
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] py-1.5 rounded-lg cursor-pointer"
                      >
                        Confirm Completion
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompletingVisitId(null)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 font-bold text-[11px] rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {visit.status === 'SCHEDULED' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCompletingVisitId(visit.id);
                          setCompletionNotes('Site inspection completed successfully with buyer.');
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Mark Completed</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 flex-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Inspection Done</span>
                      </span>
                    )}

                    {visit.customerPhone && (
                      <button
                        type="button"
                        onClick={() => onTriggerWhatsApp(visit.customerPhone, visit.customerName, visit.propertyTitle)}
                        className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors cursor-pointer"
                        title="Coordinate via WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => onDeleteVisit(e, visit.id, visit.customerName)}
                      className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
                      title="Delete visit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
}
