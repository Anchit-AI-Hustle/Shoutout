import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAnonClient } from '@shoutout/db';

// GET /api/shouts?type=&city=&role=&cursor=   discovery feed — docs/05-API.md.
// Public: reads open, publicly-visible Shouts only, via the anon key.
// RLS (migration 004: shouts_public_discovery) is the actual boundary here —
// this route filters status/visibility as a UX convenience, not a security
// control (docs/02-ARCHITECTURE.md ADR-002).

const MAX_LIMIT = 50;

const querySchema = z.object({
  type: z.string().optional(),
  city: z.string().optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(20),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    type: searchParams.get('type') ?? undefined,
    city: searchParams.get('city') ?? undefined,
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid query parameters',
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

  const { type, city, cursor, limit } = parsed.data;
  const supabase = createAnonClient(supabaseUrl, supabaseAnonKey);

  let query = supabase
    .from('shouts')
    .select('id, type, title, city, deadline, created_at')
    .eq('status', 'open')
    .eq('visibility', 'open')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (type) query = query.eq('type', type);
  if (city) query = query.eq('city', city);
  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  const nextCursor = data.length === limit ? (data[data.length - 1]?.created_at ?? null) : null;

  return NextResponse.json({ data, nextCursor });
}
