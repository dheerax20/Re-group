"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mic2 } from "lucide-react";

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
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/layout/empty-state";
import { SermonCard, type SermonCardData } from "@/components/sermons/sermon-card";
import {
  SermonFormSheet,
  toDateInput,
  type SermonFormValues,
} from "@/components/sermons/sermon-form-sheet";

export type SermonRecord = SermonCardData & {
  description: string | null;
  audioUrl: string | null;
};

function toFormValues(sermon: SermonRecord): SermonFormValues {
  return {
    id: sermon.id,
    title: sermon.title,
    speaker: sermon.speaker ?? "",
    date: toDateInput(sermon.date),
    series: sermon.series ?? "",
    videoUrl: sermon.videoUrl ?? "",
    audioUrl: sermon.audioUrl ?? "",
    thumbnailUrl: sermon.thumbnailUrl ?? "",
    description: sermon.description ?? "",
  };
}

/**
 * The sermon library. Same URL-driven sheet as events (`?edit=`, `?new=1`) —
 * see `events-library.tsx` for why that state does not live in React.
 */
export function SermonsLibrary({
  siteId,
  sermons,
  siteUrl,
  filtered,
}: {
  siteId: string;
  sermons: SermonRecord[];
  siteUrl?: string;
  filtered: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SermonRecord | null>(null);

  const deleteSermon = trpc.content.deleteSermon.useMutation();

  const editId = searchParams.get("edit");
  const creating = searchParams.get("new") === "1";
  const editing = editId ? sermons.find((sermon) => sermon.id === editId) : undefined;

  function closeSheet() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    params.delete("new");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function hrefWith(update: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    params.delete("new");
    for (const [key, value] of Object.entries(update)) params.set(key, value);
    return `${pathname}?${params.toString()}`;
  }

  function onDelete() {
    const sermon = confirmDelete;
    if (!sermon) return;
    setBusyId(sermon.id);
    startTransition(async () => {
      try {
        await deleteSermon.mutateAsync({ siteId, sermonId: sermon.id });
        toast({ title: "Sermon deleted", description: `“${sermon.title}” was removed.` });
        setConfirmDelete(null);
        if (editId === sermon.id) closeSheet();
        router.refresh();
      } catch (error) {
        toast({
          title: "Could not delete",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error",
        });
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <>
      {sermons.length === 0 ? (
        <EmptyState
          action={
            filtered ? (
              <Button asChild variant="outline">
                <a href={pathname}>Clear filters</a>
              </Button>
            ) : (
              <Button asChild>
                <a href={hrefWith({ new: "1" })}>Add sermon</a>
              </Button>
            )
          }
          description={
            filtered
              ? "No messages match the filters you've set."
              : "Paste a YouTube link and your message library starts filling itself in."
          }
          icon={Mic2}
          title={filtered ? "No matching sermons" : "No sermons yet"}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {sermons.map((sermon) => (
            <SermonCard
              busy={busyId === sermon.id && pending}
              editHref={hrefWith({ edit: sermon.id })}
              key={sermon.id}
              onDelete={() => setConfirmDelete(sermon)}
              publicHref={siteUrl ? `${siteUrl}/sermons/${sermon.slug}` : undefined}
              sermon={sermon}
            />
          ))}
        </div>
      )}

      <SermonFormSheet
        initial={editing ? toFormValues(editing) : undefined}
        onOpenChange={(next) => {
          if (!next) closeSheet();
        }}
        open={creating || Boolean(editing)}
        siteId={siteId}
      />

      <Dialog
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(null);
        }}
        open={confirmDelete !== null}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this sermon?</DialogTitle>
            <DialogDescription>
              “{confirmDelete?.title}” will be removed from your website&rsquo;s message
              library. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => setConfirmDelete(null)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={pending} onClick={onDelete} variant="destructive">
              {pending ? <Loader2 className="animate-spin" /> : null}
              Delete sermon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
