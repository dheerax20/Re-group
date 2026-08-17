"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { SectionProps } from "@/lib/site/types";
import { Container } from "./_shared";
import { cn } from "@/lib/utils";

function Brand({ site }: SectionProps) {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold">
      {site.brand.logo.url ? (
        <Image
          src={site.brand.logo.url}
          alt={site.brand.logo.alt || site.site.name}
          width={32}
          height={32}
          className="h-8 w-auto object-contain"
        />
      ) : (
        <span className="text-lg">{site.site.name}</span>
      )}
    </Link>
  );
}

function NavLinks({
  site,
  className,
  onNavigate,
}: SectionProps & { className?: string; onNavigate?: () => void }) {
  return (
    <ul className={className}>
      {site.navigation.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="block rounded-lg px-3 py-2 transition-colors hover:text-site-accent md:px-0 md:py-0"
            onClick={onNavigate}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NavbarShell({
  site,
  config,
  content,
  tone,
}: SectionProps & { tone: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const dark = tone === "dark";

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <Brand site={site} config={config} content={content} />
        <NavLinks
          site={site}
          config={config}
          content={content}
          className="hidden items-center gap-6 text-sm font-medium md:flex"
        />
        <button
          type="button"
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-xl md:hidden",
            dark ? "text-white hover:bg-white/10" : "text-site-foreground hover:bg-site-muted/10"
          )}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open ? (
        <NavLinks
          site={site}
          config={config}
          content={content}
          onNavigate={() => setOpen(false)}
          className={cn(
            "mt-4 grid gap-1 rounded-2xl p-2 text-sm font-medium md:hidden",
            dark ? "bg-white/10 text-white" : "bg-site-muted/10"
          )}
        />
      ) : null}
    </>
  );
}

export function NavbarTransparent(props: SectionProps) {
  return (
    <header className="absolute inset-x-0 top-0 z-20 py-4">
      <Container className="text-white">
        <NavbarShell {...props} tone="dark" />
      </Container>
    </header>
  );
}

export function NavbarSolid(props: SectionProps) {
  return (
    <header className="border-b border-site-muted/15 bg-site-background py-3">
      <Container>
        <NavbarShell {...props} tone="light" />
      </Container>
    </header>
  );
}

export function NavbarMinimal(props: SectionProps) {
  return (
    <header className="py-5">
      <Container>
        <NavbarShell {...props} tone="light" />
      </Container>
    </header>
  );
}
