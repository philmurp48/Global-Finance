import { NextRequest, NextResponse } from 'next/server';
import { saveDataset, getDataset, generateUploadId } from '@/lib/storage';
import { getExcelData, saveExcelData } from '@/lib/db'; // Keep for backward compatibility

// GET - support both old (latest) and new (uploadId) format
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const uploadId = searchParams.get('uploadId');

        // New format: get by uploadId
        if (uploadId) {
            const dataset = await getDataset(uploadId);
            if (!dataset) {
                return NextResponse.json({ data: null, uploadId: null });
            }
            return NextResponse.json({ 
                data: dataset.data, 
                uploadId: dataset.uploadId,
                uploadedAt: dataset.uploadedAt,
                metadata: dataset.metadata
            });
        }

        // Legacy format: get latest (for backward compatibility)
        const data = await getExcelData();
        if (!data) {
            return NextResponse.json({ data: null, uploadId: null });
        }
        
        return NextResponse.json({ 
            data: data.data,
            uploadId: null, // Legacy format
            uploadedAt: data.uploadedAt
        });
    } catch (error) {
        console.error('Error retrieving Excel data:', error);
        return NextResponse.json(
            { error: 'Failed to retrieve data' },
            { status: 500 }
        );
    }
}

// POST - save with uploadId
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        // Generate uploadId
        const uploadId = generateUploadId();
        
        // Extract metadata
        const metadata = {
            fileName: body.fileName,
            recordCount: body.data?.factMarginRecords?.length || 0,
            quarterRange: extractQuarterRange(body.data?.factMarginRecords || [])
        };
        
        // Save using new storage system
        let success = false;
        let saveError: any = null;
        let errorReason: 'STORAGE_NOT_CONFIGURED' | 'REDIS_WRITE_FAILED' | 'PAYLOAD_TOO_LARGE' | 'UNKNOWN' | null = null;
        
        try {
            success = await saveDataset(uploadId, body.data, metadata);
        } catch (err: any) {
            saveError = err;
            errorReason = err?.reason || 'UNKNOWN';
            console.error('[UPLOAD] saveDataset failed', { uploadId }, err);
        }
        
        if (success) {
            // Also save to legacy storage for backward compatibility
            try {
                await saveExcelData(body.data);
            } catch (legacyError) {
                console.warn('[UPLOAD] Legacy storage save failed (non-critical):', legacyError);
            }
            
            return NextResponse.json({ 
                success: true, 
                uploadId: uploadId,
                uploadedAt: new Date().toISOString()
            });
        } else {
            return NextResponse.json(
                { 
                    error: 'Failed to persist dataset',
                    reason: errorReason || 'UNKNOWN',
                    details: errorReason === 'STORAGE_NOT_CONFIGURED' 
                        ? 'Storage backend not configured. Please configure Redis/KV storage.'
                        : errorReason === 'REDIS_WRITE_FAILED'
                        ? 'Failed to write to storage backend. Please try again.'
                        : errorReason === 'PAYLOAD_TOO_LARGE'
                        ? 'Dataset is too large. Please reduce the size of your Excel file.'
                        : 'Storage operation failed. Please try again.'
                },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('[UPLOAD] Error saving Excel data:', error);
        return NextResponse.json(
            { 
                error: 'Failed to persist dataset',
                reason: 'UNKNOWN',
                details: process.env.NODE_ENV === 'development' 
                    ? error.message 
                    : 'An error occurred while saving your data. Please try again.'
            },
            { status: 500 }
        );
    }
}

// Helper to extract quarter range from records
function extractQuarterRange(records: any[]): string[] {
    const quarters = new Set<string>();
    records.forEach(record => {
        const quarterKey = Object.keys(record).find(key => key.toLowerCase() === 'quarter');
        if (quarterKey && record[quarterKey]) {
            quarters.add(String(record[quarterKey]).trim());
        }
    });
    return Array.from(quarters).sort();
}
