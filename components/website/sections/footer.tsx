import { SectionProps } from "@/lib/site/types";
import { Container } from "./_shared";

export function FooterStandard({ site }: SectionProps) {
  return (
    <footer className="border-t border-site-muted/15 bg-site-background py-10">
      <Container className="flex flex-col items-center justify-between gap-4 text-sm text-site-muted sm:flex-row">
        <p>
          &copy; {new Date().getFullYear()} {site.site.name}. All rights reserved.
        </p>
        <nav className="flex gap-4">
          {site.navigation.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-site-accent">
              {item.label}
            </a>
          ))}
        </nav>
      </Container>
    </footer>
  );
}
