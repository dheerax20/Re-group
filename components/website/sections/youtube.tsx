import Link from "next/link";
import { SectionProps } from "@/lib/site/types";
import { Container, Eyebrow, cfgString } from "./_shared";
import { buttonVariants } from "@/components/ui/button";

export function YouTubeFeatured({ site, config }: SectionProps) {
  const channelUrl = site.youtube?.channelUrl;

  return (
    <section className="bg-site-background py-20">
      <Container>
        <Eyebrow>{cfgString(config, "eyebrow", "Watch")}</Eyebrow>
        <h2 className="mt-3 text-3xl font-bold text-site-foreground">
          {cfgString(config, "title", "Latest on YouTube")}
        </h2>
        <div className="mt-8 flex flex-col items-start gap-6 rounded-lg border border-site-muted/15 p-8 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.5v-7l6.3 3.5-6.3 3.5Z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-site-foreground">
              Watch our services and messages on YouTube.
            </p>
            {channelUrl ? (
              <Link
                href={channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "site", size: "sm", className: "mt-3" })}
              >
                Visit our Channel
              </Link>
            ) : (
              <p className="mt-1 text-sm text-site-muted">Channel link coming soon.</p>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
