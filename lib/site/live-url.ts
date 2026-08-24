const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "regroup.app";

/** The public URL a published site is reachable at, on the platform subdomain. */
export function liveSiteUrl(slug: string): string {
  if (process.env.NODE_ENV === "development") {
    return `http://${slug}.localhost:3000`;
  }
  return `https://${slug}.${ROOT_DOMAIN}`;
}
