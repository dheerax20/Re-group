import { api } from "@/server/trpc/caller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const site = await (await api()).site.config({ siteId: siteId });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }
  return NextResponse.json(site);
}
