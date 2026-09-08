import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from './config.js';
import { logAdminActivity } from './verificationService.js';

/**
 * Submit a marketplace report (property, user, or media violation).
 */
export async function submitMarketplaceReport(reporterId, reportData) {
  try {
    if (!reporterId) throw new Error('Reporter ID is required');

    const reportRef = collection(db, 'reports');
    const newDoc = await addDoc(reportRef, {
      reporterId,
      targetType: reportData.targetType || 'PROPERTY', // PROPERTY | USER | MEDIA
      targetId: reportData.targetId || '',
      reason: reportData.reason || 'General Inquiry',
      details: reportData.details || '',
      status: 'SUBMITTED', // SUBMITTED | INVESTIGATING | RESOLVED | DISMISSED
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return { success: true, reportId: newDoc.id };
  } catch (error) {
    console.error('Error submitting marketplace report:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch all submitted marketplace reports for admin review.
 */
export async function getAllReportsAdmin() {
  try {
    const reportsRef = collection(db, 'reports');
    const snapshot = await getDocs(reportsRef);
    const reports = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      reports.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null,
        updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt) : null
      });
    });

    return { success: true, reports };
  } catch (error) {
    console.error('Error fetching marketplace reports:', error);
    return { success: false, error: error.message, reports: [] };
  }
}

/**
 * Update report status (Resolve or Dismiss).
 */
export async function resolveReportAdmin(reportId, adminUid, status = 'RESOLVED', notes = '') {
  try {
    if (!reportId || !adminUid) throw new Error('Report ID and Admin UID are required');

    const reportRef = doc(db, 'reports', reportId);
    await updateDoc(reportRef, {
      status,
      resolutionNotes: notes,
      resolvedBy: adminUid,
      updatedAt: serverTimestamp()
    });

    await logAdminActivity(
      'REPORT_' + status,
      `Report ${reportId} marked as ${status}. Notes: ${notes}`,
      adminUid
    );

    return { success: true };
  } catch (error) {
    console.error(`Error resolving report ${reportId}:`, error);
    return { success: false, error: error.message };
  }
}
