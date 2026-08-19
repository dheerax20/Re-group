"use client";

import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

/**
 * "Regenerate with AI".
 *
 * This was a form posting a server action that queued the crew and then
 * redirected. It is a mutation now for one concrete reason: the action had no
 * way to report a refused build. Hitting the monthly cap or the ten-minute
 * cooldown redirected to a page that simply showed the old site again, with
 * nothing said — the church pressed the button and nothing appeared to happen.
 *
 * The refusal copy comes from `assertAiBudget` and already names the reset
 * date, so it is shown as-is rather than reworded here.
 */
export function RebuildButton({ siteId }: { siteId: string }) {
  const router = useRouter();

  const startBuild = trpc.ai.startBuild.useMutation({
    onSuccess() {
      // The page re-renders with a live job, which swaps in the studio.
      router.refresh();
    },
  });

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => startBuild.mutate({ siteId })}
        disabled={startBuild.isPending}
      >
        {startBuild.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        Regenerate with AI
      </Button>

      {startBuild.error ? (
        <p className="text-sm text-destructive">{startBuild.error.message}</p>
      ) : null}
    </div>
  );
}
