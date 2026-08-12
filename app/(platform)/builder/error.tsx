"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RegroupLogo } from "@/components/layout/regroup-logo";

export default function BuilderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDb =
    /database|Can't reach|P1001|P1017|ECONNREFUSED|DatabaseUnavailable/i.test(
      error.message
    );

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8">
      <RegroupLogo href="/" />
      <div className="mx-auto flex max-w-lg flex-1 flex-col justify-center text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isDb ? "Database unavailable" : "Something went wrong"}
        </h1>
        <p className="mt-3 text-sm text-muted">
          {isDb
            ? "Neon is not reachable. Free projects pause when idle — wake it in the Neon console, confirm DATABASE_URL, then retry."
            : error.message}
        </p>
        {isDb ? (
          <pre className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface p-4 text-left text-xs text-muted">
{`1. Open console.neon.tech → your project (wake if Paused)
2. Copy pooled connection string → .env as DATABASE_URL
3. npm run db:push
4. Refresh / try again`}
          </pre>
        ) : null}
        <div className="mt-8 flex justify-center gap-3">
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
          <Link href="/">
            <Button>Back home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
