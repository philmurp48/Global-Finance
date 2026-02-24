import crypto from "crypto";

type SaveResult = { ok: boolean; backend: "redis" | "memory"; bytes: number; error?: string };
type BackendType = "redis" | "memory" | "misconfigured";

// Use globalThis singleton to survive HMR/module reloads
const g = globalThis as any;
g.__GF_MEM_STORE ??= new Map<string, string>();
g.__GF_REDIS_HEALTHY ??= true;
g.__GF_BACKEND_LOGGED ??= false;
const inMemoryStore = g.__GF_MEM_STORE;

// Helper to get/set redisHealthy from globalThis
function getRedisHealthy(): boolean {
  return g.__GF_REDIS_HEALTHY ?? true;
}

function setRedisHealthy(healthy: boolean): void {
  g.__GF_REDIS_HEALTHY = healthy;
}

// Small sleep utility for retries
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const datasetKey = (uploadId: string) => `dataset:${uploadId}`;

// Upstash/Vercel KV REST env vars (present in Vercel):
// KV_REST_API_URL, KV_REST_API_TOKEN
const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

const isProd = process.env.NODE_ENV === "production";

/**
 * Central backend selection function - used by ALL storage operations
 * - If both KV env vars exist => "redis"
 * - Else if dev => "memory" (dev fallback)
 * - Else if prod => "misconfigured" (never use memory in prod)
 */
function selectBackend(): BackendType {
  const hasKVUrl = !!KV_REST_API_URL;
  const hasKVToken = !!KV_REST_API_TOKEN;
  
  if (hasKVUrl && hasKVToken) {
    return "redis";
  }
  
  if (isProd) {
    return "misconfigured"; // Never use memory in production
  }
  
  return "memory"; // Dev fallback
}

/**
 * Export diagnostics for debugging storage configuration
 */
export function storageDiagnostics() {
  const backend = selectBackend();
  return {
    nodeEnv: process.env.NODE_ENV,
    hasKVUrl: !!KV_REST_API_URL,
    hasKVToken: !!KV_REST_API_TOKEN,
    backendChosen: backend,
  };
}

// Log backend selection once per process
function logBackendSelectionOnce() {
  if (!g.__GF_BACKEND_LOGGED) {
    const diag = storageDiagnostics();
    console.log("[STORAGE] backend selected", diag);
    g.__GF_BACKEND_LOGGED = true;
  }
}

async function redisCommand<T = any>(command: any[], uploadId?: string): Promise<T | null> {
  const backend = selectBackend();
  if (backend !== "redis") return null;
  const commandName = command[0] || "UNKNOWN";
  const logPrefix = uploadId ? `[STORAGE] ${commandName} uploadId=${uploadId}` : `[STORAGE] ${commandName}`;
  
  try {
    const res = await fetch(KV_REST_API_URL!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command }),
      cache: "no-store",
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`${logPrefix} FAILED status=${res.status}`, { error: errorText.substring(0, 200) });
      throw new Error(`KV REST error ${res.status}: ${errorText}`);
    }
    const json = await res.json();
    // Upstash returns { result: ... }
    const result = (json?.result ?? null) as T | null;
    if (!isProd && uploadId) {
      console.log(`${logPrefix} OK`, { hit: result !== null });
    }
    return result;
  } catch (e: any) {
    console.error(`${logPrefix} ERROR`, { err: String(e?.message || e) });
    throw e;
  }
}

export async function saveDataset(uploadId: string, dataset: any): Promise<SaveResult> {
  logBackendSelectionOnce();
  
  const key = datasetKey(uploadId);
  const payload = JSON.stringify(dataset);
  const bytes = Buffer.byteLength(payload, "utf8");
  const recordCount = dataset?.data?.factMarginRecords?.length || 0;
  const backend = selectBackend();

  console.log("[STORAGE] SAVE start", { 
    uploadId, 
    key, 
    bytes, 
    recordCount,
    backend
  });

  // CRITICAL: In production, if KV is not configured, return error immediately
  if (backend === "misconfigured") {
    const missingVars: string[] = [];
    if (!KV_REST_API_URL) missingVars.push("KV_REST_API_URL");
    if (!KV_REST_API_TOKEN) missingVars.push("KV_REST_API_TOKEN");
    const errorMsg = `KV_NOT_CONFIGURED_PROD: missing ${missingVars.join("/")}`;
    console.error("[STORAGE] SAVE failed - misconfigured in production", { uploadId, missingVars });
    return { ok: false, backend: "memory", bytes: 0, error: errorMsg };
  }

  // Redis backend
  if (backend === "redis") {
    try {
      await redisCommand(["SET", key, payload], uploadId);
      // Immediate verification read (belt + suspenders)
      const verify = await redisCommand<string>(["GET", key], uploadId);
      if (!verify) {
        console.warn("[STORAGE] SAVE redis SET succeeded but immediate GET returned null", { uploadId, key });
      }
      console.log("[STORAGE] SAVE ok", { uploadId, key, backend: "redis", bytes, recordCount });
      return { ok: true, backend: "redis", bytes };
    } catch (e: any) {
      setRedisHealthy(false);
      console.error("[STORAGE] SAVE redis failed", { 
        uploadId, 
        key, 
        err: String(e?.message || e),
        stack: e?.stack?.substring(0, 500)
      });
      // In production, don't fall back to memory
      if (isProd) {
        return { ok: false, backend: "redis", bytes, error: String(e?.message || e) };
      }
      // In dev, fall through to memory
    }
  }

  // Memory backend (dev only)
  if (backend === "memory") {
    inMemoryStore.set(key, payload);
    console.log("[STORAGE] SAVE ok", { uploadId, key, backend: "memory", bytes, recordCount });
    return { ok: true, backend: "memory", bytes };
  }

  // Should never reach here, but TypeScript needs this
  return { ok: false, backend: "memory", bytes: 0, error: "Unknown backend state" };
}

export async function getDataset(uploadId: string, retryCount = 0): Promise<any | null> {
  logBackendSelectionOnce();
  
  const key = datasetKey(uploadId);
  const backend = selectBackend();

  console.log("[STORAGE] LOAD start", { 
    uploadId, 
    key, 
    backend,
    retryCount 
  });

  // CRITICAL: In production, if misconfigured, return null and log error
  if (backend === "misconfigured") {
    const diag = storageDiagnostics();
    console.error("[STORAGE] LOAD failed - misconfigured in production", { uploadId, key, diagnostics: diag });
    return null;
  }

  // Redis backend
  if (backend === "redis") {
    try {
      const raw = await redisCommand<string>(["GET", key], uploadId);
      if (raw) {
        console.log("[STORAGE] LOAD", { uploadId, key, backend: "redis", hit: true });
        return safeParse(raw);
      }
      // Redis MISS - check memory fallback in dev only
      if (!isProd) {
        const mem = inMemoryStore.get(key);
        console.log("[STORAGE] LOAD redis MISS; memory", { uploadId, key, hit: Boolean(mem) });
        return mem ? safeParse(mem) : null;
      }
      console.log("[STORAGE] LOAD", { uploadId, key, backend: "redis", hit: false });
      return null;
    } catch (e: any) {
      console.error("[STORAGE] LOAD redis failed", { 
        uploadId, 
        key, 
        err: String(e?.message || e),
        stack: e?.stack?.substring(0, 500)
      });
      // In production, don't fall back to memory
      if (isProd) return null;
      // In dev, try memory fallback
      const mem = inMemoryStore.get(key);
      console.log("[STORAGE] LOAD fallback memory", { uploadId, key, hit: Boolean(mem) });
      return mem ? safeParse(mem) : null;
    }
  }

  // Memory backend (dev only)
  if (backend === "memory") {
    const raw = inMemoryStore.get(key);
    console.log("[STORAGE] LOAD", { uploadId, key, backend: "memory", hit: Boolean(raw) });
    return raw ? safeParse(raw) : null;
  }

  // Should never reach here
  return null;
}

// Helper to safely parse JSON (handles both string and already-parsed objects)
function safeParse(data: string | any): any {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("[STORAGE] JSON parse failed", { err: String(e) });
      return null;
    }
  }
  // Already an object
  return data;
}

export function newUploadId(): string {
  const rand = crypto.randomBytes(4).toString("hex");
  return `upload_${Date.now()}_${rand}`;
}

// Legacy exports for backward compatibility
export function generateUploadId(): string {
  return newUploadId();
}
