import type { Metadata } from "next";

import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { TrustLine } from "@/components/marketing/trust-line";
import { BentoSection } from "@/components/marketing/bento";
import { StorySection } from "@/components/marketing/story";
import { ShowcaseSection } from "@/components/marketing/showcase";
import { PricingTeaser } from "@/components/marketing/pricing-teaser";
import { ClosingCta } from "@/components/marketing/closing";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata: Metadata = {
  title: "Regroup — Church OS",
  description:
    "Build your church website, manage events, share sermons, and check people in — all from one simple platform.",
};

/**
 * The landing page.
 *
 * Ordered as an argument rather than as a feature list: what it looks like
 * (hero), what it does (bento), how it goes from nothing to live (story), what
 * the finished thing feels like (showcase), what it costs, then the ask.
 *
 * Everything on this page is either real product UI or copy about the product.
 * There are no customer logos, testimonials, or usage metrics, because none
 * exist yet — inventing them is the fastest way to make a page nobody believes.
 */
export default function HomePage() {
  return (
    <main className="flex-1 bg-background">
      <MarketingNav />
      <Hero />
      <TrustLine />
      <BentoSection />
      <StorySection />
      <ShowcaseSection />
      <PricingTeaser />
      <ClosingCta />
      <SiteFooter />
    </main>
  );
}
