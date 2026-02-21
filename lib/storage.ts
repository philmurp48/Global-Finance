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

function getRedis(): Redis | null {
    if (!redis) {
        // Accept either UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN
        const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
        
        if (!url || !token) {
            // In dev mode, allow fallback to in-memory storage
            if (process.env.NODE_ENV !== 'production') {
                console.warn('⚠️  Upstash Redis not configured. Using in-memory storage (DEV ONLY - data will be lost on server restart).');
                console.warn('   Set UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN for persistent storage.');
                return null;
            } else {
                // In production, require Redis configuration
                throw new Error(
                    'Upstash Redis not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN ' +
                    '(or KV_REST_API_URL and KV_REST_API_TOKEN) environment variables.'
                );
            }
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
        
        // Use Redis if available, otherwise fall back to in-memory (dev only)
        if (client) {
            await client.set(`dataset:${uploadId}`, JSON.stringify(dataset));
            return true;
        } else {
            // Dev fallback: in-memory storage
            inMemoryStore.set(uploadId, dataset);
            return true;
        }
    } catch (error) {
        console.error('Error saving dataset:', error);
        
        // In dev mode, fall back to in-memory storage on error
        if (process.env.NODE_ENV !== 'production') {
            console.warn('⚠️  Redis save failed, falling back to in-memory storage (DEV ONLY)');
            const dataset: StoredDataset = {
                uploadId,
                data,
                uploadedAt: new Date().toISOString(),
                metadata: metadata || {}
            };
            inMemoryStore.set(uploadId, dataset);
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
        
        // Use Redis if available, otherwise fall back to in-memory (dev only)
        if (client) {
            const raw = await client.get<string>(`dataset:${uploadId}`);
            
            if (!raw) {
                return null;
            }
            
            return JSON.parse(raw);
        } else {
            // Dev fallback: in-memory storage
            return inMemoryStore.get(uploadId) || null;
        }
    } catch (error) {
        console.error('Error getting dataset:', error);
        
        // In dev mode, fall back to in-memory storage on error
        if (process.env.NODE_ENV !== 'production') {
            console.warn('⚠️  Redis get failed, falling back to in-memory storage (DEV ONLY)');
            return inMemoryStore.get(uploadId) || null;
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
