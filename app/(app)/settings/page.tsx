import Link from "next/link";
import { CreditCard, LogOut, PanelsTopLeft, UserRound } from "lucide-react";
import { syncCurrentUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";
import { DataList, DataListRow, RowIcon } from "@/components/layout/data-list";
import { PageHeader } from "@/components/layout/page-header";
import { PageSections, Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Settings — Regroup" };

/** The raw enum is a database detail, not something to show a church. */
const SITE_STATUS_LABEL: Record<"DRAFT" | "PUBLISHED" | "ARCHIVED", string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

/**
 * Settings is a hub, not a form.
 *
 * Everything reachable from here already has a screen that owns it — the
 * account, the plan, the website itself. Duplicating those controls into a
 * settings page is how products end up with two places to change one thing;
 * this just points at them, which is all the sidebar's Settings entry needs to
 * resolve to.
 *
 * Deliberately OUTSIDE the `(dashboard)` paywall, next to billing: a past_due
 * church has to be able to reach its plan, and a settings page that redirects
 * to billing is no use when billing is what they were trying to open.
 */
export default async function SettingsPage() {
  const user = await syncCurrentUser();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your account, your plan, and the website they belong to."
      />

      <PageSections>
        <Section title="Account">
          <DataList>
            <DataListRow
              actions={
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/profile">Open</Link>
                </Button>
              }
              description={user.email ?? "No email on file"}
              leading={
                <RowIcon>
                  <UserRound />
                </RowIcon>
              }
              title="Profile"
            />
            <DataListRow
              actions={
                <Button asChild size="sm" variant="outline">
                  <Link href="/settings/billing">Manage</Link>
                </Button>
              }
              description="Your plan, add-ons, payment method and invoices."
              leading={
                <RowIcon>
                  <CreditCard />
                </RowIcon>
              }
              title="Billing &amp; plan"
            />
          </DataList>
        </Section>

        <Section title="Church">
          <DataList>
            <DataListRow
              actions={
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/website">Open</Link>
                </Button>
              }
              description={
                user.site
                  ? "Pages, domain, and the services connected to your site."
                  : "You have not built a website yet."
              }
              leading={
                <RowIcon>
                  <PanelsTopLeft />
                </RowIcon>
              }
              title={user.site?.name ?? "Website"}
              trailing={
                user.site ? (
                  <Badge
                    dot
                    variant={user.site.status === "PUBLISHED" ? "success" : "warning"}
                  >
                    {SITE_STATUS_LABEL[user.site.status]}
                  </Badge>
                ) : null
              }
            />
          </DataList>
        </Section>

        <Section title="Session">
          <DataList>
            <DataListRow
              actions={
                <LogoutButton className={buttonVariants({ size: "sm", variant: "outline" })}>
                  Log out
                </LogoutButton>
              }
              description="Sign out of Regroup on this device."
              leading={
                <RowIcon>
                  <LogOut />
                </RowIcon>
              }
              title="Log out"
            />
          </DataList>
        </Section>
      </PageSections>
    </>
  );
}
