import { NextRequest, NextResponse } from 'next/server';
import { getDataset } from '@/lib/storage';

export const runtime = "nodejs";

// GET - require uploadId (no legacy format)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const uploadId = searchParams.get('uploadId');

        if (!uploadId) {
            console.error('[EXCEL-DATA] MISSING_UPLOAD_ID', { url: request.url });
            return NextResponse.json(
                { error: 'MISSING_UPLOAD_ID', message: 'uploadId query parameter is required' },
                { status: 400 }
            );
        }

        // Defensive logging
        const hasKVUrl = !!process.env.KV_REST_API_URL;
        const hasKVToken = !!process.env.KV_REST_API_TOKEN;
        console.log('[EXCEL-DATA] GET request', { uploadId, hasKVUrl, hasKVToken });

        const dataset = await getDataset(uploadId);
        const datasetFound = !!dataset;
        const hasData = !!dataset?.data;
        
        console.log('[EXCEL-DATA] dataset lookup', { 
            uploadId, 
            found: datasetFound,
            hasData,
            backend: datasetFound ? 'redis-or-memory' : 'none'
        });

        if (!dataset) {
            console.error('[EXCEL-DATA] DATASET_NOT_FOUND', { uploadId, hasKVUrl, hasKVToken });
            return NextResponse.json(
                { error: 'DATASET_NOT_FOUND', uploadId },
                { status: 404 }
            );
        }

        return NextResponse.json({ 
            data: dataset.data, 
            uploadId: dataset.uploadId,
            uploadedAt: dataset.uploadedAt,
            metadata: dataset.metadata
        });
    } catch (error) {
        console.error('Error retrieving Excel data:', error);
        return NextResponse.json(
            { error: 'Failed to retrieve data' },
            { status: 500 }
        );
    }
}

// POST - DEPRECATED: This endpoint MUST NOT generate uploadId
// All uploads should go through /api/upload
export async function POST(request: NextRequest) {
    return NextResponse.json(
        { 
            error: 'ENDPOINT_DEPRECATED',
            message: 'This endpoint no longer accepts uploads. Use /api/upload instead.',
            details: 'To ensure atomic persistence, all uploads must go through /api/upload which generates a single authoritative uploadId.'
        },
        { status: 410 } // 410 Gone
    );
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
