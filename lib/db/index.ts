import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Neon free-tier can take a few seconds to wake from pause — retry once. */
export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const unreachable = /Can't reach database server|P1001|P1017|ECONNREFUSED/i.test(
      message
    );
    if (!unreachable) throw error;
    await new Promise((r) => setTimeout(r, 1500));
    return fn();
  }
}
