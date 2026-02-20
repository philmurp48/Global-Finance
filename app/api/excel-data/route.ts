import { NextRequest, NextResponse } from 'next/server';
import { getExcelData, saveExcelData } from '@/lib/db';

export async function GET() {
    try {
        const data = await getExcelData();
        if (!data) {
            return NextResponse.json({ data: null });
        }
        
        // Log what we're returning
        console.log('=== Loading Excel Data ===');
        console.log('Has namingConventionRecords:', !!data.data?.namingConventionRecords);
        console.log('namingConventionRecords count:', data.data?.namingConventionRecords?.length || 0);
        console.log('Data keys:', Object.keys(data.data || {}));
        
        return NextResponse.json({ data: data.data });
    } catch (error) {
        console.error('Error retrieving Excel data:', error);
        return NextResponse.json(
            { error: 'Failed to retrieve data' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        // Log what we're receiving
        console.log('=== Saving Excel Data ===');
        console.log('Has namingConventionRecords:', !!body.data?.namingConventionRecords);
        console.log('namingConventionRecords count:', body.data?.namingConventionRecords?.length || 0);
        console.log('Data keys:', Object.keys(body.data || {}));
        
        const success = await saveExcelData(body.data);
        
        if (success) {
            return NextResponse.json({ success: true });
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
