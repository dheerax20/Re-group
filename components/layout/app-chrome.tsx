"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PencilRuler } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { crumbsFor, isImmersiveRoute } from "@/components/layout/nav-config";

/**
 * The application shell's top bar and content container.
 *
 * Two jobs, and only two. It says where you are (a breadcrumb derived from the
 * same nav config the sidebar renders, so the two can never disagree), and it
 * keeps the one action a website builder always wants — open the editor —
 * reachable from every screen.
 *
 * The container is LEFT ALIGNED, not centred. Content starts at a fixed
 * distance from the sidebar and grows rightwards into the available width, up
 * to 1400px. A centred column looks composed on a 13" laptop and absurd on a
 * 27" monitor, where the page drifts into the middle of the screen and leaves
 * the sidebar stranded — which is exactly what the old `mx-auto max-w-6xl` did.
 *
 * The header shares the same max-width and padding, so the breadcrumb, the page
 * title and the first card all sit on one left edge.
 */
export function AppChrome({
  siteName,
  children,
}: {
  siteName?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // The editor and check-in own the viewport — no top bar, no container.
  if (isImmersiveRoute(pathname)) {
    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>;
  }

  const crumbs = crumbsFor(pathname);

  return (
    // The panel is the scroll container (see `app/(app)/layout.tsx`): a fixed
    // header row, then one scrolling body. Nothing here scrolls sideways.
    <div className="flex h-full min-h-0 flex-col">
      <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background">
        <div className="flex w-full max-w-[1400px] items-center gap-2 px-5 sm:px-8 lg:px-10">
          <SidebarTrigger className="-ml-1.5 size-8 shrink-0 text-muted hover:text-foreground md:hidden" />

          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-nowrap">
              {crumbs.length === 0 ? (
                <BreadcrumbItem>
                  <BreadcrumbPage>{siteName ?? "Regroup"}</BreadcrumbPage>
                </BreadcrumbItem>
              ) : (
                crumbs.map((crumb, index) => {
                  const last = index === crumbs.length - 1;
                  return (
                    // A separator is its own <li>, so it is a SIBLING of the
                    // item rather than nested inside it — an <li> within an
                    // <li> is invalid, and screen readers announce the list
                    // length from the markup.
                    <Fragment key={`${crumb.label}-${index}`}>
                      {index > 0 ? (
                        <BreadcrumbSeparator className="flex items-center" />
                      ) : null}
                      <BreadcrumbItem className="min-w-0">
                        {last ? (
                          <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                        ) : crumb.href ? (
                          <BreadcrumbLink asChild>
                            <Link className="truncate" href={crumb.href}>
                              {crumb.label}
                            </Link>
                          </BreadcrumbLink>
                        ) : (
                          <span className="truncate">{crumb.label}</span>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  );
                })
              )}
            </BreadcrumbList>
          </Breadcrumb>

          {siteName ? (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/dashboard/builder">
                <PencilRuler />
                <span className="hidden sm:inline">Open editor</span>
                <span className="sm:hidden">Editor</span>
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="w-full max-w-[1400px] px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}
