import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTrpcContext } from "@/server/trpc/context";

// Prisma and the Auth0 session both need Node.
export const runtime = "nodejs";

/**
 * The single tRPC endpoint.
 *
 * Note `proxy.ts` lets `/api/*` through untouched, so this is never rewritten
 * onto a tenant path — a church editing their site from `grace.regroup.app`
 * still reaches the platform API, not `/sites/grace/api/trpc`.
 */
function handler(req: NextRequest) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTrpcContext({ req }),
    onError({ error, path }) {
      // 500s are ours; 4xx are the caller's and are already in the response.
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`[trpc] ${path ?? "<no path>"} failed`, error);
      }
    },
  });
}

export { handler as GET, handler as POST };
