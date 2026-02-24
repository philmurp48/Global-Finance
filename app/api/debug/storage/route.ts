import { NextResponse } from 'next/server';
import { storageDiagnostics } from '@/lib/storage';

export const runtime = "nodejs";

export async function GET() {
  const diagnostics = storageDiagnostics();
  return NextResponse.json({
    ok: true,
    diagnostics
  });
}

