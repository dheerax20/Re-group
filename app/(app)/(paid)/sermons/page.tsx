import { api } from "@/server/trpc/caller";
import Link from "next/link";
import { Mic2 } from "lucide-react";
import { SermonsManager } from "@/components/builder/sermons-manager";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sermons — Regroup" };

export default async function SermonsPage() {
  const site = await (await api()).site.mine();

  if (!site) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Sermons"
          description="Your message library, published to the sermons page."
        />
        <EmptyState
          icon={Mic2}
          title="Build your website first"
          description="Sermons need somewhere to live. Once your site exists, everything you add here publishes to it."
          action={
            <Link href="/builder">
              <Button>Build my website</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const sermons = (await (await api()).content.listSermons({ siteId: site.id })) ?? [];
  return <SermonsManager siteId={site.id} sermons={sermons} />;
}
