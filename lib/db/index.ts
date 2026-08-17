import { PrismaClient } from "@prisma/client";

/**
 * Serverless Postgres suspends when idle, and waking it is not fast: a cold
 * `SELECT 1` against this project measured 3.2s, and a schema sync 13s. The
 * first request after a quiet period therefore used to fail outright and show
 * an error page, which is the single most common way this app looked broken
 * when nothing was actually wrong.
 *
 * So connection failures are retried here, inside the client, rather than at
 * call sites — the old `withDbRetry` helper only wrapped the handful of places
 * somebody remembered to wrap.
 */

const RETRY_DELAYS_MS = [400, 1_200, 3_000, 6_000];

/**
 * Only failures where the query provably never ran.
 *
 * This is what makes a blind retry safe: P1001/P1017 and a refused socket all
 * mean the connection was never established, so nothing was executed and
 * nothing can be executed twice. A timeout mid-query is deliberately NOT in
 * here — retrying that could duplicate a write.
 */
function isConnectionFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  const code = (error as { code?: string } | null)?.code ?? "";
  return (
    code === "P1001" ||
    code === "P1017" ||
    /Can't reach database server|Server has closed the connection|ECONNREFUSED|ETIMEDOUT|Connection terminated/i.test(
      message
    )
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return base.$extends({
    name: "wake-retry",
    query: {
      async $allOperations({ operation, model, args, query }) {
        let lastError: unknown;

        for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
          try {
            return await query(args);
          } catch (error) {
            if (!isConnectionFailure(error)) throw error;

            lastError = error;
            const delay = RETRY_DELAYS_MS[attempt];
            if (delay === undefined) break;

            console.warn(
              `[db] ${model ?? "raw"}.${operation} could not reach the database ` +
                `(attempt ${attempt + 1}); retrying in ${delay}ms — the instance is ` +
                `probably waking from idle.`
            );
            await sleep(delay);
          }
        }

        throw lastError;
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

/**
 * The transaction client, derived from the extended client rather than taken
 * from `Prisma.TransactionClient`.
 *
 * A `$extends` call produces a structurally different client type, so the
 * generated `Prisma.TransactionClient` no longer describes what
 * `prisma.$transaction` actually hands its callback. Helpers that accept
 * "either the client or a transaction" must use these types.
 */
export type PrismaTransactionClient = Parameters<
  Parameters<ExtendedPrismaClient["$transaction"]>[0]
>[0];

/** Either the long-lived client or a transaction, for helpers that take both. */
export type DbClient = PrismaTransactionClient | ExtendedPrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Retained for the call sites that already use it, but the client above now
 * retries every query, so new code does not need this.
 *
 * @deprecated Connection retries are handled by the Prisma client extension.
 */
export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}
