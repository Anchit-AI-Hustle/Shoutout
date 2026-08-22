import { NextResponse } from 'next/server';

// GET /api/geo — best-effort "where is this visitor" for defaulting the
// region filter on browse pages.
//
// Vercel injects these headers at the edge on every request; locally they
// are absent, which is why this degrades to null rather than guessing. A
// wrong city silently filtering the artist list would be worse than no
// filter at all, so the UI treats null as "show everywhere" and always
// leaves the control editable.
export const dynamic = 'force-dynamic';

// The cities we actually have supply in. An IP-derived city only helps if
// it matches something searchable, so map nearby/alternate spellings onto
// the canonical value rather than passing raw header text to the query.
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

export async function GET(request: Request) {
  const rawCity = request.headers.get('x-vercel-ip-city');
  const country = request.headers.get('x-vercel-ip-country');

  // decodeURIComponent: Vercel percent-encodes city names with spaces.
  let detected: string | null = null;
  if (rawCity) {
    try {
      detected = decodeURIComponent(rawCity);
    } catch {
      detected = rawCity;
    }
  }

  const canonical = detected ? (CITY_ALIASES[detected.trim().toLowerCase()] ?? null) : null;

  return NextResponse.json({
    city: canonical,
    detectedCity: detected,
    country: country ?? null,
    // Tells the client whether "no city" means "couldn't tell" or "not a
    // city we cover" — the two want different copy.
    supported: canonical !== null,
  });
}
