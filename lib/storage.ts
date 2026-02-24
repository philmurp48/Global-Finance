import crypto from "crypto";

type SaveResult = { ok: boolean; backend: "redis" | "memory"; bytes: number; error?: string };

const inMemoryStore = new Map<string, string>(); // key -> JSON string
let redisHealthy = true;

export const datasetKey = (uploadId: string) => `dataset:${uploadId}`;

// Upstash/Vercel KV REST env vars (present in Vercel):
// KV_REST_API_URL, KV_REST_API_TOKEN
const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

const isProd = process.env.NODE_ENV === "production";
const canUseRedis = Boolean(KV_REST_API_URL && KV_REST_API_TOKEN);

async function redisCommand<T = any>(command: any[]): Promise<T | null> {
  if (!canUseRedis) return null;
  const res = await fetch(KV_REST_API_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV REST error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  // Upstash returns { result: ... }
  return (json?.result ?? null) as T | null;
}

export async function saveDataset(uploadId: string, dataset: any): Promise<SaveResult> {
  const key = datasetKey(uploadId);
  const payload = JSON.stringify(dataset);
  const bytes = Buffer.byteLength(payload, "utf8");

  if (!isProd) {
    console.log("[STORAGE] SAVE start", { key, bytes, canUseRedis, redisHealthy });
  }

  // Prefer Redis if available & healthy
  if (canUseRedis && redisHealthy) {
    try {
      await redisCommand(["SET", key, payload]);
      if (!isProd) console.log("[STORAGE] SAVE ok", { key, backend: "redis", bytes });
      return { ok: true, backend: "redis", bytes };
    } catch (e: any) {
      redisHealthy = false;
      if (!isProd) console.error("[STORAGE] SAVE redis failed, fallback to memory", { key, err: String(e?.message || e) });
      // fall through to memory in dev
      if (isProd) return { ok: false, backend: "redis", bytes, error: String(e?.message || e) };
    }
  }

  // DEV memory fallback
  inMemoryStore.set(key, payload);
  if (!isProd) console.log("[STORAGE] SAVE ok", { key, backend: "memory", bytes });
  return { ok: true, backend: "memory", bytes };
}

export async function getDataset(uploadId: string): Promise<any | null> {
  const key = datasetKey(uploadId);

  if (!isProd) console.log("[STORAGE] LOAD start", { key, canUseRedis, redisHealthy });

  // If redis unhealthy in dev, skip to memory
  if (!isProd && (!redisHealthy || !canUseRedis)) {
    const raw = inMemoryStore.get(key);
    if (!isProd) console.log("[STORAGE] LOAD", { key, backend: "memory", hit: Boolean(raw) });
    return raw ? JSON.parse(raw) : null;
  }

  if (canUseRedis) {
    try {
      const raw = await redisCommand<string>(["GET", key]);
      if (raw) {
        if (!isProd) console.log("[STORAGE] LOAD", { key, backend: "redis", hit: true });
        return JSON.parse(raw);
      }
      // IMPORTANT: Redis MISS should fallback to memory in dev
      if (!isProd) {
        const mem = inMemoryStore.get(key);
        console.log("[STORAGE] LOAD redis MISS; memory", { key, hit: Boolean(mem) });
        return mem ? JSON.parse(mem) : null;
      }
      if (!isProd) console.log("[STORAGE] LOAD", { key, backend: "redis", hit: false });
      return null;
    } catch (e: any) {
      if (!isProd) console.error("[STORAGE] LOAD redis failed", { key, err: String(e?.message || e) });
      if (isProd) return null;
      const mem = inMemoryStore.get(key);
      if (!isProd) console.log("[STORAGE] LOAD fallback memory", { key, hit: Boolean(mem) });
      return mem ? JSON.parse(mem) : null;
    }
  }

  // final fallback
  const raw = inMemoryStore.get(key);
  if (!isProd) console.log("[STORAGE] LOAD", { key, backend: "memory", hit: Boolean(raw) });
  return raw ? JSON.parse(raw) : null;
}

export function newUploadId(): string {
  const rand = crypto.randomBytes(4).toString("hex");
  return `upload_${Date.now()}_${rand}`;
}

// Legacy exports for backward compatibility
export function generateUploadId(): string {
  return newUploadId();
}
