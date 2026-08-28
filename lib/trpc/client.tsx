"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/trpc/routers/_app";

export const trpc = createTRPCReact<AppRouter>();

/**
 * Same origin, always.
 *
 * A church editing from `grace.regroup.app` must call `/api/trpc` on that same
 * host — an absolute URL built from the platform root would be a cross-origin
 * request, and the Clerk session cookie would not travel with it.
 */
function apiUrl() {
  return "/api/trpc";
}

export function TrpcProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // The editor is a long-lived screen; refetching the whole site
            // payload every time the window regains focus is churn nobody
            // asked for, and mutations already invalidate what they touched.
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            retry(failureCount, error) {
              // Auth, plan, and ownership failures will never succeed on a
              // retry — retrying them just delays the message.
              const code = (error as { data?: { code?: string } })?.data?.code;
              if (
                code === "UNAUTHORIZED" ||
                code === "FORBIDDEN" ||
                code === "PAYMENT_REQUIRED" ||
                code === "TOO_MANY_REQUESTS"
              ) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      })
  );

  const [client] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: apiUrl(), transformer: superjson })],
    })
  );

  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
