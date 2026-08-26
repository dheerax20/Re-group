"use client";

import Link from "next/link";
import {
  ExternalLink,
  Mic2,
  MoreHorizontal,
  Play,
  SquarePen,
  Trash2,
} from "lucide-react";

import { youtubeThumbnail } from "@/lib/media/youtube";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SermonCardData = {
  id: string;
  title: string;
  slug: string;
  date: Date;
  speaker: string | null;
  series: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
};

function formatDate(value: Date): string {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * One message in the library.
 *
 * The poster is resolved in three steps: an explicit `thumbnailUrl` if the
 * church set one, otherwise the YouTube still derived from the video URL,
 * otherwise a typographic fallback. Most sermons are a pasted YouTube link and
 * nothing else, so step two is what makes the library look like a media shelf
 * without asking anyone to upload artwork.
 */
export function SermonCard({
  sermon,
  editHref,
  publicHref,
  onDelete,
  busy,
}: {
  sermon: SermonCardData;
  editHref: string;
  publicHref?: string;
  onDelete: () => void;
  busy?: boolean;
}) {
  const poster = sermon.thumbnailUrl ?? youtubeThumbnail(sermon.videoUrl);

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-[var(--shadow-soft)] transition-all",
        "hover:border-border-strong hover:shadow-[var(--shadow-lift)]",
        "focus-within:border-border-strong",
        busy && "pointer-events-none opacity-60"
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-surface-muted">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            src={poster}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-surface-muted text-muted">
            <Mic2 className="size-6" />
          </div>
        )}

        {sermon.videoUrl ? (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-foreground/55 text-background backdrop-blur-[2px] transition-transform duration-200 group-hover:scale-105">
              <Play className="size-4 translate-x-px fill-current" />
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            <Link className="outline-none after:absolute after:inset-0" href={editHref}>
              {sermon.title}
            </Link>
          </h3>
          <p className="mt-1 truncate text-[13px] text-muted">
            {sermon.speaker ? `${sermon.speaker} · ` : ""}
            <span className="tabular">{formatDate(sermon.date)}</span>
          </p>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-1">
          {sermon.series ? (
            <Badge variant="secondary">{sermon.series}</Badge>
          ) : (
            <span className="text-[13px] text-muted">No series</span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${sermon.title}`}
              className="relative z-10 ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground data-[state=open]:bg-surface-muted data-[state=open]:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem asChild>
                <Link href={editHref}>
                  <SquarePen />
                  Edit
                </Link>
              </DropdownMenuItem>
              {sermon.videoUrl ? (
                <DropdownMenuItem asChild>
                  <a href={sermon.videoUrl} rel="noopener noreferrer" target="_blank">
                    <Play />
                    Watch video
                  </a>
                </DropdownMenuItem>
              ) : null}
              {publicHref ? (
                <DropdownMenuItem asChild>
                  <a href={publicHref} rel="noopener noreferrer" target="_blank">
                    <ExternalLink />
                    View on site
                  </a>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDelete} variant="destructive">
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}
