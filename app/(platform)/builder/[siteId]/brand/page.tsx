import { notFound } from "next/navigation";
import { getSite } from "@/lib/site/actions";
import { BrandForm } from "@/components/onboarding/brand-form";

export default async function BuilderBrandPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold text-neutral-900">Brand</h1>
      <p className="mt-1 text-neutral-500">Colors, fonts, logo, and favicon.</p>
      <BrandForm
        siteId={siteId}
        defaultValues={site.brand}
        churchName={site.site.name}
        submitLabel="Save"
      />
    </div>
  );
}
