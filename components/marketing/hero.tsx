"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RegroupLogo } from "@/components/layout/regroup-logo";
import { fadeUp, scaleIn, staggerContainer } from "@/lib/motion/variants";

export function MarketingNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <RegroupLogo />
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#builder" className="transition-colors hover:text-foreground">
            Builder
          </a>
          <a href="#platform" className="transition-colors hover:text-foreground">
            Platform
          </a>
          <Link href="/login" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
        </nav>
        <Link href="/signup">
          <Button size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90">
            Create your church
          </Button>
        </Link>
      </div>
    </header>
  );
}

export function HeroSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden regroup-noise pt-28 pb-16 sm:pt-32 sm:pb-24">
      <div className="regroup-grid absolute inset-0 opacity-60" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <motion.div
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          variants={staggerContainer}
          className="max-w-xl"
        >
          <motion.p
            variants={fadeUp}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-accent"
          >
            <span className="h-px w-6 bg-accent" aria-hidden />
            The digital home for your church
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="mt-5 font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.6rem] lg:leading-[1.08]"
          >
            Build a website your church can call home.
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
            Create a beautiful church website, manage your events, organize your courses,
            and connect your community — all from one platform.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup">
              <Button size="lg" className="bg-brand text-brand-foreground hover:bg-brand/90">
                Create your church
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#builder">
              <Button size="lg" variant="outline">
                Explore the builder
              </Button>
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          variants={scaleIn}
          className="relative"
        >
          <BuilderPreviewMock />
          <FloatingChip className="left-[-8%] top-[18%] hidden sm:flex" label="Pages" />
          <FloatingChip className="right-[-4%] top-[42%] hidden sm:flex" label="Theme" />
          <FloatingChip className="bottom-[8%] left-[12%] hidden sm:flex" label="Publish" />
        </motion.div>
      </div>
    </section>
  );
}

function FloatingChip({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`absolute rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-[var(--shadow-soft)] ${className}`}
    >
      {label}
    </div>
  );
}

export function BuilderPreviewMock({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-lift)] ${
        compact ? "" : "rotate-[-1deg]"
      }`}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-accent-soft" />
          <div className="h-2.5 w-2.5 rounded-full bg-accent-soft" />
          <div className="h-2.5 w-2.5 rounded-full bg-accent-soft" />
          <span className="ml-2 text-xs font-medium text-muted">Website Builder</span>
        </div>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
          Live preview
        </span>
      </div>
      <div className="grid grid-cols-[72px_1fr]">
        <div className="space-y-2 border-r border-border bg-surface-muted p-2">
          {["Pages", "Sections", "Theme", "Media"].map((item) => (
            <div
              key={item}
              className="rounded-lg bg-surface px-2 py-2 text-[10px] font-medium text-muted shadow-sm"
            >
              {item}
            </div>
          ))}
        </div>
        <div className="bg-surface-muted p-3">
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-brand" />
                <span className="font-serif text-[12px] font-semibold">Grace Community</span>
              </div>
              <div className="hidden gap-3 text-[10px] text-muted sm:flex">
                <span>About</span>
                <span>Events</span>
                <span>Contact</span>
              </div>
            </div>
            <div className="grid gap-3 p-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
                  Sundays 10 AM
                </p>
                <p className="mt-1 font-serif text-sm font-semibold leading-snug">
                  Welcome to Grace Community Church
                </p>
                <div className="mt-3 inline-flex rounded-lg bg-accent px-2.5 py-1 text-[10px] font-medium text-accent-foreground">
                  Plan a Visit
                </div>
              </div>
              <div className="min-h-[88px] rounded-xl bg-gradient-to-br from-brand via-[#334155] to-accent" />
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-border bg-surface-muted p-3">
              {["Sunday Worship", "Youth Night", "Bible Study"].map((title) => (
                <div key={title} className="rounded-lg border border-border bg-surface p-2">
                  <p className="text-[10px] font-semibold">{title}</p>
                  <p className="mt-1 text-[9px] text-muted">This week</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
