import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ModuleError, confirmRiderPublic } from '@shoutout/gigs';
import { createAnonClient } from '@shoutout/db';

// POST /api/riders/:id/confirm { token } — public, the organiser's side of
// "both sides tick off" (docs/05-GIGS.md §5).
const bodySchema = z.object({ token: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Missing token' } },
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
    await confirmRiderPublic(supabase, id, parsed.data.token);
    return NextResponse.json({ confirmed: true });
  } catch (error) {
    if (error instanceof ModuleError) {
      const status = error.code === 'ALREADY_CONFIRMED' ? 409 : 500;
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Something went wrong' } },
      { status: 500 },
    );
  }
}
