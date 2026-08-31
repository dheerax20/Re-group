"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import type { SiteConfig } from "@/lib/site/types";
import type { NavVariant } from "@/lib/site/types";
import { cn } from "@/lib/utils";
import { PAGE_GUTTER, focusRingClass } from "./tokens";

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
 */
function MobileHeader({ site }: { site: SiteConfig }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  /**
   * Close on navigation.
   *
   * A tap on a link navigates without unmounting this component, so the drawer
   * would otherwise stay open over the page the visitor just asked for. Each
   * link's `onClick` covers the common path; this covers back/forward and any
   * programmatic navigation.
   *
   * Adjusted during render rather than in an effect. Calling `setOpen` from an
   * effect keyed on `pathname` renders the open drawer once against the new
   * page and then immediately re-renders it closed — a visible flash, and the
   * cascading-render pattern React tells you not to write.
   */
  const [pathWhenRendered, setPathWhenRendered] = useState(pathname);
  if (pathname !== pathWhenRendered) {
    setPathWhenRendered(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;

      // Focus trap: the drawer covers the page, so tabbing out of it lands on
      // controls the visitor cannot see.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>("a[href], button");
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === triggerRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        triggerRef.current?.focus();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-30 sm:hidden">
      <div className="flex h-20 items-center justify-between bg-site-background px-6">
        <BrandLogo site={site} />
        <button
          ref={triggerRef}
          type="button"
          // A real 44px tap target. `-mr-3` pulls its optical edge back to the
          // gutter, so the icon lines up with the page rather than the
          // button's padding box.
          className={cn(
            "-mr-3 flex h-11 w-11 items-center justify-center rounded-lg text-site-foreground",
            focusRingClass
          )}
          aria-expanded={open}
          aria-controls="site-nav-drawer"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
        </button>
      </div>

      {/**
       * `grid-rows-[0fr] → [1fr]`, not a `max-height` transition.
       *
       * A max-height animation needs a magic number that has to exceed the real
       * content height, and it breaks the moment a church enables a sixth nav
       * link. The grid technique animates to the content's actual height with
       * no number to maintain. Both values are literal strings, so Tailwind's
       * scanner sees them. The inner element needs `min-h-0` or the row will
       * not collapse.
       *
       * `absolute top-full` so the panel overlays the page: animating the bar's
       * own height would reflow every band beneath it on each frame.
       */}
      <div
        id="site-nav-drawer"
        className={cn(
          "absolute inset-x-0 top-full grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div ref={panelRef} className="min-h-0 overflow-hidden">
          {/**
           * The drawer resolves its OWN surface and text tone rather than
           * inheriting the bar's. Under a transparent direction the bar's links
           * are white, and white links on an opaque panel are invisible.
           */}
          <nav
            aria-label="Site"
            className="border-t border-site-muted/15 bg-site-background px-6 pb-8 pt-2 text-site-foreground shadow-lg"
          >
            <ul className="flex flex-col">
              {site.navigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    // `tabIndex={-1}` while closed: a collapsed grid row is
                    // still in the accessibility tree, so without this the
                    // first Tab on a phone lands inside a drawer nobody opened.
                    tabIndex={open ? undefined : -1}
                    aria-hidden={open ? undefined : true}
                    className={cn(
                      "block rounded-lg py-3 text-lg font-medium hover:text-site-accent",
                      focusRingClass
                    )}
                    onClick={close}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
