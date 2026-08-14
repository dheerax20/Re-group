"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { RegroupLogo } from "@/components/layout/regroup-logo";
import { Button } from "@/components/ui/button";
import { fadeUp, staggerContainer } from "@/lib/motion/variants";

function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex min-h-screen flex-col bg-background regroup-noise">
      <div className="px-6 py-6">
        <RegroupLogo />
      </div>
      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <motion.div
          className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-[var(--shadow-soft)]"
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={fadeUp}>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
          </motion.div>
          <motion.div variants={fadeUp} className="mt-8">
            {children}
          </motion.div>
          <motion.div variants={fadeUp} className="mt-6 text-center text-sm text-muted">
            {footer}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export function LoginForm() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your church workspace with Auth0."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-brand hover:underline">
            Create church
          </Link>
        </>
      }
    >
      <div className="space-y-3">
        <Button asChild className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
          <a href="/auth/login?returnTo=/post-auth">Continue to login</a>
        </Button>
        <p className="text-center text-xs text-muted">
          Password reset is available on the Auth0 login screen.
        </p>
      </div>
    </AuthShell>
  );
}

export function SignupForm() {
  return (
    <AuthShell
      title="Create your church"
      subtitle="Create an account, then start the website builder."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Button asChild className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
        <a href="/auth/login?screen_hint=signup&returnTo=/post-auth">Continue to signup</a>
      </Button>
    </AuthShell>
  );
}

export function ForgotPasswordForm() {
  return (
    <AuthShell
      title="Reset password"
      subtitle="Use Auth0 Universal Login to reset your password."
      footer={
        <Link href="/login" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Button asChild className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
          <a href="/auth/login?returnTo=/post-auth">Open login</a>
      </Button>
    </AuthShell>
  );
}
