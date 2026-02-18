import { NextRequest, NextResponse } from 'next/server';
import { getExcelData, saveExcelData } from '@/lib/db';

export async function GET() {
    try {
        const data = await getExcelData();
        if (!data) {
            return NextResponse.json({ data: null });
        }
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
