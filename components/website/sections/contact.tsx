import { SectionProps } from "@/lib/site/types";
import { Container, Eyebrow, cfgString } from "./_shared";

export function ContactStandard({ site, config }: SectionProps) {
  const contact = site.contact ?? {};
  const socials = site.socialLinks ?? [];

  return (
    <section id="contact" className="bg-site-background py-20">
      <Container className="mx-auto max-w-xl text-center">
        <Eyebrow>{cfgString(config, "eyebrow", "Get In Touch")}</Eyebrow>
        <h2 className="mt-3 text-3xl font-bold text-site-foreground">
          {cfgString(config, "title", "Contact Us")}
        </h2>
        <div className="mt-6 space-y-2 text-site-muted">
          {contact.email && <p>{contact.email}</p>}
          {contact.phone && <p>{contact.phone}</p>}
          {contact.address && <p>{contact.address}</p>}
          {!contact.email && !contact.phone && !contact.address && (
            <p>Contact details coming soon.</p>
          )}
        </div>
        {socials.length > 0 && (
          <div className="mt-6 flex justify-center gap-4 text-sm font-medium text-site-accent">
            {socials.map((s) => (
              <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer" className="capitalize hover:underline">
                {s.platform}
              </a>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
