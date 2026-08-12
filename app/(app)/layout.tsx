import { Suspense } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { resolveActiveSite } from "@/lib/site/actions";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const site = await resolveActiveSite(null);

  return (
    <SidebarProvider>
      <Suspense fallback={null}>
        <AppSidebar siteId={site?.id} siteName={site?.name} />
      </Suspense>
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-background/90 px-4 backdrop-blur-md">
          <SidebarTrigger className="-ml-1 md:hidden" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {site?.name ?? "Regroup"}
            </p>
            <p className="truncate text-[11px] text-muted">Dashboard</p>
          </div>
        </header>
        <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
