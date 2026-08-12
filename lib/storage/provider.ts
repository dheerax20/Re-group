import { R2StorageProvider } from "./r2-provider";

export interface UploadResult {
  url: string;
  filename: string;
}

/**
 * Every upload path in the app must go through this abstraction — never
 * reach into filesystem/S3/Blob APIs directly from a component or route.
 * That keeps switching providers a one-file change.
 */
export interface StorageProvider {
  upload(file: File | Buffer, filename: string): Promise<UploadResult>;
}

let storageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!storageProvider) {
    storageProvider = new R2StorageProvider();
  }
  return storageProvider;
}
