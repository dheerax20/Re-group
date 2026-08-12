"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Mic2,
  Video,
  ExternalLink,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { builderHref, builderNavItems } from "@/lib/builder/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const icons = {
  LayoutDashboard,
  Calendar,
  Mic2,
  Video,
} as const;

function navButtonClass(active: boolean) {
  return cn(
    "h-9 rounded-lg px-2.5 text-[13px] font-medium text-sidebar-foreground/70 transition-colors",
    "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    "group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center",
    active &&
      "bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand data-[active=true]:bg-brand-soft data-[active=true]:text-brand"
  );
}

export function BuilderSidebar({
  siteId,
  siteName,
  siteSlug,
  status,
}: {
  siteId: string;
  siteName: string;
  siteSlug: string;
  status: string;
}) {
  const pathname = usePathname();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  const liveHref =
    process.env.NODE_ENV === "development"
      ? `http://${siteSlug}.localhost:3000`
      : `https://${siteSlug}.regroup.app`;

  const churchInitial = (siteName.trim()[0] ?? "C").toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="gap-0 p-0">
        <div
          className={cn(
            "flex h-14 items-center gap-2.5 px-3",
            collapsed && "justify-center px-0"
          )}
        >
          <button
            type="button"
            onClick={collapsed ? toggleSidebar : undefined}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-brand text-[13px] font-bold tracking-tight text-brand-foreground shadow-[0_1px_0_rgba(255,255,255,0.18)_inset]",
              !collapsed && "pointer-events-none"
            )}
            title={collapsed ? "Expand sidebar" : "Regroup"}
            aria-label={collapsed ? "Expand sidebar" : "Regroup"}
          >
            R
          </button>

          <div className={cn("min-w-0 flex-1", collapsed && "hidden")}>
            <p className="truncate text-[15px] font-semibold leading-none tracking-tight">
              Regroup
            </p>
            <p className="mt-1 truncate text-[11px] leading-none text-muted-foreground">
              Website
            </p>
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
              collapsed && "hidden"
            )}
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="size-4" />
          </button>
        </div>

        <div className={cn("px-3 pb-3", collapsed && "px-2")}>
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-xl border border-sidebar-border/80 bg-white/70 px-2.5 py-2 shadow-[0_1px_0_rgba(28,25,23,0.03)]",
              collapsed && "justify-center border-0 bg-transparent p-0 shadow-none"
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-[11px] font-semibold text-brand">
              {churchInitial}
            </span>
            <div className={cn("min-w-0 flex-1", collapsed && "hidden")}>
              <p className="truncate text-[13px] font-medium leading-tight">{siteName}</p>
              <p className="mt-0.5 truncate text-[11px] capitalize text-muted-foreground">
                {status.toLowerCase()}
              </p>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-1">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-1 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
            Content
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {builderNavItems.map((item) => {
                const href = builderHref(siteId, item.path);
                const active = pathname === href;
                const Icon = icons[item.icon];
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className={navButtonClass(active)}
                    >
                      <Link href={href}>
                        <Icon
                          className={cn(
                            "size-4! opacity-80",
                            active && "opacity-100 text-brand"
                          )}
                        />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-sidebar-border/80 p-2">
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="View website"
              className={navButtonClass(false)}
            >
              <a href={liveHref} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4! opacity-80" />
                <span>View site</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Dashboard"
              className={navButtonClass(false)}
            >
              <Link href={`/dashboard?siteId=${siteId}`}>
                <LayoutDashboard className="size-4! opacity-80" />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {collapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            className="mx-auto inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="size-4" />
          </button>
        ) : null}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
