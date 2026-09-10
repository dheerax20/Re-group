import { z } from "zod";
import { prisma } from "@/lib/db";
import { toDatabaseError } from "@/lib/db/errors";
import { syncMemberToGhl } from "@/lib/ghl/contacts";

/**
 * The congregation directory.
 *
 * Every write here follows the same order: Postgres first, GoHighLevel second,
 * and a GHL failure never propagates. The directory is the church's record;
 * the contact in GHL is a mirror of it. Losing the mirror for a few minutes is
 * recoverable, losing the person the admin just typed in is not.
 *
 * Members are NOT part of the published site, so nothing here calls
 * `invalidateSite` — no public page reads this table.
 */

const memberStatusSchema = z.enum(["VISITOR", "REGULAR", "MEMBER"]);

/**
 * Email and phone are BOTH optional, deliberately: a first-time visitor who
 * only left a phone number on a connect card is exactly who this directory is
 * for. A member with neither still saves — the sync records `SKIPPED` and the
 * UI asks for one, rather than the form refusing the person.
 */
export const memberSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().max(100).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").max(320).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  status: memberStatusSchema.optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type MemberInput = z.infer<typeof memberSchema>;

export async function listMembers(siteId: string) {
  try {
    return await prisma.member.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function createMember(siteId: string, input: unknown) {
  try {
    const data = memberSchema.parse(input);

    const member = await prisma.member.create({
      data: {
        siteId,
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email || null,
        phone: data.phone || null,
        status: data.status ?? "VISITOR",
        notes: data.notes || null,
      },
    });

    // Awaited rather than fired and forgotten: the serverless runtime can end
    // the invocation the moment the response is returned, which would leave a
    // detached promise's sync silently unfinished. `syncMemberToGhl` records
    // its own failures and never throws, so awaiting it cannot fail the
    // create — it only costs the round trip.
    await syncMemberToGhl(member.id);

    return prisma.member.findUniqueOrThrow({ where: { id: member.id } });
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function updateMember(siteId: string, memberId: string, input: unknown) {
  try {
    const data = memberSchema.parse(input);

    // `updateMany` scoped by siteId, so a member id belonging to another
    // church updates nothing instead of being edited across the tenant line.
    const { count } = await prisma.member.updateMany({
      where: { id: memberId, siteId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email || null,
        phone: data.phone || null,
        status: data.status ?? "VISITOR",
        notes: data.notes || null,
      },
    });
    if (count === 0) throw new Error("That member no longer exists.");

    // The upsert is keyed on email/phone, so a change to either can strand the
    // old contact under its previous details — but re-running it is still the
    // closest thing to correct, and it is what keeps a status change (the
    // `regroup-member` tag) reaching GHL at all.
    await syncMemberToGhl(memberId);

    return prisma.member.findUniqueOrThrow({ where: { id: memberId } });
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function deleteMember(siteId: string, memberId: string) {
  try {
    // The GHL contact is deliberately LEFT in place. It may carry
    // conversation history, course enrolment, and campaign membership that
    // this app never created and cannot restore; removing someone from a
    // church's directory is not a request to erase them from its CRM.
    const { count } = await prisma.member.deleteMany({ where: { id: memberId, siteId } });
    if (count === 0) throw new Error("That member no longer exists.");
    return { success: true as const };
  } catch (error) {
    toDatabaseError(error);
  }
}

/** The retry behind the "Sync failed" badge. */
export async function resyncMember(siteId: string, memberId: string) {
  try {
    const member = await prisma.member.findFirst({
      where: { id: memberId, siteId },
      select: { id: true },
    });
    if (!member) throw new Error("That member no longer exists.");

    await syncMemberToGhl(memberId);
    return prisma.member.findUniqueOrThrow({ where: { id: memberId } });
  } catch (error) {
    toDatabaseError(error);
  }
}
