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
        const success = await saveDataset(uploadId, body.data, metadata);
        
        if (success) {
            // Also save to legacy storage for backward compatibility
            await saveExcelData(body.data);
            
            return NextResponse.json({ 
                success: true, 
                uploadId: uploadId,
                uploadedAt: new Date().toISOString()
            });
        } else {
            return NextResponse.json(
                { error: 'Failed to save data' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Error saving Excel data:', error);
        return NextResponse.json(
            { error: 'Failed to save data' },
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
