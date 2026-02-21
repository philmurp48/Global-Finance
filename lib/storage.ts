// Storage system for Excel data with uploadId support
// Supports: Vercel Blob, Upstash Redis, Vercel KV, or in-memory fallback

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

// In-memory fallback (dev-only, clearly marked)
const inMemoryStore = new Map<string, StoredDataset>();

/**
 * Save dataset with uploadId
 */
export async function saveDataset(uploadId: string, data: StoredDataset['data'], metadata?: StoredDataset['metadata']): Promise<boolean> {
    const dataset: StoredDataset = {
        uploadId,
        data,
        uploadedAt: new Date().toISOString(),
        metadata: metadata || {}
    };

    // Try Vercel Blob first (preferred)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
            return await saveDatasetToBlob(dataset);
        } catch (error) {
            console.error('Vercel Blob error, falling back:', error);
        }
    }

    // Try Upstash Redis
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
            return await saveDatasetToRedis(dataset);
        } catch (error) {
            console.error('Redis error, falling back:', error);
        }
    }

    // Try Vercel KV
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
            return await saveDatasetToKV(dataset);
        } catch (error) {
            console.error('Vercel KV error, falling back:', error);
        }
    }

    // Dev-only in-memory fallback (clearly marked)
    console.warn('⚠️  Using in-memory storage (DEV ONLY - not suitable for production)');
    inMemoryStore.set(uploadId, dataset);
    return true;
}

/**
 * Get dataset by uploadId
 */
export async function getDataset(uploadId: string): Promise<StoredDataset | null> {
    // Try Vercel Blob first
    if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
            const data = await getDatasetFromBlob(uploadId);
            if (data) return data;
        } catch (error) {
            console.error('Vercel Blob error, falling back:', error);
        }
    }

    // Try Upstash Redis
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
            const data = await getDatasetFromRedis(uploadId);
            if (data) return data;
        } catch (error) {
            console.error('Redis error, falling back:', error);
        }
    }

    // Try Vercel KV
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
            const data = await getDatasetFromKV(uploadId);
            if (data) return data;
        } catch (error) {
            console.error('Vercel KV error, falling back:', error);
        }
    }

    // Dev-only in-memory fallback
    return inMemoryStore.get(uploadId) || null;
}

/**
 * Generate a unique uploadId
 */
export function generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Vercel Blob storage
async function saveDatasetToBlob(dataset: StoredDataset): Promise<boolean> {
    try {
        const { put } = await import('@vercel/blob');
        const blob = await put(`datasets/${dataset.uploadId}.json`, JSON.stringify(dataset), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
        });
        return !!blob.url;
    } catch (error) {
        console.error('Vercel Blob save error:', error);
        return false;
    }
}

async function getDatasetFromBlob(uploadId: string): Promise<StoredDataset | null> {
    try {
        // Vercel Blob uses the blob URL pattern
        // We need to construct the URL or use list/get API
        // For now, fall back to Redis/KV since blob retrieval requires different approach
        // This would need a server-side API route to fetch from blob
        return null; // Will fall back to Redis/KV
    } catch (error) {
        console.error('Vercel Blob get error:', error);
        return null;
    }
}

// Upstash Redis storage
async function saveDatasetToRedis(dataset: StoredDataset): Promise<boolean> {
    try {
        const { Redis } = await import('@upstash/redis');
        const redis = new Redis({
            url: process.env.KV_REST_API_URL!,
            token: process.env.KV_REST_API_TOKEN!,
        });
        await redis.set(`dataset:${dataset.uploadId}`, JSON.stringify(dataset));
        return true;
    } catch (error) {
        console.error('Redis save error:', error);
        return false;
    }
}

async function getDatasetFromRedis(uploadId: string): Promise<StoredDataset | null> {
    try {
        const { Redis } = await import('@upstash/redis');
        const redis = new Redis({
            url: process.env.KV_REST_API_URL!,
            token: process.env.KV_REST_API_TOKEN!,
        });
        const data = await redis.get<string>(`dataset:${uploadId}`);
        if (!data) return null;
        return JSON.parse(data);
    } catch (error) {
        console.error('Redis get error:', error);
        return null;
    }
}

// Vercel KV storage
async function saveDatasetToKV(dataset: StoredDataset): Promise<boolean> {
    try {
        const { kv } = await import('@vercel/kv');
        await kv.set(`dataset:${dataset.uploadId}`, JSON.stringify(dataset));
        return true;
    } catch (error) {
        console.error('Vercel KV save error:', error);
        return false;
    }
}

async function getDatasetFromKV(uploadId: string): Promise<StoredDataset | null> {
    try {
        const { kv } = await import('@vercel/kv');
        const data = await kv.get<string>(`dataset:${uploadId}`);
        if (!data) return null;
        return JSON.parse(data);
    } catch (error) {
        console.error('Vercel KV get error:', error);
        return null;
    }
}

