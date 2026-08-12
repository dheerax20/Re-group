import Link from "next/link";
import { resolveActiveSite } from "@/lib/site/actions";
import { listSermons } from "@/lib/site/content-actions";
import { SermonsManager } from "@/components/builder/sermons-manager";
import { Button } from "@/components/ui/button";

export default async function SermonsPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId: preferred } = await searchParams;
  const site = await resolveActiveSite(preferred ?? null);

  if (!site) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sermons</h1>
        <p className="mt-2 text-sm text-muted">
          Create a church website first — sermons you add appear on the public site.
        </p>
        <Link href="/builder" className="mt-6 inline-block">
          <Button>Create website</Button>
        </Link>
      </div>
    );
  }

  const sermons = (await listSermons(site.id)) ?? [];
  return <SermonsManager siteId={site.id} sermons={sermons} />;
}
