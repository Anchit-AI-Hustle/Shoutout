import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAnonClient } from '@shoutout/db';
import { SHOUT_TYPES, isShoutTypeConfigured, registry } from '@shoutout/shout-types';
import { getServerSupabaseClient } from '@/lib/supabase-server';

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

// POST /api/shouts — create (draft). docs/05-API.md:
// "validation: type must exist in registry; slots.length within registry
// min/max; each slot.role in registry.slotRoles; attributes match registry
// schema." org_id is resolved server-side from the session — never accepted
// from the client (docs/05-API.md conventions).
//
// Inserts shout + slots via the create_shout_with_slots RPC (migration 006)
// rather than two separate calls, so a slot-insert failure can't leave an
// orphaned shout with no slots.
const slotInputSchema = z.object({
  role: z.string(),
  compModel: z.enum(['fee', 'points', 'hybrid', 'credit']),
  attributes: z.record(z.unknown()).default({}),
  feePaise: z.number().int().positive().optional(),
  writerPct: z.number().min(0).max(100).optional(),
  masterPct: z.number().min(0).max(100).optional(),
  deadline: z.string().datetime().optional(),
});

const createShoutSchema = z.object({
  type: z.enum(SHOUT_TYPES),
  title: z.string().min(1),
  body: z.string().optional(),
  city: z.string().optional(),
  deadline: z.string().datetime().optional(),
  visibility: z.enum(['open', 'invite', 'roster', 'verified']).default('open'),
  intent: z.record(z.unknown()).optional(),
  slots: z.array(slotInputSchema),
});

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createShoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid shout',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { type, slots, ...shoutFields } = parsed.data;

  if (!isShoutTypeConfigured(type)) {
    return NextResponse.json(
      {
        error: { code: 'VALIDATION_FAILED', message: `Shout type "${type}" is not yet configured` },
      },
      { status: 422 },
    );
  }
  // Non-null: isShoutTypeConfigured just confirmed this entry exists.
  const config = registry[type]!;

  if (slots.length < config.minSlots || slots.length > config.maxSlots) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: `${type} needs ${config.minSlots}-${config.maxSlots} slots, got ${slots.length}`,
        },
      },
      { status: 422 },
    );
  }

  for (const slot of slots) {
    if (!config.slotRoles.includes(slot.role)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: `"${slot.role}" is not a valid role for ${type}`,
          },
        },
        { status: 422 },
      );
    }
    if (!config.compModels.includes(slot.compModel)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: `"${slot.compModel}" is not a valid comp model for ${type}`,
          },
        },
        { status: 422 },
      );
    }
    const attrCheck = config.attributeSchema.safeParse(slot.attributes);
    if (!attrCheck.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: `Invalid attributes for slot "${slot.role}"`,
            details: attrCheck.error.flatten(),
          },
        },
        { status: 422 },
      );
    }
  }

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: { code: 'NO_ACTIVE_ORG', message: 'No org for this session' } },
      { status: 403 },
    );
  }

  const { data: shoutId, error: rpcError } = await supabase.rpc('create_shout_with_slots', {
    p_org_id: membership.org_id,
    p_type: type,
    p_title: shoutFields.title,
    p_body: shoutFields.body ?? null,
    p_city: shoutFields.city ?? null,
    p_deadline: shoutFields.deadline ?? null,
    p_visibility: shoutFields.visibility,
    p_intent: shoutFields.intent ?? null,
    p_slots: slots.map((s) => ({
      role: s.role,
      attributes: s.attributes,
      comp_model: s.compModel,
      fee_paise: s.feePaise ?? null,
      writer_pct: s.writerPct ?? null,
      master_pct: s.masterPct ?? null,
      deadline: s.deadline ?? null,
    })),
  });

  if (rpcError) {
    return NextResponse.json(
      { error: { code: 'INSERT_FAILED', message: rpcError.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: shoutId, status: 'draft' }, { status: 201 });
}
