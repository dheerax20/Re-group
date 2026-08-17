import { syncCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Profile — Regroup" };

/** The raw enum is a database detail, not something to show a church. */
const SITE_STATUS_LABEL: Record<"DRAFT" | "PUBLISHED" | "ARCHIVED", string> = {
  DRAFT: "Draft",
  PUBLISHED: "Live",
  ARCHIVED: "Archived",
};

export default async function ProfilePage() {
  const user = await syncCurrentUser();
  const initial = (user.name?.trim()?.[0] ?? user.email?.trim()?.[0] ?? "U").toUpperCase();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Profile"
        description="The account you sign in with."
        actions={
          <Button asChild variant="outline">
            <a href="/auth/logout">Log out</a>
          </Button>
        }
      />

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-4">
          {user.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.picture}
              alt=""
              className="size-14 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-lg font-semibold text-brand">
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{user.name ?? "Account"}</p>
            <p className="truncate text-sm text-muted">{user.email ?? "No email on file"}</p>
          </div>
        </div>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
            <dt className="text-muted">Website</dt>
            <dd className="font-medium">{user.site?.name ?? "Not built yet"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
            <dt className="text-muted">Status</dt>
            <dd>
              {user.site ? (
                <Badge
                  variant={user.site.status === "PUBLISHED" ? "success" : "warning"}
                  dot
                >
                  {SITE_STATUS_LABEL[user.site.status]}
                </Badge>
              ) : (
                <span className="text-muted">—</span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
