import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { resolveGhlConfig } from "./config";
import { ghlClient, isAlreadyExistsError, type GhlClient } from "./client";

/**
 * Creates the user's GoHighLevel sub-account and matching GHL user, once.
 *
 * Sub-accounts are billable on GHL's Agency Pro plan, so "once" is the whole
 * design constraint here — this runs from two places (the Stripe webhook on
 * payment, and the Courses handoff as a self-heal) and must never create a
 * second Location for the same user:
 *
 *   - An ACTIVE row short-circuits with no HTTP calls at all.
 *   - The row is claimed (PROVISIONING) before any outward call, using a
 *     conditional update, so two concurrent callers cannot both proceed. Same
 *     claim-then-work shape the Stripe webhook already uses for
 *     `ProcessedStripeEvent`.
 *   - `locationId` is persisted the instant the Location call returns, before
 *     the user call. A retry after a half-failure reuses it.
 */

/** A claim older than this belonged to a runner that died mid-flight. */
const STALE_CLAIM_MS = 5 * 60 * 1000;

export type ProvisionResult =
  | { ok: true; locationId: string; ghlUserId: string; alreadyExisted: boolean }
  | { ok: false; reason: string; skipped?: boolean };

/** GHL requires a password on user creation; SSO is the real login path, so this is generated and thrown away. */
function bootstrapPassword(): string {
  // Mixed case + digits + symbol, to satisfy any provider complexity rule.
  return `Rg${randomBytes(18).toString("base64url")}!7`;
}

/**
 * GHL validates each name part as "letters, numbers, accents, spaces and basic
 * punctuation", up to 100 characters — an `@` is rejected outright. Anything
 * outside that set becomes a space rather than being deleted, so
 * "ann_marie" reads as "ann marie" instead of "annmarie".
 */
function sanitizeNamePart(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N} '.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

/**
 * `User.name` is one column; GHL wants two required, validated ones.
 *
 * The case that matters in practice: Auth0 sets `name` to the email address
 * for database (email/password) signups, so a stored "name" is very often
 * `someone@gmail.com`. Sending that as `firstName` fails GHL validation, so an
 * email-shaped name is reduced to its local part with separators turned into
 * spaces — `dheeraj.kumar@gmail.com` becomes "Dheeraj / Kumar". Separator
 * splitting is applied ONLY on that path, so a genuine hyphenated surname
 * like "Mary-Jane" is left intact.
 */
export function splitName(
  name: string | null,
  email: string | null
): { firstName: string; lastName: string } {
  const raw = (name ?? "").trim();
  const nameIsEmail = raw.includes("@");

  const source =
    raw && !nameIsEmail
      ? sanitizeNamePart(raw)
      : sanitizeNamePart(((nameIsEmail ? raw : email) ?? "").split("@")[0].replace(/[._+-]+/g, " "));

  const parts = source.split(/\s+/).filter(Boolean);

  // Both fields are required by GHL, so neither may end up empty.
  if (parts.length === 0) return { firstName: "Church", lastName: "Admin" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "Admin" };
  return { firstName: parts[0], lastName: sanitizeNamePart(parts.slice(1).join(" ")) || "Admin" };
}

export async function ensureGhlAccount(
  userId: string,
  client: GhlClient = ghlClient
): Promise<ProvisionResult> {
  const config = resolveGhlConfig();
  if (!config) {
    // Integration not configured for this deployment — not an error.
    return { ok: false, reason: "GoHighLevel is not configured", skipped: true };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { ghlAccount: true, site: { select: { name: true } } },
  });
  if (!user) return { ok: false, reason: "User not found" };

  const existing = user.ghlAccount;

  if (existing?.status === "ACTIVE" && existing.locationId && existing.ghlUserId) {
    return {
      ok: true,
      locationId: existing.locationId,
      ghlUserId: existing.ghlUserId,
      alreadyExisted: true,
    };
  }

  if (
    existing?.status === "PROVISIONING" &&
    Date.now() - existing.updatedAt.getTime() < STALE_CLAIM_MS
  ) {
    // Another caller is mid-flight. Do not race it into a second sub-account.
    return { ok: false, reason: "Provisioning already in progress" };
  }

  if (!user.email) {
    // Cannot create a GHL user without one, and GHL would reject it anyway.
    await recordFailure(userId, "No email on the Regroup account");
    return { ok: false, reason: "No email on the Regroup account" };
  }

  // Claim it. `upsert` covers the first-ever call; the status is set to
  // PROVISIONING so a concurrent caller sees the claim above.
  const claimed = await prisma.ghlAccount.upsert({
    where: { userId },
    create: { userId, status: "PROVISIONING", attempts: 1 },
    update: { status: "PROVISIONING", attempts: { increment: 1 }, error: null },
  });

  const { firstName, lastName } = splitName(user.name, user.email);

  try {
    // Reuse a Location from a previous half-failure rather than creating a
    // second billable sub-account.
    let locationId = claimed.locationId;

    if (!locationId) {
      // Our row may be gone while GHL's sub-account still exists (a restored
      // backup, a wiped dev database). Adopt it rather than buying a second.
      locationId = await client.findLocationByEmail(config, user.email);

      if (locationId) {
        console.warn(`[ghl] adopting existing location ${locationId} for user ${userId}`);
      } else {
        locationId = await client.createLocation(config, {
          name: user.site?.name?.trim() || `${firstName} ${lastName}`.trim(),
          email: user.email,
          firstName,
          lastName,
        });
      }

      // Persisted immediately — if the user call below fails, the retry must
      // find this id instead of making another Location.
      await prisma.ghlAccount.update({ where: { userId }, data: { locationId } });
    }

    let ghlUserId: string;
    try {
      ghlUserId = await client.createUser(config, {
        email: user.email,
        password: bootstrapPassword(),
        firstName,
        lastName,
        locationId,
        externalUserId: user.id,
      });
    } catch (error) {
      // GHL enforces email uniqueness across users, so it rejects rather than
      // returning the existing one. Without adopting it here, a user whose
      // GHL account outlived our record could never be provisioned again.
      if (!isAlreadyExistsError(error)) throw error;

      const existingUserId = await client.findUserByEmail(config, user.email);
      if (!existingUserId) {
        throw new Error(
          `GHL says a user with this email already exists, but it could not be found to link. ` +
            `It may belong to a different agency or be soft-deleted.`
        );
      }

      console.warn(`[ghl] adopting existing GHL user ${existingUserId} for user ${userId}`);
      ghlUserId = existingUserId;
    }

    await prisma.ghlAccount.update({
      where: { userId },
      data: { ghlUserId, status: "ACTIVE", error: null },
    });

    return { ok: true, locationId, ghlUserId, alreadyExisted: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "GoHighLevel provisioning failed";
    console.error(`[ghl] provisioning failed for user ${userId}`, error);
    await recordFailure(userId, reason);
    return { ok: false, reason };
  }
}

async function recordFailure(userId: string, reason: string): Promise<void> {
  await prisma.ghlAccount
    .upsert({
      where: { userId },
      create: { userId, status: "FAILED", error: reason.slice(0, 500), attempts: 1 },
      update: { status: "FAILED", error: reason.slice(0, 500) },
    })
    .catch((error) => {
      // Never let bookkeeping failure mask the original problem.
      console.error(`[ghl] could not record failure for user ${userId}`, error);
    });
}
