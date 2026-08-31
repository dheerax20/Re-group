"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { SiteConfig } from "@/lib/site/types";
import { cn } from "@/lib/utils";
import { focusRingClass } from "./tokens";

/** Ported from the old `navbar.tsx` — the mobile hamburger needs client state, so this is the one interactive island the (server) block renderer mounts. */
export function BrandLogoBlockView({ site }: { site: SiteConfig }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 rounded-sm font-semibold", focusRingClass)}>
      {site.brand.logo.url ? (
        <Image
          src={site.brand.logo.url}
          alt={site.brand.logo.alt || site.site.name}
          width={32}
          height={32}
          className="h-8 w-auto object-contain"
        />
      ) : (
        <span className="text-xl">{site.site.name}</span>
      )}
    </Link>
  );
}

export function NavLinksBlockView({ site, tone = "default" }: { site: SiteConfig; tone?: "default" | "inverted" }) {
  const [open, setOpen] = useState(false);
  const dark = tone === "inverted";

  return (
    <div className="relative">
      <ul className="hidden items-center gap-6 text-base font-medium md:flex">
        {site.navigation.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={cn("rounded-sm hover:text-site-accent", focusRingClass)}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-xl md:hidden",
          focusRingClass,
          dark ? "text-white hover:bg-white/10" : "text-site-foreground hover:bg-site-muted/10"
        )}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>
      {open ? (
        <ul
          className={cn(
            "absolute right-0 top-full z-20 mt-2 grid w-48 gap-1 rounded-2xl p-2 text-base font-medium shadow-lg md:hidden",
            dark ? "bg-site-primary text-white" : "bg-site-background text-site-foreground"
          )}
        >
          {site.navigation.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn("block rounded-lg px-3 py-2 hover:bg-site-muted/10", focusRingClass)}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
