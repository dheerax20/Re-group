"use client";

import { useSyncExternalStore } from "react";

/**
 * "Good morning" — resolved in the browser, on purpose.
 *
 * The server runs in UTC, so a server-rendered greeting tells a church in
 * California "good evening" over breakfast.
 *
 * `useSyncExternalStore` rather than an effect that calls `setState`: it gives
 * the server (and the first client render) the neutral snapshot and the
 * browser the real one, with no cascading render and nothing to hydrate
 * mismatched. The subscribe callback is a no-op because the value never
 * changes after mount — the point of the hook here is the server/client
 * snapshot split, not subscription.
 */
const subscribe = () => () => {};

function timeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ name }: { name?: string | null }) {
  const salutation = useSyncExternalStore(subscribe, timeOfDay, () => "Welcome back");
  const first = name?.trim().split(/\s+/)[0];

  return (
    <>
      {salutation}
      {first ? `, ${first}` : ""} 👋
    </>
  );
}
