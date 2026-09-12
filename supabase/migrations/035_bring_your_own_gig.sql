-- 035 - Log a gig you got somewhere else.
--
-- The strategic problem this solves. Every moat in this product needs data
-- that only exists after liquidity: the credits graph needs signed works,
-- reliability needs five completed bookings per role, the benchmark index
-- needs settled bookings. All three are empty and stay empty until the
-- marketplace works, which they were supposed to help cause.
--
-- Meanwhile a lone artist gets nothing on day one. Madverse pays them
-- royalties, Hoopr pays them licensing income, and ShoutOut asks Rs499 to
-- stand in an empty room.
--
-- So: accept the gigs that already happen on WhatsApp. The artist logs the
-- booking they just agreed, the organiser confirms it on a link, and both
-- sides get a timestamped record - precisely the thing the published
-- evidence says is missing (1,800 unpaid artists in Karnataka against a
-- 15-day rule; an Rs80,000 booking with an Rs10,000 advance and no written
-- terms).
--
-- Every logged gig also manufactures the data the moats need. This is the
-- opposite of disintermediation: rather than trying to stop deals leaking
-- to WhatsApp, it invites the WhatsApp deal in.
--
-- Deliberately NOT gated by has_entitlement. It is the day-one value that
-- earns the right to charge later, and gating it would recreate the exact
-- problem it fixes.
--
-- A synthetic confirmed hold is created because bookings.hold_id is NOT
-- NULL and the no-double-confirm index keys off holds. Useful side effect:
-- a logged WhatsApp gig now also protects that date inside the platform.
--
-- Functions: log_external_gig (authenticated, own artists only),
-- get_gig_confirmation_public and confirm_gig_public (anonymous by token,
-- because requiring the organiser to sign up is how a record never gets
-- made). Confirmation is idempotent: a second tap is success, not an error.

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

-- 035 - Log a gig you got somewhere else.
--
-- The strategic problem this solves. Every moat in this product needs data
-- that only exists after liquidity: the credits graph needs signed works,
-- reliability needs five completed bookings per role, the benchmark index
-- needs settled bookings. All three are empty and stay empty until the
-- marketplace works, which they were supposed to help cause.
--
-- Meanwhile a lone artist gets nothing on day one. Madverse pays them
-- royalties, Hoopr pays them licensing income, and ShoutOut asks ₹499 to
-- stand in an empty room.
--
-- So: accept the gigs that already happen on WhatsApp. The artist logs the
-- booking they just agreed, the organiser confirms it on a link, and both
-- sides get a timestamped record - which is precisely the thing the
-- published evidence says is missing (1,800 unpaid artists in Karnataka
-- against a 15-day rule; an ₹80,000 booking with a ₹10,000 advance and no
-- written terms).
--
-- Every logged gig also manufactures the data the moats need. This is the
-- opposite of disintermediation: rather than trying to stop deals leaking
-- to WhatsApp, it invites the WhatsApp deal in.
--
-- Deliberately NOT gated. It is the day-one value that earns the right to
-- charge later, and gating it would recreate the exact problem it fixes.

alter table briefs drop constraint if exists briefs_source_check;
alter table briefs add constraint briefs_source_check
  check (source = any (array['web','whatsapp','pdf','concierge','self_logged']));

alter table bookings add column if not exists confirmation_token text;
alter table bookings add column if not exists confirmed_by_organiser_at timestamptz;
alter table bookings add column if not exists organiser_name text;
alter table bookings add column if not exists venue_name text;
create unique index if not exists bookings_confirmation_token_idx
  on bookings (confirmation_token) where confirmation_token is not null;

-- One call: brief, hold and booking for a gig that already exists.
--
-- A synthetic confirmed hold is created because bookings.hold_id is NOT
-- NULL and the double-booking index keys off holds. That means a logged
-- gig also protects the date, which is a real side benefit: an artist who
-- logs a WhatsApp booking cannot then be double-booked through the
-- platform for the same day.
create or replace function log_external_gig(
  p_artist_id uuid,
  p_event_date date,
  p_city text,
  p_event_type text,
  p_fee_paise bigint,
  p_organiser_name text,
  p_organiser_phone text default null,
  p_venue_name text default null,
  p_notes text default null
) returns table (booking_id uuid, confirmation_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_artist_org uuid; v_organiser_id uuid;
  v_brief_id uuid; v_hold_id uuid; v_booking_id uuid; v_token text;
begin
  v_org := current_org_id();
  if v_org is null then raise exception 'UNAUTHENTICATED'; end if;

  select org_id into v_artist_org from artists where id = p_artist_id;
  if v_artist_org is null then raise exception 'NOT_FOUND: artist not found'; end if;
  if v_artist_org <> v_org then
    raise exception 'FORBIDDEN: you can only log gigs for your own artists';
  end if;
  if p_fee_paise is null or p_fee_paise <= 0 then
    raise exception 'VALIDATION_FAILED: a fee is required, in paise';
  end if;

  insert into organisers (org_id, name, phone, city)
  values (v_org, coalesce(p_organiser_name, 'Organiser'), coalesce(p_organiser_phone, ''), p_city)
  returning id into v_organiser_id;

  insert into briefs (org_id, organiser_id, requested_artist_id, event_date, city,
                      event_type, genres, notes, source, status)
  values (v_org, v_organiser_id, p_artist_id, p_event_date, p_city,
          p_event_type, '{}', p_notes, 'self_logged', 'confirmed')
  returning id into v_brief_id;

  insert into holds (org_id, artist_id, brief_id, event_date, state, priority, expires_at)
  values (v_org, p_artist_id, v_brief_id, p_event_date, 'confirmed', 1, now() + interval '365 days')
  returning id into v_hold_id;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  insert into bookings (org_id, hold_id, brief_id, artist_id, organiser_id, event_date,
                        fee_paise, status, confirmation_token, organiser_name, venue_name)
  values (v_org, v_hold_id, v_brief_id, p_artist_id, v_organiser_id, p_event_date,
          p_fee_paise, 'confirmed', v_token, p_organiser_name, p_venue_name)
  returning id into v_booking_id;

  return query select v_booking_id, v_token;
end $$;

revoke execute on function log_external_gig(uuid, date, text, text, bigint, text, text, text, text)
  from public, anon;
grant execute on function log_external_gig(uuid, date, text, text, bigint, text, text, text, text)
  to authenticated;

-- The organiser opens a link and confirms. No account required: asking the
-- other side to sign up is how a record never gets made.
create or replace function get_gig_confirmation_public(p_token text)
returns table (
  artist_name text, event_date date, city text, venue_name text,
  event_type text, fee_paise bigint, organiser_name text,
  confirmed_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select a.stage_name, b.event_date, br.city, b.venue_name, br.event_type,
         b.fee_paise, b.organiser_name, b.confirmed_by_organiser_at
  from bookings b
  join artists a on a.id = b.artist_id
  join briefs br on br.id = b.brief_id
  where b.confirmation_token = p_token
  limit 1;
$$;
revoke execute on function get_gig_confirmation_public(text) from public;
grant execute on function get_gig_confirmation_public(text) to anon, authenticated;

create or replace function confirm_gig_public(p_token text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update bookings set confirmed_by_organiser_at = now(), updated_at = now()
  where confirmation_token = p_token and confirmed_by_organiser_at is null
  returning id into v_id;
  return v_id is not null;
end $$;
revoke execute on function confirm_gig_public(text) from public;
grant execute on function confirm_gig_public(text) to anon, authenticated;
