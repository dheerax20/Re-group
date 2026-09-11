import { syncCurrentUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Profile — Regroup" };

/**
 * The account, and the church details the website is built from.
 *
 * The second half is new: everything the onboarding wizard collects — name,
 * story, contact, logo, favicon, colours, fonts, social links — was
 * write-once until this page grew tabs for it. The forms themselves are the
 * wizard's own; see `profile-tabs.tsx`.
 */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const user = await syncCurrentUser();

  // A church with a plan but no site yet is a real state — the tabs component
  // renders Account alone rather than guessing at an empty config.
  const site = user.site
    ? await (await api()).site.config({ siteId: user.site.id })
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Profile"
        description="Your account, and the church details your website is built from."
        actions={
          <LogoutButton className={buttonVariants({ variant: "outline" })}>
            Log out
          </LogoutButton>
        }
      />

      <ProfileTabs
        account={{
          name: user.name,
          email: user.email,
          picture: user.picture,
          siteName: user.site?.name ?? null,
          siteStatus: user.site?.status ?? null,
        }}
        defaultTab={tab ?? "account"}
        site={site}
        siteId={user.site?.id ?? null}
      />
    </div>
  );
}
