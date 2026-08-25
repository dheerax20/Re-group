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
  no_channel: {
    tone: "destructive",
    message:
      "No channel was chosen during the install, so nothing was connected. Try again and pick the channel Regroup should listen in.",
  },
  no_addon: {
    tone: "warning",
    message:
      "Connecting Slack needs the Website Builder add-on on your plan — the same one the site editor uses.",
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

  /** Slack returns the channel already prefixed sometimes, sometimes not. */
  const channel = state.channelName
    ? state.channelName.startsWith("#")
      ? state.channelName
      : `#${state.channelName}`
    : "your chosen channel";

  const price = state.addonPrice
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: state.addonPrice.currency.toUpperCase(),
        // Whole dollars read better than "$29.00" in a sentence.
        maximumFractionDigits: state.addonPrice.amount % 100 === 0 ? 0 : 2,
      }).format(state.addonPrice.amount / 100) + `/${state.addonPrice.interval}`
    : null;

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

  /**
   * No add-on, no Connect button — and no authorize URL to put on one, since
   * `getSlackConnectionState` withholds it. This is the convenience half of
   * the gate; the OAuth callback re-checks the entitlement server-side,
   * because a browser can reach that URL without ever seeing this screen.
   */
  if (!connected && !state.hasAddon) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Edit your website from Slack"
        description={`Editing from Slack is part of the Website Builder add-on${price ? ` (${price})` : ""} — the same one that powers the editor on your dashboard. Add it to connect your workspace and edit your site by typing /regroup in one channel.`}
        action={
          <Button asChild>
            <a href="/settings/billing">Add to plan</a>
          </Button>
        }
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
              <Badge variant={state.needsRebind ? "warning" : "success"} dot>
                {state.needsRebind ? "Setup unfinished" : "Connected"}
              </Badge>
            </div>

            {state.needsRebind ? (
              <CardDescription>
                This workspace was connected before channel selection existed, so
                Regroup doesn&rsquo;t know where to listen. Reconnect and pick a
                channel to finish setting it up.
              </CardDescription>
            ) : (
              <CardDescription>
                Run <code>/regroup make the welcome message warmer</code> in{" "}
                <strong>{channel}</strong> to edit your website. Only that channel,
                and only the Regroup account that connected this workspace.
              </CardDescription>
            )}

            {/*
              The design's one real limitation, stated rather than discovered.
              Rebinding happens through the install flow because Slack's own
              consent screen is what shows the channel picker.
            */}
            {!state.needsRebind ? (
              <CardDescription className="mt-2">
                To change the channel or the account that can edit, reconnect Slack.
              </CardDescription>
            ) : null}

            {state.edits ? (
              <CardDescription className="mt-2">
                {state.edits.remaining} of {state.edits.limit} AI edits left this
                month — shared with the editor on your dashboard.
              </CardDescription>
            ) : null}

            {!state.hasAddon ? (
              <CardDescription className="mt-2 text-warning">
                The Website Builder add-on isn&rsquo;t on your plan, so{" "}
                <code>/regroup</code> is switched off. Add it under{" "}
                <a className="underline" href="/settings/billing">
                  Settings → Billing
                </a>
                .
              </CardDescription>
            ) : !state.commandsEnabled ? (
              <CardDescription className="mt-2">
                Commands aren&rsquo;t switched on for this deployment yet. The
                connection is ready for when they are.
              </CardDescription>
            ) : null}
          </div>
          {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {state.authorizeUrl ? (
              <Button asChild variant={state.needsRebind ? "default" : "outline"} size="sm">
                <a href={state.authorizeUrl}>
                  {state.needsRebind ? "Reconnect to finish setup" : "Reconnect"}
                </a>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" disabled={pending} onClick={disconnect}>
              <Unplug className="size-3.5" />
              Disconnect
            </Button>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={MessageSquare}
          title="Edit your website from Slack"
          description="Connect your workspace and pick one channel. From there, /regroup changes your site with AI — and only that channel, and only this Regroup account, can do it."
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
