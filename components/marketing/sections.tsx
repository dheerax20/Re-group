"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Calendar,
  Users,
  GraduationCap,
  Globe,
  ArrowDown,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuilderPreviewMock } from "@/components/marketing/hero";
import { demoEvents, demoMembers, demoCourses } from "@/lib/demo/mock-data";
import { fadeUp, staggerContainer } from "@/lib/motion/variants";

function SectionReveal({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      id={id}
      className={className}
      initial={reduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={staggerContainer}
    >
      {children}
    </motion.section>
  );
}

export function MarketingSections() {
  return (
    <>
      <SectionReveal id="builder" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <motion.div variants={fadeUp} className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Website Builder
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Your church website, without the complexity.
          </h2>
          <p className="mt-4 text-muted">
            Drag sections, customize themes, manage pages, and publish — designed to feel
            like a modern visual editor, built for churches.
          </p>
        </motion.div>
        <motion.div variants={fadeUp} className="mt-10">
          <BuilderPreviewMock compact />
        </motion.div>
        <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3 text-sm text-muted">
          {["Drag and drop", "Pages", "Themes", "Navigation", "Sections", "Publishing"].map(
            (item) => (
              <span
                key={item}
                className="rounded-full border border-border bg-surface px-3 py-1.5"
              >
                {item}
              </span>
            )
          )}
        </motion.div>
      </SectionReveal>

      <SectionReveal className="border-y border-border bg-surface py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-2 lg:items-center">
          <motion.div variants={fadeUp}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
              Events
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Keep your calendar clear and welcoming.
            </h2>
            <p className="mt-4 text-muted">
              Publish gatherings, track attendance, and keep your community informed.
            </p>
          </motion.div>
          <motion.div variants={fadeUp} className="space-y-3">
            {demoEvents.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)]"
              >
                <div className="rounded-xl bg-brand-soft p-2.5 text-brand">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">{event.title}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {event.date} · {event.attendees} attending
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </SectionReveal>

      <SectionReveal className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <motion.div variants={fadeUp} className="order-2 overflow-hidden rounded-2xl border border-border bg-surface lg:order-1">
            <div className="border-b border-border px-4 py-3 text-sm font-medium">Members</div>
            <div className="divide-y divide-border">
              {demoMembers.slice(0, 4).map((member) => (
                <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                    {member.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    <p className="truncate text-xs text-muted">{member.groups.join(" · ")}</p>
                  </div>
                  <span className="text-xs text-muted">{member.status}</span>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div variants={fadeUp} className="order-1 lg:order-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
              Members
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Know your people at a glance.
            </h2>
            <p className="mt-4 text-muted">
              A simple CRM for your congregation — groups, status, and connection in one
              place.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm text-brand">
              <Users className="h-4 w-4" />
              Built for pastoral care teams
            </div>
          </motion.div>
        </div>
      </SectionReveal>

      <SectionReveal className="border-y border-border bg-surface py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div variants={fadeUp} className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
              Courses
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Disciple with clarity.
            </h2>
            <p className="mt-4 text-muted">
              Lightweight course management for classes, pathways, and seasonal studies.
            </p>
          </motion.div>
          <motion.div variants={fadeUp} className="mt-8 grid gap-4 sm:grid-cols-3">
            {demoCourses.map((course) => (
              <div
                key={course.id}
                className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
              >
                <GraduationCap className="h-5 w-5 text-brand" />
                <p className="mt-4 font-semibold">{course.title}</p>
                <p className="mt-1 text-sm text-muted">{course.instructor}</p>
                <p className="mt-4 text-xs text-muted">
                  {course.students} students · {course.lessons} lessons
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </SectionReveal>

      <SectionReveal id="platform" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <motion.div variants={fadeUp} className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Everything connected
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            One platform. One church home.
          </h2>
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="mx-auto mt-12 flex max-w-md flex-col items-center gap-3"
        >
          {[
            { icon: Globe, label: "Website" },
            { icon: Calendar, label: "Events" },
            { icon: Users, label: "Members" },
            { icon: GraduationCap, label: "Courses" },
          ].map((item, index) => (
            <div key={item.label} className="flex w-full flex-col items-center">
              <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 shadow-[var(--shadow-soft)]">
                <item.icon className="h-5 w-5 text-brand" />
                <span className="font-medium">{item.label}</span>
              </div>
              {index < 3 ? <ArrowDown className="my-1 h-4 w-4 text-muted" /> : null}
            </div>
          ))}
        </motion.div>
      </SectionReveal>

      <SectionReveal className="px-6 pb-24">
        <motion.div
          variants={fadeUp}
          className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-border bg-brand px-8 py-14 text-center text-brand-foreground sm:px-16"
        >
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Give your church a digital home.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-brand-foreground/80">
            Start with the builder. Grow into events, members, and courses — without
            leaving Regroup.
          </p>
          <Link href="/builder" className="mt-8 inline-flex">
            <Button size="lg" className="bg-white text-brand hover:bg-white/90">
              Start building
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </SectionReveal>

      <footer className="border-t border-border bg-surface px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm font-semibold">Regroup</p>
          <p className="text-sm text-muted">
            © {new Date().getFullYear()} Regroup. Built for churches.
          </p>
        </div>
      </footer>
    </>
  );
}
