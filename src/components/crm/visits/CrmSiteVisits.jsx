import React from 'react';
import {
  Calendar,
  PlusCircle,
  CheckCircle2,
  Check,
  MessageSquare,
  Trash2,
  Clock,
  MapPin,
  UserCheck
} from 'lucide-react';

export default function CrmSiteVisits({
  visits,
  selectedAgent,
  onOpenScheduleVisit,
  onUpdateVisitStatus,
  onDeleteVisit,
  onTriggerWhatsApp
}) {
  const filteredVisits = visits.filter((v) => {
    return selectedAgent === 'ALL' || v.agentAssigned === selectedAgent;
  });

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
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                {visit.status === 'SCHEDULED' ? (
                  <button
                    type="button"
                    onClick={() => onUpdateVisitStatus(visit.id, 'COMPLETED')}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
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
                  className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
                  title="Delete inspection"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
}
