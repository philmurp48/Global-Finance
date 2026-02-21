// Storage system for Excel data - Upstash Redis with fallback support
// Accepts either UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN
// Falls back to in-memory storage in dev mode if neither is configured

import { Redis } from "@upstash/redis";

export interface StoredDataset {
    uploadId: string;
    data: {
        tree: any[];
        accountingFacts: [string, any[]][];
        factMarginRecords: any[];
        dimensionTables: { [key: string]: { [id: string]: any } };
        namingConventionRecords?: any[];
    };
    uploadedAt: string;
    uploadedBy?: string;
    metadata?: {
        fileName?: string;
        recordCount?: number;
        quarterRange?: string[];
    };
}

// In-memory fallback (dev only)
const inMemoryStore = new Map<string, StoredDataset>();

// Initialize Redis client
let redis: Redis | null = null;
let storageBackend: 'KV_REST_API' | 'UPSTASH_REDIS_REST' | 'in-memory' | null = null;

function getRedis(): Redis | null {
    if (!redis) {
        // Prefer KV_REST_API_* over UPSTASH_REDIS_REST_* for backward compatibility
        const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
        
        if (!url || !token) {
            // In dev mode, allow fallback to in-memory storage
            if (process.env.NODE_ENV !== 'production') {
                storageBackend = 'in-memory';
                console.warn('⚠️  [STORAGE] Upstash Redis not configured. Using in-memory storage (DEV ONLY - data will be lost on server restart).');
                console.warn('   Set KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_URL/TOKEN for persistent storage.');
                return null;
            } else {
                // In production, require Redis configuration
                throw new Error(
                    'Upstash Redis not configured. Please set KV_REST_API_URL and KV_REST_API_TOKEN ' +
                    '(or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN) environment variables.'
                );
            }
        }
        
        // Determine which env var pair is being used
        storageBackend = process.env.KV_REST_API_URL ? 'KV_REST_API' : 'UPSTASH_REDIS_REST';
        
        // DEV-only log: which backend is used
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[STORAGE] Initialized: Using ${storageBackend} backend`);
        }
        
        redis = new Redis({
            url,
            token,
        });
    }
    
    return redis;
}

/**
 * Save dataset with uploadId
 */
export async function saveDataset(
    uploadId: string,
    data: StoredDataset['data'],
    metadata?: StoredDataset['metadata']
): Promise<boolean> {
    try {
        const dataset: StoredDataset = {
            uploadId,
            data,
            uploadedAt: new Date().toISOString(),
            metadata: metadata || {}
        };
        
        const client = getRedis();
        const backend = storageBackend || 'in-memory';
        const key = `dataset:${uploadId}`;
        
        // Use Redis if available, otherwise fall back to in-memory (dev only)
        if (client) {
            await client.set(key, JSON.stringify(dataset));
            // DEV-only log
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[STORAGE] SAVE: uploadId=${uploadId}, backend=${backend}, key=${key}, HIT`);
            }
            return true;
        } else {
            // Dev fallback: in-memory storage
            inMemoryStore.set(uploadId, dataset);
            // DEV-only log
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[STORAGE] SAVE: uploadId=${uploadId}, backend=in-memory, key=${key}, HIT`);
            }
            return true;
        }
    } catch (error) {
        console.error('[STORAGE] Error saving dataset:', error);
        
        // In dev mode, fall back to in-memory storage on error
        if (process.env.NODE_ENV !== 'production') {
            console.warn('⚠️  [STORAGE] Redis save failed, falling back to in-memory storage (DEV ONLY)');
            const dataset: StoredDataset = {
                uploadId,
                data,
                uploadedAt: new Date().toISOString(),
                metadata: metadata || {}
            };
            inMemoryStore.set(uploadId, dataset);
            // DEV-only log
            console.log(`[STORAGE] SAVE: uploadId=${uploadId}, backend=in-memory (fallback), key=dataset:${uploadId}, HIT`);
            return true;
        }
        
        throw error;
    }
}

/**
 * Get dataset by uploadId
 */
export async function getDataset(uploadId: string): Promise<StoredDataset | null> {
    try {
        const client = getRedis();
        const backend = storageBackend || 'in-memory';
        const key = `dataset:${uploadId}`;
        
        // Use Redis if available, otherwise fall back to in-memory (dev only)
        if (client) {
            const raw = await client.get<string>(key);
            
            // DEV-only log
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[STORAGE] GET: uploadId=${uploadId}, backend=${backend}, key=${key}, ${raw ? 'HIT' : 'MISS'}`);
            }
            
            if (!raw) {
                return null;
            }
            
            return JSON.parse(raw);
        } else {
            // Dev fallback: in-memory storage
            const result = inMemoryStore.get(uploadId) || null;
            // DEV-only log
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[STORAGE] GET: uploadId=${uploadId}, backend=in-memory, key=${key}, ${result ? 'HIT' : 'MISS'}`);
            }
            return result;
        }
    } catch (error) {
        console.error('[STORAGE] Error getting dataset:', error);
        
        // In dev mode, fall back to in-memory storage on error
        if (process.env.NODE_ENV !== 'production') {
            console.warn('⚠️  [STORAGE] Redis get failed, falling back to in-memory storage (DEV ONLY)');
            const result = inMemoryStore.get(uploadId) || null;
            // DEV-only log
            console.log(`[STORAGE] GET: uploadId=${uploadId}, backend=in-memory (fallback), key=dataset:${uploadId}, ${result ? 'HIT' : 'MISS'}`);
            return result;
        }
        
        return null;
    }
}

/**
 * Generate a unique uploadId
 */
export function generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
