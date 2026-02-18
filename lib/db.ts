// Database integration for storing Excel data
// Supports multiple backends: Supabase, Vercel KV, or in-memory fallback

export interface StoredExcelData {
    id: string;
    data: {
        tree: any[];
        accountingFacts: [string, any[]][];
        rateFacts: [string, any[]][];
    };
    uploadedAt: string;
    uploadedBy?: string;
}

// In-memory fallback (for development or if no DB configured)
let inMemoryStore: StoredExcelData | null = null;

/**
 * Get the latest Excel data from database
 */
export async function getExcelData(): Promise<StoredExcelData | null> {
    // Try Supabase first
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
            return await getExcelDataFromSupabase();
        } catch (error) {
            console.error('Supabase error, falling back:', error);
        }
    }

    // Try Upstash Redis (via Vercel Integration)
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
            return await getExcelDataFromRedis();
        } catch (error) {
            console.error('Redis error, falling back:', error);
        }
    }

    // Fallback to in-memory
    return inMemoryStore;
}

/**
 * Save Excel data to database
 */
export async function saveExcelData(data: StoredExcelData['data']): Promise<boolean> {
    const storedData: StoredExcelData = {
        id: 'latest',
        data,
        uploadedAt: new Date().toISOString(),
    };

    // Try Supabase first
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
            return await saveExcelDataToSupabase(storedData);
        } catch (error) {
            console.error('Supabase error, falling back:', error);
        }
    }

    // Try Upstash Redis (via Vercel Integration)
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
            return await saveExcelDataToRedis(storedData);
        } catch (error) {
            console.error('Redis error, falling back:', error);
        }
    }

    // Fallback to in-memory
    inMemoryStore = storedData;
    return true;
}

// Supabase integration
async function getExcelDataFromSupabase(): Promise<StoredExcelData | null> {
    try {
        const { createClient } = await import('@supabase/supabase-js');
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            return null;
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase
            .from('excel_data')
            .select('*')
            .eq('id', 'latest')
            .single();

        if (error || !data) {
            return null;
        }

        return data as StoredExcelData;
    } catch (error) {
        console.error('Supabase get error:', error);
        return null;
    }
}

async function saveExcelDataToSupabase(data: StoredExcelData): Promise<boolean> {
    try {
        const { createClient } = await import('@supabase/supabase-js');
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            return false;
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error } = await supabase
            .from('excel_data')
            .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: 'id' });

        return !error;
    } catch (error) {
        console.error('Supabase save error:', error);
        return false;
    }
}

// Upstash Redis integration (via @upstash/redis)
async function getExcelDataFromRedis(): Promise<StoredExcelData | null> {
    try {
        // Try @upstash/redis first (newer)
        try {
            const { Redis } = await import('@upstash/redis');
            const redis = new Redis({
                url: process.env.KV_REST_API_URL!,
                token: process.env.KV_REST_API_TOKEN!,
            });
            const data = await redis.get<StoredExcelData>('excel_data:latest');
            return data;
        } catch {
            // Fallback to @vercel/kv for backwards compatibility
            const { kv } = await import('@vercel/kv');
            const data = await kv.get<StoredExcelData>('excel_data:latest');
            return data;
        }
    } catch (error) {
        console.error('Redis get error:', error);
        return null;
    }
}

async function saveExcelDataToRedis(data: StoredExcelData): Promise<boolean> {
    try {
        // Try @upstash/redis first (newer)
        try {
            const { Redis } = await import('@upstash/redis');
            const redis = new Redis({
                url: process.env.KV_REST_API_URL!,
                token: process.env.KV_REST_API_TOKEN!,
            });
            await redis.set('excel_data:latest', data);
            return true;
        } catch {
            // Fallback to @vercel/kv for backwards compatibility
            const { kv } = await import('@vercel/kv');
            await kv.set('excel_data:latest', data);
            return true;
        }
    } catch (error) {
        console.error('Redis save error:', error);
        return false;
    }
}

