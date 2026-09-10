import Link from "next/link";
import { Users } from "lucide-react";

import { api } from "@/server/trpc/caller";
import { isGhlConfigured } from "@/lib/ghl/config";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { MembersTable, type MemberRecord } from "@/components/members/members-table";

export const metadata = { title: "Members — Regroup" };

/**
 * The congregation directory.
 *
 * `syncEnabled` is resolved HERE rather than in the client component because
 * `isGhlConfigured()` reads server-only env vars. When it is false the whole
 * contacts column disappears instead of showing every member as unsynced —
 * the same "an unconfigured integration vanishes from the UI" posture as the
 * Courses handoff.
 */
export default async function MembersPage() {
  const trpc = await api();
  const site = await trpc.site.mine();

  if (!site) {
    return (
      <>
        <PageHeader
          eyebrow="Congregation"
          title="Members"
          description="A directory for your congregation — visitors and members."
        />
        <EmptyState
          action={
            <Button asChild>
              <Link href="/builder">Build my website</Link>
            </Button>
          }
          description="Your directory belongs to a site. Once yours exists, everyone you add here is kept with it."
          icon={Users}
          title="Build your website first"
        />
      </>
    );
  }

  const members = (await trpc.members.list({ siteId: site.id })) as MemberRecord[];
  const syncEnabled = isGhlConfigured();

  return (
    <>
      <PageHeader
        eyebrow="Congregation"
        title="Members"
        description={
          syncEnabled
            ? "A directory for your congregation — everyone you add is synced to your contacts."
            : "A directory for your congregation — visitors and members."
        }
      />
      <MembersTable members={members} siteId={site.id} syncEnabled={syncEnabled} />
    </>
  );
}
