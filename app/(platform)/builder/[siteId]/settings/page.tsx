import { notFound } from "next/navigation";
import { getSite } from "@/lib/site/actions";
import { ChurchForm } from "@/components/onboarding/church-form";
import { SocialForm } from "@/components/onboarding/social-form";

export default async function BuilderSettingsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
      <p className="mt-1 text-neutral-500">Church information and social links.</p>

      <section className="mt-8">
        <h2 className="font-semibold text-neutral-900">Church info</h2>
        <ChurchForm siteId={siteId} defaultValues={site} submitLabel="Save" />
      </section>

      <section className="mt-12">
        <h2 className="font-semibold text-neutral-900">Social media</h2>
        <SocialForm siteId={siteId} defaultValues={site.socialLinks} submitLabel="Save" />
      </section>
    </div>
  );
}
