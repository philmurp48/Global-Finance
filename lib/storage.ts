import crypto from "crypto";

type SaveResult = { ok: boolean; backend: "redis" | "memory"; bytes: number; error?: string };

// Use globalThis singleton to survive HMR/module reloads
const g = globalThis as any;
g.__GF_MEM_STORE ??= new Map<string, string>();
g.__GF_REDIS_HEALTHY ??= true;
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
const canUseRedis = Boolean(KV_REST_API_URL && KV_REST_API_TOKEN);

async function redisCommand<T = any>(command: any[], uploadId?: string): Promise<T | null> {
  if (!canUseRedis) return null;
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
  const key = datasetKey(uploadId);
  const payload = JSON.stringify(dataset);
  const bytes = Buffer.byteLength(payload, "utf8");
  const recordCount = dataset?.data?.factMarginRecords?.length || 0;
  const hasKVUrl = !!KV_REST_API_URL;
  const hasKVToken = !!KV_REST_API_TOKEN;

  const redisHealthy = getRedisHealthy();
  console.log("[STORAGE] SAVE start", { 
    uploadId, 
    key, 
    bytes, 
    recordCount,
    hasKVUrl, 
    hasKVToken, 
    redisHealthy 
  });

  // Prefer Redis if available & healthy
  if (canUseRedis && getRedisHealthy()) {
    try {
      await redisCommand(["SET", key, payload], uploadId);
      console.log("[STORAGE] SAVE ok", { uploadId, key, backend: "redis", bytes, recordCount });
      return { ok: true, backend: "redis", bytes };
    } catch (e: any) {
      setRedisHealthy(false);
      console.error("[STORAGE] SAVE redis failed, fallback to memory", { 
        uploadId, 
        key, 
        err: String(e?.message || e),
        stack: e?.stack?.substring(0, 500)
      });
      // fall through to memory in dev
      if (isProd) return { ok: false, backend: "redis", bytes, error: String(e?.message || e) };
    }
  }

  // DEV memory fallback
  inMemoryStore.set(key, payload);
  console.log("[STORAGE] SAVE ok", { uploadId, key, backend: "memory", bytes, recordCount });
  return { ok: true, backend: "memory", bytes };
}

export async function getDataset(uploadId: string, retryCount = 0): Promise<any | null> {
  const key = datasetKey(uploadId);
  const hasKVUrl = !!KV_REST_API_URL;
  const hasKVToken = !!KV_REST_API_TOKEN;
  const redisHealthy = getRedisHealthy();

  console.log("[STORAGE] LOAD start", { 
    uploadId, 
    key, 
    hasKVUrl, 
    hasKVToken, 
    redisHealthy,
    retryCount 
  });

  // If redis unhealthy in dev, skip to memory
  if (!isProd && (!redisHealthy || !canUseRedis)) {
    const raw = inMemoryStore.get(key);
    console.log("[STORAGE] LOAD", { uploadId, key, backend: "memory", hit: Boolean(raw) });
    return raw ? safeParse(raw) : null;
  }

  if (canUseRedis) {
    try {
      const raw = await redisCommand<string>(["GET", key], uploadId);
      if (raw) {
        console.log("[STORAGE] LOAD", { uploadId, key, backend: "redis", hit: true });
        return safeParse(raw);
      }
      // IMPORTANT: Redis MISS should fallback to memory in dev
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
      if (isProd) return null;
      const mem = inMemoryStore.get(key);
      console.log("[STORAGE] LOAD fallback memory", { uploadId, key, hit: Boolean(mem) });
      return mem ? safeParse(mem) : null;
    }
  }

  // final fallback
  const raw = inMemoryStore.get(key);
  console.log("[STORAGE] LOAD", { uploadId, key, backend: "memory", hit: Boolean(raw) });
  return raw ? safeParse(raw) : null;
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
