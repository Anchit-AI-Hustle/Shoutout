-- 024 — The three remaining singletons: credits, reliability, and the trust
-- layer that feeds them.
--
-- CLAUDE.md names seven singletons. `works` + `credits` was listed as the
-- credits graph, but only `works` and `contributors` existed. Those are the
-- *negotiation* — who claims what, still editable, possibly unsigned.
-- Credits are the *settled record*: immutable, published only once a work
-- is locked and every contributor has signed, which is exactly the
-- condition rule 4 already uses to release media. One is a draft; the other
-- is the asset a career is built on. Conflating them would mean an unsigned
-- claim could appear on a public profile.

create table credits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  work_id uuid not null references works(id) on delete cascade,
  contributor_id uuid not null references contributors(id) on delete cascade,
  artist_id uuid references artists(id) on delete set null,
  display_name text not null,
  role text not null,
  writer_pct numeric(6,3),
  master_pct numeric(6,3),
  published_at timestamptz not null default now(),
  unique (work_id, contributor_id)
);
create index credits_artist_idx on credits (artist_id, published_at desc);
create index credits_work_idx on credits (work_id);

-- Publishing is all-or-nothing per work, and only from a locked work whose
-- contributors have all signed. Returns the number of credits published so
-- a caller can tell "nothing to do" from "not eligible".
create or replace function publish_credits_for_work(p_work_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid; v_status text; v_locked timestamptz; v_unsigned int; v_count int;
begin
  select org_id, status, locked_at into v_org, v_status, v_locked
  from works where id = p_work_id;

  if v_org is null then
    raise exception 'NOT_FOUND: work not found';
  end if;
  if current_org_id() is null or current_org_id() <> v_org then
    raise exception 'FORBIDDEN: not your work';
  end if;
  if v_locked is null then
    raise exception 'WORK_NOT_LOCKED: lock the split sheet before publishing credits';
  end if;

  select count(*) into v_unsigned
  from contributors where work_id = p_work_id and signed_at is null;
  if v_unsigned > 0 then
    raise exception 'UNSIGNED_CONTRIBUTORS: % contributor(s) have not signed', v_unsigned;
  end if;

  insert into credits (org_id, work_id, contributor_id, artist_id, display_name, role, writer_pct, master_pct)
  select c.org_id, c.work_id, c.id, c.artist_id, c.name, c.role, c.writer_pct, c.master_pct
  from contributors c
  where c.work_id = p_work_id
  on conflict (work_id, contributor_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function publish_credits_for_work(uuid) from public, anon;
grant execute on function publish_credits_for_work(uuid) to authenticated;

-- Public read: a verified credit list is the whole point of the registry.
create or replace function get_artist_credits_public(p_artist_id uuid)
returns table (work_title text, role text, writer_pct numeric, master_pct numeric, published_at timestamptz)
language sql security definer set search_path = public stable as $$
  select w.title, c.role, c.writer_pct, c.master_pct, c.published_at
  from credits c join works w on w.id = c.work_id
  where c.artist_id = p_artist_id
  order by c.published_at desc
  limit 100;
$$;
revoke execute on function get_artist_credits_public(uuid) from public;
grant execute on function get_artist_credits_public(uuid) to anon, authenticated;

-- ------------------------------------------------------------- reviews
-- Two-sided, one review per party per booking, and only after the event.
-- Reviewing before the gig happens is how a rating system becomes a
-- negotiating tactic.

create table reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  direction text not null check (direction in ('organiser_to_artist', 'artist_to_organiser')),
  rating int not null check (rating between 1 and 5),
  -- Sub-scores make a score actionable. Optional: a 1-tap rating is better
  -- than an abandoned form.
  punctuality int check (punctuality between 1 and 5),
  professionalism int check (professionalism between 1 and 5),
  sound_quality int check (sound_quality between 1 and 5),
  comment text,
  subject_artist_id uuid references artists(id) on delete cascade,
  subject_org_id uuid references orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (booking_id, direction)
);
create index reviews_subject_artist_idx on reviews (subject_artist_id, created_at desc);

create or replace function assert_reviewable_booking()
returns trigger language plpgsql set search_path = public as $$
declare v_status text; v_date date;
begin
  select status, event_date into v_status, v_date from bookings where id = new.booking_id;
  if v_status is null then
    raise exception 'NOT_FOUND: booking not found';
  end if;
  if v_status not in ('performed', 'settled') then
    raise exception 'BOOKING_NOT_COMPLETE: can only review a performed or settled booking';
  end if;
  if v_date is not null and v_date > current_date then
    raise exception 'BOOKING_NOT_COMPLETE: the event has not happened yet';
  end if;
  return new;
end $$;

create trigger reviews_only_after_the_event
  before insert on reviews for each row execute function assert_reviewable_booking();

-- --------------------------------------------------- reliability scores
-- CLAUDE.md singleton 7: "One score, held per role." Per-role is the point —
-- a dependable session player can be an unproven producer, and averaging
-- those into one number destroys the only signal worth having.

create table reliability_scores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  role text not null,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  sample_n int not null default 0,
  completed_n int not null default 0,
  cancelled_n int not null default 0,
  avg_rating numeric(3,2),
  computed_at timestamptz not null default now(),
  unique (artist_id, role)
);
create index reliability_artist_idx on reliability_scores (artist_id);

-- Rule 9's discipline applied to reputation as well as price: below five
-- data points we publish nothing rather than a number that looks precise
-- and isn't. A new artist has no score, not a bad one.
create or replace function recompute_reliability(p_artist_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid; v_role text; v_written int := 0;
  v_completed int; v_cancelled int; v_avg numeric; v_n int; v_score numeric;
begin
  select org_id into v_org from artists where id = p_artist_id;
  if v_org is null then raise exception 'NOT_FOUND: artist not found'; end if;

  for v_role in select role from artist_roles where artist_id = p_artist_id and active
  loop
    select
      count(*) filter (where b.status in ('performed', 'settled')),
      count(*) filter (where b.status = 'cancelled')
      into v_completed, v_cancelled
    from bookings b where b.artist_id = p_artist_id;

    select avg(r.rating), count(*)
      into v_avg, v_n
    from reviews r
    where r.subject_artist_id = p_artist_id and r.direction = 'organiser_to_artist';

    -- Fewer than five completed bookings is not enough to say anything.
    if v_completed < 5 then
      delete from reliability_scores where artist_id = p_artist_id and role = v_role;
      continue;
    end if;

    -- 60 points of satisfaction, 40 of showing up. Deliberately simple and
    -- explainable: an artist must be able to see why their score moved.
    v_score :=
      coalesce((v_avg - 1) / 4 * 60, 30)
      + (v_completed::numeric / nullif(v_completed + v_cancelled, 0)) * 40;

    insert into reliability_scores
      (org_id, artist_id, role, score, sample_n, completed_n, cancelled_n, avg_rating, computed_at)
    values
      (v_org, p_artist_id, v_role, round(least(greatest(v_score, 0), 100), 2),
       coalesce(v_n, 0), v_completed, v_cancelled, round(v_avg, 2), now())
    on conflict (artist_id, role) do update set
      score = excluded.score, sample_n = excluded.sample_n,
      completed_n = excluded.completed_n, cancelled_n = excluded.cancelled_n,
      avg_rating = excluded.avg_rating, computed_at = now();

    v_written := v_written + 1;
  end loop;

  return v_written;
end $$;

revoke execute on function recompute_reliability(uuid) from public, anon;
grant execute on function recompute_reliability(uuid) to authenticated;

create or replace function get_artist_reliability_public(p_artist_id uuid)
returns table (role text, score numeric, completed_n int, avg_rating numeric)
language sql security definer set search_path = public stable as $$
  select r.role, r.score, r.completed_n, r.avg_rating
  from reliability_scores r where r.artist_id = p_artist_id
  order by r.score desc;
$$;
revoke execute on function get_artist_reliability_public(uuid) from public;
grant execute on function get_artist_reliability_public(uuid) to anon, authenticated;

-- Refreshing the price index is the other half of "never invent a price":
-- the materialized view already refuses cells with sample_n < 5, but it was
-- never being refreshed, so it answered insufficient_data forever.
create or replace function refresh_benchmark_index()
returns void language sql security definer set search_path = public as $$
  refresh materialized view benchmark_index;
$$;
revoke execute on function refresh_benchmark_index() from public, anon;
grant execute on function refresh_benchmark_index() to authenticated;

-- ------------------------------------------------------------------ RLS
alter table credits enable row level security;
alter table reviews enable row level security;
alter table reliability_scores enable row level security;

create policy credits_own on credits for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- Two-sided: both parties to a booking can see reviews on it.
create policy reviews_read on reviews for select using (
  org_id = current_org_id() or subject_org_id = current_org_id()
  or exists (select 1 from artists a where a.id = reviews.subject_artist_id and a.org_id = current_org_id())
);
create policy reviews_write on reviews for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

create policy reliability_own on reliability_scores for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- Applied as a follow-up: per-role reliability is only per-role if the
-- booking records which role was performed. Without it every role an artist
-- holds receives an identical score — the exact averaging that singleton 7
-- exists to prevent.
alter table bookings add column if not exists performed_role text;
create index if not exists bookings_artist_role_idx on bookings (artist_id, performed_role);
