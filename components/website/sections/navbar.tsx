import Link from "next/link";
import Image from "next/image";
import { SectionProps } from "@/lib/site/types";
import { Container } from "./_shared";

function Links({ site }: SectionProps) {
  return (
    <ul className="flex items-center gap-6 text-sm font-medium">
      {site.navigation.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="hover:text-site-accent transition-colors">
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Brand({ site }: SectionProps) {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold">
      {site.brand.logo.url ? (
        <Image
          src={site.brand.logo.url}
          alt={site.brand.logo.alt || site.site.name}
          width={32}
          height={32}
          className="h-8 w-auto object-contain"
        />
      ) : (
        <span className="text-lg">{site.site.name}</span>
      )}
    </Link>
  );
}

export function NavbarTransparent(props: SectionProps) {
  return (
    <header className="absolute inset-x-0 top-0 z-20 py-5">
      <Container className="flex items-center justify-between text-white">
        <Brand {...props} />
        <Links {...props} />
      </Container>
    </header>
  );
}

export function NavbarSolid(props: SectionProps) {
  return (
    <header className="border-b border-site-muted/15 bg-site-background py-4">
      <Container className="flex items-center justify-between">
        <Brand {...props} />
        <Links {...props} />
      </Container>
    </header>
  );
}

export function NavbarMinimal(props: SectionProps) {
  return (
    <header className="py-6">
      <Container className="flex flex-col items-center gap-3 text-center">
        <Brand {...props} />
        <Links {...props} />
      </Container>
    </header>
  );
}
