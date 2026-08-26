"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { BrowserFrame } from "@/components/marketing/product-chrome";
import { Reveal } from "@/components/marketing/motion-primitives";
import {
  ChurchSitePreview,
  DomainPreview,
  EventsPreview,
  SermonsPreview,
} from "@/components/marketing/previews";
import { cn } from "@/lib/utils";

/**
 * Four steps, one screen each.
 *
 * The active step is driven by scroll position rather than a timer: an
 * IntersectionObserver watches four sentinels, and whichever is crossing the
 * middle of the viewport owns the panel. A carousel that advances on its own
 * fights the reader; this one only moves when they do.
 *
 * On a phone the sticky panel is dropped entirely and each step renders its own
 * screenshot inline — a sticky element that takes half a short viewport leaves
 * no room for the thing it is explaining.
 */

const STEPS = [
  {
    number: "01",
    title: "Build",
    body: "Answer a few questions about your church and get a complete site — pages, sections and copy — ready to edit.",
    url: "gracecommunity.org",
    preview: <ChurchSitePreview dense />,
  },
  {
    number: "02",
    title: "Publish",
    body: "Connect the domain you already own, or use the address we give you. Certificates and DNS are handled for you.",
    url: "gracecommunity.org/domains",
    preview: (
      <div className="p-5">
        <DomainPreview />
      </div>
    ),
  },
  {
    number: "03",
    title: "Connect",
    body: "Add events, take RSVPs, send QR tickets, and check people in at the door from a phone.",
    url: "gracecommunity.org/events",
    preview: (
      <div className="p-5">
        <EventsPreview />
      </div>
    ),
  },
  {
    number: "04",
    title: "Grow",
    body: "Every sermon becomes a searchable library, and your team stays in step through Slack.",
    url: "gracecommunity.org/sermons",
    preview: (
      <div className="p-5">
        <SermonsPreview />
      </div>
    ),
  },
];

export function StorySection() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const refs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const nodes = refs.current.filter(Boolean) as HTMLDivElement[];
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.step);
          if (!Number.isNaN(index)) setActive(index);
        }
      },
      // A narrow band across the middle of the viewport: the step that is
      // being *read* is the one that wins, not the one merely on screen.
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      className="border-y border-border bg-surface-muted/40 px-5 py-20 sm:px-8 sm:py-28"
      id="how-it-works"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <h2 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[46px]">
            From idea to published
            <br />
            <span className="text-muted">in minutes.</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* Steps */}
          <div className="space-y-2">
            {STEPS.map((step, index) => (
              <div
                data-step={index}
                key={step.number}
                ref={(node) => {
                  refs.current[index] = node;
                }}
              >
                <div
                  className={cn(
                    "rounded-2xl border px-5 py-5 transition-all duration-300",
                    active === index
                      ? "border-border bg-surface shadow-[var(--shadow-soft)]"
                      : "border-transparent bg-transparent"
                  )}
                >
                  <div className="flex items-baseline gap-3">
                    <span
                      className={cn(
                        "tabular text-[13px] font-semibold transition-colors",
                        active === index ? "text-brand" : "text-muted/60"
                      )}
                    >
                      {step.number}
                    </span>
                    <h3
                      className={cn(
                        "text-[20px] font-semibold tracking-[-0.015em] transition-colors",
                        active === index ? "text-foreground" : "text-muted"
                      )}
                    >
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-1.5 max-w-[46ch] pl-8 text-[15px] leading-relaxed text-muted">
                    {step.body}
                  </p>
                </div>

                {/* Phones get the screenshot inline, under its own step. */}
                <div className="mt-3 lg:hidden">
                  <BrowserFrame url={step.url}>{step.preview}</BrowserFrame>
                </div>
              </div>
            ))}
          </div>

          {/* Sticky panel, desktop only. */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -8 }}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  key={active}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <BrowserFrame url={STEPS[active].url}>
                    {STEPS[active].preview}
                  </BrowserFrame>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
