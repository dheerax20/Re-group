import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold text-neutral-900">404 — Page not found</h1>
      <p className="mt-2 text-neutral-500">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="mt-6 text-sm font-medium underline">
        Go back home
      </Link>
    </div>
  );
}
