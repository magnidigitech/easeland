import {
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from './config.js';
import { formatFirestoreError } from './userService.js';

/**
 * Read system activity logs (Admin ONLY)
 */
export async function getActivityLogs(limitCount = 50) {
  try {
    const q = query(
      collection(db, 'activityLogs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const logs = snap.docs.map(doc => doc.data());
    return { success: true, logs };
  } catch (error) {
    return { success: false, error: formatFirestoreError(error) };
  }
}
