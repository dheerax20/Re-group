"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

import { BrowserFrame } from "@/components/marketing/product-chrome";
import { Reveal } from "@/components/marketing/motion-primitives";
import { ChurchSitePreview } from "@/components/marketing/previews";

/**
 * The full site, scaling gently into place.
 *
 * `useScroll` on the section, mapped to a small scale and lift — the frame
 * settles as it reaches the middle of the viewport. The range is deliberately
 * tiny (0.94 → 1). Anything larger reads as a gimmick and, worse, makes text
 * inside the frame shimmer while it resamples.
 *
 * Transform and opacity only, so it stays on the compositor, and the whole
 * effect collapses to a static frame under reduced motion.
 */
export function ShowcaseSection() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [40, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.4], [0.6, 1]);

  return (
    <section className="overflow-hidden px-5 py-20 sm:px-8 sm:py-28" ref={ref}>
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[46px]">
            Your website should feel
            <br />
            <span className="text-muted">like your church.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-[17px] leading-relaxed text-muted">
            Warm, clear, and unmistakably yours — with the events, sermons and
            details a visitor actually came looking for.
          </p>
        </Reveal>

        <motion.div
          className="mx-auto mt-12 max-w-5xl"
          style={reduce ? undefined : { scale, y, opacity }}
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
        </motion.div>
      </div>
    </section>
  );
}
