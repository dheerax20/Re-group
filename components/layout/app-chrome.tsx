"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppChrome({
  siteName,
  children,
}: {
  siteName?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isBuilder = pathname.startsWith("/dashboard/builder");

  if (isBuilder) {
    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>;
  }

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-background/90 px-4 backdrop-blur-md">
        <SidebarTrigger className="-ml-1 md:hidden" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {siteName ?? "Regroup"}
          </p>
          <p className="truncate text-[11px] text-muted">
            {siteName ? "Your church" : "Church OS"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/dashboard/profile"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-background hover:text-foreground"
          >
            Profile
          </Link>
          <a
            href="/auth/logout"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-background"
          >
            Log out
          </a>
        </div>
      </header>
      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
    </>
  );
}
