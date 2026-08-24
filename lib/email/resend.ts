import { Resend } from "resend";

/**
 * Transactional email for RSVP confirmations.
 *
 * Optional integration, same posture as `resolveGhlConfig()` /
 * `isSlackConfigured()`: unset `RESEND_API_KEY` means the feature is off, not
 * broken. A registration must still succeed without an email provider —
 * losing the confirmation email is recoverable, losing the RSVP is not.
 */

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function client(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

export type RsvpEmailInput = {
  to: string;
  attendeeName: string;
  registrationId: string;
  registrationStatus: "CONFIRMED" | "WAITLISTED";
  event: {
    title: string;
    startAt: Date;
    location: string | null;
    address: string | null;
  };
  qrDataUrl: string;
  siteName: string;
  siteBrandColor: string;
}

function renderRsvpEmailHtml(input: RsvpEmailInput): string {
  const when = input.event.startAt.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const where = [input.event.location, input.event.address].filter(Boolean).join(" — ");
  const statusLine =
    input.registrationStatus === "WAITLISTED"
      ? "You're on the waitlist"
      : "You're registered!";

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #201e1d;">
      <h1 style="color: ${input.siteBrandColor}; font-size: 20px;">${input.siteName}</h1>
      <h2 style="font-size: 18px;">${statusLine}</h2>
      <p style="font-size: 16px; font-weight: 600;">${input.event.title}</p>
      <p style="color: #555;">${when}</p>
      ${where ? `<p style="color: #555;">${where}</p>` : ""}
      <p>Hi ${input.attendeeName}, this confirms your spot. Show the QR code below at check-in.</p>
      <img src="${input.qrDataUrl}" alt="Check-in QR code" width="200" height="200" style="display: block; margin: 24px 0;" />
      <p style="color: #888; font-size: 13px;">Registration ID: ${input.registrationId}</p>
    </div>
  `;
}

/** Best-effort send. Never throws — a failed email must not fail the RSVP. */
export async function sendRsvpConfirmationEmail(input: RsvpEmailInput): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] skipped RSVP confirmation to ${input.to}: RESEND_API_KEY not set`);
    return;
  }

  const fromAddress = process.env.RESEND_FROM_ADDRESS ?? "onboarding@resend.dev";

  try {
    await client().emails.send({
      from: `${input.siteName} <${fromAddress}>`,
      to: input.to,
      subject:
        input.registrationStatus === "WAITLISTED"
          ? `You're on the waitlist for ${input.event.title}`
          : `You're registered for ${input.event.title}`,
      html: renderRsvpEmailHtml(input),
    });
  } catch (error) {
    console.error(`[email] RSVP confirmation to ${input.to} failed`, error);
  }
}
