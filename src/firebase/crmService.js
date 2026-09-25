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
  { id: 'agent-1', name: 'Scarlett (Senior Portfolio Lead)', role: 'Lead Broker', email: 'scarlett@easeland.in', phone: '+91 98765 11001' },
  { id: 'agent-2', name: 'Rohan Verma (Land Title Specialist)', role: 'Legal Auditor', email: 'rohan.v@easeland.in', phone: '+91 98765 11002' },
  { id: 'agent-3', name: 'Deepak Reddy (Capital Region Field Rep)', role: 'Field Specialist', email: 'deepak.r@easeland.in', phone: '+91 98765 11003' },
  { id: 'agent-4', name: 'Ananya Sharma (Customer Success)', role: 'Client Executive', email: 'ananya.s@easeland.in', phone: '+91 98765 11004' }
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

// Initial Seed Dataset for live interactive experience if database is empty
const INITIAL_CRM_LEADS = [
  {
    id: 'lead-101',
    name: 'Dr. Vikram Chandra',
    phone: '+91 98450 23114',
    email: 'vikram.chandra@medicocare.in',
    source: CrmLeadSources.WEBSITE_ENQUIRY,
    score: CrmLeadScores.HOT,
    status: 'ACTIVE',
    preferredLocation: 'Amaravati Capital Region',
    preferredPropertyType: 'Commercial Land',
    budgetMin: 5000000,
    budgetMax: 9000000,
    budgetDisplay: 'Rs. 50L - 90L',
    assignedAgent: 'Scarlett (Senior Portfolio Lead)',
    notes: 'Urgent requirement for diagnostic center setup along 150ft bypass highway.',
    tags: ['Ready Funds', 'High Value', 'Doctor'],
    createdAt: '2026-09-10T10:30:00Z',
    updatedAt: '2026-09-24T14:15:00Z'
  },
  {
    id: 'lead-102',
    name: 'K. Subba Rao',
    phone: '+91 97012 88452',
    email: 'subbarao.k@infraventure.com',
    source: CrmLeadSources.WHATSAPP,
    score: CrmLeadScores.HOT,
    status: 'ACTIVE',
    preferredLocation: 'Guntur Brodipet / Ring Road',
    preferredPropertyType: 'Open Plots',
    budgetMin: 3000000,
    budgetMax: 5000000,
    budgetDisplay: 'Rs. 30L - 50L',
    assignedAgent: 'Deepak Reddy (Capital Region Field Rep)',
    notes: 'Looking for 300-400 sq yards east-facing plot for immediate luxury villa construction.',
    tags: ['East Facing', 'Immediate Token'],
    createdAt: '2026-09-12T11:00:00Z',
    updatedAt: '2026-09-25T09:30:00Z'
  },
  {
    id: 'lead-103',
    name: 'Meera Nambiar',
    phone: '+91 94460 77123',
    email: 'meera.nambiar@techsol.com',
    source: CrmLeadSources.PHONE_CALL,
    score: CrmLeadScores.WARM,
    status: 'ACTIVE',
    preferredLocation: 'Vijayawada Highway',
    preferredPropertyType: 'Agricultural Land',
    budgetMin: 2000000,
    budgetMax: 3500000,
    budgetDisplay: 'Rs. 20L - 35L',
    assignedAgent: 'Rohan Verma (Land Title Specialist)',
    notes: 'Seeking 1-2 acres farmland near canal irrigation for weekend organic farming venture.',
    tags: ['Water Source', 'Investor'],
    createdAt: '2026-09-15T15:45:00Z',
    updatedAt: '2026-09-24T18:00:00Z'
  },
  {
    id: 'lead-104',
    name: 'Rajesh Goud',
    phone: '+91 91210 44332',
    email: 'rajesh.goud99@gmail.com',
    source: CrmLeadSources.SITE_VISIT,
    score: CrmLeadScores.COLD,
    status: 'ACTIVE',
    preferredLocation: 'Guntur Central',
    preferredPropertyType: 'Apartments',
    budgetMin: 4000000,
    budgetMax: 6000000,
    budgetDisplay: 'Rs. 40L - 60L',
    assignedAgent: 'Ananya Sharma (Customer Success)',
    notes: 'Exploring 3BHK gated community units; bank pre-approval pending.',
    tags: ['Home Loan', 'First Time Buyer'],
    createdAt: '2026-09-18T16:20:00Z',
    updatedAt: '2026-09-23T11:10:00Z'
  }
];

const INITIAL_CRM_DEALS = [
  {
    id: 'deal-201',
    leadId: 'lead-101',
    customerName: 'Dr. Vikram Chandra',
    customerPhone: '+91 98450 23114',
    customerEmail: 'vikram.chandra@medicocare.in',
    propertyId: 'prop-amaravati-01',
    propertyTitle: 'Commercial Highway Plot (350 Sq. Yards)',
    propertyLocation: 'Amaravati Capital Region, Core Sector 4',
    ownerName: 'M. Venkat Ramana',
    ownerPhone: '+91 99887 66554',
    stage: CrmDealStages.DOCUMENT_AUDIT,
    dealValue: 7500000,
    dealValueDisplay: 'Rs. 75.0 Lakhs',
    expectedClosingDate: '2026-10-15',
    probability: 80,
    commissionRate: 1.5,
    expectedCommission: 112500,
    assignedAgent: 'Scarlett (Senior Portfolio Lead)',
    legalAuditStatus: 'VERIFIED_CLEAR',
    notes: 'Legal encumbrance verified 30 years clear. Sub-registrar fee calculations shared with buyer.',
    paymentMilestones: [
      { name: 'Token Advance', amount: 500000, status: 'PAID', date: '2026-09-18' },
      { name: 'Agreement on Sale', amount: 2000000, status: 'PENDING', date: '2026-09-30' },
      { name: 'Final Registration', amount: 5000000, status: 'PENDING', date: '2026-10-15' }
    ],
    timeline: [
      { date: '2026-09-10', event: 'Inquiry Created', user: 'Dr. Vikram Chandra' },
      { date: '2026-09-14', event: 'Site Inspection Conducted', user: 'Deepak Reddy' },
      { date: '2026-09-18', event: 'Token Advance Deposited', user: 'Scarlett' },
      { date: '2026-09-22', event: '30-Year Encumbrance Audit Completed', user: 'Rohan Verma' }
    ],
    createdAt: '2026-09-10T10:30:00Z',
    updatedAt: '2026-09-24T14:15:00Z'
  },
  {
    id: 'deal-202',
    leadId: 'lead-102',
    customerName: 'K. Subba Rao',
    customerPhone: '+91 97012 88452',
    customerEmail: 'subbarao.k@infraventure.com',
    propertyId: 'prop-guntur-02',
    propertyTitle: 'East-Facing Premium Villa Plot (267 Sq. Yards)',
    propertyLocation: 'Brodipet 4th Line, Guntur',
    ownerName: 'V. Lakshmi Narayana',
    ownerPhone: '+91 98480 33441',
    stage: CrmDealStages.PRICE_NEGOTIATION,
    dealValue: 4200000,
    dealValueDisplay: 'Rs. 42.0 Lakhs',
    expectedClosingDate: '2026-10-05',
    probability: 65,
    commissionRate: 1.5,
    expectedCommission: 63000,
    assignedAgent: 'Deepak Reddy (Capital Region Field Rep)',
    legalAuditStatus: 'IN_PROGRESS',
    notes: 'Buyer offered Rs. 40 Lakhs. Seller quoted Rs. 43.5 Lakhs. Bridging the difference at Rs. 42 Lakhs.',
    paymentMilestones: [
      { name: 'Token Advance', amount: 250000, status: 'PENDING', date: '2026-10-01' }
    ],
    timeline: [
      { date: '2026-09-12', event: 'WhatsApp Lead Captured', user: 'K. Subba Rao' },
      { date: '2026-09-16', event: 'Site Visit Completed', user: 'Deepak Reddy' },
      { date: '2026-09-21', event: 'Offer Submitted to Owner', user: 'Deepak Reddy' }
    ],
    createdAt: '2026-09-12T11:00:00Z',
    updatedAt: '2026-09-25T09:30:00Z'
  },
  {
    id: 'deal-203',
    leadId: 'lead-103',
    customerName: 'Meera Nambiar',
    customerPhone: '+91 94460 77123',
    customerEmail: 'meera.nambiar@techsol.com',
    propertyId: 'prop-krishna-03',
    propertyTitle: 'Irrigated Agro Land (1.25 Acres Canal Frontage)',
    propertyLocation: 'Vijayawada-Guntur Express Corridor',
    ownerName: 'Ch. Satyanarayana',
    ownerPhone: '+91 97000 11223',
    stage: CrmDealStages.SITE_VISIT,
    dealValue: 2800000,
    dealValueDisplay: 'Rs. 28.0 Lakhs',
    expectedClosingDate: '2026-10-25',
    probability: 45,
    commissionRate: 2.0,
    expectedCommission: 56000,
    assignedAgent: 'Rohan Verma (Land Title Specialist)',
    legalAuditStatus: 'PENDING',
    notes: 'Physical site visit scheduled for this Saturday morning with survey engineer.',
    paymentMilestones: [],
    timeline: [
      { date: '2026-09-15', event: 'Inbound Inquiry', user: 'Meera Nambiar' },
      { date: '2026-09-20', event: 'Discovery Consultation Completed', user: 'Rohan Verma' },
      { date: '2026-09-24', event: 'Weekend Visit Scheduled', user: 'Rohan Verma' }
    ],
    createdAt: '2026-09-15T15:45:00Z',
    updatedAt: '2026-09-24T18:00:00Z'
  },
  {
    id: 'deal-204',
    leadId: 'lead-105',
    customerName: 'P. Venkatagiri',
    customerPhone: '+91 98888 12345',
    customerEmail: 'venkatagiri.p@gmail.com',
    propertyId: 'prop-closed-01',
    propertyTitle: 'Residential Plot (200 Sq. Yards)',
    propertyLocation: 'Vidyanagar, Guntur',
    ownerName: 'B. Seshagiri Rao',
    ownerPhone: '+91 94400 99887',
    stage: CrmDealStages.CLOSED_WON,
    dealValue: 3200000,
    dealValueDisplay: 'Rs. 32.0 Lakhs',
    expectedClosingDate: '2026-09-20',
    probability: 100,
    commissionRate: 1.5,
    expectedCommission: 48000,
    assignedAgent: 'Scarlett (Senior Portfolio Lead)',
    legalAuditStatus: 'VERIFIED_CLEAR',
    notes: 'Registration completed at District Sub-Registrar Office. Direct ownership deed handed over.',
    paymentMilestones: [
      { name: 'Total Settlement', amount: 3200000, status: 'PAID', date: '2026-09-20' }
    ],
    timeline: [
      { date: '2026-08-28', event: 'Deal Initiated', user: 'Scarlett' },
      { date: '2026-09-05', event: 'Token Advance Deposited', user: 'Scarlett' },
      { date: '2026-09-20', event: 'Registered & Closed Successfully', user: 'Scarlett' }
    ],
    createdAt: '2026-08-28T09:00:00Z',
    updatedAt: '2026-09-20T17:00:00Z'
  }
];

const INITIAL_CRM_VISITS = [
  {
    id: 'visit-301',
    dealId: 'deal-203',
    propertyId: 'prop-krishna-03',
    propertyTitle: 'Irrigated Agro Land (1.25 Acres Canal Frontage)',
    propertyLocation: 'Vijayawada-Guntur Express Corridor',
    customerName: 'Meera Nambiar',
    customerPhone: '+91 94460 77123',
    visitDate: '2026-09-27',
    visitTime: '10:00 AM',
    agentAssigned: 'Rohan Verma (Land Title Specialist)',
    status: 'SCHEDULED',
    customerNotes: 'Meet at Toll Plaza junction; customer bringing family and soil testing kit.',
    createdAt: '2026-09-24T18:00:00Z'
  },
  {
    id: 'visit-302',
    dealId: 'deal-202',
    propertyId: 'prop-guntur-02',
    propertyTitle: 'East-Facing Premium Villa Plot (267 Sq. Yards)',
    propertyLocation: 'Brodipet 4th Line, Guntur',
    customerName: 'K. Subba Rao',
    customerPhone: '+91 97012 88452',
    visitDate: '2026-09-16',
    visitTime: '04:30 PM',
    agentAssigned: 'Deepak Reddy (Capital Region Field Rep)',
    status: 'COMPLETED',
    customerNotes: 'Customer liked the vastu and street dimensions. Negotiating on final price.',
    createdAt: '2026-09-14T11:00:00Z'
  }
];

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

  if (!leads || leads.length === 0) {
    leads = INITIAL_CRM_LEADS;
    setStored('easeland_crm_leads', leads);
  }

  return leads;
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

  if (!deals || deals.length === 0) {
    deals = INITIAL_CRM_DEALS;
    setStored('easeland_crm_deals', deals);
  }

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

  if (!visits || visits.length === 0) {
    visits = INITIAL_CRM_VISITS;
    setStored('easeland_crm_visits', visits);
  }

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
    agentAssigned: visitData.agentAssigned || DEFAULT_CRM_AGENTS[2].name,
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
