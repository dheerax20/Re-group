import Link from "next/link";
import { headingScaleClass } from "@/components/website/blocks/tokens";
import { cn } from "@/lib/utils";

export default function SiteNotFound() {
  return (
    /* Church page, so church tokens and the church type scale — `text-foreground`
       and `text-muted` are Regroup's own chrome (see CLAUDE.md, "Design tokens"). */
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className={cn(headingScaleClass.h1, "text-site-foreground")}>Page not found</h1>
      <p className="mt-2 text-lg text-site-muted">
        This page doesn&apos;t exist, or this site hasn&apos;t been published yet.
      </p>
      <Link href="/" className="mt-6 text-base font-medium underline">
        Go back home
      </Link>
    </div>
  );
}
