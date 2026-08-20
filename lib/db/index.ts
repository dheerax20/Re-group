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
 *
 * Two schedules, because the two failure shapes need different patience: a
 * refused connection fails instantly and wants a long backoff, while a pool
 * timeout has already spent `pool_timeout` waiting and wants a short one.
 * Both are safe to retry on the same grounds — the query never ran.
 */

const RETRY_DELAYS_MS = [400, 1_200, 3_000, 6_000];

/**
 * Pool-acquisition timeouts get their own, much shorter budget.
 *
 * The attempt that just failed already blocked for the whole `pool_timeout`
 * (10s unless the connection URL says otherwise), so the useful part of a
 * backoff has effectively already happened. Retrying these on the schedule
 * above would make a single page hang for the better part of a minute before
 * giving up — worse for the church than the error it is trying to avoid.
 */
const POOL_TIMEOUT_DELAYS_MS = [250, 750];

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

/**
 * P2024 — timed out waiting for a free connection from the pool.
 *
 * Retryable for exactly the same reason as the failures above, and by the same
 * rule: the query never got a connection, so it provably never ran and cannot
 * run twice. It is kept separate only because it deserves a different delay
 * schedule, not a different safety judgement.
 *
 * This is the error a cold start actually surfaces as under any concurrency.
 * Opening a connection to a suspended serverless instance costs seconds
 * (measured: 3.4s cold, ~300ms warm per new connection on this project), so a
 * page that fires several queries while the instance is waking can exhaust the
 * pool's patience before it exhausts its connections — and the retry that this
 * whole file exists to provide never fired, because P2024 was not on the list.
 */
function isPoolTimeout(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2024";
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
        let attempt = 0;

        for (;;) {
          try {
            return await query(args);
          } catch (error) {
            // Each kind carries its own schedule; anything not on a list is
            // rethrown untouched, including every mid-query failure.
            const delays = isPoolTimeout(error)
              ? POOL_TIMEOUT_DELAYS_MS
              : isConnectionFailure(error)
                ? RETRY_DELAYS_MS
                : null;
            if (!delays) throw error;

            lastError = error;
            const delay = delays[attempt];
            if (delay === undefined) break;

            console.warn(
              `[db] ${model ?? "raw"}.${operation} ` +
                (isPoolTimeout(error)
                  ? `timed out waiting for a pooled connection`
                  : `could not reach the database`) +
                ` (attempt ${attempt + 1}); retrying in ${delay}ms — the instance ` +
                `is probably waking from idle.`
            );
            await sleep(delay);
            attempt += 1;
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
