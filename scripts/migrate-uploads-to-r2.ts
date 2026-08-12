import { readdir, readFile } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

try {
  process.loadEnvFile();
} catch {
  // no .env file next to cwd — assume env vars are already set (e.g. CI)
}

const prisma = new PrismaClient();

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function main() {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  const files = await readdir(uploadsDir).catch(() => [] as string[]);

  if (files.length === 0) {
    console.log("No files in public/uploads — nothing to migrate.");
    return;
  }

  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const bucket = requiredEnv("R2_BUCKET_NAME");
  const publicUrl = requiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "");

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });

  let migrated = 0;
  let orphaned = 0;

  for (const filename of files) {
    const media = await prisma.media.findFirst({
      where: { url: `/uploads/${filename}` },
    });

    if (!media) {
      console.warn(`[orphan] ${filename} has no matching Media row — skipped.`);
      orphaned += 1;
      continue;
    }

    const body = await readFile(path.join(uploadsDir, filename));
    const contentType = MIME_TYPES[path.extname(filename).toLowerCase()];
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: filename, Body: body, ContentType: contentType })
    );

    const newUrl = `${publicUrl}/${filename}`;
    await prisma.media.update({ where: { id: media.id }, data: { url: newUrl } });

    console.log(`[migrated] ${filename} -> ${newUrl}`);
    migrated += 1;
  }

  console.log(`\nDone. Migrated ${migrated}, orphaned ${orphaned}.`);
  if (orphaned === 0) {
    console.log("All files matched a Media row — safe to `rm -rf public/uploads` once you've spot-checked a URL.");
  } else {
    console.log("Some files had no Media row — check them manually before deleting public/uploads.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
