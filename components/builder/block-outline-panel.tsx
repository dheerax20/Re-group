"use client";

import { useMemo, useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { move } from "@dnd-kit/helpers";
import { ChevronDown, ChevronRight, GripVertical, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { NAV_BLOCK_ID, FOOTER_BLOCK_ID } from "@/lib/site/blocks/types";
import type { BlockNode, PageBlocks, TypeScaleToken } from "@/lib/site/blocks/types";
import { cn } from "@/lib/utils";

/**
 * The page's block tree, listed.
 *
 * The AI edit path is precise by design — a patch names one existing block
 * `id` — but nothing ever showed a church what those ids were, so "change the
 * subtitle" was a guess and the model's best case was matching on the copy.
 * This renders the same tree the model is shown, hover-framed against the live
 * preview, and hands the id straight to the chat box.
 *
 * It also carries the two edits that should never cost a chat message: the
 * order of the bands, and a block's font size.
 */

const TYPE_LABEL: Record<string, string> = {
  section: "Section",
  stack: "Stack",
  row: "Columns",
  spacer: "Spacer",
  heading: "Heading",
  text: "Paragraph",
  eyebrow: "Eyebrow",
  image: "Image",
  button: "Button",
  stats: "Stats",
  navLinks: "Navigation links",
  brandLogo: "Logo",
  sermonCollection: "Sermons",
  eventCollection: "Events",
  ministryCollection: "Ministries",
  contactInfo: "Contact details",
  givingCta: "Give button",
  socialLinks: "Social links",
  copyrightLine: "Copyright",
};

const SCALE_OPTIONS: Array<{ value: TypeScaleToken; label: string }> = [
  { value: "display", label: "Display" },
  { value: "h1", label: "Extra large" },
  { value: "h2", label: "Large" },
  { value: "h3", label: "Medium" },
  { value: "body", label: "Normal" },
  { value: "small", label: "Small" },
];

type Row = {
  id: string;
  type: BlockNode["type"];
  depth: number;
  detail: string;
  scale?: TypeScaleToken;
  sizeable: boolean;
};

function detailOf(node: BlockNode): string {
  if ("text" in node && node.text) return node.text;
  if ("label" in node && node.label) return node.label;
  if (node.type === "image") return node.src || node.videoSrc ? "photo set" : "no photo yet";
  if (node.type === "row") return `${node.columns ?? 2} across`;
  return "";
}

function toRow(node: BlockNode, depth: number): Row {
  return {
    id: node.id,
    type: node.type,
    depth,
    detail: detailOf(node),
    scale: "scale" in node ? node.scale : undefined,
    // `scale` is one vocabulary read two ways — a heading size on a heading,
    // a paragraph size on a text block. See components/website/blocks/tokens.ts.
    sizeable: node.type === "heading" || node.type === "text",
  };
}

/** Every descendant of a band, flattened and indented. Bands are shallow. */
function descendantRows(node: BlockNode, depth: number): Row[] {
  if (!("children" in node) || !Array.isArray(node.children)) return [];
  return node.children.flatMap((child) => [
    toRow(child, depth),
    ...descendantRows(child, depth + 1),
  ]);
}

type RowViewProps = {
  row: Row;
  hovered: boolean;
  /** The size chosen in this session, before the server prop catches up. */
  pendingScale?: TypeScaleToken;
  /** What clicking actually does — a pinned row on a secondary page only reveals. */
  selectHint?: string;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onScale: (id: string, scale: TypeScaleToken) => void;
};

function RowView({
  row,
  hovered,
  pendingScale,
  selectHint,
  onHover,
  onSelect,
  onScale,
}: RowViewProps) {
  return (
    <div
      onMouseEnter={() => onHover(row.id)}
      onMouseLeave={() => onHover(null)}
      style={{ paddingLeft: 8 + row.depth * 12 }}
      className={cn(
        "flex items-center gap-2 rounded-lg py-1.5 pr-2",
        hovered ? "bg-white/10" : "hover:bg-white/5"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(row.id)}
        className="min-w-0 flex-1 text-left"
        title={selectHint ?? "Show in the preview and use this block in your next message"}
      >
        <span className="block truncate text-xs text-editor-foreground">
          {TYPE_LABEL[row.type] ?? row.type}
          {row.detail ? <span className="text-editor-muted"> · {row.detail}</span> : null}
        </span>
        <span className="block truncate font-mono text-[10px] text-editor-muted">{row.id}</span>
      </button>

      {row.sizeable ? (
        <select
          aria-label={`Font size for ${row.id}`}
          /**
           * Optimistic, and never disabled while saving. A controlled select
           * whose value comes only from the server prop resets itself to the
           * old size the instant the mutation starts, so the church watches
           * their choice undo itself for the length of the round trip.
           */
          value={pendingScale ?? row.scale ?? (row.type === "heading" ? "h2" : "body")}
          onChange={(event) => onScale(row.id, event.target.value as TypeScaleToken)}
          className="h-6 shrink-0 rounded-md border border-editor-border bg-white/5 px-1 text-[10px] text-editor-foreground"
        >
          {SCALE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} className="text-foreground">
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

type BandProps = RowViewProps & {
  index: number;
  expanded: boolean;
  childRows: Row[];
  hoveredId: string | null;
  pendingScales: Record<string, TypeScaleToken>;
  onToggle: (id: string) => void;
};

function SortableBand({
  index,
  expanded,
  childRows,
  hoveredId,
  pendingScales,
  onToggle,
  ...rest
}: BandProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: rest.row.id,
    index,
    modifiers: [RestrictToVerticalAxis],
  });

  return (
    <li
      ref={ref}
      className={cn(
        "rounded-xl border border-transparent",
        isDragging ? "border-accent/40 bg-white/5 opacity-80" : ""
      )}
    >
      <div className="flex items-center gap-1">
        <button
          ref={handleRef}
          type="button"
          aria-label={`Reorder ${rest.row.id}`}
          className="shrink-0 cursor-grab rounded-md p-1 text-editor-muted hover:bg-white/10 active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onToggle(rest.row.id)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="shrink-0 rounded-md p-1 text-editor-muted hover:bg-white/10"
        >
          {childRows.length === 0 ? (
            <span className="block size-3.5" />
          ) : expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <RowView {...rest} />
        </div>
      </div>

      {expanded && childRows.length > 0 ? (
        <div className="ml-6 border-l border-editor-border pl-1">
          {childRows.map((child) => (
            <RowView
              {...rest}
              key={child.id}
              row={child}
              hovered={hoveredId === child.id}
              pendingScale={pendingScales[child.id]}
            />
          ))}
        </div>
      ) : null}
    </li>
  );
}

export function BlockOutlinePanel({
  siteId,
  path,
  blocks,
  hoveredId,
  pinnedEditable,
  onHover,
  onSelect,
  onReveal,
  onChanged,
}: {
  siteId: string;
  path: string;
  /** The whole previewed tree, in render order: nav, then bands, then footer. */
  blocks: PageBlocks;
  hoveredId: string | null;
  /**
   * Whether the nav and footer bands belong to THIS page's tree.
   *
   * They only do on the homepage. On a secondary page the preview borrows them
   * from the site layout, so handing their ids to the chat would name blocks
   * the edit path cannot find — the patch would be silently ignored, which
   * reads as the assistant doing nothing.
   */
  pinnedEditable: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  /** Scroll to a block without claiming the chat can edit it. */
  onReveal: (id: string) => void;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  /**
   * The optimistic order, held only until the server prop catches up. `blocks`
   * is a server prop, so without this the dragged row snaps back to its old
   * index for the length of the round trip.
   *
   * It carries the band list it was computed FROM, which is what expires it:
   * the moment `blocks` no longer matches that list the server has answered
   * (or something else changed the page) and the pending order is ignored.
   * Deriving it beats reconciling in an effect, which would be a setState
   * cascade on every render of the panel.
   */
  const [pending, setPending] = useState<{ from: string; order: string[] } | null>(null);
  /**
   * Sizes chosen this session, keyed by block id. Same expiry idea as `pending`
   * above and for the same reason: `blocks` is a server prop, so without this a
   * controlled select snaps back to the old size for the length of the round
   * trip.
   *
   * `from` is the value the change started at, and it is what expires the
   * entry. Expiring on "the server now matches `want`" instead left every
   * landed entry sitting in state, inert only because the server agreed — so
   * the next time anything ELSE moved that block's size (an AI edit, say) the
   * server stopped agreeing and the dead entry came back to life, showing a
   * size the page was not rendering.
   */
  const [pendingScales, setPendingScales] = useState<
    Record<string, { want: TypeScaleToken; from?: TypeScaleToken }>
  >({});

  const updateBlocks = trpc.site.updateBlocks.useMutation();

  const pinned = useMemo(
    () => ({
      nav: blocks.find((block) => block.id === NAV_BLOCK_ID) ?? null,
      footer: blocks.find((block) => block.id === FOOTER_BLOCK_ID) ?? null,
    }),
    [blocks]
  );

  const bands = useMemo(
    () => blocks.filter((block) => block.id !== NAV_BLOCK_ID && block.id !== FOOTER_BLOCK_ID),
    [blocks]
  );
  const bandIds = useMemo(() => bands.map((band) => band.id), [bands]);
  const bandKey = bandIds.join("|");

  const pendingOrder = pending && pending.from === bandKey ? pending.order : null;

  /**
   * A pending size disappears the moment the tree says the same thing —
   * derived rather than cleared in an effect, which would be a setState
   * cascade on every render.
   */
  const scaleOf = useMemo(() => {
    const map = new Map<string, TypeScaleToken | undefined>();
    const walk = (nodes: PageBlocks) => {
      for (const node of nodes) {
        if ("scale" in node) map.set(node.id, node.scale);
        if ("children" in node && Array.isArray(node.children)) walk(node.children);
      }
    };
    walk(blocks);
    return map;
  }, [blocks]);

  const liveScales = useMemo(() => {
    const next: Record<string, TypeScaleToken> = {};
    for (const [id, entry] of Object.entries(pendingScales)) {
      // In flight only while the tree still holds the value we started from.
      // Anything else — our own save landing, or someone else's edit — means
      // the server is now the truth.
      if (scaleOf.get(id) === entry.from) next[id] = entry.want;
    }
    return next;
  }, [pendingScales, scaleOf]);

  const orderedBands = useMemo(() => {
    if (!pendingOrder) return bands;
    const byId = new Map(bands.map((band) => [band.id, band]));
    const ordered = pendingOrder.map((id) => byId.get(id)).filter(Boolean) as PageBlocks;
    // Anything the pending order doesn't know about still has to render.
    return [...ordered, ...bands.filter((band) => !pendingOrder.includes(band.id))];
  }, [bands, pendingOrder]);

  function persist(input: { order?: string[]; scales?: Array<{ id: string; scale: TypeScaleToken }> }) {
    setError(null);
    updateBlocks.mutate(
      { siteId, path, ...input },
      {
        onSuccess: () => onChanged(),
        onError: (err) => {
          // Roll back only what THIS call was optimistic about. Both controls
          // share one mutation, so clearing everything meant a failed size
          // change also undid a drag that had already succeeded.
          if (input.order) setPending(null);
          if (input.scales) {
            setPendingScales((current) => {
              const next = { ...current };
              for (const entry of input.scales ?? []) delete next[entry.id];
              return next;
            });
          }
          setError(err.message || "Could not save that change.");
        },
      }
    );
  }

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const rowProps = {
    onHover,
    onSelect,
    onScale: (id: string, scale: TypeScaleToken) => {
      setPendingScales((current) => ({
        ...current,
        [id]: { want: scale, from: scaleOf.get(id) },
      }));
      persist({ scales: [{ id, scale }] });
    },
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-editor-border p-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Blocks on this page
        </p>
        <p className="mt-1 text-xs text-white/55">
          Hover to find it in the preview. Click to use its name in your next message. Drag to
          reorder.
        </p>
      </div>

      <div className="max-h-[22rem] min-h-0 flex-1 space-y-1 overflow-y-auto p-2 lg:max-h-none">
        {pinned.nav ? (
          <PinnedRow
            node={pinned.nav}
            hovered={hoveredId === pinned.nav.id}
            editable={pinnedEditable}
            onHover={onHover}
            onSelect={pinnedEditable ? onSelect : onReveal}
          />
        ) : null}

        <DragDropProvider
          onDragEnd={(event) => {
            if (event.canceled) return;
            const current = pendingOrder ?? bandIds;
            const next = move(current, event);
            if (next.join("|") === current.join("|")) return;
            setPending({ from: bandKey, order: next });
            persist({ order: next });
          }}
        >
          <ul className="space-y-0.5">
            {orderedBands.map((band, index) => (
              <SortableBand
                key={band.id}
                index={index}
                row={toRow(band, 0)}
                childRows={descendantRows(band, 1)}
                expanded={expanded.has(band.id)}
                onToggle={toggle}
                hovered={hoveredId === band.id}
                hoveredId={hoveredId}
                pendingScale={liveScales[band.id]}
                pendingScales={liveScales}
                {...rowProps}
              />
            ))}
          </ul>
        </DragDropProvider>

        {pinned.footer ? (
          <PinnedRow
            node={pinned.footer}
            hovered={hoveredId === pinned.footer.id}
            editable={pinnedEditable}
            onHover={onHover}
            onSelect={pinnedEditable ? onSelect : onReveal}
          />
        ) : null}

        {orderedBands.length === 0 ? (
          <p className="p-3 text-xs text-white/40">This page has no blocks yet.</p>
        ) : null}
      </div>

      {error ? (
        <p className="border-t border-editor-border p-3 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

/**
 * Nav and footer render on every page and are pinned by reserved id
 * (`pinNavAndFooter` in lib/site/blocks/patch.ts), so they are listed for
 * orientation but never draggable — the panel should not offer a gesture the
 * server is going to undo.
 */
function PinnedRow({
  node,
  hovered,
  editable,
  onHover,
  onSelect,
}: {
  node: BlockNode;
  hovered: boolean;
  editable: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 opacity-70">
      <span
        className="shrink-0 p-1 text-editor-muted"
        title={
          editable
            ? "Pinned — always first or last on the page"
            : "Shown on every page. Edit it from the Home page."
        }
      >
        <Lock className="size-3.5" />
      </span>
      <span className="block size-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <RowView
          row={toRow(node, 0)}
          hovered={hovered}
          selectHint={
            editable
              ? undefined
              : "Show in the preview. This band belongs to the Home page — edit it there."
          }
          onHover={onHover}
          onSelect={onSelect}
          onScale={() => {}}
        />
      </div>
    </div>
  );
}
