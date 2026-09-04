"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

import { BrandForm } from "@/components/onboarding/brand-form";
import { ChurchForm } from "@/components/onboarding/church-form";
import { SocialForm } from "@/components/onboarding/social-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SiteConfig } from "@/lib/site/types";

/**
 * Profile, as four tabs.
 *
 * Everything a church told us during onboarding used to be write-once: the
 * wizard steps that collect it are only reachable mid-wizard, so a rebrand, a
 * new pastor or a new Instagram account had nowhere to be entered. The three
 * church tabs here are the SAME components the wizard renders
 * (`components/onboarding/*-form.tsx`) — every one of them already accepted an
 * optional `nextHref` plus `onSaved`/`submitLabel`, and drops its Back button
 * and router push when they are absent. Nothing had ever called them that way.
 *
 * Reusing them rather than writing settings copies is what stops the two
 * surfaces drifting: a field added to the wizard appears here on the same
 * deploy, validated by the same schema and written by the same mutation.
 */

export type ProfileAccount = {
  name: string | null;
  email: string | null;
  picture: string | null;
  siteName: string | null;
  siteStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED" | null;
};

/** The raw enum is a database detail, not something to show a church. */
const SITE_STATUS_LABEL: Record<"DRAFT" | "PUBLISHED" | "ARCHIVED", string> = {
  DRAFT: "Draft",
  PUBLISHED: "Live",
  ARCHIVED: "Archived",
};

const TABS = ["account", "church", "brand", "social"] as const;
type TabValue = (typeof TABS)[number];

function isTab(value: string): value is TabValue {
  return (TABS as readonly string[]).includes(value);
}

function AccountCard({ account }: { account: ProfileAccount }) {
  const initial = (
    account.name?.trim()?.[0] ??
    account.email?.trim()?.[0] ??
    "U"
  ).toUpperCase();

  return (
    <Card padding="lg">
      <div className="flex items-center gap-4">
        {account.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={account.picture}
            alt=""
            className="size-14 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-lg font-semibold text-brand-strong">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{account.name ?? "Account"}</p>
          <p className="truncate text-sm text-muted">
            {account.email ?? "No email on file"}
          </p>
        </div>
      </div>

      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
          <dt className="text-muted">Website</dt>
          <dd className="font-medium">{account.siteName ?? "Not built yet"}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
          <dt className="text-muted">Status</dt>
          <dd>
            {account.siteStatus ? (
              <Badge
                variant={account.siteStatus === "PUBLISHED" ? "success" : "warning"}
                dot
              >
                {SITE_STATUS_LABEL[account.siteStatus]}
              </Badge>
            ) : (
              <span className="text-muted">—</span>
            )}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

export function ProfileTabs({
  siteId,
  site,
  defaultTab,
  account,
}: {
  /** Null when the church has a plan but has not built a site yet. */
  siteId: string | null;
  site: SiteConfig | null;
  defaultTab: string;
  account: ProfileAccount;
}) {
  const router = useRouter();

  /**
   * A save here can change the church's NAME, which the sidebar and every
   * page header read from the server. The forms hold their own state, so this
   * is not about the fields — it is about everything else on screen that is
   * now stale.
   */
  const onSaved = () => router.refresh();

  // The three church tabs cannot exist without a site to write to.
  const hasSite = Boolean(siteId && site);
  const initial: TabValue =
    hasSite && isTab(defaultTab) ? defaultTab : "account";

  return (
    <Tabs defaultValue={initial}>
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        {hasSite ? (
          <>
            <TabsTrigger value="church">Church</TabsTrigger>
            <TabsTrigger value="brand">Brand</TabsTrigger>
            <TabsTrigger value="social">Social</TabsTrigger>
          </>
        ) : null}
      </TabsList>

      <TabsContent value="account">
        <AccountCard account={account} />
        {hasSite ? null : (
          <p className="mt-4 text-sm text-muted">
            Your church details appear here once you have a website.{" "}
            <Link className="font-medium text-brand hover:underline" href="/builder">
              Build one
            </Link>
            .
          </p>
        )}
      </TabsContent>

      {hasSite && siteId && site ? (
        <>
          <TabsContent value="church">
            <ChurchForm
              defaultValues={site}
              onSaved={onSaved}
              siteId={siteId}
              submitLabel="Save changes"
            />
          </TabsContent>

          <TabsContent value="brand">
            <BrandForm
              churchName={site.site.name}
              defaultValues={site.brand}
              onSaved={onSaved}
              siteId={siteId}
              submitLabel="Save changes"
            />
          </TabsContent>

          <TabsContent value="social">
            <SocialForm
              defaultValues={site.socialLinks}
              onSaved={onSaved}
              siteId={siteId}
              submitLabel="Save changes"
            />
          </TabsContent>
        </>
      ) : null}
    </Tabs>
  );
}
