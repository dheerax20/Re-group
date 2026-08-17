import { Suspense } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppChrome } from "@/components/layout/app-chrome";
import { BuilderSidebarGate } from "@/components/layout/builder-shell";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { syncCurrentUser } from "@/lib/auth/session";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await syncCurrentUser();
  const site = user.site;

  return (
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
  );
}
