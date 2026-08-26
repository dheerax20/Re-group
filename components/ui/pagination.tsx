import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Pagination primitives.
 *
 * Deliberately unopinionated about *where* the pages come from — these render
 * whatever hrefs they are given. `components/layout/paginate.tsx` is the one
 * place that turns a page number into a URL, so every paginated screen in the
 * product agrees on `?page=` and on what happens to the other filters.
 */

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="Pagination"
      data-slot="pagination"
      className={cn("flex w-full items-center justify-between gap-3", className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

/**
 * A page target is always a real navigation, so it renders `next/link` rather
 * than a bare anchor — an `<a href>` here would reload the whole application
 * shell to move between pages of a list.
 */
type PaginationLinkProps = {
  isActive?: boolean;
  size?: VariantProps<typeof buttonVariants>["size"];
} & Omit<React.ComponentProps<typeof Link>, "size">;

function PaginationLink({
  className,
  isActive,
  size = "icon-sm",
  ...props
}: PaginationLinkProps) {
  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      data-active={isActive}
      data-slot="pagination-link"
      className={cn(
        buttonVariants({ variant: isActive ? "outline" : "ghost", size }),
        isActive && "border-border-strong font-semibold text-foreground",
        "tabular",
        className
      )}
      {...props}
    />
  );
}

function PaginationPrevious({ className, size = "sm", ...props }: PaginationLinkProps) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size={size}
      className={cn("gap-1 px-2.5", className)}
      {...props}
    >
      <ChevronLeft />
      <span className="hidden sm:inline">Previous</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, size = "sm", ...props }: PaginationLinkProps) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size={size}
      className={cn("gap-1 px-2.5", className)}
      {...props}
    >
      <span className="hidden sm:inline">Next</span>
      <ChevronRight />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn("flex size-8 items-center justify-center text-muted", className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
