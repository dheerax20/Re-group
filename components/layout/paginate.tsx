import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

/**
 * The product's one pagination system.
 *
 * Two rules it exists to enforce, because they are the ones every screen used
 * to get slightly differently.
 *
 * Page state lives in the URL, never in component state. A church that sends a
 * volunteer "page 3 of the attendee list" has to be able to send a link, and
 * the back button has to work. Every other filter in the query string is
 * carried through untouched, so `?status=published&page=2` survives paging.
 *
 * And a *filter* change always resets to page one — handled in `PageToolbar`,
 * which drops `page` whenever it writes a filter. Landing on "page 4 of 1"
 * after narrowing a search is the classic version of this bug.
 */

export const PAGE_SIZES = {
  /** Card grids: 12 fills 3 or 4 columns evenly. */
  cards: 12,
  /** Table rows. */
  rows: 25,
  /** Attendance rows read denser than a check-in log. */
  attendance: 20,
} as const;

export type Paged<T> = {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  from: number;
  to: number;
};

/**
 * Slice a list for the requested page, clamping the page into range.
 *
 * Clamping rather than 404ing: `?page=99` after someone deletes the last few
 * events is a stale link, not an error worth a whole screen.
 */
export function paginate<T>(items: T[], page: number, pageSize: number): Paged<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: current,
    pageCount,
    total,
    pageSize,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
  };
}

/** `?page=` from a Next.js searchParams value, tolerant of junk. */
export function pageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * Which page numbers to render. Always first and last, always the current page
 * and its neighbours, ellipses for the gaps — so the control stays one line
 * wide whether there are 4 pages or 400.
 */
function windowed(page: number, pageCount: number): Array<number | "gap"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);

  const out: Array<number | "gap"> = [];
  let previous = 0;
  for (const n of sorted) {
    if (previous && n - previous > 1) out.push("gap");
    out.push(n);
    previous = n;
  }
  return out;
}

/**
 * Build `?page=n` while preserving every other query parameter. `page=1` is
 * omitted so the first page has one canonical URL rather than two.
 */
function hrefFor(
  basePath: string,
  params: Record<string, string | string[] | undefined>,
  page: number
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value === undefined) continue;
    if (Array.isArray(value)) value.forEach((entry) => query.append(key, entry));
    else query.set(key, value);
  }
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function Paginate({
  basePath,
  searchParams,
  paged,
  label = "results",
  className,
}: {
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  paged: Pick<Paged<unknown>, "page" | "pageCount" | "total" | "from" | "to">;
  /** Plural noun for the count line: "events", "check-ins". */
  label?: string;
  className?: string;
}) {
  // One page of results needs no control at all — a disabled Previous/Next pair
  // under a list of three events is pure furniture.
  if (paged.pageCount <= 1) return null;

  const { page, pageCount, total, from, to } = paged;
  const previousHref = hrefFor(basePath, searchParams, page - 1);
  const nextHref = hrefFor(basePath, searchParams, page + 1);
  const atStart = page <= 1;
  const atEnd = page >= pageCount;

  return (
    <Pagination className={cn("pt-1", className)}>
      <p className="hidden text-[13px] text-muted sm:block">
        Showing <span className="tabular font-medium text-foreground">{from}</span>–
        <span className="tabular font-medium text-foreground">{to}</span> of{" "}
        <span className="tabular font-medium text-foreground">{total}</span> {label}
      </p>

      <PaginationContent className="ml-auto">
        <PaginationItem>
          {atStart ? (
            // A dead first-page link is worse than no link: it looks pressable
            // and does nothing. Rendered as a disabled span instead.
            <span
              aria-disabled
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-muted/50"
            >
              Previous
            </span>
          ) : (
            <PaginationPrevious href={previousHref} />
          )}
        </PaginationItem>

        {/* Phones get "2 / 4" — eight numbered targets do not fit a thumb. */}
        <PaginationItem className="sm:hidden">
          <span className="tabular px-2 text-[13px] text-muted">
            {page} / {pageCount}
          </span>
        </PaginationItem>

        {windowed(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <PaginationItem className="hidden sm:block" key={`gap-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem className="hidden sm:block" key={entry}>
              <PaginationLink
                href={hrefFor(basePath, searchParams, entry)}
                isActive={entry === page}
              >
                {entry}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        <PaginationItem>
          {atEnd ? (
            <span
              aria-disabled
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-muted/50"
            >
              Next
            </span>
          ) : (
            <PaginationNext href={nextHref} />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
