"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RegroupLogo } from "@/components/layout/regroup-logo";
import { fadeUp, staggerContainer } from "@/lib/motion/variants";

export function OnboardingWelcome({
  startAction,
}: {
  startAction: () => Promise<void>;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
        <RegroupLogo href="/" />

        <div className="flex flex-1 flex-col justify-center py-16">
          <motion.div
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
            variants={staggerContainer}
          >
            <motion.p
              variants={fadeUp}
              className="text-sm font-medium text-muted"
            >
              Website builder
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="mt-3 text-4xl font-semibold tracking-tight text-foreground"
            >
              Create a site that feels like your church.
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
              A short guided setup. We use your answers to recommend templates,
              compose sections, and generate a publish-ready configuration.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3"
            >
              {[
                { step: "01", label: "Profile", desc: "Church details" },
                { step: "02", label: "Brand", desc: "Colors & type" },
                { step: "03", label: "Generate", desc: "Matched designs" },
              ].map((item) => (
                <div key={item.step} className="bg-surface p-4">
                  <p className="text-xs tabular-nums text-muted">{item.step}</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-sm text-muted">{item.desc}</p>
                </div>
              ))}
            </motion.div>

            <motion.form variants={fadeUp} action={startAction} className="mt-10">
              <Button type="submit" size="lg">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
