import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  MapPin,
  Building2,
  Phone,
  Mail,
  MessageSquare,
  PlusCircle,
  Filter,
  Search,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Award,
  AlertCircle,
  Trash2,
  Edit3,
  Eye,
  RefreshCw,
  FileText,
  Sparkles,
  Layers,
  UserCheck,
  Check,
  X
} from 'lucide-react';
import {
  CrmDealStages,
  CrmStageLabels,
  CrmLeadScores,
  CrmLeadSources,
  DEFAULT_CRM_AGENTS,
  getCrmLeads,
  createCrmLead,
  updateCrmLead,
  deleteCrmLead,
  getCrmDeals,
  createCrmDeal,
  updateCrmDealStage,
  updateCrmDealDetails,
  deleteCrmDeal,
  getCrmVisits,
  scheduleCrmVisit,
  updateCrmVisitStatus,
  getCrmAnalytics,
  matchPropertiesForLead,
  matchLeadsForProperty
} from '../firebase/crmService.js';
import { mockApi } from '../services/mockApi.js';

export default function EaseLandCRM({ onReturnToAdmin, onNavigateToMarketplace }) {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline', 'leads', 'matchmaker', 'visits', 'overview'
  const [selectedAgent, setSelectedAgent] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Core CRM Data
  const [leads, setLeads] = useState([]);
  const [deals, setDeals] = useState([]);
  const [visits, setVisits] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [availableProperties, setAvailableProperties] = useState([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [leadScoreFilter, setLeadScoreFilter] = useState('ALL');
  const [dealStageFilter, setDealStageFilter] = useState('ALL');

  // Modals
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [isNewDealModalOpen, setIsNewDealModalOpen] = useState(false);
  const [isScheduleVisitModalOpen, setIsScheduleVisitModalOpen] = useState(false);
  const [selectedDealForDossier, setSelectedDealForDossier] = useState(null);
  const [activeLeadForMatching, setActiveLeadForMatching] = useState(null);

  // Form State: New Lead
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    phone: '',
    email: '',
    source: CrmLeadSources.WEBSITE_ENQUIRY,
    score: CrmLeadScores.HOT,
    preferredLocation: 'Guntur / Amaravati Region',
    preferredPropertyType: 'Open Plots',
    budgetMin: 3000000,
    budgetMax: 6000000,
    assignedAgent: DEFAULT_CRM_AGENTS[0].name,
    notes: ''
  });

  // Form State: New Deal
  const [newDealForm, setNewDealForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    propertyTitle: '',
    propertyLocation: 'Amaravati Capital Region',
    ownerName: '',
    ownerPhone: '',
    dealValue: 4500000,
    commissionRate: 1.5,
    stage: CrmDealStages.NEW,
    expectedClosingDate: '',
    assignedAgent: DEFAULT_CRM_AGENTS[0].name,
    notes: ''
  });

  // Form State: Schedule Visit
  const [newVisitForm, setNewVisitForm] = useState({
    dealId: '',
    propertyTitle: '',
    customerName: '',
    customerPhone: '',
    visitDate: new Date().toISOString().split('T')[0],
    visitTime: '10:30 AM',
    agentAssigned: DEFAULT_CRM_AGENTS[0]?.name || 'EaseLand Admin',
    customerNotes: ''
  });

  // Toast feedback
  const [toastMessage, setToastMessage] = useState('');
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Load CRM Data
  const loadCrmData = async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true);
    try {
      const [leadsData, dealsData, visitsData, analyticsData] = await Promise.all([
        getCrmLeads(),
        getCrmDeals(),
        getCrmVisits(),
        getCrmAnalytics()
      ]);

      setLeads(leadsData);
      setDeals(dealsData);
      setVisits(visitsData);
      setAnalytics(analyticsData);

      // Load properties from mockApi / localStorage
      const props = mockApi.getPublicProperties();
      setAvailableProperties(Array.isArray(props) ? props : []);
    } catch (err) {
      console.warn('Error loading CRM data:', err);
    } finally {
      if (showLoadingState) setLoading(false);
    }
  };

  useEffect(() => {
    loadCrmData(true);

    // Listen for custom events with debouncing to prevent event storms
    let debounceTimer = null;
    const handleUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadCrmData(false);
      }, 200);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('easeland-crm-storage-updated', handleUpdate);
      return () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        window.removeEventListener('easeland-crm-storage-updated', handleUpdate);
      };
    }
  }, []);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        searchQuery === '' ||
        lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone?.includes(searchQuery) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.preferredLocation?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesScore = leadScoreFilter === 'ALL' || lead.score === leadScoreFilter;
      const matchesAgent = selectedAgent === 'ALL' || lead.assignedAgent === selectedAgent;

      return matchesSearch && matchesScore && matchesAgent;
    });
  }, [leads, searchQuery, leadScoreFilter, selectedAgent]);

  // Filtered Deals
  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      const matchesSearch =
        searchQuery === '' ||
        deal.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.propertyTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.ownerName?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStage = dealStageFilter === 'ALL' || deal.stage === dealStageFilter;
      const matchesAgent = selectedAgent === 'ALL' || deal.assignedAgent === selectedAgent;

      return matchesSearch && matchesStage && matchesAgent;
    });
  }, [deals, searchQuery, dealStageFilter, selectedAgent]);

  // Filtered Visits
  const filteredVisits = useMemo(() => {
    return visits.filter((visit) => {
      const matchesAgent = selectedAgent === 'ALL' || visit.agentAssigned === selectedAgent;
      return matchesAgent;
    });
  }, [visits, selectedAgent]);

  // Handle Create Lead Submit
  const handleCreateLeadSubmit = async (e) => {
    e.preventDefault();
    const res = await createCrmLead(newLeadForm);
    if (res.success) {
      triggerToast('Lead ' + newLeadForm.name + ' successfully added to CRM.');
      setIsNewLeadModalOpen(false);
      setNewLeadForm({
        name: '',
        phone: '',
        email: '',
        source: CrmLeadSources.WEBSITE_ENQUIRY,
        score: CrmLeadScores.HOT,
        preferredLocation: 'Guntur / Amaravati Region',
        preferredPropertyType: 'Open Plots',
        budgetMin: 3000000,
        budgetMax: 6000000,
        assignedAgent: DEFAULT_CRM_AGENTS[0].name,
        notes: ''
      });
      await loadCrmData();
    }
  };

  // Handle Create Deal Submit
  const handleCreateDealSubmit = async (e) => {
    e.preventDefault();
    const res = await createCrmDeal(newDealForm);
    if (res.success) {
      triggerToast('Deal for ' + newDealForm.customerName + ' successfully initiated.');
      setIsNewDealModalOpen(false);
      setNewDealForm({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        propertyTitle: '',
        propertyLocation: 'Amaravati Capital Region',
        ownerName: '',
        ownerPhone: '',
        dealValue: 4500000,
        commissionRate: 1.5,
        stage: CrmDealStages.NEW,
        expectedClosingDate: '',
        assignedAgent: DEFAULT_CRM_AGENTS[0].name,
        notes: ''
      });
      await loadCrmData();
    }
  };

  // Handle Schedule Visit Submit
  const handleScheduleVisitSubmit = async (e) => {
    e.preventDefault();
    const res = await scheduleCrmVisit(newVisitForm);
    if (res.success) {
      triggerToast('Site visit scheduled for ' + newVisitForm.customerName + ' on ' + newVisitForm.visitDate + '.');
      setIsScheduleVisitModalOpen(false);
      await loadCrmData();
    }
  };

  // Handle 1-Click Deal Stage Advance
  const handleAdvanceDealStage = async (dealId, nextStage, note = '') => {
    await updateCrmDealStage(dealId, nextStage, note);
    triggerToast('Deal moved to ' + (CrmStageLabels[nextStage] || nextStage) + '.');
    await loadCrmData();
  };

  // Handle WhatsApp Trigger
  const handleTriggerWhatsApp = (phone, name, propTitle = '') => {
    if (!phone) return;
    const cleanPh = phone.replace(/[^0-9]/g, '');
    const greeting = 'Hello ' + (name || 'Sir/Madam') + ', this is EaseLand Real Estate Brokerage regarding ' + (propTitle ? ('your inquiry on ' + propTitle) : 'verified property listings in Guntur / Amaravati region') + '.';
    const encoded = encodeURIComponent(greeting);
    const waUrl = 'https://wa.me/' + (cleanPh.length === 10 ? ('91' + cleanPh) : cleanPh) + '?text=' + encoded;
    if (typeof window !== 'undefined') {
      window.open(waUrl, '_blank');
    }
  };

  // Pipeline Stages for Kanban
  const kanbanStages = [
    CrmDealStages.NEW,
    CrmDealStages.CONTACTED,
    CrmDealStages.SITE_VISIT,
    CrmDealStages.DOCUMENT_AUDIT,
    CrmDealStages.PRICE_NEGOTIATION,
    CrmDealStages.TOKEN_ADVANCE,
    CrmDealStages.REGISTRATION_PENDING,
    CrmDealStages.CLOSED_WON
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP STUDIO HEADER (NAVY & GOLD ENTERPRISE SUITE)          */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between py-3.5 gap-4">
            
            {/* BRAND & STUDIO BADGE */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg">
                <Briefcase className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black tracking-tight text-white">
                    Ease<span className="text-amber-400">Land</span> CRM Studio
                  </span>
                  <span className="bg-amber-400/20 text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-400/40 uppercase tracking-widest">
                    Sales War Room
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  End-to-End Land Brokerage, Client Pipeline & Deal Closing Suite
                </p>
              </div>
            </div>

            {/* QUICK ACTIONS & REDIRECTIONS */}
            <div className="flex items-center gap-2.5 flex-wrap">
              
              {/* AGENT FILTER SELECTOR */}
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl text-xs">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400 text-[11px] font-bold">Agent:</span>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-slate-900 text-white">All Team Portfolio</option>
                  {DEFAULT_CRM_AGENTS.map((ag) => (
                    <option key={ag.id} value={ag.name} className="bg-slate-900 text-white">{ag.name}</option>
                  ))}
                </select>
              </div>

              {/* ACTION: CREATE NEW LEAD */}
              <button
                onClick={() => setIsNewLeadModalOpen(true)}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition-all transform hover:scale-105 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                <span>Add Lead</span>
              </button>

              {/* ACTION: SCHEDULE SITE VISIT */}
              <button
                onClick={() => setIsScheduleVisitModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-blue-100" />
                <span>Schedule Visit</span>
              </button>

              {/* REDIRECTION: RETURN TO ADMIN STUDIO */}
              <button
                onClick={onReturnToAdmin}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                title="Return to EaseLand Admin Governance & Site CMS Studio"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin Studio</span>
              </button>

              {/* REDIRECTION: OPEN MARKETPLACE */}
              <button
                onClick={onNavigateToMarketplace}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                title="View live marketplace portal"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                <span>Marketplace</span>
              </button>

            </div>

          </div>

          {/* ------------------------------------------------------------- */}
          {/* NAVIGATION TABS BAR                                           */}
          {/* ------------------------------------------------------------- */}
          <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1 border-t border-slate-800">
            {[
              { id: 'pipeline', label: 'Deal Pipeline (Kanban)', icon: Layers, count: deals.length },
              { id: 'leads', label: 'Buyer & Lead Directory', icon: Users, count: leads.length },
              { id: 'matchmaker', label: 'AI Land-Buyer Matchmaker', icon: Sparkles, count: availableProperties.length },
              { id: 'visits', label: 'Site Visits & Inspections', icon: Calendar, count: visits.length },
              { id: 'overview', label: 'Executive Performance', icon: TrendingUp }
            ].map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={'flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ' +
                    (isActive
                      ? 'bg-slate-50 text-slate-900 border-t-2 border-amber-400 shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    )
                  }
                >
                  <IconComp className={'w-4 h-4 ' + (isActive ? 'text-slate-900' : 'text-slate-400')} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={'px-1.5 py-0.5 rounded-md text-[10px] font-black ' +
                      (isActive ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300')
                    }>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

        </div>
      </header>

      {/* TOAST BANNER */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-amber-400/40 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="text-slate-400 hover:text-white ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN CRM WORKSPACE CONTENT                                 */}
      {/* ------------------------------------------------------------- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* TOP KPI PERFORMANCE CARDS (Always visible) */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <Briefcase className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Active Pipeline</span>
                <span className="text-lg font-black text-slate-900">{analytics.pipelineValueDisplay}</span>
                <span className="text-[11px] font-bold text-amber-600 block">{analytics.activeDealsCount} deals in progress</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <Award className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Closed Revenue</span>
                <span className="text-lg font-black text-emerald-600">{analytics.closedValueDisplay}</span>
                <span className="text-[11px] font-bold text-slate-500 block">{analytics.wonDealsCount} completed registrations</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Lead Conversion</span>
                <span className="text-lg font-black text-slate-900">{analytics.conversionRate}% Win Rate</span>
                <span className="text-[11px] font-bold text-blue-600 block">{analytics.hotLeadsCount} Hot High-Intent Leads</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Field Inspections</span>
                <span className="text-lg font-black text-slate-900">{analytics.scheduledVisitsCount} Scheduled</span>
                <span className="text-[11px] font-bold text-indigo-600 block">Active physical site visits</span>
              </div>
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: INTERACTIVE DEAL PIPELINE (KANBAN BOARD)               */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'pipeline' && (
          <div className="space-y-4">
            
            {/* SUB-HEADER & QUICK ACTIONS */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by buyer, property or owner..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>

                <select
                  value={dealStageFilter}
                  onChange={(e) => setDealStageFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Stages ({deals.length})</option>
                  {kanbanStages.map((st) => (
                    <option key={st} value={st}>{CrmStageLabels[st] || st}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsNewDealModalOpen(true)}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                  <span>Initiate New Deal</span>
                </button>
              </div>
            </div>

            {/* KANBAN HORIZONTAL PIPELINE LANES */}
            <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[600px]">
              {kanbanStages
                .filter(st => dealStageFilter === 'ALL' || dealStageFilter === st)
                .map((stage) => {
                  const stageDeals = filteredDeals.filter(d => d.stage === stage);
                  const stageTotal = stageDeals.reduce((sum, d) => sum + (Number(d.dealValue) || 0), 0);
                  const stageTotalLakhs = (stageTotal / 100000).toFixed(1);

                  return (
                    <div
                      key={stage}
                      className="w-80 shrink-0 bg-slate-100/80 rounded-2xl border border-slate-200 p-3 flex flex-col gap-3 shadow-inner"
                    >
                      {/* LANE HEADER */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <div>
                          <span className="text-xs font-black text-slate-900 block">
                            {CrmStageLabels[stage] || stage}
                          </span>
                          <span className="text-[10px] font-extrabold text-slate-500">
                            Rs. {stageTotalLakhs}L ({stageDeals.length})
                          </span>
                        </div>
                        <span className="w-6 h-6 rounded-full bg-white text-slate-800 font-black text-[11px] flex items-center justify-center border border-slate-300">
                          {stageDeals.length}
                        </span>
                      </div>

                      {/* DEAL CARDS IN THIS LANE */}
                      <div className="space-y-3 min-h-[100px]">
                        {stageDeals.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                            No deals in this stage
                          </div>
                        ) : (
                          stageDeals.map((deal) => (
                            <div
                              key={deal.id}
                              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all space-y-3 cursor-pointer group"
                              onClick={() => setSelectedDealForDossier(deal)}
                            >
                              {/* BUYER & PROBABILITY */}
                              <div className="flex items-center justify-between">
                                <span className="font-black text-sm text-slate-900 group-hover:text-amber-600 transition-colors">
                                  {deal.customerName}
                                </span>
                                <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-slate-200">
                                  {deal.probability}% Prob.
                                </span>
                              </div>

                              {/* PROPERTY TITLE & VALUE */}
                              <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Property Parcel</span>
                                <p className="text-xs font-black text-slate-800 line-clamp-1">{deal.propertyTitle}</p>
                                <span className="text-xs font-black text-emerald-600 mt-0.5 block">{deal.dealValueDisplay}</span>
                              </div>

                              {/* AGENT & ACTIONS */}
                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 font-bold line-clamp-1">{deal.assignedAgent?.split(' ')[0]}</span>
                                
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleTriggerWhatsApp(deal.customerPhone, deal.customerName, deal.propertyTitle)}
                                    className="p-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors"
                                    title="Open WhatsApp chat with buyer"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                  
                                  {/* STAGE ADVANCER DROPDOWN */}
                                  <select
                                    value={deal.stage}
                                    onChange={(e) => handleAdvanceDealStage(deal.id, e.target.value)}
                                    className="bg-slate-100 text-slate-800 text-[10px] font-black px-2 py-1 rounded-lg border border-slate-200 focus:outline-none cursor-pointer"
                                  >
                                    {kanbanStages.map((st) => (
                                      <option key={st} value={st}>{CrmStageLabels[st] || st}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                    </div>
                  );
                })}
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: BUYER & LEAD DIRECTORY                                 */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'leads' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-500" />
                  Buyer & Prospective Lead Directory
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Capture inbound website inquiries, investor leads, and direct WhatsApp contacts.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search leads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>

                <select
                  value={leadScoreFilter}
                  onChange={(e) => setLeadScoreFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Scores</option>
                  <option value={CrmLeadScores.HOT}>HOT Leads Only</option>
                  <option value={CrmLeadScores.WARM}>WARM Leads</option>
                  <option value={CrmLeadScores.COLD}>COLD Leads</option>
                </select>

                <button
                  onClick={() => setIsNewLeadModalOpen(true)}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                  <span>New Lead</span>
                </button>
              </div>
            </div>

            {/* LEADS TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Buyer Name & Contact</th>
                    <th className="py-3 px-4">Score & Source</th>
                    <th className="py-3 px-4">Preferred Location & Type</th>
                    <th className="py-3 px-4">Budget Range</th>
                    <th className="py-3 px-4">Assigned Agent</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                        No leads matching your current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                        
                        <td className="py-3.5 px-4">
                          <span className="font-black text-sm text-slate-900 block">{lead.name}</span>
                          <span className="text-[11px] text-slate-500 block">{lead.phone || 'No phone'}</span>
                          <span className="text-[11px] text-slate-400 block">{lead.email}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span className={'inline-block text-[10px] font-black px-2 py-0.5 rounded-full ' +
                              (lead.score === CrmLeadScores.HOT ? 'bg-red-100 text-red-700 border border-red-200' :
                               lead.score === CrmLeadScores.WARM ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                               'bg-blue-100 text-blue-800 border border-blue-200')
                            }>
                              {lead.score} LEAD
                            </span>
                            <span className="text-[10px] text-slate-500 block">{lead.source}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-slate-800 block">{lead.preferredLocation}</span>
                          <span className="text-[11px] text-slate-500 block">{lead.preferredPropertyType}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-black text-emerald-600 block">{lead.budgetDisplay}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="text-slate-700 font-bold block">{lead.assignedAgent}</span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setActiveLeadForMatching(lead);
                                setActiveTab('matchmaker');
                              }}
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg font-black text-[11px] flex items-center gap-1 border border-amber-200 transition-colors"
                              title="Find matching properties for this buyer"
                            >
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              <span>Match Plots</span>
                            </button>

                            <button
                              onClick={() => handleTriggerWhatsApp(lead.phone, lead.name)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                              title="Send WhatsApp message"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
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
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: SMART BUYER-PROPERTY MATCHMAKER                        */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'matchmaker' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            
            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  AI & Algorithmic Land-to-Buyer Matchmaker
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Cross-references location proximity, land category, and budget brackets to deliver high-conversion matches.
                </p>
              </div>

              {/* SELECT LEAD PICKER */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Selected Buyer:</span>
                <select
                  value={activeLeadForMatching?.id || ''}
                  onChange={(e) => {
                    const found = leads.find(l => l.id === e.target.value);
                    setActiveLeadForMatching(found || null);
                  }}
                  className="bg-slate-50 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="">Select a prospective buyer...</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.preferredLocation})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* MATCH RESULTS SECTION */}
            {!activeLeadForMatching ? (
              <div className="py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
                <Sparkles className="w-10 h-10 text-amber-400 mx-auto" />
                <h4 className="font-black text-sm text-slate-800">Select a Prospective Buyer to Run Matching</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Pick any lead from your CRM directory above to automatically score and rank all verified land plots against their exact requirements.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* ACTIVE BUYER PROFILE SUMMARY */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest block">Matching Criteria Profile</span>
                    <h4 className="text-base font-black text-slate-900">{activeLeadForMatching.name}</h4>
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-600 flex-wrap">
                      <span>Target: {activeLeadForMatching.preferredLocation}</span>
                      <span>•</span>
                      <span>Type: {activeLeadForMatching.preferredPropertyType}</span>
                      <span>•</span>
                      <span className="text-emerald-700">Budget: {activeLeadForMatching.budgetDisplay}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTriggerWhatsApp(activeLeadForMatching.phone, activeLeadForMatching.name)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors self-start md:self-auto cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Contact via WhatsApp</span>
                  </button>
                </div>

                {/* MATCHED PROPERTIES GRID */}
                {(() => {
                  const matched = matchPropertiesForLead(activeLeadForMatching, availableProperties);
                  if (matched.length === 0) {
                    return (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl text-slate-500 text-xs font-semibold">
                        No verified properties currently in the database match this specific criteria. Consider expanding the search radius.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {matched.map(({ property, matchScore }) => (
                        <div key={property.id || property.propertyId} className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 p-4 shadow-sm hover:shadow-md transition-all space-y-3 flex flex-col justify-between">
                          <div className="space-y-2">
                            
                            <div className="flex items-center justify-between">
                              <span className={'px-2.5 py-1 rounded-full text-[10px] font-black ' +
                                (matchScore >= 80 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                 matchScore >= 60 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                 'bg-blue-100 text-blue-800 border border-blue-300')
                              }>
                                {matchScore}% Criteria Match
                              </span>
                              <span className="text-[10px] font-black text-slate-400 uppercase">
                                {property.propertyType || property.category || 'Open Plot'}
                              </span>
                            </div>

                            <h5 className="font-black text-sm text-slate-900 line-clamp-1">
                              {property.title || 'Verified Land Parcel'}
                            </h5>

                            <p className="text-xs text-slate-500 flex items-center gap-1 line-clamp-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{property.locationName || property.address || property.city || 'Guntur / Amaravati'}</span>
                            </p>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-black">
                              <span className="text-slate-400 text-[10px] uppercase">Listed Price</span>
                              <span className="text-emerald-600 font-extrabold">{property.priceDisplay || ('Rs. ' + (Number(property.price || 0) / 100000).toFixed(1) + ' Lakhs')}</span>
                            </div>

                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                            <button
                              onClick={() => {
                                setNewVisitForm({
                                  dealId: '',
                                  propertyTitle: property.title || 'Land Parcel',
                                  customerName: activeLeadForMatching.name,
                                  customerPhone: activeLeadForMatching.phone,
                                  visitDate: new Date().toISOString().split('T')[0],
                                  visitTime: '11:00 AM',
                                  agentAssigned: activeLeadForMatching.assignedAgent || DEFAULT_CRM_AGENTS[0]?.name || 'EaseLand Admin',
                                  customerNotes: 'Matchmaker inspection visit for ' + (property.title || 'Plot')
                                });
                                setIsScheduleVisitModalOpen(true);
                              }}
                              className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Calendar className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Schedule Visit</span>
                            </button>
                          </div>

                        </div>
                      ))}
                    </div>
                  );
                })()}

              </div>
            )}

          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: SITE VISITS & FIELD DISPATCHER                         */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'visits' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  Physical Site Visits & Field Inspection Dispatcher
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Coordinate field agents, client pickups, and plot boundary inspections across districts.
                </p>
              </div>

              <button
                onClick={() => setIsScheduleVisitModalOpen(true)}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
              >
                <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                <span>Schedule New Visit</span>
              </button>
            </div>

            {/* VISITS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredVisits.length === 0 ? (
                <div className="col-span-full py-16 text-center bg-slate-50 rounded-2xl text-slate-400 text-xs font-semibold">
                  No site visits currently scheduled for this filter.
                </div>
              ) : (
                filteredVisits.map((visit) => (
                  <div key={visit.id} className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-amber-400 shadow-sm transition-all space-y-3 flex flex-col justify-between">
                    <div className="space-y-2.5">
                      
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-slate-900">{visit.customerName}</span>
                        <span className={'text-[10px] font-black px-2.5 py-0.5 rounded-full ' +
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
                        <span className="text-xs font-black text-slate-700">{visit.agentAssigned}</span>
                      </div>

                      {visit.customerNotes && (
                        <div className="bg-slate-50 p-2.5 rounded-xl text-[11px] text-slate-600 font-medium">
                          {visit.customerNotes}
                        </div>
                      )}

                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      {visit.status === 'SCHEDULED' ? (
                        <button
                          onClick={async () => {
                            await updateCrmVisitStatus(visit.id, 'COMPLETED', 'Site inspection completed successfully with buyer.');
                            triggerToast('Inspection marked completed.');
                            await loadCrmData();
                          }}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Completed</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Inspection Completed</span>
                        </span>
                      )}

                      <button
                        onClick={() => handleTriggerWhatsApp(visit.customerPhone, visit.customerName, visit.propertyTitle)}
                        className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors"
                        title="Chat with buyer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: EXECUTIVE PERFORMANCE & LOGS                          */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'overview' && analytics && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* PORTFOLIO AGENTS DIRECTORY */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h4 className="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Users className="w-4 h-4 text-amber-500" />
                Licensed Real Estate Portfolio Executives
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {DEFAULT_CRM_AGENTS.map((agent) => (
                  <div key={agent.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
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

            {/* QUICK STATS & CONVERSION HIGHLIGHT */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h4 className="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Award className="w-4 h-4 text-amber-500" />
                Brokerage Closing Highlights
              </h4>

              <div className="space-y-3 text-xs font-bold">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-500">Total Deals Initiated:</span>
                  <span className="font-black text-slate-900">{analytics.totalDealsCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-500">Deals in Active Pipeline:</span>
                  <span className="font-black text-amber-600">{analytics.activeDealsCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-500">Deals Successfully Closed:</span>
                  <span className="font-black text-emerald-600">{analytics.wonDealsCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-500">Total Land Leads Managed:</span>
                  <span className="font-black text-slate-900">{analytics.totalLeadsCount}</span>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: ADD NEW LEAD                                         */}
      {/* ------------------------------------------------------------- */}
      {isNewLeadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
            
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                  <Users className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                </div>
                <h4 className="font-black text-base">Capture New Buyer / Investor Lead</h4>
              </div>
              <button onClick={() => setIsNewLeadModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLeadSubmit} className="p-6 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. S. Ramakrishna"
                    value={newLeadForm.name}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98765 43210"
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="buyer@example.com"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lead Priority / Score</label>
                  <select
                    value={newLeadForm.score}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, score: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
                  >
                    <option value={CrmLeadScores.HOT}>HOT (Immediate Purchase)</option>
                    <option value={CrmLeadScores.WARM}>WARM (Exploring in 1-2 Months)</option>
                    <option value={CrmLeadScores.COLD}>COLD (General Inquiry)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Amaravati Core Sector"
                    value={newLeadForm.preferredLocation}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, preferredLocation: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Property Type</label>
                  <select
                    value={newLeadForm.preferredPropertyType}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, preferredPropertyType: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
                  >
                    <option value="Open Plots">Open Plots</option>
                    <option value="Agricultural Land">Agricultural Land</option>
                    <option value="Commercial Land">Commercial Land</option>
                    <option value="Houses & Villas">Houses & Villas</option>
                    <option value="Apartments">Apartments</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Budget (Rs)</label>
                  <input
                    type="number"
                    placeholder="5000000"
                    value={newLeadForm.budgetMax}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, budgetMax: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Executive</label>
                  <select
                    value={newLeadForm.assignedAgent}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, assignedAgent: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
                  >
                    {DEFAULT_CRM_AGENTS.map(ag => (
                      <option key={ag.id} value={ag.name}>{ag.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Requirement Notes</label>
                <textarea
                  rows={2}
                  placeholder="Specific requirements, vastu preferences, road width..."
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none resize-none"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewLeadModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Save Lead
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: INITIATE NEW DEAL                                    */}
      {/* ------------------------------------------------------------- */}
      {isNewDealModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
            
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                  <Briefcase className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                </div>
                <h4 className="font-black text-base">Initiate New Transaction Deal</h4>
              </div>
              <button onClick={() => setIsNewDealModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDealSubmit} className="p-6 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Buyer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. K. Rao"
                    value={newDealForm.customerName}
                    onChange={(e) => setNewDealForm({ ...newDealForm, customerName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Buyer Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98480 12345"
                    value={newDealForm.customerPhone}
                    onChange={(e) => setNewDealForm({ ...newDealForm, customerPhone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Property Listing Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amaravati Highway Commercial Plot"
                  value={newDealForm.propertyTitle}
                  onChange={(e) => setNewDealForm({ ...newDealForm, propertyTitle: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Agreed Deal Value (Rs) *</label>
                  <input
                    type="number"
                    required
                    placeholder="4500000"
                    value={newDealForm.dealValue}
                    onChange={(e) => setNewDealForm({ ...newDealForm, dealValue: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Initial Stage</label>
                  <select
                    value={newDealForm.stage}
                    onChange={(e) => setNewDealForm({ ...newDealForm, stage: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
                  >
                    {kanbanStages.map(st => (
                      <option key={st} value={st}>{CrmStageLabels[st] || st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewDealModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Create Deal
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: SCHEDULE SITE VISIT                                  */}
      {/* ------------------------------------------------------------- */}
      {isScheduleVisitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
            
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                  <Calendar className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                </div>
                <h4 className="font-black text-base">Schedule Physical Land Inspection</h4>
              </div>
              <button onClick={() => setIsScheduleVisitModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleVisitSubmit} className="p-6 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Buyer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Customer Name"
                    value={newVisitForm.customerName}
                    onChange={(e) => setNewVisitForm({ ...newVisitForm, customerName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Customer Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98480 00000"
                    value={newVisitForm.customerPhone}
                    onChange={(e) => setNewVisitForm({ ...newVisitForm, customerPhone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Property Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Plot Name or Location"
                  value={newVisitForm.propertyTitle}
                  onChange={(e) => setNewVisitForm({ ...newVisitForm, propertyTitle: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Visit Date *</label>
                  <input
                    type="date"
                    required
                    value={newVisitForm.visitDate}
                    onChange={(e) => setNewVisitForm({ ...newVisitForm, visitDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Visit Time *</label>
                  <input
                    type="text"
                    required
                    placeholder="10:30 AM"
                    value={newVisitForm.visitTime}
                    onChange={(e) => setNewVisitForm({ ...newVisitForm, visitTime: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Field Representative</label>
                <select
                  value={newVisitForm.agentAssigned}
                  onChange={(e) => setNewVisitForm({ ...newVisitForm, agentAssigned: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
                >
                  {DEFAULT_CRM_AGENTS.map(ag => (
                    <option key={ag.id} value={ag.name}>{ag.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Inspection Instructions / Pickup Location</label>
                <textarea
                  rows={2}
                  placeholder="Meeting point, survey map copy needed..."
                  value={newVisitForm.customerNotes}
                  onChange={(e) => setNewVisitForm({ ...newVisitForm, customerNotes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none resize-none"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsScheduleVisitModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Confirm Inspection
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: FULL DEAL DOSSIER VIEW                               */}
      {/* ------------------------------------------------------------- */}
      {selectedDealForDossier && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
            
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                  <FileText className="w-5 h-5 text-slate-950" />
                </div>
                <div>
                  <h4 className="font-black text-base">Transaction Deal Dossier</h4>
                  <span className="text-xs text-amber-400 font-semibold">{selectedDealForDossier.id}</span>
                </div>
              </div>
              <button onClick={() => setSelectedDealForDossier(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              
              {/* STAGE & FINANCIALS BANNER */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Current Stage</span>
                  <span className="font-black text-slate-900 text-sm">{CrmStageLabels[selectedDealForDossier.stage] || selectedDealForDossier.stage}</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Deal Value</span>
                  <span className="font-black text-emerald-600 text-sm">{selectedDealForDossier.dealValueDisplay}</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Brokerage Fee</span>
                  <span className="font-black text-amber-600 text-sm">Rs. {(selectedDealForDossier.expectedCommission || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Legal Clearance</span>
                  <span className="font-black text-blue-600 text-sm">{selectedDealForDossier.legalAuditStatus || 'VERIFIED'}</span>
                </div>
              </div>

              {/* PARTIES INVOLVED */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block">Purchaser / Buyer</span>
                  <h5 className="font-black text-sm text-slate-900">{selectedDealForDossier.customerName}</h5>
                  <span className="text-xs text-slate-600 font-bold block">{selectedDealForDossier.customerPhone}</span>
                  <span className="text-xs text-slate-400 block">{selectedDealForDossier.customerEmail}</span>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block">Property Owner / Seller</span>
                  <h5 className="font-black text-sm text-slate-900">{selectedDealForDossier.ownerName || 'Verified Platform Owner'}</h5>
                  <span className="text-xs text-slate-600 font-bold block">{selectedDealForDossier.ownerPhone || '+91 Direct Registered'}</span>
                </div>
              </div>

              {/* PROPERTY DETAILS */}
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">Land Parcel Specification</span>
                <h5 className="font-black text-sm text-slate-900">{selectedDealForDossier.propertyTitle}</h5>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedDealForDossier.propertyLocation}</span>
                </p>
              </div>

              {/* PAYMENT MILESTONES */}
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-900 block">Payment Milestones & Token Status</span>
                <div className="space-y-2">
                  {(selectedDealForDossier.paymentMilestones || []).length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-xl text-slate-400 text-xs font-semibold">
                      Standard payment milestones will be generated upon token deposit.
                    </div>
                  ) : (
                    selectedDealForDossier.paymentMilestones.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs font-bold border border-slate-200">
                        <div>
                          <span className="text-slate-900 block">{m.name}</span>
                          <span className="text-[11px] text-slate-400">{m.date}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-900 block font-black">Rs. {(m.amount || 0).toLocaleString()}</span>
                          <span className={'text-[10px] font-black ' + (m.status === 'PAID' ? 'text-emerald-600' : 'text-amber-600')}>
                            {m.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* TIMELINE ACTIVITY TRAIL */}
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-900 block">Deal Audit Activity Trail</span>
                <div className="space-y-2 border-l-2 border-slate-200 pl-4 py-1">
                  {(selectedDealForDossier.timeline || []).map((tl, idx) => (
                    <div key={idx} className="relative space-y-0.5">
                      <div className="w-2 h-2 rounded-full bg-amber-400 absolute -left-[21px] top-1.5 border border-white"></div>
                      <span className="text-[11px] font-bold text-slate-400 block">{tl.date} • {tl.user}</span>
                      <p className="text-xs font-black text-slate-800">{tl.event}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                onClick={() => handleTriggerWhatsApp(selectedDealForDossier.customerPhone, selectedDealForDossier.customerName, selectedDealForDossier.propertyTitle)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp Buyer</span>
              </button>

              <button
                onClick={() => setSelectedDealForDossier(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close Dossier
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
