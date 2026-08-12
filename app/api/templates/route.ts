import { NextResponse } from "next/server";
import { allTemplates } from "@/lib/templates/registry";

export async function GET() {
  return NextResponse.json(
    allTemplates.map((t) => ({
      id: t.id,
      version: t.version,
      metadata: t.metadata,
    }))
  );
}
