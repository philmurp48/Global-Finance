import { NextResponse } from 'next/server';
import { getStorageDiagnostics } from '@/lib/storage';

export const runtime = "nodejs";

export async function GET() {
  const diagnostics = getStorageDiagnostics();
  return NextResponse.json({
    ok: true,
    diagnostics
  });
}

