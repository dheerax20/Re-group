/**
 * TEMPORARY user/session shim. See README.md in this directory before
 * changing anything here.
 *
 * This exists so the billing module has a stable `userId: string` to hang
 * customers and entitlements off, without this MVP having to grow real auth
 * first. It is deliberately small and deliberately easy to delete.
 *
 * `getCurrentUser()` and `requireUser()` are the ONLY places that know how a
 * user is identified. Do not reimplement this logic anywhere else — the whole
 * point is that swapping in real auth touches exactly these two functions.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { TempUser } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/db";

const COOKIE_NAME = "regroup_temp_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Read once at module scope: an inline `NODE_ENV === "production"` check after
// the guard in createDevSession() would be narrowed to `false` by TypeScript.
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Dev-only auto-login: creates a user and session, then bounces to /upgrade. */
export const DEV_LOGIN_PATH = "/api/billing/dev-session";

/**
 * Where `requireUser()` sends a request with no valid session.
 *
 * The dev-session route returns a JSON 404 in production, so pointing there
 * unconditionally meant every unauthenticated production request landed on
 * `{"error":"Not found"}` instead of a login page.
 */
export const LOGIN_PATH = IS_PRODUCTION ? "/login" : DEV_LOGIN_PATH;

let warnedAboutMissingSecret = false;

function signingSecret(): string | null {
  return process.env.AUTH_TEMP_SECRET ?? null;
}

function sign(sessionId: string, secret: string): string {
  return createHmac("sha256", secret).update(sessionId).digest("hex");
}

function serialize(sessionId: string, secret: string): string {
  return `${sessionId}.${sign(sessionId, secret)}`;
}

/**
 * Returns the session id only if the signature verifies. The id is already an
 * unguessable cuid; the signature stops a tampered cookie from reaching the
 * database at all.
 */
function parseSigned(raw: string): string | null {
  /**
   * A missing secret degrades to "no valid session" rather than throwing.
   *
   * This function is on the path of every page rendered through
   * `requireUser()`. Throwing here meant a deploy without AUTH_TEMP_SECRET
   * returned a 500 on every request that carried a session cookie, instead of
   * simply treating the visitor as logged out.
   */
  const secret = signingSecret();
  if (!secret) {
    // Genuinely once per process. Without the flag this fires on every request
    // carrying a session cookie — permanent log noise on a misconfigured deploy.
    if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true;
      console.error(
        "[auth-temp] AUTH_TEMP_SECRET is not set — treating all sessions as invalid"
      );
    }
    return null;
  }

  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;

  const sessionId = raw.slice(0, separator);
  const provided = Buffer.from(raw.slice(separator + 1), "hex");
  const expected = Buffer.from(sign(sessionId, secret), "hex");

  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  return sessionId;
}

/**
 * The current user, or null. Safe to call from any Server Component.
 * Never throws on a missing/!invalid/expired session — it just returns null.
 */
export async function getCurrentUser(): Promise<TempUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const sessionId = parseSigned(raw);
  if (!sessionId) return null;

  const session = await withDbRetry(() =>
    prisma.tempSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    })
  );

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  return session.user;
}

/**
 * The current user, or a redirect to the dev login. Use this in any server
 * component or route handler that must have a user.
 */
export async function requireUser(): Promise<TempUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/**
 * Creates (or reuses) a TempUser, opens a session, and sets the cookie.
 *
 * Cookie writes are only permitted in Route Handlers and Server Functions, so
 * this cannot be called from a plain Server Component.
 */
export async function createDevSession(
  email = "dev@regroup.test",
  name = "Dev User"
): Promise<TempUser> {
  if (IS_PRODUCTION) {
    throw new Error("createDevSession is not available in production");
  }

  const user = await prisma.tempUser.upsert({
    where: { email },
    update: {},
    create: { email, name },
  });

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await prisma.tempSession.create({
    data: { userId: user.id, expiresAt },
  });

  const secret = signingSecret();
  if (!secret) throw new Error("Missing required env var: AUTH_TEMP_SECRET");

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, serialize(session.id, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PRODUCTION,
    path: "/",
    expires: expiresAt,
  });

  return user;
}

/** Drops the session row and clears the cookie. Route Handlers / Server Functions only. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (raw) {
    const sessionId = parseSigned(raw);
    if (sessionId) {
      await prisma.tempSession
        .delete({ where: { id: sessionId } })
        .catch(() => undefined); // already gone is fine
    }
  }

  cookieStore.delete(COOKIE_NAME);
}
