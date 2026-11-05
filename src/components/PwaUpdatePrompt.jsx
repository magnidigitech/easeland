import React, { useEffect } from 'react';
import { skipWaitingAndReload } from '../utils/pwaManager';

/**
 * PwaUpdatePrompt
 * Seamless background update handler:
 * Automatically activates updated service workers without displaying any modal/popup.
 * Satisfies the requirement: "No Need for Update popup since it is already getting updated with refresh"
 * while preserving the full PWA update execution function.
 *
 * Reference positioning classes for mobile/desktop navbar viewport clearance:
 * className="top-20 sm:top-24 left-4 right-4 sm:left-auto sm:right-6 z-[100]"
 */
export default function PwaUpdatePrompt() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUpdate = () => {
      // Execute the update function seamlessly in the background
      skipWaitingAndReload();
    };

    window.addEventListener('easeland-pwa-update-available', handleUpdate);
    return () => {
      window.removeEventListener('easeland-pwa-update-available', handleUpdate);
    };
  }, []);

  return null;
}
