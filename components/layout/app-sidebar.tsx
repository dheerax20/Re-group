"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
  ChevronDown,
  ChevronsUpDown,
  CreditCard,
  ExternalLink,
  LogOut,
  UserRound,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  isImmersiveRoute,
  NAV_GROUPS,
  type NavItem,
  type NavLeaf,
} from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";

/**
 * The application's one navigation surface.
 *
 * The structure comes from `nav-config.ts` and never changes between pages —
 * that constancy is most of what makes a set of screens feel like a product.
 * Items that own more than one screen nest: the parent is a Collapsible whose
 * children render in a `SidebarMenuSub`, so a second level exists without
 * flattening it into the first. Icon-collapsed mode hides the sub list (the
 * primitive does that) and the parent keeps its tooltip.
 *
 * Visually the sidebar is quiet on purpose: 13px medium labels, muted icons,
 * and exactly one highlighted row. The active state is a soft brand tint, not
 * a filled block — a filled block reads as a selected *object*, and the point
 * is to say where you are, not to shout.
 */

function navButtonClass(active: boolean) {
  return cn(
    "h-9 rounded-lg px-2 text-[13px] font-medium text-sidebar-foreground/75 transition-colors",
    "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    "group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center",
    active &&
      "bg-brand-soft text-brand-strong hover:bg-brand-soft hover:text-brand-strong data-[active=true]:bg-brand-soft data-[active=true]:text-brand-strong"
  );
}

function isActive(pathname: string, item: NavLeaf) {
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** A parent highlights when any of its children match, not just its own href. */
function isBranchActive(pathname: string, item: NavItem) {
  if (item.items?.length) {
    return item.items.some((child) => isActive(pathname, child));
  }
  return isActive(pathname, item);
}

function linkProps(item: NavLeaf) {
  return item.newTab
    ? ({ target: "_blank", rel: "noopener noreferrer" } as const)
    : {};
}

function NavLabel({ item }: { item: NavLeaf }) {
  return (
    <>
      <span className="flex-1 truncate">{item.label}</span>
      {item.newTab ? (
        <ExternalLink className="size-3 shrink-0 opacity-50 group-data-[collapsible=icon]:hidden" />
      ) : null}
    </>
  );
}

function NavEntry({ item, pathname }: { item: NavItem; pathname: string }) {
  const branchActive = isBranchActive(pathname, item);
  const [open, setOpen] = React.useState(branchActive);
  const [wasBranchActive, setWasBranchActive] = React.useState(branchActive);

  // Navigating into a child from elsewhere reveals the branch; closing it by
  // hand while already inside keeps it closed. Adjusted during render rather
  // than in an effect so the sub-menu never paints in the wrong state.
  if (branchActive !== wasBranchActive) {
    setWasBranchActive(branchActive);
    if (branchActive) setOpen(true);
  }

  if (!item.items?.length) {
    const active = isActive(pathname, item);
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          className={cn(navButtonClass(active), item.soon && "pr-12")}
          isActive={active}
          tooltip={item.soon ? `${item.label} — coming soon` : item.label}
        >
          <Link href={item.href} {...linkProps(item)}>
            <item.icon
              className={cn("size-4! opacity-70", active && "text-brand opacity-100")}
            />
            <NavLabel item={item} />
          </Link>
        </SidebarMenuButton>
        {item.soon ? (
          <SidebarMenuBadge className="top-1.5 rounded-full bg-surface-muted px-1.5 text-[10px] font-medium text-muted">
            Soon
          </SidebarMenuBadge>
        ) : null}
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild onOpenChange={setOpen} open={open}>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          className={navButtonClass(branchActive)}
          isActive={branchActive}
          tooltip={item.label}
        >
          <Link href={item.href}>
            <item.icon
              className={cn(
                "size-4! opacity-70",
                branchActive && "text-brand opacity-100"
              )}
            />
            <NavLabel item={item} />
          </Link>
        </SidebarMenuButton>
        <CollapsibleTrigger asChild>
          <SidebarMenuAction
            aria-label={`${open ? "Collapse" : "Expand"} ${item.label}`}
            className="top-2 text-muted"
          >
            <ChevronDown className="size-3.5 transition-transform duration-200 group-data-[state=closed]/collapsible:-rotate-90" />
          </SidebarMenuAction>
        </CollapsibleTrigger>
        <CollapsibleContent className="collapsible-panel">
          <SidebarMenuSub className="gap-0.5 border-sidebar-border">
            {item.items.map((child) => {
              const childActive = isActive(pathname, child);
              return (
                <SidebarMenuSubItem key={child.href}>
                  <SidebarMenuSubButton
                    asChild
                    className={cn(
                      "h-7 rounded-lg text-[13px] text-sidebar-foreground/70",
                      childActive &&
                        "bg-brand-soft font-medium text-brand-strong data-[active=true]:bg-brand-soft data-[active=true]:text-brand-strong"
                    )}
                    isActive={childActive}
                  >
                    <Link href={child.href} {...linkProps(child)}>
                      <NavLabel item={child} />
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

/**
 * Profile, billing and log out used to be three stacked rows competing with the
 * nav for attention. One trigger with a menu keeps the footer to a single line
 * and gives the icon-collapsed rail something it can actually show.
 */
function AccountMenu({
  collapsed,
  pathname,
  userEmail,
  userName,
  userPicture,
}: {
  collapsed: boolean;
  pathname: string;
  userEmail?: string | null;
  userName?: string | null;
  userPicture?: string | null;
}) {
  const initial = (
    userName?.trim()?.[0] ??
    userEmail?.trim()?.[0] ??
    "U"
  ).toUpperCase();

  const avatar = userPicture ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className="size-7 shrink-0 rounded-full object-cover"
      src={userPicture}
    />
  ) : (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-muted">
      {initial}
    </span>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className={cn(
                "h-11 rounded-lg px-1.5 data-[state=open]:bg-sidebar-accent",
                "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!",
                pathname.startsWith("/dashboard/profile") && "bg-sidebar-accent"
              )}
              size="lg"
              tooltip={userName ?? userEmail ?? "Account"}
            >
              {avatar}
              <span className={cn("min-w-0 flex-1 text-left", collapsed && "hidden")}>
                <span className="block truncate text-[13px] font-medium leading-tight">
                  {userName ?? "Account"}
                </span>
                <span className="mt-0.5 block truncate text-[11px] leading-none text-muted">
                  {userEmail ?? "Profile"}
                </span>
              </span>
              <ChevronsUpDown
                className={cn("size-3.5 shrink-0 text-muted", collapsed && "hidden")}
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-56"
            side={collapsed ? "right" : "top"}
            sideOffset={8}
          >
            <DropdownMenuLabel className="flex items-center gap-2 px-2 py-1.5">
              {avatar}
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-foreground">
                  {userName ?? "Account"}
                </span>
                <span className="block truncate text-[11px] text-muted">
                  {userEmail ?? "Profile"}
                </span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile">
                  <UserRound />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/billing">
                  <CreditCard />
                  Billing &amp; plan
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild variant="destructive">
              <a href="/auth/logout">
                <LogOut />
                Log out
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebar({
  userEmail,
  userName,
  userPicture,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  userEmail?: string | null;
  userName?: string | null;
  userPicture?: string | null;
}) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  // The website editor and check-in own the full viewport — hide the chrome.
  if (isImmersiveRoute(pathname)) {
    return null;
  }

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="gap-0 p-0">
        {/*
          The collapse control is visible in BOTH states — that is the whole
          point of it. Collapsed, the wordmark gives way to the trigger so the
          rail always shows one obvious way back out; expanded, the trigger
          sits at the right of the wordmark. Relying on `SidebarRail` alone (a
          4px invisible strip) meant a collapsed sidebar had no discoverable
          way to reopen at all.
        */}
        <div
          className={cn(
            "flex h-14 items-center gap-2.5 px-3",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <SidebarTrigger
              className="size-8 text-muted hover:bg-sidebar-accent hover:text-foreground"
              title="Expand sidebar"
            />
          ) : (
            <>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand text-[12px] font-bold tracking-tight text-brand-foreground">
                R
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold leading-none tracking-[-0.01em]">
                  Regroup
                </p>
                <p className="mt-1 truncate text-[11px] leading-none text-muted">
                  Church OS
                </p>
              </div>

              <SidebarTrigger
                className="size-7 shrink-0 text-muted hover:bg-sidebar-accent hover:text-foreground"
                title="Collapse sidebar"
              />
            </>
          )}
        </div>

      </SidebarHeader>

      <SidebarContent className="gap-4 px-2 pt-1">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup className="p-0" key={group.label}>
            <SidebarGroupLabel className="h-6 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted/80">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <NavEntry item={item} key={item.label} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-sidebar-border p-2">
        <AccountMenu
          collapsed={collapsed}
          pathname={pathname}
          userEmail={userEmail}
          userName={userName}
          userPicture={userPicture}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
