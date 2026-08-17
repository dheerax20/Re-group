"use client";

import { ErrorState } from "@/components/layout/error-state";
import { RegroupLogo } from "@/components/layout/regroup-logo";

export default function BuilderError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8">
      <RegroupLogo href="/" />
      <div className="flex flex-1 items-center justify-center">
        <ErrorState
          logLabel="[builder]"
          title="We couldn't continue setting up your website"
          description="Something went wrong on our side. Nothing you've entered so far has been lost — try again in a moment."
          error={error}
          retry={retry}
          className="py-0"
        />
      </div>
    </div>
  );
}
