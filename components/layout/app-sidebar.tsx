"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Mic2,
  Video,
  PanelsTopLeft,
  CreditCard,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  UserRound,
} from "lucide-react";
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

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/sermons", label: "Sermons", icon: Mic2 },
  { href: "/youtube", label: "YouTube", icon: Video },
];

function navButtonClass(active: boolean) {
  return cn(
    "h-9 rounded-lg px-2.5 text-[13px] font-medium text-sidebar-foreground/70 transition-colors",
    "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    "group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center",
    active &&
      "bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand data-[active=true]:bg-brand-soft data-[active=true]:text-brand"
  );
}

export function AppSidebar({
  siteId,
  siteName,
  userEmail,
  userName,
  userPicture,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  siteId?: string | null;
  siteName?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userPicture?: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  const activeSiteId = searchParams.get("siteId") ?? siteId;
  const withSite = (href: string) =>
    activeSiteId ? `${href}?siteId=${activeSiteId}` : href;

  const websiteHref = activeSiteId
    ? `/dashboard/builder?siteId=${activeSiteId}`
    : "/dashboard/builder";
  const churchInitial = (siteName?.trim()?.[0] ?? "C").toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border" {...props}>
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
              Church OS
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

        {siteName ? (
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
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  Active workspace
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </SidebarHeader>

      <SidebarContent className="px-2 pt-1">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-1 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {nav.map((item) => {
                const href = withSite(item.href);
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className={navButtonClass(active)}
                    >
                      <Link href={href}>
                        <item.icon
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Website"
              className={navButtonClass(pathname.startsWith("/dashboard/builder") || pathname.startsWith("/builder/"))}
            >
              <Link href={websiteHref}>
                <PanelsTopLeft className="size-4! opacity-80" />
                <span>Website</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/*
            Deliberately not in the `nav` array above: every href there is run
            through withSite(), which appends ?siteId=. Billing is account-level,
            not site-level, so that parameter would be meaningless on it.
          */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Billing"
              className={navButtonClass(pathname.startsWith("/settings/billing"))}
            >
              <Link href="/settings/billing">
                <CreditCard className="size-4! opacity-80" />
                <span>Billing</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div
          className={cn(
            "rounded-xl border border-sidebar-border/80 bg-white/70 p-2",
            collapsed && "border-0 bg-transparent p-0"
          )}
        >
          <Link
            href="/dashboard/profile"
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-sidebar-accent",
              collapsed && "justify-center px-0",
              pathname.startsWith("/dashboard/profile") && "bg-brand-soft"
            )}
          >
            {userPicture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userPicture} alt="" className="size-8 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                {(userName?.trim()?.[0] ?? userEmail?.trim()?.[0] ?? "U").toUpperCase()}
              </span>
            )}
            <span className={cn("min-w-0 flex-1", collapsed && "hidden")}>
              <span className="block truncate text-[13px] font-medium leading-tight">
                {userName ?? "Account"}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                {userEmail ?? "Profile"}
              </span>
            </span>
            <UserRound className={cn("size-3.5 text-muted-foreground", collapsed && "hidden")} />
          </Link>
          <a
            href="/auth/logout"
            className={cn(
              "mt-1 flex h-9 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-red-700 hover:bg-red-50",
              collapsed && "justify-center px-0"
            )}
          >
            <LogOut className="size-4" />
            <span className={cn(collapsed && "hidden")}>Log out</span>
          </a>
        </div>

        {collapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            className="mx-auto inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="size-4" />
          </button>
        ) : (
          <p className="px-2 pb-1 text-[10px] text-muted-foreground/70">
            Press ⌘B to collapse
          </p>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
