import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStorageProvider } from "@/lib/storage/provider";
import { prisma } from "@/lib/db";
import { authorizeSiteRequest } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";

// Signature-free but session-bound: needs Node for Prisma and the S3 client.
export const runtime = "nodejs";

const mediaTypeSchema = z.enum(["LOGO", "FAVICON", "IMAGE", "VIDEO", "OTHER"]);

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Uploads a church logo, favicon, or photo.
 *
 * Two things this route must never skip. First, authorization: `siteId` arrives
 * in the form body, so without an ownership check any caller could write media
 * rows against another church's site and fill the bucket. Second, content
 * sniffing: `file.type` is supplied by the client and is not evidence of
 * anything, so the real bytes are inspected before the file is stored.
 *
 * SVG is deliberately absent from the accepted list. An SVG is a document that
 * can carry script, and these files are served from a public bucket domain and
 * rendered into church websites.
 */

/** Magic-byte signatures for the formats we accept, checked against the bytes. */
const SIGNATURES: Array<{
  mime: string;
  extension: string;
  matches: (bytes: Uint8Array) => boolean;
}> = [
  {
    mime: "image/png",
    extension: "png",
    matches: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: "image/jpeg",
    extension: "jpg",
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/webp",
    extension: "webp",
    matches: (b) =>
      // "RIFF" .... "WEBP"
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    mime: "image/gif",
    extension: "gif",
    matches: (b) =>
      b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  },
  {
    mime: "image/x-icon",
    extension: "ico",
    matches: (b) => b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00,
  },
];

function detectImage(bytes: Uint8Array) {
  return SIGNATURES.find((signature) => signature.matches(bytes)) ?? null;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const siteId = formData.get("siteId");
  const type = formData.get("type");

  const auth = await authorizeSiteRequest(siteId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // 40 uploads per 10 minutes is far above a real editing session and far below
  // anything that could fill a bucket.
  const limit = await rateLimit(`upload:${auth.user.id}`, 40, 600);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many uploads. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const parsedType = mediaTypeSchema.safeParse(type);
  if (!parsedType.success) {
    return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImage(buffer.subarray(0, 16));
  if (!detected) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PNG, JPEG, WebP, GIF, or ICO." },
      { status: 400 }
    );
  }

  // Name the object from what the bytes actually are, not from what the client
  // called the file — an uploaded `logo.svg` holding PNG bytes becomes .png.
  const baseName =
    file.name.replace(/\.[^.]*$/, "").slice(0, 60) || parsedType.data.toLowerCase();
  const storage = getStorageProvider();
  const result = await storage.upload(buffer, `${baseName}.${detected.extension}`, {
    contentType: detected.mime,
  });

  const media = await prisma.media.create({
    data: {
      siteId: auth.siteId,
      type: parsedType.data,
      url: result.url,
      filename: result.filename,
    },
  });

  return NextResponse.json({ url: media.url, mediaId: media.id });
}
