import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidRole, attributeSchemaForRole } from '@shoutout/identity';
import { ModuleError } from './errors';
import { slugify } from './slug';

// Business logic for the Profiles module (docs/04-PROFILES.md,
// docs/02-ARCHITECTURE.md: "business logic lives in modules/* and
// packages/*, never in a handler"). Every function takes the caller's
// already-authenticated Supabase client — RLS is still the actual
// isolation boundary (org_id checks here are input validation /
// UX-quality errors, not the security control).

export interface CreateArtistInput {
  orgId: string;
  orgType: string;
  stageName: string;
  homeCity?: string | undefined;
  genres?: string[] | undefined;
  bio?: string | undefined;
}

// A self-managed artist is an org with one roster row and commission zero
// (docs/01-PRODUCT.md, docs/04-PROFILES.md). Baked in here, not left as a
// manual follow-up step, so "one artist to five needs no migration" holds
// from the very first artist.
export async function createArtist(supabase: SupabaseClient, input: CreateArtistInput) {
  const baseSlug = slugify(input.stageName);
  if (!baseSlug) {
    throw new ModuleError(
      'VALIDATION_FAILED',
      'stageName must contain at least one letter or number',
    );
  }

  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase
      .from('artists')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: artist, error } = await supabase
    .from('artists')
    .insert({
      org_id: input.orgId,
      stage_name: input.stageName,
      slug,
      home_city: input.homeCity ?? null,
      genres: input.genres ?? [],
      bio: input.bio ?? null,
    })
    .select('*')
    .single();

  if (error) throw new ModuleError('INSERT_FAILED', error.message);

  if (input.orgType === 'self') {
    const { error: rosterError } = await supabase
      .from('roster')
      .insert({ org_id: input.orgId, artist_id: artist.id, commission_pct: 0 });
    if (rosterError) throw new ModuleError('INSERT_FAILED', rosterError.message);
  }

  return artist;
}

export interface UpdateArtistInput {
  artistId: string;
  stageName?: string | undefined;
  homeCity?: string | undefined;
  genres?: string[] | undefined;
  bio?: string | undefined;
  feeBandVisible?: boolean | undefined;
}

export async function updateArtist(supabase: SupabaseClient, input: UpdateArtistInput) {
  const patch: Record<string, unknown> = {};
  if (input.stageName !== undefined) patch.stage_name = input.stageName;
  if (input.homeCity !== undefined) patch.home_city = input.homeCity;
  if (input.genres !== undefined) patch.genres = input.genres;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.feeBandVisible !== undefined) patch.fee_band_visible = input.feeBandVisible;

  const { data, error } = await supabase
    .from('artists')
    .update(patch)
    .eq('id', input.artistId)
    .select('*')
    .maybeSingle();

  if (error) throw new ModuleError('UPDATE_FAILED', error.message);
  if (!data) throw new ModuleError('NOT_FOUND', 'Artist not found or not yours');
  return data;
}

export interface AddRoleInput {
  artistId: string;
  orgId: string;
  role: string;
  attributes: Record<string, unknown>;
  proofMediaUrl?: string | undefined;
}

// Matching happens per role, never per person (docs/04-PROFILES.md) — this
// is why role is validated against the shared vocabulary and its own
// attribute schema, not accepted as an arbitrary string.
export async function addRole(supabase: SupabaseClient, input: AddRoleInput) {
  if (!isValidRole(input.role)) {
    throw new ModuleError('VALIDATION_FAILED', `"${input.role}" is not in the role vocabulary`);
  }

  const schema = attributeSchemaForRole(input.role);
  const parsed = schema?.safeParse(input.attributes);
  if (parsed && !parsed.success) {
    throw new ModuleError(
      'VALIDATION_FAILED',
      `Invalid attributes for role "${input.role}"`,
      parsed.error.flatten(),
    );
  }

  const { data, error } = await supabase
    .from('artist_roles')
    .insert({
      artist_id: input.artistId,
      org_id: input.orgId,
      role: input.role,
      attributes: input.attributes,
      proof_media_url: input.proofMediaUrl ?? null,
    })
    .select('*')
    .single();

  if (error) {
    if (error.message.includes('duplicate key')) {
      throw new ModuleError('VALIDATION_FAILED', `Role "${input.role}" is already declared`);
    }
    throw new ModuleError('INSERT_FAILED', error.message);
  }

  return data;
}

export async function removeRole(supabase: SupabaseClient, artistId: string, role: string) {
  const { error } = await supabase
    .from('artist_roles')
    .delete()
    .eq('artist_id', artistId)
    .eq('role', role);
  if (error) throw new ModuleError('DELETE_FAILED', error.message);
}

export async function getMyProfile(supabase: SupabaseClient, orgId: string) {
  const { data: artist, error } = await supabase
    .from('artists')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw new ModuleError('QUERY_FAILED', error.message);
  if (!artist) return null;

  const { data: roles, error: rolesError } = await supabase
    .from('artist_roles')
    .select('*')
    .eq('artist_id', artist.id);
  if (rolesError) throw new ModuleError('QUERY_FAILED', rolesError.message);

  return { ...artist, roles: roles ?? [] };
}

export async function getPublicProfile(supabase: SupabaseClient, slug: string) {
  const { data: artistRows, error } = await supabase.rpc('get_artist_public', { p_slug: slug });
  if (error) throw new ModuleError('QUERY_FAILED', error.message);
  const artist = artistRows?.[0];
  if (!artist) throw new ModuleError('NOT_FOUND', 'Artist not found');

  const { data: roles, error: rolesError } = await supabase.rpc('get_artist_roles_public', {
    p_artist_id: artist.id,
  });
  if (rolesError) throw new ModuleError('QUERY_FAILED', rolesError.message);

  return { ...artist, roles: roles ?? [] };
}
