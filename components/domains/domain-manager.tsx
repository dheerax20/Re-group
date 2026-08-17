"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import {
  addDomain,
  refreshDomains,
  removeDomain,
  setPrimaryDomain,
  verifyDomain,
  type DomainsState,
} from "@/lib/domains/actions";
import type { DomainGroup } from "@/lib/domains/actions-support";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CopyField } from "@/components/ui/copy-field";
import { EmptyState } from "@/components/layout/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Connecting a domain is where churches get stuck, and always for the same
 * reason: they cannot tell whether they are waiting on DNS, waiting on us, or
 * have made a typo.
 *
 * Two decisions follow from that. One domain is one card — the apex and its
 * `www.` are shown together with a single status, because "gracechurch.org" is
 * one thing to the person reading it. And there are no options: the www. version
 * is always connected, since asking made a church guess at DNS trivia and
 * getting it wrong meant visitors who type `www.` hit an error.
 */

function presentStatus(group: DomainGroup): {
  label: string;
  variant: "success" | "warning" | "info";
  explanation: string;
} {
  if (group.status === "ACTIVE") {
    return {
      label: "Working",
      variant: "success",
      explanation: "Visitors can reach your website at this address.",
    };
  }
  if (group.status === "PENDING_VERIFICATION") {
    return {
      label: "Needs one more record",
      variant: "warning",
      explanation:
        "This domain is registered with another Vercel account, so we need proof it is yours. Add the TXT record below.",
    };
  }
  return {
    label: "Waiting for your registrar",
    variant: "info",
    explanation:
      "Add the records below where you bought the domain. They usually start working within an hour.",
  };
}

function RecordRow({
  record,
}: {
  record: { type: string; name: string; value: string; note?: string };
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start">
      <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
        <Badge variant="outline">{record.type}</Badge>
        <code className="font-mono text-xs text-muted">{record.name}</code>
      </div>
      <div className="min-w-0">
        <CopyField value={record.value} />
        {record.note ? (
          <p className="mt-1 text-[11px] text-muted">{record.note}</p>
        ) : null}
      </div>
    </div>
  );
}

function DomainCard({
  siteId,
  group,
  onChanged,
}: {
  siteId: string;
  group: DomainGroup;
  onChanged: (next: DomainsState) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const status = presentStatus(group);
  const isWorking = group.status === "ACTIVE";

  function run(work: () => Promise<string | null>) {
    setMessage(null);
    startTransition(async () => {
      const error = await work();
      setMessage(error);
      onChanged(await refreshDomains(siteId));
    });
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            isWorking ? "bg-success-soft text-success" : "bg-surface-muted text-muted"
          )}
        >
          {isWorking ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Globe className="size-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{group.root}</p>
            {group.isPrimary ? <Badge variant="accent">Main address</Badge> : null}
          </div>
          <p className="mt-0.5 text-xs text-muted">{status.explanation}</p>
        </div>

        <Badge variant={status.variant} dot>
          {status.label}
        </Badge>

        <div className="flex items-center gap-1">
          {isWorking && !group.isPrimary ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await setPrimaryDomain(siteId, group.root);
                  return result.success ? null : result.error;
                })
              }
            >
              <Star className="size-3.5" />
              Make main
            </Button>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            aria-label={`Disconnect ${group.root}`}
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await removeDomain(siteId, group.root);
                return result.success ? null : result.error;
              })
            }
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/*
        Records stay visible until the domain works. A church that has not
        finished setting up DNS should never have to find a disclosure triangle
        to see what they still owe; once it works, the detail is just noise.
      */}
      {isWorking ? (
        <div className="border-t border-border bg-background px-4 py-3">
          <p className="text-xs text-muted">
            Reaching your site at{" "}
            {group.hostnames.map((view, index) => (
              <span key={view.hostname}>
                {index > 0 ? " and " : ""}
                <span className="font-medium text-foreground">{view.hostname}</span>
              </span>
            ))}
            .
          </p>
        </div>
      ) : (
        <div className="space-y-4 border-t border-border bg-background px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              Add these at your registrar
            </p>
            <p className="mt-1 text-xs text-muted">
              Wherever you bought {group.root} — GoDaddy, Namecheap, Google
              Domains — find the DNS settings and add each row exactly as shown.
            </p>
            <div className="mt-3 space-y-3">
              {group.records.map((record) => (
                <RecordRow key={`${record.type}-${record.name}`} record={record} />
              ))}
            </div>
          </div>

          {group.verification.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                Then add this one to prove the domain is yours
              </p>
              <div className="mt-3 space-y-3">
                {group.verification.map((record) => (
                  <RecordRow key={record.value} record={record} />
                ))}
              </div>
            </div>
          ) : null}

          {message ? (
            <p className="flex items-start gap-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await verifyDomain(siteId, group.root);
                  return result.success ? null : result.error;
                })
              }
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              I&rsquo;ve added them — check now
            </Button>
            <span className="text-xs text-muted">
              {group.lastCheckedAt
                ? `Last checked ${new Date(group.lastCheckedAt).toLocaleTimeString()}`
                : "Not checked yet"}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

export function DomainManager({
  siteId,
  initialState,
}: {
  siteId: string;
  initialState: DomainsState;
}) {
  const [state, setState] = useState(initialState);
  const [hostname, setHostname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await addDomain(siteId, hostname);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setHostname("");
      setNotice(
        `${result.root} is connected. Add the DNS records below to finish.`
      );
      setState(await refreshDomains(siteId));
    });
  }

  if (!state.enabled) {
    return (
      <EmptyState
        icon={Globe}
        title="Custom domains aren't switched on yet"
        description="Your website is still live on its Regroup address — this deployment just cannot connect outside domains."
        action={
          <a
            href={`https://${state.platformHost}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">Visit {state.platformHost}</Button>
          </a>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle className="text-base">Use a domain you own</CardTitle>
        <CardDescription>
          Type the domain you bought. We connect it along with its{" "}
          <code className="font-mono text-xs">www.</code> version, so both work.
          Your Regroup address{" "}
          <span className="font-medium text-foreground">{state.platformHost}</span>{" "}
          keeps working either way.
        </CardDescription>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <Label htmlFor="hostname" className="sr-only">
                Domain
              </Label>
              <Input
                id="hostname"
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
                placeholder="gracechurch.org"
                autoComplete="off"
                spellCheck={false}
                aria-describedby={error ? "hostname-error" : undefined}
              />
            </div>
            <Button type="submit" disabled={pending || hostname.trim() === ""}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Connect
            </Button>
          </div>

          {error ? (
            <p
              id="hostname-error"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : null}
          {notice ? <p className="text-sm text-success">{notice}</p> : null}
        </form>
      </Card>

      {!state.published ? (
        <Card variant="flat" className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-sm text-muted">
            Your website is still a draft, so a connected domain will show
            visitors nothing until you publish it.
          </p>
        </Card>
      ) : null}

      {state.groups.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No domain connected yet"
          description="Add the domain your church owns above, and we will show you exactly what to change at your registrar."
          compact
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">
              Your domains
              <span className="ml-1.5 text-muted">({state.groups.length})</span>
            </h2>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => setState(await refreshDomains(siteId)));
              }}
            >
              <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
              Check all
            </Button>
          </div>

          {state.groups.map((group) => (
            <DomainCard
              key={group.root}
              siteId={siteId}
              group={group}
              onChanged={setState}
            />
          ))}
        </div>
      )}
    </div>
  );
}
