"use client";

import { Reveal } from "@/components/marketing/motion-primitives";
import { PhoneFrame } from "@/components/marketing/product-chrome";
import {
  BuilderPreview,
  CheckinPreview,
  DomainPreview,
  EventsPreview,
  SermonsPreview,
  SlackPreview,
} from "@/components/marketing/previews";
import { cn } from "@/lib/utils";

/**
 * The feature grid.
 *
 * Six cards at four different sizes, because a 3×2 grid of identical boxes is
 * the single most recognisable "template" tell. The builder card spans two
 * columns and lets its UI run to the card's edge; the check-in card is tall and
 * holds a phone; the domain and Slack cards are small and quiet.
 *
 * Every card contains real product UI rather than an icon in a circle. The
 * point of the section is to show what the thing looks like.
 */

function Card({
  title,
  body,
  children,
  className,
  bleed = false,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
  className?: string;
  /** Let the preview run to the card edge instead of sitting inside padding. */
  bleed?: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex flex-col overflow-hidden rounded-3xl border border-border bg-surface transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
        className
      )}
    >
      <div className={cn("p-6 sm:p-7", bleed && "pb-0 sm:pb-0")}>
        <h3 className="text-[19px] font-semibold tracking-[-0.015em] text-foreground">
          {title}
        </h3>
        <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-muted">
          {body}
        </p>
      </div>
      {children ? (
        <div className={cn("mt-auto", bleed ? "px-6 pt-6 sm:px-7" : "p-6 pt-0 sm:p-7 sm:pt-0")}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function BentoSection() {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-28" id="product">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <h2 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[46px]">
            Everything your church needs.
            <br />
            <span className="text-muted">Nothing you don&rsquo;t.</span>
          </h2>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3 sm:mt-14">
          {/* Website builder — the headline feature, two columns wide. */}
          <Reveal className="md:col-span-2">
            <Card
              bleed
              body="Create a beautiful, responsive website without waiting on a developer. Drag sections, change the words, hit publish."
              className="h-full"
              title="Build your church website."
            >
              <div className="-mb-px overflow-hidden rounded-t-2xl border border-b-0 border-border shadow-[var(--shadow-soft)]">
                <BuilderPreview />
              </div>
            </Card>
          </Reveal>

          {/* Events */}
          <Reveal delay={0.06}>
            <Card
              body="Publish an event, take RSVPs, and send every attendee a QR ticket automatically."
              className="h-full"
              title="Events that connect people."
            >
              <EventsPreview />
            </Card>
          </Reveal>

          {/* Check-in — tall, holds the phone. */}
          <Reveal delay={0.06}>
            <Card
              bleed
              body="Scan a ticket at the door. Attendance counts itself."
              className="h-full"
              title="Check-in without the chaos."
            >
              <div className="flex justify-center">
                <PhoneFrame className="translate-y-4">
                  <CheckinPreview />
                </PhoneFrame>
              </div>
            </Card>
          </Reveal>

          {/* Sermons — wide. */}
          <Reveal className="md:col-span-2" delay={0.12}>
            <Card
              body="Paste a YouTube link and the thumbnail, title and series fill themselves in. Every message becomes part of a library people can actually browse."
              className="h-full"
              title="Turn every message into a library."
            >
              <SermonsPreview />
            </Card>
          </Reveal>

          {/* Domain */}
          <Reveal delay={0.06}>
            <Card
              body="Point the domain you already own at your new site. We handle the certificate."
              className="h-full"
              title="Your church. Your domain."
            >
              <DomainPreview />
            </Card>
          </Reveal>

          {/* Slack */}
          <Reveal className="md:col-span-2" delay={0.12}>
            <Card
              body="Connect a channel and your team sees what's happening — and can edit the site by typing to Regroup, without opening the dashboard."
              className="h-full"
              title="Keep your team in sync."
            >
              <SlackPreview />
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
