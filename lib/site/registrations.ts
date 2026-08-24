import crypto from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { toDatabaseError } from "@/lib/db/errors";
import { sendRsvpConfirmationEmail } from "@/lib/email/resend";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "regroup.app";

export const rsvpSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  email: z.string().email("Enter a valid email"),
  phone: z.string().max(40).optional().or(z.literal("")),
  guestCount: z.coerce.number().int().min(0).max(20).optional(),
  dietaryNotes: z.string().max(500).optional().or(z.literal("")),
  prayerRequest: z.string().max(1000).optional().or(z.literal("")),
});

export type RsvpInput = z.infer<typeof rsvpSchema>;

export type RsvpResult =
  | { success: true; registration: { id: string; status: "CONFIRMED" | "WAITLISTED" }; qrDataUrl: string }
  | { success: false; reason: "not_found" | "closed" | "full" | "invalid" | "site_unpublished"; message: string };

/** The URL a QR code points at. Doesn't resolve to anything yet — check-in
 * scanning is a later phase — but shaping it as a real URL now means that
 * phase can add a page here without a new token format. */
function checkinUrl(slug: string, qrToken: string): string {
  const host = process.env.NODE_ENV === "development" ? `${slug}.localhost:3000` : `${slug}.${ROOT_DOMAIN}`;
  const scheme = process.env.NODE_ENV === "development" ? "http" : "https";
  return `${scheme}://${host}/checkin/${qrToken}`;
}

export async function createRegistration(eventId: string, input: unknown): Promise<RsvpResult> {
  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, reason: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { site: { select: { id: true, slug: true, name: true, status: true, brandConfig: true } } },
  });

  if (!event) return { success: false, reason: "not_found", message: "Event not found." };
  if (event.site.status !== "PUBLISHED") {
    return { success: false, reason: "site_unpublished", message: "This site isn't published yet." };
  }
  if (!event.rsvpEnabled || event.status !== "PUBLISHED") {
    return { success: false, reason: "closed", message: "Registration isn't open for this event." };
  }
  if (event.registrationDeadline && event.registrationDeadline.getTime() < Date.now()) {
    return { success: false, reason: "closed", message: "The registration deadline has passed." };
  }

  const guestCount = event.allowGuests ? (data.guestCount ?? 0) : 0;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      let status: "CONFIRMED" | "WAITLISTED" = "CONFIRMED";

      if (event.capacity != null) {
        const confirmed = await tx.registration.findMany({
          where: { eventId, status: "CONFIRMED" },
          select: { guestCount: true },
        });
        const taken = confirmed.reduce((sum, r) => sum + 1 + r.guestCount, 0);
        const wants = 1 + guestCount;

        if (taken + wants > event.capacity) {
          if (!event.allowWaitlist) {
            return { full: true as const };
          }
          status = "WAITLISTED";
        }
      }

      const qrToken = crypto.randomBytes(24).toString("base64url");
      const registration = await tx.registration.create({
        data: {
          eventId,
          siteId: event.siteId,
          status,
          attendeeName: data.name,
          attendeeEmail: data.email,
          attendeePhone: data.phone || null,
          guestCount,
          dietaryNotes: data.dietaryNotes || null,
          prayerRequest: data.prayerRequest || null,
          qrToken,
        },
      });

      return { full: false as const, registration };
    });

    if (outcome.full) {
      return { success: false, reason: "full", message: "This event is full and isn't accepting a waitlist." };
    }

    const { registration } = outcome;
    const qrDataUrl = await QRCode.toDataURL(checkinUrl(event.site.slug, registration.qrToken));

    const brand = event.site.brandConfig as { colors?: { primary?: string } } | null;
    await sendRsvpConfirmationEmail({
      to: registration.attendeeEmail,
      attendeeName: registration.attendeeName,
      registrationId: registration.id,
      registrationStatus: registration.status as "CONFIRMED" | "WAITLISTED",
      event: {
        title: event.title,
        startAt: event.startAt,
        location: event.location,
        address: event.address,
      },
      qrDataUrl,
      siteName: event.site.name,
      siteBrandColor: brand?.colors?.primary ?? "#201e1d",
    });

    return {
      success: true,
      registration: { id: registration.id, status: registration.status as "CONFIRMED" | "WAITLISTED" },
      qrDataUrl,
    };
  } catch (error) {
    toDatabaseError(error);
  }
}

export async function listRegistrations(siteId: string, eventId: string) {
  try {
    return await prisma.registration.findMany({
      where: { siteId, eventId },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    toDatabaseError(error);
  }
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function exportRegistrationsCsv(siteId: string, eventId: string): Promise<string> {
  const rows = (await listRegistrations(siteId, eventId)) ?? [];
  const header = ["Name", "Email", "Phone", "Guests", "Status", "Registered At"];
  const lines = rows.map((r) =>
    [
      csvCell(r.attendeeName),
      csvCell(r.attendeeEmail),
      csvCell(r.attendeePhone ?? ""),
      String(r.guestCount),
      r.status,
      r.createdAt.toISOString(),
    ].join(",")
  );
  return [header.join(","), ...lines].join("\n");
}
