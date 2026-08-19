import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { hasBasePlan, getActiveSubscription } from "@/lib/billing/entitlements";
import { RateLimitError } from "@/lib/rate-limit";
import { isDatabaseUnavailableError } from "@/lib/db/errors";
import type { TrpcContext } from "./context";

/**
 * The single API surface.
 *
 * `superjson` is the transformer because events, sermons, and job rows all
 * carry real `Date` values, and JSON would hand the client strings that then
 * need re-parsing at every call site.
 */
const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Field-level messages for forms, without the client importing zod.
        zod:
          error.cause instanceof ZodError
            ? error.cause.flatten().fieldErrors
            : null,
      },
    };
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Translates the exception vocabulary the lib layer already throws into tRPC
 * codes, so procedures can call existing helpers without each one remembering
 * to catch.
 *
 * `RateLimitError` carries copy the church is meant to read — including the
 * budget reset date — so the message is passed through verbatim.
 */
const errorTranslation = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error instanceof TRPCError) throw error;

    if (error instanceof RateLimitError) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: error.message,
        cause: error,
      });
    }

    if (isDatabaseUnavailableError(error)) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "We could not reach the database. Try again in a moment.",
        cause: error,
      });
    }

    throw error;
  }
});

export const publicProcedure = t.procedure.use(errorTranslation);

/** A signed-in user, or `UNAUTHORIZED`. */
export const authedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sign in to continue.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/**
 * Read access to the caller's own site.
 *
 * Reads the `siteId` off the parsed input rather than context, which is what
 * makes the check impossible to skip: a procedure that takes a `siteId` and
 * forgets the guard does not typecheck against this builder at all.
 */
export const ownedSiteProcedure = authedProcedure.use(({ ctx, input, next }) => {
  const siteId = readSiteId(input);
  if (!ctx.user.site || ctx.user.site.id !== siteId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "That site is not yours.",
    });
  }
  return next({ ctx: { ...ctx, site: ctx.user.site, siteId } });
});

/**
 * Ownership AND a live plan. The gate for every mutation.
 *
 * Ownership alone is not enough, for the same reason the server-action version
 * said so: these are POST requests to one route handler, so they never render
 * through `(paid)/layout.tsx` and the layout paywall does not cover them.
 * Without this a canceled subscriber keeps full write, publish, and AI access.
 *
 * The `PAYMENT_REQUIRED` code is deliberate — the client uses it to route to
 * billing vs. upgrade, the same distinction `requireActivePlan` makes with its
 * two redirect targets (a `past_due` subscription can only be fixed on the
 * billing screen, and /upgrade would bounce it straight back).
 */
export const paidSiteProcedure = ownedSiteProcedure.use(async ({ ctx, next }) => {
  if (await hasBasePlan(ctx.user.id)) return next({ ctx });

  const subscription = await getActiveSubscription(ctx.user.id);
  throw new TRPCError({
    code: "PAYMENT_REQUIRED",
    message: subscription
      ? "Your subscription needs attention before you can make changes."
      : "This needs an active plan.",
    cause: { redirectTo: subscription ? "/settings/billing" : "/upgrade" },
  });
});

function readSiteId(input: unknown): string {
  if (
    input &&
    typeof input === "object" &&
    "siteId" in input &&
    typeof (input as { siteId: unknown }).siteId === "string"
  ) {
    return (input as { siteId: string }).siteId;
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "This request must name a site.",
  });
}
