-- 035 - The credit tag, and the profile it creates.
--
-- The strategic bet, stated plainly: booking is what ShoutOut lets you do,
-- but the credit graph is why anyone shows up.
--
-- Booking needs both sides present before it is worth anything, which is
-- exactly what a cold marketplace cannot offer. A credit is worth having
-- the moment one person enters it. That is the only kind of value
-- deliverable at zero liquidity.
--
-- It is also the one thing the adjacent players cannot copy. Madverse and
-- Hoopr model tracks and rights: they know a recording exists and who owns
-- it. Neither has any concept of who was in the room. 200,000 artists on
-- Madverse and not one row saying who played tabla.
--
-- The loop:
--   1. I credit you on my work. You are not a user.
--   2. A claimable profile is minted for you, and you are notified.
--   3. You claim it. You now have a public page with a verified credit.
--   4. You credit five people on your own work.
--
-- credits.artist_id was already nullable, so the data model permitted this
-- from the start. Nothing acted on it.
--
-- One deliberate restraint: an unclaimed profile is NOT listed. It does not
-- appear in search or on /book pages until its owner claims it and chooses
-- to list. Publishing a page about someone who never opted in is precisely
-- what this product exists to stop doing to session musicians.
--
-- Tables: credit_invites. Columns: artists.claim_state, artists.claimed_at.
-- Functions: generate_claim_slug, credit_person.

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

-- 035 - The credit tag, and the profile it creates.
--
-- The strategic bet, stated plainly: booking is what ShoutOut lets you do,
-- but the credit graph is why anyone shows up. Booking needs both sides
-- present to be worth anything. A credit is worth having the moment one
-- person enters it, which is the only kind of value a cold marketplace can
-- actually deliver.
--
-- It is also the one thing the adjacent players cannot copy. Madverse and
-- Hoopr model tracks and rights: they know a recording exists and who owns
-- it. Neither has any concept of who was in the room. 200,000 artists on
-- Madverse and not a single row saying who played tabla.
--
-- The loop this enables:
--   1. I credit you on my work. You are not a user.
--   2. A claimable profile is created for you, and you are told.
--   3. You claim it. Now you have a public page with a verified credit.
--   4. You add credits on your own work, naming five more people.
--
-- credits.artist_id was already nullable, so the data model allowed this
-- all along. Nothing acted on it.

-- A profile can now exist before its owner does.
alter table artists add column if not exists claim_state text not null default 'owned'
  check (claim_state in ('owned', 'unclaimed', 'claimed'));
alter table artists add column if not exists claimed_at timestamptz;
create index if not exists artists_claim_state_idx on artists (claim_state) where claim_state = 'unclaimed';

create table credit_invites (
  id uuid primary key default gen_random_uuid(),
  -- The org that issued the credit, not the org of the person receiving it.
  org_id uuid not null references orgs(id) on delete cascade,
  work_id uuid not null references works(id) on delete cascade,
  contributor_id uuid references contributors(id) on delete set null,
  -- The placeholder profile created for the tagged person.
  artist_id uuid not null references artists(id) on delete cascade,
  invited_name text not null,
  invited_phone text,
  invited_email text,
  role text not null,
  -- Single-use, unguessable. The claim link is the whole mechanic, so it
  -- has to be safe to send over WhatsApp.
  token text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  expires_at timestamptz not null default now() + interval '180 days'
);
create unique index credit_invites_token_idx on credit_invites (token);
create index credit_invites_artist_idx on credit_invites (artist_id, status);

alter table credit_invites enable row level security;

-- Two-sided read: the org that sent it, and the org that has claimed the
-- profile it points at.
create policy credit_invites_read on credit_invites for select using (
  org_id = current_org_id()
  or exists (select 1 from artists a where a.id = credit_invites.artist_id and a.org_id = current_org_id())
);
create policy credit_invites_write on credit_invites for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- Slug generation for a person who never chose one.
create or replace function generate_claim_slug(p_name text)
returns text language plpgsql set search_path = public as $$
declare v_base text; v_slug text; v_n int := 1;
begin
  v_base := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'artist'; end if;
  v_slug := v_base;
  while exists (select 1 from artists where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end $$;

-- Tag someone on a work.
--
-- Matches an existing listed artist by name first, so crediting a real user
-- attaches to their actual profile rather than creating a duplicate ghost.
-- Otherwise it mints an unclaimed profile and an invite.
--
-- The unclaimed profile is deliberately NOT listed: it does not appear in
-- search or on /book pages until its owner claims it and chooses to list.
-- Publishing a page about someone who has not opted in would be exactly the
-- thing this product exists to stop.
create or replace function credit_person(
  p_work_id uuid,
  p_name text,
  p_role text,
  p_phone text default null,
  p_email text default null
) returns table (artist_id uuid, invite_token text, was_existing boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_work_org uuid; v_artist uuid; v_existing boolean := false;
  v_contributor uuid; v_token text;
begin
  v_org := current_org_id();
  if v_org is null then raise exception 'UNAUTHENTICATED'; end if;

  select org_id into v_work_org from works where id = p_work_id;
  if v_work_org is null then raise exception 'NOT_FOUND: work not found'; end if;
  if v_work_org <> v_org then raise exception 'FORBIDDEN: not your work'; end if;

  -- Prefer an existing profile over a new ghost.
  select id into v_artist from artists
  where lower(stage_name) = lower(trim(p_name)) and claim_state <> 'unclaimed'
  limit 1;

  if v_artist is not null then
    v_existing := true;
  else
    -- Reuse an unclaimed ghost for the same name rather than making another.
    select id into v_artist from artists
    where lower(stage_name) = lower(trim(p_name)) and claim_state = 'unclaimed'
    limit 1;

    if v_artist is null then
      insert into artists (org_id, stage_name, slug, genres, verified, fee_band_visible, listed, claim_state)
      values (v_org, trim(p_name), generate_claim_slug(p_name), '{}', false, false, false, 'unclaimed')
      returning id into v_artist;
    end if;
  end if;

  insert into contributors (work_id, org_id, name, phone, role, writer_pct, master_pct, work_for_hire, artist_id)
  values (p_work_id, v_org, trim(p_name), coalesce(p_phone, ''), p_role, 0, 0, false, v_artist)
  returning id into v_contributor;

  if not v_existing then
    insert into credit_invites (org_id, work_id, contributor_id, artist_id, invited_name, invited_phone, invited_email, role)
    values (v_org, p_work_id, v_contributor, v_artist, trim(p_name), p_phone, p_email, p_role)
    returning token into v_token;

    -- Tell them. The outbox already exists (migration 027).
    insert into notifications (org_id, channel, template, payload, to_phone, to_email, dedupe_key)
    values (
      v_org,
      case when p_phone is not null then 'whatsapp' else 'email' end,
      'credit_tag_invite',
      jsonb_build_object('name', trim(p_name), 'role', p_role, 'work_id', p_work_id, 'token', v_token),
      p_phone, p_email,
      'credit_invite:' || v_contributor
    )
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;

  return query select v_artist, v_token, v_existing;
end $$;

revoke execute on function credit_person(uuid, text, text, text, text) from public, anon;
grant execute on function credit_person(uuid, text, text, text, text) to authenticated;
