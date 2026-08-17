import { Prisma } from "@prisma/client";

/**
 * The database is unreachable.
 *
 * `message` is deliberately plain and vendor-free, because it is the string
 * that reaches a browser when this escapes to an error boundary or a Server
 * Function. It previously named the hosting provider and told the reader to run
 * `npm run db:push` — instructions a church cannot act on, about infrastructure
 * that is our responsibility.
 *
 * The operator-facing detail lives in `DEV_HINT` and is logged, never rendered.
 */
export class DatabaseUnavailableError extends Error {
  constructor(message = "We couldn't reach our database. Please try again in a moment.") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

/**
 * What an operator should check. Logged on the server only.
 *
 * Kept accurate for the current setup: managed Postgres on a free tier
 * suspends when idle, so the first request after a quiet period can fail while
 * the instance wakes — which is also why `withDbRetry` exists.
 */
const DEV_HINT =
  "Database unreachable. If this is a free-tier instance it may be paused — " +
  "wake it in your provider's console, confirm DATABASE_URL points at the " +
  "pooled connection string, then retry.";

export function isDatabaseUnavailableError(error: unknown): boolean {
  if (error instanceof DatabaseUnavailableError) return true;
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1001" || error.code === "P1017" || error.code === "P1000";
  }
  return (
    error instanceof Error &&
    /Can't reach database server|ECONNREFUSED|P1001|P1017/i.test(error.message)
  );
}

export function toDatabaseError(error: unknown): never {
  if (isDatabaseUnavailableError(error)) {
    // The cause and the hint go to the server log; only the plain message
    // travels to the client.
    console.error(`[db] ${DEV_HINT}`, error);
    throw new DatabaseUnavailableError();
  }
  throw error;
}
