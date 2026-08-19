import { api } from "@/server/trpc/caller";
import Link from "next/link";
import { Video } from "lucide-react";
import { YoutubeManager } from "@/components/builder/youtube-manager";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "YouTube — Regroup" };

export default async function YoutubePage() {
  const active = await (await api()).site.mine();

  if (!active) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="YouTube"
          description="Show your latest services without uploading anything twice."
        />
        <EmptyState
          icon={Video}
          title="Build your website first"
          description="Once your site exists you can connect a channel and your videos appear on it automatically."
          action={
            <Link href="/builder">
              <Button>Build my website</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const site = await (await api()).site.config({ siteId: active.id });
  return (
    <YoutubeManager
      siteId={active.id}
      channelUrl={site?.youtube?.channelUrl ?? ""}
    />
  );
}
