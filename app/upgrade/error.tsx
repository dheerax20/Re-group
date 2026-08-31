"use client";

import { ErrorState } from "@/components/layout/error-state";

export default function UpgradeError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <ErrorState
        logLabel="[upgrade]"
        title="Plans aren't available right now"
        description="This is on us, not you. Please try again in a moment — you haven't been charged."
        error={error}
        retry={retry}
          className="py-0"
      />
    </main>
  );
}
