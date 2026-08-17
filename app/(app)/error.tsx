"use client";

import { ErrorState } from "@/components/layout/error-state";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      logLabel="[app]"
      title="We couldn't load this page"
      description="Something went wrong on our side. Your website and content are safe — try again in a moment."
      error={error}
      retry={retry}
    />
  );
}
