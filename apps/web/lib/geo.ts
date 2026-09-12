// Visitor city resolution, shared between the /api/geo route handler and the
// Server Components that need it during render.
//
// Extracted so /artists can resolve the city on the server. It previously ran
// this as a client fetch, which meant the first paint had no city, and the
// results list could not be rendered on the server at all - the page shipped
// "Loading..." to every crawler.
//
// Degrades to null rather than guessing: a wrong city silently filtering the
// artist list is worse than no filter, so callers treat null as "everywhere"
// and always leave the control editable.

/**
 * The cities we actually have supply in. An IP-derived city only helps if it
 * matches something searchable, so nearby and alternate spellings map onto the
 * canonical value rather than passing raw header text into the query.
 */
const CITY_ALIASES: Record<string, string> = {
  bombay: 'Mumbai',
  mumbai: 'Mumbai',
  'navi mumbai': 'Mumbai',
  thane: 'Mumbai',
  delhi: 'Delhi',
  'new delhi': 'Delhi',
  gurgaon: 'Delhi',
  gurugram: 'Delhi',
  noida: 'Delhi',
  faridabad: 'Delhi',
  ghaziabad: 'Delhi',
  bengaluru: 'Bengaluru',
  bangalore: 'Bengaluru',
  chennai: 'Chennai',
  madras: 'Chennai',
  kolkata: 'Kolkata',
  calcutta: 'Kolkata',
  pune: 'Pune',
  goa: 'Goa',
  panaji: 'Goa',
  panjim: 'Goa',
  vasco: 'Goa',
  mapusa: 'Goa',
  jaipur: 'Jaipur',
  udaipur: 'Jaipur',
  jodhpur: 'Jaipur',
  hyderabad: 'Hyderabad',
  secunderabad: 'Hyderabad',
};

export interface ResolvedGeo {
  /** A city we have supply in, or null. Safe to pass to a search filter. */
  city: string | null;
  /** What the edge actually reported, before aliasing. For copy, not queries. */
  detectedCity: string | null;
  country: string | null;
  /** Distinguishes "could not tell" from "not a city we cover". */
  supported: boolean;
}

/**
 * Reads Vercel's edge geo headers. Absent locally, which is why every field
 * degrades to null instead of throwing.
 */
export function resolveGeo(headers: Headers): ResolvedGeo {
  const rawCity = headers.get('x-vercel-ip-city');
  const country = headers.get('x-vercel-ip-country');

  // Vercel percent-encodes city names containing spaces.
  let detectedCity: string | null = null;
  if (rawCity) {
    try {
      detectedCity = decodeURIComponent(rawCity);
    } catch {
      detectedCity = rawCity;
    }
  }

  const city = detectedCity ? (CITY_ALIASES[detectedCity.trim().toLowerCase()] ?? null) : null;

  return { city, detectedCity, country: country ?? null, supported: city !== null };
}
