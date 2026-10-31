import React from 'react';
import {
  Briefcase,
  Users,
  PlusCircle,
  Calendar,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  Check,
  RefreshCw,
  Clock
} from 'lucide-react';
import { DEFAULT_CRM_AGENTS } from '../../firebase/crmService.js';

export default function CrmHeader({
  agents = [],
  selectedAgent,
  setSelectedAgent,
  isAgentDropdownOpen,
  setIsAgentDropdownOpen,
  onOpenNewLead,
  onOpenScheduleVisit,
  onReturnToAdmin,
  onNavigateToMarketplace,
  onRefresh,
  loading,
  isLiveConnected = true,
  followUpsDueTodayCount = 0,
  onQuickFilterFollowUps
}) {
  const agentList = (Array.isArray(agents) && agents.length > 0) ? agents : DEFAULT_CRM_AGENTS;
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 text-white shadow-xl">
      <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3.5 gap-4">

          {/* BRAND & STUDIO BADGE */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-400/20">
              <Briefcase className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white">
                  Ease<span className="text-amber-400">Land</span> CRM Studio
                </span>
                <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-400/40 uppercase tracking-widest">
                  Enterprise
                </span>
                <span
                  className={'w-2 h-2 rounded-full ' + (isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400')}
                  title={isLiveConnected ? 'Live Real-Time Sync Active (PostgreSQL + SSE)' : 'Connecting to Live Stream...'}
                ></span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Authoritative Land Brokerage, Client Pipeline & Deal Closing Suite
              </p>
            </div>
          </div>

          {/* QUICK ACTIONS & REDIRECTIONS */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full md:w-auto shrink-0 whitespace-nowrap">

            {/* REFRESH LIVE DATA */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl transition-all cursor-pointer shrink-0"
              title="Refresh live CRM data from PostgreSQL"
            >
              <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin text-amber-400' : '')} />
            </button>

            {/* QUICK TODAY'S FOLLOW-UPS PILL */}
            {followUpsDueTodayCount > 0 && (
              <button
                type="button"
                onClick={onQuickFilterFollowUps}
                className="bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer animate-pulse shrink-0"
                title="Click to view deals with follow-ups due today"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Due Today:</span>
                <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                  {followUpsDueTodayCount}
                </span>
              </button>
            )}

            {/* AGENT FILTER SELECTOR */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
                className="flex items-center gap-2 bg-slate-800 border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-xl text-xs text-white font-bold transition-all cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400 text-[11px]">Agent:</span>
                <span className="text-white font-black">{selectedAgent === 'ALL' ? 'All Team Portfolio' : selectedAgent}</span>
                <ChevronDown className={'w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ' + (isAgentDropdownOpen ? 'rotate-180 text-amber-400' : '')} />
              </button>

              {isAgentDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAgentDropdownOpen(false)}></div>
                  <div className="absolute left-0 mt-1.5 w-56 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl z-50 p-1.5 space-y-0.5 animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={() => { setSelectedAgent('ALL'); setIsAgentDropdownOpen(false); }}
                      className={'w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ' +
                        (selectedAgent === 'ALL' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-300 hover:bg-slate-800')
                      }
                    >
                      <span>All Team Portfolio</span>
                      {selectedAgent === 'ALL' && <Check className="w-3.5 h-3.5 text-slate-950" />}
                    </button>

                    <div className="h-px bg-slate-800 my-1"></div>

                    {agentList.map((ag) => (
                      <button
                        key={ag.id}
                        type="button"
                        onClick={() => { setSelectedAgent(ag.name); setIsAgentDropdownOpen(false); }}
                        className={'w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ' +
                          (selectedAgent === ag.name ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-300 hover:bg-slate-800')
                        }
                      >
                        <span>{ag.name}</span>
                        {selectedAgent === ag.name && <Check className="w-3.5 h-3.5 text-slate-950" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ACTION: CREATE NEW LEAD */}
            <button
              onClick={onOpenNewLead}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition-all transform hover:scale-105 cursor-pointer shrink-0"
            >
              <PlusCircle className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              <span>Add Lead</span>
            </button>

            {/* ACTION: SCHEDULE SITE VISIT */}
            <button
              onClick={onOpenScheduleVisit}
              className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <Calendar className="w-4 h-4 text-blue-100" />
              <span>Schedule Visit</span>
            </button>

            {/* REDIRECTION: ADMIN STUDIO */}
            <button
              onClick={onReturnToAdmin}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="Return to Admin Governance Studio"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Admin</span>
            </button>

            {/* REDIRECTION: MARKETPLACE */}
            <button
              onClick={onNavigateToMarketplace}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="View live marketplace portal"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>Marketplace</span>
            </button>

          </div>
        </div>
      </div>
    </header>
  );
}
