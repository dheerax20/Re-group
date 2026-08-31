import { PageHeader } from "@/components/layout/page-header";
import { MembersTable } from "@/components/members/members-table";

export const metadata = { title: "Members — Regroup" };

export default function MembersPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Congregation"
        title="Members"
        description="A directory for your congregation — visitors and members, synced to your contacts soon."
      />
      <MembersTable />
    </div>
  );
}
