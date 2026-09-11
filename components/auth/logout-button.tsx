"use client";

import { useClerk } from "@clerk/nextjs";

/**
 * There is no `/auth/logout` route — that was Auth0's session-clearing
 * endpoint (`auth0.middleware()` used to intercept it), and nothing replaced
 * it when this app moved to Clerk. Signing out with Clerk is a client-side
 * SDK call (`useClerk().signOut()`), not a link to a route, so every "Log
 * out" spot needs to render a button through this component instead of an
 * `<a href="/auth/logout">`.
 */
export function LogoutButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { signOut } = useClerk();

  return (
    <button
      type="button"
      className={className}
      onClick={() => signOut({ redirectUrl: "/login" })}
    >
      {children}
    </button>
  );
}
