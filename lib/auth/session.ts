import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/db";

export type AppUser = {
  id: string;
  auth0Id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  site: { id: string; name: string; slug: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" } | null;
};

export async function requireSession() {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login?returnTo=/post-auth");
  }
  return session;
}

type Auth0Session = NonNullable<Awaited<ReturnType<typeof auth0.getSession>>>;

/** Mirrors the Auth0 profile into our own users table. */
async function upsertFromSession(session: Auth0Session): Promise<AppUser> {
  const auth0Id = session.user.sub;
  const picture =
    typeof session.user.picture === "string" ? session.user.picture : null;

  const user = await prisma.user.upsert({
    where: { auth0Id },
    create: {
      auth0Id,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
      picture,
    },
    update: {
      email: session.user.email ?? null,
      name: session.user.name ?? null,
      picture,
    },
    include: {
      site: { select: { id: true, name: true, slug: true, status: true } },
    },
  });

  return user;
}

/**
 * The current user, or null. Use this in Route Handlers: `syncCurrentUser()`
 * redirects when there is no session, and a redirect is useless to `fetch()` —
 * an API caller needs a 401 it can act on.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await auth0.getSession();
  if (!session) return null;
  return upsertFromSession(session);
}

/** The current user, or a redirect to login. For Server Components. */
export async function syncCurrentUser(): Promise<AppUser> {
  return upsertFromSession(await requireSession());
}

export async function requireOwnedSite(siteId: string) {
  const user = await syncCurrentUser();
  if (!user.site || user.site.id !== siteId) {
    redirect("/post-auth");
  }
  return user;
}
