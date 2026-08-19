import { Suspense } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppChrome } from "@/components/layout/app-chrome";
import { BuilderSidebarGate } from "@/components/layout/builder-shell";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { syncCurrentUser } from "@/lib/auth/session";
import { TrpcProvider } from "@/lib/trpc/client";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await syncCurrentUser();
  const site = user.site;

  /**
   * The tRPC/React Query provider wraps the authenticated shell only.
   * Marketing pages and `/sites/*` render entirely on the server and would
   * gain nothing but a client bundle from being inside it.
   */
  return (
    <TrpcProvider>
    <SidebarProvider>
      <AppSidebar
        siteName={site?.name}
        userEmail={user.email}
        userName={user.name}
        userPicture={user.picture}
      />
      <SidebarInset className="min-h-svh bg-background">
        <Suspense fallback={children}>
          <BuilderSidebarGate>
            <AppChrome siteName={site?.name}>{children}</AppChrome>
          </BuilderSidebarGate>
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
    </TrpcProvider>
  );
}
