import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { StorageProvider, UploadOptions, UploadResult } from "./provider";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function buildClient(): S3Client {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

/** Uploads to a Cloudflare R2 bucket via its S3-compatible API. */
export class R2StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.client = buildClient();
    this.bucket = requiredEnv("R2_BUCKET_NAME");
    this.publicUrl = requiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "");
  }

  async upload(
    file: File | Buffer,
    filename: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    // A UUID prefix rather than `Date.now()`: two uploads of the same filename
    // inside one millisecond would otherwise overwrite each other, and the
    // timestamp let a caller guess other tenants' object keys.
    const sanitized = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(0, 80);
    const key = `${randomUUID()}-${sanitized}`;

    let body: Buffer;
    let contentType = options.contentType;
    if (Buffer.isBuffer(file)) {
      body = file;
    } else {
      body = Buffer.from(await file.arrayBuffer());
      contentType = contentType ?? file.type ?? undefined;
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Objects are content-addressed by their UUID key and never rewritten,
        // so they can be cached indefinitely.
        CacheControl: "public, max-age=31536000, immutable",
        // Belt and braces: even if an unexpected type reaches the bucket, the
        // browser must not be allowed to sniff its way to executing it.
        ContentDisposition: "inline",
      })
    );

    return { url: `${this.publicUrl}/${key}`, filename: key };
  }
}
