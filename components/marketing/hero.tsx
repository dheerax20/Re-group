"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Calendar, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrowserFrame, FloatingCard } from "@/components/marketing/product-chrome";
import { Float } from "@/components/marketing/motion-primitives";
import { ChurchSitePreview } from "@/components/marketing/previews";

/**
 * The hero.
 *
 * The product screenshot is the argument, so it gets the width and the copy
 * gets four lines. A church deciding in five seconds needs to see what their
 * site could look like — not read a paragraph about digital transformation.
 *
 * Load order is staged rather than simultaneous: headline, then sub, then the
 * buttons, then the frame scaling up from 0.96, then the two floating cards.
 * Roughly 0.9s end to end, and entirely skipped under reduced motion.
 */
export function Hero() {
  const reduce = useReducedMotion();

  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    animate: reduce ? undefined : { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay },
  });

  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-28 sm:px-8 sm:pb-24 sm:pt-36">
      {/* One very soft wash behind the frame. No gradient meshes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 0%, var(--brand-soft) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl text-center">
        <motion.p
          {...rise(0)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-muted"
        >
          <span className="size-1.5 rounded-full bg-brand" />
          Church OS — website, events, and people in one place
        </motion.p>

        <motion.h1
          {...rise(0.08)}
          className="mx-auto mt-6 max-w-[16ch] text-[42px] font-bold leading-[1.02] tracking-[-0.03em] text-foreground sm:text-[64px] md:text-[76px] lg:text-[84px]"
        >
          Your church. One beautiful digital home.
        </motion.h1>

        <motion.p
          {...rise(0.16)}
          className="mx-auto mt-5 max-w-[52ch] text-[17px] leading-relaxed text-muted sm:text-[19px]"
        >
          Build your church website, manage events, share sermons, and check
          people in — all from one simple platform.
        </motion.p>

        <motion.div
          {...rise(0.24)}
          className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row"
        >
          <Button asChild className="h-11 w-full rounded-full px-6 text-[15px] sm:w-auto" size="lg">
            <Link href="/signup">
              Start building
              <ArrowRight />
            </Link>
          </Button>
          <Button
            asChild
            className="h-11 w-full rounded-full px-6 text-[15px] sm:w-auto"
            size="lg"
            variant="outline"
          >
            <a href="#how-it-works">See how it works</a>
          </Button>
        </motion.div>

        <motion.p {...rise(0.3)} className="mt-4 text-[13px] text-muted">
          Free to start — no credit card required.
        </motion.p>
      </div>

      {/* The product. */}
      <motion.div
        animate={reduce ? undefined : { opacity: 1, scale: 1, y: 0 }}
        className="relative mx-auto mt-12 max-w-5xl sm:mt-16"
        initial={reduce ? false : { opacity: 0, scale: 0.96, y: 24 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.32 }}
      >
        <BrowserFrame
          label={
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-1.5 py-0.5 text-[9px] font-medium text-success">
              <span className="size-1 rounded-full bg-success" />
              Live
            </span>
          }
          url="gracecommunity.org"
        >
          <ChurchSitePreview />
        </BrowserFrame>

        {/* Floating cards. Hidden on phones, where they would cover the site. */}
        <Float className="absolute -left-6 top-[26%] hidden lg:block" delay={0}>
          <FloatingCard>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold">
              <Calendar className="size-3.5 text-brand" />
              New event
            </p>
            <p className="mt-1 text-[11px] text-muted">Sunday Worship</p>
            <p className="tabular mt-0.5 text-[10px] text-muted">Sun · 10:00 AM</p>
          </FloatingCard>
        </Float>

        <Float className="absolute -right-4 top-[14%] hidden lg:block" delay={1.2}>
          <FloatingCard>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold">
              <span className="flex size-4 items-center justify-center rounded-full bg-success text-white">
                <Check className="size-2.5" strokeWidth={3} />
              </span>
              Published
            </p>
            <p className="mt-1 text-[10px] text-muted">gracecommunity.org</p>
          </FloatingCard>
        </Float>

        <Float className="absolute -right-8 bottom-[16%] hidden lg:block" delay={2.1}>
          <FloatingCard>
            <p className="tabular text-[15px] font-semibold leading-none text-brand-strong">
              108
            </p>
            <p className="mt-1 text-[10px] text-muted">checked in today</p>
          </FloatingCard>
        </Float>
      </motion.div>
    </section>
  );
}
