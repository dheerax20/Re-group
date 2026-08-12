import { Prisma } from "@prisma/client";

export class DatabaseUnavailableError extends Error {
  constructor(
    message = "Can't reach Neon. Open the Neon console to wake the project, confirm DATABASE_URL, then retry."
  ) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

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
    throw new DatabaseUnavailableError(
      "Can't reach Neon Postgres. Wake the project in the Neon dashboard (free tier pauses when idle), check DATABASE_URL in .env, then run `npm run db:push`."
    );
  }
  throw error;
}
