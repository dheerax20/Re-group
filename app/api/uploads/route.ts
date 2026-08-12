import { NextRequest, NextResponse } from "next/server";
import { getStorageProvider } from "@/lib/storage/provider";
import { prisma } from "@/lib/db";
import { z } from "zod";

const mediaTypeSchema = z.enum(["LOGO", "FAVICON", "IMAGE", "VIDEO", "OTHER"]);

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon"]);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const siteId = formData.get("siteId");
  const type = formData.get("type");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (typeof siteId !== "string" || !siteId) {
    return NextResponse.json({ error: "Missing siteId" }, { status: 400 });
  }

  const parsedType = mediaTypeSchema.safeParse(type);
  if (!parsedType.success) {
    return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const storage = getStorageProvider();
  const result = await storage.upload(file, file.name);

  const media = await prisma.media.create({
    data: {
      siteId,
      type: parsedType.data,
      url: result.url,
      filename: result.filename,
    },
  });

  return NextResponse.json({ url: media.url, mediaId: media.id });
}
