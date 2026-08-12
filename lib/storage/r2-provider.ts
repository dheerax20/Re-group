import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { StorageProvider, UploadResult } from "./provider";

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

  async upload(file: File | Buffer, filename: string): Promise<UploadResult> {
    const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

    let body: Buffer;
    let contentType: string | undefined;
    if (Buffer.isBuffer(file)) {
      body = file;
    } else {
      body = Buffer.from(await file.arrayBuffer());
      contentType = file.type || undefined;
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: safeName,
        Body: body,
        ContentType: contentType,
      })
    );

    return { url: `${this.publicUrl}/${safeName}`, filename: safeName };
  }
}
