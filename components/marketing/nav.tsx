"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A floating pill that condenses on scroll.
 *
 * It starts flush and transparent over the hero, then at ~16px of scroll gains
 * a border, a blur and a shadow — so the page opens on the headline rather than
 * on our navigation, but the bar never disappears from a reader who has scrolled
 * two screens down and wants to sign up.
 *
 * Four links, maximum. Everything else in the product is reachable after login,
 * and a marketing nav that mirrors an app's sitemap is how a landing page starts
 * feeling like a corporate site.
 */

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A drawer that stays open behind a navigation is a trap on a phone.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, [open]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:pt-4">
      <div
        className={cn(
          "pointer-events-auto mx-auto flex max-w-5xl items-center gap-3 rounded-full px-3 py-2 transition-all duration-300 sm:px-4",
          scrolled
            ? "border border-border bg-surface/80 shadow-[var(--shadow-soft)] backdrop-blur-xl"
            : "border border-transparent bg-transparent"
        )}
      >
        <Link
          className="flex shrink-0 items-center gap-2.5 rounded-full pr-2"
          href="/"
        >
          <span className="flex size-8 items-center justify-center rounded-xl bg-brand text-[13px] font-bold text-brand-foreground">
            R
          </span>
          <span className="leading-none">
            <span className="block text-[15px] font-semibold tracking-[-0.01em] text-foreground">
              Regroup
            </span>
            <span className="mt-0.5 block text-[10px] leading-none text-muted">
              Church OS
            </span>
          </span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              className="rounded-full px-3 py-1.5 text-[14px] font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link
            className="rounded-full px-3 py-1.5 text-[14px] font-medium text-muted transition-colors hover:text-foreground"
            href="/login"
          >
            Log in
          </Link>
          <Button asChild className="rounded-full" size="sm">
            <Link href="/signup">Get started</Link>
          </Button>
        </div>

        <button
          aria-controls="marketing-menu"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="ml-auto flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-muted md:hidden"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <div
          className="pointer-events-auto mx-auto mt-2 max-w-5xl rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow-lift)] md:hidden"
          id="marketing-menu"
        >
          <nav className="flex flex-col">
            {LINKS.map((link) => (
              <a
                className="rounded-xl px-3 py-2.5 text-[15px] font-medium text-foreground transition-colors hover:bg-surface-muted"
                href={link.href}
                key={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-1 flex flex-col gap-2 border-t border-border p-2 pt-3">
            <Button asChild className="w-full rounded-full" variant="outline">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild className="w-full rounded-full">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
