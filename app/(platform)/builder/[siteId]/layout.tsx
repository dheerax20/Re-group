import { notFound } from "next/navigation";
import { getSite } from "@/lib/site/actions";
import { BuilderSidebar } from "@/components/builder/builder-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default async function BuilderLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  return (
    <SidebarProvider>
      <BuilderSidebar
        siteId={siteId}
        siteName={site.site.name}
        siteSlug={site.site.slug}
        status={site.site.status}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <p className="truncate text-sm font-medium">{site.site.name}</p>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
