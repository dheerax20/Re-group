"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * The landing page's motion vocabulary — three primitives, and nothing else.
 *
 * Every animation on the page is opacity and transform only, which keeps them
 * on the compositor and off the main thread. Nothing loops forever except the
 * float, which is a 6-second translate on a handful of small cards.
 *
 * `useReducedMotion` is honoured at the component level rather than only in
 * CSS: when a visitor has asked for less motion, these render their final state
 * immediately instead of animating quickly. That is the difference between a
 * fast animation and no animation, and only the second one is what was asked
 * for.
 */

export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}) {
  const reduce = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
      viewport={{ once: true, margin: "-80px" }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
    >
      {children}
    </Component>
  );
}

/** Children reveal one after another. Pair with `RevealItem`. */
export function RevealGroup({
  children,
  className,
  stagger = 0.07,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  const reduce = useReducedMotion();

  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: stagger, delayChildren: 0.04 } },
  };

  return (
    <motion.div
      className={className}
      initial={reduce ? false : "hidden"}
      variants={container}
      viewport={{ once: true, margin: "-80px" }}
      whileInView="visible"
    >
      {children}
    </motion.div>
  );
}

export const revealItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={revealItem}>
      {children}
    </motion.div>
  );
}

/**
 * The small UI cards that hover beside a product shot.
 *
 * A 6–8s drift of a few pixels, offset per card so they never move in lockstep
 * — the effect should read as depth, not as animation. Stops dead under
 * reduced motion.
 */
export function Float({
  children,
  className,
  delay = 0,
  distance = 8,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      animate={{ y: [0, -distance, 0] }}
      className={className}
      transition={{
        duration: 6 + delay,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

/** A pill used above section headlines. */
export function SectionEyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-muted",
        className
      )}
    >
      {children}
    </span>
  );
}
