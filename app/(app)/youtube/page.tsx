import Link from "next/link";
import { getSite, resolveActiveSite } from "@/lib/site/actions";
import { YoutubeManager } from "@/components/builder/youtube-manager";
import { Button } from "@/components/ui/button";

export default async function YoutubePage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId: preferred } = await searchParams;
  const active = await resolveActiveSite(preferred ?? null);

  if (!active) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">YouTube</h1>
        <p className="mt-2 text-sm text-muted">
          Create a church website first to connect a YouTube channel.
        </p>
        <Link href="/builder" className="mt-6 inline-block">
          <Button>Create website</Button>
        </Link>
      </div>
    );
  }

  const site = await getSite(active.id);
  return (
    <YoutubeManager
      siteId={active.id}
      channelUrl={site?.youtube?.channelUrl ?? ""}
    />
  );
}
