/**
 * Who counts as one of us, rather than a customer.
 *
 * Regroup has no admin role in the database — every `User` row is a church.
 * The one thing that needs the distinction is the GoHighLevel agency install,
 * which grants access across every sub-account this platform has created, so
 * it is drawn from deployment config rather than from anything a signed-up
 * user could influence.
 *
 * Unset means NOBODY, deliberately. An empty allowlist that let everyone
 * through would turn a forgotten env var into an open door onto the agency.
 */
export function platformAdminEmails(): string[] {
  return (process.env.GHL_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = platformAdminEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}
