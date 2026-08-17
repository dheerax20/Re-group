import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Members — Regroup" };

/**
 * Members is not built yet.
 *
 * This screen used to render `demoMembers` — invented names and email addresses,
 * with working search over them — behind the paywall. A church would reasonably
 * read that as their own directory failing to load, or worse, as real data. An
 * honest empty state is the better product and the honest one.
 */
const PLANNED = [
  {
    title: "One directory",
    detail: "Households, contact details, and who is new — kept in one place.",
  },
  {
    title: "Groups and serving teams",
    detail: "Track who is in which small group, team, or ministry.",
  },
  {
    title: "Follow-up that does not get lost",
    detail: "See first-time visitors and who has reached out to them.",
  },
];

export default function MembersPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Members"
        description="A directory for your congregation."
      />

      <EmptyState
        icon={Users}
        title="Members is coming soon"
        description="We are building this next. Nothing is stored here yet, so there is nothing to set up — your website and content are unaffected."
        action={
          <Link href="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
        }
      />

      <Card variant="flat" className="mt-4">
        <CardTitle className="text-sm">What it will do</CardTitle>
        <CardDescription className="text-xs">
          Planned for the members release.
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
