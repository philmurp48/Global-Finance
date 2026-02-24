import crypto from "crypto";
import { kv } from "@vercel/kv";

type SaveResult = { ok: boolean; backend: "vercel-kv"; bytes: number; error?: string };

export const datasetKey = (uploadId: string) => `dataset:${uploadId}`;

/**
 * Get storage backend name for logging
 */
export function getStorageBackendName(): string {
  return "vercel-kv";
}

/**
 * Export diagnostics for debugging storage configuration
 * Includes safe information (no secrets)
 */
export function getStorageDiagnostics() {
  const hasKVUrl = !!process.env.KV_REST_API_URL;
  const hasKVToken = !!process.env.KV_REST_API_TOKEN;
  const hasUpstash = hasKVUrl && process.env.KV_REST_API_URL?.includes("upstash");
  
  let urlHost: string | undefined;
  try {
    if (process.env.KV_REST_API_URL) {
      const url = new URL(process.env.KV_REST_API_URL);
      urlHost = url.host; // Safe - just the hostname, no secrets
    }
  } catch {
    // Invalid URL, skip urlHost
  }
  
  return {
    backend: "vercel-kv",
    hasKVRest: hasKVUrl && hasKVToken,
    hasUpstash,
    nodeEnv: process.env.NODE_ENV || "unknown",
    urlHost
  };
}

// Legacy export for backward compatibility
export function storageDiagnostics() {
  return getStorageDiagnostics();
}

/**
 * Save dataset to Vercel KV
 */
export async function saveDataset(uploadId: string, dataset: any): Promise<SaveResult> {
  const key = datasetKey(uploadId);
  const payload = JSON.stringify(dataset);
  const bytes = Buffer.byteLength(payload, "utf8");
  const recordCount = dataset?.data?.factMarginRecords?.length || 0;

  console.log("[STORAGE] SAVE start", { 
    uploadId, 
    key, 
    bytes, 
    recordCount,
    backend: "vercel-kv"
  });

  try {
    await kv.set(key, payload);
    console.log("[STORAGE] SAVE ok", { uploadId, key, backend: "vercel-kv", bytes, recordCount });
    return { ok: true, backend: "vercel-kv", bytes };
  } catch (e: any) {
    const errorMsg = e?.message || String(e);
    // Sanitize error message (no tokens)
    const safeError = errorMsg.length > 200 ? errorMsg.substring(0, 200) : errorMsg;
    console.error("[STORAGE] SAVE failed", { 
      uploadId, 
      key, 
      err: safeError
    });
    return { 
      ok: false, 
      backend: "vercel-kv", 
      bytes, 
      error: `PERSIST_FAILED: ${safeError}`
    };
  }
}

/**
 * Get dataset from Vercel KV
 */
export async function getDataset(uploadId: string, retryCount = 0): Promise<any | null> {
  const key = datasetKey(uploadId);

  console.log("[STORAGE] LOAD start", { 
    uploadId, 
    key, 
    backend: "vercel-kv",
    retryCount 
  });

  try {
    const raw = await kv.get<string>(key);
    if (raw) {
      console.log("[STORAGE] LOAD", { uploadId, key, backend: "vercel-kv", hit: true });
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error("[STORAGE] JSON parse failed", { uploadId, key, err: String(e) });
        return null;
      }
    }
    console.log("[STORAGE] LOAD", { uploadId, key, backend: "vercel-kv", hit: false });
    return null;
  } catch (e: any) {
    const errorMsg = e?.message || String(e);
    // Sanitize error message (no tokens)
    const safeError = errorMsg.length > 200 ? errorMsg.substring(0, 200) : errorMsg;
    console.error("[STORAGE] LOAD failed", { 
      uploadId, 
      key, 
      err: safeError
    });
    return null;
  }
}

/**
 * Generate a new upload ID
 */
export function newUploadId(): string {
  const rand = crypto.randomBytes(4).toString("hex");
  return `upload_${Date.now()}_${rand}`;
}

// Legacy exports for backward compatibility
export function generateUploadId(): string {
  return newUploadId();
}
