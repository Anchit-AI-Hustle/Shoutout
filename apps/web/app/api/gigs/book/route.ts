import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ModuleError, createPublicBrief } from '@shoutout/gigs';
import { createAnonClient } from '@shoutout/db';

// POST /api/gigs/book — public. Not in docs/12-API.md's literal endpoint
// list (which only has the authenticated POST /api/gigs/briefs); this is
// the public equivalent, needed to actually serve "Book this artist" on
// /a/[slug] — see migration 012's create_public_brief for the full
// reasoning. Unauthenticated, so org_id is never trusted from the client:
// it's resolved server-side (inside the RPC) from the artist being booked.
const eventTypes = [
  'wedding',
  'corporate',
  'festival',
  'club',
  'college',
  'private',
  'government',
  'temple',
  'other',
] as const;

const bodySchema = z.object({
  artistId: z.string().uuid(),
  eventDate: z.string().optional(),
  city: z.string().min(1),
  eventType: z.enum(eventTypes),
  genres: z.array(z.string()).default([]),
  budgetMin: z.number().int().positive().optional(),
  budgetMax: z.number().int().positive().optional(),
  crowdSize: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
  organiserName: z.string().min(1),
  organiserPhone: z.string().min(6),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid booking request',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: { code: 'CONFIG_MISSING', message: 'Supabase env vars not configured' } },
      { status: 500 },
    );
  }

  const supabase = createAnonClient(supabaseUrl, supabaseAnonKey);

  try {
    const briefId = await createPublicBrief(supabase, {
      artistId: parsed.data.artistId,
      eventDate: parsed.data.eventDate,
      city: parsed.data.city,
      eventType: parsed.data.eventType,
      genres: parsed.data.genres,
      budgetMinPaise: parsed.data.budgetMin,
      budgetMaxPaise: parsed.data.budgetMax,
      crowdSize: parsed.data.crowdSize,
      notes: parsed.data.notes,
      organiserName: parsed.data.organiserName,
      organiserPhone: parsed.data.organiserPhone,
    });
    return NextResponse.json({ id: briefId }, { status: 201 });
  } catch (error) {
    if (error instanceof ModuleError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 500;
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Something went wrong' } },
      { status: 500 },
    );
  }
}
