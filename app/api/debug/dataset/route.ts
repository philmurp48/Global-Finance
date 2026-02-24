import { NextResponse } from "next/server";
import { getDataset } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const uploadId = url.searchParams.get("uploadId");
  if (!uploadId) return NextResponse.json({ found: false, error: "MISSING_UPLOAD_ID" }, { status: 400 });
  const ds = await getDataset(uploadId);
  return NextResponse.json({
    found: !!ds,
    uploadId,
    hasData: !!ds,
    uploadedAt: ds?.uploadedAt ?? null,
  });
}
