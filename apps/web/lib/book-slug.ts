// Slugs for /book/<token>-in-<city>.
//
// Tokens come from two vocabularies that are not URL-safe: roles are stored
// snake_case ("live_band_member") and genres can contain anything a person
// typed ("r&b"). Emitting those raw produced /book/r&b-in-mumbai, which
// breaks both the URL and the sitemap XML it appears in.
//
// So every token is slugified on the way out and compared in slugified form
// on the way back, which means the stored vocabulary never has to change.

export function slugifyToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function bookSlug(token: string, city: string): string {
  return `${slugifyToken(token)}-in-${slugifyToken(city)}`;
}

/** "live-band-member-in-bengaluru" -> { token, city }. Splits on the LAST
 *  "-in-" so a token containing "in" cannot break the parse. */
export function parseBookSlug(slug: string): { token: string; city: string } | null {
  const marker = '-in-';
  const at = slug.lastIndexOf(marker);
  if (at <= 0) return null;
  const token = slug.slice(0, at);
  const city = slug.slice(at + marker.length);
  return token && city ? { token, city } : null;
}
