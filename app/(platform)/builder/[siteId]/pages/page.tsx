import { notFound } from "next/navigation";
import { getSite } from "@/lib/site/actions";
import { SectionsEditor } from "@/components/builder/sections-editor";

export default async function BuilderPagesPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold text-neutral-900">Sections</h1>
      <p className="mt-1 text-neutral-500">
        Enable, disable, reorder, and change the variant of each section on your homepage.
      </p>
      <div className="mt-6">
        <SectionsEditor siteId={siteId} initialSections={site.sections} />
      </div>
    </div>
  );
}
