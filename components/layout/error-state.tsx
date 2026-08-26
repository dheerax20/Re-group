"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one error surface for every boundary in the product.
 *
 * Two rules it exists to enforce.
 *
 * First: never show a church our infrastructure. Boundaries here used to print
 * "Neon database unavailable", name the vendor's console, and list `npm run
 * db:push` as step 4 — instructions the person reading them cannot act on, for
 * a system they have never heard of, about a problem that is ours. A church
 * seeing that learns only that the product is broken and that we are careless.
 *
 * Second: never render `error.message` in production. Next redacts messages
 * thrown in Server Components, but messages thrown from Server Functions and
 * client code reach the browser intact, so printing one leaks internal detail —
 * table names, connection strings, provider errors. The real message always goes
 * to `console.error`, and is shown on screen in development only.
 */
export function ErrorState({
  title,
  description,
  error,
  retry,
  logLabel,
  className,
}: {
  title: string;
  description: string;
  error: Error & { digest?: string };
  retry?: () => void;
  /** Prefix for the console entry, e.g. "[dashboard]". */
  logLabel?: string;
  className?: string;
}) {
  useEffect(() => {
    if (logLabel) console.error(logLabel, error);
    else console.error(error);
  }, [error, logLabel]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div
      className={cn(
        "mx-auto flex max-w-lg flex-col justify-center px-4 py-16 text-center",
        className
      )}
    >
      <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
      <p className="mt-3 text-sm text-muted">{description}</p>

      {isDev ? (
        <pre className="mt-6 max-h-64 overflow-auto rounded-panel border border-border bg-surface p-4 text-left font-mono text-xs whitespace-pre-wrap text-muted">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
      ) : error.digest ? (
        // A digest is the only safe thing to show: it is an opaque id that lets
        // support correlate this screen with the server log.
        <p className="mt-4 font-mono text-[11px] text-muted">
          Reference: {error.digest}
        </p>
      ) : null}

      {retry ? (
        <div className="mt-8 flex justify-center">
          <Button onClick={retry}>Try again</Button>
        </div>
      ) : null}
    </div>
  );
}
