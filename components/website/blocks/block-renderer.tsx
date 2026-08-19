import Link from "next/link";
import Image from "next/image";
import type { BlockNode, BlockStyle } from "@/lib/site/blocks/types";
import type { SiteConfig, SiteContent, EventSummary, SermonSummary } from "@/lib/site/types";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, TraitEyebrow, StatPill } from "./shared";
import { safeLinkTarget } from "@/lib/validation/url";
import { cn } from "@/lib/utils";
import { BrandLogoBlockView, NavLinksBlockView } from "./nav-links-block";
import {
  paddingClass,
  gapClass,
  stackGapClass,
  spacerHeightClass,
  alignItemsClass,
  widthClass,
  backgroundClass,
  textToneClass,
  headingScaleClass,
  rowColumnsClass,
  imageTreatmentClass,
  imageAspectClass,
  buttonEmphasisVariant,
} from "./tokens";

/**
 * One recursive renderer for the whole block vocabulary
 * (`lib/site/blocks/types.ts`). Replaces picking a component out of a fixed
 * section library — every AI-composed (or legacy-adapted, see
 * `lib/site/blocks/schema.ts`) tree renders through this single switch,
 * which only ever resolves a block's `type` against this fixed set of cases
 * — never a dynamic import from untrusted data, same security posture the
 * old `section-registry.ts` documented.
 */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function youtubeEmbedSrc(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (parsed.pathname.startsWith("/embed/")) return url;
    }
  } catch {
    return null;
  }
  return null;
}

type Ctx = { site: SiteConfig; content: SiteContent };

export function BlockTree({ nodes, site, content }: { nodes: BlockNode[] } & Ctx) {
  return (
    <>
      {nodes.map((node) => (
        <RenderBlock key={node.id} node={node} site={site} content={content} />
      ))}
    </>
  );
}

function containerStyle(style: BlockStyle | undefined, extra?: string) {
  return cn(
    style?.padding ? paddingClass[style.padding] : "",
    style?.background ? backgroundClass[style.background] : "",
    style?.textTone ? textToneClass[style.textTone] : "",
    extra
  );
}

function RenderBlock({ node, site, content }: { node: BlockNode } & Ctx) {
  switch (node.type) {
    case "section": {
      const width = node.style?.width ?? "wide";
      return (
        <section className={containerStyle(node.style)}>
          <div className={cn(widthClass[width], alignItemsClass[node.style?.align ?? "left"], "flex flex-col", node.style?.gap ? gapClass[node.style.gap] : "gap-6")}>
            <BlockTree nodes={node.children} site={site} content={content} />
          </div>
        </section>
      );
    }

    case "stack":
      return (
        <div className={cn("flex flex-col", node.style?.gap ? stackGapClass[node.style.gap] : "space-y-4", alignItemsClass[node.style?.align ?? "left"])}>
          <BlockTree nodes={node.children} site={site} content={content} />
        </div>
      );

    case "row":
      return (
        <div className={cn("grid items-center", rowColumnsClass[node.columns ?? 2], node.style?.gap ? gapClass[node.style.gap] : "gap-8")}>
          <BlockTree nodes={node.children} site={site} content={content} />
        </div>
      );

    case "spacer":
      return <div className={spacerHeightClass[node.size ?? "md"]} />;

    case "heading": {
      const scale = node.scale ?? "h2";
      // The tag follows the scale, not just the styling: a `display`/`h1`
      // heading must emit a real <h1> or an AI-composed page ships with no
      // top-level heading at all (the old hero components each rendered one).
      const Tag = scale === "display" || scale === "h1" ? "h1" : scale === "h2" ? "h2" : "h3";
      return (
        <Tag className={cn(headingScaleClass[scale], node.style?.textTone ? textToneClass[node.style.textTone] : "")}>
          {node.text}
        </Tag>
      );
    }

    case "text":
      return <p className={cn("text-lg leading-relaxed", node.style?.textTone ? textToneClass[node.style.textTone] : "text-site-muted")}>{node.text}</p>;

    case "eyebrow":
      return (
        <TraitEyebrow accent={node.accent ?? "none"} tone={node.style?.textTone === "inverted" ? "light" : "default"}>
          {node.text}
        </TraitEyebrow>
      );

    case "image": {
      const treatment = imageTreatmentClass[node.treatment ?? "rounded"];
      const aspect = imageAspectClass[node.aspect ?? "wide"];
      const embed = node.videoSrc ? youtubeEmbedSrc(node.videoSrc) : null;
      return (
        <div className={cn("relative overflow-hidden", treatment, aspect, "w-full")}>
          {embed ? (
            <iframe
              src={embed}
              title={node.alt || "Video"}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : node.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={node.src} alt={node.alt ?? ""} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(145deg, color-mix(in oklab, var(--color-primary) 88%, black), color-mix(in oklab, var(--color-secondary) 60%, var(--color-accent)))",
              }}
            />
          )}
        </div>
      );
    }

    case "button":
      return (
        <Link href={node.href} className={buttonVariants({ variant: buttonEmphasisVariant[node.emphasis ?? "primary"], size: "lg" })}>
          {node.label}
        </Link>
      );

    case "stats":
      return (
        <div className={cn("grid grid-cols-2 gap-3", node.items.length > 2 ? "sm:grid-cols-3" : "")}>
          {node.items.map((stat) => (
            <StatPill key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      );

    case "brandLogo":
      return <BrandLogoBlockView site={site} />;

    case "navLinks":
      return <NavLinksBlockView site={site} tone={node.style?.textTone === "inverted" ? "inverted" : "default"} />;

    case "sermonCollection":
      return <SermonCollectionView layout={node.layout ?? "grid"} limit={node.limit} sermons={content.sermons} />;

    case "eventCollection":
      return <EventCollectionView layout={node.layout ?? "grid"} limit={node.limit} events={content.events} />;

    case "ministryCollection":
      return <MinistryCollectionView items={node.items ?? []} />;

    case "contactInfo":
      return <ContactInfoView site={site} />;

    case "givingCta":
      return <GivingCtaView site={site} />;

    case "socialLinks":
      return <SocialLinksView site={site} />;

    case "copyrightLine":
      return (
        <p className="text-sm text-site-muted">
          &copy; {new Date().getFullYear()} {site.site.name}. All rights reserved.
        </p>
      );

    default:
      return null;
  }
}

function SermonCollectionView({
  layout,
  limit,
  sermons,
}: {
  layout: "grid" | "list" | "featured";
  limit?: number;
  sermons: SermonSummary[];
}) {
  if (sermons.length === 0) return <EmptyState message="No sermons have been added yet." />;

  if (layout === "list") {
    return (
      <ul className="w-full divide-y divide-site-muted/15">
        {sermons.slice(0, limit ?? 8).map((sermon) => (
          <li key={sermon.id} className="py-4">
            <Link
              href={`/sermons/${sermon.slug}`}
              className="flex flex-col gap-1 hover:text-site-accent sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="min-w-0 truncate font-medium">{sermon.title}</span>
              <span className="shrink-0 text-sm text-site-muted">{formatDate(sermon.date)}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (layout === "featured") {
    const [featured, ...rest] = sermons;
    if (!featured) return <EmptyState message="No sermons have been added yet." />;
    return (
      <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
        <Link href={`/sermons/${featured.slug}`} className="block aspect-video rounded-lg bg-site-primary/10">
          {featured.thumbnailUrl && (
            <Image
              src={featured.thumbnailUrl}
              alt={featured.title}
              width={600}
              height={340}
              className="h-full w-full rounded-lg object-cover"
            />
          )}
        </Link>
        <div>
          <h3 className="text-2xl font-semibold text-site-foreground">{featured.title}</h3>
          <p className="mt-2 text-site-muted">
            {featured.speaker ?? "Guest Speaker"} &middot; {formatDate(featured.date)}
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            {rest.slice(0, 4).map((s) => (
              <li key={s.id}>
                <Link href={`/sermons/${s.slug}`} className="hover:text-site-accent">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {sermons.slice(0, limit ?? 6).map((sermon) => (
        <Link
          key={sermon.id}
          href={`/sermons/${sermon.slug}`}
          className="group overflow-hidden rounded-lg border border-site-muted/15 transition-shadow hover:shadow-md"
        >
          <div className="aspect-video bg-site-primary/10">
            {sermon.thumbnailUrl ? (
              <Image src={sermon.thumbnailUrl} alt={sermon.title} width={400} height={225} className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-end p-4"
                style={{ background: "linear-gradient(160deg, var(--color-primary), color-mix(in oklab, var(--color-accent) 55%, var(--color-primary)))" }}
              >
                <span className="text-xs font-medium text-white/80">{sermon.series || "Message"}</span>
              </div>
            )}
          </div>
          <div className="p-4">
            {sermon.series && <Badge variant="secondary">{sermon.series}</Badge>}
            <h3 className="mt-2 font-semibold text-site-foreground group-hover:text-site-accent">{sermon.title}</h3>
            <p className="mt-1 text-sm text-site-muted">
              {sermon.speaker ?? "Guest Speaker"} &middot; {formatDate(sermon.date)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function EventCollectionView({
  layout,
  limit,
  events,
}: {
  layout: "grid" | "list" | "calendar";
  limit?: number;
  events: EventSummary[];
}) {
  if (events.length === 0) return <EmptyState message="No upcoming events." />;

  if (layout === "list") {
    return (
      <ul className="w-full divide-y divide-site-muted/15">
        {events.slice(0, limit ?? 8).map((event) => (
          <li key={event.id} className="py-4">
            <Link
              href={`/events/${event.slug}`}
              className="flex flex-col gap-1 hover:text-site-accent sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium">{event.title}</span>
                {event.location && <span className="ml-2 text-sm text-site-muted">{event.location}</span>}
              </span>
              <span className="shrink-0 text-sm text-site-muted">{formatDate(event.startAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (layout === "calendar") {
    const groups = events.reduce<Record<string, EventSummary[]>>((acc, event) => {
      const key = new Date(event.startAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      acc[key] = acc[key] ? [...acc[key], event] : [event];
      return acc;
    }, {});
    return (
      <div className="w-full space-y-8">
        {Object.entries(groups).map(([month, monthEvents]) => (
          <div key={month}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-site-muted">{month}</h3>
            <ul className="mt-3 divide-y divide-site-muted/15">
              {monthEvents.map((event) => (
                <li key={event.id} className="py-3">
                  <Link
                    href={`/events/${event.slug}`}
                    className="flex flex-col gap-1 hover:text-site-accent sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0 truncate font-medium">{event.title}</span>
                    <span className="shrink-0 text-sm text-site-muted">{formatDate(event.startAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.slice(0, limit ?? 6).map((event) => (
        <Link
          key={event.id}
          href={`/events/${event.slug}`}
          className="group overflow-hidden rounded-lg border border-site-muted/15 transition-shadow hover:shadow-md"
        >
          <div className="aspect-video bg-site-secondary/10">
            {event.imageUrl ? (
              <Image src={event.imageUrl} alt={event.title} width={400} height={225} className="h-full w-full object-cover" />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--color-primary) 75%, white), var(--color-accent))" }}
              />
            )}
          </div>
          <div className="p-4">
            <p className="text-sm font-medium text-site-accent">{formatDate(event.startAt)}</p>
            <h3 className="mt-1 font-semibold text-site-foreground group-hover:text-site-accent">{event.title}</h3>
            {event.location && <p className="mt-1 text-sm text-site-muted">{event.location}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}

/**
 * Renders only the ministries actually written for this church. Previously
 * this fell back to a hardcoded sample list, which published three ministries
 * ("Kids Ministry", "Youth Group", "Worship Team") that the church may not
 * run — invented content on a live public page.
 */
function MinistryCollectionView({ items }: { items: Array<{ name: string; description: string }> }) {
  if (items.length === 0) {
    return <EmptyState message="Ministries are being added soon." />;
  }

  return (
    <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((ministry, index) => (
        <div key={ministry.name} className="overflow-hidden rounded-2xl border border-site-muted/15 bg-site-background shadow-sm">
          <div
            className="h-28"
            style={{
              background:
                index % 3 === 0
                  ? "linear-gradient(135deg, var(--color-primary), var(--color-accent))"
                  : index % 3 === 1
                    ? "linear-gradient(135deg, var(--color-secondary), var(--color-primary))"
                    : "linear-gradient(135deg, color-mix(in oklab, var(--color-primary) 70%, black), var(--color-accent))",
            }}
          />
          <div className="p-6">
            <h3 className="font-semibold text-site-foreground">{ministry.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-site-muted">{ministry.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactInfoView({ site }: { site: SiteConfig }) {
  const contact = site.contact ?? {};
  return (
    <div className="space-y-2 text-site-muted">
      {contact.email && <p>{contact.email}</p>}
      {contact.phone && <p>{contact.phone}</p>}
      {contact.address && <p>{contact.address}</p>}
      {!contact.email && !contact.phone && !contact.address && <p>Contact details coming soon.</p>}
    </div>
  );
}

function SocialLinksView({ site }: { site: SiteConfig }) {
  const socials = site.socialLinks ?? [];
  if (socials.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm font-medium text-site-accent">
      {socials.map((s) => (
        <a
          key={s.platform}
          href={safeLinkTarget(s.url, "#")}
          target="_blank"
          rel="noopener noreferrer"
          className="px-1 py-1.5 capitalize hover:underline"
        >
          {s.platform}
        </a>
      ))}
    </div>
  );
}

function GivingCtaView({ site }: { site: SiteConfig }) {
  const givingUrl = site.giving?.givingUrl || "#";
  return (
    <Link href={givingUrl} className={buttonVariants({ variant: "site", size: "lg" })}>
      Give Now
    </Link>
  );
}
