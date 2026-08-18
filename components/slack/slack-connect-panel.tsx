"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, MessageSquare, Unplug } from "lucide-react";
import { disconnectSlack, type SlackConnectionState } from "@/lib/slack/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";

const NOTICE_COPY: Record<string, { tone: "warning" | "destructive"; message: string }> = {
  cancelled: { tone: "warning", message: "Connection cancelled — nothing was changed." },
  expired: {
    tone: "warning",
    message: "That connection link expired. Click Connect Slack to try again.",
  },
  invalid_request: { tone: "destructive", message: "That link was invalid. Try connecting again." },
  failed: { tone: "destructive", message: "Slack couldn't complete the connection. Try again." },
  team_taken: {
    tone: "destructive",
    message: "That Slack workspace is already connected to a different site.",
  },
};

export function SlackConnectPanel({
  siteId,
  state,
  notice,
}: {
  siteId: string;
  state: SlackConnectionState;
  notice?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(state.connected);

  const activeNotice = notice ? NOTICE_COPY[notice] : undefined;

  function disconnect() {
    setError(null);
    startTransition(async () => {
      const result = await disconnectSlack(siteId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setConnected(false);
    });
  }

  if (!state.enabled) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Slack isn't switched on yet"
        description="This deployment has no Slack app configured. Nothing else about your site is affected."
      />
    );
  }

  return (
    <div className="space-y-4">
      {activeNotice ? (
        <Card
          variant="flat"
          className={
            activeNotice.tone === "warning"
              ? "border-warning/30 bg-warning-soft"
              : "border-destructive/30 bg-destructive-soft"
          }
        >
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle
              className={
                activeNotice.tone === "warning"
                  ? "mt-0.5 size-4 shrink-0 text-warning"
                  : "mt-0.5 size-4 shrink-0 text-destructive"
              }
            />
            {activeNotice.message}
          </p>
        </Card>
      ) : null}

      {connected ? (
        <Card className="flex flex-wrap items-center gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
            <CheckCircle2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{state.teamName}</CardTitle>
              <Badge variant="success" dot>
                Connected
              </Badge>
            </div>
            <CardDescription>
              Your workspace is linked. Messaging your site&rsquo;s assistant from Slack is
              coming soon — this just connects the two so it&rsquo;s ready when it lands.
            </CardDescription>
          </div>
          {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={disconnect}
            className="w-full sm:w-auto"
          >
            <Unplug className="size-3.5" />
            Disconnect
          </Button>
        </Card>
      ) : (
        <EmptyState
          icon={MessageSquare}
          title="Connect your church's Slack"
          description="Link your workspace now so it's ready the moment Slack messaging support lands. Nothing sends or changes anything yet."
          action={
            <Button asChild>
              <a href={state.authorizeUrl}>Connect Slack</a>
            </Button>
          }
        />
      )}
    </div>
  );
}
