import { NextRequest, NextResponse } from "next/server";
import { getSite } from "@/lib/site/actions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }
  return NextResponse.json(site);
}
