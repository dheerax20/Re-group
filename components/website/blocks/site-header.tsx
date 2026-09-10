"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import type { SiteConfig } from "@/lib/site/types";
import type { NavVariant } from "@/lib/site/types";
import { cn } from "@/lib/utils";
import { PAGE_GUTTER, focusRingClass } from "./tokens";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * The published site's navigation bar.
 *
 * Deliberately NOT built from the generic `row` block. `row` exists so the
 * *model* can compose content rows, and it draws equal grid fractions — which
 * put a two-child navbar's links at the container's horizontal midpoint with a
 * quarter of the page as trailing dead space. A navbar is one fixed shape
 * (`flex items-center justify-between`) authored in code, so it has no reason
 * to route through the model's vocabulary at all. The `nav` band survives in
 * `blockConfig` as the marker the builder, the editor prompt and the public
 * layout look it up by; this component is what actually renders.
 *
 * Height is fixed (`h-20 lg:h-24`) rather than derived from a padding token.
 * Two reasons: a bar should not resize because one church's logo is 24px and
 * the next church's is 64px, and the `transparent` variant needs a height that
 * is knowable at authoring time so the hero can be laid out beneath it.
 */

/** Logo art is capped so an oversized upload cannot stretch the bar. */
function BrandLogo({ site }: { site: SiteConfig }) {
  return (
    <Link
      href="/"
      className={cn("flex shrink-0 items-center gap-2 rounded-sm font-semibold", focusRingClass)}
    >
      {site.brand.logo.url ? (
        <Image
          src={site.brand.logo.url}
          alt={site.brand.logo.alt || site.site.name}
          width={224}
          height={56}
          className="h-12 w-auto object-contain lg:h-14"
          priority
        />
      ) : (
        // `min-w-0` + `truncate` so a long church name collides with the link
        // row by shortening rather than by pushing it off the gutter.
        <span className="min-w-0 truncate text-xl lg:text-2xl">{site.site.name}</span>
      )}
    </Link>
  );
}

/**
 * Tracks two thresholds with one passive listener.
 *
 * `scrolled` drives the hairline under the bar — always-on, it draws a line
 * across the hero photograph. `pastHero` is what swaps a `transparent` bar to
 * its solid treatment: white links stay legible over the photo and then become
 * invisible the moment the first light band arrives underneath them.
 */
function useScrollState() {
  const [state, setState] = useState({ scrolled: false, pastHero: false });

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const y = window.scrollY;
      setState((prev) => {
        const next = { scrolled: y > 8, pastHero: y > window.innerHeight * 0.6 };
        return prev.scrolled === next.scrolled && prev.pastHero === next.pastHero ? prev : next;
      });
    };
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return state;
}

function DesktopLinks({ site, small, dark }: { site: SiteConfig; small: boolean; dark: boolean }) {
  return (
    <nav aria-label="Primary">
      {/* Wide, even spacing at regular weight — `gap-6` reads as a toolbar
          rather than a masthead. */}
      <ul className={cn("flex items-center gap-8 lg:gap-10", small ? "text-sm" : "text-base")}>
        {site.navigation.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "rounded-sm whitespace-nowrap transition-colors",
                dark ? "text-white hover:text-white/70" : "hover:text-site-accent",
                focusRingClass
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteHeader({
  site,
  variant = "solid",
}: {
  site: SiteConfig;
  variant?: NavVariant;
}) {
  const { scrolled, pastHero } = useScrollState();

  /**
   * A `transparent` bar sits over the hero photograph and reverts to the solid
   * treatment once the photograph is behind it. Everything downstream reads
   * `overlaying`, not `variant`, so the swap is one boolean rather than a
   * branch repeated at every class.
   */
  const overlaying = variant === "transparent" && !pastHero;
  const solidBackdrop = variant === "solid" || (variant === "transparent" && pastHero);

  return (
    <>
      <header
        className={cn(
          "z-20 hidden w-full sm:block",
          // `absolute` for the overlay variant: out of flow entirely, so the
          // hero begins at the top of the viewport and the photograph runs
          // under the bar. A negative margin on the hero would double the pull.
          overlaying ? "absolute inset-x-0 top-0" : "sticky top-0",
          solidBackdrop ? "bg-site-background/85 backdrop-blur-md" : "",
          // Only once scrolled — an always-on rule draws a line across the photo.
          scrolled && !overlaying ? "border-b border-site-muted/15" : "border-b border-transparent"
        )}
      >
        <div className={cn("w-full", PAGE_GUTTER)}>
          <div className="flex h-20 items-center justify-between gap-8 lg:h-24">
            <BrandLogo site={site} />
            <DesktopLinks site={site} small={variant === "minimal"} dark={overlaying} />
          </div>
        </div>
      </header>

      <MobileHeader site={site} />
      {/* The mobile bar is `fixed`, so it reserves no space of its own. An
          overlay variant WANTS the hero underneath it; every other variant
          would otherwise start its first band behind the bar. */}
      {variant === "transparent" ? null : <div className="h-20 sm:hidden" aria-hidden="true" />}
    </>
  );
}

/**
 * The mobile bar and its drawer.
 *
 * **Always `fixed`, whatever the direction's variant is.** The
 * transparent-over-hero treatment is a desktop concern and buys nothing at
 * 390px, where the bar covers most of the photograph anyway — and an
 * `absolute` bar scrolls away and takes the menu button with it, which is the
 * one failure that would strand a visitor mid-page with no navigation.
 *
 * The panel is a `Sheet` (Radix Dialog) opening from the top rather than the
 * hand-rolled grid-rows drawer this replaced. Radix owns the focus trap, the
 * Escape handler, the click-outside, the body scroll lock and the enter/exit
 * animation — five things that were previously four `useEffect`s and an
 * arbitrary-value transition, each with its own way to be subtly wrong.
 */
function MobileHeader({ site }: { site: SiteConfig }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  /**
   * Close on navigation — the one behaviour Radix does not cover, because a
   * client-side route change unmounts nothing.
   *
   * Adjusted during render rather than in an effect. Calling `setOpen` from an
   * effect keyed on `pathname` renders the open drawer once against the new
   * page and then immediately re-renders it closed — a visible flash, and the
   * cascading-render pattern React (and this repo's lint) tells you not to
   * write.
   */
  const [pathWhenRendered, setPathWhenRendered] = useState(pathname);
  if (pathname !== pathWhenRendered) {
    setPathWhenRendered(pathname);
    if (open) setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <header className="fixed inset-x-0 top-0 z-30 sm:hidden">
        <div className="flex h-20 items-center justify-between bg-site-background px-6">
          <BrandLogo site={site} />
          <SheetTrigger
            // A real 44px tap target. `-mr-3` pulls its optical edge back to
            // the gutter, so the icon lines up with the page rather than the
            // button's padding box.
            className={cn(
              "-mr-3 flex h-11 w-11 items-center justify-center rounded-lg text-site-foreground",
              focusRingClass
            )}
            aria-label="Open menu"
          >
            <Menu className="size-6" aria-hidden="true" />
          </SheetTrigger>
        </div>
      </header>

      {/**
       * Site tokens, not the product chrome's `bg-background`. The panel
       * resolves its OWN surface and text tone rather than inheriting the
       * bar's: under the two `transparent` directions the bar's links are
       * white, and white links on an opaque panel are invisible.
       *
       * `showCloseButton={false}` because the built-in one is styled for the
       * dashboard and sits in the corner — the X here has to land exactly
       * where the hamburger was, so the control reads as one button changing
       * state rather than two buttons in different places.
       */}
      <SheetContent
        side="top"
        showCloseButton={false}
        className="z-40 gap-0 border-b border-site-muted/15 bg-site-background p-0 text-site-foreground sm:hidden"
      >
        <SheetTitle className="sr-only">Site navigation</SheetTitle>

        <div className="flex h-20 shrink-0 items-center justify-between px-6">
          <BrandLogo site={site} />
          <SheetClose
            className={cn(
              "-mr-3 flex h-11 w-11 items-center justify-center rounded-lg text-site-foreground",
              focusRingClass
            )}
            aria-label="Close menu"
          >
            <X className="size-6" aria-hidden="true" />
          </SheetClose>
        </div>

        <nav aria-label="Site" className="px-6 pb-8">
          <ul className="flex flex-col">
            {site.navigation.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "block rounded-lg py-3 text-lg font-medium hover:text-site-accent",
                    focusRingClass
                  )}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
