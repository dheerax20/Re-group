"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Mic2,
  Video,
  CreditCard,
  ChevronsLeft,
  ChevronsRight,
  Globe,
  MessageSquare,
  LogOut,
  UserRound,
  Users,
  GraduationCap,
  Link2,
  PencilRuler,
  ExternalLink,
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

/**
 * Navigation is grouped by what a church is actually doing: shaping the
 * website, keeping content current, and everything about the church itself.
 * A flat list of eight items gave no clue that "Pages & links" belongs with the
 * editor while "Events" does not.
 *
 * There are no `?siteId=` parameters here. One account owns one website, so the
 * site comes from the session; threading an id through every link only created
 * a second, spoofable source of truth.
 */
type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  match?: "exact" | "prefix";
  soon?: boolean;
  /**
   * Opens in a new tab. Used for hand-offs to another product (Courses lives
   * in GoHighLevel), so the user keeps their Regroup work in the current tab.
   * The href stays internal — the route itself owns the redirect.
   */
  newTab?: boolean;
};

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Website",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, match: "exact" },
      { href: "/dashboard/builder", label: "Editor", icon: PencilRuler },
      { href: "/dashboard/pages", label: "Pages & links", icon: Link2 },
      { href: "/dashboard/domains", label: "Domains", icon: Globe },
      { href: "/dashboard/slack", label: "Slack", icon: MessageSquare },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/events", label: "Events", icon: Calendar },
      { href: "/sermons", label: "Sermons", icon: Mic2 },
      { href: "/youtube", label: "YouTube", icon: Video },
    ],
  },
  {
    label: "Congregation",
    items: [
      { href: "/members", label: "Members", icon: Users, soon: true },
      { href: "/courses", label: "Courses", icon: GraduationCap, newTab: true },
    ],
  },
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

function isActive(pathname: string, item: NavItem) {
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppSidebar({
  siteName,
  userEmail,
  userName,
  userPicture,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  siteName?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userPicture?: string | null;
}) {
  const pathname = usePathname();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  // The website editor owns the full viewport — hide the product chrome.
  if (pathname.startsWith("/dashboard/builder")) {
    return null;
  }

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
              "flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-brand text-[13px] font-bold tracking-tight text-brand-foreground",
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
                "flex items-center gap-2.5 rounded-xl border border-sidebar-border bg-surface px-2.5 py-2",
                collapsed && "justify-center border-0 bg-transparent p-0"
              )}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-[11px] font-semibold text-brand">
                {churchInitial}
              </span>
              <div className={cn("min-w-0 flex-1", collapsed && "hidden")}>
                <p className="truncate text-[13px] font-medium leading-tight">{siteName}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  Your church
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </SidebarHeader>

      <SidebarContent className="px-2 pt-1">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="p-0">
            <SidebarGroupLabel className="mb-1 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.soon ? `${item.label} — coming soon` : item.label}
                        className={navButtonClass(active)}
                      >
                        <Link
                          href={item.href}
                          {...(item.newTab
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                        >
                          <item.icon
                            className={cn(
                              "size-4! opacity-80",
                              active && "opacity-100 text-brand"
                            )}
                          />
                          <span className="flex-1">{item.label}</span>
                          {item.newTab ? (
                            <ExternalLink
                              className={cn(
                                "size-3 opacity-50",
                                collapsed && "hidden"
                              )}
                            />
                          ) : null}
                          {item.soon ? (
                            <span
                              className={cn(
                                "rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
                                collapsed && "hidden"
                              )}
                            >
                              Soon
                            </span>
                          ) : null}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-sidebar-border p-2">
        <SidebarMenu>
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
            "rounded-xl border border-sidebar-border bg-surface p-2",
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
              "mt-1 flex h-9 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-destructive hover:bg-destructive-soft",
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
