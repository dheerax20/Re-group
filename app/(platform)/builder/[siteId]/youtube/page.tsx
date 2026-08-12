import { notFound } from "next/navigation";
import { getSite } from "@/lib/site/actions";
import { YoutubeManager } from "@/components/builder/youtube-manager";

export default async function BuilderYoutubePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  return (
    <YoutubeManager
      siteId={siteId}
      channelUrl={site.youtube?.channelUrl ?? ""}
    />
  );
}
