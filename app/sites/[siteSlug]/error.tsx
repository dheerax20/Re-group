"use client";

import { useEffect } from "react";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold text-foreground">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted">
        This page couldn&apos;t be rendered. Please try again in a moment.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}
