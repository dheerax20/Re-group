/**
 * YouTube video ids, parsed from the handful of URL shapes a church will
 * actually paste: a watch link copied from the address bar, a `youtu.be` share
 * link, an embed URL, or a Shorts link.
 *
 * Returns null for anything else, including a non-YouTube video host — the
 * caller then falls back to its own poster rather than requesting an image
 * that will 404.
 */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    return clean(parsed.pathname.slice(1));
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const fromQuery = parsed.searchParams.get("v");
    if (fromQuery) return clean(fromQuery);

    const [, segment, id] = parsed.pathname.split("/");
    if (segment === "embed" || segment === "shorts" || segment === "live") {
      return clean(id);
    }
  }

  return null;
}

/** Ids are 11 URL-safe characters; anything else is a link we can't use. */
function clean(value: string | undefined): string | null {
  if (!value) return null;
  const id = value.split(/[?&#/]/)[0];
  return /^[\w-]{11}$/.test(id) ? id : null;
}

/**
 * A poster for a sermon video.
 *
 * `hqdefault` rather than `maxresdefault`: maxres only exists for videos
 * uploaded above 720p, and when it is missing YouTube serves a grey placeholder
 * image instead of a 404 — so the card would silently show a blank rectangle
 * for exactly the older recordings a church is most likely to have.
 */
export function youtubeThumbnail(url: string | null | undefined): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
