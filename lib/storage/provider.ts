export interface UploadResult {
  url: string;
  filename: string;
}

/**
 * Every upload path in the app must go through this abstraction — never
 * reach into filesystem/S3/Blob APIs directly from a component or route.
 * That keeps future providers (Vercel Blob, S3, R2) a one-file swap.
 */
export interface StorageProvider {
  upload(file: File | Buffer, filename: string): Promise<UploadResult>;
}

/**
 * MVP provider: writes to public/uploads and returns a local URL. Good
 * enough for local dev / demo; swap for a real object-storage provider
 * before going to production with real user uploads.
 */
class LocalStorageProvider implements StorageProvider {
  async upload(file: File | Buffer, filename: string): Promise<UploadResult> {
    const { writeFile, mkdir } = await import("fs/promises");
    const path = await import("path");

    const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    let buffer: Buffer;
    if (Buffer.isBuffer(file)) {
      buffer = file;
    } else {
      buffer = Buffer.from(await file.arrayBuffer());
    }
    await writeFile(path.join(uploadsDir, safeName), buffer);

    return { url: `/uploads/${safeName}`, filename: safeName };
  }
}

let storageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!storageProvider) {
    storageProvider = new LocalStorageProvider();
  }
  return storageProvider;
}
