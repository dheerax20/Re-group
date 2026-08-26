import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/routers/_app";

/**
 * The API's shapes, derived rather than restated.
 *
 * A component that re-declares a row type drifts the moment a column is added —
 * which is exactly how the attendee table ended up unaware of `checkedInAt`.
 * Reading the type off the router means a new field is a compile error at the
 * places that need to render it, not a silent omission.
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;

/** One row of `content.listRegistrations`. `Date` values survive via superjson. */
export type RegistrationRow = NonNullable<
  RouterOutputs["content"]["listRegistrations"]
>[number];

export type EventAttendance = RouterOutputs["content"]["eventAttendance"];
