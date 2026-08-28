"use client";

import { SignIn, SignUp } from "@clerk/nextjs";

/**
 * Just Clerk's own widget, centered. There used to be a custom `AuthShell`
 * wrapping this with its own title/subtitle/switch-form footer, but Clerk's
 * `<SignIn>`/`<SignUp>` already render all of that themselves (heading,
 * "don't have an account" footer link, etc — `ClerkProvider`'s `signInUrl`/
 * `signUpUrl` in `app/layout.tsx` wire that link to the right route). Wrapping
 * it a second time just duplicated every piece of that chrome.
 */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background regroup-noise px-6 py-16">
      {children}
    </div>
  );
}

export function LoginForm() {
  return (
    <AuthShell>
      <SignIn routing="hash" />
    </AuthShell>
  );
}

export function SignupForm() {
  return (
    <AuthShell>
      <SignUp routing="hash" />
    </AuthShell>
  );
}

export function ForgotPasswordForm() {
  // Clerk's <SignIn> already includes password reset inline ("Forgot
  // password?" on the password step) — there's no separate Clerk component
  // for it, so this route just is sign-in.
  return (
    <AuthShell>
      <SignIn routing="hash" />
    </AuthShell>
  );
}
