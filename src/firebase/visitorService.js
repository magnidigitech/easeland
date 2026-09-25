/**
 * EaseLand Site Visitor Lead Service
 * Handles capturing, fetching, and updating engaged 3-minute site visitor leads
 * Saves to PostgreSQL Database via /api/visitors REST endpoint + LocalStorage fallback.
 */
import { createCrmLead, CrmLeadSources, CrmLeadScores } from './crmService.js';

const STORAGE_KEY = 'easeland_visitors';

const getStoredVisitors = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    }
  } catch (e) {}
  return [];
};

const setStoredVisitors = (visitors) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visitors));
    }
  } catch (e) {}
};

/**
 * Submit a visitor lead (captured from 3-minute site engagement popup)
 * Persists to PostgreSQL via /api/visitors
 */
export async function submitVisitorLead(visitorData) {
  try {
    const vId = 'vis-' + Date.now().toString().slice(-6) + '-' + Math.random().toString(36).substring(2, 5);
    const nowIso = new Date().toISOString();

    const payload = {
      id: vId,
      visitorId: vId,
      name: (visitorData.name || 'Site Visitor').trim(),
      phone: (visitorData.phone || '').trim(),
      email: (visitorData.email || '').trim(),
      preferredPropertyType: visitorData.preferredPropertyType || 'Open Plots',
      preferredLocation: visitorData.preferredLocation || 'Amaravati / Guntur',
      stayDurationSeconds: Number(visitorData.stayDurationSeconds) || 180,
      source: visitorData.source || '3_MIN_ENGAGEMENT_POPUP',
      status: 'NEW',
      notes: visitorData.notes || 'Stayed on site for over 3 minutes and filled visitor engagement modal.',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // 1. Save to LocalStorage cache
    const existing = getStoredVisitors();
    const updatedLocal = [payload, ...existing.filter(item => item.id !== vId)];
    setStoredVisitors(updatedLocal);

    // 2. Persist to PostgreSQL backend
    let savedOnline = false;
    try {
      const res = await fetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) savedOnline = true;
      }
    } catch (apiErr) {
      console.warn('PostgreSQL visitor lead save note (Local store active):', apiErr.message);
    }

    // 3. Dispatch client event for real-time reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-visitor-lead-created', { detail: payload }));
      // Set submission flags to never re-prompt this visitor
      localStorage.setItem('easeland_visitor_submitted', 'true');
      localStorage.setItem('easeland_visitor_lead_info', JSON.stringify({
        name: payload.name,
        phone: payload.phone,
        submittedAt: nowIso
      }));
    }

    return { success: true, visitor: payload, savedOnline };
  } catch (err) {
    console.error('Error submitting visitor lead:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all visitor leads (from PostgreSQL API with LocalStorage fallback)
 */
export async function getVisitorLeads() {
  let pgVisitors = [];
  try {
    const res = await fetch('/api/visitors');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.visitors)) {
        pgVisitors = json.visitors;
      }
    }
  } catch (e) {
    console.warn('PostgreSQL fetch visitors fallback note:', e.message);
  }

  const localVisitors = getStoredVisitors();
  const mergedMap = new Map();

  [...localVisitors, ...pgVisitors].forEach(v => {
    if (v && (v.visitorId || v.id)) {
      const id = v.visitorId || v.id;
      mergedMap.set(id, { ...mergedMap.get(id), ...v });
    }
  });

  const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
    const tA = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const tB = new Date(b.createdAt || b.updatedAt || 0).getTime();
    return tB - tA;
  });

  setStoredVisitors(mergedList);
  return mergedList;
}

/**
 * Update visitor lead status or notes in PostgreSQL
 */
export async function updateVisitorStatus(visitorId, status, notes = '', assignedAgent = '') {
  try {
    // 1. Update local cache
    const current = getStoredVisitors();
    const updated = current.map(v => {
      if (v.id === visitorId || v.visitorId === visitorId) {
        return {
          ...v,
          ...(status ? { status } : {}),
          ...(notes ? { notes } : {}),
          ...(assignedAgent ? { assignedAgent } : {}),
          updatedAt: new Date().toISOString()
        };
      }
      return v;
    });
    setStoredVisitors(updated);

    // 2. Update PostgreSQL
    try {
      await fetch(`/api/visitors/${visitorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes, assignedAgent })
      });
    } catch (e) {
      console.warn('PostgreSQL visitor status update note:', e.message);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-visitor-lead-updated', { detail: { visitorId, status } }));
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete a visitor record from PostgreSQL & local store
 */
export async function deleteVisitorLead(visitorId) {
  try {
    const current = getStoredVisitors();
    const filtered = current.filter(v => v.id !== visitorId && v.visitorId !== visitorId);
    setStoredVisitors(filtered);

    try {
      await fetch(`/api/visitors/${visitorId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('PostgreSQL visitor delete note:', e.message);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easeland-visitor-lead-deleted', { detail: { visitorId } }));
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * One-Click Convert Visitor to CRM Deal Lead
 */
export async function convertVisitorToCrmLead(visitor) {
  try {
    const leadPayload = {
      name: visitor.name || 'Site Visitor',
      phone: visitor.phone || '',
      email: visitor.email || '',
      source: CrmLeadSources.WEBSITE_ENQUIRY,
      score: CrmLeadScores.HOT,
      preferredPropertyType: visitor.preferredPropertyType || 'Open Plots',
      preferredLocation: visitor.preferredLocation || 'Amaravati / Guntur',
      budgetMax: 0,
      notes: `Converted from 3-Minute Site Visitor Lead (Browsed for ${Math.round((visitor.stayDurationSeconds || 180) / 60)} mins). ${visitor.notes || ''}`
    };

    const crmResult = await createCrmLead(leadPayload);
    if (crmResult.success) {
      await updateVisitorStatus(visitor.id || visitor.visitorId, 'CONVERTED', 'Converted to CRM Deal Pipeline');
    }
    return crmResult;
  } catch (err) {
    return { success: false, error: err.message };
  }
}
