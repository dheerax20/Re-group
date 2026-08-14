import Link from "next/link";
import { resolveActiveSite, getSite } from "@/lib/site/actions";
import { getSiteContent } from "@/lib/site/get-site-content";
import { VisualEditor } from "@/components/builder/visual-editor";
import { Button } from "@/components/ui/button";

export default async function DashboardBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId: preferred } = await searchParams;
  const active = await resolveActiveSite(preferred ?? null);

  if (!active) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-[#f4efe8]">
        <div>
          <h1 className="text-2xl font-semibold">Create a website first</h1>
          <p className="mt-2 text-sm text-white/60">
            The visual editor opens after onboarding.
          </p>
          <Link href="/builder" className="mt-6 inline-block">
            <Button>Start builder</Button>
          </Link>
        </div>
      </div>
    );
  }

  const [site, content] = await Promise.all([
    getSite(active.id),
    getSiteContent(active.id),
  ]);

  if (!site) {
    return (
      <div className="p-8 text-center text-white">
        <p>Site not found.</p>
      </div>
    );
  }

  return <VisualEditor site={site} content={content} />;
}