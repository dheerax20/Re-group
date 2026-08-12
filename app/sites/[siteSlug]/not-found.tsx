import Link from "next/link";

export default function SiteNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold text-neutral-900">Page not found</h1>
      <p className="mt-2 text-neutral-500">
        This page doesn&apos;t exist, or this site hasn&apos;t been published yet.
      </p>
      <Link href="/" className="mt-6 text-sm font-medium underline">
        Go back home
      </Link>
    </div>
  );
}
