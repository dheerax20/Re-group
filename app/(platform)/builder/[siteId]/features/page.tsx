import { notFound } from "next/navigation";
import { getSite } from "@/lib/site/actions";
import { FeaturesForm } from "@/components/onboarding/features-form";

export default async function BuilderFeaturesPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold text-neutral-900">Features</h1>
      <p className="mt-1 text-neutral-500">Enable or disable functionality on your site.</p>
      <FeaturesForm siteId={siteId} defaultValues={site.features} submitLabel="Save" />
    </div>
  );
}
