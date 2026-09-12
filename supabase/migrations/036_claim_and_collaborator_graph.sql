-- 036 - Claiming, and the graph the claim reveals.
--
-- preview_claim_public() is anon-callable on purpose: requiring an account
-- to see what you have been credited for would kill the loop at step one.
--
-- claim_profile() moves the artist row into the claimer's org. This is the
-- one place a row legitimately changes tenant, and it is safe because an
-- unclaimed profile has no owner to harm - it was minted by a third party
-- naming a person, and that person is now asserting the name is theirs. The
-- UPDATE is guarded on claim_state = 'unclaimed', so a stale invite can
-- never move a profile that has since been claimed or was always owned.
-- Contributor, media and role rows follow the profile, or RLS would hide
-- the credit from the person who just claimed it.
--
-- get_artist_collaborators_public() is the asset. Nothing else in this
-- market can answer "who has this drummer worked with", because nobody else
-- stores the people - only the recordings.
--
-- Functions: preview_claim_public, claim_profile,
-- get_artist_collaborators_public, get_work_credits_public.

-- ---------------------------------------------------------------------------
-- Recovered 2026-09-13.
--
-- This file held only the header comment above and no SQL at all. The schema
-- it describes was applied straight to the live database and never written
-- down here, so `supabase/migrations` could not rebuild it - nine migrations
-- (029 to 036) were in that state, including the paywall and the whole credit
-- graph. The statements below are the exact SQL that was applied, recovered
-- verbatim from the session transcripts, in application order.
-- ---------------------------------------------------------------------------

-- Claiming, and the graph the claim reveals.

-- What a claim link shows before anyone signs in: the credit waiting for
-- them. Deliberately anon-callable, because requiring an account to see
-- what you have been credited for would kill the loop at its first step.
create or replace function preview_claim_public(p_token text)
returns table (
  invited_name text, role text, work_title text,
  credited_by text, credited_on timestamptz, already_claimed boolean
)
language sql security definer set search_path = public stable as $$
  select ci.invited_name, ci.role, w.title, o.name, ci.created_at,
         ci.status <> 'pending'
  from credit_invites ci
  join works w on w.id = ci.work_id
  join orgs o on o.id = ci.org_id
  where ci.token = p_token and ci.expires_at > now()
  limit 1;
$$;
revoke execute on function preview_claim_public(text) from public;
grant execute on function preview_claim_public(text) to anon, authenticated;

-- Take ownership of a profile someone else created for you.
--
-- Moves the artist row into the claimer's org. This is the one place a row
-- legitimately changes tenant, and it is safe because an unclaimed profile
-- has no owner to harm: it was minted by a third party naming a person, and
-- that person is now asserting the name is theirs.
create or replace function claim_profile(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_invite record;
begin
  v_org := current_org_id();
  if v_org is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_invite from credit_invites where token = p_token;
  if v_invite.id is null then raise exception 'NOT_FOUND: invalid claim link'; end if;
  if v_invite.expires_at <= now() then raise exception 'EXPIRED: this claim link has expired'; end if;
  if v_invite.status <> 'pending' then raise exception 'ALREADY_CLAIMED'; end if;

  -- Only an unclaimed profile can be taken over. If it has since been
  -- claimed or was always owned, the invite is stale and must not move it.
  update artists
  set org_id = v_org, claim_state = 'claimed', claimed_at = now(), updated_at = now()
  where id = v_invite.artist_id and claim_state = 'unclaimed';

  if not found then raise exception 'ALREADY_CLAIMED'; end if;

  -- The contributor row and any media follow the profile to its new owner,
  -- otherwise RLS would hide the credit from the person who just claimed it.
  update contributors set artist_id = v_invite.artist_id where id = v_invite.contributor_id;
  update artist_media set org_id = v_org where artist_id = v_invite.artist_id;
  update artist_roles set org_id = v_org where artist_id = v_invite.artist_id;

  update credit_invites set status = 'claimed', claimed_at = now() where id = v_invite.id;

  return v_invite.artist_id;
end $$;
revoke execute on function claim_profile(text) from public, anon;
grant execute on function claim_profile(text) to authenticated;

-- The graph: who this person has actually worked with.
--
-- This is the asset. Nothing else in the Indian market can answer "who
-- played on this" or "who has this drummer worked with", because nobody
-- else stores the people, only the recordings.
create or replace function get_artist_collaborators_public(p_artist_id uuid)
returns table (
  artist_id uuid, stage_name text, slug text, role text,
  works_together bigint, claimed boolean, image_url text
)
language sql security definer set search_path = public stable as $$
  select a2.id, a2.stage_name, a2.slug,
         min(c2.role) as role,
         count(distinct c1.work_id) as works_together,
         a2.claim_state <> 'unclaimed' as claimed,
         (select m.url from artist_media m where m.artist_id = a2.id and m.kind = 'image'
          order by m.is_primary desc, m.sort_order limit 1)
  from contributors c1
  join contributors c2 on c2.work_id = c1.work_id and c2.artist_id <> c1.artist_id
  join artists a2 on a2.id = c2.artist_id
  where c1.artist_id = p_artist_id
  group by a2.id, a2.stage_name, a2.slug, a2.claim_state
  order by count(distinct c1.work_id) desc, a2.stage_name
  limit 50;
$$;
revoke execute on function get_artist_collaborators_public(uuid) from public;
grant execute on function get_artist_collaborators_public(uuid) to anon, authenticated;

-- "Who played on this?" - the question nothing in this market answers.
create or replace function get_work_credits_public(p_work_id uuid)
returns table (display_name text, role text, artist_slug text, claimed boolean)
language sql security definer set search_path = public stable as $$
  select c.name, c.role, a.slug, coalesce(a.claim_state, 'owned') <> 'unclaimed'
  from contributors c
  left join artists a on a.id = c.artist_id
  where c.work_id = p_work_id
  order by c.role, c.name;
$$;
revoke execute on function get_work_credits_public(uuid) from public;
grant execute on function get_work_credits_public(uuid) to anon, authenticated;
