"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The wizard's own header (`StepProgress`) has no account access at all —
 * unlike the dashboard sidebar's `AccountMenu`, someone mid-onboarding has no
 * way to reach their profile or sign out without leaving the flow via the
 * browser. This is a lighter version of the same menu, sized for a header bar
 * rather than a sidebar footer.
 */
export function WizardAccountMenu({
  userEmail,
  userName,
  userPicture,
}: {
  userEmail?: string | null;
  userName?: string | null;
  userPicture?: string | null;
}) {
  const { signOut } = useClerk();
  const initial = (userName?.trim()?.[0] ?? userEmail?.trim()?.[0] ?? "U").toUpperCase();

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
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-left transition-colors hover:bg-surface-muted">
        {avatar}
        <span className="hidden max-w-32 truncate text-[13px] font-medium sm:inline">
          {userName ?? userEmail ?? "Account"}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
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
        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile">
            <UserRound />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => signOut({ redirectUrl: "/login" })}
        >
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
