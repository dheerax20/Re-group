import { MarketingNav, HeroSection } from "@/components/marketing/hero";
import { MarketingSections } from "@/components/marketing/sections";

export default function HomePage() {
  return (
    <main className="flex-1 bg-background">
      <MarketingNav />
      <HeroSection />
      <MarketingSections />
    </main>
  );
}
