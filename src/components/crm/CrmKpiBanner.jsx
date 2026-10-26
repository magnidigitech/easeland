import React from 'react';
import { Briefcase, Award, Users, Calendar } from 'lucide-react';

export default function CrmKpiBanner({ analytics }) {
  if (!analytics) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

      {/* ACTIVE PIPELINE */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md">
        <div className="w-12 h-12 rounded-xl bg-amber-100/70 border border-amber-300/80 flex items-center justify-center shrink-0">
          <Briefcase className="w-6 h-6 text-amber-700 stroke-[2.2]" />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block truncate">Active Pipeline</span>
          <span className="text-lg font-black text-slate-900 block truncate">{analytics.pipelineValueDisplay}</span>
          <span className="text-[11px] font-extrabold text-amber-800 block truncate">{analytics.activeDealsCount} deals in progress</span>
        </div>
      </div>

      {/* CLOSED REVENUE */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md">
        <div className="w-12 h-12 rounded-xl bg-emerald-100/70 border border-emerald-300/80 flex items-center justify-center shrink-0">
          <Award className="w-6 h-6 text-emerald-700 stroke-[2.2]" />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block truncate">Closed Revenue</span>
          <span className="text-lg font-black text-emerald-700 block truncate">{analytics.closedValueDisplay}</span>
          <span className="text-[11px] font-extrabold text-slate-700 block truncate">{analytics.wonDealsCount} completed registrations</span>
        </div>
      </div>

      {/* LEAD CONVERSION WIN RATE */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md">
        <div className="w-12 h-12 rounded-xl bg-blue-100/70 border border-blue-300/80 flex items-center justify-center shrink-0">
          <Users className="w-6 h-6 text-blue-700 stroke-[2.2]" />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block truncate">Lead Conversion</span>
          <span className="text-lg font-black text-slate-900 block truncate">
            {(analytics.totalFinishedDealsCount || (analytics.wonDealsCount + (analytics.lostDealsCount || 0))) > 0
              ? analytics.conversionRate + '% Win Rate'
              : (analytics.activeDealsCount > 0 ? '0% (In Progress)' : '0% (No Deals)')}
          </span>
          <span className="text-[11px] font-extrabold text-blue-800 block truncate">
            {(analytics.totalFinishedDealsCount || (analytics.wonDealsCount + (analytics.lostDealsCount || 0))) > 0
              ? analytics.wonDealsCount + ' won of ' + (analytics.totalFinishedDealsCount || (analytics.wonDealsCount + (analytics.lostDealsCount || 0))) + ' closed'
              : (analytics.activeDealsCount > 0
                  ? analytics.activeDealsCount + ' active in pipeline'
                  : (analytics.totalLeadsCount > 0
                      ? analytics.totalLeadsCount + ' leads awaiting deals'
                      : 'Pipeline empty'))}
          </span>
        </div>
      </div>

      {/* FIELD INSPECTIONS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5 transition-all hover:shadow-md">
        <div className="w-12 h-12 rounded-xl bg-indigo-100/70 border border-indigo-300/80 flex items-center justify-center shrink-0">
          <Calendar className="w-6 h-6 text-indigo-700 stroke-[2.2]" />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block truncate">Field Inspections</span>
          <span className="text-lg font-black text-slate-900 block truncate">{analytics.scheduledVisitsCount} Scheduled</span>
          <span className="text-[11px] font-extrabold text-indigo-800 block truncate">Active physical site visits</span>
        </div>
      </div>

    </div>
  );
}
