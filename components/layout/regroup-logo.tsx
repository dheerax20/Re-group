import Link from "next/link";
import { cn } from "@/lib/utils";

export function RegroupLogo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-sm font-bold text-brand-foreground">
        R
      </span>
      <span className="text-base font-semibold tracking-tight text-foreground">Regroup</span>
    </Link>
  );
}
