import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
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

export const DEFAULT_CRM_AGENTS = [
  { id: 'agent-1', name: 'EaseLand Admin', role: 'Principal Broker / Administrator', email: 'admin@easeland.in', phone: '+91 98765 00000' }
];

const memoryCache = new Map();

// Helper for local storage and memory fallback persistence
const getStored = (key, fallback) => {
  try {
    if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(key);
      if (item) return JSON.parse(item);
    }
  } catch (e) {}
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }
  return fallback;
};

const setStored = (key, data) => {
  memoryCache.set(key, data);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-crm-storage-updated', { detail: { key } }));
    }
  } catch (e) {}
};

// Known dummy / mock identifiers to purge permanently
const DUMMY_IDS = new Set([
  'lead-101', 'lead-102', 'lead-103', 'lead-104', 'lead-105',
  'deal-201', 'deal-202', 'deal-203', 'deal-204',
  'visit-301', 'visit-302'
]);

const DUMMY_NAMES = new Set([
  'Dr. Vikram Chandra', 'K. Subba Rao', 'Meera Nambiar', 'Rajesh Goud', 'P. Venkatagiri'
]);

export function filterOutDummyItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => {
    if (!item) return false;
    if (DUMMY_IDS.has(item.id) || DUMMY_IDS.has(item.dealId) || DUMMY_IDS.has(item.leadId)) return false;
    if (DUMMY_NAMES.has(item.name) || DUMMY_NAMES.has(item.customerName)) return false;
    return true;
  });
}

// EaseLand Live Production Datasets — ZERO DUMMY DATA
export const INITIAL_CRM_LEADS = [];
export const INITIAL_CRM_DEALS = [];
export const INITIAL_CRM_VISITS = [];

/**
 * ---------------------------------------------------------------
 * CRM LEADS SERVICE
 * ---------------------------------------------------------------
 */

export async function getCrmLeads() {
  let leads = [];
  try {
    const qSnap = await getDocs(collection(db, 'crm_leads'));
    if (!qSnap.empty) {
      qSnap.forEach(d => leads.push({ id: d.id, ...d.data() }));
    }
  } catch (e) {
    // fallback to local storage
  }

  if (leads.length === 0) {
    leads = getStored('easeland_crm_leads', INITIAL_CRM_LEADS);
  }

  // Purge any residual dummy data
  leads = filterOutDummyItems(leads);
  setStored('easeland_crm_leads', leads);

  return leads;
}

/**
 * Sync real platform buyer enquiries into CRM Leads
 */
export async function syncFromLiveEnquiries() {
  let realEnquiries = [];
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('easeland_enquiries');
      if (stored) {
        realEnquiries = JSON.parse(stored);
      }
    }
  } catch (e) {}

  if (!Array.isArray(realEnquiries) || realEnquiries.length === 0) {
    return { success: true, count: 0, message: 'No new platform inquiries found.' };
  }

  const existingLeads = await getCrmLeads();
  const existingPhones = new Set(existingLeads.map(l => l.phone).filter(Boolean));
  const existingEmails = new Set(existingLeads.map(l => l.email).filter(Boolean));

  let syncedCount = 0;
  for (const enq of realEnquiries) {
    const phone = enq.customerPhone || enq.phone || '';
    const email = enq.customerEmail || enq.email || '';
    const name = enq.customerName || enq.buyerName || enq.name || 'Platform Buyer';

    // Skip if already in leads
    if ((phone && existingPhones.has(phone)) || (email && existingEmails.has(email))) {
      continue;
    }

    const leadData = {
      name,
      phone,
      email,
      source: CrmLeadSources.WEBSITE_ENQUIRY,
      score: CrmLeadScores.HOT,
      preferredPropertyType: enq.propertyType || 'Open Plots',
      preferredLocation: enq.location || enq.propertyLocation || 'Amaravati / Guntur',
      budgetMax: Number(enq.budget || enq.price) || 0,
      notes: 'Inquired on property: ' + (enq.propertyTitle || 'Listing') + ' (' + (enq.message || 'Direct buyer inquiry') + ')',
      assignedAgent: DEFAULT_CRM_AGENTS[0].name
    };

    await createCrmLead(leadData);
    if (phone) existingPhones.add(phone);
    if (email) existingEmails.add(email);
    syncedCount++;
  }

  return { success: true, count: syncedCount, message: 'Synced ' + syncedCount + ' real platform inquiries into CRM.' };
}

export async function clearAllCrmData() {
  setStored('easeland_crm_leads', []);
  setStored('easeland_crm_deals', []);
  setStored('easeland_crm_visits', []);
  return { success: true };
}

export async function createCrmLead(leadData) {
  const leadId = 'lead-' + Date.now().toString().slice(-6);
  const nowIso = new Date().toISOString();
  const payload = {
    id: leadId,
    name: leadData.name || 'Prospective Buyer',
    phone: leadData.phone || '',
    email: leadData.email || '',
    source: leadData.source || CrmLeadSources.WEBSITE_ENQUIRY,
    score: leadData.score || CrmLeadScores.WARM,
    status: 'ACTIVE',
    preferredLocation: leadData.preferredLocation || 'Any',
    preferredPropertyType: leadData.preferredPropertyType || 'Open Plots',
    budgetMin: Number(leadData.budgetMin) || 0,
    budgetMax: Number(leadData.budgetMax) || 0,
    budgetDisplay: leadData.budgetDisplay || (leadData.budgetMax ? 'Up to Rs. ' + (leadData.budgetMax / 100000).toFixed(1) + ' Lakhs' : 'Flexible'),
    assignedAgent: leadData.assignedAgent || DEFAULT_CRM_AGENTS[0].name,
    notes: leadData.notes || '',
    tags: Array.isArray(leadData.tags) ? leadData.tags : ['New Lead'],
    createdAt: nowIso,
    updatedAt: nowIso
  };

  try {
    await setDoc(doc(db, 'crm_leads', leadId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (e) {}

  const current = getStored('easeland_crm_leads', INITIAL_CRM_LEADS);
  const updated = [payload, ...current.filter(l => l.id !== leadId)];
  setStored('easeland_crm_leads', updated);

  return { success: true, lead: payload };
}

export async function updateCrmLead(leadId, updates) {
  const nowIso = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'crm_leads', leadId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (e) {}

  const current = getStored('easeland_crm_leads', INITIAL_CRM_LEADS);
  const updated = current.map(l => (l.id === leadId ? { ...l, ...updates, updatedAt: nowIso } : l));
  setStored('easeland_crm_leads', updated);

  return { success: true };
}

export async function deleteCrmLead(leadId) {
  try {
    await deleteDoc(doc(db, 'crm_leads', leadId));
  } catch (e) {}

  const current = getStored('easeland_crm_leads', INITIAL_CRM_LEADS);
  const updated = current.filter(l => l.id !== leadId);
  setStored('easeland_crm_leads', updated);

  return { success: true };
}

/**
 * ---------------------------------------------------------------
 * CRM DEALS & PIPELINE SERVICE
 * ---------------------------------------------------------------
 */

export async function getCrmDeals() {
  let deals = [];
  try {
    const qSnap = await getDocs(collection(db, 'crm_deals'));
    if (!qSnap.empty) {
      qSnap.forEach(d => deals.push({ id: d.id, ...d.data() }));
    }
  } catch (e) {}

  if (deals.length === 0) {
    deals = getStored('easeland_crm_deals', INITIAL_CRM_DEALS);
  }

  // Purge any residual dummy data
  deals = filterOutDummyItems(deals);
  setStored('easeland_crm_deals', deals);

  return deals;
}

export async function createCrmDeal(dealData) {
  const dealId = 'deal-' + Date.now().toString().slice(-6);
  const nowIso = new Date().toISOString();
  const valNum = Number(dealData.dealValue) || 0;
  const commRate = Number(dealData.commissionRate) || 1.5;
  const expComm = Math.round(valNum * (commRate / 100));

  const payload = {
    id: dealId,
    leadId: dealData.leadId || null,
    customerName: dealData.customerName || 'Prospective Buyer',
    customerPhone: dealData.customerPhone || '',
    customerEmail: dealData.customerEmail || '',
    propertyId: dealData.propertyId || 'prop-custom',
    propertyTitle: dealData.propertyTitle || 'Property Listing',
    propertyLocation: dealData.propertyLocation || 'Guntur / Amaravati Region',
    ownerName: dealData.ownerName || 'Property Owner',
    ownerPhone: dealData.ownerPhone || '',
    stage: dealData.stage || CrmDealStages.NEW,
    dealValue: valNum,
    dealValueDisplay: dealData.dealValueDisplay || ('Rs. ' + (valNum / 100000).toFixed(1) + ' Lakhs'),
    expectedClosingDate: dealData.expectedClosingDate || '',
    probability: Number(dealData.probability) || 50,
    commissionRate: commRate,
    expectedCommission: expComm,
    assignedAgent: dealData.assignedAgent || DEFAULT_CRM_AGENTS[0].name,
    legalAuditStatus: dealData.legalAuditStatus || 'PENDING',
    notes: dealData.notes || '',
    paymentMilestones: Array.isArray(dealData.paymentMilestones) ? dealData.paymentMilestones : [],
    timeline: [
      { date: nowIso.split('T')[0], event: 'Deal created in CRM', user: dealData.assignedAgent || 'System Admin' }
    ],
    createdAt: nowIso,
    updatedAt: nowIso
  };

  try {
    await setDoc(doc(db, 'crm_deals', dealId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (e) {}

  const current = getStored('easeland_crm_deals', INITIAL_CRM_DEALS);
  const updated = [payload, ...current.filter(d => d.id !== dealId)];
  setStored('easeland_crm_deals', updated);

  return { success: true, deal: payload };
}

export async function updateCrmDealStage(dealId, newStage, noteText = '') {
  const nowIso = new Date().toISOString();
  const current = getStored('easeland_crm_deals', INITIAL_CRM_DEALS);
  const target = current.find(d => d.id === dealId);

  let newProbability = 50;
  if (newStage === CrmDealStages.NEW) newProbability = 20;
  if (newStage === CrmDealStages.CONTACTED) newProbability = 35;
  if (newStage === CrmDealStages.SITE_VISIT) newProbability = 50;
  if (newStage === CrmDealStages.DOCUMENT_AUDIT) newProbability = 70;
  if (newStage === CrmDealStages.PRICE_NEGOTIATION) newProbability = 80;
  if (newStage === CrmDealStages.TOKEN_ADVANCE) newProbability = 90;
  if (newStage === CrmDealStages.REGISTRATION_PENDING) newProbability = 95;
  if (newStage === CrmDealStages.CLOSED_WON) newProbability = 100;
  if (newStage === CrmDealStages.CLOSED_LOST) newProbability = 0;

  const timelineEntry = {
    date: nowIso.split('T')[0],
    event: 'Stage changed to ' + (CrmStageLabels[newStage] || newStage),
    user: 'EaseLand Broker Admin' + (noteText ? ' (' + noteText + ')' : '')
  };

  const updatedTimeline = target ? [...(target.timeline || []), timelineEntry] : [timelineEntry];

  const patch = {
    stage: newStage,
    probability: newProbability,
    updatedAt: nowIso,
    timeline: updatedTimeline
  };
  if (noteText) {
    patch.notes = target?.notes ? (target.notes + ' | ' + noteText) : noteText;
  }

  try {
    await updateDoc(doc(db, 'crm_deals', dealId), {
      ...patch,
      updatedAt: serverTimestamp()
    });
  } catch (e) {}

  const updated = current.map(d => (d.id === dealId ? { ...d, ...patch } : d));
  setStored('easeland_crm_deals', updated);

  return { success: true };
}

export async function updateCrmDealDetails(dealId, updates) {
  const nowIso = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'crm_deals', dealId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (e) {}

  const current = getStored('easeland_crm_deals', INITIAL_CRM_DEALS);
  const updated = current.map(d => (d.id === dealId ? { ...d, ...updates, updatedAt: nowIso } : d));
  setStored('easeland_crm_deals', updated);

  return { success: true };
}

export async function deleteCrmDeal(dealId) {
  try {
    await deleteDoc(doc(db, 'crm_deals', dealId));
  } catch (e) {}

  const current = getStored('easeland_crm_deals', INITIAL_CRM_DEALS);
  const updated = current.filter(d => d.id !== dealId);
  setStored('easeland_crm_deals', updated);

  return { success: true };
}

/**
 * ---------------------------------------------------------------
 * SITE VISITS & FIELD DISPATCHER SERVICE
 * ---------------------------------------------------------------
 */

export async function getCrmVisits() {
  let visits = [];
  try {
    const qSnap = await getDocs(collection(db, 'crm_visits'));
    if (!qSnap.empty) {
      qSnap.forEach(d => visits.push({ id: d.id, ...d.data() }));
    }
  } catch (e) {}

  if (visits.length === 0) {
    visits = getStored('easeland_crm_visits', INITIAL_CRM_VISITS);
  }

  // Purge any residual dummy data
  visits = filterOutDummyItems(visits);
  setStored('easeland_crm_visits', visits);

  return visits;
}

export async function scheduleCrmVisit(visitData) {
  const visitId = 'visit-' + Date.now().toString().slice(-6);
  const nowIso = new Date().toISOString();
  const payload = {
    id: visitId,
    dealId: visitData.dealId || null,
    propertyId: visitData.propertyId || '',
    propertyTitle: visitData.propertyTitle || 'Property Inspection',
    propertyLocation: visitData.propertyLocation || 'Guntur / Amaravati Region',
    customerName: visitData.customerName || 'Prospective Buyer',
    customerPhone: visitData.customerPhone || '',
    visitDate: visitData.visitDate || nowIso.split('T')[0],
    visitTime: visitData.visitTime || '11:00 AM',
    agentAssigned: visitData.agentAssigned || DEFAULT_CRM_AGENTS[0]?.name || 'EaseLand Admin',
    status: 'SCHEDULED',
    customerNotes: visitData.customerNotes || '',
    createdAt: nowIso
  };

  try {
    await setDoc(doc(db, 'crm_visits', visitId), {
      ...payload,
      createdAt: serverTimestamp()
    });
  } catch (e) {}

  const current = getStored('easeland_crm_visits', INITIAL_CRM_VISITS);
  const updated = [payload, ...current.filter(v => v.id !== visitId)];
  setStored('easeland_crm_visits', updated);

  // If tied to deal, advance deal to SITE_VISIT stage if still in NEW / CONTACTED
  if (visitData.dealId) {
    const deals = getStored('easeland_crm_deals', INITIAL_CRM_DEALS);
    const linkedDeal = deals.find(d => d.id === visitData.dealId);
    if (linkedDeal && (linkedDeal.stage === CrmDealStages.NEW || linkedDeal.stage === CrmDealStages.CONTACTED)) {
      await updateCrmDealStage(linkedDeal.id, CrmDealStages.SITE_VISIT, 'Site visit scheduled for ' + payload.visitDate + ' at ' + payload.visitTime);
    }
  }

  return { success: true, visit: payload };
}

export async function updateCrmVisitStatus(visitId, newStatus, feedbackText = '') {
  const current = getStored('easeland_crm_visits', INITIAL_CRM_VISITS);
  const target = current.find(v => v.id === visitId);
  const patch = {
    status: newStatus,
    updatedAt: new Date().toISOString()
  };
  if (feedbackText) {
    patch.customerFeedback = feedbackText;
  }

  try {
    await updateDoc(doc(db, 'crm_visits', visitId), {
      ...patch,
      updatedAt: serverTimestamp()
    });
  } catch (e) {}

  const updated = current.map(v => (v.id === visitId ? { ...v, ...patch } : v));
  setStored('easeland_crm_visits', updated);

  return { success: true };
}

/**
 * ---------------------------------------------------------------
 * SMART BUYER-PROPERTY MATCHMAKING ENGINE
 * ---------------------------------------------------------------
 */

export function calculateBuyerMatchScore(lead, property) {
  if (!lead || !property) return 0;
  let score = 0;

  // 1. Location Proximity (Weight: 40 points)
  const leadLoc = String(lead.preferredLocation || '').toLowerCase().trim();
  const propLoc = String(property.locationName || property.address || property.city || property.district || property.title || '').toLowerCase();
  
  if (leadLoc && propLoc) {
    if (leadLoc === 'any' || leadLoc === 'all') {
      score += 35;
    } else {
      const tokens = leadLoc.split(/[\s,]+/);
      const matches = tokens.filter(t => t.length > 2 && propLoc.includes(t));
      if (matches.length > 0) {
        score += 40;
      } else {
        score += 10;
      }
    }
  } else {
    score += 20;
  }

  // 2. Property Type Match (Weight: 30 points)
  const leadType = String(lead.preferredPropertyType || '').toLowerCase().trim();
  const propType = String(property.propertyType || property.category || property.type || '').toLowerCase().trim();
  if (leadType && propType) {
    if (leadType === propType || (leadType.includes('plot') && propType.includes('plot')) || (leadType.includes('land') && propType.includes('land'))) {
      score += 30;
    } else if (leadType.includes('commercial') && propType.includes('commercial')) {
      score += 30;
    } else {
      score += 5;
    }
  } else {
    score += 15;
  }

  // 3. Budget Range Overlap (Weight: 30 points)
  const propPrice = Number(property.price || property.expectedPrice || property.rawPrice) || 0;
  const bMin = Number(lead.budgetMin) || 0;
  const bMax = Number(lead.budgetMax) || 0;

  if (propPrice > 0 && bMax > 0) {
    if (propPrice >= bMin && propPrice <= bMax) {
      score += 30;
    } else if (propPrice <= bMax * 1.15 && propPrice >= bMin * 0.85) {
      score += 20;
    } else {
      score += 5;
    }
  } else {
    score += 15;
  }

  return Math.min(100, Math.max(10, score));
}

export function matchPropertiesForLead(lead, allProperties = []) {
  if (!lead || !Array.isArray(allProperties)) return [];

  const matched = allProperties
    .map(p => ({
      property: p,
      matchScore: calculateBuyerMatchScore(lead, p)
    }))
    .filter(item => item.matchScore >= 40)
    .sort((a, b) => b.matchScore - a.matchScore);

  return matched;
}

export function matchLeadsForProperty(property, allLeads = []) {
  if (!property || !Array.isArray(allLeads)) return [];

  const matched = allLeads
    .map(lead => ({
      lead,
      matchScore: calculateBuyerMatchScore(lead, property)
    }))
    .filter(item => item.matchScore >= 40)
    .sort((a, b) => b.matchScore - a.matchScore);

  return matched;
}

/**
 * ---------------------------------------------------------------
 * CRM EXECUTIVE ANALYTICS ENGINE
 * ---------------------------------------------------------------
 */

export async function getCrmAnalytics() {
  const [deals, leads, visits] = await Promise.all([
    getCrmDeals(),
    getCrmLeads(),
    getCrmVisits()
  ]);

  const activeDeals = deals.filter(d => d.stage !== CrmDealStages.CLOSED_WON && d.stage !== CrmDealStages.CLOSED_LOST);
  const totalPipelineValue = activeDeals.reduce((acc, d) => acc + (Number(d.dealValue) || 0), 0);

  const wonDeals = deals.filter(d => d.stage === CrmDealStages.CLOSED_WON);
  const totalClosedValue = wonDeals.reduce((acc, d) => acc + (Number(d.dealValue) || 0), 0);
  const totalEarnedCommission = wonDeals.reduce((acc, d) => acc + (Number(d.expectedCommission) || 0), 0);

  const totalCompletedDeals = wonDeals.length + deals.filter(d => d.stage === CrmDealStages.CLOSED_LOST).length;
  const conversionRate = totalCompletedDeals > 0 ? Math.round((wonDeals.length / totalCompletedDeals) * 100) : 100;

  const hotLeads = leads.filter(l => l.score === CrmLeadScores.HOT).length;
  const warmLeads = leads.filter(l => l.score === CrmLeadScores.WARM).length;
  const coldLeads = leads.filter(l => l.score === CrmLeadScores.COLD).length;

  const scheduledVisits = visits.filter(v => v.status === 'SCHEDULED');

  return {
    totalPipelineValue,
    pipelineValueDisplay: 'Rs. ' + (totalPipelineValue / 100000).toFixed(1) + ' Lakhs',
    totalClosedValue,
    closedValueDisplay: 'Rs. ' + (totalClosedValue / 100000).toFixed(1) + ' Lakhs',
    totalEarnedCommission,
    commissionDisplay: 'Rs. ' + (totalEarnedCommission / 1000).toFixed(0) + 'K',
    conversionRate,
    totalDealsCount: deals.length,
    activeDealsCount: activeDeals.length,
    wonDealsCount: wonDeals.length,
    totalLeadsCount: leads.length,
    hotLeadsCount: hotLeads,
    warmLeadsCount: warmLeads,
    coldLeadsCount: coldLeads,
    scheduledVisitsCount: scheduledVisits.length,
    agents: DEFAULT_CRM_AGENTS
  };
}
