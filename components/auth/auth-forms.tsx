"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { RegroupLogo } from "@/components/layout/regroup-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const router = useRouter();
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your church workspace."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-brand hover:underline">
            Create church
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/dashboard");
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@church.org" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-brand hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" placeholder="••••••••" required />
        </div>
        <Button type="submit" className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}

export function SignupForm() {
  const router = useRouter();
  return (
    <AuthShell
      title="Create your church"
      subtitle="Start building your digital home in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/builder");
        }}
      >
        <p className="mb-4 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted">
          Demo signup only — continuing opens the real website builder wizard.
        </p>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="Jordan Lee" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@church.org" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="••••••••" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="church">Church Name</Label>
          <Input id="church" placeholder="Grace Community Church" required />
        </div>
        <Button type="submit" className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
          Create church
        </Button>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordForm() {
  const router = useRouter();
  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your email and we'll send reset instructions."
      footer={
        <Link href="/login" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/login");
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@church.org" required />
        </div>
        <Button type="submit" className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
          Reset password
        </Button>
      </form>
    </AuthShell>
  );
}
