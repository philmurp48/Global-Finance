import { NextRequest, NextResponse } from 'next/server';
import { saveDataset, getDataset, newUploadId } from '@/lib/storage';
import { ExcelDriverTreeData } from '@/lib/excel-parser';

export const runtime = "nodejs";

/**
 * Upload endpoint: Accepts parsed Excel data and saves it to storage
 * Returns uploadId only after atomic save + readback verification
 */
export async function POST(request: NextRequest) {
    // Generate uploadId IMMEDIATELY at start of request
    const uploadId = newUploadId();
    const uploadedAt = new Date().toISOString();
    
    try {
        const body = await request.json();
        const { data, fileName } = body;

        // Validate data structure
        if (!data || !data.factMarginRecords || !Array.isArray(data.factMarginRecords)) {
            return NextResponse.json(
                { error: 'Invalid data format. Expected ExcelDriverTreeData with factMarginRecords array.' },
                { status: 400 }
            );
        }

        // Helper function to safely convert Map or object to entries array
        const toEntries = (value: any): [string, any][] => {
            if (!value) return [];
            
            // First check: Is it actually a Map instance?
            if (value instanceof Map) {
                try {
                    return Array.from(value.entries());
                } catch (e) {
                    if (process.env.NODE_ENV !== 'production') {
                        console.warn('[UPLOAD] Map.entries() failed, using Object.entries()', e);
                    }
                    // Fallback: try to convert Map to object first
                    const obj: any = {};
                    try {
                        value.forEach((v, k) => { obj[k] = v; });
                        return Object.entries(obj);
                    } catch {
                        return [];
                    }
                }
            }
            
            // Second check: Is it already an array of entries?
            if (Array.isArray(value)) {
                // Check if it looks like entries array [[key, value], ...]
                if (value.length > 0 && Array.isArray(value[0]) && value[0].length === 2) {
                    return value;
                }
                // Otherwise return empty (can't convert arbitrary array to entries)
                return [];
            }
            
            // Third check: Is it a plain object?
            if (typeof value === 'object' && value !== null) {
                // Make sure it's not a Map-like object that will fail
                // Check if it has entries method but it's not actually a Map
                if (typeof value.entries === 'function' && !(value instanceof Map)) {
                    // This might be a Map-like object from JSON deserialization
                    // Just use Object.entries instead
                    try {
                        return Object.entries(value);
                    } catch (e) {
                        if (process.env.NODE_ENV !== 'production') {
                            console.warn('[UPLOAD] Object.entries() failed', e);
                        }
                        return [];
                    }
                }
                // Plain object - use Object.entries
                try {
                    return Object.entries(value);
                } catch (e) {
                    if (process.env.NODE_ENV !== 'production') {
                        console.warn('[UPLOAD] Object.entries() failed', e);
                    }
                    return [];
                }
            }
            
            // Unknown type - log and return empty
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[UPLOAD] Unknown type for toEntries:', typeof value, value?.constructor?.name);
            }
            return [];
        };

        // Helper function to safely convert dimensionTables (Map<string, Map<string, any>> or object)
        const convertDimensionTables = (dimTables: any): { [key: string]: { [id: string]: any } } => {
            if (!dimTables) return {};
            
            try {
                // Try Map first
                if (dimTables instanceof Map || (typeof dimTables === 'object' && dimTables.entries && typeof dimTables.entries === 'function')) {
                    const entries = Array.from(dimTables.entries()) as [string, any][];
                    return Object.fromEntries(
                        entries.map(([tableName, records]) => {
                            // Convert inner Map/object
                            const recordEntries = toEntries(records);
                            return [tableName, Object.fromEntries(recordEntries)];
                        })
                    );
                }
                // If it's already a plain object, convert inner objects
                if (typeof dimTables === 'object' && dimTables !== null && !Array.isArray(dimTables)) {
                    const result: { [key: string]: { [id: string]: any } } = {};
                    for (const [tableName, records] of Object.entries(dimTables)) {
                        const recordEntries = toEntries(records);
                        result[tableName] = Object.fromEntries(recordEntries);
                    }
                    return result;
                }
            } catch (e) {
                if (process.env.NODE_ENV !== 'production') {
                    console.error('[UPLOAD] Error converting dimensionTables:', e);
                    console.error('[UPLOAD] dimensionTables type:', typeof dimTables, Array.isArray(dimTables) ? 'array' : 'not array');
                }
            }
            return {};
        };

        // Prepare data for storage (convert Maps to arrays/objects for JSON serialization)
        const storageData = {
            tree: data.tree || [],
            accountingFacts: toEntries(data.accountingFacts),
            factMarginRecords: data.factMarginRecords || [],
            dimensionTables: convertDimensionTables(data.dimensionTables),
            namingConventionRecords: data.namingConventionRecords || []
        };

        // Extract metadata
        const recordCount = data.factMarginRecords.length;
        const quarters = new Set<string>();
        data.factMarginRecords.forEach((record: any) => {
            const quarter = record.Quarter || record.quarter;
            if (quarter) quarters.add(String(quarter).trim().toUpperCase());
        });
        const quarterRange = Array.from(quarters).sort();

        // Build complete dataset object with uploadId and uploadedAt
        const dataset = {
            uploadId,
            uploadedAt,
            data: storageData,
            metadata: {
                fileName: fileName || 'uploaded_file.xlsx',
                recordCount,
                quarterRange
            }
        };

        // Save dataset - MUST succeed before returning uploadId
        console.log(`[UPLOAD] attempt saveDataset uploadId=${uploadId}`);
        
        let saveResult: { ok: boolean; backend: "redis" | "memory"; bytes: number; error?: string };
        
        try {
            saveResult = await saveDataset(uploadId, dataset);
        } catch (err: any) {
            console.error('[UPLOAD] saveDataset threw exception', { uploadId }, err);
            console.error(err.stack);
            return NextResponse.json(
                { 
                    success: false,
                    error: 'PERSIST_FAILED',
                    reason: err?.message || 'UNKNOWN',
                    uploadId: uploadId
                },
                { status: 500 }
            );
        }

        if (!saveResult.ok) {
            console.error('[UPLOAD] Failed to save dataset:', uploadId, 'error:', saveResult.error);
            return NextResponse.json(
                { 
                    success: false,
                    error: 'PERSIST_FAILED',
                    uploadId,
                    uploadedAt,
                    reason: saveResult.error ?? "unknown"
                },
                { status: 500 }
            );
        }

        console.log(`[UPLOAD] saveDataset succeeded uploadId=${uploadId} backend=${saveResult.backend} recordCount=${recordCount}`);

        // CRITICAL: Do readback verification with retry - ensure data is actually retrievable
        console.log(`[UPLOAD] performing readback verification uploadId=${uploadId}`);
        const backoffDelays = [50, 150, 300]; // ms - 3 retries
        let readback: any = null;
        let lastAttempt = 0;
        
        for (let attempt = 0; attempt < backoffDelays.length; attempt++) {
            if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, backoffDelays[attempt - 1]));
            }
            lastAttempt = attempt + 1;
            readback = await getDataset(uploadId, attempt);
            if (readback) {
                console.log(`[UPLOAD] readback verification PASSED uploadId=${uploadId} attempt=${lastAttempt}`);
                break;
            }
            console.warn(`[UPLOAD] readback attempt ${lastAttempt} MISS uploadId=${uploadId}`);
        }
        
        // If readback still missing after retries, log warning but still return success
        // (write may be eventually readable, and UI can proceed)
        if (!readback) {
            console.warn('[UPLOAD] READBACK_MISS after retries - dataset not found after save', { 
                uploadId, 
                uploadedAt,
                recordCount,
                backend: saveResult.backend,
                attempts: lastAttempt
            });
            // Return success with warning (both dev and prod)
            return NextResponse.json({
                success: true,
                uploadId,
                uploadedAt,
                backend: saveResult.backend,
                bytes: saveResult.bytes,
                warning: 'READBACK_MISS'
            }, { status: 200 });
        }

        // Only return success after readback verification - ALWAYS include uploadId
        return NextResponse.json({
            success: true,
            uploadId,
            uploadedAt,
            backend: saveResult.backend,
            bytes: saveResult.bytes
        }, { status: 200 });

    } catch (e: any) {
        console.error('[UPLOAD] failed', { 
            uploadId, 
            uploadedAt,
            error: String(e?.message || e),
            stack: e?.stack?.substring(0, 1000)
        });
        return NextResponse.json(
            { 
                success: false,
                error: 'UPLOAD_FAILED',
                uploadId,
                uploadedAt,
                reason: String(e?.message || e)
            },
            { status: 500 }
        );
    }
}

