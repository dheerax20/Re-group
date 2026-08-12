"use client";

import { motion, useReducedMotion } from "framer-motion";
import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { demoCourses } from "@/lib/demo/mock-data";
import { fadeUp, staggerContainer } from "@/lib/motion/variants";

export default function CoursesPage() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Courses"
          description="Disciple your community with clear learning pathways."
          actions={
            <Button className="bg-brand text-brand-foreground hover:bg-brand/90">
              Create course
            </Button>
          }
        />
      </motion.div>

      <motion.div variants={fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {demoCourses.map((course) => (
          <div
            key={course.id}
            className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-xl bg-brand-soft p-2.5 text-brand">
                <GraduationCap className="h-5 w-5" />
              </div>
              <Badge variant={course.status === "Published" ? "default" : "secondary"}>
                {course.status}
              </Badge>
            </div>
            <h3 className="mt-4 text-lg font-semibold">{course.title}</h3>
            <p className="mt-1 text-sm text-muted">{course.instructor}</p>
            <div className="mt-5 flex items-center justify-between text-sm text-muted">
              <span>{course.students} students</span>
              <span>{course.lessons} lessons</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${course.progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {course.progress > 0 ? `${course.progress}% avg progress` : "Not started"}
            </p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
