import { R2StorageProvider } from "./r2-provider";

export interface UploadResult {
  url: string;
  filename: string;
}

export interface UploadOptions {
  /**
   * The MIME type to store the object under. Callers must pass the type they
   * detected from the bytes, not one taken from client input — the stored
   * Content-Type is what a browser will trust when the file is served back.
   */
  contentType?: string;
}

/**
 * Every upload path in the app must go through this abstraction — never
 * reach into filesystem/S3/Blob APIs directly from a component or route.
 * That keeps switching providers a one-file change.
 */
export interface StorageProvider {
  upload(
    file: File | Buffer,
    filename: string,
    options?: UploadOptions
  ): Promise<UploadResult>;
}

let storageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!storageProvider) {
    storageProvider = new R2StorageProvider();
  }
  return storageProvider;
}
