import Link from "next/link";

/**
 * The footer links only to destinations that exist.
 *
 * The usual four-column footer (Help Center, Docs, Guides, About, Contact,
 * Privacy, Terms) would be seven dead links on this deployment. A 404 in a
 * footer costs more trust than an empty column does, so the columns here are
 * the page's own sections plus the two real account routes. When those pages
 * are built, add them here — not before.
 */

const PRODUCT = [
  { href: "#product", label: "Website builder" },
  { href: "#product", label: "Events & RSVP" },
  { href: "#product", label: "Check-in" },
  { href: "#product", label: "Sermons" },
];

const EXPLORE = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link className="inline-flex items-center gap-2.5" href="/">
              <span className="flex size-8 items-center justify-center rounded-xl bg-brand text-[13px] font-bold text-brand-foreground">
                R
              </span>
              <span className="leading-none">
                <span className="block text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                  Regroup
                </span>
                <span className="mt-0.5 block text-[11px] leading-none text-muted">
                  Church OS
                </span>
              </span>
            </Link>
            <p className="mt-4 max-w-[38ch] text-[14px] leading-relaxed text-muted">
              The website builder and management platform made for churches.
            </p>
          </div>

          <div>
            <h2 className="text-[13px] font-semibold text-foreground">Product</h2>
            <ul className="mt-3 space-y-2">
              {PRODUCT.map((item) => (
                <li key={item.label}>
                  <a
                    className="text-[14px] text-muted transition-colors hover:text-foreground"
                    href={item.href}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-[13px] font-semibold text-foreground">Explore</h2>
            <ul className="mt-3 space-y-2">
              {EXPLORE.map((item) => (
                <li key={item.label}>
                  <a
                    className="text-[14px] text-muted transition-colors hover:text-foreground"
                    href={item.href}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  className="text-[14px] text-muted transition-colors hover:text-foreground"
                  href="/login"
                >
                  Log in
                </Link>
              </li>
              <li>
                <Link
                  className="text-[14px] text-muted transition-colors hover:text-foreground"
                  href="/signup"
                >
                  Get started
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-muted">
            © {new Date().getFullYear()} Regroup
          </p>
          <p className="text-[13px] text-muted">Church OS</p>
        </div>
      </div>
    </footer>
  );
}
