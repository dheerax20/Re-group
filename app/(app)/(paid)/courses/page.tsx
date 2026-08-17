import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Courses — Regroup" };

/**
 * Courses is not built yet — see the note in `members/page.tsx`. This screen
 * previously rendered a fabricated course catalogue behind the paywall.
 */
const PLANNED = [
  {
    title: "Learning pathways",
    detail: "Group lessons into a course a new believer can work through.",
  },
  {
    title: "Publish to your site",
    detail: "Courses appear on your church website with no extra setup.",
  },
  {
    title: "See who has finished",
    detail: "Track progress so leaders know who to check in with.",
  },
];

export default function CoursesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Courses"
        description="Discipleship pathways for your community."
      />

      <EmptyState
        icon={GraduationCap}
        title="Courses is coming soon"
        description="We are building this after members. Nothing is stored here yet, so there is nothing to set up."
        action={
          <Link href="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
        }
      />

      <Card variant="flat" className="mt-4">
        <CardTitle className="text-sm">What it will do</CardTitle>
        <CardDescription className="text-xs">
          Planned for the courses release.
        </CardDescription>
        <ul className="mt-4 space-y-3">
          {PLANNED.map((item) => (
            <li key={item.title}>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
