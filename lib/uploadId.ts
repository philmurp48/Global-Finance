/**
 * Shared uploadId management for client-side code
 * Ensures consistent uploadId storage and retrieval across all components
 */

export const UPLOAD_ID_KEY = "gf_current_upload_id";

/**
 * Get the current uploadId from localStorage
 * Returns null if not found or if localStorage is unavailable
 */
export function getCurrentUploadId(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(UPLOAD_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Set the current uploadId in localStorage and dispatch event
 * Dispatches a custom event so components can react to uploadId changes
 */
export function setCurrentUploadId(id: string): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(UPLOAD_ID_KEY, id);
    // Dispatch custom event so components can update their state
    window.dispatchEvent(new CustomEvent("gf:uploadId", { 
      detail: { uploadId: id } 
    }));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Clear the current uploadId from localStorage
 */
export function clearCurrentUploadId(): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(UPLOAD_ID_KEY);
    window.dispatchEvent(new CustomEvent("gf:uploadId", { 
      detail: { uploadId: null } 
    }));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

