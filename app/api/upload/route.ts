import { NextRequest, NextResponse } from 'next/server';
import { saveDataset, generateUploadId } from '@/lib/storage';
import { ExcelDriverTreeData } from '@/lib/excel-parser';

/**
 * Upload endpoint: Accepts parsed Excel data and saves it to storage
 * Returns uploadId only if save succeeds
 */
export async function POST(request: NextRequest) {
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

        // Generate unique uploadId
        const uploadId = generateUploadId();

        // Prepare data for storage (convert Maps to arrays/objects for JSON serialization)
        const storageData = {
            tree: data.tree || [],
            accountingFacts: data.accountingFacts 
                ? Array.from((data.accountingFacts as Map<string, any>).entries()) 
                : [],
            factMarginRecords: data.factMarginRecords || [],
            dimensionTables: data.dimensionTables 
                ? Object.fromEntries(
                    Array.from((data.dimensionTables as Map<string, Map<string, any>>).entries()).map(([tableName, records]) => [
                        tableName,
                        Object.fromEntries((records as Map<string, any>).entries())
                    ])
                )
                : {},
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

        const metadata = {
            fileName: fileName || 'uploaded_file.xlsx',
            recordCount,
            quarterRange
        };

        // Save dataset - MUST succeed before returning uploadId
        const saveSuccess = await saveDataset(uploadId, storageData, metadata);

        if (!saveSuccess) {
            console.error('[UPLOAD] Failed to save dataset:', uploadId);
            return NextResponse.json(
                { 
                    error: 'Failed to persist dataset',
                    details: 'Storage operation returned false. Please try again.'
                },
                { status: 500 }
            );
        }

        // DEV-only log
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[UPLOAD] saved dataset: uploadId=${uploadId}, records=${recordCount}, quarters=${quarterRange.length}`);
        }

        // Only return uploadId if save succeeded
        return NextResponse.json({
            uploadId,
            metadata: {
                recordCount,
                quarterRange,
                fileName: metadata.fileName
            }
        }, { status: 200 });

    } catch (error: any) {
        console.error('[UPLOAD] Error processing upload:', error);
        
        return NextResponse.json(
            { 
                error: 'Failed to persist dataset',
                details: process.env.NODE_ENV === 'development' 
                    ? error.message 
                    : 'An error occurred while saving your data. Please try again.'
            },
            { status: 500 }
        );
    }
}

