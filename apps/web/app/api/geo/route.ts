import { NextResponse } from 'next/server';
import { resolveGeo } from '@/lib/geo';

// GET /api/geo - best-effort "where is this visitor" for defaulting the
// region filter on browse pages.
//
// The resolution itself now lives in lib/geo.ts so Server Components can call
// it during render instead of paying an HTTP round trip for it. This route
// stays for the client callers that still want it.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return NextResponse.json(resolveGeo(request.headers));
}
