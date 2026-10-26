import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  PlusCircle,
  MessageSquare,
  Trash2,
  Users,
  MapPin,
  TrendingUp,
  Lock
} from 'lucide-react';
import { CrmLeadScores } from '../../../firebase/crmService.js';

export default function CrmLeadDirectory({
  leads,
  searchQuery,
  setSearchQuery,
  selectedAgent,
  leadScoreFilter,
  setLeadScoreFilter,
  onOpenNewLead,
  onDeleteLead,
  onTriggerWhatsApp,
  isFieldExecutive = false
}) {
  const maskPhone = (ph) => {
    if (!ph) return '';
    if (!isFieldExecutive) return ph;
    const str = String(ph).trim();
    if (str.length <= 5) return '****';
    return str.slice(0, 3) + '****' + str.slice(-3);
  };

  const maskEmail = (em) => {
    if (!em) return '';
    if (!isFieldExecutive) return em;
    const parts = em.split('@');
    if (parts.length < 2) return '****@easeland.in';
    return parts[0].slice(0, 1) + '***@' + parts[1];
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        (lead.name || '').toLowerCase().includes(q) ||
        (lead.phone || '').includes(q) ||
        (lead.email || '').toLowerCase().includes(q) ||
        (lead.preferredLocation || '').toLowerCase().includes(q) ||
        (lead.preferredPropertyType || '').toLowerCase().includes(q);

      const matchesScore = leadScoreFilter === 'ALL' || lead.score === leadScoreFilter;
      const matchesAgent = selectedAgent === 'ALL' || lead.assignedAgent === selectedAgent;

      return matchesSearch && matchesScore && matchesAgent;
    });
  }, [leads, searchQuery, leadScoreFilter, selectedAgent]);

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">

      {/* HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            Verified Buyer & Investor Directory
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Centralized directory of qualified land buyers, budget envelopes, and venture preferences.
          </p>
        </div>

        <button
          onClick={onOpenNewLead}
          className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4 stroke-[2.5]" />
          <span>Add New Buyer Lead</span>
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search buyers by name, phone, city, or property type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
          />
        </div>

        {/* LEAD SCORE FILTER PILLS */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['ALL', CrmLeadScores.HOT, CrmLeadScores.WARM, CrmLeadScores.COLD].map((score) => {
            const isSelected = leadScoreFilter === score;
            return (
              <button
                key={score}
                type="button"
                onClick={() => setLeadScoreFilter(score)}
                className={'px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ' +
                  (isSelected
                    ? 'bg-slate-900 text-amber-400 shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )
                }
              >
                <span>{score === 'ALL' ? 'All Intent Scores' : score + ' Intent'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* LEADS DESKTOP TABLE */}
      <div className="hidden md:block rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="px-4 py-3">Buyer Profile</th>
                <th className="px-4 py-3">Phone & Contact</th>
                <th className="px-4 py-3">Preferred Region</th>
                <th className="px-4 py-3">Property Interest</th>
                <th className="px-4 py-3">Budget Envelope</th>
                <th className="px-4 py-3 text-center">Score</th>
                <th className="px-4 py-3">Assigned Agent</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                    No buyer leads found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-900 text-amber-400 font-black flex items-center justify-center shrink-0 shadow-xs">
                          {(lead.name || 'B')[0].toUpperCase()}
                        </div>
                        <div>
                          <span className="font-black text-slate-900 block">{lead.name}</span>
                          <span className="text-[10px] text-slate-400 font-medium">Source: {lead.source || 'Website'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-800 block">{maskPhone(lead.phone) || '—'}</span>
                        {isFieldExecutive && lead.phone && (
                          <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1 py-0.5 rounded-sm flex items-center gap-0.5" title="Masked by Field Broker Policy">
                            <Lock className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      {lead.email && <span className="text-[10px] text-slate-400 font-medium block truncate max-w-[150px]">{maskEmail(lead.email)}</span>}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1 text-slate-700">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{lead.preferredLocation || 'Any Location'}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-800">
                      {lead.preferredPropertyType || 'Open Plot Ventures'}
                    </td>

                    <td className="px-4 py-3.5 font-black text-emerald-600">
                      {lead.budgetDisplay || (lead.budgetMax ? 'Up to Rs. ' + (lead.budgetMax / 100000).toFixed(1) + ' Lakhs' : 'Flexible')}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className={'px-2.5 py-0.5 rounded-full text-[10px] font-black ' +
                        (lead.score === 'HOT' ? 'bg-red-100 text-red-800 border border-red-200' :
                          lead.score === 'WARM' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            'bg-slate-100 text-slate-700 border border-slate-200')
                      }>
                        {lead.score || 'WARM'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      {lead.assignedAgent}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {lead.phone && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isFieldExecutive) {
                                alert('Field Broker Policy: Direct customer messaging is restricted to Senior Brokers. Contact Admin Desk to initiate customer handover.');
                                return;
                              }
                              onTriggerWhatsApp(lead.phone, lead.name);
                            }}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                            title={isFieldExecutive ? 'Contact restricted by field policy' : 'Chat on WhatsApp'}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => onDeleteLead(e, lead.id, lead.name)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Delete lead permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LEADS MOBILE CARDS (MD:HIDDEN) */}
      <div className="md:hidden space-y-3">
        {filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-bold">
            No buyer leads found matching the filter criteria.
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <div
              key={lead.id}
              className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3 hover:border-amber-400 transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 font-black flex items-center justify-center shrink-0 shadow-xs">
                    {(lead.name || 'B')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="font-black text-sm text-slate-900 block truncate">{lead.name}</span>
                    <span className="text-[10px] text-slate-400 font-medium">Source: {lead.source || 'Website'}</span>
                  </div>
                </div>

                <span className={'px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ' +
                  (lead.score === 'HOT' ? 'bg-red-100 text-red-800 border border-red-200' :
                    lead.score === 'WARM' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      'bg-slate-100 text-slate-700 border border-slate-200')
                }>
                  {lead.score || 'WARM'} Intent
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Budget</span>
                  <span className="font-black text-emerald-600 block truncate">
                    {lead.budgetDisplay || (lead.budgetMax ? 'Up to Rs. ' + (lead.budgetMax / 100000).toFixed(1) + ' L' : 'Flexible')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Agent</span>
                  <span className="font-extrabold text-slate-700 block truncate">{lead.assignedAgent}</span>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="font-bold truncate">{lead.preferredLocation || 'Any Location'}</span>
                </div>
                <div className="text-[11px] text-slate-500 pl-5 truncate">
                  {lead.preferredPropertyType || 'Open Plot Ventures'}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">{maskPhone(lead.phone) || '—'}</span>
                  {lead.email && <span className="text-[10px] text-slate-400 block truncate max-w-[170px]">{maskEmail(lead.email)}</span>}
                </div>

                <div className="flex items-center gap-1.5">
                  {lead.phone && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isFieldExecutive) {
                          alert('Field Broker Policy: Direct customer messaging is restricted to Senior Brokers. Contact Admin Desk to initiate customer handover.');
                          return;
                        }
                        onTriggerWhatsApp(lead.phone, lead.name);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                      title="Chat on WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => onDeleteLead(e, lead.id, lead.name)}
                    className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
                    title="Delete lead permanently"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
