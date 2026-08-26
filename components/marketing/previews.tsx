"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Calendar,
  Check,
  Globe,
  MapPin,
  MousePointer2,
  Play,
  QrCode,
  ScanLine,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The product, drawn.
 *
 * These are not screenshots and not illustrations — they are the dashboard's
 * own component language (same 12px panels, same hairline borders, same badge
 * shapes, same type scale) rebuilt at marketing scale. That is deliberate: a
 * church that signs up should recognise the screens from the landing page, and
 * a mock that drifts from the product is a promise the product then breaks.
 *
 * Everything here is markup and CSS. No images, no video, no canvas — the page
 * stays fast and there are no stock photos to be wrong about.
 */

/* ------------------------------------------------------------------ *
 * The church website itself — used in the hero and the full showcase.
 * ------------------------------------------------------------------ */

export function ChurchSitePreview({ dense = false }: { dense?: boolean }) {
  return (
    <div className="bg-surface">
      {/* Site navigation */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-md bg-brand text-[9px] font-bold text-brand-foreground">
            G
          </span>
          <span className="text-[12px] font-semibold tracking-[-0.01em]">
            Grace Community
          </span>
        </div>
        <div className="hidden items-center gap-4 text-[11px] text-muted sm:flex">
          <span>About</span>
          <span>Sermons</span>
          <span>Events</span>
          <span className="rounded-md bg-brand px-2 py-1 text-[10px] font-medium text-brand-foreground">
            Plan a visit
          </span>
        </div>
      </div>

      {/* Hero band */}
      <div className="relative overflow-hidden bg-brand px-5 py-8 sm:px-8 sm:py-12">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.7) 0%, transparent 45%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.4) 0%, transparent 40%)",
          }}
        />
        <div className="relative max-w-sm">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-brand-foreground/70">
            Sundays at 10am
          </p>
          <p className="mt-2 text-xl font-semibold leading-[1.1] tracking-[-0.02em] text-brand-foreground sm:text-2xl">
            A place to belong,
            <br />
            right here in Fairview.
          </p>
          <p className="mt-2.5 max-w-[34ch] text-[11px] leading-relaxed text-brand-foreground/75">
            However you found us, there&rsquo;s a seat with your name on it.
          </p>
          <div className="mt-4 flex gap-2">
            <span className="rounded-lg bg-surface px-3 py-1.5 text-[10px] font-medium text-foreground">
              Plan your visit
            </span>
            <span className="rounded-lg border border-brand-foreground/25 px-3 py-1.5 text-[10px] font-medium text-brand-foreground">
              Watch a sermon
            </span>
          </div>
        </div>
      </div>

      {/* Upcoming events strip */}
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
          This week
        </p>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {[
            { title: "Sunday Worship", when: "Sun · 10:00 AM" },
            { title: "Youth Night", when: "Wed · 7:00 PM" },
            { title: "Community Meal", when: "Fri · 6:30 PM" },
          ].map((event) => (
            <div
              className="rounded-lg border border-border bg-surface p-2.5"
              key={event.title}
            >
              <p className="truncate text-[10px] font-semibold">{event.title}</p>
              <p className="tabular mt-1 truncate text-[9px] text-muted">{event.when}</p>
            </div>
          ))}
        </div>
      </div>

      {!dense ? (
        <>
          {/* Sermons */}
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
              Latest messages
            </p>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {["Hope for Today", "The Good Shepherd", "Rooted"].map((title) => (
                <div
                  className="overflow-hidden rounded-lg border border-border"
                  key={title}
                >
                  <div className="relative flex aspect-video items-center justify-center bg-surface-muted">
                    <span className="flex size-6 items-center justify-center rounded-full bg-foreground/60">
                      <Play className="size-2.5 fill-current text-background" />
                    </span>
                  </div>
                  <p className="truncate px-2 py-1.5 text-[9px] font-medium">{title}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 sm:px-5">
            <span className="text-[9px] text-muted">
              124 Oak Street, Fairview
            </span>
            <span className="text-[9px] text-muted">© Grace Community</span>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Website builder — canvas, layer rail, and a drifting cursor.
 * ------------------------------------------------------------------ */

export function BuilderPreview() {
  const reduce = useReducedMotion();

  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] overflow-hidden">
      {/* Layer rail */}
      <div className="space-y-1.5 border-r border-border bg-surface-muted/60 p-2">
        <p className="px-1 pb-0.5 text-[8px] font-medium uppercase tracking-[0.1em] text-muted">
          Sections
        </p>
        {[
          { label: "Hero", active: true },
          { label: "Events", active: false },
          { label: "Sermons", active: false },
          { label: "About", active: false },
          { label: "Contact", active: false },
        ].map((layer) => (
          <div
            className={cn(
              "rounded-md px-2 py-1.5 text-[9px] font-medium",
              layer.active
                ? "bg-brand-soft text-brand-strong"
                : "bg-surface text-muted"
            )}
            key={layer.label}
          >
            {layer.label}
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div className="relative bg-surface-muted/40 p-3">
        <div className="relative overflow-hidden rounded-lg border-2 border-brand/40 bg-surface">
          {/* The selection label a builder shows on the active section. */}
          <span className="absolute left-0 top-0 z-10 rounded-br-md bg-brand px-1.5 py-0.5 text-[8px] font-medium text-brand-foreground">
            Hero
          </span>
          <ChurchSitePreview dense />
        </div>

        {/*
          The cursor drifts between the rail and the canvas — enough to read as
          "someone is editing this", not enough to demand attention.
        */}
        {!reduce ? (
          <motion.span
            animate={{ x: [0, -46, -46, 8, 8, 0], y: [0, -8, 26, 40, 12, 0] }}
            className="pointer-events-none absolute left-1/2 top-1/2 z-20"
            transition={{
              duration: 9,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.2, 0.4, 0.62, 0.82, 1],
            }}
          >
            <MousePointer2 className="size-4 fill-foreground text-background drop-shadow" />
          </motion.span>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Events — a card plus its RSVP ticket.
 * ------------------------------------------------------------------ */

export function EventsPreview() {
  return (
    <div className="space-y-2.5">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-soft)]">
        <div className="flex aspect-[16/7] flex-col items-center justify-center bg-surface-muted">
          <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted">
            August
          </span>
          <span className="tabular text-2xl font-semibold text-foreground/70">30</span>
        </div>
        <div className="space-y-2 p-3">
          <p className="text-[12px] font-semibold tracking-[-0.01em]">Sunday Worship</p>
          <p className="tabular flex items-center gap-1.5 text-[10px] text-muted">
            <Calendar className="size-3" />
            Sun, Aug 30 · 10:00 AM
          </p>
          <p className="flex items-center gap-1.5 text-[10px] text-muted">
            <MapPin className="size-3" />
            Main Sanctuary
          </p>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[9px] font-medium text-success">
              <span className="size-1 rounded-full bg-success" />
              Published
            </span>
            <span className="tabular text-[10px] text-muted">125 capacity</span>
          </div>
        </div>
      </div>

      {/* The attendee's ticket. */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-soft)]">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-foreground">
          <QrCode className="size-6 text-background" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold">Your ticket</p>
          <p className="truncate text-[10px] text-muted">
            Emailed the moment someone RSVPs
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Check-in — scanner, then the confirmation.
 * ------------------------------------------------------------------ */

export function CheckinPreview() {
  const reduce = useReducedMotion();

  return (
    <div className="relative flex flex-col gap-3 px-4 pb-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[11px] font-semibold">Sunday Worship</p>
          <p className="text-[10px] text-muted">Check-in</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-lg border border-brand/25 bg-brand-soft px-2 py-2 text-center">
          <p className="tabular text-base font-semibold leading-none text-brand-strong">
            108
          </p>
          <p className="mt-1 text-[8px] font-medium uppercase tracking-[0.08em] text-muted">
            Checked in
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-2 py-2 text-center">
          <p className="tabular text-base font-semibold leading-none">125</p>
          <p className="mt-1 text-[8px] font-medium uppercase tracking-[0.08em] text-muted">
            Registered
          </p>
        </div>
      </div>

      {/* Scanner viewport with a sweeping line. */}
      <div className="relative aspect-square overflow-hidden rounded-xl bg-foreground">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-24 rounded-xl border-2 border-white/85" />
        </div>
        {!reduce ? (
          <motion.span
            animate={{ y: ["-38%", "38%", "-38%"] }}
            className="absolute inset-x-10 top-1/2 h-px bg-white/70"
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
        <p className="absolute inset-x-0 bottom-3 text-center text-[9px] text-white/80">
          Point at the attendee&rsquo;s ticket
        </p>
      </div>

      {/* The confirmation that follows a scan. */}
      <div className="flex items-center gap-2.5 rounded-xl border border-success/25 bg-success-soft px-3 py-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-white">
          <Check className="size-4" strokeWidth={3} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold">Checked in</p>
          <p className="tabular truncate text-[10px] text-muted">
            Dheeraj Kumar · 10:42 AM
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sermons — the media library.
 * ------------------------------------------------------------------ */

export function SermonsPreview() {
  const sermons = [
    { title: "Hope for Today", speaker: "Pastor John", series: "Foundations" },
    { title: "The Good Shepherd", speaker: "Pastor Ruth", series: "Psalms" },
    { title: "Rooted", speaker: "Pastor John", series: "Foundations" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {sermons.map((sermon) => (
        <div
          className="group overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
          key={sermon.title}
        >
          <div className="relative flex aspect-video items-center justify-center bg-surface-muted">
            <span className="flex size-8 items-center justify-center rounded-full bg-foreground/55 backdrop-blur-[1px] transition-transform group-hover:scale-105">
              <Play className="size-3 translate-x-px fill-current text-background" />
            </span>
            <span className="absolute bottom-1.5 right-1.5 rounded bg-foreground/70 px-1 py-0.5 text-[8px] font-medium text-background">
              YouTube
            </span>
          </div>
          <div className="p-2.5">
            <p className="truncate text-[10px] font-semibold">{sermon.title}</p>
            <p className="mt-0.5 truncate text-[9px] text-muted">{sermon.speaker}</p>
            <span className="mt-1.5 inline-block rounded-full bg-surface-muted px-1.5 py-0.5 text-[8px] font-medium text-muted">
              {sermon.series}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Custom domain.
 * ------------------------------------------------------------------ */

export function DomainPreview() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
          <Globe className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold">gracecommunity.org</p>
          <p className="text-[10px] text-muted">Primary domain</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[9px] font-medium text-success">
          <span className="size-1 rounded-full bg-success" />
          Connected
        </span>
      </div>

      <ul className="space-y-1.5">
        {[
          { icon: Globe, label: "Custom domain" },
          { icon: ShieldCheck, label: "SSL, issued automatically" },
          { icon: Zap, label: "Publishes in seconds" },
        ].map((row) => (
          <li className="flex items-center gap-2 text-[11px] text-muted" key={row.label}>
            <row.icon className="size-3.5 shrink-0 text-brand" />
            {row.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Slack.
 * ------------------------------------------------------------------ */

/** Slack's mark, drawn from paths rather than shipped as an asset. */
function SlackMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d="M5.1 15.2a2.5 2.5 0 1 1-2.5-2.5h2.5v2.5Zm1.3 0a2.5 2.5 0 0 1 5 0v6.3a2.5 2.5 0 1 1-5 0v-6.3Z"
        fill="#E01E5A"
      />
      <path
        d="M8.9 5.1a2.5 2.5 0 1 1 2.5-2.5v2.5H8.9Zm0 1.3a2.5 2.5 0 0 1 0 5H2.6a2.5 2.5 0 0 1 0-5h6.3Z"
        fill="#36C5F0"
      />
      <path
        d="M18.9 8.9a2.5 2.5 0 1 1 2.5 2.5h-2.5V8.9Zm-1.3 0a2.5 2.5 0 0 1-5 0V2.6a2.5 2.5 0 0 1 5 0v6.3Z"
        fill="#2EB67D"
      />
      <path
        d="M15.1 18.9a2.5 2.5 0 1 1-2.5 2.5v-2.5h2.5Zm0-1.3a2.5 2.5 0 0 1 0-5h6.3a2.5 2.5 0 0 1 0 5h-6.3Z"
        fill="#ECB22E"
      />
    </svg>
  );
}

export function SlackPreview() {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <SlackMark className="size-4" />
        <span className="text-[11px] font-semibold">#church-team</span>
      </div>
      <div className="flex gap-2.5 pt-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand text-[9px] font-bold text-brand-foreground">
          R
        </span>
        <div className="min-w-0">
          <p className="text-[10px]">
            <span className="font-semibold">Regroup</span>{" "}
            <span className="rounded bg-surface-muted px-1 py-px text-[8px] font-medium text-muted">
              APP
            </span>
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-foreground">
            New event published — <span className="font-medium">Sunday Worship</span>
          </p>
          <p className="mt-0.5 text-[9px] text-muted">Published by Sarah · just now</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Small shared bits.
 * ------------------------------------------------------------------ */

export function ScanChip() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground">
      <ScanLine className="size-3.5 text-brand" />
      Scan to check in
    </span>
  );
}
