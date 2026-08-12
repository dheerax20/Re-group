import Link from "next/link";
import { SectionProps } from "@/lib/site/types";
import { Container, Eyebrow, cfgString } from "./_shared";
import { buttonVariants } from "@/components/ui/button";

export function PodcastFeatured({ site, config }: SectionProps) {
  const rssUrl = site.podcast?.rssUrl;

  return (
    <section className="bg-site-background py-20">
      <Container>
        <Eyebrow>{cfgString(config, "eyebrow", "Listen")}</Eyebrow>
        <h2 className="mt-3 text-3xl font-bold text-site-foreground">
          {cfgString(config, "title", "Our Podcast")}
        </h2>
        <div className="mt-8 flex flex-col items-start gap-6 rounded-lg border border-site-muted/15 p-8 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-site-accent text-white">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-site-foreground">
              Listen to sermons and conversations wherever you get podcasts.
            </p>
            {rssUrl ? (
              <Link
                href={rssUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "site", size: "sm", className: "mt-3" })}
              >
                Listen Now
              </Link>
            ) : (
              <p className="mt-1 text-sm text-site-muted">Podcast feed coming soon.</p>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
