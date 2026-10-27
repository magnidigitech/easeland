import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Users,
  Sparkles,
  Calendar,
  TrendingUp,
  CheckCircle2,
  X,
  ShieldCheck,
  AlertTriangle,
  Lock
} from 'lucide-react';
import {
  CrmDealStages,
  CrmStageLabels,
  DEFAULT_CRM_AGENTS,
  fetchCrmBootstrap,
  createCrmLead,
  deleteCrmLead,
  createCrmDeal,
  updateCrmDealStage,
  updateCrmDealFollowUp,
  deleteCrmDeal,
  scheduleCrmVisit,
  updateCrmVisitStatus,
  deleteCrmVisit,
  matchPropertiesForLead,
  getStageDefaultFollowUp
} from '../firebase/crmService.js';

import { mockApi } from '../services/mockApi.js';

import CrmHeader from '../components/crm/CrmHeader.jsx';
import CrmKpiBanner from '../components/crm/CrmKpiBanner.jsx';
import CrmKanbanBoard from '../components/crm/kanban/CrmKanbanBoard.jsx';
import CrmLeadDirectory from '../components/crm/directory/CrmLeadDirectory.jsx';
import CrmMatchmaker from '../components/crm/matchmaker/CrmMatchmaker.jsx';
import CrmSiteVisits from '../components/crm/visits/CrmSiteVisits.jsx';
import CrmExecutiveReport from '../components/crm/analytics/CrmExecutiveReport.jsx';

import NewLeadModal from '../components/crm/modals/NewLeadModal.jsx';
import NewDealModal from '../components/crm/modals/NewDealModal.jsx';
import ScheduleVisitModal from '../components/crm/modals/ScheduleVisitModal.jsx';
import DealDossierModal from '../components/crm/modals/DealDossierModal.jsx';
import ScheduleFollowUpModal from '../components/crm/modals/ScheduleFollowUpModal.jsx';

export default function EaseLandCRM({
  currentUser,
  authLoading = false,
  onReturnToAdmin,
  onNavigateToMarketplace,
  onNavigateToDashboard,
  onNavigateToLogin
}) {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline', 'leads', 'matchmaker', 'visits', 'overview'
  const [selectedAgent, setSelectedAgent] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Core CRM Data
  const [leads, setLeads] = useState([]);
  const [deals, setDeals] = useState([]);
  const [visits, setVisits] = useState([]);
  const [agents, setAgents] = useState(DEFAULT_CRM_AGENTS);
  const [dynamicLocations, setDynamicLocations] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [availableProperties, setAvailableProperties] = useState([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [leadScoreFilter, setLeadScoreFilter] = useState('ALL');

  // Modals State
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [isNewDealModalOpen, setIsNewDealModalOpen] = useState(false);
  const [newDealInitialData, setNewDealInitialData] = useState(null);
  const [isScheduleVisitModalOpen, setIsScheduleVisitModalOpen] = useState(false);
  const [scheduleVisitInitialData, setScheduleVisitInitialData] = useState(null);
  const [selectedDealForDossier, setSelectedDealForDossier] = useState(null);
  const [isScheduleFollowUpModalOpen, setIsScheduleFollowUpModalOpen] = useState(false);
  const [selectedDealForFollowUp, setSelectedDealForFollowUp] = useState(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState('');
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // RBAC Authentication & Role Gate
  const isAdminAuthenticated = typeof window !== 'undefined' && localStorage.getItem('easeland_admin_authenticated') === 'true';
  const isAuthorized = Boolean(
    isAdminAuthenticated ||
    (currentUser && (
      currentUser.role === 'ADMIN' ||
      currentUser.adminRole ||
      currentUser.role === 'BROKER' ||
      currentUser.role === 'AGENT' ||
      currentUser.role === 'FIELD_EXECUTIVE' ||
      currentUser.capabilities?.includes('ADMIN')
    ))
  );

  const isFieldExecutive = Boolean(currentUser && currentUser.role === 'FIELD_EXECUTIVE');

  // List of all valid CRM Kanban stages
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

  // Load CRM Data from Authoritative Bootstrap
  const loadCrmData = async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true);
    try {
      const data = await fetchCrmBootstrap();
      setLeads(data.leads || []);
      setDeals(data.deals || []);
      setVisits(data.visits || []);
      if (Array.isArray(data.agents) && data.agents.length > 0) {
        setAgents(data.agents);
      }
      if (Array.isArray(data.dynamicLocations)) {
        setDynamicLocations(data.dynamicLocations);
      }
      setAnalytics(data.analytics || null);

      // Load properties from marketplace
      const props = mockApi.getPublicProperties();
      setAvailableProperties(Array.isArray(props) ? props : []);
    } catch (err) {
      console.warn('Error loading authoritative CRM data:', err);
    } finally {
      if (showLoadingState) setLoading(false);
    }
  };

  useEffect(() => {
    loadCrmData(true);
  }, []);

  // Server-Sent Events (SSE) Live Synchronization Bus
  useEffect(() => {
    let sseSource = null;
    try {
      sseSource = new EventSource('/api/crm/live-stream');
      sseSource.onopen = () => {
        setIsLiveConnected(true);
      };
      sseSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.type && payload.type !== 'CONNECTED') {
            loadCrmData(false);
          }
        } catch (e) {}
      };
      sseSource.onerror = () => {
        setIsLiveConnected(false);
      };
    } catch (e) {
      setIsLiveConnected(false);
    }

    return () => {
      if (sseSource) {
        sseSource.close();
      }
    };
  }, []);

  // Handle Create Lead
  const handleCreateLead = async (leadFormData) => {
    const res = await createCrmLead(leadFormData);
    if (res.success) {
      triggerToast('Lead ' + leadFormData.name + ' saved to database.');
      setIsNewLeadModalOpen(false);
      await loadCrmData(false);
    }
  };

  // Handle Create Deal
  const handleCreateDeal = async (dealFormData) => {
    const res = await createCrmDeal(dealFormData);
    if (res.success) {
      triggerToast('Deal for ' + dealFormData.customerName + ' successfully initiated.');
      setIsNewDealModalOpen(false);
      setNewDealInitialData(null);
      await loadCrmData(false);
    }
  };

  // 1-Click Convert Lead to Deal Handler
  const handleConvertLeadToDeal = (lead) => {
    if (!lead) return;
    setNewDealInitialData({
      customerName: lead.name || '',
      customerPhone: lead.phone || '',
      customerEmail: lead.email || '',
      propertyLocation: lead.preferredLocation || 'Amaravati / Guntur',
      propertyTitle: lead.preferredPropertyType || 'Open Plot Venture',
      dealValue: lead.budgetMax || '',
      assignedAgent: lead.assignedAgent || (agents[0]?.name || 'EaseLand Admin'),
      nextFollowUpDate: new Date().toISOString().split('T')[0],
      nextFollowUpAction: 'Initial conversion qualification call'
    });
    setIsNewDealModalOpen(true);
  };

  // Handle Open Follow-up Modal
  const handleOpenFollowUp = (deal) => {
    setSelectedDealForFollowUp(deal);
    setIsScheduleFollowUpModalOpen(true);
  };

  // Handle Save Follow-up
  const handleSaveFollowUp = async (dealId, followUpData) => {
    try {
      const res = await updateCrmDealFollowUp(dealId, followUpData);
      if (res.success) {
        setDeals(prev => prev.map(d => {
          if (d.id === dealId || d.dealId === dealId) {
            const updatedTimeline = Array.isArray(d.timeline) ? [...d.timeline] : [];
            if (followUpData.logNote) {
              updatedTimeline.push({
                date: new Date().toISOString().split('T')[0],
                event: followUpData.logNote,
                user: followUpData.agentName || 'EaseLand Admin'
              });
            }
            if (followUpData.followUpAction) {
              updatedTimeline.push({
                date: new Date().toISOString().split('T')[0],
                event: 'Follow-up scheduled for ' + (followUpData.followUpDate || 'Due') + ' at ' + (followUpData.followUpTime || '11:00 AM') + ': ' + followUpData.followUpAction,
                user: followUpData.agentName || 'EaseLand Admin'
              });
            }
            return {
              ...d,
              nextFollowUpDate: followUpData.followUpDate !== undefined ? followUpData.followUpDate : d.nextFollowUpDate,
              nextFollowUpTime: followUpData.followUpTime || d.nextFollowUpTime,
              nextFollowUpAction: followUpData.followUpAction !== undefined ? followUpData.followUpAction : d.nextFollowUpAction,
              timeline: updatedTimeline,
              updatedAt: new Date().toISOString()
            };
          }
          return d;
        }));
        if (selectedDealForDossier && (selectedDealForDossier.id === dealId || selectedDealForDossier.dealId === dealId)) {
          setSelectedDealForDossier(prev => prev ? {
            ...prev,
            nextFollowUpDate: followUpData.followUpDate !== undefined ? followUpData.followUpDate : prev.nextFollowUpDate,
            nextFollowUpTime: followUpData.followUpTime || prev.nextFollowUpTime,
            nextFollowUpAction: followUpData.followUpAction !== undefined ? followUpData.followUpAction : prev.nextFollowUpAction
          } : prev);
        }
        triggerToast('Follow-up scheduled successfully.');
        await loadCrmData(false);
      }
    } catch (err) {
      console.error('Failed to schedule follow-up:', err);
      triggerToast('Error saving follow-up.');
    }
  };

  // Handle Schedule Visit
  const handleScheduleVisit = async (visitFormData) => {
    const res = await scheduleCrmVisit(visitFormData);
    if (res.success) {
      triggerToast('Site visit scheduled for ' + visitFormData.customerName + ' on ' + visitFormData.visitDate + '.');
      setIsScheduleVisitModalOpen(false);
      setScheduleVisitInitialData(null);
      await loadCrmData(false);
    }
  };

  // Handle 1-Click / Drag Deal Stage Advance
  const handleAdvanceDealStage = async (dealId, nextStage, note = '') => {
    const targetDeal = deals.find(d => d.id === dealId);
    if (targetDeal && targetDeal.isPropertyQuarantined && nextStage !== 'CLOSED_LOST') {
      triggerToast('Action blocked: Referenced property was quarantined by Admin Compliance.');
      return;
    }

    const stageFollowUp = getStageDefaultFollowUp(nextStage);

    // Optimistic UI Update with stage-adjusted follow-up action and date
    setDeals(prev => prev.map(d => d.id === dealId ? {
      ...d,
      stage: nextStage,
      nextFollowUpAction: stageFollowUp.action,
      nextFollowUpDate: stageFollowUp.date,
      nextFollowUpTime: stageFollowUp.time
    } : d));

    const res = await updateCrmDealStage(dealId, nextStage, note, stageFollowUp);
    if (res.success) {
      triggerToast('Deal moved to ' + (CrmStageLabels[nextStage] || nextStage) + '. Follow-up adjusted: ' + stageFollowUp.milestone);
      await loadCrmData(false);
    } else {
      triggerToast(res.error || 'Failed to update stage. Reverting view.');
      await loadCrmData(false);
    }
  };


  // Handle Delete Deal
  const handleDeleteDeal = async (e, dealId, customerName = '') => {
    if (e) e.stopPropagation();
    const label = customerName ? ('deal for "' + customerName + '"') : 'this deal';
    if (window.confirm('Are you sure you want to delete ' + label + ' from the database?')) {
      await deleteCrmDeal(dealId);
      triggerToast('Deal deleted from database.');
      if (selectedDealForDossier?.id === dealId) {
        setSelectedDealForDossier(null);
      }
      await loadCrmData(false);
    }
  };

  // Handle Delete Lead
  const handleDeleteLead = async (e, leadId, leadName = '') => {
    if (e) e.stopPropagation();
    const label = leadName ? ('lead "' + leadName + '"') : 'this lead';
    if (window.confirm('Are you sure you want to delete ' + label + '?')) {
      await deleteCrmLead(leadId);
      triggerToast('Lead deleted from database.');
      await loadCrmData(false);
    }
  };

  // Handle Delete Visit
  const handleDeleteVisit = async (e, visitId, customerName = '') => {
    if (e) e.stopPropagation();
    const label = customerName ? ('inspection for "' + customerName + '"') : 'this inspection';
    if (window.confirm('Are you sure you want to delete ' + label + '?')) {
      await deleteCrmVisit(visitId);
      triggerToast('Site visit deleted.');
      await loadCrmData(false);
    }
  };

  // Handle Update Visit Status (Mark Completed)
  const handleUpdateVisitStatus = async (visitId, newStatus) => {
    const feedback = window.prompt('Enter inspection notes or buyer feedback:', 'Site inspection completed successfully with buyer.');
    await updateCrmVisitStatus(visitId, newStatus, feedback || '');
    triggerToast('Inspection marked ' + newStatus + '.');
    await loadCrmData(false);
  };

  // Combined dynamic locations from API bootstrap and marketplace properties
  const combinedLocations = useMemo(() => {
    const locSet = new Set(dynamicLocations || []);
    (availableProperties || []).forEach((p) => {
      if (p.locationName) locSet.add(p.locationName);
      if (p.city) locSet.add(p.city);
      if (p.district) locSet.add(p.district);
      if (p.mandal) locSet.add(p.mandal);
      if (p.village) locSet.add(p.village);
    });
    return Array.from(locSet).filter(Boolean);
  }, [dynamicLocations, availableProperties]);

  // Handle Matchmaker Schedule Visit Trigger
  const handleMatchmakerSchedule = (property, lead) => {
    setScheduleVisitInitialData({
      dealId: '',
      propertyTitle: property.title || 'Land Parcel',
      propertyLocation: property.locationName || property.address || property.city || property.district || (combinedLocations[0] || 'Amaravati Capital Region'),
      customerName: lead ? lead.name : '',
      customerPhone: lead ? lead.phone : '',
      visitDate: new Date().toISOString().split('T')[0],
      visitTime: '11:00 AM',
      agentAssigned: lead?.assignedAgent || (agents[0] && agents[0].name) || DEFAULT_CRM_AGENTS[0].name,
      customerNotes: 'AI Matchmaker inspection booking for ' + (property.title || 'Plot')
    });
    setIsScheduleVisitModalOpen(true);
  };

  // Handle WhatsApp Trigger
  const handleTriggerWhatsApp = (phone, name, propTitle = '') => {
    if (!phone) return;
    const cleanPh = phone.replace(/[^0-9]/g, '');
    const greeting = 'Hello ' + (name || 'Sir/Madam') + ', this is EaseLand Verified Properties regarding ' +
      (propTitle ? ('your inquiry on ' + propTitle) : 'verified land ventures across Andhra Pradesh') + '.';
    const encoded = encodeURIComponent(greeting);
    const waUrl = 'https://wa.me/' + (cleanPh.length === 10 ? ('91' + cleanPh) : cleanPh) + '?text=' + encoded;
    if (typeof window !== 'undefined') {
      window.open(waUrl, '_blank');
    }
  };

  // Filtered Deals for Kanban / Table
  const filteredDeals = deals.filter((deal) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      (deal.customerName || '').toLowerCase().includes(q) ||
      (deal.propertyTitle || '').toLowerCase().includes(q) ||
      (deal.ownerName || '').toLowerCase().includes(q);

    const matchesAgent = selectedAgent === 'ALL' || deal.assignedAgent === selectedAgent;
    return matchesSearch && matchesAgent;
  });

  // Count quarantined deals
  const quarantinedDealsCount = deals.filter(d => d.isPropertyQuarantined).length;

  if (authLoading && !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-amber-400 font-black text-sm">
          <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Authenticating Broker Clearance...</span>
        </div>
      </div>
    );
  }

  // RBAC Access Control Screen for unauthorized public accounts
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center mx-auto font-black shadow-lg shadow-amber-400/20">
            <ShieldCheck className="w-9 h-9 stroke-[2.2]" />
          </div>

          <div className="space-y-2">
            <span className="text-amber-400 text-xs font-black uppercase tracking-widest block">
              EaseLand Institutional Brokerage
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Broker Clearance Required
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              The EaseLand CRM Studio is a restricted transactional clearinghouse for verified land brokers, licensed agents, and administrative staff. Public buyer/seller accounts cannot view confidential customer pipelines or commission ledgers.
            </p>
          </div>

          {currentUser ? (
            <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/80 text-left space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Current Account:</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-extrabold text-[10px]">
                  {currentUser.role || 'PUBLIC USER'}
                </span>
              </div>
              <p className="font-black text-white truncate">{currentUser.name || currentUser.displayName || currentUser.email}</p>
              <p className="text-[11px] text-amber-300/80 font-medium">
                To access CRM Studio, sign in with an EaseLand Licensed Broker or Administrator account.
              </p>
            </div>
          ) : null}

          <div className="space-y-3 pt-2">
            {!currentUser ? (
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="w-full py-3 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md cursor-pointer"
              >
                Authenticate with Broker Credentials
              </button>
            ) : (
              <button
                type="button"
                onClick={onNavigateToDashboard}
                className="w-full py-3 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md cursor-pointer"
              >
                Open My User Dashboard
              </button>
            )}

            <button
              type="button"
              onClick={onNavigateToMarketplace}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              Return to Public Marketplace
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">

      {/* 1. TOP CRM STUDIO HEADER */}
      <CrmHeader
        agents={agents}
        selectedAgent={selectedAgent}
        setSelectedAgent={setSelectedAgent}
        isAgentDropdownOpen={isAgentDropdownOpen}
        setIsAgentDropdownOpen={setIsAgentDropdownOpen}
        onOpenNewLead={() => setIsNewLeadModalOpen(true)}
        onOpenScheduleVisit={() => {
          setScheduleVisitInitialData(null);
          setIsScheduleVisitModalOpen(true);
        }}
        onReturnToAdmin={onReturnToAdmin}
        onNavigateToMarketplace={onNavigateToMarketplace}
        onRefresh={() => loadCrmData(true)}
        loading={loading}
        isLiveConnected={isLiveConnected}
        followUpsDueTodayCount={analytics?.followUpsDueTodayCount || 0}
        onQuickFilterFollowUps={() => setActiveTab('pipeline')}
      />

      {/* 2. TOAST BANNER */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-amber-400/40 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage('')} className="text-slate-400 hover:text-white ml-2 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. MAIN CRM WORKSPACE CONTENT */}
      <main className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* TOP KPI PERFORMANCE CARDS */}
        <CrmKpiBanner analytics={analytics} />

        {/* COMPLIANCE ALERT BANNER (If any quarantined properties have active deals) */}
        {quarantinedDealsCount > 0 && (
          <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl flex items-center justify-between gap-3 text-rose-900 text-xs">
            <div className="flex items-center gap-2.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Compliance Alert: {quarantinedDealsCount} deal{quarantinedDealsCount > 1 ? 's are' : ' is'} frozen because the referenced land parcel was removed or flagged by Admin Compliance.
              </span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-rose-200 text-rose-800 px-2 py-0.5 rounded-md shrink-0">
              Action Suspended
            </span>
          </div>
        )}

        {/* NAVIGATION TABS BAR */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1 border-b border-slate-200 custom-scrollbar">
          {[
            { id: 'pipeline', label: 'Deal Pipeline (Kanban)', icon: Layers, count: deals.length },
            { id: 'leads', label: 'Buyer Directory', icon: Users, count: leads.length },
            { id: 'matchmaker', label: 'AI Matchmaker Engine', icon: Sparkles },
            { id: 'visits', label: 'Site Visits & Inspections', icon: Calendar, count: visits.length },
            { id: 'overview', label: 'Executive Performance', icon: TrendingUp }
          ].map((tab) => {
            const IconComp = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={'flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ' +
                  (isActive
                    ? 'bg-white text-slate-900 border-t-2 border-amber-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  )
                }
              >
                <IconComp className={'w-4 h-4 ' + (isActive ? 'text-amber-500' : 'text-slate-400')} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={'px-1.5 py-0.5 rounded-md text-[10px] font-black ' +
                    (isActive ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-600')
                  }>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: KANBAN PIPELINE */}
        {activeTab === 'pipeline' && (
          <CrmKanbanBoard
            deals={filteredDeals}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            kanbanStages={kanbanStages}
            onSelectDeal={setSelectedDealForDossier}
            onAdvanceStage={handleAdvanceDealStage}
            onDeleteDeal={handleDeleteDeal}
            onTriggerWhatsApp={handleTriggerWhatsApp}
            onOpenFollowUp={handleOpenFollowUp}
            onOpenNewDeal={() => {
              setNewDealInitialData(null);
              setIsNewDealModalOpen(true);
            }}
            isFieldExecutive={isFieldExecutive}
          />
        )}

        {/* TAB 2: BUYER DIRECTORY */}
        {activeTab === 'leads' && (
          <CrmLeadDirectory
            leads={leads}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedAgent={selectedAgent}
            leadScoreFilter={leadScoreFilter}
            setLeadScoreFilter={setLeadScoreFilter}
            onOpenNewLead={() => setIsNewLeadModalOpen(true)}
            onDeleteLead={handleDeleteLead}
            onTriggerWhatsApp={handleTriggerWhatsApp}
            onConvertToDeal={handleConvertLeadToDeal}
            isFieldExecutive={isFieldExecutive}
          />
        )}

        {/* TAB 3: BI-DIRECTIONAL AI MATCHMAKER */}
        {activeTab === 'matchmaker' && (
          <CrmMatchmaker
            leads={leads}
            availableProperties={availableProperties}
            onScheduleVisitForProperty={handleMatchmakerSchedule}
            onTriggerWhatsApp={handleTriggerWhatsApp}
          />
        )}

        {/* TAB 4: SITE VISITS & FIELD DISPATCHER */}
        {activeTab === 'visits' && (
          <CrmSiteVisits
            visits={visits}
            selectedAgent={selectedAgent}
            onOpenScheduleVisit={() => {
              setScheduleVisitInitialData(null);
              setIsScheduleVisitModalOpen(true);
            }}
            onUpdateVisitStatus={handleUpdateVisitStatus}
            onDeleteVisit={handleDeleteVisit}
            onTriggerWhatsApp={handleTriggerWhatsApp}
          />
        )}

        {/* TAB 5: EXECUTIVE PERFORMANCE */}
        {activeTab === 'overview' && (
          <CrmExecutiveReport analytics={analytics} agents={agents} />
        )}

      </main>

      {/* MODAL 1: ADD NEW LEAD */}
      <NewLeadModal
        isOpen={isNewLeadModalOpen}
        onClose={() => setIsNewLeadModalOpen(false)}
        onSubmit={handleCreateLead}
        agents={agents}
        availableLocations={combinedLocations}
      />

      {/* MODAL 2: INITIATE TRANSACTION DEAL */}
      <NewDealModal
        isOpen={isNewDealModalOpen}
        onClose={() => {
          setIsNewDealModalOpen(false);
          setNewDealInitialData(null);
        }}
        onSubmit={handleCreateDeal}
        kanbanStages={kanbanStages}
        agents={agents}
        availableLocations={combinedLocations}
        initialData={newDealInitialData}
      />

      {/* MODAL 3: SCHEDULE SITE INSPECTION */}
      <ScheduleVisitModal
        isOpen={isScheduleVisitModalOpen}
        onClose={() => {
          setIsScheduleVisitModalOpen(false);
          setScheduleVisitInitialData(null);
        }}
        onSubmit={handleScheduleVisit}
        initialData={scheduleVisitInitialData}
        agents={agents}
        availableLocations={combinedLocations}
      />

      {/* MODAL 4: FULL DEAL DOSSIER */}
      <DealDossierModal
        deal={selectedDealForDossier}
        onClose={() => setSelectedDealForDossier(null)}
        onTriggerWhatsApp={handleTriggerWhatsApp}
        onDeleteDeal={handleDeleteDeal}
        onAdvanceStage={handleAdvanceDealStage}
        onOpenFollowUp={handleOpenFollowUp}
        kanbanStages={kanbanStages}
        isFieldExecutive={isFieldExecutive}
      />

      {/* MODAL 5: SCHEDULE CLIENT FOLLOW-UP */}
      <ScheduleFollowUpModal
        isOpen={isScheduleFollowUpModalOpen}
        onClose={() => {
          setIsScheduleFollowUpModalOpen(false);
          setSelectedDealForFollowUp(null);
        }}
        deal={selectedDealForFollowUp}
        onSave={handleSaveFollowUp}
        agentName={agents[0]?.name || 'EaseLand Admin'}
      />

    </div>
  );
}
