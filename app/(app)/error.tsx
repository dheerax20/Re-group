"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppError({
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
    /database|Can't reach|P1001|P1017|ECONNREFUSED|DatabaseUnavailable|Neon/i.test(
      error.message
    );

  return (
    <div className="mx-auto flex max-w-lg flex-col justify-center py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isDb ? "Neon database unavailable" : "Something went wrong"}
      </h1>
      <p className="mt-3 text-sm text-muted">
        {isDb
          ? "Free Neon projects pause when idle. Open Neon console to wake it, wait a few seconds, then retry."
          : error.message}
      </p>
      {isDb ? (
        <pre className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface p-4 text-left text-xs text-muted">
{`1. Open console.neon.tech → your project
2. Confirm the DB is Active (not Paused)
3. Copy the pooled connection string into .env
4. npm run db:push
5. Refresh this page`}
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
  );
}
