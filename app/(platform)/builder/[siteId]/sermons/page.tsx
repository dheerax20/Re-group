import { notFound } from "next/navigation";
import { getSite } from "@/lib/site/actions";
import { listSermons } from "@/lib/site/content-actions";
import { SermonsManager } from "@/components/builder/sermons-manager";

export default async function BuilderSermonsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  const sermons = (await listSermons(siteId)) ?? [];

  return <SermonsManager siteId={siteId} sermons={sermons} />;
}
