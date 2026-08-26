import { Suspense } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppChrome } from "@/components/layout/app-chrome";
import { BuilderSidebarGate } from "@/components/layout/builder-shell";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ToastProvider } from "@/components/ui/toast";
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
      {/*
        The toaster wraps the whole shell rather than each screen: a save that
        finishes after a navigation still has somewhere to report itself, and
        `useToast()` works from any component under here without a per-page
        provider.
      */}
      <ToastProvider>
        {/*
          The shell owns the viewport exactly: `h-svh overflow-hidden` here
          means the WINDOW never scrolls, so the browser's own scrollbar never
          appears beside the ScrollArea inside the panel. Without it the inset
          variant's `m-2` margins push the wrapper 16px past 100svh and the
          page grows a second, native scrollbar that scrolls nothing.
        */}
        <SidebarProvider className="h-svh overflow-hidden">
          <AppSidebar
            userEmail={user.email}
            userName={user.name}
            userPicture={user.picture}
          />
          {/*
            The inset panel is the app's scroll container, not the window: it
            clips, and the ScrollArea inside AppChrome does the scrolling, so
            the panel keeps its rounded corners the whole way down.

            No explicit height here on purpose — the wrapper is a flex row, so
            the panel stretches to the viewport minus its own inset margins by
            itself. Pinning `h-svh` is what made it overflow and grow a second,
            native scrollbar.
          */}
          <SidebarInset className="min-h-0 overflow-hidden bg-background md:border md:border-border">
            <Suspense fallback={children}>
              <BuilderSidebarGate>
                <AppChrome siteName={site?.name}>{children}</AppChrome>
              </BuilderSidebarGate>
            </Suspense>
          </SidebarInset>
        </SidebarProvider>
      </ToastProvider>
    </TrpcProvider>
  );
}
