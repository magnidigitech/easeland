import React from 'react';
import {
  Users,
  Award,
  TrendingUp,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { DEFAULT_CRM_AGENTS } from '../../../firebase/crmService.js';

export default function CrmExecutiveReport({ analytics, agents }) {
  if (!analytics) return null;

  const displayAgents = (Array.isArray(agents) && agents.length > 0)
    ? agents
    : (Array.isArray(analytics.agents) && analytics.agents.length > 0 ? analytics.agents : DEFAULT_CRM_AGENTS);

  const hasFinishedDeals = (analytics.totalFinishedDealsCount || (analytics.wonDealsCount + (analytics.lostDealsCount || 0))) > 0;
  const hasDeals = (analytics.totalDealsCount || 0) > 0;
  const hasLeads = (analytics.totalLeadsCount || 0) > 0;

  const funnelStages = [
    {
      id: 'leads',
      label: 'Buyer Inquiries',
      count: analytics.totalLeadsCount || 0,
      sublabel: hasLeads ? (analytics.hotLeadsCount || 0) + ' Hot High-Intent' : '0 Inquiries Recorded',
      pct: hasLeads ? 100 : 0,
      barColor: 'bg-blue-500',
      badgeColor: 'bg-blue-100 text-blue-800'
    },
    {
      id: 'deals',
      label: 'Deals in Negotiation',
      count: analytics.totalDealsCount || 0,
      sublabel: hasDeals ? (analytics.activeDealsCount || 0) + ' Active in Pipeline' : '0 Deals Initiated',
      pct: hasLeads ? Math.min(100, Math.round(((analytics.totalDealsCount || 0) / Math.max(1, analytics.totalLeadsCount || 1)) * 100)) : 0,
      barColor: 'bg-amber-500',
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    {
      id: 'visits',
      label: 'Site Inspections',
      count: analytics.scheduledVisitsCount || 0,
      sublabel: (analytics.scheduledVisitsCount || 0) > 0 ? 'Physical Field Visits' : '0 Visits Scheduled',
      pct: hasDeals ? Math.min(100, Math.round(((analytics.scheduledVisitsCount || 0) / Math.max(1, analytics.totalDealsCount || 1)) * 100)) : 0,
      barColor: 'bg-indigo-500',
      badgeColor: 'bg-indigo-100 text-indigo-800'
    },
    {
      id: 'won',
      label: 'Closed & Registered',
      count: analytics.wonDealsCount || 0,
      sublabel: hasFinishedDeals ? analytics.conversionRate + '% Win Rate' : (hasDeals ? 'Deals in Progress' : '0 Closed Deals'),
      pct: hasFinishedDeals ? Number(analytics.conversionRate) || 0 : 0,
      barColor: 'bg-emerald-500',
      badgeColor: 'bg-emerald-100 text-emerald-800'
    }
  ];

  return (
    <div className="space-y-6">

      {/* PIPELINE CONVERSION FUNNEL & VELOCITY */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              Pipeline Velocity & Deal Conversion Funnel
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Real-time progression from inbound buyer inquiry to land registry deed execution.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-500">Pipeline Velocity:</span>
            <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
              {hasFinishedDeals ? analytics.conversionRate + '% Overall Conversion' : (hasDeals ? 'Deals in Progress' : '0% Initial State')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {funnelStages.map((stage, idx) => (
            <div key={stage.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 relative group hover:border-amber-400 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">Stage {idx + 1}</span>
                <span className={'text-[10px] font-black px-2 py-0.5 rounded-full ' + stage.badgeColor}>
                  {stage.pct}% Flow
                </span>
              </div>

              <div>
                <span className="text-2xl font-black text-slate-900 block">{stage.count}</span>
                <span className="text-xs font-bold text-slate-700 block">{stage.label}</span>
                <span className="text-[11px] text-slate-400 font-medium block">{stage.sublabel}</span>
              </div>

              {/* FUNNEL PROPORTIONAL BAR */}
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className={'h-full rounded-full transition-all duration-500 ' + stage.barColor}
                  style={{ width: stage.pct + '%' }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AGENTS & BROKERAGE STATS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LICENSED AGENTS DIRECTORY */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h4 className="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Users className="w-4 h-4 text-amber-500" />
            Licensed Real Estate Portfolio Executives
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {displayAgents.map((agent) => (
              <div key={agent.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 hover:border-amber-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-slate-900">{agent.name.split(' (')[0]}</span>
                  <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {agent.role}
                  </span>
                </div>
                <span className="text-xs text-slate-500 block">{agent.email}</span>
                <span className="text-xs text-slate-700 font-bold block">{agent.phone}</span>
              </div>
            ))}
          </div>
        </div>

        {/* BROKERAGE PERFORMANCE HIGHLIGHTS */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h4 className="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Award className="w-4 h-4 text-amber-500" />
            Brokerage Closing Highlights
          </h4>

          <div className="space-y-3 text-xs font-bold">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500">Total Deals Initiated:</span>
              <span className="font-black text-slate-900">{analytics.totalDealsCount}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500">Active Deals in Pipeline:</span>
              <span className="font-black text-amber-600">{analytics.activeDealsCount}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500">Deals Closed & Registered:</span>
              <span className="font-black text-emerald-600">{analytics.wonDealsCount}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500">Conversion Win Rate:</span>
              <span className="font-black text-blue-600">
                {hasFinishedDeals ? analytics.conversionRate + '%' : (hasDeals ? 'In Progress' : '0% (No Closed Deals)')}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500">Earned Platform Commission:</span>
              <span className="font-black text-amber-700">{analytics.commissionDisplay}</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
