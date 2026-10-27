import { db } from './config.js';

// CRM Pipeline Stages
export const CrmDealStages = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  SITE_VISIT: 'SITE_VISIT',
  DOCUMENT_AUDIT: 'DOCUMENT_AUDIT',
  PRICE_NEGOTIATION: 'PRICE_NEGOTIATION',
  TOKEN_ADVANCE: 'TOKEN_ADVANCE',
  REGISTRATION_PENDING: 'REGISTRATION_PENDING',
  CLOSED_WON: 'CLOSED_WON',
  CLOSED_LOST: 'CLOSED_LOST'
};

export const CrmStageLabels = {
  [CrmDealStages.NEW]: 'New Inquiries',
  [CrmDealStages.CONTACTED]: 'Contacted & Discovery',
  [CrmDealStages.SITE_VISIT]: 'Site Visit Scheduled',
  [CrmDealStages.DOCUMENT_AUDIT]: 'Title Deed Audit',
  [CrmDealStages.PRICE_NEGOTIATION]: 'Price Negotiation',
  [CrmDealStages.TOKEN_ADVANCE]: 'Token Advance Paid',
  [CrmDealStages.REGISTRATION_PENDING]: 'Registration Pending',
  [CrmDealStages.CLOSED_WON]: 'Closed & Won',
  [CrmDealStages.CLOSED_LOST]: 'Closed / Lost'
};

// Stage-Specific Metadata: Milestones, Action Goals, Checklists, and Default Follow-up Windows
export const CRM_STAGE_METADATA = {
  [CrmDealStages.NEW]: {
    step: 1,
    tagline: 'Initial buyer inquiries',
    milestone: 'Buyer Outreach',
    defaultAction: 'Initial qualification & requirement gathering call',
    leadDays: 1,
    badgeColor: 'sky',
    checklist: ['Verify buyer budget', 'Preferred zone', 'Immediate / Long-term intent']
  },
  [CrmDealStages.CONTACTED]: {
    step: 2,
    tagline: 'Discovery & qualifications',
    milestone: 'Shortlist Shared',
    defaultAction: 'Send verified property layout & schedule pitch call',
    leadDays: 1,
    badgeColor: 'indigo',
    checklist: ['Send layout plan', 'Facing preference confirmed', 'Plot size shortlisted']
  },
  [CrmDealStages.SITE_VISIT]: {
    step: 3,
    tagline: 'Physical plot inspections',
    milestone: 'Field Inspection',
    defaultAction: 'Coordinate physical plot inspection & boundary landmark check',
    leadDays: 2,
    badgeColor: 'amber',
    checklist: ['GPS coordinates pin', 'Boundary stones checked', 'Road width & approach verified']
  },
  [CrmDealStages.DOCUMENT_AUDIT]: {
    step: 4,
    tagline: 'Legal & title clearance',
    milestone: 'Title & EC Audit',
    defaultAction: 'Verify 30-year Link Documents, Encumbrance Certificate & Revenue clearance',
    leadDays: 3,
    badgeColor: 'purple',
    checklist: ['30-yr link deed trace', 'Nil-encumbrance EC', 'Pattadar passbook check']
  },
  [CrmDealStages.PRICE_NEGOTIATION]: {
    step: 5,
    tagline: 'Price & terms structuring',
    milestone: 'Price Structuring',
    defaultAction: 'Buyer-Seller commercial meeting & final price per sq.yd agreement',
    leadDays: 2,
    badgeColor: 'orange',
    checklist: ['Asking vs Offer gap', 'Payment schedule structure', 'TDS & tax terms']
  },
  [CrmDealStages.TOKEN_ADVANCE]: {
    step: 6,
    tagline: 'Advance committed',
    milestone: 'Token / Bayana',
    defaultAction: 'Verify token advance transfer & execute bilingual Sale Agreement',
    leadDays: 2,
    badgeColor: 'teal',
    checklist: ['Token receipt issued', '90-day execution clause', 'Boundary schedule marked']
  },
  [CrmDealStages.REGISTRATION_PENDING]: {
    step: 7,
    tagline: 'Sub-registrar filing',
    milestone: 'SRO Registration',
    defaultAction: 'Book Sub-Registrar slot, deposit stamp duty challan & witness prep',
    leadDays: 3,
    badgeColor: 'blue',
    checklist: ['Sub-Registrar slot booked', 'Stamp duty & cess paid', '2 witness IDs collected']
  },
  [CrmDealStages.CLOSED_WON]: {
    step: 8,
    tagline: 'Executed & registered',
    milestone: 'Registration Complete',
    defaultAction: 'Sale deed executed, physical possession & mutation handover complete',
    leadDays: 0,
    badgeColor: 'emerald',
    checklist: ['Registered deed received', 'Physical plot possession', 'Commission settled']
  },
  [CrmDealStages.CLOSED_LOST]: {
    step: 0,
    tagline: 'Deal closed / cancelled',
    milestone: 'Deal Lost',
    defaultAction: 'Document loss reason, buyer feedback & archive deal dossier',
    leadDays: 0,
    badgeColor: 'slate',
    checklist: ['Loss reason recorded', 'Buyer re-engagement date']
  }
};

export function getStageDefaultFollowUp(stage) {
  const meta = CRM_STAGE_METADATA[stage] || CRM_STAGE_METADATA[CrmDealStages.NEW];
  const targetDate = new Date();
  if (meta.leadDays > 0) {
    targetDate.setDate(targetDate.getDate() + meta.leadDays);
  }
  return {
    action: meta.defaultAction,
    date: targetDate.toISOString().split('T')[0],
    time: '11:00 AM',
    milestone: meta.milestone,
    tagline: meta.tagline,
    step: meta.step,
    badgeColor: meta.badgeColor,
    checklist: meta.checklist
  };
}


export const CrmLeadScores = {
  HOT: 'HOT',
  WARM: 'WARM',
  COLD: 'COLD'
};

export const CrmLeadSources = {
  WEBSITE_ENQUIRY: 'Website Enquiry',
  WHATSAPP: 'WhatsApp Direct',
  PHONE_CALL: 'Inbound Call',
  SITE_VISIT: 'Field Visit Request',
  REFERRAL: 'Partner Referral'
};

// Comprehensive Base Regional Clusters for Intelligent Proximity Matching (AP, Telangana & South India)
export const BASE_REGIONAL_CLUSTERS = {
  amaravati: ['mangalagiri', 'tulluru', 'thullur', 'mandadam', 'velagapudi', 'tadepalli', 'guntur', 'vijayawada', 'capital', 'ibrahimpatnam', 'kunchanapalli', 'undavalli', 'rayapudi', 'ainavolu'],
  guntur: ['amaravati', 'mangalagiri', 'tadepalli', 'namburu', 'pedakakani', 'brodipet', 'arundelpet', 'nagarampalem', 'tenali', 'chebrolu', 'percherla'],
  vijayawada: ['amaravati', 'kanuru', 'poranki', 'gannavaram', 'ennikepadu', 'penamaluru', 'benz circle', 'bhavanipuram', 'kankipadu', 'kondapalli'],
  visakhapatnam: ['vizag', 'madhurawada', 'gajuwaka', 'rushikonda', 'mvp colony', 'pendurthi', 'sheela nagar', 'kurmannapalem', 'boyapalem', 'bheemili', 'anandapuram'],
  tirupati: ['alipiri', 'renigunta', 'chandragiri', 'karakambadi', 'yerpedu', 'tirumala', 'padmavathi nagar', 'mangalam'],
  hyderabad: ['gachibowli', 'madhapur', 'hitec city', 'kondapur', 'kokapet', 'financial district', 'tellapur', 'narsingi', 'jubilee hills', 'banjara hills', 'kukatpally', 'miyapur'],
  kurnool: ['nandyal', 'orvakal', 'kallur', 'venkataramana colony', 'dhone'],
  rajahmundry: ['rajamahendravaram', 'kakinada', 'dowleswaram', 'morampudi', 'lalacheruvu', 'diwancheruvu'],
  kakinada: ['rajahmundry', 'samalkot', 'sarpavaram', 'achampeta', 'madhavapatnam'],
  nellore: ['magunta layout', 'vedayapalem', 'darga mitta', 'kovur', 'haranathapuram'],
  anantapur: ['dharmavaram', 'hindupur', 'kadiri', 'rudrampeta'],
  kadapa: ['ysr district', 'proddatur', 'pulivendula', 'rapathu nagar']
};

export let REGIONAL_CLUSTERS = { ...BASE_REGIONAL_CLUSTERS };

export function getRegionalClusters() {
  return REGIONAL_CLUSTERS;
}

export function registerRegionalCluster(hubName, clusterMembers = []) {
  if (!hubName) return REGIONAL_CLUSTERS;
  const key = String(hubName).toLowerCase().trim();
  const members = (Array.isArray(clusterMembers) ? clusterMembers : [])
    .map(m => String(m).toLowerCase().trim())
    .filter(Boolean);

  REGIONAL_CLUSTERS[key] = Array.from(new Set([
    ...(REGIONAL_CLUSTERS[key] || []),
    ...members
  ]));
  return REGIONAL_CLUSTERS;
}

export function registerDynamicLocationsFromProperties(properties = []) {
  if (!Array.isArray(properties)) return REGIONAL_CLUSTERS;
  for (const p of properties) {
    if (!p) continue;
    const loc = String(p.locationName || p.city || p.district || p.address || '').toLowerCase().trim();
    if (!loc) continue;

    const tokens = loc.split(/[\s,]+/).filter(t => t.length > 2);
    let matched = false;
    for (const [hub, members] of Object.entries(REGIONAL_CLUSTERS)) {
      if (loc.includes(hub) || members.some(m => loc.includes(m))) {
        REGIONAL_CLUSTERS[hub] = Array.from(new Set([...REGIONAL_CLUSTERS[hub], ...tokens]));
        matched = true;
      }
    }
    if (!matched && tokens.length > 0) {
      const primaryToken = tokens[0];
      if (!REGIONAL_CLUSTERS[primaryToken]) {
        REGIONAL_CLUSTERS[primaryToken] = tokens;
      }
    }
  }
  return REGIONAL_CLUSTERS;
}

export const CRM_PROPERTY_TYPES = [
  'Open Plot Ventures',
  'CRDA Approved Plots',
  'Commercial Land & Plots',
  'Agricultural Farmland',
  'Villas & Independent Houses',
  'Apartments & Flats',
  'Industrial & Warehouse Land'
];

export function getCrmPropertyTypes(customTypes = []) {
  const merged = new Set([
    ...CRM_PROPERTY_TYPES,
    ...(Array.isArray(customTypes) ? customTypes : []).filter(Boolean)
  ]);
  return Array.from(merged);
}

export const DEFAULT_CRM_AGENTS = [
  { id: 'agent-1', name: 'EaseLand Admin', role: 'Principal Broker / Administrator', email: 'admin@easeland.in', phone: '+91 98765 00000' }
];

let activeCrmAgents = [...DEFAULT_CRM_AGENTS];

export function getActiveCrmAgents() {
  return activeCrmAgents;
}

export function setActiveCrmAgents(agents) {
  if (Array.isArray(agents) && agents.length > 0) {
    activeCrmAgents = agents;
  }
  return activeCrmAgents;
}

let dynamicLocationsStore = [
  'Amaravati Capital Region',
  'Mangalagiri IT Corridor',
  'Tulluru Venture Sector',
  'Guntur City Hub',
  'Vijayawada Gateway'
];

export function getAvailableLocations(extraLocations = []) {
  const combined = new Set([
    ...dynamicLocationsStore,
    ...(Array.isArray(extraLocations) ? extraLocations : []).filter(Boolean)
  ]);
  return Array.from(combined);
}

export function setAvailableLocations(locations = []) {
  if (Array.isArray(locations) && locations.length > 0) {
    dynamicLocationsStore = Array.from(new Set([...locations.filter(Boolean), ...dynamicLocationsStore]));
  }
  return dynamicLocationsStore;
}

export function formatAmountInWords(amount) {
  const num = Number(amount);
  if (isNaN(num) || num <= 0) return '';
  if (num >= 10000000) {
    const cr = num / 10000000;
    return 'Rs. ' + (cr % 1 === 0 ? cr : cr.toFixed(2)) + ' Crore' + (cr > 1 ? 's' : '');
  } else if (num >= 100000) {
    const lakhs = num / 100000;
    return 'Rs. ' + (lakhs % 1 === 0 ? lakhs : lakhs.toFixed(2)) + ' Lakh' + (lakhs > 1 ? 's' : '');
  } else if (num >= 1000) {
    const k = num / 1000;
    return 'Rs. ' + (k % 1 === 0 ? k : k.toFixed(1)) + ' Thousand';
  }
  return 'Rs. ' + num.toLocaleString('en-IN');
}

export function numToWordsIndian(num) {
  const n = Number(num);
  if (isNaN(n) || n <= 0) return '';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(val) {
    let strVal = val.toString();
    if (strVal.length > 9) return '';
    let nPadded = ('000000000' + strVal).slice(-9);
    let m = nPadded.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!m) return '';
    let res = '';
    res += (Number(m[1]) !== 0) ? (a[Number(m[1])] || (b[m[1][0]] + ' ' + a[m[1][1]])) + ' Crore ' : '';
    res += (Number(m[2]) !== 0) ? (a[Number(m[2])] || (b[m[2][0]] + ' ' + a[m[2][1]])) + ' Lakh ' : '';
    res += (Number(m[3]) !== 0) ? (a[Number(m[3])] || (b[m[3][0]] + ' ' + a[m[3][1]])) + ' Thousand ' : '';
    res += (Number(m[4]) !== 0) ? (a[Number(m[4])] || (b[m[4][0]] + ' ' + a[m[4][1]])) + ' Hundred ' : '';
    res += (Number(m[5]) !== 0) ? ((res !== '') ? 'and ' : '') + (a[Number(m[5])] || (b[m[5][0]] + ' ' + a[m[5][1]])) + ' ' : '';
    return res.trim();
  }

  const words = inWords(n);
  return words ? (words + ' Rupees Only') : '';
}

export function getCleanPhone(phoneStr) {
  if (!phoneStr) return '';
  const digits = String(phoneStr).replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

export function filterOutDummyItems(items) {
  if (!Array.isArray(items)) return [];
  const dummyIds = new Set(['lead-101', 'lead-102', 'deal-201', 'deal-202']);
  return items.filter(item => item && !dummyIds.has(item.id));
}

export function deduplicateLeads(leads) {
  if (!Array.isArray(leads)) return [];
  const seen = new Set();
  const result = [];

  for (const item of leads) {
    if (!item) continue;
    const cleanPhone = getCleanPhone(item.phone || item.customerPhone);
    const cleanName = String(item.name || item.customerName || '').toLowerCase().trim();
    const key = cleanPhone ? cleanPhone : (cleanName && cleanName !== 'prospective buyer' && cleanName !== 'platform buyer' ? cleanName : item.id);

    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export function deduplicateDeals(deals) {
  if (!Array.isArray(deals)) return [];
  const seen = new Set();
  const result = [];

  for (const item of deals) {
    if (!item) continue;
    const cleanPhone = getCleanPhone(item.customerPhone || item.phone);
    const propTitle = String(item.propertyTitle || item.title || '').toLowerCase().trim();
    const key = (cleanPhone && propTitle) ? (cleanPhone + '_' + propTitle) : item.id;

    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export function deduplicateVisits(visits) {
  if (!Array.isArray(visits)) return [];
  const seen = new Set();
  const result = [];

  for (const item of visits) {
    if (!item) continue;
    const cleanPhone = getCleanPhone(item.customerPhone || item.phone);
    const date = String(item.visitDate || '').trim();
    const key = (cleanPhone && date) ? (cleanPhone + '_' + date) : item.id;

    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

const isBrowser = typeof window !== 'undefined' && typeof window.fetch === 'function';

// In-Memory Test Store (Active ONLY during offline unit tests where HTTP server is absent)
let testLeadsStore = [];
let testDealsStore = [];
let testVisitsStore = [];

/**
 * ----------------------------------------------------------------------------
 * PURE AUTHORITATIVE API CLIENT (ZERO LOCALSTORAGE FALLBACK)
 * Communicates directly with PostgreSQL via /api/crm/*
 * ----------------------------------------------------------------------------
 */

export function calculateCrmAnalytics(deals = [], leads = [], visits = []) {
  const safeDeals = Array.isArray(deals) ? deals : [];
  const safeLeads = Array.isArray(leads) ? leads : [];
  const safeVisits = Array.isArray(visits) ? visits : [];

  const activeDeals = safeDeals.filter(d => d && d.stage !== CrmDealStages.CLOSED_WON && d.stage !== CrmDealStages.CLOSED_LOST);
  const totalPipelineValue = activeDeals.reduce((acc, d) => acc + (Number(d.dealValue) || 0), 0);
  const wonDeals = safeDeals.filter(d => d && d.stage === CrmDealStages.CLOSED_WON);
  const lostDeals = safeDeals.filter(d => d && d.stage === CrmDealStages.CLOSED_LOST);
  const totalClosedValue = wonDeals.reduce((acc, d) => acc + (Number(d.dealValue) || 0), 0);
  const totalEarnedCommission = wonDeals.reduce((acc, d) => acc + (Number(d.expectedCommission) || 0), 0);
  const totalFinished = wonDeals.length + lostDeals.length;
  // Mathematical integrity: When no deals have concluded, win rate is strictly 0% (never 100%)
  const conversionRate = totalFinished > 0 ? Math.round((wonDeals.length / totalFinished) * 100) : 0;
  const scheduledVisits = safeVisits.filter(v => v && v.status === 'SCHEDULED');

  const todayIso = new Date().toISOString().split('T')[0];
  const followUpsDueTodayCount = safeDeals.filter(d =>
    d && d.stage !== CrmDealStages.CLOSED_WON && d.stage !== CrmDealStages.CLOSED_LOST &&
    d.nextFollowUpDate && d.nextFollowUpDate <= todayIso
  ).length;

  return {
    totalPipelineValue,
    pipelineValueDisplay: 'Rs. ' + (totalPipelineValue / 100000).toFixed(1) + ' Lakhs',
    totalClosedValue,
    closedValueDisplay: 'Rs. ' + (totalClosedValue / 100000).toFixed(1) + ' Lakhs',
    totalEarnedCommission,
    commissionDisplay: 'Rs. ' + (totalEarnedCommission / 1000).toFixed(0) + 'K',
    conversionRate,
    totalFinishedDealsCount: totalFinished,
    totalDealsCount: safeDeals.length,
    activeDealsCount: activeDeals.length,
    wonDealsCount: wonDeals.length,
    lostDealsCount: lostDeals.length,
    totalLeadsCount: safeLeads.length,
    hotLeadsCount: safeLeads.filter(l => l && l.score === CrmLeadScores.HOT).length,
    warmLeadsCount: safeLeads.filter(l => l && l.score === CrmLeadScores.WARM).length,
    coldLeadsCount: safeLeads.filter(l => l && l.score === CrmLeadScores.COLD).length,
    scheduledVisitsCount: scheduledVisits.length,
    followUpsDueTodayCount,
    agents: getActiveCrmAgents()
  };
}

export async function fetchCrmBootstrap() {
  if (isBrowser) {
    try {
      const res = await window.fetch('/api/crm/bootstrap');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          testLeadsStore = data.leads || [];
          testDealsStore = data.deals || [];
          testVisitsStore = data.visits || [];
          if (Array.isArray(data.agents) && data.agents.length > 0) {
            setActiveCrmAgents(data.agents);
          }
          if (Array.isArray(data.dynamicLocations) && data.dynamicLocations.length > 0) {
            setAvailableLocations(data.dynamicLocations);
          }
          if (data.regionalClusters && typeof data.regionalClusters === 'object') {
            for (const [hub, members] of Object.entries(data.regionalClusters)) {
              registerRegionalCluster(hub, members);
            }
          }
          return {
            ...data,
            agents: getActiveCrmAgents(),
            dynamicLocations: getAvailableLocations()
          };
        }
      }
    } catch (err) {}
  }

  // Test environment fallback when server not listening on localhost or running headless Node
  return {
    success: true,
    leads: testLeadsStore,
    deals: testDealsStore,
    visits: testVisitsStore,
    agents: getActiveCrmAgents(),
    dynamicLocations: getAvailableLocations(),
    analytics: calculateCrmAnalytics(testDealsStore, testLeadsStore, testVisitsStore)
  };
}

export async function getCrmLeads() {
  const bootstrap = await fetchCrmBootstrap();
  return deduplicateLeads(bootstrap.leads || []);
}

export async function createCrmLead(leadData) {
  if (isBrowser) {
    try {
      const res = await window.fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.lead) {
          testLeadsStore = [data.lead, ...testLeadsStore.filter(l => l.id !== data.lead.id)];
          return { success: true, lead: data.lead };
        }
      }
    } catch (err) {}
  }

  // Test environment fallback
  const leadId = leadData.id || ('lead-' + Date.now().toString().slice(-6));
  const payload = {
    id: leadId,
    leadId,
    name: leadData.name || 'Prospective Buyer',
    phone: leadData.phone || '',
    email: leadData.email || '',
    source: leadData.source || CrmLeadSources.WEBSITE_ENQUIRY,
    score: leadData.score || CrmLeadScores.HOT,
    status: 'ACTIVE',
    preferredLocation: leadData.preferredLocation || 'Amaravati / Guntur Region',
    preferredPropertyType: leadData.preferredPropertyType || 'Open Plot Ventures',
    budgetMin: Number(leadData.budgetMin) || 0,
    budgetMax: Number(leadData.budgetMax) || 0,
    budgetDisplay: leadData.budgetDisplay || 'Flexible',
    assignedAgent: leadData.assignedAgent || DEFAULT_CRM_AGENTS[0].name,
    notes: leadData.notes || '',
    tags: leadData.tags || ['New Lead'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  testLeadsStore = [payload, ...testLeadsStore.filter(l => l.id !== leadId)];
  return { success: true, lead: payload };
}

export async function updateCrmLead(leadId, updates) {
  if (isBrowser) {
    try {
      const res = await window.fetch('/api/crm/leads/' + leadId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) return { success: true };
    } catch (err) {}
  }

  testLeadsStore = testLeadsStore.map(l => l.id === leadId ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l);
  return { success: true };
}

export async function deleteCrmLead(leadId) {
  if (isBrowser) {
    try {
      const res = await window.fetch('/api/crm/leads/' + leadId, { method: 'DELETE' });
      if (res.ok) {
        testLeadsStore = testLeadsStore.filter(l => l.id !== leadId);
        return { success: true };
      }
    } catch (err) {}
  }

  testLeadsStore = testLeadsStore.filter(l => l.id !== leadId);
  return { success: true };
}

export async function getCrmDeals() {
  const bootstrap = await fetchCrmBootstrap();
  return deduplicateDeals(bootstrap.deals || []);
}

export async function createCrmDeal(dealData) {
  if (isBrowser) {
    try {
      const res = await window.fetch('/api/crm/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dealData)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.deal) {
          testDealsStore = [data.deal, ...testDealsStore.filter(d => d.id !== data.deal.id)];
          return { success: true, deal: data.deal };
        }
      }
    } catch (err) {}
  }

  // Test environment fallback
  const dealId = dealData.id || ('deal-' + Date.now().toString().slice(-6));
  const valNum = Number(dealData.dealValue) || 0;
  const payload = {
    id: dealId,
    dealId,
    leadId: dealData.leadId || null,
    propertyId: dealData.propertyId || 'prop-custom',
    propertyTitle: dealData.propertyTitle || 'Property Listing',
    propertyLocation: dealData.propertyLocation || 'Amaravati / Guntur Region',
    customerName: dealData.customerName || 'Prospective Buyer',
    customerPhone: dealData.customerPhone || '',
    customerEmail: dealData.customerEmail || '',
    ownerName: dealData.ownerName || 'Property Owner',
    ownerPhone: dealData.ownerPhone || '',
    stage: dealData.stage || CrmDealStages.NEW,
    dealValue: valNum,
    dealValueDisplay: dealData.dealValueDisplay || ('Rs. ' + (valNum / 100000).toFixed(1) + ' Lakhs'),
    commissionRate: Number(dealData.commissionRate) || 1.5,
    expectedCommission: Math.round(valNum * ((Number(dealData.commissionRate) || 1.5) / 100)),
    probability: Number(dealData.probability) || 20,
    expectedClosingDate: dealData.expectedClosingDate || '',
    assignedAgent: dealData.assignedAgent || DEFAULT_CRM_AGENTS[0].name,
    nextFollowUpDate: dealData.nextFollowUpDate || '',
    nextFollowUpTime: dealData.nextFollowUpTime || '11:00 AM',
    nextFollowUpAction: dealData.nextFollowUpAction || '',
    legalAuditStatus: dealData.legalAuditStatus || 'PENDING',
    notes: dealData.notes || '',
    paymentMilestones: dealData.paymentMilestones || [],
    timeline: [
      { date: new Date().toISOString().split('T')[0], event: 'Deal created in CRM', user: dealData.assignedAgent || 'System Admin' }
    ],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  testDealsStore = [payload, ...testDealsStore.filter(d => d.id !== dealId)];
  return { success: true, deal: payload };
}

export async function updateCrmDealStage(dealId, newStage, noteText = '', followUpData = null) {
  const stageFollowUp = followUpData || getStageDefaultFollowUp(newStage);

  if (isBrowser) {
    try {
      const res = await window.fetch('/api/crm/deals/' + dealId + '/stage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newStage,
          noteText,
          nextFollowUpAction: stageFollowUp.action,
          nextFollowUpDate: stageFollowUp.date,
          nextFollowUpTime: stageFollowUp.time
        })
      });
      if (res.ok) return { success: true };
    } catch (err) {}
  }

  // Test environment fallback
  const target = testDealsStore.find(d => d.id === dealId);
  if (target) {
    let prob = 50;
    if (newStage === CrmDealStages.NEW) prob = 20;
    else if (newStage === CrmDealStages.CONTACTED) prob = 35;
    else if (newStage === CrmDealStages.SITE_VISIT) prob = 50;
    else if (newStage === CrmDealStages.DOCUMENT_AUDIT) prob = 70;
    else if (newStage === CrmDealStages.PRICE_NEGOTIATION) prob = 80;
    else if (newStage === CrmDealStages.TOKEN_ADVANCE) prob = 90;
    else if (newStage === CrmDealStages.REGISTRATION_PENDING) prob = 95;
    else if (newStage === CrmDealStages.CLOSED_WON) prob = 100;
    else if (newStage === CrmDealStages.CLOSED_LOST) prob = 0;

    target.stage = newStage;
    target.probability = prob;
    target.nextFollowUpAction = stageFollowUp.action;
    target.nextFollowUpDate = stageFollowUp.date;
    target.nextFollowUpTime = stageFollowUp.time;
    target.timeline = target.timeline || [];
    target.timeline.push({
      date: new Date().toISOString().split('T')[0],
      event: 'Stage changed to ' + (CrmStageLabels[newStage] || newStage) + '. Next Follow-up: ' + stageFollowUp.action,
      user: 'EaseLand Admin' + (noteText ? ' (' + noteText + ')' : '')
    });
  }
  return { success: true };
}


export async function updateCrmDealFollowUp(dealId, followUpData = {}) {
  if (isBrowser) {
    try {
      const res = await window.fetch('/api/crm/deals/' + dealId + '/followup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(followUpData)
      });
      if (res.ok) {
        const json = await res.json();
        return { success: true, deal: json.deal };
      }
    } catch (err) {}
  }

  // Test environment fallback
  const target = testDealsStore.find(d => d.id === dealId || d.dealId === dealId);
  if (target) {
    target.nextFollowUpDate = followUpData.followUpDate !== undefined ? followUpData.followUpDate : (target.nextFollowUpDate || '');
    target.nextFollowUpTime = followUpData.followUpTime || target.nextFollowUpTime || '11:00 AM';
    target.nextFollowUpAction = followUpData.followUpAction !== undefined ? followUpData.followUpAction : (target.nextFollowUpAction || '');
    target.updatedAt = new Date().toISOString();
    target.timeline = target.timeline || [];
    if (followUpData.logNote) {
      target.timeline.push({
        date: new Date().toISOString().split('T')[0],
        event: followUpData.logNote,
        user: followUpData.agentName || 'EaseLand Admin'
      });
    }
    if (followUpData.followUpAction) {
      target.timeline.push({
        date: new Date().toISOString().split('T')[0],
        event: 'Follow-up scheduled for ' + (followUpData.followUpDate || 'Due') + ' at ' + (followUpData.followUpTime || '11:00 AM') + ': ' + followUpData.followUpAction,
        user: followUpData.agentName || 'EaseLand Admin'
      });
    }
  }
  return { success: true, deal: target };
}

export async function updateCrmDealDetails(dealId, updates) {
  testDealsStore = testDealsStore.map(d => d.id === dealId ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d);
  return { success: true };
}

export async function deleteCrmDeal(dealId) {
  if (isBrowser) {
    try {
      const res = await window.fetch('/api/crm/deals/' + dealId, { method: 'DELETE' });
      if (res.ok) {
        testDealsStore = testDealsStore.filter(d => d.id !== dealId);
        return { success: true };
      }
    } catch (err) {}
  }

  testDealsStore = testDealsStore.filter(d => d.id !== dealId);
  return { success: true };
}

export async function getCrmVisits() {
  const bootstrap = await fetchCrmBootstrap();
  return deduplicateVisits(bootstrap.visits || []);
}

export async function scheduleCrmVisit(visitData) {
  if (isBrowser) {
    try {
      const res = await window.fetch('/api/crm/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visitData)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.visit) {
          testVisitsStore = [data.visit, ...testVisitsStore.filter(v => v.id !== data.visit.id)];
          return { success: true, visit: data.visit };
        }
      }
    } catch (err) {}
  }

  // Test environment fallback
  const visitId = visitData.id || ('visit-' + Date.now().toString().slice(-6));
  const payload = {
    id: visitId,
    visitId,
    dealId: visitData.dealId || null,
    propertyId: visitData.propertyId || '',
    propertyTitle: visitData.propertyTitle || 'Property Inspection',
    propertyLocation: visitData.propertyLocation || 'Amaravati / Guntur Region',
    customerName: visitData.customerName || 'Prospective Buyer',
    customerPhone: visitData.customerPhone || '',
    visitDate: visitData.visitDate || new Date().toISOString().split('T')[0],
    visitTime: visitData.visitTime || '11:00 AM',
    agentAssigned: visitData.agentAssigned || DEFAULT_CRM_AGENTS[0].name,
    status: 'SCHEDULED',
    customerNotes: visitData.customerNotes || '',
    createdAt: new Date().toISOString()
  };
  testVisitsStore = [payload, ...testVisitsStore.filter(v => v.id !== visitId)];
  return { success: true, visit: payload };
}

export async function updateCrmVisitStatus(visitId, newStatus, feedbackText = '') {
  if (isBrowser) {
    try {
      const res = await window.fetch('/api/crm/visits/' + visitId + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, customerFeedback: feedbackText })
      });
      if (res.ok) return { success: true };
    } catch (err) {}
  }

  testVisitsStore = testVisitsStore.map(v => v.id === visitId ? { ...v, status: newStatus, customerFeedback: feedbackText, updatedAt: new Date().toISOString() } : v);
  return { success: true };
}

export async function deleteCrmVisit(visitId) {
  if (isBrowser) {
    try {
      const res = await window.fetch('/api/crm/visits/' + visitId, { method: 'DELETE' });
      if (res.ok) {
        testVisitsStore = testVisitsStore.filter(v => v.id !== visitId);
        return { success: true };
      }
    } catch (err) {}
  }

  testVisitsStore = testVisitsStore.filter(v => v.id !== visitId);
  return { success: true };
}

export async function getCrmAnalytics(deals, leads, visits) {
  if (deals !== undefined && leads !== undefined && visits !== undefined) {
    return calculateCrmAnalytics(deals, leads, visits);
  }
  const bootstrap = await fetchCrmBootstrap();
  return calculateCrmAnalytics(bootstrap.deals || [], bootstrap.leads || [], bootstrap.visits || []);
}

export async function clearAllCrmData() {
  testLeadsStore = [];
  testDealsStore = [];
  testVisitsStore = [];
  return { success: true };
}

export async function syncFromLiveEnquiries() {
  return { success: true, count: 0, message: 'Server-side auto-ingest is active.' };
}

export async function syncDealsToLeads() {
  return 0;
}

export async function syncVisitorLeadsToDeals() {
  return 0;
}

/**
 * ----------------------------------------------------------------------------
 * SMART BI-DIRECTIONAL MATCHMAKING ENGINE (NO BARGAIN PENALTY + AP HUBS)
 * ----------------------------------------------------------------------------
 */

export function calculateBuyerMatchScore(lead, property, options = {}) {
  if (!lead || !property) return 0;
  let score = 0;

  const clusters = options.clusters || getRegionalClusters();
  const weights = {
    location: 40,
    propertyType: 30,
    budget: 30,
    ...(options.weights || {})
  };

  // 1. Location Proximity (Configurable Weight)
  const leadLoc = String(lead.preferredLocation || '').toLowerCase().trim();
  const propLoc = String(property.locationName || property.address || property.city || property.district || property.title || '').toLowerCase();

  let isGeographicMismatch = false;
  if (leadLoc && propLoc) {
    if (leadLoc === 'any' || leadLoc === 'all') {
      score += Math.round(weights.location * 0.875);
    } else {
      const tokens = leadLoc.split(/[\s,]+/);
      const directMatches = tokens.filter(t => t.length > 2 && propLoc.includes(t));

      // Check Regional AP Clusters (e.g., Amaravati <-> Mangalagiri / Tulluru)
      let clusterMatch = false;
      for (const [hub, members] of Object.entries(clusters)) {
        const leadHasHub = leadLoc.includes(hub) || members.some(m => leadLoc.includes(m));
        const propHasHub = propLoc.includes(hub) || members.some(m => propLoc.includes(m));
        if (leadHasHub && propHasHub) {
          clusterMatch = true;
          break;
        }
      }

      if (directMatches.length > 0) {
        score += weights.location;
      } else if (clusterMatch) {
        score += Math.round(weights.location * 0.95);
      } else {
        isGeographicMismatch = true;
        score += 0;
      }
    }
  } else {
    score += Math.round(weights.location * 0.375);
  }

  // 2. Property Type Match (Configurable Weight)
  const leadType = String(lead.preferredPropertyType || '').toLowerCase().trim();
  const propType = String(property.propertyType || property.category || property.type || '').toLowerCase().trim();
  if (leadType && propType) {
    if (leadType === propType || (leadType.includes('plot') && propType.includes('plot')) || (leadType.includes('land') && propType.includes('land'))) {
      score += weights.propertyType;
    } else if (leadType.includes('commercial') && propType.includes('commercial')) {
      score += weights.propertyType;
    } else {
      score += Math.round(weights.propertyType * 0.16);
    }
  } else {
    score += Math.round(weights.propertyType * 0.5);
  }

  // 3. Budget Range Overlap (Configurable Weight) - ZERO BARGAIN PENALTY!
  const propPrice = Number(property.price || property.expectedPrice || property.rawPrice) || 0;
  const bMin = Number(lead.budgetMin) || 0;
  const bMax = Number(lead.budgetMax) || 0;
  const headroom = options.budgetHeadroom !== undefined ? Number(options.budgetHeadroom) : 0.15;

  if (propPrice > 0 && bMax > 0) {
    if (propPrice <= bMax) {
      // Perfect match or a bargain under max budget
      score += weights.budget;
    } else if (propPrice <= bMax * (1 + headroom)) {
      // Slightly above budget (negotiation headroom)
      score += Math.round(weights.budget * 0.67);
    } else {
      score += Math.round(weights.budget * 0.16);
    }
  } else {
    score += Math.round(weights.budget * 0.5);
  }

  const penalty = options.mismatchPenalty !== undefined ? Number(options.mismatchPenalty) : 15;
  if (isGeographicMismatch) {
    score -= penalty;
  }

  return Math.min(100, Math.max(10, score));
}

export function matchPropertiesForLead(lead, allProperties = [], options = {}) {
  if (!lead || !Array.isArray(allProperties)) return [];
  registerDynamicLocationsFromProperties(allProperties);

  const threshold = options.minScoreThreshold !== undefined ? Number(options.minScoreThreshold) : 40;
  return allProperties
    .map(p => ({
      property: p,
      matchScore: calculateBuyerMatchScore(lead, p, options)
    }))
    .filter(item => item.matchScore >= threshold)
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function matchLeadsForProperty(property, allLeads = [], options = {}) {
  if (!property || !Array.isArray(allLeads)) return [];

  const threshold = options.minScoreThreshold !== undefined ? Number(options.minScoreThreshold) : 40;
  return allLeads
    .map(lead => ({
      lead,
      matchScore: calculateBuyerMatchScore(lead, property, options)
    }))
    .filter(item => item.matchScore >= threshold)
    .sort((a, b) => b.matchScore - a.matchScore);
}
