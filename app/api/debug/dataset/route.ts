import { NextResponse } from "next/server";
import { getDataset, getStorageDiagnostics } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const uploadId = url.searchParams.get("uploadId");
  if (!uploadId) return NextResponse.json({ found: false, error: "MISSING_UPLOAD_ID" }, { status: 400 });
  const ds = await getDataset(uploadId);
  const diagnostics = getStorageDiagnostics();
  return NextResponse.json({
    found: !!ds,
    uploadId,
    hasData: !!ds,
    uploadedAt: ds?.uploadedAt ?? null,
    diagnostics: {
      backend: diagnostics.backend,
      hasKVRest: diagnostics.hasKVRest,
      hasUpstash: diagnostics.hasUpstash,
      urlHost: diagnostics.urlHost
    }
  });
}
