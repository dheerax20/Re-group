"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The hero.
 *
 * A looping muted video plays behind the copy as the background — no
 * overlay/scrim layer on top of it. The copy sits at the bottom of the
 * section instead of dead center, so the video reads clearly above it
 * rather than being hidden behind text.
 *
 * Load order is staged rather than simultaneous: headline, then sub, then the
 * buttons. Roughly 0.6s end to end, and entirely skipped under reduced motion.
 */
export function Hero() {
  const reduce = useReducedMotion();

  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    animate: reduce ? undefined : { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay },
  });

  return (
    <section className="relative flex min-h-[92vh] items-end overflow-hidden px-5 pb-16 pt-16 sm:px-8 sm:pb-24">
      <video
        aria-hidden
        autoPlay
        className="pointer-events-none absolute inset-0 size-full object-cover object-bottom opacity-50"
        loop
        muted
        playsInline
        src="/herovideo.mp4"
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
          className="mx-auto mt-5 max-w-[52ch] text-[17px] leading-relaxed text-foreground sm:text-[19px]"
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

      
      </div>
    </section>
  );
}
