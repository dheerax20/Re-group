"use client";

import { motion, useReducedMotion } from "framer-motion";
import { easeOut, fadeUp, staggerContainer } from "@/lib/motion/variants";

/**
 * The post-checkout success screen.
 *
 * This used to list `Entitlement.featureKey` verbatim — `site_builder`,
 * `website_builder` — which read like debug output on the very first screen a
 * church sees after paying. The plan is already on the billing screen; what
 * this moment needs to say is "it worked", and then get out of the way.
 *
 * The page itself is an async server component (it awaits the session and the
 * entitlement check), so the animation lives here and the Server Function form
 * arrives as `children` rather than being reimplemented client-side.
 */
export function WelcomeSuccess({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={staggerContainer}
      className="w-full max-w-md rounded-panel border border-border bg-surface p-8 text-center shadow-[var(--shadow-soft)]"
    >
      <AnimatedCheck reduceMotion={Boolean(reduceMotion)} />

      <motion.h1
        variants={fadeUp}
        className="mt-5 text-2xl font-semibold tracking-tight text-foreground"
      >
        You&rsquo;re all set
      </motion.h1>
      <motion.p variants={fadeUp} className="mt-2 text-sm text-muted">
        Your subscription is active. Next, let&rsquo;s build your church website.
      </motion.p>

      <motion.div variants={fadeUp}>{children}</motion.div>
    </motion.div>
  );
}

/**
 * A ring that scales in, then a tick drawn through it.
 *
 * `pathLength` is normalised 0-1 by framer-motion, so the stroke draws without
 * anyone having to measure the path — and it degrades to a plain rendered
 * check when the ring and tick are handed `false` as their initial state.
 *
 * `text-success` is an APP token: this is Regroup's own chrome, and a `site-`
 * utility here would paint it in whichever church happens to be loaded.
 */
function AnimatedCheck({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 52 52"
      role="img"
      aria-label="Payment successful"
      className="mx-auto size-16 text-success"
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
    >
      <motion.circle
        cx="26"
        cy="26"
        r="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.3"
        variants={{
          hidden: { scale: 0.6, opacity: 0 },
          visible: { scale: 1, opacity: 1, transition: easeOut },
        }}
        style={{ transformOrigin: "center" }}
      />
      <motion.path
        d="M15 27.5 L23 35 L38 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          visible: {
            pathLength: 1,
            opacity: 1,
            transition: { duration: 0.45, delay: 0.2, ease: [0.22, 1, 0.36, 1] },
          },
        }}
      />
    </motion.svg>
  );
}
