import { syncCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export default async function ProfilePage() {
  const user = await syncCurrentUser();
  const initial = (user.name?.trim()?.[0] ?? user.email?.trim()?.[0] ?? "U").toUpperCase();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Profile"
        description="Your Auth0 account, linked to this workspace."
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
          <div className="flex justify-between gap-4 border-t border-border pt-3">
            <dt className="text-muted">Website</dt>
            <dd className="font-medium">{user.site?.name ?? "Not created yet"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-3">
            <dt className="text-muted">Status</dt>
            <dd className="font-medium">{user.site?.status ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
