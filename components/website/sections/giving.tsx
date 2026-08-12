import Link from "next/link";
import { SectionProps } from "@/lib/site/types";
import { Container, Eyebrow, cfgString } from "./_shared";
import { buttonVariants } from "@/components/ui/button";

export function GivingCentered({ site, config }: SectionProps) {
  const givingUrl = site.giving?.givingUrl || "#";

  return (
    <section className="bg-site-primary py-20 text-white">
      <Container className="mx-auto max-w-xl text-center">
        <Eyebrow>{cfgString(config, "eyebrow", "Generosity")}</Eyebrow>
        <h2 className="mt-3 text-3xl font-bold">
          {cfgString(config, "title", "Give Online")}
        </h2>
        <p className="mt-4 text-white/80">
          {cfgString(
            config,
            "description",
            "Your generosity helps us serve our community and share hope with more people."
          )}
        </p>
        <Link
          href={givingUrl}
          className={buttonVariants({ variant: "site", size: "lg", className: "mt-8" })}
        >
          Give Now
        </Link>
      </Container>
    </section>
  );
}
