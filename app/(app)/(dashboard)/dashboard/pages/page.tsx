import { api } from "@/server/trpc/caller";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PencilRuler } from "lucide-react";
import { PagesLinker } from "@/components/builder/pages-linker";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { availableSitePages } from "@/lib/site/pages";

export const metadata = { title: "Pages & links — Regroup" };

export default async function DashboardPagesPage() {
  const active = await (await api()).site.mine();
  if (!active) redirect("/builder");

  const site = await (await api()).site.config({ siteId: active.id });
  if (!site) redirect("/builder");

  const catalog = availableSitePages(site.features);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Pages & links"
        description="Choose which pages appear in your navigation, and where buttons can point."
        actions={
          <Link href="/dashboard/builder">
            <Button className="bg-brand text-brand-foreground hover:bg-brand/90">
              <PencilRuler className="size-4" />
              Open editor
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <PagesLinker
            siteId={site.site.id}
            features={site.features}
            initialNavigation={site.navigation}
          />
        </Card>

        <Card variant="flat">
          <CardTitle className="text-sm">Available pages</CardTitle>
          <CardDescription className="text-xs">
            Turning on a feature in the editor unlocks its page. Features you leave
            off never appear on the public site.
          </CardDescription>
          <ul className="mt-4 space-y-2">
            {catalog.map((page) => (
              <li
                key={page.href}
                className="rounded-xl border border-border bg-surface px-3 py-2"
              >
                <p className="text-sm font-medium">{page.label}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted">{page.href}</p>
                <p className="mt-0.5 text-[11px] text-muted">{page.description}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
