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

export async function syncCurrentUser(): Promise<AppUser> {
  const session = await requireSession();
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

export async function requireOwnedSite(siteId: string) {
  const user = await syncCurrentUser();
  if (!user.site || user.site.id !== siteId) {
    redirect("/post-auth");
  }
  return user;
}
