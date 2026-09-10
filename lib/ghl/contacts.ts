import type { Member, MemberSyncStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { GhlApiError, ghlClient, type GhlClient } from "./client";
import { resolveGhlConfig } from "./config";
import {
  forgetLocationToken,
  getLocationAccessToken,
  isGhlOAuthConfigured,
} from "./oauth";
import { ensureGhlAccount, sanitizeNamePart } from "./provision";

/**
 * Mirrors one directory member into their church's GoHighLevel sub-account as
 * a Contact.
 *
 * The whole design constraint is that this must never be able to fail a
 * member's creation. A church admin adding someone standing in front of them
 * cannot be shown an error because a third party is down, so every failure
 * path here RECORDS itself on the row and returns — nothing throws out of
 * `syncMemberToGhl`. The `FAILED` row plus the resync mutation is the retry.
 *
 * Idempotent by way of `POST /contacts/upsert`, which matches on email/phone
 * within the location. Syncing the same member twice updates one contact
 * rather than creating two.
 */

export type MemberSyncResult = {
  status: MemberSyncStatus;
  contactId?: string;
  reason?: string;
};

/** Lets a church segment app-created contacts inside GHL. */
function tagsFor(member: Pick<Member, "status">): string[] {
  return ["regroup", `regroup-${member.status.toLowerCase()}`];
}

async function record(
  memberId: string,
  result: MemberSyncResult
): Promise<MemberSyncResult> {
  await prisma.member
    .update({
      where: { id: memberId },
      data: {
        syncStatus: result.status,
        ghlContactId: result.contactId ?? undefined,
        syncError: result.reason?.slice(0, 500) ?? null,
        syncedAt: result.status === "SYNCED" ? new Date() : undefined,
      },
    })
    .catch((error) => {
      // Bookkeeping must never mask the original outcome.
      console.error(`[ghl] could not record sync state for member ${memberId}`, error);
    });
  return result;
}

/** A stale cached token reads as 401/403 — worth exactly one retry. */
function isAuthError(error: unknown): boolean {
  return (
    error instanceof GhlApiError && (error.status === 401 || error.status === 403)
  );
}

export async function syncMemberToGhl(
  memberId: string,
  client: GhlClient = ghlClient
): Promise<MemberSyncResult> {
  const config = resolveGhlConfig();
  if (!config) {
    // Integration off for this deployment. Not a failure — see `MemberSyncStatus`.
    return record(memberId, {
      status: "SKIPPED",
      reason: "GoHighLevel is not configured",
    });
  }

  /**
   * Contacts need an OAuth sub-account token, which the agency Private
   * Integration Token cannot produce. With no OAuth app configured the
   * contact half of the integration is simply off — SKIPPED, like any other
   * unconfigured integration. Configured-but-not-installed is a different
   * thing entirely and fails below, because it IS actionable: someone has to
   * finish the install, and then the retry button works.
   */
  if (!isGhlOAuthConfigured()) {
    return record(memberId, {
      status: "SKIPPED",
      reason: "GoHighLevel contact sync is not configured",
    });
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { site: { select: { userId: true } } },
  });
  if (!member) return { status: "FAILED", reason: "Member not found" };

  if (!member.email && !member.phone) {
    // GHL rejects a contact with no way to reach it, so there is nothing to
    // retry until the admin adds one.
    return record(memberId, {
      status: "SKIPPED",
      reason: "Add an email or phone number to sync this member",
    });
  }

  const ownerId = member.site.userId;
  if (!ownerId) {
    return record(memberId, {
      status: "FAILED",
      reason: "This site has no owner account to sync through",
    });
  }

  // Idempotent, and the self-heal for a church whose provisioning half-failed:
  // an ACTIVE row short-circuits with no HTTP calls at all.
  const account = await ensureGhlAccount(ownerId, client);
  if (!account.ok) {
    return record(memberId, {
      status: account.skipped ? "SKIPPED" : "FAILED",
      reason: account.reason,
    });
  }

  const { locationId } = account;
  const input = {
    locationId,
    // GHL applies the same name validation to contacts as to users.
    firstName: sanitizeNamePart(member.firstName) || "Friend",
    lastName: sanitizeNamePart(member.lastName ?? "") || undefined,
    email: member.email ?? undefined,
    phone: member.phone ?? undefined,
    tags: tagsFor(member),
  };

  try {
    let token = await getLocationAccessToken(locationId);
    let contactId: string;
    try {
      contactId = await client.upsertContact(config, token, input);
    } catch (error) {
      if (!isAuthError(error)) throw error;
      // The cached token may have been revoked or expired early. One retry on
      // a freshly minted token distinguishes that from a real permission
      // problem, which fails the same way the second time.
      await forgetLocationToken(locationId);
      token = await getLocationAccessToken(locationId);
      contactId = await client.upsertContact(config, token, input);
    }

    return record(memberId, { status: "SYNCED", contactId });
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "GoHighLevel contact sync failed";
    console.error(`[ghl] contact sync failed for member ${memberId}`, error);
    return record(memberId, { status: "FAILED", reason });
  }
}
