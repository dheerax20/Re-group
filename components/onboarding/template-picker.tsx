"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * One card's worth of a template, resolved on the server.
 *
 * `previewImage` is the photograph this template will actually put in THIS
 * site's hero — `pickHeroImage` is a deterministic hash of the site id, so the
 * card is the real thing rather than a mock-up of it. Resolved server-side so
 * the template registry (and through it the design pass and the art-direction
 * catalog) stays out of the browser bundle.
 */
export type TemplateCard = {
  id: string;
  name: string;
  tagline: string;
  previewImage: string;
};

export function TemplatePicker({
  siteId,
  templates,
  swatches,
  currentTemplateId,
  hasDesign,
  aiHref,
}: {
  siteId: string;
  templates: TemplateCard[];
  /** The church's own brand colours, shown on every card. */
  swatches: string[];
  currentTemplateId: string;
  /** Whether applying would overwrite something the church already has. */
  hasDesign: boolean;
  aiHref: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<TemplateCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyTemplate = trpc.site.applyTemplate.useMutation({
    onSuccess() {
      setPending(null);
      setConfirming(null);
      // The whole page re-reads from the server: the step turns into the
      // "here is your website" state without a second round trip.
      router.refresh();
    },
    onError(err) {
      setPending(null);
      setConfirming(null);
      setError(err.message);
    },
  });

  function choose(template: TemplateCard) {
    setError(null);
    // Overwriting a design the church may have edited is not something to do
    // on a single click. A first pick has nothing to lose, so it is immediate.
    if (hasDesign) {
      setConfirming(template);
      return;
    }
    setPending(template.id);
    applyTemplate.mutate({ siteId, templateId: template.id as never });
  }

  function confirm() {
    if (!confirming) return;
    setPending(confirming.id);
    applyTemplate.mutate({ siteId, templateId: confirming.id as never });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => {
          const isCurrent = template.id === currentTemplateId;
          const isPending = pending === template.id;

          return (
            <div
              key={template.id}
              className={cn(
                "flex flex-col overflow-hidden rounded-panel border bg-surface shadow-[var(--shadow-soft)] transition-colors",
                isCurrent ? "border-brand" : "border-border"
              )}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={template.previewImage}
                  alt=""
                  className="size-full object-cover"
                  loading="lazy"
                />
                {isCurrent ? (
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-brand px-2 py-1 text-[11px] font-medium text-brand-foreground">
                    <Check className="size-3" />
                    In use
                  </span>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold tracking-tight">{template.name}</h3>
                  <div className="flex shrink-0 gap-1 pt-1" aria-hidden>
                    {swatches.map((color, index) => (
                      <span
                        key={`${template.id}-${index}`}
                        className="size-3 rounded-full border border-border"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <p className="flex-1 text-sm text-muted">{template.tagline}</p>

                <Button
                  type="button"
                  variant={isCurrent ? "outline" : "default"}
                  onClick={() => choose(template)}
                  disabled={Boolean(pending)}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isCurrent ? "Re-apply" : "Use this design"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-panel border border-accent/30 bg-accent-soft/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Sparkles className="size-4" />
            </span>
            <div>
              <h3 className="font-semibold tracking-tight">Generate with AI instead</h3>
              <p className="mt-1 max-w-xl text-sm text-muted">
                Six specialists invent a layout and write the copy for your church
                specifically. Takes about a minute, and uses one of your monthly builds.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => router.push(aiHref)} disabled={Boolean(pending)}>
            Generate with AI
          </Button>
        </div>
      </div>

      <Dialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace your current design?</DialogTitle>
            <DialogDescription>
              {confirming?.name} will be applied to every page of your site. Any edits you
              have made to your pages will be replaced. Your church details, brand colours
              and content stay exactly as they are.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)} disabled={Boolean(pending)}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={Boolean(pending)}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Apply {confirming?.name}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
