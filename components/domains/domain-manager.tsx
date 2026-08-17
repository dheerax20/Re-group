"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  ChevronDown,
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
import type { DomainView } from "@/lib/domains/actions-support";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CopyField } from "@/components/ui/copy-field";
import { EmptyState } from "@/components/layout/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * Connecting a domain is the step where churches get stuck, and the reason is
 * always the same: they cannot tell whether they are waiting on DNS, waiting on
 * us, or have made a typo. So every domain shows which of the three it is, what
 * to type at the registrar, and a way to re-check without reloading.
 */

type StatusPresentation = {
  label: string;
  variant: "success" | "warning" | "info";
  explanation: string;
};

function presentStatus(domain: DomainView): StatusPresentation {
  if (domain.status === "ACTIVE") {
    return {
      label: "Live",
      variant: "success",
      explanation: "Visitors can reach your site at this address.",
    };
  }
  if (domain.status === "PENDING_VERIFICATION") {
    return {
      label: "Confirm ownership",
      variant: "warning",
      explanation:
        "This domain is registered with another Vercel account. Add the TXT record below to prove it is yours.",
    };
  }
  return {
    label: "Waiting for DNS",
    variant: "info",
    explanation:
      "Add the record below at your domain registrar. Changes usually appear within an hour.",
  };
}

function DomainRow({
  siteId,
  domain,
  onChanged,
}: {
  siteId: string;
  domain: DomainView;
  onChanged: (next: DomainsState) => void;
}) {
  const [open, setOpen] = useState(domain.status !== "ACTIVE");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const status = presentStatus(domain);

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
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted">
          <Globe className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{domain.hostname}</p>
            {domain.isPrimary ? (
              <Badge variant="accent">Main address</Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted">{status.explanation}</p>
        </div>

        <Badge variant={status.variant} dot>
          {status.label}
        </Badge>

        <div className="flex items-center gap-1">
          {domain.status === "ACTIVE" && !domain.isPrimary ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await setPrimaryDomain(siteId, domain.id);
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
            aria-label={`Remove ${domain.hostname}`}
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await removeDomain(siteId, domain.id);
                return result.success ? null : result.error;
              })
            }
          >
            <Trash2 className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? "Hide DNS records" : "Show DNS records"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDown
              className={cn("size-4 transition-transform", open && "rotate-180")}
            />
          </Button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border bg-background px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            {domain.isApex ? "Add this A record" : "Add this CNAME record"}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[6rem_1fr]">
            {domain.records.map((record) => (
              <RecordRow key={`${record.type}-${record.name}`} record={record} />
            ))}
          </div>

          {domain.verification.length > 0 ? (
            <>
              <p className="mt-5 text-xs font-medium uppercase tracking-wider text-muted">
                Then add this TXT record to prove ownership
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[6rem_1fr]">
                {domain.verification.map((record) => (
                  <RecordRow key={record.value} record={record} />
                ))}
              </div>
            </>
          ) : null}

          {message ? (
            <p className="mt-4 flex items-start gap-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {message}
            </p>
          ) : null}

          {domain.status !== "ACTIVE" ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const result = await verifyDomain(siteId, domain.id);
                    return result.success ? null : result.error;
                  })
                }
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Check again
              </Button>
              <span className="text-xs text-muted">
                {domain.lastCheckedAt
                  ? `Last checked ${new Date(domain.lastCheckedAt).toLocaleTimeString()}`
                  : "Not checked yet"}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function RecordRow({
  record,
}: {
  record: { type: string; name: string; value: string; note?: string };
}) {
  return (
    <>
      <div className="flex items-start gap-2 sm:flex-col sm:gap-1">
        <Badge variant="outline">{record.type}</Badge>
        <code className="font-mono text-xs text-muted">{record.name}</code>
      </div>
      <div className="min-w-0">
        <CopyField value={record.value} />
        {record.note ? (
          <p className="mt-1 text-[11px] text-muted">{record.note}</p>
        ) : null}
      </div>
    </>
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
  const [includeWww, setIncludeWww] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await addDomain(siteId, hostname, { includeWww });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setHostname("");
      setNotice(
        result.alsoAdded
          ? `Added ${result.domain.hostname} and ${result.alsoAdded.hostname}. Add the DNS records below to finish.`
          : `Added ${result.domain.hostname}. Add the DNS record below to finish.`
      );
      setState(await refreshDomains(siteId));
    });
  }

  function recheckAll() {
    setError(null);
    startTransition(async () => {
      setState(await refreshDomains(siteId));
    });
  }

  if (!state.enabled) {
    return (
      <EmptyState
        icon={Globe}
        title="Custom domains are not switched on yet"
        description="This deployment has no Vercel API credentials, so domains cannot be connected. Your site is still live on its Regroup address."
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
        <CardTitle className="text-base">Connect a domain you own</CardTitle>
        <CardDescription>
          Buy a domain at any registrar, then point it here. Your Regroup address{" "}
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
              Connect domain
            </Button>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-muted">
            <Switch
              checked={includeWww}
              onCheckedChange={setIncludeWww}
              aria-label="Also connect the www version"
            />
            Also connect the <code className="font-mono text-xs">www.</code> version
          </label>

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
            Your website is still a draft. A connected domain will not show
            anything to visitors until you publish.
          </p>
        </Card>
      ) : null}

      {state.domains.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No domains connected"
          description="Add your church's domain above and we will show you exactly which DNS record to create."
          compact
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">
              Connected domains
              <span className="ml-1.5 text-muted">({state.domains.length})</span>
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={recheckAll}
              disabled={pending}
            >
              <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
              Re-check all
            </Button>
          </div>

          {state.domains.map((domain) => (
            <DomainRow
              key={domain.id}
              siteId={siteId}
              domain={domain}
              onChanged={setState}
            />
          ))}
        </div>
      )}
    </div>
  );
}
