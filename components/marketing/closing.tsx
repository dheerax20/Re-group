import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/motion-primitives";

/**
 * The last thing on the page: one dark band, one headline, one action.
 *
 * No countdown, no "limited spots", no invented number of churches. If the
 * product has not made its case by here, a fake deadline will not fix it.
 */
export function ClosingCta() {
  return (
    <section className="px-5 pb-16 sm:px-8 sm:pb-20">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-brand px-6 py-16 text-center sm:px-12 sm:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.16]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 25% 15%, rgba(255,255,255,0.65) 0%, transparent 45%), radial-gradient(circle at 75% 80%, rgba(255,255,255,0.4) 0%, transparent 45%)",
              }}
            />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-[32px] font-semibold leading-[1.06] tracking-[-0.025em] text-brand-foreground sm:text-[46px]">
                Build something your church
                <br className="hidden sm:block" /> is proud to share.
              </h2>
              <p className="mx-auto mt-4 max-w-[50ch] text-[16px] leading-relaxed text-brand-foreground/75 sm:text-[18px]">
                Your website, events, sermons and community — all connected in
                one place.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                <Button
                  asChild
                  className="h-11 w-full rounded-full bg-surface px-6 text-[15px] text-foreground shadow-none hover:bg-surface/90 sm:w-auto"
                  size="lg"
                >
                  <Link href="/signup">
                    Start building
                    <ArrowRight />
                  </Link>
                </Button>
                <Button
                  asChild
                  className="h-11 w-full rounded-full border-brand-foreground/25 bg-transparent px-6 text-[15px] text-brand-foreground shadow-none hover:bg-brand-foreground/10 hover:text-brand-foreground sm:w-auto"
                  size="lg"
                  variant="outline"
                >
                  <Link href="/login">Log in</Link>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
