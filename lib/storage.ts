import crypto from "crypto";

type SaveResult = { ok: boolean; backend: "vercel-kv"; bytes: number; error?: string };

export const datasetKey = (uploadId: string) => `dataset:${uploadId}`;

// Vercel KV REST API env vars
const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
const isProd = process.env.NODE_ENV === "production";

/**
 * Execute a Redis command via KV REST API
 * Fixed: sends command array directly, not wrapped in { command }
 */
async function redisCommand<T = any>(command: any[], uploadId?: string): Promise<T | null> {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
                return null;
  }
  
  const commandName = command[0] || "UNKNOWN";
  const logPrefix = uploadId ? `[STORAGE] ${commandName} uploadId=${uploadId}` : `[STORAGE] ${commandName}`;
  
  try {
    // FIXED: Send command array directly, not wrapped in { command }
    const res = await fetch(KV_REST_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command), // Direct array, not { command }
      cache: "no-store",
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      const errorPreview = errorText.length > 200 ? errorText.substring(0, 200) : errorText;
      // Improved error logging
      console.error(`${logPrefix} FAILED status=${res.status}`, { 
        commandName, 
        uploadId, 
        error: errorPreview 
      });
      throw new Error(`KV REST error ${res.status}: ${errorText}`);
    }
    
    const json = await res.json();
    // Upstash/Vercel KV returns { result: ... }
    const result = (json?.result ?? null) as T | null;
    if (!isProd && uploadId) {
      console.log(`${logPrefix} OK`, { hit: result !== null });
    }
    return result;
  } catch (e: any) {
    const errorMsg = e?.message || String(e);
    // Sanitize error (no tokens)
    const safeError = errorMsg.length > 200 ? errorMsg.substring(0, 200) : errorMsg;
    console.error(`${logPrefix} ERROR`, { err: safeError });
    throw e;
  }
}

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
 * Save dataset to Vercel KV via REST API
 * Includes read-after-write retry for robustness
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

  // Validate KV is configured
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    const errorMsg = isProd 
      ? "KV_NOT_CONFIGURED_PROD: missing KV_REST_API_URL or KV_REST_API_TOKEN"
      : "KV not configured (dev mode)";
    console.error("[STORAGE] SAVE failed - KV not configured", { uploadId });
    return { 
      ok: false, 
      backend: "vercel-kv", 
      bytes: 0, 
      error: errorMsg
    };
  }

  try {
    // SET command
    await redisCommand(["SET", key, payload], uploadId);
    
    // Read-after-write retry: try GET up to 3 times with 100ms delay
    let verify: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      verify = await redisCommand<string>(["GET", key], uploadId);
      if (verify) {
        break;
      }
      if (attempt < 2) {
        console.warn(`[STORAGE] SAVE verify attempt ${attempt + 1} returned null, retrying...`, { uploadId, key });
      }
    }
    
    if (!verify) {
      console.warn("[STORAGE] SAVE SET succeeded but verify GET returned null after 3 attempts", { uploadId, key });
      // Don't fail here - let readback in upload route handle it
    }
    
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
    
    // Only in prod return PERSIST_FAILED if SET fails
    if (isProd) {
      return { 
        ok: false, 
        backend: "vercel-kv", 
        bytes, 
        error: `PERSIST_FAILED: ${safeError}`
      };
    }
    // In dev, still return error but allow fallback handling
    return { 
      ok: false, 
      backend: "vercel-kv", 
      bytes, 
      error: `PERSIST_FAILED: ${safeError}`
    };
  }
}

/**
 * Get dataset from Vercel KV via REST API
 */
export async function getDataset(uploadId: string, retryCount = 0): Promise<any | null> {
  const key = datasetKey(uploadId);

  console.log("[STORAGE] LOAD start", { 
    uploadId, 
    key, 
    backend: "vercel-kv",
    retryCount 
  });

  // Validate KV is configured
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    if (isProd) {
      console.error("[STORAGE] LOAD failed - KV not configured in production", { uploadId, key });
    }
    return null;
  }

  try {
    const raw = await redisCommand<string>(["GET", key], uploadId);
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
